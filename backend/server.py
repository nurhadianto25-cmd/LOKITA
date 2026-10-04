import asyncio
import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

import core
from core import (
    users, communities, memberships, stores, products, counters, new_id, now,
    pin_hash, init_storage,
)
import auth as auth_mod
import communities as comm_mod
import sellers as sellers_mod
import marketplace as market_mod
import orders as orders_mod
import chat as chat_mod
import misc as misc_mod
import community_admin as comm_admin_mod

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("lokita")

app = FastAPI(title="LOKITA API")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for m in (auth_mod, comm_mod, sellers_mod, market_mod, orders_mod, chat_mod, misc_mod, comm_admin_mod):
    app.include_router(m.router)


@app.get("/api/")
async def root():
    return {"app": "LOKITA", "tagline": "Your Community. Your Market.", "status": "ok"}


PILOT_CODE = "LOKITA"


async def _seed():
    # pilot community + platform super admin (owner)
    admin = await users.find_one({"phone": "+6281200000000"})
    if not admin:
        admin = {
            "id": new_id(), "phone": "+6281200000000", "pin_hash": pin_hash("123456"),
            "name": "Admin LOKITA", "is_buyer": True, "is_seller": False,
            "platform_roles": ["super_admin"], "community_roles": {}, "active_community_id": None,
            "address": None, "reliability": {"score": 100, "transactions": 0},
            "avatar_file_id": None, "deleted_at": None, "created_at": now(),
        }
        await users.insert_one(admin)

    comm = await communities.find_one({"invite_code": PILOT_CODE})
    if not comm:
        cid = new_id()
        comm = {
            "id": cid, "name": "Komunitas Pilot LOKITA",
            "description": "Komunitas percontohan untuk warga lokal.",
            "location": "Jakarta", "invite_code": PILOT_CODE, "owner_id": admin["id"],
            "status": "active", "verified": True, "created_at": now(),
        }
        await communities.insert_one(comm)
        await memberships.insert_one({"id": new_id(), "user_id": admin["id"],
                                      "community_id": cid, "role": "owner", "created_at": now()})
        roles = admin.get("community_roles") or {}
        roles[cid] = "owner"
        await users.update_one({"id": admin["id"]},
                               {"$set": {"community_roles": roles, "active_community_id": cid}})
    cid = comm["id"]

    # demo seller + store + products
    seller = await users.find_one({"phone": "+6281200000001"})
    if not seller:
        sid = new_id()
        seller = {
            "id": sid, "phone": "+6281200000001", "pin_hash": pin_hash("123456"),
            "name": "Bu Sri", "is_buyer": True, "is_seller": True,
            "platform_roles": [], "community_roles": {cid: "seller"}, "active_community_id": cid,
            "address": {"label": "Rumah", "detail": "Blok A No. 1", "lat": None, "lng": None},
            "reliability": {"score": 100, "transactions": 12}, "avatar_file_id": None,
            "deleted_at": None, "created_at": now(),
        }
        await users.insert_one(seller)
        await memberships.insert_one({"id": new_id(), "user_id": sid, "community_id": cid,
                                      "role": "seller", "created_at": now()})
        store = {
            "id": new_id(), "owner_id": sid, "community_id": cid,
            "name": "Warung Bu Sri", "tagline": "Masakan rumahan hangat setiap hari",
            "description": "Menyediakan aneka lauk, nasi, dan minuman segar untuk warga.",
            "category": "Makanan", "logo_file_id": None, "cover_file_id": None,
            "hours": "08:00 - 20:00", "delivery_range": "Dalam komunitas",
            "delivery_mode": "A", "delivery_windows": [], "supports_cod": True,
            "supports_qris": True, "qris_file_id": None, "is_open": True,
            "lat": -6.2001, "lng": 106.8166,
            "rating": 4.8, "rating_count": 24, "deleted_at": None, "created_at": now(),
        }
        await stores.insert_one(store)
        demo_products = [
            ("Nasi Goreng Spesial", "Nasi goreng dengan telur, ayam, dan kerupuk", 20000, 25, "Makanan"),
            ("Ayam Bakar + Nasi", "Ayam bakar bumbu kecap dengan lalapan", 25000, 10, "Makanan"),
            ("Es Teh Manis", "Teh manis dingin segar", 5000, 40, "Minuman"),
            ("Soto Ayam", "Soto ayam kuah bening khas rumahan", 18000, 3, "Makanan"),
        ]
        for name, desc, price, stock, cat in demo_products:
            await products.insert_one({
                "id": new_id(), "store_id": store["id"], "community_id": cid,
                "name": name, "description": desc, "price": price, "stock": stock,
                "category": cat, "photo_file_id": None, "variants": [], "addons": [],
                "active": True, "deleted_at": None, "created_at": now(),
            })

    # ensure demo store has coordinates (for delivery tracking demo)
    await stores.update_one({"name": "Warung Bu Sri", "lat": {"$in": [None, 0]}},
                            {"$set": {"lat": -6.2001, "lng": 106.8166}})

    logger.info("Seed complete. Pilot community code=%s", PILOT_CODE)


async def _sweep_loop():
    while True:
        try:
            await orders_mod._auto_cancel_sweep()
        except Exception as e:  # noqa
            logger.warning("sweep error: %s", e)
        await asyncio.sleep(20)


@app.on_event("startup")
async def startup():
    await users.create_index("phone")
    await stores.create_index("community_id")
    await products.create_index("community_id")
    await init_storage()
    await _seed()
    asyncio.create_task(_sweep_loop())


@app.on_event("shutdown")
async def shutdown():
    core.client.close()
