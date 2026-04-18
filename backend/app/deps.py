from fastapi import Header, HTTPException, status

from app.config import get_settings


def verify_admin_key(x_admin_key: str | None = Header(None, alias="X-Admin-Key")) -> None:
    if not x_admin_key or x_admin_key != get_settings().admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kunci admin tidak valid atau tidak ada",
        )
