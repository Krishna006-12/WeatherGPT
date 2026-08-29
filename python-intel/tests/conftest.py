import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure package root on path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Deterministic env for tests — no secrets
os.environ.pop("INTEL_SERVICE_KEY", None)
os.environ["INTEL_ALLOW_UPSTREAM_FETCH"] = "false"
os.environ["INTEL_REQUEST_TIMEOUT_S"] = "5"

from app.main import create_app  # noqa: E402
from app.config import get_settings  # noqa: E402


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client():
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def sample_pack():
    return {
        "location": {"name": "Kanpur", "lat": 26.45, "lon": 80.33, "id": "kanpur", "tz": "Asia/Kolkata"},
        "current": {
            "temp": 32.4,
            "humidity": 62,
            "wind": 14.2,
            "pop": 40,
            "rain": 0.2,
            "code": 2,
            "feelsLike": 34.0,
        },
        "daily": [
            {"date": "2026-08-29", "max": 34, "min": 26, "rain": 2.5, "pop": 55, "wind": 18, "code": 61},
            {"date": "2026-08-30", "max": 33, "min": 25, "rain": 0.0, "pop": 20, "wind": 12, "code": 1},
            {"date": "2026-08-31", "max": 35, "min": 27, "rain": 12.0, "pop": 70, "wind": 22, "code": 63},
        ],
        "hourly": [
            {"time": f"2026-08-29T{h:02d}:00", "temp": 30 + h % 5, "pop": 10 + h, "rain": 0.0, "code": 2}
            for h in range(24)
        ],
        "fetchedAt": 1_725_000_000_000,
        "source": "open-meteo-direct",
        "live": True,
    }


@pytest.fixture
def sample_models():
    return [
        {
            "id": "ecmwf_ifs025",
            "short": "IFS",
            "ok": True,
            "available": True,
            "currentTemp": 31.2,
            "current": {"temperature": 31.2, "wind_speed": 12, "precipitation_probability": 40},
            "next24h": {"temp_mean": 30.5, "pop_max": 45, "rain_sum": 3.2},
            "today": {"max": 33, "min": 26, "pop": 45, "rain": 3.2},
        },
        {
            "id": "gfs_seamless",
            "short": "GFS",
            "ok": True,
            "available": True,
            "currentTemp": 32.0,
            "current": {"temperature": 32.0, "wind_speed": 14, "precipitation_probability": 42},
            "next24h": {"temp_mean": 31.0, "pop_max": 48, "rain_sum": 4.0},
            "today": {"max": 34, "min": 26, "pop": 48, "rain": 4.0},
        },
        {
            "id": "icon_global",
            "short": "ICON",
            "ok": True,
            "available": True,
            "currentTemp": 30.8,
            "current": {"temperature": 30.8, "wind_speed": 11, "precipitation_probability": 38},
            "next24h": {"temp_mean": 30.2, "pop_max": 42, "rain_sum": 2.8},
            "today": {"max": 33, "min": 25, "pop": 42, "rain": 2.8},
        },
    ]
