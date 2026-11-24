from __future__ import annotations

from datetime import date, datetime, time
from uuid import UUID

from supabase import Client

from app.constants import ALLOWED_SLOTS, SHOP_TZ

# Statuses that occupy a slot (future-proof beyond confirmed-only)
_ACTIVE_BOOKING_STATUSES = ("pending", "awaiting_payment", "confirmed")


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


def _shop_wide_blocked_times(sb: Client, date_str: str) -> set[str] | None:
    """
    Return blocked slot times for the shop.
    None means the entire day is blocked (caller should return []).
    """
    blocks_res = (
        sb.table("blocks")
        .select("block_time")
        .eq("block_date", date_str)
        .execute()
    )
    block_rows = blocks_res.data or []
    for row in block_rows:
        if row.get("block_time") in (None, ""):
            return None
    return {
        row["block_time"]
        for row in block_rows
        if row.get("block_time") not in (None, "")
    }


def fetch_active_barbers(sb: Client) -> list[dict]:
    res = (
        sb.table("barbers")
        .select("id, name, specialty, photo_url, sort_order")
        .eq("is_active", True)
        .order("sort_order")
        .execute()
    )
    return list(res.data or [])


def fetch_available_slots(
    sb: Client,
    date_str: str,
    barber_id: str | UUID | None = None,
) -> list[str]:
    """
    Return allowed slot strings that are not booked or blocked for one barber.
    If barber_id is None, return the union of slots free for any active barber
    (shop-wide blocks still apply).
    """
    try:
        target_day = date.fromisoformat(date_str)
    except ValueError:
        target_day = None
    if target_day is not None and target_day < datetime.now(SHOP_TZ).date():
        return []

    blocked = _shop_wide_blocked_times(sb, date_str)
    if blocked is None:
        return []

    if barber_id is None:
        barbers = fetch_active_barbers(sb)
        if not barbers:
            return []
        free: set[str] = set()
        for b in barbers:
            free.update(fetch_available_slots(sb, date_str, b["id"]))
        return [s for s in ALLOWED_SLOTS if s in free]

    bid = str(barber_id)
    booked_res = (
        sb.table("bookings")
        .select("booking_time")
        .eq("booking_date", date_str)
        .eq("barber_id", bid)
        .in_("status", list(_ACTIVE_BOOKING_STATUSES))
        .execute()
    )
    booked_times = {row["booking_time"] for row in (booked_res.data or [])}

    taken = booked_times | blocked
    available = [s for s in ALLOWED_SLOTS if s not in taken]
    return _filter_past_slots_for_today(date_str, available)


def pick_barber_with_most_availability(
    sb: Client,
    date_str: str,
    time_str: str,
) -> dict | None:
    """
    Among active barbers free at time_str on date_str, pick the one with the
    most open slots that day. Ties keep the lower sort_order (first in list).
    """
    best: dict | None = None
    best_count = -1
    for barber in fetch_active_barbers(sb):
        slots = fetch_available_slots(sb, date_str, barber["id"])
        if time_str not in slots:
            continue
        n = len(slots)
        if n > best_count:
            best = barber
            best_count = n
    return best


def fetch_barber_by_id(sb: Client, barber_id: str | UUID) -> dict | None:
    res = (
        sb.table("barbers")
        .select("id, name, specialty, photo_url, is_active, sort_order")
        .eq("id", str(barber_id))
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None
