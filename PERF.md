# WeatherGPT — Performance

**Goal:** snappier loads, fewer duplicate API calls, lower bandwidth — **no visual design change**.

## Audit (before)

| Path | Behavior | Issue |
|------|----------|--------|
| Cold start | `fetchWeather(home)` then AQI sequential | AQI waited on weather |
| City switch | gen-guard only | No `AbortSignal`; stale could finish late |
| Weather | 5 min mem TTL + IDB; direct vs proxy race | No cross-caller **in-flight coalesce** |
| Geocode | 15 min Map TTL | No coalesce on rapid typing / duplicate resolve |
| AQI | 20 min Map; sequential URLs | No race/coalesce/abort |
| Climate / models | 30 min / 5 min | No abort on tab city change |
| Alerts poll | 3 min | No short feed TTL → double-fetch on focus |
| Prefetch | idle lucknow/delhi/dubai | OK (deferred) |
| Chat | 22s Abort | No latency mark |
| Multi-model on weather hot path | optional | Extra upstream cost |

## Changes (after)

### Shared `src/services/perf.js`
- `createTtlCache` — hit/miss counters
- `createInflight` — identical key shares one Promise (`coalesce_hit`)
- `timedFetch` — timeout + outer `AbortSignal` + latency buckets
- `raceFirstOk` — independent sources, first OK wins
- `getPerfSnapshot()` / `window.__WEATHERGPT_PERF__()`
- `setInitialPaintMs` — first weather paint

### Service wiring

| Service | TTL | Coalesce | Abort | Notes |
|---------|-----|----------|-------|-------|
| **weather** | pack 5 min (slow-net ×2); offline 45s; IDB 30 min soft / 72h stale | `wx:{key}` | yes | Race direct OM ↔ `/api/weather?multimodel=0`; gen token blocks stale write; compact hourly **48h** (not 168) |
| **geocode** | **20 min** search | `geo:q\|count\|lang` | yes | timedFetch proxy then direct |
| **aqi** | 20 min | `aqi:{lat,lon}` | yes | Race direct AQ API ↔ `/api/aqi` |
| **climate** | 30 min | `climate:` / `models:` | yes | Models 5 min |
| **alerts feed** | **90s** mem | `alerts:{points}` | yes | Poll still 3 min |

### App
- Cold start: **`Promise.all([weather, AQI])`** (independent)
- `loadCity` / `refreshLive`: abort previous; parallel wx+AQI; gen-guard
- Chat: `perfTime('chat_ms')`
- Settings: hits/miss/coalesce + avg wx + initial paint
- Climate tab: abort on city change; memo chart rows

### Payload / calc
- Open-Meteo direct: `forecast_hours=48` (UI uses ~24–48h slider)
- `multimodel=0` on dashboard weather path (multi-model stays Climate `/api/models`)
- Parse once per fetch; packs cached — no re-parse on remount
- Lazy tabs unchanged; no new heavy deps

## Instrumentation

```js
// DevTools
__WEATHERGPT_PERF__()
// → { counters: { cache_hit, cache_miss, coalesce_hit, fetch_ok, fetch_err },
//     latency_avg_ms: { weather, geocode, aqi, climate, models, chat },
//     initial_paint_ms, recent: [...] }
```

Settings → storage/network card shows the same counters.

## Before / after (measurable patterns)

| Metric | Before | After (expected) |
|--------|--------|------------------|
| Cold start network | weather then AQI (serial) | **parallel** — wall time ≈ max(wx, aqi) |
| Double mount / Strict Mode | 2× live weather | **1×** via inflight coalesce |
| Rapid city A→B→C | A/B responses can race UI | **aborted**; only C commits |
| Identical geocode | N fetches | 1 + 20 min cache |
| Alerts tab remount &lt;90s | full `/api/alerts` | **cache hit** |
| Weather JSON size | hourly default long | **48h** hourly fields |
| Dashboard multi-model | possible on proxy | **off** hot path |

Exact ms depend on network; use smoke + `__WEATHERGPT_PERF__` after load.

## Smoke

```bash
node scripts/smoke-perf.mjs
npm run build
```

## Deploy note

Ship zip → `npm i && npm run build && npx vercel --prod` → Unregister SW + Clear site data so old runtime cache does not mask gains.
