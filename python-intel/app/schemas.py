"""
Pydantic API contracts — Node/JS ↔ Python boundary.

Deterministic weather facts live in `WeatherFacts` / model rows.
LLM text is never produced here (v0.1). Node api/chat.js owns LLM.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class LocationIn(BaseModel):
    name: Optional[str] = None
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    tz: Optional[str] = "auto"
    id: Optional[str] = None
    country_code: Optional[str] = Field(default=None, alias="countryCode")

    model_config = {"populate_by_name": True}


class CurrentWeatherIn(BaseModel):
    """Observation scalars — numbers only, no prose."""

    temperature: Optional[float] = Field(default=None, alias="temp")
    apparent_temperature: Optional[float] = Field(default=None, alias="feelsLike")
    humidity: Optional[float] = Field(default=None, ge=0, le=100)
    wind_speed: Optional[float] = Field(default=None, alias="wind")
    wind_direction: Optional[float] = None
    precipitation: Optional[float] = Field(default=None, alias="rain")
    precipitation_probability: Optional[float] = Field(default=None, alias="pop", ge=0, le=100)
    weather_code: Optional[int] = Field(default=None, alias="code")
    pressure_msl: Optional[float] = None
    cloud_cover: Optional[float] = Field(default=None, ge=0, le=100)
    visibility: Optional[float] = None
    is_day: Optional[int] = None
    time: Optional[str] = None

    model_config = {"populate_by_name": True}


class DailyRowIn(BaseModel):
    date: Optional[str] = None
    temperature_2m_max: Optional[float] = Field(default=None, alias="max")
    temperature_2m_min: Optional[float] = Field(default=None, alias="min")
    precipitation_sum: Optional[float] = Field(default=None, alias="rain")
    precipitation_probability_max: Optional[float] = Field(default=None, alias="pop")
    wind_speed_10m_max: Optional[float] = Field(default=None, alias="wind")
    weather_code: Optional[int] = Field(default=None, alias="code")
    uv_index_max: Optional[float] = Field(default=None, alias="uv")

    model_config = {"populate_by_name": True}


class HourlyRowIn(BaseModel):
    time: Optional[str] = None
    temperature_2m: Optional[float] = Field(default=None, alias="temp")
    precipitation: Optional[float] = Field(default=None, alias="rain")
    precipitation_probability: Optional[float] = Field(default=None, alias="pop")
    weather_code: Optional[int] = Field(default=None, alias="code")
    wind_speed_10m: Optional[float] = Field(default=None, alias="wind")

    model_config = {"populate_by_name": True}


class WeatherPackIn(BaseModel):
    """Client/Node may send already-fetched Open-Meteo-shaped packs."""

    location: LocationIn
    current: Optional[CurrentWeatherIn] = None
    daily: List[DailyRowIn] = Field(default_factory=list)
    hourly: List[HourlyRowIn] = Field(default_factory=list)
    fetched_at: Optional[float] = Field(default=None, alias="fetchedAt")
    source: Optional[str] = None
    live: Optional[bool] = True

    model_config = {"populate_by_name": True}


class ModelRowIn(BaseModel):
    """One NWP model summary — aligned with Node multiModel.js rows."""

    id: str
    short: Optional[str] = None
    label: Optional[str] = None
    ok: bool = True
    available: bool = True
    current_temp: Optional[float] = Field(default=None, alias="currentTemp")
    current: Optional[Dict[str, Any]] = None
    today: Optional[Dict[str, Any]] = None
    next24h: Optional[Dict[str, Any]] = Field(default=None, alias="next24h")

    model_config = {"populate_by_name": True}


# ── Requests ──────────────────────────────────────────────


class PreprocessRequest(BaseModel):
    pack: WeatherPackIn
    options: Optional[Dict[str, Any]] = None


class CompareModelsRequest(BaseModel):
    location: LocationIn
    models: List[ModelRowIn] = Field(..., min_length=1)
    fetched_at: Optional[float] = Field(default=None, alias="fetchedAt")
    horizon_hours: float = Field(default=24, ge=1, le=240, alias="horizonHours")

    model_config = {"populate_by_name": True}


class ConfidenceRequest(BaseModel):
    models: List[ModelRowIn] = Field(default_factory=list)
    fetched_at: Optional[float] = Field(default=None, alias="fetchedAt")
    now_ms: Optional[float] = Field(default=None, alias="nowMs")
    horizon_hours: float = Field(default=24, ge=1, le=240, alias="horizonHours")
    live: bool = True
    multi_model_mode: Optional[str] = Field(default=None, alias="multi_model_mode")

    model_config = {"populate_by_name": True}


class CropFeaturesRequest(BaseModel):
    pack: WeatherPackIn
    crop: Optional[str] = Field(default=None, description="Crop id or common name, e.g. wheat")
    lang: str = Field(default="en", pattern="^(en|hi)$")


# ── Responses ─────────────────────────────────────────────


class ErrorBody(BaseModel):
    ok: bool = False
    error: str
    code: str
    detail: Optional[Any] = None
    schema_version: str = "weathergpt.intel.v1"


class HealthResponse(BaseModel):
    ok: bool = True
    status: str = "ok"
    service: str
    version: str
    schema_version: str
    config: Dict[str, Any]
    ml_enabled: bool = False
    llm_enabled: bool = False


class WeatherFacts(BaseModel):
    """
    Locked deterministic facts — safe to ground an LLM later.
    Separate from any generated prose.
    """

    schema_version: str = "weathergpt.weather_facts.v1"
    location: Dict[str, Any]
    as_of: Optional[float] = None
    source: Optional[str] = None
    live: bool = True
    current: Dict[str, Any] = Field(default_factory=dict)
    daily_summary: List[Dict[str, Any]] = Field(default_factory=list)
    hourly_summary: List[Dict[str, Any]] = Field(default_factory=list)
    derived: Dict[str, Any] = Field(default_factory=dict)
    allowed_numbers: List[float] = Field(default_factory=list)


class PreprocessResponse(BaseModel):
    ok: bool = True
    schema_version: str = "weathergpt.intel.v1"
    engine: str = "weathergpt.preprocess.v1"
    facts: WeatherFacts
    features: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)


class ModelAgreementBlock(BaseModel):
    model_count: int
    models_used: List[str]
    labels: Dict[str, str] = Field(default_factory=dict)
    temperature: Dict[str, Any]
    precipitation_probability: Dict[str, Any]
    precipitation: Dict[str, Any]
    wind_speed: Dict[str, Any]
    agreement_level: str


class CompareModelsResponse(BaseModel):
    ok: bool = True
    schema_version: str = "weathergpt.intel.v1"
    engine: str = "weathergpt.model_compare.v1"
    location: Dict[str, Any]
    agreement: ModelAgreementBlock
    ensemble: Dict[str, Any]
    per_model: List[Dict[str, Any]]
    notes: List[str] = Field(default_factory=list)


class ConfidenceResponse(BaseModel):
    ok: bool = True
    schema_version: str = "weathergpt.intel.v1"
    engine: str = "weathergpt.confidence.v1"
    score: int = Field(..., ge=0, le=100)
    level: ConfidenceLevel
    reasons: List[str]
    model_agreement: Dict[str, Any]
    factors: Dict[str, Any]
    formula: str
    live: bool = True


class CropFeaturesResponse(BaseModel):
    ok: bool = True
    schema_version: str = "weathergpt.intel.v1"
    engine: str = "weathergpt.crop_features.v1"
    crop_id: Optional[str] = None
    crop_name: Optional[str] = None
    location: Dict[str, Any]
    weather_features: Dict[str, Any]
    agronomic_flags: Dict[str, Any]
    suitability: Dict[str, Any]
    advice_keys: List[str] = Field(
        default_factory=list,
        description="Stable keys for UI/i18n — not free-form LLM text",
    )
    disclaimers: List[str] = Field(default_factory=list)
    facts_ref: Optional[Dict[str, Any]] = None
