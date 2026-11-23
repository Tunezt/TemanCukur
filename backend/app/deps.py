import hashlib
import hmac
import time

from fastapi import Header, HTTPException, status

from app.config import get_settings

ADMIN_SESSION_SECONDS = 7 * 24 * 3600


def _sign(payload: str) -> str:
    secret = get_settings().admin_api_key.encode()
    return hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()


def admin_password_ok(password: str) -> bool:
    expected = get_settings().admin_password
    return bool(expected) and hmac.compare_digest(password.encode(), expected.encode())


def issue_admin_token(now: float | None = None) -> str:
    """Signed session token: '<expiry-unix>.<hmac>'. The signing secret never leaves the server."""
    exp = str(int((now or time.time()) + ADMIN_SESSION_SECONDS))
    return f"{exp}.{_sign(exp)}"


def admin_token_valid(token: str | None, now: float | None = None) -> bool:
    if not token or "." not in token:
        return False
    exp, sig = token.split(".", 1)
    if not exp.isdigit() or not hmac.compare_digest(sig, _sign(exp)):
        return False
    return int(exp) > (now or time.time())


def verify_admin_key(x_admin_key: str | None = Header(None, alias="X-Admin-Key")) -> None:
    if not admin_token_valid(x_admin_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesi admin habis atau tidak valid. Silakan masuk lagi.",
        )
