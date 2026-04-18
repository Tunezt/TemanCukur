from datetime import timedelta, timezone

# WITA fixed offset (UTC+8). Indonesia has no DST; avoids ZoneInfo/tzdata quirks on some hosts.
SHOP_TZ = timezone(timedelta(hours=8))

# Canonical slot labels (24h strings, zero-padded hour).
ALLOWED_SLOTS: tuple[str, ...] = (
    "09:00",
    "10:00",
    "11:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
)

ALLOWED_SET = frozenset(ALLOWED_SLOTS)
