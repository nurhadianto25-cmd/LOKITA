"""Order-linked chat. View-only once order is SELESAI."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from core import chats, orders, users, new_id, now, iso, current_user, NO_ID, notify

router = APIRouter(prefix="/api/chat", tags=["chat"])


class MessageIn(BaseModel):
    text: Optional[str] = None
    photo_file_id: Optional[str] = None


async def _order_access(order_id: str, user: dict) -> dict:
    o = await orders.find_one({"id": order_id}, NO_ID)
    if not o:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if user["id"] not in (o["buyer_id"], o["seller_id"]) and \
       not set(user.get("platform_roles", [])).intersection({"super_admin", "platform_ops", "moderator", "support"}):
        raise HTTPException(403, "Akses ditolak")
    return o


@router.get("/threads")
async def threads(user: dict = Depends(current_user)):
    docs = await orders.find({"$or": [{"buyer_id": user["id"]}, {"seller_id": user["id"]}]}, NO_ID)\
        .sort("updated_at", -1).to_list(200)
    out = []
    for o in docs:
        last = await chats.find_one({"order_id": o["id"]}, NO_ID, sort=[("created_at", -1)])
        is_seller = o["seller_id"] == user["id"]
        other_id = o["buyer_id"] if is_seller else o["seller_id"]
        other = await users.find_one({"id": other_id}, NO_ID)
        name = (other.get("name") if other else "") or "Pengguna"
        out.append({
            "order_id": o["id"],
            "order_no": o["order_no"],
            "status": o["status"],
            "other_name": name,
            "last_message": (last.get("text") or "[Foto]") if last else "Belum ada pesan",
            "last_at": iso(last["created_at"]) if last else iso(o["created_at"]),
        })
    return out


@router.get("/{order_id}/messages")
async def messages(order_id: str, user: dict = Depends(current_user)):
    o = await _order_access(order_id, user)
    docs = await chats.find({"order_id": order_id}, NO_ID).sort("created_at", 1).to_list(1000)
    return {
        "view_only": o["status"] == "SELESAI",
        "order_no": o["order_no"],
        "status": o["status"],
        "messages": [{
            "id": m["id"], "sender_id": m["sender_id"], "mine": m["sender_id"] == user["id"],
            "type": m["type"], "text": m.get("text"), "photo_file_id": m.get("photo_file_id"),
            "at": iso(m["created_at"]),
        } for m in docs],
    }


@router.post("/{order_id}/messages")
async def send_message(order_id: str, body: MessageIn, user: dict = Depends(current_user)):
    o = await _order_access(order_id, user)
    if o["status"] == "SELESAI":
        raise HTTPException(400, "Pesanan selesai, chat hanya dapat dilihat")
    if not body.text and not body.photo_file_id:
        raise HTTPException(400, "Pesan kosong")
    m = {
        "id": new_id(),
        "order_id": order_id,
        "sender_id": user["id"],
        "type": "photo" if body.photo_file_id else "text",
        "text": body.text,
        "photo_file_id": body.photo_file_id,
        "created_at": now(),
    }
    await chats.insert_one(m)
    await orders.update_one({"id": order_id}, {"$set": {"updated_at": now()}})
    other = o["buyer_id"] if user["id"] == o["seller_id"] else o["seller_id"]
    await notify(other, "chat", f"Pesan baru #{o['order_no']}",
                 body.text or "[Foto]", order_id)
    m.pop("_id", None)
    return {"id": m["id"], "sender_id": m["sender_id"], "mine": True, "type": m["type"],
            "text": m.get("text"), "photo_file_id": m.get("photo_file_id"), "at": iso(m["created_at"])}
