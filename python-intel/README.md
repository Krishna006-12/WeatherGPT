# WeatherGPT Python Intelligence Service

**Additive** FastAPI service for future ML / shared deterministic intelligence.  
Does **not** replace React, Vite, Node `api/*` weather, or chat LLM.

## Quick start

```bash
cd python-intel
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8090
```

Health: http://127.0.0.1:8090/health  
Docs:   http://127.0.0.1:8090/docs  

Tests:

```bash
cd python-intel && pytest -q
```

## What it does (v0.1 — no ML weights)

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/preprocess` | Weather pack → locked `WeatherFacts` + numeric features |
| `POST /v1/compare-models` | Ensemble stats from **supplied** NWP rows |
| `POST /v1/confidence` | Deterministic 0–100 confidence (Node engine parity) |
| `POST /v1/crop-features` | Crop×weather flags + suitability keys |
| `GET /health` | Liveness + public config (no secrets) |
| `GET /v1/capabilities` | Machine-readable boundary |

## What it does **not** do

- Does not fetch multi-model upstream by default (Node `/api/models` stays SoT for fetches)
- Does not call Gemini/Groq (LLM stays `api/chat.js`)
- Does not change the React UI
- Does not implement trained ML models yet

## Node bridge

```text
Browser → /api/intel (Vercel Node) → INTEL_BASE_URL (Python)
                 ↑
         INTEL_SERVICE_KEY (server env only)
```

```bash
export INTEL_BASE_URL=http://127.0.0.1:8090
# optional:
export INTEL_SERVICE_KEY=dev-local-key
# and matching INTEL_SERVICE_KEY in python-intel/.env
```

`GET /api/intel` → BFF status even when Python is down.

## Env

See `.env.example`. Never put `GEMINI_API_KEY` in frontend env.
