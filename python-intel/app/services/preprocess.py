"""
Weather-data preprocessing — normalize packs → locked WeatherFacts + numeric features.
No LLM. No invented observations.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.schemas import WeatherFacts, WeatherPackIn
from app.services.mathutil import mean_of, num, round_n, unique_floats


def _loc_dict(pack: WeatherPackIn) -> Dict[str, Any]:
    loc = pack.location
    return {
        "id": loc.id,
        "name": loc.name,
        "lat": loc.lat,
        "lon": loc.lon,
        "tz": loc.tz or "auto",
        "countryCode": loc.country_code,
    }


def _current_dict(cur) -> Dict[str, Any]:
    if not cur:
        return {}
    d = cur.model_dump(by_alias=False, exclude_none=True)
    # stable keys
    return {
        "temperature_c": num(d.get("temperature")),
        "apparent_temperature_c": num(d.get("apparent_temperature")),
        "humidity_pct": num(d.get("humidity")),
        "wind_speed_kmh": num(d.get("wind_speed")),
        "wind_direction_deg": num(d.get("wind_direction")),
        "precipitation_mm": num(d.get("precipitation")),
        "precipitation_probability_pct": num(d.get("precipitation_probability")),
        "weather_code": d.get("weather_code"),
        "pressure_msl_hpa": num(d.get("pressure_msl")),
        "cloud_cover_pct": num(d.get("cloud_cover")),
        "visibility_m": num(d.get("visibility")),
        "is_day": d.get("is_day"),
        "time": d.get("time"),
    }


def _daily_rows(daily) -> List[Dict[str, Any]]:
    out = []
    for row in daily or []:
        d = row.model_dump(by_alias=False, exclude_none=True)
        out.append(
            {
                "date": d.get("date"),
                "tmax_c": num(d.get("temperature_2m_max")),
                "tmin_c": num(d.get("temperature_2m_min")),
                "precip_mm": num(d.get("precipitation_sum")),
                "pop_pct": num(d.get("precipitation_probability_max")),
                "wind_max_kmh": num(d.get("wind_speed_10m_max")),
                "weather_code": d.get("weather_code"),
                "uv_max": num(d.get("uv_index_max")),
            }
        )
    return out[:7]


def _hourly_rows(hourly) -> List[Dict[str, Any]]:
    out = []
    for row in (hourly or [])[:48]:
        d = row.model_dump(by_alias=False, exclude_none=True)
        out.append(
            {
                "time": d.get("time"),
                "temp_c": num(d.get("temperature_2m")),
                "precip_mm": num(d.get("precipitation")),
                "pop_pct": num(d.get("precipitation_probability")),
                "weather_code": d.get("weather_code"),
                "wind_kmh": num(d.get("wind_speed_10m")),
            }
        )
    return out


def derive_features(current: Dict[str, Any], daily: List[Dict[str, Any]], hourly: List[Dict[str, Any]]) -> Dict[str, Any]:
    temps_h = [h["temp_c"] for h in hourly if h.get("temp_c") is not None]
    pops_h = [h["pop_pct"] for h in hourly if h.get("pop_pct") is not None]
    rain_d = [d["precip_mm"] for d in daily if d.get("precip_mm") is not None]
    pop_d = [d["pop_pct"] for d in daily if d.get("pop_pct") is not None]
    tmax = [d["tmax_c"] for d in daily if d.get("tmax_c") is not None]
    tmin = [d["tmin_c"] for d in daily if d.get("tmin_c") is not None]

    next24_temps = temps_h[:24]
    heat_index_proxy = None
    t = current.get("temperature_c")
    rh = current.get("humidity_pct")
    if t is not None and rh is not None:
        # simple HI-like blend (not full NWS HI) — labeled proxy
        heat_index_proxy = round_n(t + 0.05 * max(0, rh - 40), 1)

    rain_next3d = round_n(sum(rain_d[:3]), 1) if rain_d else None
    rain_next7d = round_n(sum(rain_d[:7]), 1) if rain_d else None

    return {
        "temp_mean_next24h_c": mean_of(next24_temps),
        "temp_min_next24h_c": round_n(min(next24_temps), 1) if next24_temps else None,
        "temp_max_next24h_c": round_n(max(next24_temps), 1) if next24_temps else None,
        "pop_max_next24h_pct": round_n(max(pops_h[:24]), 0) if pops_h else None,
        "pop_mean_next24h_pct": mean_of(pops_h[:24]),
        "rain_sum_next3d_mm": rain_next3d,
        "rain_sum_next7d_mm": rain_next7d,
        "tmax_week_c": round_n(max(tmax), 1) if tmax else None,
        "tmin_week_c": round_n(min(tmin), 1) if tmin else None,
        "pop_max_week_pct": round_n(max(pop_d), 0) if pop_d else None,
        "heat_index_proxy_c": heat_index_proxy,
        "wind_speed_kmh": current.get("wind_speed_kmh"),
        "humidity_pct": current.get("humidity_pct"),
        "sample_counts": {
            "hourly": len(hourly),
            "daily": len(daily),
            "hourly_temp": len(temps_h),
        },
    }


def collect_allowed_numbers(current: Dict, daily: List, hourly: List, features: Dict) -> List[float]:
    vals: List[Optional[float]] = []
    for k, v in current.items():
        if isinstance(v, (int, float)):
            vals.append(float(v))
    for row in daily + hourly:
        for v in row.values():
            if isinstance(v, (int, float)):
                vals.append(float(v))
    for k, v in features.items():
        if isinstance(v, (int, float)):
            vals.append(float(v))
    return unique_floats(vals, ndigits=2)


def preprocess_pack(pack: WeatherPackIn) -> Dict[str, Any]:
    warnings: List[str] = []
    current = _current_dict(pack.current)
    daily = _daily_rows(pack.daily)
    hourly = _hourly_rows(pack.hourly)

    if not current and not daily:
        warnings.append("empty_pack_no_current_or_daily")

    features = derive_features(current, daily, hourly)
    allowed = collect_allowed_numbers(current, daily, hourly, features)

    facts = WeatherFacts(
        location=_loc_dict(pack),
        as_of=pack.fetched_at,
        source=pack.source,
        live=bool(pack.live) if pack.live is not None else True,
        current=current,
        daily_summary=daily,
        hourly_summary=hourly[:24],
        derived=features,
        allowed_numbers=allowed,
    )

    return {
        "ok": True,
        "schema_version": "weathergpt.intel.v1",
        "engine": "weathergpt.preprocess.v1",
        "facts": facts.model_dump(),
        "features": features,
        "warnings": warnings,
    }
