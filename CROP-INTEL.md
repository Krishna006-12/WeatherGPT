# Crop Intelligence (upgrade)

## Separation rules
- Crop names are **never** geocoded as cities (`allowGeocode: false` for crop-only).
- `classifyQuery` extracts `locationQuery` only from place prepositions / non-crop tokens.
- Follow-ups (`will rain affect it?`) use `cropContext` — no place resolve.

## Engine
`src/services/cropSignals.js` → `weathergpt.crop_signals.v1`

Inputs (when present): crop, location weather pack, temp, humidity, rain, POP, wind, horizon, season calendar, optional growth stage.

### Signals (each: level, reasons, confidence, data_basis, limitation)
| id | Meaning |
|----|---------|
| irrigation | Hold / favourable / caution — not a prescription |
| rainfall_risk | low → high from POP/mm |
| disease_fungal | “may favour” only — not diagnosis |
| spraying | weather window only — label/PHI required |
| harvest | dry window + calendar note |
| sowing | calendar + weather |
| heat_cold_stress | crop heuristic thresholds |

## Honesty
- No guaranteed yield, damage, or chem advice.
- Unknown crop → limitation stated; weather-generic signals only.
- Missing weather → `limited` levels.
- AI chat formats **verified signals** via `formatCropSignalsMarkdown` (client rules path).

## Tests
```bash
node scripts/smoke-crop-intel.mjs
```
