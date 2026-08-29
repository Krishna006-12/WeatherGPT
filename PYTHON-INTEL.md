# Python Intelligence — architecture & ops

## Goal

Introduce a **Python FastAPI** service for future intelligence/ML **without** rewriting the frontend or moving working weather/chat off Node.

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────────────┐
│ React + Vite│────▶│ Node api/* (Vercel)  │────▶│ Open-Meteo / LLM keys   │
│  (unchanged)│     │ weather, chat, models│     │ GEMINI/GROQ server-only │
└─────────────┘     │ + optional /api/intel│──┐  └─────────────────────────┘
                    └──────────────────────┘  │
                                              ▼
                                   ┌──────────────────────┐
                                   │ python-intel FastAPI │
                                   │ :8090  /v1/*         │
                                   │ preprocess, compare, │
                                   │ confidence, crop     │
                                   └──────────────────────┘
```

## Data flow (Node/JS ↔ Python)

1. **Primary path (today):** Browser → Node `api/weather.js` / `api/models.js` / `api/chat.js` → Open-Meteo + optional LLM. Deterministic engines in `api/_lib/*`.
2. **Optional intel path:** Browser or server job → `POST /api/intel` with `{ op, ... }` → Node adds `X-Intel-Key` → Python `/v1/{op}` → JSON facts/features back.
3. **Facts vs LLM:** Python returns structured numbers + keys only. Phrasing/LLM remains Node `api/chat.js` + `grounding.js` (`verified_context`).
4. **Failure:** If `INTEL_BASE_URL` unset or Python down → `/api/intel` returns **503** `intel_unconfigured` / `intel_proxy_error`. UI and Node engines **keep working**.

## API schema (Python)

### Common error

```json
{
  "ok": false,
  "error": "human message",
  "code": "validation_error|unauthorized|timeout|intel_error|internal_error",
  "detail": null,
  "schema_version": "weathergpt.intel.v1"
}
```

### `POST /v1/preprocess`

**Request**

```json
{
  "pack": {
    "location": { "name": "Kanpur", "lat": 26.45, "lon": 80.33, "id": "kanpur" },
    "current": { "temp": 32.4, "humidity": 62, "wind": 14, "pop": 40, "code": 2 },
    "daily": [{ "date": "2026-08-29", "max": 34, "min": 26, "rain": 2.5, "pop": 55 }],
    "hourly": [{ "time": "…", "temp": 31, "pop": 20 }],
    "fetchedAt": 1725000000000,
    "source": "open-meteo-direct",
    "live": true
  }
}
```

**Response (abbrev.)**

```json
{
  "ok": true,
  "engine": "weathergpt.preprocess.v1",
  "facts": {
    "schema_version": "weathergpt.weather_facts.v1",
    "location": {},
    "current": { "temperature_c": 32.4 },
    "daily_summary": [],
    "hourly_summary": [],
    "derived": {},
    "allowed_numbers": [32.4, 62, …]
  },
  "features": { "rain_sum_next3d_mm": 2.5, "temp_mean_next24h_c": … },
  "warnings": []
}
```

### `POST /v1/compare-models`

**Request:** `{ "location": {…}, "models": [ {/* multiModel row */} ], "horizonHours": 24 }`  
**Response:** `agreement`, `ensemble` (means/spreads/mode), `per_model` deltas.

### `POST /v1/confidence`

**Request:** `{ "models": […], "fetchedAt", "nowMs", "horizonHours", "live" }`  
**Response:** `{ score, level, reasons, model_agreement, factors, formula, engine: "weathergpt.confidence.v1" }`  
Parity with `api/_lib/confidenceEngine.js` (caps: `!live→≤40`, single model `≤55`).

### `POST /v1/crop-features`

**Request:** `{ "pack": {…}, "crop": "wheat", "lang": "en"|"hi" }`  
**Response:** `weather_features`, `agronomic_flags`, `suitability` (score/band/reasons), `advice_keys`, `disclaimers` — **no yield guarantees**.

### BFF `POST /api/intel`

```json
{ "op": "confidence", "models": […], "live": true, "nowMs": 1e12 }
```

`op`: `preprocess` | `compare-models` | `confidence` | `crop-features` | `health` | `capabilities`

## Deployment requirements

| Component | Requirement |
|-----------|-------------|
| **Frontend** | Unchanged Vite build → static `dist` on Vercel |
| **Node api** | Existing serverless; add env `INTEL_BASE_URL`, optional `INTEL_SERVICE_KEY` |
| **Python** | Python **3.11+**, `pip install -r python-intel/requirements.txt`, process manager (systemd, Docker, Railway, Fly, Cloud Run, Render) |
| **Network** | Node must reach Python over private URL; do **not** expose Python publicly without `INTEL_SERVICE_KEY` |
| **Secrets** | `GEMINI_API_KEY` / `GROQ_*` stay on **Node** chat only; Python v0.1 needs **no** LLM keys |
| **Resources** | v0.1 is CPU-light (no GPU); 256MB–512MB enough |

### Example Docker (optional)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV INTEL_HOST=0.0.0.0 INTEL_PORT=8090
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
```

### Local full stack

```bash
# terminal 1
cd python-intel && source .venv/bin/activate && uvicorn app.main:app --port 8090

# terminal 2
export INTEL_BASE_URL=http://127.0.0.1:8090
npm run api   # or vercel dev
npm run dev
```

## Tests

```bash
cd python-intel && pytest -q
```

Coverage: health, preprocess validation/determinism, model compare, confidence caps, crop aliases, auth 401 when key set.

## Failure behavior

| Failure | Behavior |
|---------|----------|
| Bad JSON / Pydantic | **422** `validation_error` |
| Wrong/missing `X-Intel-Key` when configured | **401** `unauthorized` |
| Handler exceeds `INTEL_REQUEST_TIMEOUT_S` | **504** `timeout` |
| Unhandled exception | **500** `internal_error` (type name only, no stack/env) |
| Node `INTEL_BASE_URL` missing | **503** `intel_unconfigured` — app OK |
| Python process down | Node proxy **503** / **504** — weather/chat OK |
| Empty model list confidence | Score low / single-model rules — still `ok: true` |

## Boundaries (do not violate)

1. Do not migrate the entire project to Python.  
2. Do not put LLM secrets in Vite `VITE_*` or Python responses.  
3. Do not mark synthetic/demo weather as live facts.  
4. Keep `WeatherFacts.allowed_numbers` separate from any future LLM text.  
5. ML models = future work under `app/services/`; v0.1 flag `ml_enabled: false`.
