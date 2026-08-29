# WeatherGPT Alert Architecture

**Schema:** `weathergpt.alerts.v1`  
**Critical rule:** Never represent a WeatherGPT threshold/risk signal as an official government warning. **Never invent IMD/NDMA bulletins.**

## Two concepts

| | OFFICIAL ALERT | WEATHERGPT RISK SIGNAL |
|--|----------------|------------------------|
| `kind` | `official` | `risk_signal` |
| When | Verified external feed only (allowlist: **GDACS**) | Deterministic model thresholds (Open-Meteo, Flood API) |
| Label | Source name (e.g. GDACS) | Always “WeatherGPT · …” |
| IMD/NDMA | **Not integrated** — never fabricated | N/A |
| Fields | severity, source, valid time, reason from feed | severity, reason, thresholds, confidence, valid time |

Also: `kind: demo` for Simulate Red (never official).

## Pipeline

```
GDACS live events     → official alerts
Open-Meteo Flood      → risk signals (hydrological model)
Open-Meteo QPF/WMO    → risk signals (WeatherGPT thresholds)
Simulate Red          → demo
        ↓
 mergeAlertLists()  — de-dupe, drop expired, resolve contradictions
        ↓
 alert_bundle + flat alerts[] (UI back-compat)
```

## Contradiction rules

- Same `place` + `hazard_family` → keep **higher severity**
- Same family: **official beats risk_signal**
- Expired (`valid_until` < now) → dropped from active list

## Severity thresholds (risk signals)

- **RED:** rain>100mm & pop>70 OR (hail-class WMO & rain>40) OR code≥99  
- **AMBER:** rain>50 OR pop≥80 OR wind>45 OR (storm & rain>20)  
- **YELLOW:** todayPop≥55 OR todayRain>5 OR code≥61  

## API

- `GET /api/weather` → `live_alerts`, `alert_bundle`
- `GET /api/alerts` → classified alerts + honesty note

## Tests

```bash
node scripts/smoke-alerts.mjs
```

## Files

- `api/_lib/alertEngine.js` (shared)
- `src/services/alertEngine.js` (client copy)
- `api/weather.js`, `api/alerts.js`
- `src/services/weather.js`
- `src/components/AlertsTab.jsx` (badges only — no full redesign)
