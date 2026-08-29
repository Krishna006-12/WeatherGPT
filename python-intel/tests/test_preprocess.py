def test_preprocess_ok(client, sample_pack):
    r = client.post("/v1/preprocess", json={"pack": sample_pack})
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["engine"] == "weathergpt.preprocess.v1"
    facts = j["facts"]
    assert facts["location"]["name"] == "Kanpur"
    assert facts["current"]["temperature_c"] == 32.4
    assert len(facts["daily_summary"]) == 3
    assert "allowed_numbers" in facts and 32.4 in facts["allowed_numbers"]
    assert j["features"]["rain_sum_next3d_mm"] is not None


def test_preprocess_validation(client):
    r = client.post("/v1/preprocess", json={"pack": {"location": {"lat": 999, "lon": 0}}})
    assert r.status_code == 422
    j = r.json()
    assert j["ok"] is False
    assert j["code"] == "validation_error"


def test_preprocess_deterministic(client, sample_pack):
    a = client.post("/v1/preprocess", json={"pack": sample_pack}).json()
    b = client.post("/v1/preprocess", json={"pack": sample_pack}).json()
    assert a["features"] == b["features"]
    assert a["facts"]["allowed_numbers"] == b["facts"]["allowed_numbers"]
