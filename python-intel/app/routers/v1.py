"""
v1 intelligence endpoints.

All handlers are CPU-bound pure functions wrapped with timeout.
No Gemini/Groq keys used. No secrets in responses.
"""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends

from app.deps import run_with_timeout, verify_service_key
from app.errors import IntelError
from app.schemas import (
    CompareModelsRequest,
    CompareModelsResponse,
    ConfidenceRequest,
    ConfidenceResponse,
    CropFeaturesRequest,
    CropFeaturesResponse,
    PreprocessRequest,
    PreprocessResponse,
)
from app.services.confidence import calculate_forecast_confidence
from app.services.crop_features import extract_crop_features
from app.services.model_compare import compare_models
from app.services.preprocess import preprocess_pack

router = APIRouter(
    prefix="/v1",
    tags=["intelligence"],
    dependencies=[Depends(verify_service_key)],
)


def _sync_preprocess(body: PreprocessRequest) -> dict:
    return preprocess_pack(body.pack)


def _sync_compare(body: CompareModelsRequest) -> dict:
    return compare_models(body)


def _sync_confidence(body: ConfidenceRequest) -> dict:
    payload = body.model_dump(by_alias=True)
    return calculate_forecast_confidence(payload)


def _sync_crop(body: CropFeaturesRequest) -> dict:
    return extract_crop_features(body)


@router.post("/preprocess", response_model=PreprocessResponse)
async def preprocess(body: PreprocessRequest) -> Any:
    result = await run_with_timeout(asyncio.to_thread(_sync_preprocess, body))
    return result


@router.post("/compare-models", response_model=CompareModelsResponse)
async def compare_models_route(body: CompareModelsRequest) -> Any:
    if not body.models:
        raise IntelError("models array required", code="validation_error", status_code=422)
    result = await run_with_timeout(asyncio.to_thread(_sync_compare, body))
    return result


@router.post("/confidence", response_model=ConfidenceResponse)
async def confidence_route(body: ConfidenceRequest) -> Any:
    raw = await run_with_timeout(asyncio.to_thread(_sync_confidence, body))
    return {
        "ok": True,
        "schema_version": "weathergpt.intel.v1",
        "engine": raw.get("engine", "weathergpt.confidence.v1"),
        "score": raw["score"],
        "level": raw["level"],
        "reasons": raw.get("reasons") or [],
        "model_agreement": raw.get("modelAgreement") or {},
        "factors": raw.get("factors") or {},
        "formula": raw.get("formula") or "",
        "live": raw.get("live", True),
    }


@router.post("/crop-features", response_model=CropFeaturesResponse)
async def crop_features_route(body: CropFeaturesRequest) -> Any:
    result = await run_with_timeout(asyncio.to_thread(_sync_crop, body))
    return result


@router.get("/capabilities")
async def capabilities() -> dict:
    """Machine-readable boundary doc for Node BFF / other AIs."""
    return {
        "ok": True,
        "schema_version": "weathergpt.intel.v1",
        "ml_enabled": False,
        "llm_enabled": False,
        "endpoints": [
            {
                "path": "/v1/preprocess",
                "method": "POST",
                "purpose": "Normalize weather pack → locked facts + numeric features",
            },
            {
                "path": "/v1/compare-models",
                "method": "POST",
                "purpose": "Ensemble stats from supplied NWP model rows (no upstream fan-out)",
            },
            {
                "path": "/v1/confidence",
                "method": "POST",
                "purpose": "Deterministic forecast confidence 0–100 (parity with Node confidenceEngine)",
            },
            {
                "path": "/v1/crop-features",
                "method": "POST",
                "purpose": "Crop×weather feature flags + suitability keys (no yield claims)",
            },
        ],
        "facts_vs_llm": {
            "facts": "WeatherFacts.allowed_numbers + structured fields",
            "llm": "Owned by Node api/chat.js — not this service",
        },
        "auth": "Optional header X-Intel-Key when INTEL_SERVICE_KEY is set",
    }
