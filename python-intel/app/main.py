"""
WeatherGPT Python Intelligence Service (FastAPI)

Boundary:
  React/Vite UI  →  Node api/* (weather, chat, models)  →  optional Python /v1/*
  Gemini/Groq keys stay on Node (or future server-only Python) — never in browser.

Run:
  cd python-intel && uvicorn app.main:app --host 0.0.0.0 --port 8090
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import __version__
from app.config import get_settings
from app.errors import (
    IntelError,
    http_exception_handler,
    intel_error_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.routers import health, v1


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Touch settings early so bad env fails at boot
    get_settings()
    yield


def create_app() -> FastAPI:
    cfg = get_settings()
    application = FastAPI(
        title="WeatherGPT Intelligence",
        version=__version__,
        description=(
            "Deterministic weather preprocessing, model comparison, confidence, "
            "and crop feature extraction. No ML weights and no LLM in v0.1."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origin_list or ["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    application.add_exception_handler(IntelError, intel_error_handler)
    application.add_exception_handler(StarletteHTTPException, http_exception_handler)
    application.add_exception_handler(RequestValidationError, validation_exception_handler)
    application.add_exception_handler(Exception, unhandled_exception_handler)

    application.include_router(health.router)
    application.include_router(v1.router)

    @application.get("/")
    async def root():
        return {
            "ok": True,
            "service": cfg.service_name,
            "version": __version__,
            "docs": "/docs",
            "health": "/health",
            "capabilities": "/v1/capabilities",
        }

    return application


app = create_app()
