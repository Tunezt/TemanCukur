"""WhatsApp copy and helpers for booking confirmations (Fonnte)."""

from __future__ import annotations

import logging
import re
from datetime import date
from typing import Final

from app.config import get_settings

logger = logging.getLogger(__name__)

PUBLIC_SITE = "https://teman-cukur.vercel.app"
ADMIN_URL = f"{PUBLIC_SITE}/admin"

# Matches frontend service names → IDR amounts for confirmation text
SERVICE_PRICES_IDR: Final[dict[str, int]] = {
    "Haircut": 100_000,
    "Haircut + wash": 120_000,
}


def digits_only(s: str) -> str:
    return re.sub(r"\D+", "", s or "")


def fonnte_target_from_whatsapp(raw: str) -> str:
    """E.164-ish input → 628… digits for Fonnte ``target``."""
    d = digits_only(raw)
    if not d:
        return ""
    if d.startswith("0"):
        d = "62" + d[1:]
    elif not d.startswith("62"):
        d = "62" + d
    return d


def format_whatsapp_display(raw: str) -> str:
    d = fonnte_target_from_whatsapp(raw)
    if len(d) > 2 and d.startswith("62"):
        return f"+62 {d[2:]}"
    return f"+{d}" if d else raw.strip()


def fmt_idr(amount: int) -> str:
    s = f"{amount:,}".replace(",", ".")
    return f"Rp {s}"


def format_booking_date_display(iso_date: str) -> str:
    try:
        d = date.fromisoformat(iso_date)
    except ValueError:
        return iso_date
    return d.strftime("%d/%m/%Y")


def price_line_for_service(service: str) -> str:
    name = (service or "").strip()
    amount = SERVICE_PRICES_IDR.get(name)
    if amount is None:
        return f"Harga: (sesuai layanan: {name})"
    return f"Harga: {fmt_idr(amount)}"


def build_customer_confirmation_message(
    *,
    customer_name: str,
    service: str,
    booking_date: str,
    booking_time: str,
) -> str:
    tanggal = format_booking_date_display(booking_date)
    harga = price_line_for_service(service)
    return (
        f"Halo {customer_name.strip()}! Booking kamu di teman cukur sudah dikonfirmasi.\n"
        "\n"
        f"Layanan: {service.strip()}\n"
        f"Tanggal: {tanggal}\n"
        f"Jam: {booking_time} WITA\n"
        f"{harga}\n"
        "\n"
        "Pembayaran di tempat. Sampai jumpa!\n"
        "\n"
        "Mau reschedule atau batal? Booking ulang di website minimal 2 jam sebelum jadwal kamu:\n"
        f"{PUBLIC_SITE}"
    )


def build_rifki_new_booking_message(
    *,
    customer_name: str,
    customer_whatsapp_raw: str,
    service: str,
    booking_date: str,
    booking_time: str,
) -> str:
    tanggal = format_booking_date_display(booking_date)
    wa_disp = format_whatsapp_display(customer_whatsapp_raw)
    return (
        "Booking baru masuk!\n"
        "\n"
        f"Pelanggan: {customer_name.strip()}\n"
        f"WhatsApp: {wa_disp}\n"
        f"Layanan: {service.strip()}\n"
        f"Tanggal: {tanggal}\n"
        f"Jam: {booking_time} WITA\n"
        "\n"
        "Lihat semua booking:\n"
        f"{ADMIN_URL}"
    )


def build_customer_reminder_message(
    *,
    customer_name: str,
    service: str,
    booking_time: str,
) -> str:
    return (
        "Reminder: booking kamu di teman cukur 2 jam lagi!\n"
        "\n"
        f"Layanan: {service.strip()}\n"
        f"Jam: {booking_time} WITA\n"
        "\n"
        f"Sampai jumpa, {customer_name.strip()}! Kalau mau batal sekarang sudah tidak bisa ya — hubungi Rifki langsung."
    )


def send_booking_confirmation_wa(
    *,
    customer_name: str,
    customer_whatsapp_raw: str,
    service: str,
    booking_date: str,
    booking_time: str,
) -> None:
    from app.fonnte import send_fonnte_message

    cust_target = fonnte_target_from_whatsapp(customer_whatsapp_raw)
    if cust_target:
        send_fonnte_message(
            cust_target,
            build_customer_confirmation_message(
                customer_name=customer_name,
                service=service,
                booking_date=booking_date,
                booking_time=booking_time,
            ),
        )

    rifki_raw = (get_settings().rifki_whatsapp or "").strip()
    rifki_target = fonnte_target_from_whatsapp(rifki_raw)
    if rifki_target:
        send_fonnte_message(
            rifki_target,
            build_rifki_new_booking_message(
                customer_name=customer_name,
                customer_whatsapp_raw=customer_whatsapp_raw,
                service=service,
                booking_date=booking_date,
                booking_time=booking_time,
            ),
        )
    else:
        logger.warning("RIFKI_WHATSAPP not set; skipping owner notification")
