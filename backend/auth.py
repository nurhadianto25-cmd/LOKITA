"""Authentication: phone + OTP (mock) + PIN, JWT sessions."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import secrets
from datetime import timedelta

from core import (
    users, otp_challenges, sessions, memberships, new_id, now, normalize_phone, sha,
    pin_hash, pin_ok, create_session, public_user, current_user, OTP_TTL_SEC, ENV,
    NO_ID, audit,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class PhoneIn(BaseModel):
    phone: str


class VerifyIn(BaseModel):
    phone: str
    otp: str = Field(pattern=r"^\d{6}$")


class PinSetIn(BaseModel):
    challenge_id: str
    pin: str = Field(pattern=r"^\d{6}$")
    name: str = ""
    device_name: str = "unknown"


class LoginIn(BaseModel):
    phone: str
    pin: str = Field(pattern=r"^\d{6}$")
    device_name: str = "unknown"


@router.post("/otp/request")
async def request_otp(body: PhoneIn):
    phone = normalize_phone(body.phone)
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = secrets.token_urlsafe(24)
    existing = await users.find_one({"phone": phone, "deleted_at": None}, NO_ID)
    await otp_challenges.insert_one({
        "id": new_id(),
        "challenge_id": challenge,
        "phone": phone,
        "otp_hash": sha(code),
        "expires_at": now() + timedelta(seconds=OTP_TTL_SEC),
        "used": False,
        "created_at": now(),
    })
    out = {"challenge_id": challenge, "expires_in": OTP_TTL_SEC, "is_existing": bool(existing)}
    if ENV == "development":
        out["dev_otp"] = code
    return out


@router.post("/otp/verify")
async def verify_otp(body: VerifyIn):
    phone = normalize_phone(body.phone)
    c = await otp_challenges.find_one({"phone": phone, "otp_hash": sha(body.otp),
                                       "used": False, "expires_at": {"$gt": now()}})
    if not c:
        raise HTTPException(400, "Kode OTP salah atau kadaluarsa")
    await otp_challenges.update_one({"id": c["id"]}, {"$set": {"used": True, "verified_at": now()}})
    return {"challenge_id": c["challenge_id"], "phone": phone}


@router.post("/pin/set")
async def set_pin(body: PinSetIn):
    c = await otp_challenges.find_one({"challenge_id": body.challenge_id, "used": True})
    if not c or not c.get("verified_at"):
        raise HTTPException(400, "Verifikasi OTP diperlukan")
    phone = c["phone"]
    u = await users.find_one({"phone": phone, "deleted_at": None}, NO_ID)
    if u:
        await users.update_one({"id": u["id"]}, {"$set": {"pin_hash": pin_hash(body.pin)}})
        u = await users.find_one({"id": u["id"]}, NO_ID)
    else:
        u = {
            "id": new_id(),
            "phone": phone,
            "pin_hash": pin_hash(body.pin),
            "name": body.name or "",
            "is_buyer": True,
            "is_seller": False,
            "platform_roles": [],
            "community_roles": {},
            "active_community_id": None,
            "address": None,
            "reliability": {"score": 100, "transactions": 0},
            "avatar_file_id": None,
            "deleted_at": None,
            "created_at": now(),
        }
        await users.insert_one(u)
        u.pop("_id", None)
        await audit(u["id"], "account.create", u["id"], {"phone": phone})
    return await create_session(u, body.device_name)


@router.post("/login")
async def login(body: LoginIn):
    phone = normalize_phone(body.phone)
    u = await users.find_one({"phone": phone, "deleted_at": None}, NO_ID)
    if not u or not u.get("pin_hash") or not pin_ok(body.pin, u["pin_hash"]):
        raise HTTPException(401, "Nomor telepon atau PIN salah")
    return await create_session(u, body.device_name)


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@router.post("/logout")
async def logout(user: dict = Depends(current_user)):
    await sessions.update_one({"sid": user["_sid"]}, {"$set": {"revoked_at": now()}})
    return {"ok": True}


@router.get("/sessions")
async def list_sessions(user: dict = Depends(current_user)):
    docs = await sessions.find({"user_id": user["id"], "revoked_at": None,
                                "expires_at": {"$gt": now()}}, NO_ID).to_list(100)
    out = []
    for d in docs:
        out.append({
            "id": d["id"],
            "device_name": d.get("device_name"),
            "last_seen_at": d.get("last_seen_at"),
            "current": d["sid"] == user["_sid"],
        })
    return out


@router.post("/sessions/{sid_id}/revoke")
async def revoke_session(sid_id: str, user: dict = Depends(current_user)):
    await sessions.update_one({"id": sid_id, "user_id": user["id"]},
                              {"$set": {"revoked_at": now()}})
    return {"ok": True}
