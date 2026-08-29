"""Structured HTTP errors — never include secrets."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class IntelError(Exception):
    def __init__(
        self,
        message: str,
        *,
        code: str = "intel_error",
        status_code: int = 400,
        detail: Any = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.detail = detail


def error_payload(message: str, code: str, detail: Any = None) -> dict:
    return {
        "ok": False,
        "error": message,
        "code": code,
        "detail": detail,
        "schema_version": "weathergpt.intel.v1",
    }


async def intel_error_handler(_request: Request, exc: IntelError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(exc.message, exc.code, exc.detail),
    )


async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail
    msg = detail if isinstance(detail, str) else "http_error"
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(str(msg), "http_error", detail if not isinstance(detail, str) else None),
    )


async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    # Strip any accidental env-looking strings from validation dumps
    errs = []
    for e in exc.errors():
        errs.append({"loc": e.get("loc"), "msg": e.get("msg"), "type": e.get("type")})
    return JSONResponse(
        status_code=422,
        content=error_payload("Validation failed", "validation_error", errs),
    )


async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    # Never echo exception internals that might contain paths/env
    return JSONResponse(
        status_code=500,
        content=error_payload("Internal intelligence error", "internal_error", type(exc).__name__),
    )
