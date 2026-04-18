from functools import lru_cache

import httpx
from supabase import Client, ClientOptions, create_client

from app.config import get_settings


@lru_cache
def get_supabase() -> Client:
    s = get_settings()
    # Ignore HTTP(S)_PROXY from the environment so IDE/sandbox proxies cannot break
    # direct HTTPS to *.supabase.co (trust_env=False).
    options = ClientOptions(
        httpx_client=httpx.Client(
            trust_env=False,
            timeout=httpx.Timeout(10.0, read=60.0),
        ),
    )
    return create_client(s.supabase_url, s.supabase_service_key, options=options)
