from fastapi import APIRouter

from app.db import get_supabase
from app.schemas import BarberOut, BarbersResponse
from app.services import fetch_active_barbers
from app.supabase_errors import http_exception_for_supabase

router = APIRouter(prefix="/barbers", tags=["barbers"])


@router.get("", response_model=BarbersResponse)
def list_barbers():
    sb = get_supabase()
    try:
        rows = fetch_active_barbers(sb)
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    barbers = [
        BarberOut(
            id=row["id"],
            name=row["name"],
            specialty=row.get("specialty") or "",
            photo_url=row.get("photo_url"),
            sort_order=int(row.get("sort_order") or 0),
        )
        for row in rows
    ]
    return BarbersResponse(barbers=barbers)
