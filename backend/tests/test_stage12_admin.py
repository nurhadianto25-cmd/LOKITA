"""LOKITA Stage 12 tests — Super Admin Dashboard + Community Governance.
Covers: /api/admin/*, community dashboard/members/stores/staff/invite/settings/
verification/transfer/audit, create-community, and strict isolation/RBAC."""
import os
import time
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                      "https://github-lokita.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
PILOT_CODE = "LOKITA"

ADMIN_PHONE = "081200000000"
SELLER_PHONE = "081200000001"
PIN = "123456"


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _login(phone, pin=PIN):
    r = requests.post(f"{API}/auth/login", json={"phone": phone, "pin": pin}, timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    return j["access_token"], j["user"]


def _signup():
    phone = f"08139{int(time.time() * 1000) % 10_000_000:07d}"
    time.sleep(0.01)
    r = requests.post(f"{API}/auth/otp/request", json={"phone": phone}, timeout=15)
    assert r.status_code == 200
    otp = r.json()["dev_otp"]
    r = requests.post(f"{API}/auth/otp/verify", json={"phone": phone, "otp": otp}, timeout=15)
    ch = r.json()["challenge_id"]
    r = requests.post(f"{API}/auth/pin/set",
                      json={"challenge_id": ch, "pin": PIN, "name": "TEST S12"}, timeout=15)
    assert r.status_code == 200
    return phone, r.json()["access_token"], r.json()["user"]


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin():
    tok, u = _login(ADMIN_PHONE)
    return {"token": tok, "user": u}


@pytest.fixture(scope="module")
def seller():
    tok, u = _login(SELLER_PHONE)
    return {"token": tok, "user": u}


@pytest.fixture(scope="module")
def pilot_cid(admin):
    r = requests.get(f"{API}/communities/mine", headers=_h(admin["token"]), timeout=10)
    assert r.status_code == 200
    pilot = next(c for c in r.json() if c["invite_code"] == PILOT_CODE)
    return pilot["id"]


@pytest.fixture()
def member():
    """Fresh user joined to Pilot community (role=member)."""
    phone, tok, u = _signup()
    r = requests.post(f"{API}/communities/join", json={"invite_code": PILOT_CODE},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 200
    return {"phone": phone, "token": tok, "user": u, "community_id": r.json()["id"]}


@pytest.fixture()
def outsider_owner():
    """New user who creates their OWN community (community B) — used for isolation."""
    phone, tok, u = _signup()
    r = requests.post(f"{API}/communities/create",
                      json={"name": f"TEST B {int(time.time()*1000)%100000}",
                            "description": "iso", "location": "x"},
                      headers=_h(tok), timeout=10)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    return {"phone": phone, "token": tok, "user": u, "cid": cid}


# ---------- platform /api/admin/* ----------
class TestAdminPlatform:
    def test_metrics(self, admin):
        r = requests.get(f"{API}/admin/metrics", headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200
        j = r.json()
        for k in ("users", "sellers", "communities", "products", "orders", "gmv",
                  "completed_orders", "active_users", "open_reports"):
            assert k in j, f"missing {k}"
        assert isinstance(j["gmv"], (int, float))

    def test_communities(self, admin):
        r = requests.get(f"{API}/admin/communities", headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 1
        pilot = next(c for c in arr if c["name"].startswith("Komunitas Pilot"))
        for k in ("id", "name", "members", "stores", "orders", "verification_status"):
            assert k in pilot

    def test_audit(self, admin):
        r = requests.get(f"{API}/admin/audit", headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_blocked_for_member(self, member):
        for ep in ("metrics", "communities", "audit"):
            r = requests.get(f"{API}/admin/{ep}", headers=_h(member["token"]), timeout=10)
            assert r.status_code == 403, f"{ep} should be 403, got {r.status_code}"

    def test_admin_blocked_for_community_admin(self, outsider_owner):
        # even the OWNER of another community has no platform role → 403 on /api/admin/*
        for ep in ("metrics", "communities", "audit"):
            r = requests.get(f"{API}/admin/{ep}", headers=_h(outsider_owner["token"]), timeout=10)
            assert r.status_code == 403


# ---------- community governance ----------
class TestCommunityDashboard:
    def test_dashboard_as_owner(self, admin, pilot_cid):
        r = requests.get(f"{API}/communities/{pilot_cid}/dashboard",
                         headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200
        j = r.json()
        assert j["id"] == pilot_cid
        for k in ("name", "stats", "activity", "my_role", "verification_status"):
            assert k in j
        for k in ("total_members", "total_stores", "total_sellers", "total_products",
                  "total_orders", "active_members", "active_stores"):
            assert k in j["stats"]
        assert isinstance(j["activity"], list) and len(j["activity"]) == 7
        assert j["my_role"] in ("owner", "super_admin")

    def test_members_list(self, admin, pilot_cid):
        r = requests.get(f"{API}/communities/{pilot_cid}/members",
                         headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 2
        sample = arr[0]
        for k in ("user_id", "name", "role", "phone", "is_seller"):
            assert k in sample
        # masked phone starts with bullet
        assert sample["phone"].startswith("•") or sample["phone"] == ""

    def test_stores_list(self, admin, pilot_cid):
        r = requests.get(f"{API}/communities/{pilot_cid}/stores",
                         headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200
        arr = r.json()
        assert any(s["name"] == "Warung Bu Sri" for s in arr)
        s = next(s for s in arr if s["name"] == "Warung Bu Sri")
        assert s["products"] >= 1

    def test_invite(self, admin, pilot_cid):
        r = requests.get(f"{API}/communities/{pilot_cid}/invite",
                         headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200
        j = r.json()
        assert j["invite_code"] == PILOT_CODE
        assert j["qr_payload"] == f"LOKITA:JOIN:{PILOT_CODE}"

    def test_audit_log(self, admin, pilot_cid):
        r = requests.get(f"{API}/communities/{pilot_cid}/audit",
                         headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestCommunityIsolation:
    def test_member_cannot_view_dashboard(self, member, pilot_cid):
        # regular members (rank 0) → 403 on dashboard (requires rank 1 = moderator+)
        r = requests.get(f"{API}/communities/{pilot_cid}/dashboard",
                         headers=_h(member["token"]), timeout=10)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_member_cannot_view_members(self, member, pilot_cid):
        r = requests.get(f"{API}/communities/{pilot_cid}/members",
                         headers=_h(member["token"]), timeout=10)
        assert r.status_code == 403

    def test_outsider_owner_cannot_read_pilot(self, outsider_owner, pilot_cid):
        # owner of community B must NOT see community A (Pilot)
        for ep in ("dashboard", "members", "stores", "staff", "invite", "audit"):
            r = requests.get(f"{API}/communities/{pilot_cid}/{ep}",
                             headers=_h(outsider_owner["token"]), timeout=10)
            assert r.status_code == 403, f"{ep} leaked: {r.status_code}"

    def test_owner_can_read_own_community(self, outsider_owner):
        r = requests.get(f"{API}/communities/{outsider_owner['cid']}/dashboard",
                         headers=_h(outsider_owner["token"]), timeout=10)
        assert r.status_code == 200
        j = r.json()
        assert j["my_role"] == "owner"


class TestStaffManagement:
    def test_add_moderator_and_remove(self, admin, pilot_cid, member):
        uid = member["user"]["id"]
        # admin adds moderator
        r = requests.post(f"{API}/communities/{pilot_cid}/staff",
                          json={"user_id": uid, "role": "moderator"},
                          headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200, r.text
        # member should now be able to open dashboard (rank 1)
        r2 = requests.get(f"{API}/communities/{pilot_cid}/dashboard",
                          headers=_h(member["token"]), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["my_role"] == "moderator"
        # remove
        r = requests.delete(f"{API}/communities/{pilot_cid}/staff/{uid}",
                            headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200

    def test_non_owner_cannot_appoint_admin(self, outsider_owner, pilot_cid, member):
        # outsider isn't even a member of pilot → 403
        r = requests.post(f"{API}/communities/{pilot_cid}/staff",
                          json={"user_id": member["user"]["id"], "role": "admin"},
                          headers=_h(outsider_owner["token"]), timeout=10)
        assert r.status_code == 403

    def test_member_cannot_appoint(self, member, pilot_cid):
        r = requests.post(f"{API}/communities/{pilot_cid}/staff",
                          json={"user_id": member["user"]["id"], "role": "moderator"},
                          headers=_h(member["token"]), timeout=10)
        assert r.status_code == 403


class TestInviteRegenerate:
    def test_regenerate_on_new_community(self, outsider_owner):
        # Regenerate on a disposable community to avoid clobbering the Pilot code.
        cid = outsider_owner["cid"]
        before = requests.get(f"{API}/communities/{cid}/invite",
                              headers=_h(outsider_owner["token"]), timeout=10).json()
        r = requests.post(f"{API}/communities/{cid}/invite/regenerate",
                          headers=_h(outsider_owner["token"]), timeout=10)
        assert r.status_code == 200
        new_code = r.json()["invite_code"]
        assert new_code and new_code != before["invite_code"]
        assert r.json()["qr_payload"] == f"LOKITA:JOIN:{new_code}"


class TestSettingsAndVerification:
    def test_update_settings(self, admin, pilot_cid):
        r = requests.put(f"{API}/communities/{pilot_cid}/settings",
                         json={"description": "Komunitas Pilot resmi LOKITA (desc)"},
                         headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200
        assert "resmi LOKITA" in r.json()["description"]

    def test_verification_flow(self, outsider_owner):
        cid = outsider_owner["cid"]
        r = requests.get(f"{API}/communities/{cid}/verification",
                         headers=_h(outsider_owner["token"]), timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] in ("unverified", "review", "verified")
        r = requests.post(f"{API}/communities/{cid}/verification/request",
                          headers=_h(outsider_owner["token"]), timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "review"


class TestOwnershipTransfer:
    def test_transfer_requires_owner(self, member, pilot_cid, admin):
        # member attempts transfer → 403
        r = requests.post(f"{API}/communities/{pilot_cid}/transfer",
                          json={"user_id": member["user"]["id"]},
                          headers=_h(member["token"]), timeout=10)
        assert r.status_code == 403

    def test_transfer_target_must_be_member(self, outsider_owner):
        r = requests.post(f"{API}/communities/{outsider_owner['cid']}/transfer",
                          json={"user_id": "not-a-user-id"},
                          headers=_h(outsider_owner["token"]), timeout=10)
        assert r.status_code == 404


class TestCreateCommunity:
    def test_create_and_become_owner(self):
        _, tok, u = _signup()
        r = requests.post(f"{API}/communities/create",
                          json={"name": f"TEST New {int(time.time()*1000)%100000}",
                                "description": "t", "location": "Jakarta"},
                          headers=_h(tok), timeout=10)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["my_role"] == "owner"
        # dashboard accessible
        r2 = requests.get(f"{API}/communities/{j['id']}/dashboard",
                          headers=_h(tok), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["my_role"] == "owner"
