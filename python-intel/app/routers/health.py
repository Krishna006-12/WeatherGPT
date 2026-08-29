from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.config import get_settings
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
@router.get("/v1/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    cfg = get_settings()
    return HealthResponse(
        ok=True,
        status="ok",
        service=cfg.service_name,
        version=__version__,
        schema_version=cfg.schema_version,
        config=cfg.public_config(),
        ml_enabled=False,
        llm_enabled=False,
    )
