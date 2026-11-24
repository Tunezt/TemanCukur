"""Pay-before-book checks. Run from backend/: python -m pytest tests -q"""
import hashlib
import os
import sys
import threading
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.update(
    SUPABASE_URL="https://example.supabase.co",
    SUPABASE_SERVICE_KEY="x",
    ADMIN_API_KEY="test-signing-secret",
    ADMIN_PASSWORD="test-password",
    FONNTE_TOKEN="",  # never send a real WhatsApp from tests
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.booking_reminders as reminders  # noqa: E402
import app.booking_whatsapp as wa  # noqa: E402
import app.payments as payments  # noqa: E402
import app.routes.admin as admin_routes  # noqa: E402
import app.routes.bookings as booking_routes  # noqa: E402
import app.routes.slots as slot_routes  # noqa: E402
import app.services as services  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from tests.fake_supabase import FakeSupabase  # noqa: E402

BARBER = "a1111111-1111-4111-8111-111111111111"
DAY = (date.today() + timedelta(days=7)).isoformat()
SERVER_KEY = "SB-Mid-server-TESTKEY"


@pytest.fixture
def env(monkeypatch):
    db = FakeSupabase()
    db.tables["barbers"].append(
        {"id": BARBER, "name": "Andi", "specialty": "", "photo_url": None, "is_active": True, "sort_order": 1}
    )
    for mod in (booking_routes, slot_routes, admin_routes):
        monkeypatch.setattr(mod, "get_supabase", lambda: db)
    sent = []
    monkeypatch.setattr(wa, "send_booking_confirmation_wa", lambda **kw: sent.append(kw))
    monkeypatch.setattr(reminders, "schedule_booking_reminder", lambda *a, **k: None)
    s = get_settings()
    monkeypatch.setattr(s, "payment_mode", "demo")
    monkeypatch.setattr(s, "midtrans_server_key", SERVER_KEY)
    return db, sent, s


client = TestClient(app)


def book(time="10:00", name="Test"):
    return client.post(
        "/api/bookings",
        json={"customer_name": name, "whatsapp": "+628115819400", "service": "Haircut", "date": DAY, "time": time, "barber_id": BARBER},
    )


def slots():
    return client.get("/api/slots", params={"date": DAY, "barber_id": BARBER}).json()["slots"]


def sign(order_id, status_code, gross, key=SERVER_KEY):
    return hashlib.sha512(f"{order_id}{status_code}{gross}{key}".encode()).hexdigest()


# ---------- signature ----------


def test_signature_valid_and_invalid():
    body = {"order_id": "NS-1", "status_code": "200", "gross_amount": "100000.00"}
    body["signature_key"] = sign("NS-1", "200", "100000.00")
    assert payments.midtrans_signature_ok(body, SERVER_KEY)
    assert not payments.midtrans_signature_ok({**body, "gross_amount": "1.00"}, SERVER_KEY)  # tampered amount
    assert not payments.midtrans_signature_ok(body, "other-key")
    assert not payments.midtrans_signature_ok({**body, "signature_key": ""}, SERVER_KEY)


def test_notification_with_bad_signature_is_refused(env, monkeypatch):
    db, sent, s = env
    monkeypatch.setattr(s, "payment_mode", "midtrans")
    called = []
    monkeypatch.setattr(booking_routes, "midtrans_status", lambda oid: called.append(oid) or {})
    r = client.post(
        "/api/payments/midtrans/notification",
        json={"order_id": "NS-x", "status_code": "200", "gross_amount": "100000.00", "transaction_status": "settlement", "signature_key": "f" * 128},
    )
    assert r.status_code == 403
    assert called == [] and sent == []


# ---------- hold, pay, expire ----------


def test_demo_flow_hold_then_pay(env):
    db, sent, _ = env
    r = book()
    assert r.status_code == 200, r.text
    pay = r.json()["payment"]
    assert pay["status"] == "awaiting_payment" and pay["amount"] == 100_000
    assert 0 < pay["seconds_left"] <= 15 * 60
    assert pay["order_id"].startswith("DEMO-") and pay["qr_url"]
    assert "10:00" not in slots()  # held
    assert sent == []  # no WhatsApp before payment

    r = client.post(f"/api/bookings/{pay['booking_id']}/demo-pay")
    assert r.status_code == 200 and r.json()["status"] == "confirmed" and r.json()["payment_status"] == "paid"
    assert len(sent) == 1 and sent[0]["paid_amount"] == 100_000 and sent[0]["demo"] is True
    # second click: still confirmed, no second WhatsApp
    assert client.post(f"/api/bookings/{pay['booking_id']}/demo-pay").status_code == 200
    assert len(sent) == 1


def test_expiry_frees_the_slot(env):
    db, sent, _ = env
    first = book(name="Slow payer").json()["payment"]
    assert book(name="Second").status_code == 409  # held, so taken
    # 15 minutes pass
    db.tables["bookings"][0]["payment_expires_at"] = payments.iso_z(payments.utc_now() - timedelta(seconds=1))
    assert "10:00" in slots()
    view = client.get(f"/api/bookings/{first['booking_id']}/payment").json()
    assert view["status"] == "expired" and view["payment_status"] == "expired" and view["seconds_left"] == 0
    assert client.post(f"/api/bookings/{first['booking_id']}/demo-pay").status_code == 409  # too late
    assert book(name="Second").status_code == 200  # slot is free again
    assert sent == []


def test_customer_can_release_a_hold(env):
    first = book().json()["payment"]
    assert client.post(f"/api/bookings/{first['booking_id']}/cancel").status_code == 200
    assert "10:00" in slots()


def test_double_booking_race(env, monkeypatch):
    """Ten customers pass the availability check at the same moment; only one may get the slot."""
    n = 10
    barrier = threading.Barrier(n)
    real = services.fetch_available_slots

    def slow_check(*a, **k):
        out = real(*a, **k)
        barrier.wait(timeout=5)  # everyone saw the slot as free before anyone inserts
        return out

    monkeypatch.setattr(booking_routes, "fetch_available_slots", slow_check)
    codes = []
    threads = [threading.Thread(target=lambda i=i: codes.append(book(name=f"C{i}").status_code)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(codes) == [200] + [409] * (n - 1), codes
    db = env[0]
    assert len([b for b in db.tables["bookings"] if b["status"] in ("awaiting_payment", "confirmed")]) == 1


# ---------- Midtrans notification ----------


def _midtrans_booking(env, monkeypatch):
    db, sent, s = env
    monkeypatch.setattr(s, "payment_mode", "midtrans")
    monkeypatch.setattr(booking_routes, "midtrans_charge_qris", lambda oid, amt: f"https://api.sandbox.midtrans.com/v2/qris/{oid}/qr-code")
    pay = book().json()["payment"]
    assert pay["order_id"].startswith("NS-")
    return pay


def test_notification_is_idempotent(env, monkeypatch):
    db, sent, s = env
    pay = _midtrans_booking(env, monkeypatch)
    oid = pay["order_id"]
    status = {"order_id": oid, "status_code": "200", "gross_amount": "100000.00", "transaction_status": "settlement"}
    asked = []
    monkeypatch.setattr(booking_routes, "midtrans_status", lambda o: asked.append(o) or dict(status))
    note = {**status, "signature_key": sign(oid, "200", "100000.00")}
    for _ in range(3):  # Midtrans may deliver the same notification more than once
        r = client.post("/api/payments/midtrans/notification", json=note)
        assert r.status_code == 200, r.text
    assert asked == [oid] * 3  # every notification was checked against the status API
    row = db.tables["bookings"][0]
    assert row["status"] == "confirmed" and row["payment_status"] == "paid"
    assert len(sent) == 1  # one WhatsApp, not three


def test_notification_trusts_status_api_not_body(env, monkeypatch):
    """A correctly signed 'settlement' is not enough if Midtrans's status API says pending."""
    db, sent, s = env
    pay = _midtrans_booking(env, monkeypatch)
    oid = pay["order_id"]
    monkeypatch.setattr(booking_routes, "midtrans_status", lambda o: {"order_id": oid, "gross_amount": "100000.00", "transaction_status": "pending"})
    note = {"order_id": oid, "status_code": "200", "gross_amount": "100000.00", "transaction_status": "settlement"}
    note["signature_key"] = sign(oid, "200", "100000.00")
    assert client.post("/api/payments/midtrans/notification", json=note).status_code == 200
    assert db.tables["bookings"][0]["status"] == "awaiting_payment" and sent == []


def test_wrong_amount_is_not_confirmed(env, monkeypatch):
    db, sent, s = env
    pay = _midtrans_booking(env, monkeypatch)
    oid = pay["order_id"]
    monkeypatch.setattr(booking_routes, "midtrans_status", lambda o: {"order_id": oid, "gross_amount": "1000.00", "transaction_status": "settlement"})
    note = {"order_id": oid, "status_code": "200", "gross_amount": "1000.00", "signature_key": sign(oid, "200", "1000.00")}
    client.post("/api/payments/midtrans/notification", json=note)
    assert db.tables["bookings"][0]["status"] == "awaiting_payment" and sent == []


def test_late_payment_after_slot_retaken_is_flagged_for_refund(env, monkeypatch):
    db, sent, s = env
    pay = _midtrans_booking(env, monkeypatch)
    db.tables["bookings"][0]["payment_expires_at"] = payments.iso_z(payments.utc_now() - timedelta(seconds=1))
    assert book(name="Took the slot").status_code == 200
    oid = pay["order_id"]
    status = {"order_id": oid, "gross_amount": "100000.00", "transaction_status": "settlement"}
    monkeypatch.setattr(booking_routes, "midtrans_status", lambda o: dict(status))
    note = {"order_id": oid, "status_code": "200", "gross_amount": "100000.00", "signature_key": sign(oid, "200", "100000.00")}
    assert client.post("/api/payments/midtrans/notification", json=note).status_code == 200
    late = next(b for b in db.tables["bookings"] if b["payment_order_id"] == oid)
    assert late["status"] == "expired" and late["payment_status"] == "paid_late"
    assert sent == []


# ---------- demo endpoint is demo-only ----------


@pytest.mark.parametrize("mode", ["off", "midtrans"])
def test_demo_pay_refused_outside_demo(env, monkeypatch, mode):
    db, sent, s = env
    pay = book().json()["payment"]  # created in demo mode
    monkeypatch.setattr(s, "payment_mode", mode)
    r = client.post(f"/api/bookings/{pay['booking_id']}/demo-pay")
    assert r.status_code == 404
    assert db.tables["bookings"][0]["status"] == "awaiting_payment" and sent == []


def test_notification_endpoint_off_outside_midtrans(env):
    assert client.post("/api/payments/midtrans/notification", json={}).status_code == 404


def test_off_mode_books_instantly(env, monkeypatch):
    db, sent, s = env
    monkeypatch.setattr(s, "payment_mode", "off")
    r = book()
    assert r.status_code == 200 and r.json()["payment"] is None
    assert r.json()["booking"]["status"] == "confirmed" and len(sent) == 1 and sent[0]["paid_amount"] is None


def test_deposit_amount(monkeypatch):
    monkeypatch.setattr(wa, "DEPOSIT_IDR", 30_000)
    assert wa.payment_amount_for(100_000) == 30_000
    monkeypatch.setattr(wa, "DEPOSIT_IDR", None)
    assert wa.payment_amount_for(100_000) == 100_000
