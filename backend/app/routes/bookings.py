import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException
from postgrest.exceptions import APIError

from app.booking_reminders import remove_booking_reminder_job, schedule_booking_reminder
from app.booking_whatsapp import SERVICE_PRICES_IDR, send_booking_confirmation_wa
from app.db import get_supabase
from app.schemas import BookingCreate, BookingCreateResponse, BookingOut, CancelResponse
from app.services import (
    fetch_available_slots,
    fetch_barber_by_id,
    pick_barber_with_most_availability,
)
from app.supabase_errors import http_exception_for_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _row_to_booking(row: dict) -> BookingOut:
    return BookingOut(
        id=row["id"],
        customer_name=row["customer_name"],
        whatsapp=row["whatsapp"],
        service=row["service"],
        service_price=row.get("service_price"),
        barber_id=row.get("barber_id"),
        booking_date=str(row["booking_date"]),
        booking_time=row["booking_time"],
        status=row["status"],
        created_at=str(row["created_at"]),
    )


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

    sb = get_supabase()
    barber_name = ""
    resolved_barber_id: str

    try:
        if body.prefer_any_barber:
            picked = pick_barber_with_most_availability(sb, body.date, body.time)
            if not picked:
                raise HTTPException(
                    status_code=409,
                    detail="Slot waktu ini tidak tersedia.",
                )
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
                raise HTTPException(
                    status_code=409,
                    detail="Slot waktu ini tidak tersedia.",
                )
    except HTTPException:
        raise
    except Exception as e:
        raise http_exception_for_supabase(e) from e

    # Price comes from the server's list, never from the browser.
    service_name = body.service.strip()
    service_price = SERVICE_PRICES_IDR[service_name]

    # Instant web confirm UX keeps status confirmed (schema default remains pending)
    payload = {
        "customer_name": body.customer_name.strip(),
        "whatsapp": body.whatsapp.strip(),
        "service": service_name,
        "service_price": service_price,
        "barber_id": resolved_barber_id,
        "booking_date": body.date,
        "booking_time": body.time,
        "status": "confirmed",
    }
    try:
        res = sb.table("bookings").insert(payload).execute()
    except APIError as e:
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg or "23505" in msg:
            raise HTTPException(
                status_code=409,
                detail="Slot waktu ini tidak tersedia.",
            ) from e
        raise http_exception_for_supabase(e) from e
    except Exception as e:
        err = str(e).lower()
        if "duplicate" in err or "unique" in err or "23505" in err:
            raise HTTPException(
                status_code=409,
                detail="Slot waktu ini tidak tersedia.",
            ) from e
        raise http_exception_for_supabase(e) from e

    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Gagal menyimpan booking")
    row = rows[0]
    booking = _row_to_booking(row)

    try:
        send_booking_confirmation_wa(
            customer_name=booking.customer_name,
            customer_whatsapp_raw=booking.whatsapp,
            service=booking.service,
            booking_date=booking.booking_date,
            booking_time=booking.booking_time,
            barber_name=barber_name,
            service_price=booking.service_price,
        )
        schedule_booking_reminder(
            booking.id,
            booking.booking_date,
            booking.booking_time,
        )
    except Exception:
        logger.exception(
            "WhatsApp / reminder scheduling failed after booking create (id=%s)",
            booking.id,
        )

    return BookingCreateResponse(booking=booking)


@router.post("/{booking_id}/cancel", response_model=CancelResponse)
def cancel_booking(booking_id: UUID):
    sb = get_supabase()
    try:
        res = (
            sb.table("bookings")
            .update({"status": "cancelled"})
            .eq("id", str(booking_id))
            .eq("status", "confirmed")
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
    return CancelResponse(ok=True, booking=_row_to_booking(rows[0]))
