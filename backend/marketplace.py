"""Buyer marketplace (browse/search within active community) + cart (grouped per store)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional

from core import stores, products, carts, users, memberships, new_id, now, current_user, NO_ID
from sellers import product_out, store_out

router = APIRouter(prefix="/api/market", tags=["market"])


def _active_cid(user: dict) -> str:
    cid = user.get("active_community_id")
    if not cid:
        raise HTTPException(400, "Pilih komunitas terlebih dahulu")
    return cid


@router.get("/stores")
async def list_stores(user: dict = Depends(current_user),
                      q: Optional[str] = None, category: Optional[str] = None):
    cid = _active_cid(user)
    query = {"community_id": cid, "deleted_at": None}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    if category and category != "Semua":
        query["category"] = category
    docs = await stores.find(query, NO_ID).sort("is_open", -1).to_list(200)
    out = []
    for s in docs:
        pc = await products.count_documents({"store_id": s["id"], "deleted_at": None, "active": True})
        d = store_out(s)
        d["product_count"] = pc
        out.append(d)
    return out


@router.get("/stores/{sid}")
async def store_detail(sid: str, user: dict = Depends(current_user)):
    cid = _active_cid(user)
    s = await stores.find_one({"id": sid, "community_id": cid, "deleted_at": None}, NO_ID)
    if not s:
        raise HTTPException(404, "Toko tidak ditemukan")
    docs = await products.find({"store_id": sid, "deleted_at": None, "active": True}, NO_ID)\
        .sort("created_at", -1).to_list(500)
    return {"store": store_out(s), "products": [product_out(p) for p in docs]}


@router.get("/products/{pid}")
async def product_detail(pid: str, user: dict = Depends(current_user)):
    cid = _active_cid(user)
    p = await products.find_one({"id": pid, "community_id": cid, "deleted_at": None}, NO_ID)
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    s = await stores.find_one({"id": p["store_id"]}, NO_ID)
    return {"product": product_out(p), "store": store_out(s) if s else None}


@router.get("/search")
async def search(user: dict = Depends(current_user), q: str = Query("")):
    cid = _active_cid(user)
    query = {"community_id": cid, "deleted_at": None, "active": True}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await products.find(query, NO_ID).limit(100).to_list(100)
    return [product_out(p) for p in docs]


@router.get("/categories")
async def categories(user: dict = Depends(current_user)):
    cid = _active_cid(user)
    cats = await stores.distinct("category", {"community_id": cid, "deleted_at": None})
    return ["Semua"] + [c for c in cats if c]


# ------------------------------------------------------------------ cart
class CartItemIn(BaseModel):
    product_id: str
    qty: int = Field(ge=1, default=1)
    variant: Optional[str] = None
    addons: List[str] = []


class QtyIn(BaseModel):
    qty: int = Field(ge=1)


def _unit_price(p: dict, variant: Optional[str], addons: List[str]) -> float:
    price = float(p.get("price", 0))
    for v in p.get("variants", []):
        if v["name"] == variant:
            price += float(v.get("price_delta", 0))
    addon_map = {a["name"]: float(a.get("price", 0)) for a in p.get("addons", [])}
    for a in addons:
        price += addon_map.get(a, 0)
    return price


@router.get("/cart")
async def get_cart(user: dict = Depends(current_user)):
    items = await carts.find({"user_id": user["id"]}, NO_ID).to_list(500)
    groups = {}
    for it in items:
        p = await products.find_one({"id": it["product_id"], "deleted_at": None}, NO_ID)
        if not p:
            await carts.delete_one({"id": it["id"]})
            continue
        s = await stores.find_one({"id": p["store_id"]}, NO_ID)
        unit = _unit_price(p, it.get("variant"), it.get("addons", []))
        line = {
            "id": it["id"],
            "product_id": p["id"],
            "name": p["name"],
            "photo_file_id": p.get("photo_file_id"),
            "qty": it["qty"],
            "variant": it.get("variant"),
            "addons": it.get("addons", []),
            "unit_price": unit,
            "line_total": unit * it["qty"],
            "stock": p.get("stock", 0),
        }
        g = groups.setdefault(p["store_id"], {
            "store_id": s["id"] if s else p["store_id"],
            "store_name": s["name"] if s else "Toko",
            "is_open": s.get("is_open", True) if s else False,
            "supports_cod": s.get("supports_cod", True) if s else True,
            "supports_qris": s.get("supports_qris", True) if s else True,
            "items": [],
            "subtotal": 0,
        })
        g["items"].append(line)
        g["subtotal"] += line["line_total"]
    return list(groups.values())


@router.post("/cart")
async def add_to_cart(body: CartItemIn, user: dict = Depends(current_user)):
    cid = _active_cid(user)
    p = await products.find_one({"id": body.product_id, "community_id": cid, "deleted_at": None}, NO_ID)
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    if not p.get("active", True) or p.get("stock", 0) <= 0:
        raise HTTPException(400, "Produk sedang tidak tersedia")
    existing = await carts.find_one({"user_id": user["id"], "product_id": body.product_id,
                                     "variant": body.variant, "addons": body.addons})
    if existing:
        await carts.update_one({"id": existing["id"]}, {"$inc": {"qty": body.qty}})
    else:
        await carts.insert_one({
            "id": new_id(), "user_id": user["id"], "store_id": p["store_id"],
            "product_id": body.product_id, "qty": body.qty, "variant": body.variant,
            "addons": body.addons, "created_at": now(),
        })
    return await get_cart(user)


@router.put("/cart/{item_id}")
async def update_cart_item(item_id: str, body: QtyIn, user: dict = Depends(current_user)):
    await carts.update_one({"id": item_id, "user_id": user["id"]}, {"$set": {"qty": body.qty}})
    return await get_cart(user)


@router.delete("/cart/{item_id}")
async def delete_cart_item(item_id: str, user: dict = Depends(current_user)):
    await carts.delete_one({"id": item_id, "user_id": user["id"]})
    return await get_cart(user)
