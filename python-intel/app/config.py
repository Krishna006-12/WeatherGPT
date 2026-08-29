"""Environment configuration — secrets never leak to response bodies."""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    intel_host: str = Field(default="0.0.0.0", alias="INTEL_HOST")
    intel_port: int = Field(default=8090, alias="INTEL_PORT")
    intel_log_level: str = Field(default="info", alias="INTEL_LOG_LEVEL")

    intel_http_timeout_s: float = Field(default=8.0, alias="INTEL_HTTP_TIMEOUT_S")
    intel_request_timeout_s: float = Field(default=15.0, alias="INTEL_REQUEST_TIMEOUT_S")

    intel_cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="INTEL_CORS_ORIGINS",
    )

    # Optional gate so only Node BFF can call Python in prod
    intel_service_key: str = Field(default="", alias="INTEL_SERVICE_KEY")

    intel_allow_upstream_fetch: bool = Field(default=False, alias="INTEL_ALLOW_UPSTREAM_FETCH")

    service_name: str = "weathergpt-intel"
    schema_version: str = "weathergpt.intel.v1"

    @field_validator("intel_http_timeout_s", "intel_request_timeout_s")
    @classmethod
    def _positive_timeout(cls, v: float) -> float:
        if v <= 0 or v > 120:
            raise ValueError("timeout must be in (0, 120]")
        return v

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.intel_cors_origins.split(",") if o.strip()]

    def public_config(self) -> dict:
        """Safe subset for /health — no keys."""
        return {
            "service": self.service_name,
            "schema": self.schema_version,
            "allow_upstream_fetch": self.intel_allow_upstream_fetch,
            "http_timeout_s": self.intel_http_timeout_s,
            "request_timeout_s": self.intel_request_timeout_s,
            "auth_required": bool(self.intel_service_key),
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
