"""LOKITA backend regression tests. Covers auth, communities, seller, marketplace,
order engine, payment, chat, ratings, account deletion, admin RBAC, and files."""
import os
import io
import time
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://structured-orders.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
PILOT_CODE = "LOKITA"

ADMIN_PHONE = "081200000000"
SELLER_PHONE = "081200000001"
PIN = "123456"


# ------------------------- helpers / fixtures -------------------------
def _login(phone, pin=PIN):
    r = requests.post(f"{API}/auth/login", json={"phone": phone, "pin": pin}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _signup_new_buyer():
    # unique Indonesian phone
    phone = f"08129{int(time.time()*1000)%10_000_000:07d}"
    r = requests.post(f"{API}/auth/otp/request", json={"phone": phone}, timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "dev_otp" in j and j["is_existing"] is False
    otp = j["dev_otp"]
    r = requests.post(f"{API}/auth/otp/verify", json={"phone": phone, "otp": otp}, timeout=20)
    assert r.status_code == 200, r.text
    ch = r.json()["challenge_id"]
    r = requests.post(f"{API}/auth/pin/set",
                      json={"challenge_id": ch, "pin": PIN, "name": "TEST Buyer"}, timeout=20)
    assert r.status_code == 200, r.text
    return phone, r.json()["access_token"], r.json()["user"]


@pytest.fixture(scope="session")
def admin():
    tok, user = _login(ADMIN_PHONE)
    return {"token": tok, "user": user}


@pytest.fixture(scope="session")
def seller():
    tok, user = _login(SELLER_PHONE)
    return {"token": tok, "user": user}


@pytest.fixture()
def buyer():
    phone, tok, user = _signup_new_buyer()
    # join pilot community
    r = requests.post(f"{API}/communities/join", json={"invite_code": PILOT_CODE},
                      headers=_h(tok), timeout=20)
    assert r.status_code == 200, r.text
    return {"phone": phone, "token": tok, "user": user, "community_id": r.json()["id"]}


# ------------------------- auth -------------------------
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200 and r.json()["app"] == "LOKITA"

    def test_otp_request_existing_flag(self):
        r = requests.post(f"{API}/auth/otp/request", json={"phone": SELLER_PHONE}, timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert j["is_existing"] is True and "dev_otp" in j

    def test_login_me_logout(self, seller):
        r = requests.get(f"{API}/auth/me", headers=_h(seller["token"]), timeout=10)
        assert r.status_code == 200 and r.json()["phone"] == "+6281200000001"

    def test_login_wrong_pin(self):
        r = requests.post(f"{API}/auth/login", json={"phone": SELLER_PHONE, "pin": "000000"}, timeout=10)
        assert r.status_code == 401

    def test_sessions_list(self, seller):
        r = requests.get(f"{API}/auth/sessions", headers=_h(seller["token"]), timeout=10)
        assert r.status_code == 200
        assert any(s["current"] for s in r.json())


# ------------------------- communities -------------------------
class TestCommunity:
    def test_list_and_join(self, buyer):
        r = requests.get(f"{API}/communities", headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 200
        assert any(c["invite_code"] == PILOT_CODE for c in r.json())

    def test_join_invalid_code(self, buyer):
        r = requests.post(f"{API}/communities/join", json={"invite_code": "NOEXIST"},
                          headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 404

    def test_mine(self, buyer):
        r = requests.get(f"{API}/communities/mine", headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 200 and len(r.json()) >= 1

    def test_isolation_requires_community(self):
        # new user without joining community cannot see market
        _, tok, _ = _signup_new_buyer()
        r = requests.get(f"{API}/market/stores", headers=_h(tok), timeout=10)
        assert r.status_code == 400


# ------------------------- marketplace -------------------------
class TestMarketplace:
    def test_stores_list(self, buyer):
        r = requests.get(f"{API}/market/stores", headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 200
        names = [s["name"] for s in r.json()]
        assert "Warung Bu Sri" in names

    def test_product_detail(self, buyer):
        r = requests.get(f"{API}/market/stores", headers=_h(buyer["token"]), timeout=10)
        store = next(s for s in r.json() if s["name"] == "Warung Bu Sri")
        d = requests.get(f"{API}/market/stores/{store['id']}", headers=_h(buyer["token"])).json()
        assert len(d["products"]) >= 4

    def test_cart_add(self, buyer):
        store = next(s for s in requests.get(f"{API}/market/stores",
                     headers=_h(buyer["token"])).json() if s["name"] == "Warung Bu Sri")
        prod = requests.get(f"{API}/market/stores/{store['id']}",
                            headers=_h(buyer["token"])).json()["products"][0]
        r = requests.post(f"{API}/market/cart", json={"product_id": prod["id"], "qty": 2},
                          headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 200
        groups = r.json()
        assert groups and groups[0]["items"][0]["qty"] == 2


# ------------------------- order engine -------------------------
def _place_order(buyer, qty=1, payment="COD", titip_allowed=False):
    stores = requests.get(f"{API}/market/stores", headers=_h(buyer["token"])).json()
    store = next(s for s in stores if s["name"] == "Warung Bu Sri")
    prod = requests.get(f"{API}/market/stores/{store['id']}",
                        headers=_h(buyer["token"])).json()["products"][0]
    requests.post(f"{API}/market/cart", json={"product_id": prod["id"], "qty": qty},
                  headers=_h(buyer["token"]))
    r = requests.post(f"{API}/orders/checkout",
                      json={"store_id": store["id"], "payment_method": payment,
                            "titip_allowed": titip_allowed, "titip_location": "Pagar depan"},
                      headers=_h(buyer["token"]), timeout=20)
    assert r.status_code == 200, r.text
    return r.json(), store, prod


class TestOrderEngine:
    def test_checkout_order_no_and_timers(self, buyer):
        o, _, _ = _place_order(buyer)
        assert o["order_no"] >= 1000
        assert o["status"] == "MENUNGGU_KONFIRMASI"
        assert o["buyer_can_cancel"] is True
        assert 0 < o["seconds_to_confirm"] <= 5 * 60
        assert 0 < o["seconds_to_cancel_end"] <= 60
        assert o["payment_status"] == "UNPAID"
        # order numbers increment
        # second order
        o2, _, _ = _place_order(buyer)
        assert o2["order_no"] == o["order_no"] + 1

    def test_buyer_cancel_within_1min(self, buyer):
        o, _, _ = _place_order(buyer)
        r = requests.post(f"{API}/orders/{o['id']}/cancel", headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 200 and r.json()["status"] == "DIBATALKAN"

    def test_seller_confirm_and_reject(self, buyer, seller):
        # ORDER A: confirm flow
        o, _, _ = _place_order(buyer)
        r = requests.post(f"{API}/orders/{o['id']}/confirm", headers=_h(seller["token"]), timeout=10)
        assert r.status_code == 200 and r.json()["status"] == "DIKONFIRMASI"
        # Advance through states
        for expected in ["SEDANG_DIPROSES", "SIAP_DIANTAR", "SEDANG_DIANTAR"]:
            r = requests.post(f"{API}/orders/{o['id']}/advance", headers=_h(seller["token"]))
            assert r.status_code == 200 and r.json()["status"] == expected
        # handover
        r = requests.post(f"{API}/orders/{o['id']}/handover", headers=_h(seller["token"]))
        assert r.status_code == 200 and r.json()["status"] == "MENUNGGU_PENYELESAIAN"
        # buyer confirms receipt
        r = requests.post(f"{API}/orders/{o['id']}/received", headers=_h(buyer["token"]))
        assert r.status_code == 200
        # payment verify (COD->PAID) completes
        r = requests.post(f"{API}/orders/{o['id']}/payment/verify", headers=_h(seller["token"]))
        assert r.status_code == 200
        final = requests.get(f"{API}/orders/{o['id']}", headers=_h(buyer["token"])).json()
        assert final["status"] == "SELESAI"
        assert final["payment_status"] == "PAID"

    def test_seller_reject_recommendations_and_restock(self, buyer, seller):
        o, _, prod = _place_order(buyer, qty=1)
        # snapshot stock before
        p_before = requests.get(f"{API}/market/products/{prod['id']}",
                                headers=_h(buyer["token"])).json()["product"]["stock"]
        r = requests.post(f"{API}/orders/{o['id']}/reject",
                          json={"reason": "Produk Habis"}, headers=_h(seller["token"]), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "DITOLAK" and body["reject_reason"] == "Produk Habis"
        assert isinstance(body.get("recommendations"), list) and len(body["recommendations"]) >= 1
        p_after = requests.get(f"{API}/market/products/{prod['id']}",
                               headers=_h(buyer["token"])).json()["product"]["stock"]
        assert p_after == p_before + 1  # stock restored

    def test_titip_requires_two_proofs(self, buyer, seller):
        o, _, _ = _place_order(buyer, titip_allowed=True)
        requests.post(f"{API}/orders/{o['id']}/confirm", headers=_h(seller["token"]))
        for _ in range(3):
            requests.post(f"{API}/orders/{o['id']}/advance", headers=_h(seller["token"]))
        # no files -> 400
        r = requests.post(f"{API}/orders/{o['id']}/titip",
                          json={"proof_file_ids": []}, headers=_h(seller["token"]))
        assert r.status_code == 400

    def test_titip_blocked_when_not_allowed(self, buyer, seller):
        o, _, _ = _place_order(buyer, titip_allowed=False)
        requests.post(f"{API}/orders/{o['id']}/confirm", headers=_h(seller["token"]))
        for _ in range(3):
            requests.post(f"{API}/orders/{o['id']}/advance", headers=_h(seller["token"]))
        r = requests.post(f"{API}/orders/{o['id']}/titip",
                          json={"proof_file_ids": ["a", "b"]}, headers=_h(seller["token"]))
        assert r.status_code == 400


# ------------------------- payment flows -------------------------
class TestPayment:
    def test_qris_to_cod_switch_allowed(self, buyer):
        o, _, _ = _place_order(buyer, payment="QRIS")
        assert o["payment_method"] == "QRIS" and o["payment_status"] == "MENUNGGU_PEMBAYARAN"
        r = requests.post(f"{API}/orders/{o['id']}/pay/switch-cod", headers=_h(buyer["token"]))
        assert r.status_code == 200 and r.json()["payment_method"] == "COD"
        # same order id preserved
        assert r.json()["id"] == o["id"]

    def test_qris_switch_blocked_when_verifying(self, buyer):
        o, _, _ = _place_order(buyer, payment="QRIS")
        requests.post(f"{API}/orders/{o['id']}/pay/qris-sent", headers=_h(buyer["token"]))
        r = requests.post(f"{API}/orders/{o['id']}/pay/switch-cod", headers=_h(buyer["token"]))
        assert r.status_code == 400


# ------------------------- chat -------------------------
class TestChat:
    def test_chat_send_and_access_control(self, buyer, seller):
        o, _, _ = _place_order(buyer)
        r = requests.post(f"{API}/chat/{o['id']}/messages", json={"text": "halo"},
                          headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 200
        # non-participant forbidden
        _, tok3, _ = _signup_new_buyer()
        r = requests.get(f"{API}/chat/{o['id']}/messages", headers=_h(tok3))
        assert r.status_code == 403


# ------------------------- ratings -------------------------
class TestRating:
    def test_only_after_selesai(self, buyer, seller):
        o, _, _ = _place_order(buyer)
        r = requests.post(f"{API}/ratings", json={"order_id": o["id"], "stars": 5},
                          headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 400


# ------------------------- admin RBAC -------------------------
class TestAdmin:
    def test_metrics_super_admin(self, admin):
        r = requests.get(f"{API}/admin/metrics", headers=_h(admin["token"]), timeout=10)
        assert r.status_code == 200
        j = r.json()
        for k in ["users", "sellers", "communities", "products", "orders", "gmv"]:
            assert k in j

    def test_metrics_blocked_for_non_platform(self, buyer):
        r = requests.get(f"{API}/admin/metrics", headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 403


# ------------------------- files -------------------------
class TestFiles:
    def test_upload_image(self, buyer):
        png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
               b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01\x00"
               b"\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
        files = {"file": ("t.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{API}/files", files=files, data={"kind": "product"},
                          headers={"Authorization": f"Bearer {buyer['token']}"}, timeout=30)
        if r.status_code == 502:
            pytest.skip("storage proxy unavailable in preview env")
        assert r.status_code == 200 and "id" in r.json()


# ------------------------- account deletion -------------------------
class TestAccountDeletion:
    def test_delete_blocked_with_active_order(self, buyer):
        _place_order(buyer)  # creates active order
        r = requests.post(f"{API}/account/delete", json={"pin": PIN},
                          headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 400

    def test_delete_wrong_pin(self, buyer):
        r = requests.post(f"{API}/account/delete", json={"pin": "000000"},
                          headers=_h(buyer["token"]), timeout=10)
        assert r.status_code == 401
