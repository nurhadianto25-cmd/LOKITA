"""Community & membership. Data is isolated per community."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import secrets

from core import (
    communities, memberships, users, new_id, now, current_user, NO_ID, audit,
)

router = APIRouter(prefix="/api/communities", tags=["communities"])


class CreateCommunityIn(BaseModel):
    name: str
    description: str = ""
    location: str = ""


class JoinIn(BaseModel):
    invite_code: str


def _invite_code() -> str:
    return secrets.token_hex(3).upper()


async def _public(c: dict, user_id: str = None) -> dict:
    member_count = await memberships.count_documents({"community_id": c["id"]})
    out = {
        "id": c["id"],
        "name": c["name"],
        "description": c.get("description", ""),
        "location": c.get("location", ""),
        "invite_code": c.get("invite_code"),
        "status": c.get("status"),
        "owner_id": c.get("owner_id"),
        "member_count": member_count,
    }
    if user_id:
        out["my_role"] = (user_id == c.get("owner_id") and "owner") or None
        mem = await memberships.find_one({"user_id": user_id, "community_id": c["id"]})
        if mem:
            out["my_role"] = mem.get("role")
    return out


@router.get("")
async def list_communities(user: dict = Depends(current_user)):
    docs = await communities.find({"status": "active"}, NO_ID).sort("created_at", -1).to_list(100)
    return [await _public(c, user["id"]) for c in docs]


@router.get("/mine")
async def my_communities(user: dict = Depends(current_user)):
    mems = await memberships.find({"user_id": user["id"]}, NO_ID).to_list(100)
    ids = [m["community_id"] for m in mems]
    docs = await communities.find({"id": {"$in": ids}}, NO_ID).to_list(100)
    return [await _public(c, user["id"]) for c in docs]


@router.post("/create")
async def create_community(body: CreateCommunityIn, user: dict = Depends(current_user)):
    cid = new_id()
    c = {
        "id": cid,
        "name": body.name.strip(),
        "description": body.description,
        "location": body.location,
        "invite_code": _invite_code(),
        "owner_id": user["id"],
        "status": "active",  # pilot: auto-active; governance review is a deferred platform gate
        "verified": False,
        "created_at": now(),
    }
    await communities.insert_one(c)
    await memberships.insert_one({"id": new_id(), "user_id": user["id"], "community_id": cid,
                                  "role": "owner", "created_at": now()})
    roles = user.get("community_roles") or {}
    roles[cid] = "owner"
    await users.update_one({"id": user["id"]},
                           {"$set": {"community_roles": roles, "active_community_id": cid}})
    await audit(user["id"], "community.create", cid, {"name": body.name})
    c.pop("_id", None)
    return await _public(c, user["id"])


@router.post("/join")
async def join_community(body: JoinIn, user: dict = Depends(current_user)):
    code = body.invite_code.strip().upper()
    c = await communities.find_one({"invite_code": code, "status": "active"}, NO_ID)
    if not c:
        raise HTTPException(404, "Komunitas tidak ditemukan")
    existing = await memberships.find_one({"user_id": user["id"], "community_id": c["id"]})
    if not existing:
        await memberships.insert_one({"id": new_id(), "user_id": user["id"],
                                      "community_id": c["id"], "role": "member", "created_at": now()})
        roles = user.get("community_roles") or {}
        roles[c["id"]] = "member"
        await users.update_one({"id": user["id"]}, {"$set": {"community_roles": roles}})
    await users.update_one({"id": user["id"]}, {"$set": {"active_community_id": c["id"]}})
    return await _public(c, user["id"])


@router.post("/{community_id}/switch")
async def switch_community(community_id: str, user: dict = Depends(current_user)):
    mem = await memberships.find_one({"user_id": user["id"], "community_id": community_id})
    if not mem:
        raise HTTPException(403, "Anda bukan anggota komunitas ini")
    await users.update_one({"id": user["id"]}, {"$set": {"active_community_id": community_id}})
    c = await communities.find_one({"id": community_id}, NO_ID)
    return await _public(c, user["id"])


@router.get("/{community_id}")
async def get_community(community_id: str, user: dict = Depends(current_user)):
    c = await communities.find_one({"id": community_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Komunitas tidak ditemukan")
    return await _public(c, user["id"])
