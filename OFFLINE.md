# WeatherGPT — Offline & weak-network

Extends the **existing** stack (no second cache product):

| Layer | Role |
|-------|------|
| `src/services/db.js` IndexedDB `weather_cache` | Last **successful** pack per city |
| `src/services/weather.js` mem TTL + inflight | Fast path + coalesce |
| PWA Workbox `NetworkFirst` | `/api/weather` + Open-Meteo (SW) |
| `src/services/networkStatus.js` | Status labels, age, weak-net policy |

**Never cached:** API keys / secrets (client weather uses free Open-Meteo; chat keys stay server-only).

## Stored pack fields

On each successful live fetch, `dbPutWeather` writes a slim pack:

- **location** — id, name, lat, lon, tz, countryCode  
- **weather** — `current`  
- **forecast** — `hourly` (≤24), `daily` (≤7)  
- **timestamp** — `fetchedAt`  
- **source** — e.g. `open-meteo-direct`, `proxy`  

Demo/synthetic packs are **not** written over real observations.

## Status (UI)

| Code | Meaning |
|------|---------|
| **Live** | Fresh network pack within ~5 min; `live: true` |
| **Updating** | Last-good still shown while refresh runs |
| **Cached** | Online but serving disk/mem; **not** labeled Live |
| **Offline** | `navigator.onLine === false` or forced offline path |

Rules:

- Disk packs always `live: false`, `stale: true`, `fromCache: true`  
- Synthetic `offlinePack` → `demo: true` / source `offline-demo` — never “Live”  
- Age shown on pill + optional banner when offline / stale / demo  

## TTL

| Store | Soft | Hard |
|-------|------|------|
| Mem live pack | **5 min** (`FRESH_MS`) | — |
| Stale badge | age **> 30 min** (`STALE_MS`) | — |
| IDB soft prefer revalidate | 30 min | slow-net soft window up to 12 h |
| Offline last-resort | — | **72 h** still shown as Offline+stale |
| Demo pack mem | 45 s | not persisted as success |

## Weak network

`getNetworkSnapshot()` / `shouldDeferHeavyUI` / `shouldSkipPrefetch`:

- **save-data**, **2g / slow-2g**, low downlink 3g, or offline → **core only**  
- Skip idle multi-city prefetch  
- Defer AQI on boot / city switch when core-only  
- Climate tab: climate history yes, **skip multi-model** on weak  
- Shorter `fetchTimeoutMs` so SW/IDB fallback wins faster  

## Failure matrix

| Scenario | Behavior |
|----------|----------|
| Normal | Live fetch → IDB write → Live pill |
| Slow | Longer mem TTL; shorter network timeout; less background work |
| API timeout | Last IDB/mem pack → **Cached** + age |
| Complete offline | No network; IDB/mem → **Offline** + age; else demo (labeled Demo) |
| Stale cache | Shown with stale detail; not Live |
| Connection restored | `online` event; user refresh or next fetch → Live |

## Test

```bash
node scripts/smoke-offline.mjs
# optional:
LIVE=1 node scripts/smoke-offline.mjs
```

Manual: DevTools → Network Offline / Slow 3G; confirm pill + banner; go online → Refresh → Live.

## Console

```js
__WEATHERGPT_PERF__()
// packs: weather.live, weather.fromCache, weather.stale, weather.demo, weather.fetchedAt
```
