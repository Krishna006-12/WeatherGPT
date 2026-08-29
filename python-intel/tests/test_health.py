def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["ml_enabled"] is False
    assert j["llm_enabled"] is False
    assert "auth_required" in j["config"]
    # no secrets
    assert "GEMINI" not in str(j).upper()
    assert "API_KEY" not in str(j).upper()


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_capabilities(client):
    r = client.get("/v1/capabilities")
    assert r.status_code == 200
    j = r.json()
    assert len(j["endpoints"]) >= 4
    assert j["llm_enabled"] is False
