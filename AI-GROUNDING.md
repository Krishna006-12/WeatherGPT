# WeatherGPT AI grounding architecture

**Core rule:** The AI explains **verified** weather data — it does not generate or guess weather data.

## Pipeline

```
USER message
   │
   ▼
Intent Router  (weather_crop | general)
   │
   ├─ general → Groq→OpenRouter→Gemini→OpenAI → soft validate → rules stub
   │
   └─ weather_crop
         │
         ▼
      Open-Meteo tool pack (real numbers)
         │
         ▼
      buildVerifiedWeatherContext()  ← LOCKED before any LLM
         │
         ├─ isTrivialWeatherQuery? ──yes──► rules + verified context (NO LLM)
         │
         └─ no → LLM (Groq→OpenRouter→Gemini→OpenAI)
                    system = groundingSystemPrompt (never invent…)
                    user   = VERIFIED_WEATHER_CONTEXT JSON
                         │
                         ▼
                    validateGroundedResponse()
                         │
                    fail? → 1× stricter retry
                         │
                    still fail / quota / provider error
                         │
                         ▼
                    deterministicAnswer(rules + Open-Meteo)
```

Provider order **unchanged:** Groq → OpenRouter → Gemini → OpenAI → rules.

## Verified context schema (`weathergpt.verified_context.v1`)

```json
{
  "schema": "weathergpt.verified_context.v1",
  "locked": true,
  "location": { "name", "lat", "lon", "timezone" },
  "currentWeather": {
    "temperature_c", "apparent_temperature_c", "humidity_pct",
    "wind_speed_kmh", "precipitation_mm", "weather_code", "…"
  },
  "hourlyForecast": [ { "time", "temperature_c", "precipitation_probability_pct", "…" } ],
  "dailyForecast": [ { "date", "temperature_max_c", "precipitation_probability_pct", "…" } ],
  "precipitation": { "today_probability_pct", "today_sum_mm", "fields_separated": true },
  "wind": { "speed_kmh", "direction_deg" },
  "alerts": [ { "kind", "severity", "official", "source", "reason" } ],
  "modelConsensus": { "mode", "available_count", "temp_spread_c", "…" },
  "confidence": { "score", "level", "engine" },
  "cropContext": { "crop_id" } | null,
  "limitations": [ "…" ],
  "fingerprint": "…"
}
```

Returned on `POST /api/chat` as `verified_context` for weather routes.

## LLM instructions (hard)

- Never invent weather values / forecast probabilities / alerts  
- Never claim official IMD/NDMA warning unless `alerts[].official === true`  
- Never override deterministic confidence or risk thresholds  
- Copy digits from context only; Hindi = same numbers  

## Validation behavior

| Check | Fail reason |
|-------|-------------|
| Empty / too short / truncated | `empty`, `too_short`, `truncated_*` |
| `undefined` / `NaN` | `malformed_tokens` |
| °C / % / mm / km/h not in allowlist | `ungrounded_numbers` |
| “IMD official warning” without official alert | `fake_official_warning` |
| Weather Q with no digits | `missing_grounded_numbers` |

On fail: **one** stricter retry → else **rules fallback**.

## Trivial queries (LLM skipped)

Examples: current temperature, humidity, wind speed, rain probability, sunrise/sunset, simple condition.

Complex (LLM OK): travel advice, crop impact, multi-factor interpretation, natural-language explanation.

## Tests

```bash
node scripts/smoke-grounding.mjs
```

## Files

- `api/_lib/grounding.js`
- `api/chat.js` (wired)
- `scripts/smoke-grounding.mjs`
- `AI-GROUNDING.md`
