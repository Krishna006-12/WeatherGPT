"""FastAPI dependencies — auth gate + timeout budget."""
from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import Header, Request

from app.config import Settings, get_settings
from app.errors import IntelError


def settings_dep() -> Settings:
    return get_settings()


async def verify_service_key(
    request: Request,
    x_intel_key: Optional[str] = Header(default=None, alias="X-Intel-Key"),
) -> None:
    """
    If INTEL_SERVICE_KEY is set, require matching header.
    Browser should not call Python directly in prod — Node BFF holds the key.
    """
    cfg = get_settings()
    expected = (cfg.intel_service_key or "").strip()
    if not expected:
        return
    got = (x_intel_key or "").strip()
    if got != expected:
        raise IntelError("Unauthorized intelligence client", code="unauthorized", status_code=401)


async def run_with_timeout(coro, timeout_s: Optional[float] = None):
    cfg = get_settings()
    t = timeout_s if timeout_s is not None else cfg.intel_request_timeout_s
    try:
        return await asyncio.wait_for(coro, timeout=t)
    except asyncio.TimeoutError as e:
        raise IntelError(
            f"Intelligence request timed out after {t}s",
            code="timeout",
            status_code=504,
        ) from e
