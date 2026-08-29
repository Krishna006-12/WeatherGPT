"""
Crop × weather feature extraction — deterministic flags for future ML / rules.
No yield guarantees. No chem prescriptions. No LLM prose.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from app.schemas import CropFeaturesRequest
from app.services.mathutil import num, round_n
from app.services.preprocess import preprocess_pack

# Extensible vocab — mirror product crop ids lightly
CROP_ALIASES = {
    "wheat": "wheat",
    "gehun": "wheat",
    "गेहूं": "wheat",
    "rice": "rice",
    "paddy": "rice",
    "chawal": "rice",
    "धान": "rice",
    "चावल": "rice",
    "maize": "maize",
    "makka": "maize",
    "corn": "maize",
    "sugarcane": "sugarcane",
    "ganna": "sugarcane",
    "mustard": "mustard",
    "sarson": "mustard",
    "cotton": "cotton",
    "potato": "potato",
    "aloo": "potato",
    "tomato": "tomato",
    "onion": "onion",
    "soybean": "soybean",
    "pulses": "pulses",
    "gram": "pulses",
    "vegetables": "vegetables",
}

CROP_META = {
    "wheat": {"name_en": "Wheat", "name_hi": "गेहूं", "optimal_tmax": (18, 28), "water_sensitive": True},
    "rice": {"name_en": "Rice", "name_hi": "धान", "optimal_tmax": (24, 35), "water_sensitive": True},
    "maize": {"name_en": "Maize", "name_hi": "मक्का", "optimal_tmax": (20, 32), "water_sensitive": True},
    "sugarcane": {"name_en": "Sugarcane", "name_hi": "गन्ना", "optimal_tmax": (26, 36), "water_sensitive": True},
    "mustard": {"name_en": "Mustard", "name_hi": "सरसों", "optimal_tmax": (15, 28), "water_sensitive": False},
    "cotton": {"name_en": "Cotton", "name_hi": "कपास", "optimal_tmax": (25, 35), "water_sensitive": True},
    "potato": {"name_en": "Potato", "name_hi": "आलू", "optimal_tmax": (15, 25), "water_sensitive": True},
    "tomato": {"name_en": "Tomato", "name_hi": "टमाटर", "optimal_tmax": (18, 30), "water_sensitive": True},
    "onion": {"name_en": "Onion", "name_hi": "प्याज", "optimal_tmax": (18, 30), "water_sensitive": True},
    "soybean": {"name_en": "Soybean", "name_hi": "सोयाबीन", "optimal_tmax": (22, 32), "water_sensitive": True},
    "pulses": {"name_en": "Pulses", "name_hi": "दालें", "optimal_tmax": (18, 30), "water_sensitive": False},
    "vegetables": {"name_en": "Vegetables", "name_hi": "सब्जियाँ", "optimal_tmax": (18, 32), "water_sensitive": True},
}


def resolve_crop(raw: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not raw:
        return None, None
    q = str(raw).strip().lower()
    cid = CROP_ALIASES.get(q) or CROP_ALIASES.get(q.split()[0] if q else "")
    if not cid and q in CROP_META:
        cid = q
    if not cid:
        # fuzzy contains
        for k, v in CROP_ALIASES.items():
            if k in q or q in k:
                cid = v
                break
    if not cid:
        return None, raw
    meta = CROP_META.get(cid, {})
    return cid, meta.get("name_en") or cid


def extract_crop_features(req: CropFeaturesRequest) -> Dict[str, Any]:
    pre = preprocess_pack(req.pack)
    facts = pre["facts"]
    feat = pre["features"]
    current = facts.get("current") or {}

    crop_id, crop_name = resolve_crop(req.crop)
    meta = CROP_META.get(crop_id or "", {})

    t = current.get("temperature_c")
    rh = current.get("humidity_pct")
    wind = current.get("wind_speed_kmh")
    rain3 = feat.get("rain_sum_next3d_mm")
    rain7 = feat.get("rain_sum_next7d_mm")
    pop24 = feat.get("pop_max_next24h_pct")
    tmax = feat.get("tmax_week_c")
    tmin = feat.get("tmin_week_c")

    flags: Dict[str, Any] = {
        "heat_stress_risk": bool(t is not None and t >= 38) or bool(tmax is not None and tmax >= 40),
        "cold_stress_risk": bool(t is not None and t <= 5) or bool(tmin is not None and tmin <= 2),
        "high_humidity": bool(rh is not None and rh >= 85),
        "heavy_rain_3d": bool(rain3 is not None and rain3 >= 40),
        "dry_spell_risk": bool(rain7 is not None and rain7 < 5 and (pop24 or 0) < 30),
        "strong_wind": bool(wind is not None and wind >= 40),
        "disease_favoring_moist": bool(rh is not None and rh >= 80 and t is not None and 18 <= t <= 30),
    }

    # Suitability vs crop band (weather-only, not yield)
    opt = meta.get("optimal_tmax") or (18, 32)
    lo, hi = opt
    score = 50
    reasons = []
    if t is not None:
        if lo <= t <= hi:
            score += 20
            reasons.append("temp_in_band")
        elif t < lo - 5 or t > hi + 5:
            score -= 20
            reasons.append("temp_far_from_band")
        else:
            score -= 5
            reasons.append("temp_near_band_edge")
    if flags["heavy_rain_3d"] and meta.get("water_sensitive"):
        score -= 10
        reasons.append("heavy_rain_water_sensitive")
    if flags["dry_spell_risk"] and meta.get("water_sensitive"):
        score -= 8
        reasons.append("dry_spell_water_sensitive")
    if flags["disease_favoring_moist"]:
        score -= 5
        reasons.append("moist_disease_window")
    score = max(0, min(100, score))

    if score >= 70:
        band = "favorable"
    elif score >= 45:
        band = "mixed"
    else:
        band = "challenging"

    advice_keys: List[str] = ["weather_only_context"]
    if flags["heavy_rain_3d"]:
        advice_keys.append("hold_irrigation_if_soaked")
    if flags["dry_spell_risk"]:
        advice_keys.append("monitor_soil_moisture")
    if flags["heat_stress_risk"]:
        advice_keys.append("heat_stress_caution")
    if flags["disease_favoring_moist"]:
        advice_keys.append("disease_may_favor_scout")
    if flags["strong_wind"]:
        advice_keys.append("wind_lodging_caution")

    disclaimers = [
        "Weather features only — not a yield or damage guarantee.",
        "Chemical / pesticide advice requires label + local extension; not provided here.",
        "Season/crop calendar mismatches are not fully validated in v0.1.",
    ]
    if req.lang == "hi":
        disclaimers = [
            "केवल मौसम फीचर — उपज/नुकसान की गारंटी नहीं।",
            "रसायन सलाह लेबल + स्थानीय कृषि विभाग से; यहाँ नहीं।",
            "सीजन/फसल कैलेंडर v0.1 में पूरी तरह जाँचा नहीं।",
        ]

    weather_features = {
        "temperature_c": t,
        "humidity_pct": rh,
        "wind_speed_kmh": wind,
        "rain_sum_next3d_mm": rain3,
        "rain_sum_next7d_mm": rain7,
        "pop_max_next24h_pct": pop24,
        "tmax_week_c": tmax,
        "tmin_week_c": tmin,
        "heat_index_proxy_c": feat.get("heat_index_proxy_c"),
        "optimal_tmax_band_c": list(opt) if crop_id else None,
    }

    return {
        "ok": True,
        "schema_version": "weathergpt.intel.v1",
        "engine": "weathergpt.crop_features.v1",
        "crop_id": crop_id,
        "crop_name": crop_name,
        "location": facts.get("location"),
        "weather_features": weather_features,
        "agronomic_flags": flags,
        "suitability": {
            "score": score,
            "band": band,
            "reasons": reasons,
            "method": "rules_v1_weather_only",
        },
        "signal_levels": {
            "irrigation": "hold" if flags.get("heavy_rain_3d") else ("favourable" if flags.get("dry_spell_risk") else "moderate"),
            "rainfall_risk": "high" if flags.get("heavy_rain_3d") else ("elevated" if (feat.get("pop_max_next24h_pct") or 0) >= 50 else "low"),
            "disease_fungal": "elevated" if flags.get("disease_favoring_moist") else "low",
            "spraying": "unsuitable" if flags.get("heavy_rain_3d") or flags.get("strong_wind") else "caution",
            "harvest": "caution" if flags.get("heavy_rain_3d") else "moderate",
            "sowing": "moderate",
            "heat_cold_stress": "elevated" if flags.get("heat_stress_risk") or flags.get("cold_stress_risk") else "low",
        },
        "certainty": "signal_only",
        "note": "Mirror of JS cropSignals philosophy — Node src/services/cropSignals.js is primary for UI chat.",
        "advice_keys": advice_keys,
        "disclaimers": disclaimers,
        "facts_ref": {
            "allowed_numbers": facts.get("allowed_numbers"),
            "as_of": facts.get("as_of"),
            "source": facts.get("source"),
        },
    }
