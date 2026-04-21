import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException
from postgrest.exceptions import APIError

from app.booking_reminders import remove_booking_reminder_job, schedule_booking_reminder
from app.booking_whatsapp import send_booking_confirmation_wa
from app.db import get_supabase
from app.schemas import BookingCreate, BookingCreateResponse, BookingOut, CancelResponse
from app.services import fetch_available_slots
from app.supabase_errors import http_exception_for_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _row_to_booking(row: dict) -> BookingOut:
    return BookingOut(
        id=row["id"],
        customer_name=row["customer_name"],
        whatsapp=row["whatsapp"],
        service=row["service"],
        booking_date=str(row["booking_date"]),
        booking_time=row["booking_time"],
        status=row["status"],
        created_at=str(row["created_at"]),
    )


@router.post("", response_model=BookingCreateResponse)
def create_booking(body: BookingCreate):
    sb = get_supabase()
    try:
        available = fetch_available_slots(sb, body.date)
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    if body.time not in available:
        raise HTTPException(
            status_code=409,
            detail="Slot waktu ini tidak tersedia.",
        )
    payload = {
        "customer_name": body.customer_name.strip(),
        "whatsapp": body.whatsapp.strip(),
        "service": body.service.strip(),
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
