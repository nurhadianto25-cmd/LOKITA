"""LOKITA shared core: db, auth, rbac, storage, helpers. Backend is source of truth."""
import os
import re
import uuid
import hashlib
import secrets
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional, List

import bcrypt
import jwt
import requests
from fastapi import Header, HTTPException, Depends
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("lokita")

UTC = timezone.utc

# ----------------------------------------------------------------------------- config
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TTL_MIN = int(os.environ.get("ACCESS_TTL_MIN", "43200"))
SESSION_TTL_DAYS = int(os.environ.get("SESSION_TTL_DAYS", "30"))
OTP_TTL_SEC = int(os.environ.get("OTP_TTL_SEC", "300"))
ENV = os.environ.get("ENV", "development")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# collections
users = db.users
communities = db.communities
memberships = db.memberships
stores = db.stores
products = db.products
carts = db.carts
orders = db.orders
counters = db.counters
chats = db.chats
notifications = db.notifications
ratings = db.ratings
reports = db.reports
audit_logs = db.audit_logs
otp_challenges = db.otp_challenges
sessions = db.sessions
files = db.files

NO_ID = {"_id": 0}


def now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid.uuid4())


def iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat()


# ----------------------------------------------------------------------------- phone / pin
def normalize_phone(value: str) -> str:
    s = re.sub(r"[\s().-]", "", value or "")
    if s.startswith("08"):
        s = "+62" + s[1:]
    elif s.startswith("628"):
        s = "+" + s
    elif s.startswith("62") and not s.startswith("+"):
        s = "+" + s
    if not re.fullmatch(r"\+62\d{8,13}", s):
        raise HTTPException(400, "Nomor telepon Indonesia tidak valid")
    return s


def sha(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def pin_hash(pin: str) -> str:
    if not re.fullmatch(r"\d{6}", pin or ""):
        raise HTTPException(422, "PIN harus 6 digit")
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt(rounds=12)).decode()


def pin_ok(pin: str, stored: str) -> bool:
    return bool(re.fullmatch(r"\d{6}", pin or "")) and bcrypt.checkpw(pin.encode(), stored.encode())


# ----------------------------------------------------------------------------- jwt / session
def make_token(user_id: str, sid: str, platform_roles: list) -> str:
    return jwt.encode(
        {
            "sub": user_id,
            "sid": sid,
            "platform_roles": platform_roles,
            "iat": now(),
            "exp": now() + timedelta(minutes=ACCESS_TTL_MIN),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "Token tidak valid")


async def create_session(user: dict, device_name: str = "unknown") -> dict:
    sid = secrets.token_urlsafe(24)
    await sessions.insert_one({
        "id": new_id(),
        "sid": sid,
        "user_id": user["id"],
        "device_name": (device_name or "unknown")[:100],
        "created_at": now(),
        "last_seen_at": now(),
        "expires_at": now() + timedelta(days=SESSION_TTL_DAYS),
        "revoked_at": None,
    })
    token = make_token(user["id"], sid, user.get("platform_roles", []))
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "phone": u["phone"],
        "name": u.get("name") or "",
        "is_buyer": u.get("is_buyer", True),
        "is_seller": u.get("is_seller", False),
        "platform_roles": u.get("platform_roles", []),
        "community_roles": u.get("community_roles", {}),
        "active_community_id": u.get("active_community_id"),
        "address": u.get("address"),
        "reliability": u.get("reliability", {"score": 100, "transactions": 0}),
        "avatar_file_id": u.get("avatar_file_id"),
    }


async def _resolve_token(token: str) -> dict:
    payload = decode_token(token)
    sid, uid = payload.get("sid"), payload.get("sub")
    if not sid or not uid:
        raise HTTPException(401, "Klaim token tidak valid")
    s = await sessions.find_one({"sid": sid, "user_id": uid, "revoked_at": None,
                                 "expires_at": {"$gt": now()}}, NO_ID)
    if not s:
        raise HTTPException(401, "Sesi tidak valid, silakan masuk kembali")
    u = await users.find_one({"id": uid, "deleted_at": None}, NO_ID)
    if not u:
        raise HTTPException(401, "Akun tidak ditemukan")
    await sessions.update_one({"sid": sid}, {"$set": {"last_seen_at": now()}})
    u["_sid"] = sid
    return u


async def current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token diperlukan")
    return await _resolve_token(authorization[7:])


async def optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return await _resolve_token(authorization[7:])
    except HTTPException:
        return None


# ----------------------------------------------------------------------------- rbac
def require_seller(user: dict = Depends(current_user)) -> dict:
    if not user.get("is_seller"):
        raise HTTPException(403, "Hanya penjual yang dapat mengakses")
    return user


def require_platform(*allowed):
    async def dep(user: dict = Depends(current_user)) -> dict:
        if not set(user.get("platform_roles", [])).intersection(allowed):
            raise HTTPException(403, "Akses ditolak")
        return user
    return dep


async def community_role(user: dict, community_id: str) -> Optional[str]:
    return (user.get("community_roles") or {}).get(community_id)


async def assert_member(user: dict, community_id: str):
    if not await memberships.find_one({"user_id": user["id"], "community_id": community_id}):
        raise HTTPException(403, "Anda bukan anggota komunitas ini")


# ----------------------------------------------------------------------------- order number
async def next_order_no() -> int:
    doc = await counters.find_one_and_update(
        {"id": "order_no"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    if not doc:
        doc = await counters.find_one({"id": "order_no"})
    return 1000 + int(doc["seq"])


# ----------------------------------------------------------------------------- notifications / audit
async def notify(user_id: str, ntype: str, title: str, body: str, order_id: Optional[str] = None):
    await notifications.insert_one({
        "id": new_id(),
        "user_id": user_id,
        "type": ntype,
        "title": title,
        "body": body,
        "order_id": order_id,
        "read": False,
        "created_at": now(),
    })


async def audit(actor_id: Optional[str], action: str, target: str, meta: dict = None):
    await audit_logs.insert_one({
        "id": new_id(),
        "actor_id": actor_id,
        "action": action,
        "target": target,
        "meta": meta or {},
        "created_at": now(),
    })


# ----------------------------------------------------------------------------- object storage
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "lokita"
_storage_key = None


def _init_storage_sync():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _put_sync(path: str, data: bytes, content_type: str) -> dict:
    key = _init_storage_sync()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 503:
        globals()["_storage_key"] = None
        key = _init_storage_sync()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def _get_sync(path: str):
    key = _init_storage_sync()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


async def init_storage():
    try:
        await run_in_threadpool(_init_storage_sync)
    except Exception as e:  # noqa
        logger.warning("storage init failed: %s", e)


async def store_upload(data: bytes, content_type: str, owner_id: str, kind: str,
                       order_id: Optional[str] = None, ext: str = "jpg") -> dict:
    """Upload bytes to object storage, record a file doc, return the file record."""
    fid = new_id()
    path = f"{APP_NAME}/uploads/{owner_id}/{fid}.{ext}"
    try:
        await run_in_threadpool(_put_sync, path, data, content_type)
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        if code == 402:
            raise HTTPException(402, "Kuota penyimpanan habis")
        raise HTTPException(502, "Gagal mengunggah berkas")
    rec = {
        "id": fid,
        "storage_path": path,
        "content_type": content_type,
        "owner_id": owner_id,
        "kind": kind,           # product | store | qris | proof | chat | avatar
        "order_id": order_id,
        "created_at": now(),
    }
    await files.insert_one(rec)
    return {"id": fid, "kind": kind}


async def store_fetch(path: str):
    return await run_in_threadpool(_get_sync, path)
