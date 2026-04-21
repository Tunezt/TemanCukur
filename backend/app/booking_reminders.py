"""Schedule one-off WhatsApp reminders 2h before booking (WITA / Asia/Makassar)."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from uuid import UUID

from apscheduler.jobstores.base import JobLookupError
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.date import DateTrigger
from zoneinfo import ZoneInfo

from app.booking_whatsapp import build_customer_reminder_message, fonnte_target_from_whatsapp
from app.db import get_supabase
from app.fonnte import send_fonnte_message

logger = logging.getLogger(__name__)

WITA_TZ = ZoneInfo("Asia/Makassar")

_scheduler: BackgroundScheduler | None = None


def _scheduler_instance() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(
            timezone=WITA_TZ,
            job_defaults={
                "coalesce": True,
                "misfire_grace_time": 3600,
                "max_instances": 1,
            },
        )
    return _scheduler


def start_reminder_scheduler() -> BackgroundScheduler:
    sched = _scheduler_instance()
    if not sched.running:
        sched.start()
    return sched


def shutdown_reminder_scheduler() -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None


def reminder_job_id(booking_id: UUID) -> str:
    return f"booking_reminder_{booking_id}"


def _compute_reminder_run_at(booking_date: str, booking_time: str) -> datetime | None:
    try:
        d = date.fromisoformat(booking_date)
    except ValueError:
        logger.warning("Invalid booking_date for reminder: %s", booking_date)
        return None
    parts = booking_time.split(":")
    if len(parts) != 2:
        return None
    try:
        h, m = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    start_local = datetime(d.year, d.month, d.day, h, m, 0, tzinfo=WITA_TZ)
    return start_local - timedelta(hours=2)


def send_booking_reminder_job(booking_id: str) -> None:
    """APScheduler job: load booking; if still confirmed, send Fonnte reminder."""
    try:
        uid = UUID(booking_id)
    except ValueError:
        logger.warning("Reminder job invalid booking id: %s", booking_id)
        return

    try:
        sb = get_supabase()
        res = (
            sb.table("bookings")
            .select("customer_name,whatsapp,service,booking_time,status")
            .eq("id", str(uid))
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("Reminder job: failed to load booking %s", booking_id)
        return

    rows = res.data or []
    if not rows:
        logger.info("Reminder job: booking %s gone; skip", booking_id)
        return
    row = rows[0]
    if row.get("status") != "confirmed":
        logger.info("Reminder job: booking %s not confirmed; skip", booking_id)
        return

    target = fonnte_target_from_whatsapp(row.get("whatsapp") or "")
    if not target:
        logger.warning("Reminder job: no WhatsApp target for booking %s", booking_id)
        return

    msg = build_customer_reminder_message(
        customer_name=row.get("customer_name") or "",
        service=row.get("service") or "",
        booking_time=row.get("booking_time") or "",
    )
    send_fonnte_message(target, msg)


def schedule_booking_reminder(
    booking_id: UUID,
    booking_date: str,
    booking_time: str,
) -> None:
    run_at = _compute_reminder_run_at(booking_date, booking_time)
    if run_at is None:
        return
    now = datetime.now(WITA_TZ)
    if run_at <= now:
        logger.info(
            "No reminder scheduled for booking %s (reminder time %s not in future)",
            booking_id,
            run_at.isoformat(),
        )
        return

    sched = start_reminder_scheduler()
    jid = reminder_job_id(booking_id)
    try:
        sched.add_job(
            send_booking_reminder_job,
            trigger=DateTrigger(run_date=run_at, timezone=WITA_TZ),
            args=[str(booking_id)],
            id=jid,
            replace_existing=True,
        )
        logger.info(
            "Scheduled reminder for booking %s at %s WITA",
            booking_id,
            run_at.strftime("%Y-%m-%d %H:%M"),
        )
    except Exception:
        logger.exception("Failed to schedule reminder for booking %s", booking_id)


def remove_booking_reminder_job(booking_id: UUID) -> None:
    if _scheduler is None or not _scheduler.running:
        return
    jid = reminder_job_id(booking_id)
    try:
        _scheduler.remove_job(jid)
        logger.info("Removed reminder job %s", jid)
    except JobLookupError:
        pass
