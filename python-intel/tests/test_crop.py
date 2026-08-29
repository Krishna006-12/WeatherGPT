def test_crop_wheat(client, sample_pack):
    r = client.post(
        "/v1/crop-features",
        json={"pack": sample_pack, "crop": "wheat", "lang": "en"},
    )
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["crop_id"] == "wheat"
    assert "weather_features" in j
    assert "agronomic_flags" in j
    assert j["suitability"]["band"] in ("favorable", "mixed", "challenging")
    assert "weather_only_context" in j["advice_keys"]
    assert j["disclaimers"]
    # no fabricated yield claim keys
    assert "yield_guarantee" not in str(j)


def test_crop_hindi_alias(client, sample_pack):
    r = client.post(
        "/v1/crop-features",
        json={"pack": sample_pack, "crop": "gehun", "lang": "hi"},
    )
    j = r.json()
    assert j["crop_id"] == "wheat"
    assert any("गारंटी" in d or "मौसम" in d for d in j["disclaimers"])


def test_crop_unknown_still_features(client, sample_pack):
    r = client.post(
        "/v1/crop-features",
        json={"pack": sample_pack, "crop": "unknown-crop-xyz", "lang": "en"},
    )
    j = r.json()
    assert j["ok"] is True
    assert j["weather_features"]["temperature_c"] is not None
