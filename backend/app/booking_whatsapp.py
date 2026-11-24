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

# The service list and prices the server accepts (keep in sync with src/shopConfig.js SERVICES).
# PLACEHOLDER prices until the client confirms them.
SERVICE_PRICES_IDR: Final[dict[str, int]] = {
    "Haircut": 100_000,
    "Haircut + wash": 120_000,
}

# Online payment amount (pay before book). None = customer pays the full service price.
# A number = fixed deposit (DP) in rupiah; the rest is paid at the shop. TO CONFIRM with the client.
DEPOSIT_IDR: Final[int | None] = None


def payment_amount_for(service_price: int) -> int:
    return min(DEPOSIT_IDR, service_price) if DEPOSIT_IDR else service_price


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


SHOP_NAME = "Norm Studio"
SHOP_ADDRESS = "Jl. Belakang Mall BB, Damai, Balikpapan Selatan"
# Public shop WhatsApp (same as SHOP_WHATSAPP_E164 in src/shopConfig.js); shown as a link, never messaged.
SHOP_WA_LINK = "https://wa.me/62895342413552"

_HARI = ("Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min")
_BULAN = ("Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des")


def format_booking_date_display(iso_date: str) -> str:
    """'2026-11-26' -> 'Kam, 26 Nov' (Indonesian, no locale needed on the server)."""
    try:
        d = date.fromisoformat(iso_date)
    except ValueError:
        return iso_date
    return f"{_HARI[d.weekday()]}, {d.day} {_BULAN[d.month - 1]}"


def format_time_display(hhmm: str) -> str:
    """'10:00' -> '10.00 WITA' (Indonesian writes hours with a dot)."""
    return f"{(hhmm or '').strip().replace(':', '.')} WITA"


def _with_barber(service: str, barber_name: str) -> str:
    s = f"*{service.strip()}*"
    return f"{s} bersama *{barber_name.strip()}*" if barber_name.strip() else s


def payment_lines(service_price: int | None, paid_amount: int | None, demo: bool = False) -> str:
    """Payment block: what was paid online (and what is left), or what to pay at the shop."""
    if not paid_amount:
        return f"💳 Bayar di toko: *{fmt_idr(service_price)}*" if service_price else "💳 Bayar di toko"
    tag = " _(demo, bukan pembayaran asli)_" if demo else ""
    rest = (service_price or 0) - paid_amount
    if rest > 0:
        return f"💳 DP via QRIS: *{fmt_idr(paid_amount)}*{tag}\nSisa bayar di toko: *{fmt_idr(rest)}*"
    return f"💳 Lunas via QRIS: *{fmt_idr(paid_amount)}*{tag}"


def build_customer_confirmation_message(
    *,
    customer_name: str,
    service: str,
    booking_date: str,
    booking_time: str,
    barber_name: str = "",
    service_price: int | None = None,
    paid_amount: int | None = None,
    demo: bool = False,
) -> str:
    if service_price is None:
        service_price = SERVICE_PRICES_IDR.get((service or "").strip())
    change = (
        # Paid online: a change goes through the shop (refunds are manual), not a new booking.
        f"Mau ganti jadwal atau batal? Chat toko minimal 2 jam sebelum jadwal:\n{SHOP_WA_LINK}"
        if paid_amount
        else f"Mau ganti jadwal atau batal? Booking ulang di website minimal 2 jam sebelum jadwal:\n{PUBLIC_SITE}"
    )
    return (
        f"✅ *Booking terkonfirmasi*\n"
        f"Halo {customer_name.strip()}, sampai jumpa di {SHOP_NAME}!\n"
        "\n"
        f"{_with_barber(service, barber_name)}\n"
        f"📅 *{format_booking_date_display(booking_date)} · {format_time_display(booking_time)}*\n"
        f"📍 {SHOP_ADDRESS}\n"
        "\n"
        f"{payment_lines(service_price, paid_amount, demo)}\n"
        "\n"
        f"{change}"
    )


def build_owner_new_booking_message(
    *,
    customer_name: str,
    customer_whatsapp_raw: str,
    service: str,
    booking_date: str,
    booking_time: str,
    barber_name: str = "",
    service_price: int | None = None,
    paid_amount: int | None = None,
    demo: bool = False,
) -> str:
    if service_price is None:
        service_price = SERVICE_PRICES_IDR.get((service or "").strip())
    wa = fonnte_target_from_whatsapp(customer_whatsapp_raw)
    return (
        "🔔 *Booking baru masuk*\n"
        f"*{format_booking_date_display(booking_date)} · {format_time_display(booking_time)}*\n"
        f"{_with_barber(service, barber_name)}\n"
        "\n"
        f"Pelanggan: *{customer_name.strip()}*\n"
        f"WhatsApp: {('https://wa.me/' + wa) if wa else format_whatsapp_display(customer_whatsapp_raw)}\n"
        "\n"
        f"{payment_lines(service_price, paid_amount, demo)}\n"
        "\n"
        f"Semua booking: {ADMIN_URL}"
    )


def build_customer_reminder_message(
    *,
    customer_name: str,
    service: str,
    booking_time: str,
    barber_name: str = "",
) -> str:
    return (
        f"⏰ *2 jam lagi di {SHOP_NAME}*\n"
        f"Halo {customer_name.strip()}, jangan lupa ya!\n"
        "\n"
        f"{_with_barber(service, barber_name)}\n"
        f"*Hari ini · {format_time_display(booking_time)}*\n"
        f"📍 {SHOP_ADDRESS}\n"
        "\n"
        f"Batas pembatalan online sudah lewat. Kalau berhalangan, chat toko langsung:\n{SHOP_WA_LINK}"
    )


def send_booking_confirmation_wa(
    *,
    customer_name: str,
    customer_whatsapp_raw: str,
    service: str,
    booking_date: str,
    booking_time: str,
    barber_name: str = "",
    service_price: int | None = None,
    paid_amount: int | None = None,
    demo: bool = False,
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
                barber_name=barber_name,
                service_price=service_price,
                paid_amount=paid_amount,
                demo=demo,
            ),
        )

    owner_raw = (get_settings().rifki_whatsapp or "").strip()
    owner_target = fonnte_target_from_whatsapp(owner_raw)
    if owner_target:
        send_fonnte_message(
            owner_target,
            build_owner_new_booking_message(
                customer_name=customer_name,
                customer_whatsapp_raw=customer_whatsapp_raw,
                service=service,
                booking_date=booking_date,
                booking_time=booking_time,
                barber_name=barber_name,
                service_price=service_price,
                paid_amount=paid_amount,
                demo=demo,
            ),
        )
    else:
        logger.warning("RIFKI_WHATSAPP not set; skipping owner notification")
