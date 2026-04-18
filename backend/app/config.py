from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env — stable even if uvicorn is started from the repo root
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str
    supabase_service_key: str
    admin_api_key: str
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

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


@lru_cache
def get_settings() -> Settings:
    return Settings()


def cors_origin_list() -> list[str]:
    raw = get_settings().cors_origins.strip()
    if not raw:
        return ["http://localhost:5173"]
    return [o.strip() for o in raw.split(",") if o.strip()]
