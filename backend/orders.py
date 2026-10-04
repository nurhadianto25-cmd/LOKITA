"""Order engine: state machine, server-time timers, payment, titip proof-of-delivery."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import timedelta

from core import (
    orders, carts, products, stores, users, files, new_id, now, iso, current_user,
    require_seller, NO_ID, next_order_no, notify, audit,
)
from marketplace import _unit_price

router = APIRouter(prefix="/api/orders", tags=["orders"])

CONFIRM_SECONDS = 5 * 60
CANCEL_SECONDS = 60

ACTIVE_STATUSES = ["MENUNGGU_KONFIRMASI", "DIKONFIRMASI", "SEDANG_DIPROSES", "SIAP_DIANTAR",
                   "SEDANG_DIANTAR", "DISERAHKAN", "DITITIPKAN", "MENUNGGU_PENYELESAIAN"]
TERMINAL = ["SELESAI", "DIBATALKAN", "DITOLAK"]

# seller forward transitions
FORWARD = {
    "DIKONFIRMASI": "SEDANG_DIPROSES",
    "SEDANG_DIPROSES": "SIAP_DIANTAR",
    "SIAP_DIANTAR": "SEDANG_DIANTAR",
}


class CheckoutIn(BaseModel):
    store_id: str
    payment_method: str = "COD"          # COD | QRIS
    delivery_window: Optional[str] = None
    delivery_note: str = ""
    titip_allowed: bool = False
    titip_location: str = ""
    titip_notes: str = ""


class RejectIn(BaseModel):
    reason: str = "Produk Habis"


class TitipIn(BaseModel):
    proof_file_ids: List[str]


# --------------------------------------------------------------------------- helpers
async def _enrich(o: dict) -> dict:
    o = {k: v for k, v in o.items() if k != "_id"}
    _apply_auto_cancel_state(o)
    n = now()
    created = o["created_at"]
    if created.tzinfo is None:
        from core import UTC
        created = created.replace(tzinfo=UTC)
    o["created_at"] = iso(o["created_at"])
    o["confirm_deadline"] = iso(o.get("confirm_deadline"))
    o["cancel_deadline"] = iso(o.get("cancel_deadline"))
    # server-time timers
    if o["status"] == "MENUNGGU_KONFIRMASI":
        remain = CONFIRM_SECONDS - (n - created).total_seconds()
        o["seconds_to_confirm"] = max(0, int(remain))
        cancel_remain = CANCEL_SECONDS - (n - created).total_seconds()
        o["seconds_to_cancel_end"] = max(0, int(cancel_remain))
        o["buyer_can_cancel"] = cancel_remain > 0
    else:
        o["seconds_to_confirm"] = 0
        o["seconds_to_cancel_end"] = 0
        o["buyer_can_cancel"] = False
    # names
    s = await stores.find_one({"id": o["store_id"]}, NO_ID)
    o["store_name"] = s["name"] if s else "Toko"
    o["supports_cod"] = s.get("supports_cod", True) if s else True
    o["qris_file_id"] = s.get("qris_file_id") if s else None
    buyer = await users.find_one({"id": o["buyer_id"]}, NO_ID)
    o["buyer_name"] = (buyer.get("name") if buyer else "") or "Pembeli"
    o["buyer_phone"] = buyer.get("phone") if buyer else None
    o["timeline"] = [{"status": t["status"], "at": iso(t["at"]), "note": t.get("note", "")}
                     for t in o.get("timeline", [])]
    return o


def _apply_auto_cancel_state(o: dict):
    """Compute (not persist) auto-cancel for display consistency."""
    if o["status"] == "MENUNGGU_KONFIRMASI":
        created = o["created_at"]
        from core import UTC
        if created.tzinfo is None:
            created = created.replace(tzinfo=UTC)
        if (now() - created).total_seconds() > CONFIRM_SECONDS:
            o["status"] = "DIBATALKAN"
            o["cancel_reason"] = "Penjual tidak merespons"


async def _get_order_for(oid: str, user: dict, role: str = "any") -> dict:
    o = await orders.find_one({"id": oid}, NO_ID)
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    is_buyer = o["buyer_id"] == user["id"]
    is_seller = o["seller_id"] == user["id"]
    is_platform = bool(set(user.get("platform_roles", [])).intersection(
        {"super_admin", "platform_ops", "moderator", "support"}))
    if role == "buyer" and not is_buyer:
        raise HTTPException(403, "Akses ditolak")
    if role == "seller" and not is_seller:
        raise HTTPException(403, "Akses ditolak")
    if not (is_buyer or is_seller or is_platform):
        raise HTTPException(403, "Akses ditolak")
    return o


def _push(o: dict, status: str, note: str = ""):
    o.setdefault("timeline", []).append({"status": status, "at": now(), "note": note})


async def _auto_cancel_sweep():
    """Persist auto-cancel for expired unconfirmed orders. Called periodically + on reads."""
    cutoff = now() - timedelta(seconds=CONFIRM_SECONDS)
    docs = await orders.find({"status": "MENUNGGU_KONFIRMASI",
                              "created_at": {"$lt": cutoff}}, NO_ID).to_list(200)
    for o in docs:
        tl = o.get("timeline", [])
        tl.append({"status": "DIBATALKAN", "at": now(), "note": "Auto-batal: penjual tidak merespons"})
        await orders.update_one({"id": o["id"], "status": "MENUNGGU_KONFIRMASI"},
                                {"$set": {"status": "DIBATALKAN",
                                          "cancel_reason": "Penjual tidak merespons",
                                          "timeline": tl, "updated_at": now()}})
        # restore stock
        for it in o["items"]:
            await products.update_one({"id": it["product_id"]}, {"$inc": {"stock": it["qty"]}})
        await notify(o["buyer_id"], "order", f"Pesanan #{o['order_no']} dibatalkan",
                     "Penjual tidak merespons dalam 5 menit.", o["id"])
        await notify(o["seller_id"], "order", f"Pesanan #{o['order_no']} dibatalkan otomatis",
                     "Anda tidak merespons dalam 5 menit.", o["id"])


# --------------------------------------------------------------------------- checkout
@router.post("/checkout")
async def checkout(body: CheckoutIn, user: dict = Depends(current_user)):
    cid = user.get("active_community_id")
    s = await stores.find_one({"id": body.store_id, "deleted_at": None}, NO_ID)
    if not s:
        raise HTTPException(404, "Toko tidak ditemukan")
    if not s.get("is_open", True):
        raise HTTPException(400, "Toko sedang tutup, tidak dapat memesan")
    if body.payment_method == "COD" and not s.get("supports_cod", True):
        raise HTTPException(400, "Toko tidak menerima COD")
    if body.payment_method == "QRIS" and not s.get("supports_qris", True):
        raise HTTPException(400, "Toko tidak menerima QRIS")
    cart_items = await carts.find({"user_id": user["id"], "store_id": body.store_id}, NO_ID).to_list(200)
    if not cart_items:
        raise HTTPException(400, "Keranjang kosong")

    items, subtotal = [], 0.0
    for it in cart_items:
        p = await products.find_one({"id": it["product_id"], "deleted_at": None}, NO_ID)
        if not p or not p.get("active", True):
            raise HTTPException(400, "Beberapa produk tidak tersedia")
        if p.get("stock", 0) < it["qty"]:
            raise HTTPException(400, f"Stok {p['name']} tidak mencukupi")
        unit = _unit_price(p, it.get("variant"), it.get("addons", []))
        items.append({
            "product_id": p["id"], "name": p["name"], "qty": it["qty"],
            "variant": it.get("variant"), "addons": it.get("addons", []),
            "unit_price": unit, "line_total": unit * it["qty"],
            "photo_file_id": p.get("photo_file_id"),
        })
        subtotal += unit * it["qty"]

    # decrement stock
    for it in items:
        r = await products.update_one(
            {"id": it["product_id"], "stock": {"$gte": it["qty"]}},
            {"$inc": {"stock": -it["qty"]}})
        if not r.modified_count:
            raise HTTPException(400, "Stok berubah, silakan cek keranjang")

    order_no = await next_order_no()
    method = body.payment_method
    pay_status = "UNPAID" if method == "COD" else "MENUNGGU_PEMBAYARAN"
    o = {
        "id": new_id(),
        "order_no": order_no,
        "buyer_id": user["id"],
        "seller_id": s["owner_id"],
        "store_id": s["id"],
        "community_id": cid,
        "items": items,
        "subtotal": subtotal,
        "delivery_fee": 0,
        "total": subtotal,
        "status": "MENUNGGU_KONFIRMASI",
        "payment_method": method,
        "payment_status": pay_status,
        "delivery_mode": s.get("delivery_mode", "A"),
        "delivery_window": body.delivery_window,
        "delivery_note": body.delivery_note,
        "titip_allowed": body.titip_allowed,
        "titip_location": body.titip_location,
        "titip_notes": body.titip_notes,
        "delivery_outcome": None,
        "buyer_away": False,
        "buyer_received": False,
        "proof_file_ids": [],
        "cancel_reason": None,
        "reject_reason": None,
        "timeline": [{"status": "MENUNGGU_KONFIRMASI", "at": now(), "note": "Pesanan dibuat"}],
        "created_at": now(),
        "confirm_deadline": now() + timedelta(seconds=CONFIRM_SECONDS),
        "cancel_deadline": now() + timedelta(seconds=CANCEL_SECONDS),
        "updated_at": now(),
    }
    await orders.insert_one(o)
    await carts.delete_many({"user_id": user["id"], "store_id": body.store_id})
    await notify(s["owner_id"], "order", f"Pesanan baru #{order_no}",
                 "Konfirmasi dalam 5 menit.", o["id"])
    await audit(user["id"], "order.create", o["id"], {"order_no": order_no, "store": s["id"]})
    return await _enrich(o)


# --------------------------------------------------------------------------- listings
@router.get("/buyer")
async def buyer_orders(user: dict = Depends(current_user), scope: str = "active"):
    await _auto_cancel_sweep()
    statuses = ACTIVE_STATUSES if scope == "active" else TERMINAL
    docs = await orders.find({"buyer_id": user["id"], "status": {"$in": statuses}}, NO_ID)\
        .sort("created_at", -1).to_list(200)
    return [await _enrich(o) for o in docs]


@router.get("/seller")
async def seller_orders(user: dict = Depends(require_seller), scope: str = "active"):
    await _auto_cancel_sweep()
    statuses = ACTIVE_STATUSES if scope == "active" else TERMINAL
    docs = await orders.find({"seller_id": user["id"], "status": {"$in": statuses}}, NO_ID)\
        .sort("created_at", -1).to_list(200)
    return [await _enrich(o) for o in docs]


@router.get("/{oid}")
async def order_detail(oid: str, user: dict = Depends(current_user)):
    await _auto_cancel_sweep()
    o = await _get_order_for(oid, user)
    return await _enrich(o)


# --------------------------------------------------------------------------- buyer actions
@router.post("/{oid}/cancel")
async def buyer_cancel(oid: str, user: dict = Depends(current_user)):
    await _auto_cancel_sweep()
    o = await _get_order_for(oid, user, "buyer")
    if o["status"] != "MENUNGGU_KONFIRMASI":
        raise HTTPException(400, "Pesanan tidak dapat dibatalkan lagi")
    from core import UTC
    created = o["created_at"].replace(tzinfo=UTC) if o["created_at"].tzinfo is None else o["created_at"]
    if (now() - created).total_seconds() > CANCEL_SECONDS:
        raise HTTPException(400, "Batas waktu pembatalan (1 menit) sudah lewat")
    _push(o, "DIBATALKAN", "Dibatalkan oleh pembeli")
    await orders.update_one({"id": oid}, {"$set": {"status": "DIBATALKAN",
                            "cancel_reason": "Dibatalkan pembeli", "timeline": o["timeline"],
                            "updated_at": now()}})
    for it in o["items"]:
        await products.update_one({"id": it["product_id"]}, {"$inc": {"stock": it["qty"]}})
    await notify(o["seller_id"], "order", f"Pesanan #{o['order_no']} dibatalkan", "Pembeli membatalkan.", oid)
    return await order_detail(oid, user)


@router.post("/{oid}/away")
async def buyer_away(oid: str, user: dict = Depends(current_user)):
    o = await _get_order_for(oid, user, "buyer")
    await orders.update_one({"id": oid}, {"$set": {"buyer_away": True, "updated_at": now()}})
    await notify(o["seller_id"], "order", f"Pembeli #{o['order_no']} di luar rumah",
                 "Pembeli menyatakan masih di luar rumah.", oid)
    return await order_detail(oid, user)


@router.post("/{oid}/received")
async def buyer_received(oid: str, user: dict = Depends(current_user)):
    o = await _get_order_for(oid, user, "buyer")
    if o["status"] not in ("DISERAHKAN", "DITITIPKAN", "MENUNGGU_PENYELESAIAN"):
        raise HTTPException(400, "Pesanan belum sampai tahap penerimaan")
    await orders.update_one({"id": oid}, {"$set": {"buyer_received": True, "updated_at": now()}})
    o["buyer_received"] = True
    await _maybe_complete(o)
    return await order_detail(oid, user)


# --------------------------------------------------------------------------- payment
class PayMethodIn(BaseModel):
    pass


@router.post("/{oid}/pay/qris-sent")
async def buyer_qris_sent(oid: str, user: dict = Depends(current_user)):
    o = await _get_order_for(oid, user, "buyer")
    if o["payment_method"] != "QRIS" or o["payment_status"] not in ("MENUNGGU_PEMBAYARAN", "GAGAL", "EXPIRED"):
        raise HTTPException(400, "Status pembayaran tidak valid")
    await orders.update_one({"id": oid}, {"$set": {"payment_status": "SEDANG_DIVERIFIKASI", "updated_at": now()}})
    await notify(o["seller_id"], "payment", f"Pembayaran QRIS #{o['order_no']}",
                 "Pembeli menyatakan sudah membayar, mohon verifikasi.", oid)
    return await order_detail(oid, user)


@router.post("/{oid}/pay/switch-cod")
async def switch_to_cod(oid: str, user: dict = Depends(current_user)):
    o = await _get_order_for(oid, user, "buyer")
    if o["payment_method"] != "QRIS":
        raise HTTPException(400, "Hanya pembayaran QRIS yang dapat dialihkan")
    if o["payment_status"] == "BERHASIL":
        raise HTTPException(400, "Pembayaran sudah berhasil, tidak dapat diubah")
    if o["payment_status"] == "SEDANG_DIVERIFIKASI":
        raise HTTPException(400, "Pembayaran sedang diverifikasi, tunggu hasil verifikasi")
    s = await stores.find_one({"id": o["store_id"]}, NO_ID)
    if not s or not s.get("supports_cod", True):
        raise HTTPException(400, "Toko tidak mendukung COD")
    await orders.update_one({"id": oid}, {"$set": {"payment_method": "COD",
                            "payment_status": "UNPAID", "updated_at": now()}})
    await audit(user["id"], "payment.switch_cod", oid, {"order_no": o["order_no"]})
    await notify(o["seller_id"], "payment", f"Pesanan #{o['order_no']} beralih ke COD",
                 "Pembeli beralih dari QRIS ke COD.", oid)
    return await order_detail(oid, user)


# --------------------------------------------------------------------------- seller actions
@router.post("/{oid}/confirm")
async def seller_confirm(oid: str, user: dict = Depends(require_seller)):
    await _auto_cancel_sweep()
    o = await _get_order_for(oid, user, "seller")
    if o["status"] != "MENUNGGU_KONFIRMASI":
        raise HTTPException(400, "Pesanan tidak dalam status menunggu konfirmasi")
    _push(o, "DIKONFIRMASI", "Penjual mengkonfirmasi pesanan")
    await orders.update_one({"id": oid}, {"$set": {"status": "DIKONFIRMASI",
                            "timeline": o["timeline"], "updated_at": now()}})
    await notify(o["buyer_id"], "order", f"Pesanan #{o['order_no']} dikonfirmasi",
                 "Penjual menerima pesanan Anda.", oid)
    return await order_detail(oid, user)


@router.post("/{oid}/reject")
async def seller_reject(oid: str, body: RejectIn, user: dict = Depends(require_seller)):
    o = await _get_order_for(oid, user, "seller")
    if o["status"] not in ("MENUNGGU_KONFIRMASI", "DIKONFIRMASI"):
        raise HTTPException(400, "Pesanan tidak dapat ditolak pada tahap ini")
    _push(o, "DITOLAK", "Produk Habis")
    await orders.update_one({"id": oid}, {"$set": {"status": "DITOLAK",
                            "reject_reason": "Produk Habis", "timeline": o["timeline"],
                            "updated_at": now()}})
    for it in o["items"]:
        await products.update_one({"id": it["product_id"]}, {"$inc": {"stock": it["qty"]}})
    # recommendations
    recs = await _recommend(o)
    await notify(o["buyer_id"], "order", f"Pesanan #{o['order_no']} ditolak",
                 "Produk habis. Lihat rekomendasi produk serupa.", oid)
    out = await order_detail(oid, user)
    out["recommendations"] = recs
    return out


async def _recommend(o: dict) -> list:
    from sellers import product_out
    cats = list({it.get("variant") or "" for it in o["items"]})
    sample = o["items"][0]["name"] if o["items"] else ""
    same_store = await products.find({"store_id": o["store_id"], "deleted_at": None,
                                      "active": True, "stock": {"$gt": 0}}, NO_ID).limit(5).to_list(5)
    if same_store:
        return [product_out(p) for p in same_store]
    comm = await products.find({"community_id": o["community_id"], "deleted_at": None,
                                "active": True, "stock": {"$gt": 0}}, NO_ID).limit(5).to_list(5)
    return [product_out(p) for p in comm]


@router.post("/{oid}/advance")
async def seller_advance(oid: str, user: dict = Depends(require_seller)):
    o = await _get_order_for(oid, user, "seller")
    nxt = FORWARD.get(o["status"])
    if not nxt:
        raise HTTPException(400, "Status tidak dapat dilanjutkan")
    labels = {"SEDANG_DIPROSES": "Pesanan sedang diproses",
              "SIAP_DIANTAR": "Pesanan siap diantar",
              "SEDANG_DIANTAR": "Pesanan sedang diantar"}
    _push(o, nxt, labels.get(nxt, ""))
    await orders.update_one({"id": oid}, {"$set": {"status": nxt, "timeline": o["timeline"],
                            "updated_at": now()}})
    await notify(o["buyer_id"], "order", f"Pesanan #{o['order_no']}: {labels.get(nxt)}", labels.get(nxt, ""), oid)
    return await order_detail(oid, user)


@router.post("/{oid}/handover")
async def seller_handover(oid: str, user: dict = Depends(require_seller)):
    """Buyer present — handed directly."""
    o = await _get_order_for(oid, user, "seller")
    if o["status"] != "SEDANG_DIANTAR":
        raise HTTPException(400, "Pesanan belum dalam status diantar")
    _push(o, "DISERAHKAN", "Diserahkan langsung ke pembeli")
    _push(o, "MENUNGGU_PENYELESAIAN", "Menunggu penyelesaian")
    await orders.update_one({"id": oid}, {"$set": {"status": "MENUNGGU_PENYELESAIAN",
                            "delivery_outcome": "DISERAHKAN", "timeline": o["timeline"],
                            "updated_at": now()}})
    await notify(o["buyer_id"], "delivery", f"Pesanan #{o['order_no']} diserahkan",
                 "Pesanan telah diserahkan. Mohon konfirmasi penerimaan.", oid)
    return await order_detail(oid, user)


@router.post("/{oid}/titip")
async def seller_titip(oid: str, body: TitipIn, user: dict = Depends(require_seller)):
    """Leave-at-home — requires permission + exactly two proof photos."""
    o = await _get_order_for(oid, user, "seller")
    if o["status"] != "SEDANG_DIANTAR":
        raise HTTPException(400, "Pesanan belum dalam status diantar")
    if not o.get("titip_allowed"):
        raise HTTPException(400, "Pembeli tidak mengizinkan penitipan")
    if len(body.proof_file_ids) < 2:
        raise HTTPException(400, "Wajib mengunggah 2 foto bukti penitipan")
    valid = await files.count_documents({"id": {"$in": body.proof_file_ids},
                                         "owner_id": user["id"], "kind": "proof"})
    if valid < 2:
        raise HTTPException(400, "Foto bukti tidak valid")
    _push(o, "DITITIPKAN", f"Dititipkan di: {o.get('titip_location','')}")
    _push(o, "MENUNGGU_PENYELESAIAN", "Menunggu penyelesaian")
    await orders.update_one({"id": oid}, {"$set": {"status": "MENUNGGU_PENYELESAIAN",
                            "delivery_outcome": "DITITIPKAN",
                            "proof_file_ids": body.proof_file_ids[:2],
                            "timeline": o["timeline"], "updated_at": now()}})
    await audit(user["id"], "order.titip", oid, {"order_no": o["order_no"]})
    await notify(o["buyer_id"], "delivery", f"Pesanan #{o['order_no']} dititipkan",
                 "Pesanan dititipkan. Lihat foto bukti penitipan.", oid)
    return await order_detail(oid, user)


@router.post("/{oid}/payment/verify")
async def seller_verify_payment(oid: str, user: dict = Depends(require_seller)):
    o = await _get_order_for(oid, user, "seller")
    if o["payment_method"] == "QRIS":
        if o["payment_status"] != "SEDANG_DIVERIFIKASI":
            raise HTTPException(400, "Belum ada pembayaran untuk diverifikasi")
        await orders.update_one({"id": oid}, {"$set": {"payment_status": "BERHASIL", "updated_at": now()}})
    else:  # COD mark cash received
        await orders.update_one({"id": oid}, {"$set": {"payment_status": "PAID", "updated_at": now()}})
    await audit(user["id"], "payment.verify", oid, {"order_no": o["order_no"]})
    o = await orders.find_one({"id": oid}, NO_ID)
    await notify(o["buyer_id"], "payment", f"Pembayaran #{o['order_no']} dikonfirmasi",
                 "Penjual mengonfirmasi pembayaran.", oid)
    await _maybe_complete(o)
    return await order_detail(oid, user)


async def _maybe_complete(o: dict):
    """SELESAI when buyer confirmed receipt AND payment settled."""
    settled = (o["payment_method"] == "COD" and o["payment_status"] == "PAID") or \
              (o["payment_method"] == "QRIS" and o["payment_status"] == "BERHASIL")
    if o.get("buyer_received") and settled and o["status"] not in TERMINAL:
        tl = o.get("timeline", [])
        tl.append({"status": "SELESAI", "at": now(), "note": "Pesanan selesai"})
        await orders.update_one({"id": o["id"]}, {"$set": {"status": "SELESAI",
                                "timeline": tl, "updated_at": now()}})
        for uid in (o["buyer_id"], o["seller_id"]):
            await notify(uid, "order", f"Pesanan #{o['order_no']} selesai",
                         "Transaksi selesai. Beri penilaian Anda.", o["id"])
        # reliability bump
        for uid in (o["buyer_id"], o["seller_id"]):
            await users.update_one({"id": uid}, {"$inc": {"reliability.transactions": 1}})
