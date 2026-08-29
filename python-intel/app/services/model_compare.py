"""
Multi-model comparison — ensemble stats from provided model rows.
Does not fetch upstream models in v0.1 (Node /api/models remains source of truth for fetches).
"""
from __future__ import annotations

from typing import Any, Dict, List

from app.schemas import CompareModelsRequest, LocationIn
from app.services.confidence import build_model_agreement, extract_model_scalars
from app.services.mathutil import mean_of, round_n, spread_of


def compare_models(req: CompareModelsRequest) -> Dict[str, Any]:
    models = req.models
    agreement = build_model_agreement(models)
    rows = [r for r in (extract_model_scalars(m) for m in models) if r]

    temps = [r["temp"] for r in rows if r.get("temp") is not None]
    pops = [r["pop"] for r in rows if r.get("pop") is not None]
    rains = [r["rain"] for r in rows if r.get("rain") is not None]
    winds = [r["wind"] for r in rows if r.get("wind") is not None]

    n = len(rows)
    if n >= 2:
        mode = "multi"
        note = "Ensemble from client-supplied model rows (deterministic)."
    elif n == 1:
        mode = "single"
        note = "Single-model only — not multi-model consensus."
    else:
        mode = "none"
        note = "No usable model scalars."

    ensemble = {
        "multi_model_mode": mode,
        "modelCount": n,
        "meanTemp24h": mean_of(temps),
        "spreadTempC": spread_of(temps),
        "meanPopMax": mean_of(pops),
        "spreadPopPp": spread_of(pops),
        "meanRainMm": mean_of(rains),
        "spreadRainMm": spread_of(rains),
        "meanWindKmh": mean_of(winds),
        "spreadWindKmh": spread_of(winds),
        "agreementLevel": agreement["agreementLevel"],
        "is_consensus": mode == "multi" and agreement["agreementLevel"] in ("high", "moderate"),
        "horizonHours": req.horizon_hours,
    }

    per_model = []
    for r in rows:
        per_model.append(
            {
                "id": r["id"],
                "short": r["short"],
                "temp_c": r.get("temp"),
                "pop_pct": r.get("pop"),
                "rain_mm": r.get("rain"),
                "wind_kmh": r.get("wind"),
                "delta_temp_vs_mean": round_n((r["temp"] - ensemble["meanTemp24h"]), 2)
                if r.get("temp") is not None and ensemble["meanTemp24h"] is not None
                else None,
            }
        )

    loc = req.location
    return {
        "ok": True,
        "schema_version": "weathergpt.intel.v1",
        "engine": "weathergpt.model_compare.v1",
        "location": {
            "id": loc.id,
            "name": loc.name,
            "lat": loc.lat,
            "lon": loc.lon,
            "tz": loc.tz,
        },
        "agreement": {
            "model_count": agreement["modelCount"],
            "models_used": agreement["modelsUsed"],
            "labels": agreement["labels"],
            "temperature": agreement["temperature"],
            "precipitation_probability": agreement["precipitation_probability"],
            "precipitation": agreement["precipitation"],
            "wind_speed": agreement["wind_speed"],
            "agreement_level": agreement["agreementLevel"],
        },
        "ensemble": ensemble,
        "per_model": per_model,
        "notes": [note],
    }
