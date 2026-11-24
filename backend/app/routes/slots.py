from datetime import date as date_type
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.db import get_supabase
from app.payments import expire_stale_holds
from app.schemas import SlotsResponse
from app.services import fetch_available_slots, fetch_barber_by_id
from app.supabase_errors import http_exception_for_supabase

router = APIRouter(prefix="/slots", tags=["slots"])


@router.get("", response_model=SlotsResponse)
def get_slots(
    day: str = Query(..., alias="date", description="YYYY-MM-DD"),
    barber_id: UUID | None = Query(
        None,
        description="If set, slots for this barber only; omit for union across active barbers",
    ),
):
    try:
        date_type.fromisoformat(day)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Format tanggal tidak valid; gunakan YYYY-MM-DD"
        )

    sb = get_supabase()
    if barber_id is not None:
        try:
            barber = fetch_barber_by_id(sb, barber_id)
        except Exception as e:
            raise http_exception_for_supabase(e) from e
        if not barber or not barber.get("is_active"):
            raise HTTPException(status_code=404, detail="Barber tidak ditemukan")

    try:
        if get_settings().payment_mode != "off":
            expire_stale_holds(sb)
        slots = fetch_available_slots(
            sb, day, str(barber_id) if barber_id else None
        )
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    return SlotsResponse(
        date=day,
        slots=slots,
        barber_id=str(barber_id) if barber_id else None,
    )
