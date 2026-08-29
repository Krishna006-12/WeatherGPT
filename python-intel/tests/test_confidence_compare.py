def test_compare_models(client, sample_models):
    body = {
        "location": {"name": "Kanpur", "lat": 26.45, "lon": 80.33},
        "models": sample_models,
        "horizonHours": 24,
    }
    r = client.post("/v1/compare-models", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["ensemble"]["modelCount"] == 3
    assert j["ensemble"]["multi_model_mode"] == "multi"
    assert j["agreement"]["agreement_level"] in ("high", "moderate", "low")
    assert len(j["per_model"]) == 3


def test_confidence_high_agreement(client, sample_models):
    body = {
        "models": sample_models,
        "fetchedAt": 1_725_000_000_000,
        "nowMs": 1_725_000_000_000 + 5 * 60_000,
        "horizonHours": 24,
        "live": True,
    }
    r = client.post("/v1/confidence", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["engine"] == "weathergpt.confidence.v1"
    assert 0 <= j["score"] <= 100
    assert j["level"] in ("HIGH", "MEDIUM", "LOW")
    # tight spreads → relatively high
    assert j["score"] >= 50


def test_confidence_single_model_cap(client, sample_models):
    body = {
        "models": sample_models[:1],
        "fetchedAt": 1_725_000_000_000,
        "nowMs": 1_725_000_000_000,
        "live": True,
    }
    r = client.post("/v1/confidence", json=body)
    j = r.json()
    assert j["score"] <= 55


def test_confidence_offline_cap(client, sample_models):
    body = {
        "models": sample_models,
        "fetchedAt": 1_725_000_000_000,
        "nowMs": 1_725_000_000_000,
        "live": False,
    }
    r = client.post("/v1/confidence", json=body)
    j = r.json()
    assert j["score"] <= 40
    assert any("Non-live" in x or "live" in x.lower() for x in j["reasons"])


def test_confidence_deterministic(client, sample_models):
    body = {
        "models": sample_models,
        "fetchedAt": 1_725_000_000_000,
        "nowMs": 1_725_000_000_000,
        "horizonHours": 24,
        "live": True,
    }
    a = client.post("/v1/confidence", json=body).json()
    b = client.post("/v1/confidence", json=body).json()
    assert a["score"] == b["score"]
    assert a["level"] == b["level"]
