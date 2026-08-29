# WeatherGPT — Complete QA & Regression Report

**Date:** 2026-08-29 (Asia/Calcutta)  
**Build under test:** post chat-UX + UI polish tree  
**Environment:** local API `scripts/local-api-server.mjs` (:8787) + client modules + Open-Meteo live  
**LLM keys in sandbox:** none (rules+tools path — intentional free-tier / honesty mode)  
**Method:** live HTTP probes, client `fetchWeather`/`chat`/`resolveMentionedCity`, all `scripts/smoke-*.mjs`, oxlint, vite production build, python-intel pytest, static security scan  
**Policy:** features not changed except one **real bug fix** found by QA (see § Fixes applied)

---

## Executive summary

| # | Category | Verdict |
|---|----------|---------|
| 1 | Location | **PASS** (typo city = soft miss, expected) |
| 2 | Weather | **PASS** |
| 3 | AI | **PARTIAL** |
| 4 | Crop | **PARTIAL** |
| 5 | Alerts | **PASS** |
| 6 | Network | **PASS** |
| 7 | UI | **PARTIAL** |
| 8 | Performance | **PASS** (with notes) |
| 9 | Security | **PASS** (with hardening notes) |
| 10 | Build | **PASS** (lint warnings remain; 0 errors after fix) |

**Overall ship readiness:** **PASS with known partials** — suitable for SIH demo if judges understand default AI = grounded rules+tools (no private LLM claim). Redeploy zip + unregister SW after deploy.

---

## 1. LOCATION — **PASS**

| Case | Result | Evidence |
|------|--------|----------|
| Kanpur | PASS | Curated `26.45,80.33`; geocode 3 hits; weather live |
| Delhi | PASS | `New Delhi 28.61,77.21`; weather + AQI live |
| Mumbai | PASS | Curated + geocode; Hindi `मुंबई` → Mumbai |
| Tokyo | PASS | Resolve + weather (21°C class, high POP) |
| London | PASS | Resolve GB; search also returns London CA (ambiguous OK) |
| invalid `xyznotacity123` | PASS | Geocode 0; `resolveMentionedCity` → null (stays home city) |
| ambiguous Springfield / Paris / London | PASS | Search returns ranked real places; no crash |
| typo `Londn` | PASS (soft) | Geocode 0 / resolve null — **no fuzzy auto-correct** |

**Notes**
- Recent-cities noise/crop guards still in `App.jsx` (`RECENT_NOISE`, `isValidRecentCity`).
- `CITY_LIST` curated count: **29** (dynamic geocode still works worldwide).

**Failures:** none blocking.

---

## 2. WEATHER — **PASS**

Live pack via `fetchWeather(Kanpur)` + `/api/weather` for 5 cities.

| Field | Result | Sample (Kanpur, 2026-08-29) |
|-------|--------|------------------------------|
| Current temperature | PASS | **32°C** (API 32.3) |
| Humidity | PASS | **72%** |
| Wind | PASS | **8 km/h** dir 312 |
| Rain / POP | PASS | daily rain **8.6 mm**, calibrated pop **77** (raw 88) |
| Hourly forecast | PASS | client **24** hours; API hourly series 168 |
| Daily forecast | PASS | **7** days |
| Sunrise / sunset | PASS | `astro.sunrise=05:47` `sunset=18:32` |
| AQI | PASS | Delhi proxy US AQI **357**, EAQI 228 (separate `/api/aqi`) |

Also verified: Mumbai/Tokyo/London/Delhi current temps distinct and live; `live: true`.

**Failures:** none.

---

## 3. AI — **PARTIAL**

### What passed
| Case | Result |
|------|--------|
| Simple weather (“temp right now”) | PASS — deterministic trivial, verified numbers |
| Complex (outdoor wedding / rain+humidity) | PASS — grounded rules+tools answer |
| Multilingual Hindi (`आज बारिश…`, `lang=hi`) | PASS — Hindi brief, same locked numbers |
| Follow-up (client crop context) | PASS — `will rain affect it?` keeps wheat after cropCtx |
| Empty message | PASS — HTTP **400** |
| Provider / quota absence | PASS — no keys → rules fallback; `llmError` may appear; UI taxonomy covers quota/provider |
| Grounding smoke | PASS — invented 47°C/95%/200mm rejected; official-without-alert rejected |
| Cancel / error taxonomy (`chatClient`) | PASS — cancel, timeout, quota, api_missing, malformed, network, provider |
| Chat UX stages / progressive reveal | PASS (unit + wiring; see CHAT-UX.md) |

### Partials / failures

#### F3.1 — Far-future / precision hallucination not explicitly refused  
- **Issue:** Query *“exact temperature at 3:17pm on 12 March 2099”* returns **current** Kanpur conditions without a clear “cannot forecast 2099” disclaimer.  
- **File:** `api/chat.js` (trivial route), `src/services/ai.js` (client temp intent)  
- **Cause:** Trivial/current-weather short-circuit matches “temperature” intent; no temporal guard for impossible horizons.  
- **Severity:** **Medium** (honesty/demo risk if judge probes)  
- **Fix:** Detect far-future / exact-minute asks → short refusal + offer current/7-day only.

#### F3.2 — No live LLM provider in this QA environment  
- **Issue:** All `/api/chat` answers were `deterministic_*` / rules — Groq/Gemini/OpenRouter paths **not exercised** with real keys.  
- **File:** `api/chat.js` env key loading  
- **Cause:** Sandbox has empty `.env` (correct for security).  
- **Severity:** **Low** for product honesty; **Medium** for “AI provider” acceptance if keys misconfigured on Vercel.  
- **Fix:** On deploy host, set one free key; re-run one LLM chat smoke.

#### F3.3 — Timeout / quota UX  
- **Issue:** Taxonomy + 22s abort exist client-side; full E2E browser cancel/timeout not automated here.  
- **File:** `src/services/chatClient.js`, `src/App.jsx`  
- **Severity:** **Low**  
- **Fix:** Manual: throttle network in DevTools; hit Cancel mid-request.

---

## 4. CROP — **PARTIAL**

### Client Crop Intelligence — **PASS** (strong)
Smoke + accept scripts: **ALL PASSED**

| Crop | Client chat type | Notes |
|------|------------------|-------|
| wheat / rice / potato / maize / mustard | `type=crop` | Structured Crop Intelligence markdown |
| crop-only | PASS | No geocode as city; no Recent push |
| crop + city (`wheat in Kanpur`, rice Punjab…) | PASS | `crop_location` class; not “Weather summary — Wheat” |
| crop follow-up | PASS | context preserved |
| unknown dragonfruit | PASS | not forced crop type; agri generic or limited |
| Hindi wheat | PASS | |
| geocode bare crop | PASS | 0 hits |

### Server `/api/chat` crop body — **PARTIAL**
| Case | Result |
|------|--------|
| `crop: wheat|rice|…` | Returns **generic farm rain/irrigation** blurb, **not** full Crop Intelligence sections |
| `wheat in Punjab` with crop hint | Still answered as **Kanpur** place (body lat/lon), trivial or generic farm |

- **Issue:** Server crop path ≠ client `cropSignals` richness; crop+city via API alone may ignore named region if lat/lon still home.  
- **File:** `api/chat.js` crop engine branch; `src/App.jsx` prefers API then falls back to client  
- **Cause:** Deterministic server template is weather-farm generic; client does the real crop cards when API lacks crop-structured answer.  
- **Severity:** **Medium** (UI path OK because client fallback; pure API judges see weaker crop)  
- **Fix:** Align server crop answers with `cropSignals` / python-intel crop-features, or always prefer client crop template when `classified.crop`.

---

## 5. ALERTS — **PASS**

| Case | Result | Evidence |
|------|--------|----------|
| no alert (calm synthetic) | PASS | `smoke-alerts.mjs` |
| risk signal | PASS | yellow/amber weather risk |
| official vs risk | PASS | official wins same family; IMD never invented |
| expired | PASS | filtered |
| multiple risks | PASS | de-dupe / collapse |
| demo never official | PASS | |
| live Kanpur/Delhi/Mumbai | PASS | GDACS/flood + heavy rain risk present (live day) |

UI: `AlertsTab` kind tones (official / risk / demo) from prior polish.

**Failures:** none in engine. Live feed content is **day-dependent** (not empty today).

---

## 6. NETWORK — **PASS**

| Case | Result |
|------|--------|
| normal online | PASS |
| slow / weak net heuristics | PASS — shorter timeouts, defer heavy UI, skip prefetch (`smoke-offline`) |
| offline status | PASS — `deriveDataStatus` → offline/cached |
| API timeout handling | PASS — client AbortController 22s; weather timeouts scaled |
| API error | PASS — bad lat → 502; chat empty → 400; HTML/SPA fallback classified `api_missing` |
| CORS | PASS — `Access-Control-Allow-Origin: *` on APIs; OPTIONS 204 |

**Failures:** none blocking.

---

## 7. UI — **PARTIAL**

| Case | Result |
|------|--------|
| desktop command center | PASS — sidebar `lg:flex`, desktop chrome CSS lock |
| tablet / mobile | PASS — bottom nav `lg:hidden`, mobile chrome; breakpoints in CSS |
| dark theme | PASS — navy glass `#0B1F3A` identity |
| light theme | **N/A / FAIL vs “if supported”** — **dark-only** product (no light mode toggle) |
| reduced motion | PASS — multiple `@media (prefers-reduced-motion)` + chat bubble check |
| long responses | PASS — structured intel cards + progressive reveal + scroll |
| missing data | PASS — ForecastTab shimmer if `!weather`; climate error glass; empty soft styles |

### Partials

#### F7.1 — No light mode  
- **Severity:** **Low** (never in product brief as required)  
- **Fix:** only if judges require OS light scheme.

#### F7.2 — ForecastTab assumes `astro` always defined  
- **Issue:** `astro.sunrise` without optional chain after weather truthy check.  
- **File:** `src/components/ForecastTab.jsx` ~102–106, 248–254  
- **Cause:** Normal packs always include `astro`; synthetic/partial packs could throw.  
- **Severity:** **Low**  
- **Fix:** `astro?.sunrise ?? '—'`

#### F7.3 — Lint noise / unused imports  
- Unused `MarkdownText` in `ChatTab.jsx`, `DataStatusBanner` in `App.jsx` — cosmetic.  
- **Severity:** **Info**

**Browser visual QA:** not run in headed browser here (no Playwright). Layout claims are static + prior build verification.

---

## 8. PERFORMANCE — **PASS** (notes)

### Measured (local API → Open-Meteo, 2026-08-29)

| Path | Latency |
|------|---------|
| `/api/weather` Kanpur | ~0.3–3.3 s (avg ~1.9 s cold/varies) |
| `/api/aqi` | ~0.2–0.6 s |
| `/api/chat` rules | ~160 ms avg |
| `/api/models` | ~0.6 s |
| `/api/alerts` | ~0.5–0.7 s |
| `/api/climate` | ~0.7 s |
| Multi-model Kanpur | ~0.6 s (5/5 models) |
| Vite production build | **~1.0–1.4 s** |
| Client initial bundle (index gzip) | ~73.5 kB JS main; charts chunk ~111 kB gzip lazy |

### Engineering checks
| Check | Result |
|-------|--------|
| Weather cache / coalesce | PASS (`smoke-perf`, weather service) |
| AI code-split | PASS — `ai-*.js` lazy |
| Charts code-split | PASS |
| Prefetch skip offline/2g | PASS |
| Unnecessary multi-model browser fan-out | PASS — server `/api/models` only |

### Notes (not failures)
- First weather after cold start can exceed 1.5 s (upstream).  
- Charts chunk is heavy but lazy — OK if not on critical home path.  
- No automated Lighthouse; initial_paint hook exists in perf service.

---

## 9. SECURITY — **PASS** (hardening notes)

| Check | Result |
|-------|--------|
| API keys only server `process.env` | PASS — `api/chat.js` Groq/OpenRouter/Gemini/OpenAI |
| `.env` gitignored | PASS — `.gitignore` blocks `.env`, `.env.*`, keeps `.env.example` |
| No real `.env` with secrets in tree | PASS |
| Client bundle secret scan | PASS — no `AIza`/`sk-`/`GROQ_API_KEY=` values; only user-facing tip strings |
| `VITE_*` secrets | PASS — none used for keys |
| CORS `*` | PASS functionally; **note** open CORS is intentional for SIH public API |
| Public evaluator API | PASS — `/api/public` discovery, no key required for weather tools |
| INTEL_SERVICE_KEY server-only | PASS — `api/intel.js` |
| Conflict markers `<<<<<<<` | PASS — none in src/api |

### Hardening notes (not FAIL)
- **N9.1** Open CORS + public chat action increases abuse surface — rate-limit on Vercel recommended for prod scale. **Severity: Low** for college demo.  
- **N9.2** `dist/HONESTY.txt` mentions env var *names* (OK) — ensure no key values ever logged.

---

## 10. BUILD — **PASS**

| Check | Result |
|-------|--------|
| `npm run build` | **PASS** (exit 0) |
| `npm run lint` (oxlint) | **PASS with warnings** — **0 errors** after ClimateTab fix; **59 warnings** |
| App unit/smoke scripts | **PASS** — crop, grounding, offline, alerts, multi-model, pop-crop, accept-crop-fix, perf, confidence, intel-boundary |
| Typecheck | **N/A** — JS project, no `tsc` script |
| python-intel pytest | **PASS** — **16 passed** |

### Fix applied during QA (required bug)
| Item | Detail |
|------|--------|
| **Issue** | `useMemo` called **after** conditional `loading` / `err` returns → Rules of Hooks violation |
| **File** | `src/components/ClimateTab.jsx` |
| **Severity** | **High** (runtime hook order crash when leaving loading state) |
| **Fix** | Move `chartTemp` `useMemo` above early returns |
| **Verify** | oxlint errors **1 → 0**; production build green |

---

## Smoke script scoreboard

| Script | Result |
|--------|--------|
| smoke-crop-intel.mjs | ALL PASSED |
| smoke-grounding.mjs | ALL PASSED |
| smoke-offline.mjs | ALL PASSED |
| smoke-alerts.mjs | ALL PASSED |
| smoke-multi-model.mjs | ALL PASSED |
| smoke-pop-crop.mjs | OK |
| smoke-perf.mjs | ALL PASSED |
| smoke-confidence.mjs | OK (fixture) |
| smoke-intel-boundary.mjs | PASS (python optional not configured) |
| accept-crop-fix.mjs | ALL PASSED |
| python-intel pytest | 16 passed |

---

## Failure register (complete)

| ID | Sev | Category | Issue | File | Likely cause | Recommended fix |
|----|-----|----------|-------|------|--------------|-----------------|
| F3.1 | Med | AI | Far-future exact temp not refused | `api/chat.js`, `src/services/ai.js` | Trivial temp route | Temporal guard + honesty line |
| F3.2 | Low–Med | AI | LLM providers untested here | deploy env | No keys in sandbox | Set free GROQ/OpenRouter on Vercel; one smoke |
| F3.3 | Low | AI | Browser cancel/timeout not E2E | ChatTab/App | QA limit | Manual DevTools test |
| F4.1 | Med | Crop | `/api/chat` crop answers generic vs client Crop Intelligence | `api/chat.js` | Thin server crop template | Share cropSignals server-side or prefer client crop |
| F4.2 | Med | Crop | crop+city API uses request lat/lon (home) | `api/chat.js` + body | No server place extract when coords fixed | Resolve place from message server-side |
| F7.1 | Low | UI | No light theme | product | Dark-only design | Optional later |
| F7.2 | Low | UI | `astro.` non-optional | `ForecastTab.jsx` | Assumes full pack | Optional chain |
| N9.1 | Low | Sec | Open CORS / public chat | `api/*` | SIH openness | Rate limit / abuse monitor |
| W10.1 | Info | Build | 59 oxlint warnings | various | unused imports, exhaustive-deps | Clean incrementally |

**Hooks crash (was High):** **FIXED** in this QA pass (`ClimateTab.jsx`).

---

## Category verdicts (quick)

```
1  LOCATION     PASS
2  WEATHER      PASS
3  AI           PARTIAL
4  CROP         PARTIAL
5  ALERTS       PASS
6  NETWORK      PASS
7  UI           PARTIAL
8  PERFORMANCE  PASS
9  SECURITY     PASS
10 BUILD        PASS
```

---

## Deploy checklist (post-QA)

1. Use updated tree (includes ClimateTab hooks fix).  
2. `npm run build && vercel --prod`  
3. Browser: Unregister service worker + clear site data.  
4. Sanity: Kanpur home → Tokyo chat → wheat crop → Cancel on chat → Alerts tab.  
5. Optional: set `GROQ_API_KEY` or `OPENROUTER_API_KEY` for LLM path.

---

## Artifacts

- This report: `QA-REPORT.md`  
- Chat UX notes: `CHAT-UX.md`  
- Deploy zip: `/home/user/weathergpt-deploy.zip` (rebuilt after QA fix)
