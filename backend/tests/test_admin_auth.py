"""Self-check for admin session tokens. Run: python -m pytest tests (or python tests/test_admin_auth.py)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "x")
os.environ.setdefault("ADMIN_API_KEY", "test-signing-secret")
os.environ.setdefault("ADMIN_PASSWORD", "test-password")

from app.deps import ADMIN_SESSION_SECONDS, admin_password_ok, admin_token_valid, issue_admin_token  # noqa: E402
from app.config import get_settings  # noqa: E402


def test_tokens():
    pw = get_settings().admin_password
    assert admin_password_ok(pw)
    assert not admin_password_ok(pw + "x")
    assert not admin_password_ok("")
    t = issue_admin_token(now=1000)
    assert admin_token_valid(t, now=1001)
    assert not admin_token_valid(t, now=1000 + ADMIN_SESSION_SECONDS + 1)  # expired
    exp, sig = t.split(".")
    assert not admin_token_valid(f"{int(exp) + 999}.{sig}", now=1001)  # tampered expiry
    assert not admin_token_valid(get_settings().admin_api_key)  # raw secret is not a token
    assert not admin_token_valid(None)


if __name__ == "__main__":
    test_tokens()
    print("ok")
