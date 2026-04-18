from __future__ import annotations

from datetime import date, datetime, time

from supabase import Client

from app.constants import ALLOWED_SLOTS, SHOP_TZ


def _filter_past_slots_for_today(date_str: str, slots: list[str]) -> list[str]:
    """If date_str is today in the shop timezone, drop slot times that have already started."""
    try:
        target = date.fromisoformat(date_str)
    except ValueError:
        return slots
    today = datetime.now(SHOP_TZ).date()
    if target < today:
        return []
    if target > today:
        return slots

    now = datetime.now(SHOP_TZ)
    out: list[str] = []
    for s in slots:
        h, m = map(int, s.split(":"))
        slot_start = datetime.combine(target, time(h, m), tzinfo=SHOP_TZ)
        if slot_start > now:
            out.append(s)
    return out


def fetch_available_slots(sb: Client, date_str: str) -> list[str]:
    """Return allowed slot strings that are not booked (confirmed) or blocked."""
    try:
        target_day = date.fromisoformat(date_str)
    except ValueError:
        target_day = None
    if target_day is not None and target_day < datetime.now(SHOP_TZ).date():
        return []

    blocks_res = (
        sb.table("blocks")
        .select("block_time")
        .eq("block_date", date_str)
        .execute()
    )
    block_rows = blocks_res.data or []
    for row in block_rows:
        if row.get("block_time") in (None, ""):
            return []

    blocked_times = {
        row["block_time"]
        for row in block_rows
        if row.get("block_time") not in (None, "")
    }

    booked_res = (
        sb.table("bookings")
        .select("booking_time")
        .eq("booking_date", date_str)
        .eq("status", "confirmed")
        .execute()
    )
    booked_times = {row["booking_time"] for row in (booked_res.data or [])}

    taken = booked_times | blocked_times
    available = [s for s in ALLOWED_SLOTS if s not in taken]
    return _filter_past_slots_for_today(date_str, available)
