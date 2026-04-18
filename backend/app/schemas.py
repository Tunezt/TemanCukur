from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.constants import ALLOWED_SET, ALLOWED_SLOTS


def _normalize_time(t: str) -> str:
    t = t.strip()
    parts = t.split(":")
    if len(parts) != 2:
        raise ValueError("Format waktu harus HH:MM")
    h, m = int(parts[0]), int(parts[1])
    return f"{h:02d}:{m:02d}"


def slots_in_inclusive_range(time_from: str, time_to: str) -> list[str]:
    """Return every allowed slot from time_from through time_to (in schedule order), inclusive."""
    a = _normalize_time(time_from)
    b = _normalize_time(time_to)
    if a not in ALLOWED_SET or b not in ALLOWED_SET:
        raise ValueError(
            f"time_from dan time_to harus masing-masing salah satu dari: {', '.join(ALLOWED_SLOTS)}"
        )
    i, j = ALLOWED_SLOTS.index(a), ALLOWED_SLOTS.index(b)
    if i > j:
        raise ValueError(
            "time_from harus sama dengan atau sebelum time_to pada jadwal toko"
        )
    return list(ALLOWED_SLOTS[i : j + 1])


class SlotsResponse(BaseModel):
    date: str
    slots: list[str]


class BookingCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=200)
    whatsapp: str = Field(..., min_length=5, max_length=32)
    service: str = Field(..., min_length=1, max_length=200)
    date: str = Field(..., description="YYYY-MM-DD")
    time: str = Field(..., description="HH:MM, must be an allowed slot")

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        date.fromisoformat(v)
        return v

    @field_validator("time")
    @classmethod
    def validate_time(cls, v: str) -> str:
        norm = _normalize_time(v)
        if norm not in ALLOWED_SET:
            raise ValueError(f"waktu harus salah satu dari: {', '.join(ALLOWED_SLOTS)}")
        return norm


class BookingOut(BaseModel):
    id: UUID
    customer_name: str
    whatsapp: str
    service: str
    booking_date: str
    booking_time: str
    status: str
    created_at: str


class BookingCreateResponse(BaseModel):
    booking: BookingOut


class CancelResponse(BaseModel):
    ok: bool
    booking: BookingOut


class BlockCreate(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD")
    time: str | None = Field(
        None,
        description="HH:MM to block one slot; omit or null to block the whole day",
    )

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        date.fromisoformat(v)
        return v

    @field_validator("time")
    @classmethod
    def validate_time(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        norm = _normalize_time(v)
        if norm not in ALLOWED_SET:
            raise ValueError(f"waktu harus salah satu dari: {', '.join(ALLOWED_SLOTS)}")
        return norm


class BlockRangeCreate(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD")
    time_from: str = Field(..., description="First slot to block (HH:MM)")
    time_to: str = Field(..., description="Last slot to block (HH:MM), inclusive")

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        date.fromisoformat(v)
        return v

    @field_validator("time_from", "time_to")
    @classmethod
    def validate_range_times(cls, v: str) -> str:
        norm = _normalize_time(v)
        if norm not in ALLOWED_SET:
            raise ValueError(f"waktu harus salah satu dari: {', '.join(ALLOWED_SLOTS)}")
        return norm


class BlockOut(BaseModel):
    id: UUID
    block_date: str
    block_time: str | None
    created_at: str


class BlockCreateResponse(BaseModel):
    block: BlockOut


class Message(BaseModel):
    detail: str
