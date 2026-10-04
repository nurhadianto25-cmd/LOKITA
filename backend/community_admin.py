"""Community governance: dashboard, members, stores, staff (admin/moderator),
invitation/QR, settings, verification, ownership transfer, community audit.

STRICT COMMUNITY ISOLATION: every endpoint validates the caller's role for the
specific community_id in the path. A platform super_admin has platform-wide read
/write scope; every other role is confined to communities they belong to.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import timedelta
from typing import Optional
import secrets

from core import (
    communities, memberships, users, stores, products, orders, audit_logs,
    new_id, now, iso, current_user, NO_ID, audit, notify,
)

router = APIRouter(prefix="/api/communities", tags=["community-admin"])

# governance rank — seller is a regular member with a store (rank 0)
RANK = {"member": 0, "seller": 0, "moderator": 1, "admin": 2, "owner": 3}
GOV_ROLES = ("owner", "admin", "moderator")


def _is_super(user: dict) -> bool:
    return "super_admin" in (user.get("platform_roles") or [])


async def _access(user: dict, cid: str, min_rank: int) -> str:
    """Return the caller's effective role for this community or raise 403.

    Platform super_admin bypasses community membership (platform-wide scope).
    """
    c = await communities.find_one({"id": cid}, NO_ID)
    if not c:
        raise HTTPException(404, "Komunitas tidak ditemukan")
    if _is_super(user):
        return "super_admin"
    mem = await memberships.find_one({"user_id": user["id"], "community_id": cid})
    if not mem:
        raise HTTPException(403, "Akses ditolak untuk komunitas ini")
    role = mem.get("role", "member")
    # owner is authoritative via community.owner_id too
    if c.get("owner_id") == user["id"]:
        role = "owner"
    if RANK.get(role, 0) < min_rank:
        raise HTTPException(403, "Akses ditolak")
    return role


def _mask_phone(phone: Optional[str]) -> str:
    if not phone:
        return ""
    tail = phone[-4:]
    return f"••••{tail}"


async def _store_owner_ids(cid: str) -> set:
    docs = await stores.find({"community_id": cid, "deleted_at": None}, NO_ID).to_list(2000)
    return set(s["owner_id"] for s in docs), docs


# --------------------------------------------------------------------------- dashboard
@router.get("/{cid}/dashboard")
async def dashboard(cid: str, user: dict = Depends(current_user)):
    role = await _access(user, cid, 1)
    c = await communities.find_one({"id": cid}, NO_ID)

    total_members = await memberships.count_documents({"community_id": cid})
    owner_ids, store_docs = await _store_owner_ids(cid)
    total_stores = len(store_docs)
    active_stores = len([s for s in store_docs if s.get("is_open")])
    total_sellers = len(owner_ids)
    total_products = await products.count_documents({"community_id": cid, "deleted_at": None})
    total_orders = await orders.count_documents({"community_id": cid})

    cutoff = now() - timedelta(days=30)
    recent = await orders.find({"community_id": cid, "created_at": {"$gt": cutoff}}, NO_ID).to_list(5000)
    active_ids = set()
    for o in recent:
        active_ids.add(o["buyer_id"])
        active_ids.add(o["seller_id"])
    active_members = len(active_ids & set(
        m["user_id"] for m in await memberships.find({"community_id": cid}, NO_ID).to_list(5000)))

    # 7-day order activity series (oldest -> newest)
    series = []
    today = now().replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        nxt = day + timedelta(days=1)
        count = await orders.count_documents(
            {"community_id": cid, "created_at": {"$gte": day, "$lt": nxt}})
        series.append({"label": day.strftime("%d/%m"), "value": count})

    status = c.get("verification_status") or ("verified" if c.get("verified") else "unverified")
    return {
        "id": c["id"],
        "name": c["name"],
        "location": c.get("location", ""),
        "status": c.get("status", "active"),
        "verification_status": status,
        "invite_code": c.get("invite_code"),
        "owner_id": c.get("owner_id"),
        "my_role": role,
        "stats": {
            "total_members": total_members,
            "active_members": active_members,
            "total_sellers": total_sellers,
            "total_stores": total_stores,
            "active_stores": active_stores,
            "total_products": total_products,
            "total_orders": total_orders,
        },
        "activity": series,
    }


# --------------------------------------------------------------------------- members
@router.get("/{cid}/members")
async def members(cid: str, user: dict = Depends(current_user)):
    await _access(user, cid, 1)
    mems = await memberships.find({"community_id": cid}, NO_ID).sort("created_at", 1).to_list(5000)
    uids = [m["user_id"] for m in mems]
    udocs = {u["id"]: u for u in await users.find({"id": {"$in": uids}}, NO_ID).to_list(5000)}
    owner_ids, _ = await _store_owner_ids(cid)
    c = await communities.find_one({"id": cid}, NO_ID)
    out = []
    for m in mems:
        u = udocs.get(m["user_id"], {})
        role = m.get("role", "member")
        if c.get("owner_id") == m["user_id"]:
            role = "owner"
        out.append({
            "user_id": m["user_id"],
            "name": u.get("name") or "Pengguna",
            "phone": _mask_phone(u.get("phone")),
            "role": role,
            "is_seller": m["user_id"] in owner_ids,
            "status": "deleted" if u.get("deleted_at") else "active",
            "joined_at": iso(m.get("created_at")),
            "reliability": (u.get("reliability") or {}).get("score", 100),
        })
    return out


# --------------------------------------------------------------------------- stores
@router.get("/{cid}/stores")
async def community_stores(cid: str, user: dict = Depends(current_user)):
    await _access(user, cid, 1)
    docs = await stores.find({"community_id": cid, "deleted_at": None}, NO_ID)\
        .sort("created_at", -1).to_list(2000)
    out = []
    for s in docs:
        pc = await products.count_documents({"store_id": s["id"], "deleted_at": None})
        oc = await orders.count_documents({"store_id": s["id"]})
        owner = await users.find_one({"id": s["owner_id"]}, NO_ID)
        out.append({
            "id": s["id"],
            "name": s["name"],
            "owner_name": (owner or {}).get("name") or "Pengguna",
            "category": s.get("category", "Umum"),
            "is_open": s.get("is_open", False),
            "rating": s.get("rating", 0),
            "rating_count": s.get("rating_count", 0),
            "products": pc,
            "orders": oc,
        })
    return out


# --------------------------------------------------------------------------- staff
@router.get("/{cid}/staff")
async def staff(cid: str, user: dict = Depends(current_user)):
    await _access(user, cid, 2)
    mems = await memberships.find(
        {"community_id": cid, "role": {"$in": list(GOV_ROLES)}}, NO_ID).to_list(500)
    uids = [m["user_id"] for m in mems]
    udocs = {u["id"]: u for u in await users.find({"id": {"$in": uids}}, NO_ID).to_list(500)}
    c = await communities.find_one({"id": cid}, NO_ID)
    out = []
    for m in mems:
        u = udocs.get(m["user_id"], {})
        role = m.get("role")
        if c.get("owner_id") == m["user_id"]:
            role = "owner"
        out.append({
            "user_id": m["user_id"],
            "name": u.get("name") or "Pengguna",
            "phone": _mask_phone(u.get("phone")),
            "role": role,
        })
    order = {"owner": 0, "admin": 1, "moderator": 2}
    out.sort(key=lambda x: order.get(x["role"], 9))
    return out


class StaffIn(BaseModel):
    user_id: str
    role: str  # admin | moderator


@router.post("/{cid}/staff")
async def add_staff(cid: str, body: StaffIn, user: dict = Depends(current_user)):
    if body.role not in ("admin", "moderator"):
        raise HTTPException(400, "Peran tidak valid")
    # appointing an admin requires owner; appointing a moderator requires admin+
    min_rank = 3 if body.role == "admin" else 2
    await _access(user, cid, min_rank)
    mem = await memberships.find_one({"user_id": body.user_id, "community_id": cid})
    if not mem:
        raise HTTPException(404, "Pengguna bukan anggota komunitas ini")
    c = await communities.find_one({"id": cid}, NO_ID)
    if c.get("owner_id") == body.user_id:
        raise HTTPException(400, "Tidak dapat mengubah peran pemilik")
    await memberships.update_one({"user_id": body.user_id, "community_id": cid},
                                 {"$set": {"role": body.role}})
    tu = await users.find_one({"id": body.user_id}, NO_ID)
    roles = tu.get("community_roles") or {}
    roles[cid] = body.role
    await users.update_one({"id": body.user_id}, {"$set": {"community_roles": roles}})
    await audit(user["id"], f"community.staff.appoint.{body.role}", body.user_id, {"community": cid})
    await notify(body.user_id, "community", "Peran komunitas diperbarui",
                 f"Anda ditunjuk sebagai {'Admin' if body.role == 'admin' else 'Moderator'} komunitas.")
    return {"ok": True}


@router.delete("/{cid}/staff/{uid}")
async def remove_staff(cid: str, uid: str, user: dict = Depends(current_user)):
    mem = await memberships.find_one({"user_id": uid, "community_id": cid})
    if not mem:
        raise HTTPException(404, "Anggota tidak ditemukan")
    c = await communities.find_one({"id": cid}, NO_ID)
    target_role = mem.get("role")
    if c.get("owner_id") == uid or target_role == "owner":
        raise HTTPException(400, "Tidak dapat mencabut pemilik komunitas")
    if target_role not in ("admin", "moderator"):
        raise HTTPException(400, "Anggota ini bukan admin/moderator")
    # revoking an admin requires owner; revoking a moderator requires admin+
    min_rank = 3 if target_role == "admin" else 2
    await _access(user, cid, min_rank)
    owner_ids, _ = await _store_owner_ids(cid)
    new_role = "seller" if uid in owner_ids else "member"
    await memberships.update_one({"user_id": uid, "community_id": cid},
                                 {"$set": {"role": new_role}})
    tu = await users.find_one({"id": uid}, NO_ID)
    roles = tu.get("community_roles") or {}
    roles[cid] = new_role
    await users.update_one({"id": uid}, {"$set": {"community_roles": roles}})
    await audit(user["id"], f"community.staff.revoke.{target_role}", uid, {"community": cid})
    await notify(uid, "community", "Peran komunitas diperbarui",
                 "Peran admin/moderator Anda telah dicabut.")
    return {"ok": True}


# --------------------------------------------------------------------------- invite / QR
@router.get("/{cid}/invite")
async def invite(cid: str, user: dict = Depends(current_user)):
    await _access(user, cid, 2)
    c = await communities.find_one({"id": cid}, NO_ID)
    return {"community_id": cid, "name": c["name"], "invite_code": c.get("invite_code"),
            "qr_payload": f"LOKITA:JOIN:{c.get('invite_code')}"}


@router.post("/{cid}/invite/regenerate")
async def regenerate_invite(cid: str, user: dict = Depends(current_user)):
    await _access(user, cid, 2)
    code = secrets.token_hex(3).upper()
    await communities.update_one({"id": cid}, {"$set": {"invite_code": code}})
    await audit(user["id"], "community.invite.regenerate", cid, {"community": cid})
    return {"invite_code": code, "qr_payload": f"LOKITA:JOIN:{code}"}


# --------------------------------------------------------------------------- settings
class SettingsIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None


@router.put("/{cid}/settings")
async def update_settings(cid: str, body: SettingsIn, user: dict = Depends(current_user)):
    await _access(user, cid, 2)
    patch = {k: v for k, v in body.dict().items() if v is not None}
    if patch:
        await communities.update_one({"id": cid}, {"$set": patch})
        await audit(user["id"], "community.settings.update", cid, {"community": cid, "fields": list(patch.keys())})
    c = await communities.find_one({"id": cid}, NO_ID)
    return {"id": c["id"], "name": c["name"], "description": c.get("description", ""),
            "location": c.get("location", "")}


# --------------------------------------------------------------------------- verification
@router.get("/{cid}/verification")
async def verification(cid: str, user: dict = Depends(current_user)):
    await _access(user, cid, 2)
    c = await communities.find_one({"id": cid}, NO_ID)
    status = c.get("verification_status") or ("verified" if c.get("verified") else "unverified")
    return {"status": status}


@router.post("/{cid}/verification/request")
async def request_verification(cid: str, user: dict = Depends(current_user)):
    await _access(user, cid, 2)
    c = await communities.find_one({"id": cid}, NO_ID)
    if c.get("verified"):
        raise HTTPException(400, "Komunitas sudah terverifikasi")
    await communities.update_one({"id": cid}, {"$set": {"verification_status": "review"}})
    await audit(user["id"], "community.verification.request", cid, {"community": cid})
    return {"status": "review"}


# --------------------------------------------------------------------------- ownership transfer
class TransferIn(BaseModel):
    user_id: str


@router.post("/{cid}/transfer")
async def transfer_ownership(cid: str, body: TransferIn, user: dict = Depends(current_user)):
    await _access(user, cid, 3)  # owner (or super_admin) only
    c = await communities.find_one({"id": cid}, NO_ID)
    old_owner = c.get("owner_id")
    if body.user_id == old_owner:
        raise HTTPException(400, "Pengguna sudah menjadi pemilik")
    target = await memberships.find_one({"user_id": body.user_id, "community_id": cid})
    if not target:
        raise HTTPException(404, "Penerima bukan anggota komunitas ini")

    await communities.update_one({"id": cid}, {"$set": {"owner_id": body.user_id}})
    await memberships.update_one({"user_id": body.user_id, "community_id": cid},
                                 {"$set": {"role": "owner"}})
    await memberships.update_one({"user_id": old_owner, "community_id": cid},
                                 {"$set": {"role": "admin"}})
    for uid, role in ((body.user_id, "owner"), (old_owner, "admin")):
        tu = await users.find_one({"id": uid}, NO_ID)
        if tu:
            roles = tu.get("community_roles") or {}
            roles[cid] = role
            await users.update_one({"id": uid}, {"$set": {"community_roles": roles}})
    await audit(user["id"], "community.ownership.transfer", cid,
                {"community": cid, "from": old_owner, "to": body.user_id})
    await notify(body.user_id, "community", "Anda kini pemilik komunitas",
                 f"Kepemilikan komunitas {c['name']} dialihkan kepada Anda.")
    if old_owner:
        await notify(old_owner, "community", "Kepemilikan dialihkan",
                     f"Anda kini menjadi Admin di komunitas {c['name']}.")
    return {"ok": True, "owner_id": body.user_id}


# --------------------------------------------------------------------------- community audit
@router.get("/{cid}/audit")
async def community_audit(cid: str, user: dict = Depends(current_user)):
    await _access(user, cid, 2)
    docs = await audit_logs.find(
        {"$or": [{"target": cid}, {"meta.community": cid}]}, NO_ID)\
        .sort("created_at", -1).limit(100).to_list(100)
    actor_ids = [d.get("actor_id") for d in docs if d.get("actor_id")]
    actors = {u["id"]: u for u in await users.find({"id": {"$in": actor_ids}}, NO_ID).to_list(200)}
    out = []
    for d in docs:
        a = actors.get(d.get("actor_id"), {})
        out.append({
            "id": d["id"],
            "actor_name": a.get("name") or "Sistem",
            "action": d.get("action"),
            "target": d.get("target"),
            "meta": d.get("meta", {}),
            "created_at": iso(d.get("created_at")),
        })
    return out
