"""Send WhatsApp messages via Fonnte HTTP API."""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

FONNTE_SEND_URL = "https://api.fonnte.com/send"


def send_fonnte_message(target: str, message: str) -> None:
    """
    POST to Fonnte. Swallows failures after logging — callers rely on this for
    non-blocking notifications after a booking is already persisted.
    """
    token = (get_settings().fonnte_token or "").strip()
    if not token:
        logger.warning("FONNTE_TOKEN not set; skipping Fonnte send")
        return

    target = target.strip()
    if not target:
        logger.warning("Fonnte target empty; skipping send")
        return

    headers = {"Authorization": token}
    try:
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(
                FONNTE_SEND_URL,
                headers=headers,
                json={"target": target, "message": message},
            )
        if resp.status_code >= 400:
            logger.error(
                "Fonnte HTTP %s for target=%s…: %s",
                resp.status_code,
                target[:6],
                (resp.text or "")[:800],
            )
            return
    except Exception:
        logger.exception("Fonnte request failed (target prefix %s)", target[:6])
