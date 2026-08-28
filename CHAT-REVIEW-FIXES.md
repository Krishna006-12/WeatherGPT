# Chat Review — 12-point fixes (2026-08-27)

Implements the WeatherGPT chat review architecture:

**Weather API → Locked facts JSON → Rule engine → LLM explains (no invented numbers)**

| # | Issue | Fix |
|---|--------|-----|
| 1 | Inconsistent numbers | `buildLockedWeatherFacts()` fingerprint; LLM gets `LOCKED_WEATHER_FACTS` only |
| 2 | 7-day fallback mix | Single `parseWeather` pack + facts; offline pack also locks facts |
| 3 | WMO over-read (hail) | `wmoInfoHonest`: 95 no hail; 96/99 hail *possible* (model), not guaranteed; alerts modelled |
| 4 | Rain metrics conflated | Separate `probability_pct`, `amount_mm`, `intensity` on daily + rain answers |
| 5 | Irrigation without soil/stage | Disclaimer weather-proxy; `irrigationFlags()` |
| 6 | Wheat in August | `CROP_CALENDAR` + `cropSeasonCheck()` mismatch banner |
| 7 | Disease jumps | `diseaseRiskNotes()` → "conditions may favour" only |
| 8 | Blanket chemical ban | `chemicalWindowAdvice()` conditional + check label |
| 9 | Incomplete city compare | `compareCities()` requires complete packs |
| 10 | Best crop now | `bestCropsNow()` rule engine first |
| 11 | Vague sources | Open-Meteo Forecast API + model + IMD-not-ingested honesty |
| 12 | Hindi drift | Same locked JSON; prompt forbids recalculating on translate |

## Key files
- `src/services/ruleEngine.js` — tables, calendar, facts, compare, best-crop
- `src/services/weather.js` — honest WMO, intensity, sources, `pack.facts`
- `src/services/ai.js` — crop/rain answers, source footer, best-crop intent
- `api/chat.js` — stronger grounding + locked tool JSON

## Demo checks
1. Same city twice → same temp/pop/mm (fingerprint stable for pack).
2. WMO 95 → thunderstorm, **not** "hail guaranteed".
3. "wheat" in August → **season mismatch** flag.
4. Rain answer shows probability / mm / intensity separately.
5. Hindi question → same numbers as English for same pack.
