import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request

from app.booking_reminders import remove_booking_reminder_job
from app.booking_whatsapp import DEPOSIT_IDR, SERVICE_PRICES_IDR, payment_amount_for
from app.config import get_settings
from app.db import get_supabase
from app.payments import (
    HOLD_MINUTES,
    PaymentProviderError,
    after_cancel,
    apply_midtrans_status,
    confirm_paid_booking,
    expire_stale_holds,
    hold_fields,
    is_unique_violation,
    midtrans_charge_qris,
    midtrans_signature_ok,
    midtrans_status,
    notify_booking_confirmed,
    parse_ts,
    utc_now,
)
from app.routes.admin import _booking_row
from app.schemas import (
    BookingCreate,
    BookingCreateResponse,
    CancelResponse,
    PaymentConfig,
    PaymentView,
)
from app.services import (
    fetch_available_slots,
    fetch_barber_by_id,
    pick_barber_with_most_availability,
)
from app.supabase_errors import http_exception_for_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])
payments_router = APIRouter(tags=["payments"])

SLOT_TAKEN = "Slot waktu ini tidak tersedia."


def _load_booking(sb, booking_id: UUID) -> dict:
    try:
        rows = sb.table("bookings").select("*").eq("id", str(booking_id)).limit(1).execute().data or []
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    if not rows:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
    return rows[0]


def _payment_view(sb, row: dict, barber_name: str | None = None) -> PaymentView:
    expires = parse_ts(row.get("payment_expires_at"))
    left = int((expires - utc_now()).total_seconds()) if expires and row["status"] == "awaiting_payment" else 0
    if barber_name is None:
        barber = fetch_barber_by_id(sb, row["barber_id"]) if row.get("barber_id") else None
        barber_name = (barber or {}).get("name") or ""
    return PaymentView(
        booking_id=row["id"],
        status=row["status"],
        payment_status=row.get("payment_status"),
        mode=row.get("payment_mode"),
        amount=row.get("payment_amount"),
        service_price=row.get("service_price"),
        order_id=row.get("payment_order_id"),
        qr_url=row.get("payment_qr_url"),
        seconds_left=max(0, left),
        customer_name=row["customer_name"],
        service=row["service"],
        barber_name=barber_name,
        booking_date=str(row["booking_date"]),
        booking_time=row["booking_time"],
    )


@payments_router.get("/payment-config", response_model=PaymentConfig)
def payment_config():
    return PaymentConfig(mode=get_settings().payment_mode, deposit_idr=DEPOSIT_IDR, hold_minutes=HOLD_MINUTES)


@router.post("", response_model=BookingCreateResponse)
def create_booking(body: BookingCreate):
    if body.prefer_any_barber and body.barber_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Kirim barber_id atau prefer_any_barber, bukan keduanya.",
        )
    if not body.prefer_any_barber and body.barber_id is None:
        raise HTTPException(
            status_code=400,
            detail="Pilih barber atau aktifkan prefer_any_barber.",
        )

    settings = get_settings()
    mode = settings.payment_mode
    if mode == "midtrans" and not settings.midtrans_server_key:
        logger.error("PAYMENT_MODE=midtrans but MIDTRANS_SERVER_KEY is not set")
        raise HTTPException(status_code=503, detail="Pembayaran online belum siap. Hubungi toko.")

    sb = get_supabase()
    barber_name = ""
    resolved_barber_id: str

    try:
        if mode != "off":
            expire_stale_holds(sb)
        if body.prefer_any_barber:
            picked = pick_barber_with_most_availability(sb, body.date, body.time)
            if not picked:
                raise HTTPException(status_code=409, detail=SLOT_TAKEN)
            resolved_barber_id = str(picked["id"])
            barber_name = picked.get("name") or ""
        else:
            barber = fetch_barber_by_id(sb, body.barber_id)
            if not barber or not barber.get("is_active"):
                raise HTTPException(status_code=404, detail="Barber tidak ditemukan")
            resolved_barber_id = str(barber["id"])
            barber_name = barber.get("name") or ""
            available = fetch_available_slots(sb, body.date, resolved_barber_id)
            if body.time not in available:
                raise HTTPException(status_code=409, detail=SLOT_TAKEN)
    except HTTPException:
        raise
    except Exception as e:
        raise http_exception_for_supabase(e) from e

    # Price comes from the server's list, never from the browser.
    service_name = body.service.strip()
    service_price = SERVICE_PRICES_IDR[service_name]
    booking_id = str(uuid4())

    payload = {
        "id": booking_id,
        "customer_name": body.customer_name.strip(),
        "whatsapp": body.whatsapp.strip(),
        "service": service_name,
        "service_price": service_price,
        "barber_id": resolved_barber_id,
        "booking_date": body.date,
        "booking_time": body.time,
        "status": "confirmed",
    }
    if mode != "off":
        payload.update(hold_fields(mode, payment_amount_for(service_price), booking_id))

    # The unique index is the real guard: of two customers racing for one slot, one insert fails here.
    try:
        res = sb.table("bookings").insert(payload).execute()
    except Exception as e:
        if is_unique_violation(e):
            raise HTTPException(status_code=409, detail=SLOT_TAKEN) from e
        raise http_exception_for_supabase(e) from e

    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Gagal menyimpan booking")
    row = rows[0]

    if mode == "off":
        notify_booking_confirmed(sb, row)
        return BookingCreateResponse(booking=_booking_row(row))

    if mode == "midtrans":
        try:
            qr_url = midtrans_charge_qris(row["payment_order_id"], row["payment_amount"])
        except PaymentProviderError:
            logger.exception("QRIS charge failed for booking %s", booking_id)
            sb.table("bookings").update({"status": "cancelled", "payment_status": "expired"}).eq(
                "id", booking_id
            ).execute()
            raise HTTPException(status_code=502, detail="QRIS gagal dibuat. Coba lagi sebentar lagi.")
        sb.table("bookings").update({"payment_qr_url": qr_url}).eq("id", booking_id).execute()
        row["payment_qr_url"] = qr_url

    return BookingCreateResponse(booking=_booking_row(row), payment=_payment_view(sb, row, barber_name))


@router.get("/{booking_id}/payment", response_model=PaymentView)
def get_payment(booking_id: UUID):
    """Polled by the payment screen. In midtrans mode it also asks Midtrans, so a missed notification still confirms."""
    sb = get_supabase()
    row = _load_booking(sb, booking_id)
    try:
        if row["status"] == "awaiting_payment":
            if row.get("payment_mode") == "midtrans" and row.get("payment_order_id"):
                try:
                    apply_midtrans_status(sb, midtrans_status(row["payment_order_id"]))
                except PaymentProviderError:
                    logger.exception("Midtrans status check failed for %s", row["payment_order_id"])
            expire_stale_holds(sb)
            row = _load_booking(sb, booking_id)
        return _payment_view(sb, row)
    except HTTPException:
        raise
    except Exception as e:
        raise http_exception_for_supabase(e) from e


@router.post("/{booking_id}/demo-pay", response_model=PaymentView)
def demo_pay(booking_id: UUID):
    """Demo only: pretend the QR was paid. Refused (404) in any other payment mode."""
    if get_settings().payment_mode != "demo":
        raise HTTPException(status_code=404, detail="Not Found")
    sb = get_supabase()
    row = _load_booking(sb, booking_id)
    if row.get("payment_mode") != "demo":
        raise HTTPException(status_code=404, detail="Not Found")
    try:
        expire_stale_holds(sb)
        confirm_paid_booking(sb, str(booking_id), allow_late=False)
        row = _load_booking(sb, booking_id)
    except HTTPException:
        raise
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    if row["status"] == "expired":
        raise HTTPException(status_code=409, detail="Waktu bayar sudah habis. Silakan booking lagi.")
    if row["status"] != "confirmed":
        raise HTTPException(status_code=409, detail="Booking ini tidak menunggu pembayaran.")
    return _payment_view(sb, row)


@router.post("/{booking_id}/cancel", response_model=CancelResponse)
def cancel_booking(booking_id: UUID):
    sb = get_supabase()
    try:
        res = (
            sb.table("bookings")
            .update({"status": "cancelled"})
            .eq("id", str(booking_id))
            .in_("status", ["confirmed", "awaiting_payment"])
            .execute()
        )
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    rows = res.data or []
    if not rows:
        raise HTTPException(
            status_code=404, detail="Booking tidak ditemukan atau sudah dibatalkan"
        )
    remove_booking_reminder_job(booking_id)
    after_cancel(sb, rows[0])
    return CancelResponse(ok=True, booking=_booking_row(rows[0]))


@payments_router.post("/payments/midtrans/notification")
async def midtrans_notification(request: Request):
    """
    Midtrans HTTP notification. Trust nothing in the body: check the signature, then ask
    Midtrans's status API and act on that answer. Safe to receive the same notification twice.
    """
    settings = get_settings()
    if settings.payment_mode != "midtrans" or not settings.midtrans_server_key:
        raise HTTPException(status_code=404, detail="Not Found")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    if not isinstance(body, dict) or not midtrans_signature_ok(body, settings.midtrans_server_key):
        logger.warning("Midtrans notification with bad signature (order %s)", body.get("order_id") if isinstance(body, dict) else "?")
        raise HTTPException(status_code=403, detail="Invalid signature")
    try:
        status = midtrans_status(str(body["order_id"]))
    except PaymentProviderError:
        logger.exception("Midtrans status check failed for %s", body.get("order_id"))
        # 503 makes Midtrans retry later.
        raise HTTPException(status_code=503, detail="Status check failed")
    if str(status.get("order_id")) != str(body["order_id"]):
        logger.error("Midtrans status order mismatch: %s vs %s", status.get("order_id"), body["order_id"])
        return {"ok": True, "result": "order_mismatch"}
    result = apply_midtrans_status(get_supabase(), status)
    logger.info("Midtrans notification %s: %s", body["order_id"], result)
    return {"ok": True, "result": result}
