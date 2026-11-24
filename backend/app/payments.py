"""Pay before book: a booking holds its slot while the customer pays by QRIS.

Flow: create booking (status awaiting_payment, payment_status waiting, held HOLD_MINUTES)
-> paid: status confirmed, payment_status paid, WhatsApp to customer and shop
-> not paid in time: status expired, payment_status expired, slot free again.

The database's unique index on (barber_id, booking_date, booking_time) for active statuses
(awaiting_payment included) is what stops two customers getting the same slot.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

HOLD_MINUTES = 15
DEMO_QR_URL = "/images/demo-qris.png"
PAID_STATUSES = ("settlement",)  # QRIS; "capture" (cards) is handled with fraud_status below
FAILED_STATUSES = ("expire", "cancel", "deny", "failure")


class PaymentProviderError(Exception):
    """Midtrans could not be reached or refused the request."""


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_z(dt: datetime) -> str:
    # 'Z' instead of '+00:00': a '+' in a PostgREST query string would be read as a space.
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def is_unique_violation(e: Exception) -> bool:
    msg = str(e).lower()
    return "duplicate" in msg or "unique" in msg or "23505" in msg


# ---------- Midtrans (Core API) ----------
# Docs read 2026-11-24: docs.midtrans.com/reference/qris, /docs/https-notification-webhooks,
# /reference/get-transaction-status, /docs/coreapi-advanced-features, /docs/api-authorization-headers.


def midtrans_base_url() -> str:
    if get_settings().midtrans_is_production:
        return "https://api.midtrans.com"
    return "https://api.sandbox.midtrans.com"


def _midtrans_headers() -> dict[str, str]:
    key = get_settings().midtrans_server_key or ""
    token = base64.b64encode(f"{key}:".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def midtrans_signature_ok(body: dict, server_key: str) -> bool:
    """SHA512(order_id + status_code + gross_amount + server_key), gross_amount exactly as sent."""
    raw = f"{body.get('order_id', '')}{body.get('status_code', '')}{body.get('gross_amount', '')}{server_key}"
    expected = hashlib.sha512(raw.encode()).hexdigest()
    return hmac.compare_digest(expected, str(body.get("signature_key") or ""))


def midtrans_charge_qris(order_id: str, amount: int, minutes: int = HOLD_MINUTES) -> str:
    """Create a QRIS transaction; returns the QR image URL Midtrans hosts."""
    payload = {
        "payment_type": "qris",
        "transaction_details": {"order_id": order_id, "gross_amount": amount},
        "qris": {"acquirer": "gopay"},
        "custom_expiry": {"expiry_duration": minutes, "unit": "minute"},
    }
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(f"{midtrans_base_url()}/v2/charge", headers=_midtrans_headers(), json=payload)
        data = resp.json()
    except Exception as e:
        raise PaymentProviderError(f"charge request failed: {e}") from e
    if resp.status_code >= 400 or str(data.get("status_code")) not in ("200", "201"):
        raise PaymentProviderError(
            f"charge refused: HTTP {resp.status_code} {data.get('status_code')} {data.get('status_message')}"
        )
    for action in data.get("actions") or []:
        if action.get("name") == "generate-qr-code":
            return action["url"]
    raise PaymentProviderError("charge response has no generate-qr-code action")


def midtrans_status(order_id: str) -> dict:
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(f"{midtrans_base_url()}/v2/{order_id}/status", headers=_midtrans_headers())
        return resp.json()
    except Exception as e:
        raise PaymentProviderError(f"status request failed: {e}") from e


def midtrans_cancel(order_id: str) -> None:
    """Best effort: stop a pending QR from being paid after the customer gave up the slot."""
    try:
        with httpx.Client(timeout=15.0) as client:
            client.post(f"{midtrans_base_url()}/v2/{order_id}/cancel", headers=_midtrans_headers())
    except Exception:
        logger.exception("Midtrans cancel failed for %s", order_id)


# ---------- Booking state changes ----------


def expire_stale_holds(sb) -> int:
    """Free every slot whose payment window has passed."""
    res = (
        sb.table("bookings")
        .update({"status": "expired", "payment_status": "expired"})
        .eq("status", "awaiting_payment")
        .lt("payment_expires_at", iso_z(utc_now()))
        .execute()
    )
    n = len(res.data or [])
    if n:
        logger.info("Expired %d unpaid booking hold(s)", n)
    return n


def expire_stale_holds_job() -> None:
    from app.db import get_supabase

    if get_settings().payment_mode == "off":
        return  # no holds exist; also safe before migration 004 is applied
    try:
        expire_stale_holds(get_supabase())
    except Exception:
        logger.exception("Expire-holds job failed")


def _barber_name(sb, barber_id: str | None) -> str:
    if not barber_id:
        return ""
    try:
        rows = sb.table("barbers").select("name").eq("id", str(barber_id)).limit(1).execute().data or []
        return (rows[0].get("name") or "") if rows else ""
    except Exception:
        logger.exception("Could not load barber %s", barber_id)
        return ""


def notify_booking_confirmed(sb, row: dict) -> None:
    """WhatsApp to customer and shop, plus the 2-hour reminder. Never raises."""
    from app.booking_reminders import schedule_booking_reminder
    from app.booking_whatsapp import send_booking_confirmation_wa

    try:
        send_booking_confirmation_wa(
            customer_name=row["customer_name"],
            customer_whatsapp_raw=row["whatsapp"],
            service=row["service"],
            booking_date=str(row["booking_date"]),
            booking_time=row["booking_time"],
            barber_name=_barber_name(sb, row.get("barber_id")),
            service_price=row.get("service_price"),
            paid_amount=row.get("payment_amount") if row.get("payment_status") == "paid" else None,
            demo=row.get("payment_mode") == "demo",
        )
        from uuid import UUID

        schedule_booking_reminder(UUID(str(row["id"])), str(row["booking_date"]), row["booking_time"])
    except Exception:
        logger.exception("WhatsApp / reminder failed for booking %s", row.get("id"))


def confirm_paid_booking(sb, booking_id: str, *, allow_late: bool) -> dict | None:
    """
    Mark a booking paid and confirmed. Returns the row only on the call that changed it,
    so a repeated notification or a double click never sends WhatsApp twice.
    allow_late (real money, Midtrans): also revive a hold that expired or was given up,
    if the slot is still free; otherwise flag it paid_late so the shop refunds by hand.
    """
    now = iso_z(utc_now())
    q = sb.table("bookings").update({"status": "confirmed", "payment_status": "paid", "paid_at": now}).eq(
        "id", booking_id
    )
    if allow_late:
        # Only unpaid rows: a paid booking the shop later cancelled (and refunded) must stay cancelled.
        q = q.in_("status", ["awaiting_payment", "expired", "cancelled"]).in_("payment_status", ["waiting", "expired"])
    else:
        q = q.eq("status", "awaiting_payment").gt("payment_expires_at", now)
    try:
        rows = q.execute().data or []
    except Exception as e:
        if not (allow_late and is_unique_violation(e)):
            raise
        rows = []
        # Paid after the hold ended and someone else took the slot: money in, no booking.
        sb.table("bookings").update({"payment_status": "paid_late", "paid_at": now}).eq("id", booking_id).execute()
        logger.error("Booking %s paid after its slot was taken: refund by hand", booking_id)
        return None
    if rows:
        notify_booking_confirmed(sb, rows[0])
        return rows[0]
    return None


def apply_midtrans_status(sb, status: dict) -> str:
    """Act on a transaction status that came from Midtrans's own status API. Returns what happened."""
    order_id = str(status.get("order_id") or "")
    rows = (
        sb.table("bookings").select("*").eq("payment_order_id", order_id).limit(1).execute().data or []
    )
    if not rows:
        logger.warning("Midtrans status for unknown order %s", order_id)
        return "unknown_order"
    booking = rows[0]
    ts = status.get("transaction_status")
    paid = ts in PAID_STATUSES or (ts == "capture" and status.get("fraud_status") in (None, "accept"))
    if paid:
        try:
            gross = int(float(status.get("gross_amount") or 0))
        except ValueError:
            gross = -1
        if gross != booking.get("payment_amount"):
            logger.error(
                "Midtrans amount mismatch for %s: got %s, expected %s", order_id, gross, booking.get("payment_amount")
            )
            return "amount_mismatch"
        return "confirmed" if confirm_paid_booking(sb, str(booking["id"]), allow_late=True) else "already_handled"
    if ts in FAILED_STATUSES:
        sb.table("bookings").update({"status": "expired", "payment_status": "expired"}).eq("id", booking["id"]).eq(
            "status", "awaiting_payment"
        ).execute()
        return "expired"
    return "pending"


def hold_fields(mode: str, amount: int, booking_id: str) -> dict:
    """Columns for a new booking that waits for payment."""
    prefix = "DEMO" if mode == "demo" else "NS"
    return {
        "status": "awaiting_payment",
        "payment_status": "waiting",
        "payment_mode": mode,
        "payment_amount": amount,
        "payment_order_id": f"{prefix}-{booking_id}",
        "payment_qr_url": DEMO_QR_URL if mode == "demo" else None,
        "payment_expires_at": iso_z(utc_now() + timedelta(minutes=HOLD_MINUTES)),
    }


def after_cancel(sb, row: dict) -> None:
    """A cancelled hold stops waiting; at Midtrans the QR is cancelled too so it cannot be paid."""
    if row.get("payment_status") != "waiting":
        return
    sb.table("bookings").update({"payment_status": "expired"}).eq("id", str(row["id"])).execute()
    row["payment_status"] = "expired"
    if row.get("payment_mode") == "midtrans" and row.get("payment_order_id"):
        midtrans_cancel(row["payment_order_id"])
