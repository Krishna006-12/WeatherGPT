# Forecast Confidence Engine

**Engine id:** `weathergpt.confidence.v1`  
**Rule:** Deterministic math only. **LLM never sets the score. No `Math.random`.**

## Formula

```
raw = Σ (factor_score × weight) / Σ (weight over factors with a numeric score)

score = round( clamp(raw, 0, 100) )

// Hard caps (applied in order):
if modelCount == 0:           score = 0
if modelCount == 1:           score = min(score, 62)
if !live:                     score = min(score, 40)

level =
  HIGH   if score ≥ 75  (but single-model never HIGH → MEDIUM)
  MEDIUM if score ≥ 50
  LOW    otherwise
```

### Factor weights

| Factor | Weight | How score is derived |
|--------|--------|----------------------|
| Model availability | 0.15 | 0→0, 1→38, 2→62, 3→78, 4→90, 5+→100 |
| Temperature spread (°C, 24h mean) | 0.25 | piecewise: ≤0.8→100 … ≥10→10 |
| POP spread (pp) | 0.25 | piecewise: ≤5→100 … ≥50→12 |
| Rain amount spread (mm/24h) | 0.10 | piecewise: ≤1→100 … ≥40→10 |
| Wind speed spread (km/h) | 0.10 | piecewise: ≤2→100 … ≥30→12 |
| Forecast horizon (h) | 0.08 | ≤6→98 … ≤24→88 … ≤120→42 … >168→18 |
| Data freshness | 0.07 | age &lt;10m→100 … &gt;24h→10; unknown→55 |

**Missing spreads** (e.g. only one POP value because AIFS is null): that factor is **omitted** from the weighted average — never filled with a fake number.

### Per-model inputs

From each available model (nulls skipped):

- temp ← `next24h.temp_mean` else current temperature  
- pop ← `next24h.pop_max` else today POP else current POP  
- rain ← `next24h.rain_sum` else today precip sum  
- wind ← current wind_speed  

## Output schema

```json
{
  "engine": "weathergpt.confidence.v1",
  "score": 0,
  "level": "HIGH | MEDIUM | LOW",
  "reasons": ["…"],
  "modelAgreement": {
    "modelCount": 4,
    "modelsUsed": ["ecmwf_ifs025", "gfs_seamless", "…"],
    "agreementLevel": "high | moderate | low | single | none",
    "temperature": { "values": {}, "mean": 28.1, "spread": 0.4, "unit": "°C" },
    "precipitation_probability": { "values": {}, "mean": 78.8, "spread": 5, "unit": "pp" },
    "precipitation": { "values": {}, "mean": 5, "spread": 0, "unit": "mm" },
    "wind_speed": { "values": {}, "mean": 10.2, "spread": 1.5, "unit": "km/h" }
  },
  "factors": { "…sub-scores + weights…" },
  "formula": "…",
  "meta": {
    "deterministic": true,
    "llm_decides": false,
    "random": false
  }
}
```

Attached on:

- `GET /api/models` → `confidence`
- `GET /api/weather` → top-level `confidence` + `multi_model.confidence`
- Client weather pack → `pack.confidence` (server value only; offline pack fixed LOW)
- Locked facts → `facts.meta.confidence` (score/level/reasons for LLM **copy-only**)

## Examples

### Strong POP agreement (brief example)

| Model | POP |
|-------|-----|
| ECMWF | 81% |
| GFS | 76% |
| ICON | 80% |
| AIFS | 78% |

→ POP spread = **5 pp**, tight temps → typically **HIGH** (score ≥ 75).

### Single model

One available run → score **≤ 62**, level **MEDIUM or LOW**, never HIGH.  
Reason includes “Single-model forecast only”.

### Offline

`live: false` → score **≤ 40**, level LOW/MEDIUM.

## Edge cases

| Case | Behavior |
|------|----------|
| 0 models | score 0, LOW |
| 1 model | cap 62, never HIGH |
| AIFS null POP | excluded from POP spread; other models still used |
| All POP null | POP factor omitted from average |
| Stale fetch (&gt;6 h) | freshness factor drops |
| Horizon 5–7 days | horizon factor drops |
| Same inputs twice | **identical** score/level/reasons structure |

## Tests

```bash
node scripts/smoke-confidence.mjs
```

## Files

- `api/_lib/confidenceEngine.js` — engine
- `api/_lib/multiModel.js` — attaches `confidence` on aggregate
- `api/weather.js` / `api/models.js` — response schema
- `src/services/weather.js` — pack.confidence
- `src/services/ruleEngine.js` — facts.meta.confidence
- `scripts/smoke-confidence.mjs`
- `CONFIDENCE.md` (this file)
