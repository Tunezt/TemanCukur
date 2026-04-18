"""Map Supabase / HTTP client failures to HTTPException with actionable details."""

from __future__ import annotations

import httpx
from fastapi import HTTPException
from postgrest.exceptions import APIError


def http_exception_for_supabase(exc: BaseException) -> HTTPException:
    if isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout)):
        return HTTPException(
            status_code=503,
            detail=(
                "Tidak dapat menghubungi Supabase (jaringan/DNS). Periksa SUPABASE_URL, "
                "coba jaringan lain atau matikan VPN, firewall Windows untuk Python, dan "
                "apakah HTTP_PROXY/HTTPS_PROXY mengarah ke proxy bermasalah (kosongkan untuk uji)."
            ),
        )
    if isinstance(exc, httpx.HTTPStatusError):
        return HTTPException(
            status_code=502,
            detail=f"Error HTTP Supabase: {exc.response.status_code}",
        )

    if isinstance(exc, APIError):
        msg = (exc.message or str(exc) or "").lower()
        code = exc.code or ""

        if code == "PGRST205" or "does not exist" in msg or "schema cache" in msg:
            return HTTPException(
                status_code=503,
                detail=(
                    "Tabel database belum ada. Buka Supabase → SQL Editor dan jalankan "
                    "backend/supabase/migrations/001_schema.sql"
                ),
            )
        if code in ("PGRST301", "42501", "28P01") or "jwt" in msg or "permission denied" in msg:
            return HTTPException(
                status_code=401,
                detail=(
                    "Supabase menolak kunci API. Di Project Settings → API, salin "
                    "secret/service key (atau JWT service_role lama) ke SUPABASE_SERVICE_KEY."
                ),
            )
        return HTTPException(
            status_code=502,
            detail=exc.message or str(exc),
        )

    err = str(exc)
    low = err.lower()
    if "getaddrinfo" in low or "name or service not known" in low:
        return HTTPException(
            status_code=503,
            detail=(
                "DNS gagal untuk Supabase. Periksa ejaan SUPABASE_URL dan jaringan Anda."
            ),
        )

    return HTTPException(status_code=502, detail=err[:800])
