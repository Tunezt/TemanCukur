from datetime import date as date_type

from fastapi import APIRouter, HTTPException, Query

from app.db import get_supabase
from app.schemas import SlotsResponse
from app.services import fetch_available_slots
from app.supabase_errors import http_exception_for_supabase

router = APIRouter(prefix="/slots", tags=["slots"])


@router.get("", response_model=SlotsResponse)
def get_slots(day: str = Query(..., alias="date", description="YYYY-MM-DD")):
    try:
        date_type.fromisoformat(day)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Format tanggal tidak valid; gunakan YYYY-MM-DD"
        )

    sb = get_supabase()
    try:
        slots = fetch_available_slots(sb, day)
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    return SlotsResponse(date=day, slots=slots)
