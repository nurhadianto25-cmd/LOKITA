"""Profile, file upload/download, notifications, ratings, reports, account deletion, admin."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional

from core import (
    users, orders, stores, products, communities, memberships, notifications, ratings,
    reports, files, sessions, audit_logs, new_id, now, iso, current_user, optional_user,
    require_platform, NO_ID, store_upload, store_fetch, decode_token, notify, audit,
)

router = APIRouter(prefix="/api", tags=["misc"])


# --------------------------------------------------------------------------- profile
class ProfileIn(BaseModel):
    name: Optional[str] = None
    address: Optional[dict] = None
    avatar_file_id: Optional[str] = None


@router.put("/profile")
async def update_profile(body: ProfileIn, user: dict = Depends(current_user)):
    patch = {k: v for k, v in body.dict().items() if v is not None}
    if patch:
        await users.update_one({"id": user["id"]}, {"$set": patch})
    from core import public_user
    u = await users.find_one({"id": user["id"]}, NO_ID)
    return public_user(u)


# --------------------------------------------------------------------------- files
@router.post("/files")
async def upload_file(file: UploadFile = File(...), kind: str = Form("product"),
                      order_id: Optional[str] = Form(None), user: dict = Depends(current_user)):
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Ukuran file maksimal 8MB")
    ct = file.content_type or "image/jpeg"
    if not ct.startswith("image/"):
        raise HTTPException(400, "Hanya file gambar yang diizinkan")
    ext = "png" if "png" in ct else "jpg"
    rec = await store_upload(data, ct, user["id"], kind, order_id, ext)
    return rec


@router.get("/files/{file_id}")
async def download_file(file_id: str, token: Optional[str] = Query(None),
                        user: Optional[dict] = Depends(optional_user)):
    if user is None and token:
        try:
            payload = decode_token(token)
            u = await users.find_one({"id": payload.get("sub"), "deleted_at": None}, NO_ID)
            user = u
        except Exception:
            user = None
    if user is None:
        raise HTTPException(401, "Token diperlukan")
    f = await files.find_one({"id": file_id}, NO_ID)
    if not f:
        raise HTTPException(404, "Berkas tidak ditemukan")
    # private files: proof / chat -> only order participants or platform
    if f["kind"] in ("proof", "chat") and f.get("order_id"):
        o = await orders.find_one({"id": f["order_id"]}, NO_ID)
        allowed = o and (user["id"] in (o["buyer_id"], o["seller_id"]))
        is_platform = set(user.get("platform_roles", [])).intersection(
            {"super_admin", "platform_ops", "moderator", "support"})
        if not allowed and not is_platform:
            raise HTTPException(403, "Akses ditolak")
    try:
        content, ctype = await store_fetch(f["storage_path"])
    except Exception:
        raise HTTPException(404, "Berkas tidak tersedia")
    return Response(content=content, media_type=ctype,
                    headers={"Cache-Control": "private, max-age=3600"})


# --------------------------------------------------------------------------- notifications
@router.get("/notifications")
async def list_notifications(user: dict = Depends(current_user)):
    docs = await notifications.find({"user_id": user["id"]}, NO_ID)\
        .sort("created_at", -1).limit(100).to_list(100)
    return [{**{k: v for k, v in d.items()}, "created_at": iso(d["created_at"])} for d in docs]


@router.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(current_user)):
    c = await notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": c}


@router.post("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(current_user)):
    await notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(current_user)):
    await notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# --------------------------------------------------------------------------- ratings
class RatingIn(BaseModel):
    order_id: str
    stars: int = Field(ge=1, le=5)
    comment: str = ""


@router.post("/ratings")
async def create_rating(body: RatingIn, user: dict = Depends(current_user)):
    o = await orders.find_one({"id": body.order_id}, NO_ID)
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if o["status"] != "SELESAI":
        raise HTTPException(400, "Penilaian hanya untuk pesanan selesai")
    if user["id"] not in (o["buyer_id"], o["seller_id"]):
        raise HTTPException(403, "Akses ditolak")
    is_buyer = user["id"] == o["buyer_id"]
    to_id = o["seller_id"] if is_buyer else o["buyer_id"]
    role = "seller" if is_buyer else "buyer"
    if await ratings.find_one({"order_id": body.order_id, "from_id": user["id"]}):
        raise HTTPException(400, "Anda sudah memberi penilaian")
    await ratings.insert_one({
        "id": new_id(), "order_id": body.order_id, "from_id": user["id"], "to_id": to_id,
        "role": role, "stars": body.stars, "comment": body.comment, "store_id": o["store_id"],
        "created_at": now(),
    })
    if is_buyer:
        agg = await ratings.aggregate([
            {"$match": {"store_id": o["store_id"], "role": "seller"}},
            {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "n": {"$sum": 1}}},
        ]).to_list(1)
        if agg:
            await stores.update_one({"id": o["store_id"]},
                                    {"$set": {"rating": round(agg[0]["avg"], 1), "rating_count": agg[0]["n"]}})
    return {"ok": True}


@router.get("/ratings/order/{order_id}")
async def order_ratings(order_id: str, user: dict = Depends(current_user)):
    docs = await ratings.find({"order_id": order_id}, NO_ID).to_list(10)
    mine = next((d for d in docs if d["from_id"] == user["id"]), None)
    return {"mine": {"stars": mine["stars"], "comment": mine["comment"]} if mine else None,
            "count": len(docs)}


# --------------------------------------------------------------------------- reports
class ReportIn(BaseModel):
    target_type: str
    target_id: str
    reason: str


@router.post("/reports")
async def create_report(body: ReportIn, user: dict = Depends(current_user)):
    await reports.insert_one({
        "id": new_id(), "reporter_id": user["id"], "target_type": body.target_type,
        "target_id": body.target_id, "reason": body.reason, "status": "REVIEW",
        "created_at": now(),
    })
    await audit(user["id"], "report.create", body.target_id, {"type": body.target_type})
    return {"ok": True, "message": "Laporan terkirim dan akan ditinjau"}


# --------------------------------------------------------------------------- account deletion
class DeleteIn(BaseModel):
    pin: str


@router.post("/account/delete")
async def delete_account(body: DeleteIn, user: dict = Depends(current_user)):
    from core import pin_ok
    full = await users.find_one({"id": user["id"]}, NO_ID)
    if not pin_ok(body.pin, full.get("pin_hash", "")):
        raise HTTPException(401, "PIN salah")
    active = await orders.count_documents({
        "$or": [{"buyer_id": user["id"]}, {"seller_id": user["id"]}],
        "status": {"$in": ["MENUNGGU_KONFIRMASI", "DIKONFIRMASI", "SEDANG_DIPROSES",
                            "SIAP_DIANTAR", "SEDANG_DIANTAR", "DISERAHKAN", "DITITIPKAN",
                            "MENUNGGU_PENYELESAIAN"]}})
    if active > 0:
        raise HTTPException(400, "Selesaikan pesanan aktif Anda sebelum menghapus akun")
    # anonymize identity, retain transactional records per policy, revoke sessions
    await users.update_one({"id": user["id"]}, {"$set": {
        "deleted_at": now(), "name": "Pengguna Dihapus",
        "phone": f"deleted_{user['id']}", "pin_hash": "", "address": None,
        "avatar_file_id": None}})
    await sessions.update_many({"user_id": user["id"]}, {"$set": {"revoked_at": now()}})
    await stores.update_many({"owner_id": user["id"]}, {"$set": {"deleted_at": now(), "is_open": False}})
    await products.update_many({"community_id": {"$exists": True}}, {})  # no-op guard
    await audit(user["id"], "account.delete", user["id"])
    return {"ok": True, "message": "Akun dihapus. Data pribadi telah dianonimkan."}


# --------------------------------------------------------------------------- admin
@router.get("/admin/metrics")
async def admin_metrics(user: dict = Depends(require_platform("super_admin", "platform_ops"))):
    total_users = await users.count_documents({"deleted_at": None})
    total_sellers = await users.count_documents({"is_seller": True, "deleted_at": None})
    total_comm = await communities.count_documents({"status": "active"})
    total_products = await products.count_documents({"deleted_at": None})
    total_orders = await orders.count_documents({})
    completed = await orders.count_documents({"status": "SELESAI"})
    gmv_agg = await orders.aggregate([
        {"$match": {"status": "SELESAI"}},
        {"$group": {"_id": None, "gmv": {"$sum": "$total"}}}]).to_list(1)
    gmv = gmv_agg[0]["gmv"] if gmv_agg else 0
    open_reports = await reports.count_documents({"status": "REVIEW"})
    # active users: placed/received an order in last 30 days
    from datetime import timedelta
    cutoff = now() - timedelta(days=30)
    recent = await orders.find({"created_at": {"$gt": cutoff}}, NO_ID).to_list(10000)
    active_ids = set()
    for o in recent:
        active_ids.add(o["buyer_id"])
        active_ids.add(o["seller_id"])
    return {
        "users": total_users, "sellers": total_sellers, "buyers": total_users - total_sellers,
        "active_users": len(active_ids), "communities": total_comm, "products": total_products,
        "orders": total_orders, "completed_orders": completed, "gmv": gmv,
        "open_reports": open_reports,
    }


@router.get("/admin/communities")
async def admin_communities(user: dict = Depends(require_platform("super_admin", "platform_ops"))):
    docs = await communities.find({}, NO_ID).sort("created_at", -1).limit(200).to_list(200)
    out = []
    for c in docs:
        member_count = await memberships.count_documents({"community_id": c["id"]})
        store_count = await stores.count_documents({"community_id": c["id"], "deleted_at": None})
        order_count = await orders.count_documents({"community_id": c["id"]})
        owner = await users.find_one({"id": c.get("owner_id")}, NO_ID)
        status = c.get("verification_status") or ("verified" if c.get("verified") else "unverified")
        out.append({
            "id": c["id"], "name": c["name"], "location": c.get("location", ""),
            "status": c.get("status", "active"), "verification_status": status,
            "owner_name": (owner or {}).get("name") or "—",
            "members": member_count, "stores": store_count, "orders": order_count,
            "created_at": iso(c.get("created_at")),
        })
    return out


@router.get("/admin/audit")
async def admin_audit(user: dict = Depends(require_platform("super_admin", "platform_ops"))):
    docs = await audit_logs.find({}, NO_ID).sort("created_at", -1).limit(150).to_list(150)
    actor_ids = [d.get("actor_id") for d in docs if d.get("actor_id")]
    actors = {u["id"]: u for u in await users.find({"id": {"$in": actor_ids}}, NO_ID).to_list(300)}
    out = []
    for d in docs:
        a = actors.get(d.get("actor_id"), {})
        out.append({
            "id": d["id"], "actor_name": a.get("name") or "Sistem",
            "action": d.get("action"), "target": d.get("target"),
            "meta": d.get("meta", {}), "created_at": iso(d.get("created_at")),
        })
    return out


@router.get("/admin/reports")
async def admin_reports(user: dict = Depends(require_platform("super_admin", "platform_ops", "moderator"))):
    docs = await reports.find({}, NO_ID).sort("created_at", -1).limit(100).to_list(100)
    return [{**d, "created_at": iso(d["created_at"])} for d in docs]
