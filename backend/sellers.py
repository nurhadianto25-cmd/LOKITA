"""Seller store + product catalog management."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from core import (
    stores, products, users, memberships, new_id, now, current_user, require_seller,
    NO_ID, audit,
)

router = APIRouter(prefix="/api/seller", tags=["seller"])


class StoreIn(BaseModel):
    name: str
    tagline: str = ""
    description: str = ""
    category: str = "Umum"
    logo_file_id: Optional[str] = None
    cover_file_id: Optional[str] = None
    hours: str = ""
    delivery_range: str = ""
    delivery_mode: str = "A"  # A=buyer preferred, B=seller scheduled
    delivery_windows: List[str] = []
    supports_cod: bool = True
    supports_qris: bool = True
    qris_file_id: Optional[str] = None


class Variant(BaseModel):
    name: str
    price_delta: float = 0


class Addon(BaseModel):
    name: str
    price: float = 0


class ProductIn(BaseModel):
    name: str
    description: str = ""
    price: float = Field(ge=0)
    stock: int = Field(ge=0, default=0)
    category: str = "Umum"
    photo_file_id: Optional[str] = None
    variants: List[Variant] = []
    addons: List[Addon] = []


def product_status(stock: int, active: bool) -> str:
    if not active:
        return "INACTIVE"
    if stock <= 0:
        return "SOLD_OUT"
    if stock <= 5:
        return "LIMITED_STOCK"
    return "AVAILABLE"


def store_out(s: dict) -> dict:
    return {k: v for k, v in s.items() if k != "_id"}


def product_out(p: dict) -> dict:
    d = {k: v for k, v in p.items() if k != "_id"}
    d["status"] = product_status(p.get("stock", 0), p.get("active", True))
    return d


@router.post("/activate")
async def activate_seller(user: dict = Depends(current_user)):
    await users.update_one({"id": user["id"]}, {"$set": {"is_seller": True}})
    await audit(user["id"], "seller.activate", user["id"])
    return {"ok": True, "is_seller": True}


@router.get("/store")
async def my_store(user: dict = Depends(current_user)):
    s = await stores.find_one({"owner_id": user["id"], "deleted_at": None}, NO_ID)
    return store_out(s) if s else None


@router.post("/store")
async def upsert_store(body: StoreIn, user: dict = Depends(current_user)):
    cid = user.get("active_community_id")
    if not cid:
        raise HTTPException(400, "Pilih komunitas terlebih dahulu")
    if not await memberships.find_one({"user_id": user["id"], "community_id": cid}):
        raise HTTPException(403, "Anda bukan anggota komunitas ini")
    existing = await stores.find_one({"owner_id": user["id"], "deleted_at": None})
    data = body.dict()
    if existing:
        await stores.update_one({"id": existing["id"]}, {"$set": data})
        s = await stores.find_one({"id": existing["id"]}, NO_ID)
    else:
        await users.update_one({"id": user["id"]}, {"$set": {"is_seller": True}})
        roles = user.get("community_roles") or {}
        if roles.get(cid) in (None, "member"):
            roles[cid] = "seller"
            await users.update_one({"id": user["id"]}, {"$set": {"community_roles": roles}})
            await memberships.update_one({"user_id": user["id"], "community_id": cid},
                                         {"$set": {"role": "seller"}})
        s = {
            "id": new_id(),
            "owner_id": user["id"],
            "community_id": cid,
            "is_open": True,
            "rating": 0,
            "rating_count": 0,
            "deleted_at": None,
            "created_at": now(),
            **data,
        }
        await stores.insert_one(s)
        s.pop("_id", None)
        await audit(user["id"], "store.create", s["id"], {"community": cid})
    return store_out(s)


@router.post("/store/toggle")
async def toggle_store(user: dict = Depends(require_seller)):
    s = await stores.find_one({"owner_id": user["id"], "deleted_at": None})
    if not s:
        raise HTTPException(404, "Toko belum dibuat")
    new_open = not s.get("is_open", True)
    await stores.update_one({"id": s["id"]}, {"$set": {"is_open": new_open}})
    return {"is_open": new_open}


# ------------------------------------------------------------------ products
async def _my_store(user: dict) -> dict:
    s = await stores.find_one({"owner_id": user["id"], "deleted_at": None})
    if not s:
        raise HTTPException(400, "Buat toko terlebih dahulu")
    return s


@router.get("/products")
async def my_products(user: dict = Depends(require_seller)):
    s = await _my_store(user)
    docs = await products.find({"store_id": s["id"], "deleted_at": None}, NO_ID)\
        .sort("created_at", -1).to_list(500)
    return [product_out(p) for p in docs]


@router.post("/products")
async def create_product(body: ProductIn, user: dict = Depends(require_seller)):
    s = await _my_store(user)
    p = {
        "id": new_id(),
        "store_id": s["id"],
        "community_id": s["community_id"],
        "active": True,
        "deleted_at": None,
        "created_at": now(),
        **body.dict(),
    }
    await products.insert_one(p)
    p.pop("_id", None)
    return product_out(p)


@router.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn, user: dict = Depends(require_seller)):
    s = await _my_store(user)
    p = await products.find_one({"id": pid, "store_id": s["id"], "deleted_at": None})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    await products.update_one({"id": pid}, {"$set": body.dict()})
    p = await products.find_one({"id": pid}, NO_ID)
    return product_out(p)


class StockIn(BaseModel):
    stock: int = Field(ge=0)


@router.put("/products/{pid}/stock")
async def update_stock(pid: str, body: StockIn, user: dict = Depends(require_seller)):
    s = await _my_store(user)
    r = await products.update_one({"id": pid, "store_id": s["id"], "deleted_at": None},
                                  {"$set": {"stock": body.stock}})
    if not r.matched_count:
        raise HTTPException(404, "Produk tidak ditemukan")
    p = await products.find_one({"id": pid}, NO_ID)
    return product_out(p)


class ActiveIn(BaseModel):
    active: bool


@router.put("/products/{pid}/active")
async def set_active(pid: str, body: ActiveIn, user: dict = Depends(require_seller)):
    s = await _my_store(user)
    await products.update_one({"id": pid, "store_id": s["id"], "deleted_at": None},
                              {"$set": {"active": body.active}})
    p = await products.find_one({"id": pid}, NO_ID)
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    return product_out(p)


@router.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(require_seller)):
    s = await _my_store(user)
    await products.update_one({"id": pid, "store_id": s["id"]},
                              {"$set": {"deleted_at": now(), "active": False}})
    return {"ok": True}
