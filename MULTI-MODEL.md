# Multi-model NWP architecture (WeatherGPT)

**Principle:** Weather data is the source of truth. AI never invents values.  
**Date:** 2026-08-29

## Data flow

```
Browser / external client
        │
        │  GET /api/weather?lat&lon     GET /api/models?lat&lon
        │  (7-day primary + alerts)     (full multi-model detail)
        ▼
 Vercel / local-api  (api/weather.js · api/models.js)
        │
        ▼
 api/_lib/multiModel.js
   · MODEL_CATALOG
   · fetchOneModel × N  (parallel Open-Meteo ?models=)
   · normalizeObservation → common schema
   · aggregateMultiModel → ensemble + honesty flags
        │
        ▼
 Open-Meteo Forecast API (single upstream vendor, many NWP ids)
```

**Frontend rule:** Do **not** fan-out multiple weather model URLs from the browser.  
`src/services/climate.js` → `/api/models` only.  
`src/services/weather.js` consumes optional `multi_model` on the proxy pack.

## Models (Open-Meteo ids)

| id | Label | Notes |
|----|--------|--------|
| `best_match` | Blend | Primary UI source of truth |
| `ecmwf_ifs025` | ECMWF IFS 0.25° | Classic IFS open data |
| `gfs_seamless` | GFS (NCEP) | Seamless stack |
| `icon_seamless` | ICON (DWD) | Seamless stack |
| `ecmwf_aifs025_single` | ECMWF AIFS | AI IFS; **POP often null** (kept null) |

Invalid / down models → `available: false`, `current: null`, error string — **never faked**.

## Common observation schema

```json
{
  "location": { "name", "lat", "lon", "timezone", "elevation_m" },
  "timestamp": "ISO-like local time from model",
  "temperature": 26.4,
  "apparent_temperature": 32.9,
  "precipitation_probability": 55,
  "precipitation": 0.1,
  "wind_speed": 6.4,
  "wind_direction": 280,
  "humidity": 97,
  "cloud_cover": 100,
  "weather_code": 61,
  "source_model": "best_match",
  "meta": {
    "model_name": "Best match (Open-Meteo blend)",
    "model_id": "best_match",
    "provider": "Open-Meteo",
    "forecast_timestamp": "...",
    "model_run_time": null,
    "source": "Open-Meteo Forecast API",
    "fetched_at": "...",
    "variable_notes": null
  }
}
```

`model_run_time` is null on free Open-Meteo forecast responses (not invented).

## Honesty modes

| `multi_model_mode` | Meaning |
|--------------------|---------|
| `multi` | ≥2 models usable; ensemble spread/agreement meaningful |
| `single` | Exactly one usable model — **not** consensus |
| `none` | Zero usable models |

## Fallback

1. **Primary 7-day forecast** (`/api/weather`): Open-Meteo default → retry tz=auto → simple `current_weather` schema. Unchanged offline path on client.
2. **Multi-model attach** fails → weather still returns live forecast; `multi_model.ok=false` or omit with `multimodel=0`.
3. **`/api/models` down** (static host): client single `best_match` call labelled `multi_model_mode: "single"`.
4. **Per-model failure**: row stays in `models[]` / `unavailable[]` with error.

## Endpoints

- `GET /api/models?lat=&lon=&name=&tz=` — full engine  
- `GET /api/models?models=gfs_seamless` — subset (still server-side)  
- `GET /api/models?probe=unavailable` — test invalid id  
- `GET /api/weather?...&multimodel=1` (default) — compact `multi_model` summary  
- `GET /api/weather?...&multimodel=0` — primary only  

## Tests

```bash
node scripts/smoke-multi-model.mjs
node scripts/local-api-server.mjs   # then curl /api/models & /api/weather
```
