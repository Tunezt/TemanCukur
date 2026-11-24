"""Render every WhatsApp message from sample data and check it reads well on a phone.
Run from backend/: python -m pytest tests -q   (python tests/test_whatsapp_messages.py prints them)"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "x")
os.environ.setdefault("ADMIN_API_KEY", "x")
os.environ.setdefault("ADMIN_PASSWORD", "x")

from app import booking_whatsapp as wa  # noqa: E402

BOOKING = dict(service="Haircut + wash", booking_date="2026-11-26", booking_time="10:00", barber_name="Andi Pratama")


def samples() -> dict[str, str]:
    return {
        "customer_paid": wa.build_customer_confirmation_message(customer_name="Rina", service_price=120_000, paid_amount=120_000, **BOOKING),
        "customer_dp": wa.build_customer_confirmation_message(customer_name="Rina", service_price=120_000, paid_amount=50_000, **BOOKING),
        "customer_demo": wa.build_customer_confirmation_message(customer_name="Rina", service_price=120_000, paid_amount=120_000, demo=True, **BOOKING),
        "customer_pay_at_shop": wa.build_customer_confirmation_message(customer_name="Rina", service_price=120_000, **BOOKING),
        "shop_alert_paid": wa.build_owner_new_booking_message(customer_name="Rina", customer_whatsapp_raw="+628115819400", service_price=120_000, paid_amount=120_000, **BOOKING),
        "shop_alert_pay_at_shop": wa.build_owner_new_booking_message(customer_name="Rina", customer_whatsapp_raw="08115819400", service_price=120_000, **BOOKING),
        "reminder": wa.build_customer_reminder_message(customer_name="Rina", service="Haircut + wash", booking_time="10:00", barber_name="Andi Pratama"),
    }


def test_messages_read_well_on_a_phone():
    for name, msg in samples().items():
        lines = msg.split("\n")
        head = "\n".join(lines[:5])
        # answer first: service and time within the first lines
        assert "Haircut + wash" in head and "10.00 WITA" in head, name
        # only WhatsApp's own markup; nothing it would show literally
        assert "**" not in msg and not re.search(r"^#", msg, re.M) and "](" not in msg, name
        # bold markers are paired on every line
        assert all(line.count("*") % 2 == 0 for line in lines), name
        # short lines (links may be longer), and blocks separated by blank lines
        assert all(len(line) <= 90 or "https://" in line for line in lines), (name, max(lines, key=len))
        assert "\n\n" in msg and "\n\n\n" not in msg, name
        # at most one emoji marker per line
        assert all(len(re.findall(r"[\U0001F300-\U0001FAFF☀-➿]", line)) <= 1 for line in lines), name


def test_payment_facts():
    m = samples()
    assert "Lunas via QRIS: *Rp 120.000*" in m["customer_paid"]
    assert "DP via QRIS: *Rp 50.000*" in m["customer_dp"] and "Sisa bayar di toko: *Rp 70.000*" in m["customer_dp"]
    assert "demo" in m["customer_demo"] and "demo" not in m["customer_paid"]
    assert "Bayar di toko: *Rp 120.000*" in m["customer_pay_at_shop"]
    assert "https://wa.me/628115819400" in m["shop_alert_paid"] and "https://wa.me/628115819400" in m["shop_alert_pay_at_shop"]
    assert wa.ADMIN_URL in m["shop_alert_paid"]
    assert wa.format_booking_date_display("2026-11-26") == "Kam, 26 Nov"


if __name__ == "__main__":
    for k, v in samples().items():
        print(f"=== {k}\n{v}\n")
