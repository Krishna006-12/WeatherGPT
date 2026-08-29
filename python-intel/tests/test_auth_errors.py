import os

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


def test_auth_required(monkeypatch):
    monkeypatch.setenv("INTEL_SERVICE_KEY", "secret-test-key")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as client:
        r = client.post(
            "/v1/confidence",
            json={"models": [], "live": True, "nowMs": 1e12},
        )
        assert r.status_code == 401
        assert r.json()["code"] == "unauthorized"

        r2 = client.post(
            "/v1/confidence",
            json={"models": [], "live": True, "nowMs": 1e12},
            headers={"X-Intel-Key": "secret-test-key"},
        )
        assert r2.status_code == 200
    get_settings.cache_clear()
    monkeypatch.delenv("INTEL_SERVICE_KEY", raising=False)


def test_health_no_auth_even_with_key(monkeypatch):
    monkeypatch.setenv("INTEL_SERVICE_KEY", "secret-test-key")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
    get_settings.cache_clear()
    monkeypatch.delenv("INTEL_SERVICE_KEY", raising=False)
