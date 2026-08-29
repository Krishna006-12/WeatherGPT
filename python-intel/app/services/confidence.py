"""
Forecast confidence — port of api/_lib/confidenceEngine.js
Deterministic: same inputs → same score. No random. No LLM.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from app.services.mathutil import clamp, mean_of, num, round_n, score_from_spread, spread_of

TEMP_SPREAD_TABLE = [
    (0.8, 100),
    (1.2, 92),
    (1.8, 84),
    (2.5, 74),
    (3.5, 60),
    (5.0, 45),
    (7.0, 30),
    (10.0, 18),
    (999, 10),
]

POP_SPREAD_TABLE = [
    (5, 100),
    (8, 94),
    (12, 86),
    (18, 74),
    (25, 60),
    (35, 44),
    (50, 28),
    (999, 12),
]

RAIN_SPREAD_TABLE = [
    (1.0, 100),
    (2.5, 90),
    (5.0, 78),
    (10.0, 60),
    (20.0, 40),
    (40.0, 22),
    (999, 10),
]

WIND_SPREAD_TABLE = [
    (2, 100),
    (4, 92),
    (7, 80),
    (12, 65),
    (20, 45),
    (30, 28),
    (999, 12),
]


def availability_score(model_count: int) -> int:
    if model_count <= 0:
        return 0
    if model_count == 1:
        return 38
    if model_count == 2:
        return 62
    if model_count == 3:
        return 78
    if model_count == 4:
        return 90
    return 100


def horizon_score(horizon_hours: Optional[float]) -> int:
    h = num(horizon_hours)
    if h is None:
        return 88
    if h <= 6:
        return 98
    if h <= 12:
        return 94
    if h <= 24:
        return 88
    if h <= 48:
        return 72
    if h <= 72:
        return 58
    if h <= 120:
        return 42
    if h <= 168:
        return 30
    return 18


def freshness_score(fetched_at, now_ms: Optional[float] = None) -> int:
    now = now_ms if now_ms is not None else time.time() * 1000
    if fetched_at is None:
        return 55
    try:
        t = float(fetched_at)
        # allow seconds
        if t < 1e12:
            t *= 1000
    except (TypeError, ValueError):
        return 55
    age_min = max(0.0, (now - t) / 60000.0)
    if age_min <= 10:
        return 100
    if age_min <= 30:
        return 94
    if age_min <= 60:
        return 88
    if age_min <= 180:
        return 72
    if age_min <= 360:
        return 55
    if age_min <= 720:
        return 38
    if age_min <= 1440:
        return 22
    return 10


def level_from_score(score: int) -> str:
    if score >= 75:
        return "HIGH"
    if score >= 50:
        return "MEDIUM"
    return "LOW"


def extract_model_scalars(m: Any) -> Optional[Dict[str, Any]]:
    if not m:
        return None
    if isinstance(m, dict):
        d = m
    else:
        d = m.model_dump(by_alias=True) if hasattr(m, "model_dump") else dict(m)

    if not (d.get("available") or d.get("ok")):
        # still allow if explicitly missing flags but has id+data
        if not (d.get("current") or d.get("next24h") or d.get("currentTemp") is not None):
            return None

    mid = d.get("id") or d.get("source_model") or "unknown"
    short = d.get("short") or mid
    cur = d.get("current") or {}
    n24 = d.get("next24h") or {}
    today = d.get("today") or {}

    temp = (
        num(n24.get("temp_mean"))
        or num(n24.get("tempMean"))
        or num(cur.get("temperature"))
        or num(d.get("temperature"))
        or num(d.get("currentTemp"))
        or num(d.get("current_temp"))
    )
    pop = (
        num(n24.get("pop_max"))
        or num(n24.get("popMax"))
        or num(today.get("precipitation_probability_max"))
        or num(today.get("pop"))
        or num(cur.get("precipitation_probability"))
        or num(d.get("precipitation_probability"))
    )
    rain = (
        num(n24.get("rain_sum"))
        or num(n24.get("rainSum"))
        or num(today.get("precipitation_sum"))
        or num(today.get("rain"))
        or num(cur.get("precipitation"))
        or num(d.get("precipitation"))
    )
    wind = (
        num(cur.get("wind_speed"))
        or num(d.get("wind_speed"))
        or num(d.get("currentWind"))
        or num(today.get("wind_speed_max"))
    )
    return {"id": mid, "short": short, "temp": temp, "pop": pop, "rain": rain, "wind": wind}


def build_model_agreement(models: List[Any]) -> Dict[str, Any]:
    rows = [r for r in (extract_model_scalars(m) for m in models or []) if r]

    def by_var(key: str) -> Dict[str, Any]:
        values = {}
        for r in rows:
            if r.get(key) is not None:
                values[r["id"]] = r[key]
        lst = list(values.values())
        return {
            "values": values,
            "count": len(lst),
            "mean": mean_of(lst),
            "spread": spread_of(lst),
            "models": list(values.keys()),
        }

    temperature = by_var("temp")
    precipitation_probability = by_var("pop")
    precipitation = by_var("rain")
    wind_speed = by_var("wind")

    temperature["unit"] = "°C"
    precipitation_probability["unit"] = "pp"
    precipitation["unit"] = "mm"
    wind_speed["unit"] = "km/h"

    n = len(rows)
    if n == 0:
        agreement_level = "none"
    elif n == 1:
        agreement_level = "single"
    else:
        t = temperature["spread"]
        p = precipitation_probability["spread"]
        w = wind_speed["spread"]
        if (t is None or t <= 1.5) and (p is None or p <= 10) and (w is None or w <= 8):
            agreement_level = "high"
        elif (t is None or t <= 3.0) and (p is None or p <= 25) and (w is None or w <= 15):
            agreement_level = "moderate"
        else:
            agreement_level = "low"

    return {
        "modelCount": n,
        "modelsUsed": [r["id"] for r in rows],
        "labels": {r["id"]: r["short"] for r in rows},
        "temperature": temperature,
        "precipitation_probability": precipitation_probability,
        "precipitation": precipitation,
        "wind_speed": wind_speed,
        "agreementLevel": agreement_level,
    }


def calculate_forecast_confidence(input_data: Dict[str, Any]) -> Dict[str, Any]:
    now_ms = num(input_data.get("nowMs") or input_data.get("now_ms")) or (time.time() * 1000)
    horizon_hours = num(input_data.get("horizonHours") or input_data.get("horizon_hours")) or 24
    live = input_data.get("live", True) is not False
    models = input_data.get("models") or []

    agreement = build_model_agreement(models)
    n = agreement["modelCount"]
    reasons: List[str] = []
    factors: Dict[str, Any] = {}

    s_avail = availability_score(n)
    factors["availability"] = {"score": s_avail, "modelCount": n, "weight": 0.15}

    s_temp = score_from_spread(
        agreement["temperature"]["spread"],
        TEMP_SPREAD_TABLE,
        missing_score=50 if n >= 2 else None,
    )
    factors["temperature_spread"] = {
        "score": s_temp,
        "spread_C": agreement["temperature"]["spread"],
        "mean_C": agreement["temperature"]["mean"],
        "values": agreement["temperature"]["values"],
        "weight": 0.25,
    }

    s_pop = score_from_spread(
        agreement["precipitation_probability"]["spread"],
        POP_SPREAD_TABLE,
        missing_score=52 if n >= 2 else None,
    )
    factors["precipitation_probability_spread"] = {
        "score": s_pop,
        "spread_pp": agreement["precipitation_probability"]["spread"],
        "mean_pp": agreement["precipitation_probability"]["mean"],
        "values": agreement["precipitation_probability"]["values"],
        "weight": 0.25,
    }

    s_rain = score_from_spread(
        agreement["precipitation"]["spread"],
        RAIN_SPREAD_TABLE,
        missing_score=55 if n >= 2 else None,
    )
    factors["precipitation_spread"] = {
        "score": s_rain,
        "spread_mm": agreement["precipitation"]["spread"],
        "mean_mm": agreement["precipitation"]["mean"],
        "values": agreement["precipitation"]["values"],
        "weight": 0.10,
    }

    s_wind = score_from_spread(
        agreement["wind_speed"]["spread"],
        WIND_SPREAD_TABLE,
        missing_score=55 if n >= 2 else None,
    )
    factors["wind_spread"] = {
        "score": s_wind,
        "spread_kmh": agreement["wind_speed"]["spread"],
        "mean_kmh": agreement["wind_speed"]["mean"],
        "values": agreement["wind_speed"]["values"],
        "weight": 0.05,
    }

    s_horizon = horizon_score(horizon_hours)
    factors["horizon"] = {"score": s_horizon, "hours": horizon_hours, "weight": 0.10}

    s_fresh = freshness_score(input_data.get("fetchedAt") or input_data.get("fetched_at"), now_ms)
    factors["freshness"] = {
        "score": s_fresh,
        "fetchedAt": input_data.get("fetchedAt") or input_data.get("fetched_at"),
        "weight": 0.10,
    }

    # Weighted blend over available factor scores
    weighted = []
    for key, fac in factors.items():
        sc = fac.get("score")
        w = fac.get("weight") or 0
        if sc is not None and w > 0:
            weighted.append((float(sc), float(w)))

    if not weighted:
        score = 25
        reasons.append("No usable model scalars — confidence floor")
    else:
        tw = sum(w for _, w in weighted)
        score = int(round(sum(sc * w for sc, w in weighted) / tw)) if tw else 25

    if not live:
        score = min(score, 40)
        reasons.append("Non-live pack — confidence capped")

    if n <= 1:
        score = min(score, 55)
        reasons.append("Single-model or empty ensemble — not multi-model consensus")
    elif agreement["agreementLevel"] == "high":
        reasons.append("Strong multi-model agreement on temperature and POP")
    elif agreement["agreementLevel"] == "low":
        score = min(score, score)  # no boost
        reasons.append("Wide model spread — lower confidence")

    if s_fresh is not None and s_fresh < 50:
        reasons.append("Stale fetch age reduces confidence")
    if s_horizon is not None and s_horizon < 60:
        reasons.append("Longer forecast horizon reduces confidence")

    score = int(clamp(score, 0, 100))
    level = level_from_score(score)

    formula = (
        "score = weighted_mean(availability 0.15, temp_spread 0.25, pop_spread 0.25, "
        "rain_spread 0.10, wind_spread 0.05, horizon 0.10, freshness 0.10); "
        "caps: !live→≤40, modelCount≤1→≤55"
    )

    return {
        "engine": "weathergpt.confidence.v1",
        "score": score,
        "level": level,
        "reasons": reasons,
        "modelAgreement": agreement,
        "factors": factors,
        "formula": formula,
        "live": live,
    }
