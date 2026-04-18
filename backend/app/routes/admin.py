from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import get_supabase
from app.deps import verify_admin_key
from app.schemas import (
    BlockCreate,
    BlockCreateResponse,
    BlockOut,
    BlockRangeCreate,
    BookingOut,
    CancelResponse,
    slots_in_inclusive_range,
)
from app.supabase_errors import http_exception_for_supabase

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(verify_admin_key)])


def _booking_row(row: dict) -> BookingOut:
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


def _block_row(row: dict) -> BlockOut:
    bt = row.get("block_time")
    if bt in ("", None):
        bt = None
    return BlockOut(
        id=row["id"],
        block_date=str(row["block_date"]),
        block_time=bt,
        created_at=str(row["created_at"]),
    )


@router.get("/bookings", response_model=list[BookingOut])
def list_bookings(
    from_date: str | None = Query(None, alias="from", description="Filter booking_date >= YYYY-MM-DD"),
    to_date: str | None = Query(None, alias="to", description="Filter booking_date <= YYYY-MM-DD"),
):
    if from_date:
        try:
            date.fromisoformat(from_date)
        except ValueError:
            raise HTTPException(400, detail="Tanggal mulai tidak valid")
    if to_date:
        try:
            date.fromisoformat(to_date)
        except ValueError:
            raise HTTPException(400, detail="Tanggal akhir tidak valid")

    sb = get_supabase()
    q = sb.table("bookings").select("*")
    if from_date:
        q = q.gte("booking_date", from_date)
    if to_date:
        q = q.lte("booking_date", to_date)
    try:
        res = q.order("created_at", desc=True).execute()
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    return [_booking_row(r) for r in (res.data or [])]


@router.post("/bookings/{booking_id}/cancel", response_model=CancelResponse)
def admin_cancel_booking(booking_id: UUID):
    """Cancel a confirmed booking (admin UI; requires X-Admin-Key)."""
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
            status_code=404,
            detail="Booking tidak ditemukan atau sudah dibatalkan",
        )
    return CancelResponse(ok=True, booking=_booking_row(rows[0]))


@router.post("/blocks", response_model=BlockCreateResponse)
def create_block(body: BlockCreate):
    sb = get_supabase()
    row_in = {
        "block_date": body.date,
        "block_time": body.time,
    }
    try:
        res = sb.table("blocks").insert(row_in).execute()
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Gagal membuat blok")
    return BlockCreateResponse(block=_block_row(rows[0]))


@router.post("/blocks/range", response_model=list[BlockOut])
def create_block_range(body: BlockRangeCreate):
    """Block every shop slot from time_from through time_to (inclusive) on the given date."""
    try:
        slot_list = slots_in_inclusive_range(body.time_from, body.time_to)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    sb = get_supabase()
    created: list[BlockOut] = []
    for t in slot_list:
        row_in = {"block_date": body.date, "block_time": t}
        try:
            res = sb.table("blocks").insert(row_in).execute()
        except Exception as e:
            err = str(e).lower()
            if "duplicate" in err or "unique" in err or "23505" in err:
                continue
            raise http_exception_for_supabase(e) from e
        rows = res.data or []
        if rows:
            created.append(_block_row(rows[0]))

    if not created and slot_list:
        raise HTTPException(
            status_code=409,
            detail="Tidak bisa menambah blok (slot mungkin sudah diblokir)",
        )
    return created


@router.get("/blocks", response_model=list[BlockOut])
def list_blocks():
    sb = get_supabase()
    try:
        res = sb.table("blocks").select("*").order("block_date", desc=False).execute()
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    rows = list(res.data or [])
    rows.sort(key=lambda r: (str(r["block_date"]), (r.get("block_time") or "") or "\xff"))
    return [_block_row(r) for r in rows]


@router.delete("/blocks/{block_id}")
def delete_block(block_id: UUID):
    sb = get_supabase()
    try:
        # postgrest-py: delete() returns a filter builder — do not chain .select() after .eq().
        res = sb.table("blocks").delete().eq("id", str(block_id)).execute()
    except Exception as e:
        raise http_exception_for_supabase(e) from e
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Blok tidak ditemukan")
    return {"ok": True}
