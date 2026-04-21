from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env — stable even if uvicorn is started from the repo root
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # Local dev: load `backend/.env` when present. On Railway (and CI), only process env is used.
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE) if _ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str
    supabase_service_key: str
    admin_api_key: str
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Fonnte WhatsApp (optional locally; set on Railway for notifications)
    fonnte_token: str | None = None
    rifki_whatsapp: str | None = None

    @field_validator("supabase_url", "supabase_service_key", "admin_api_key", mode="before")
    @classmethod
    def strip_secrets(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("supabase_url", mode="after")
    @classmethod
    def normalize_supabase_url(cls, v: str) -> str:
        # Trailing slash breaks some PostgREST client URLs.
        return v.rstrip("/")

    @field_validator("fonnte_token", "rifki_whatsapp", mode="before")
    @classmethod
    def optional_strip(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


def cors_origin_list() -> list[str]:
    raw = get_settings().cors_origins.strip()
    if not raw:
        return ["http://localhost:5173"]
    return [o.strip() for o in raw.split(",") if o.strip()]
