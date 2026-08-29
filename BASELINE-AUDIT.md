# WeatherGPT — Production-readiness baseline audit

**Date:** 2026-08-29 (Asia/Calcutta)  
**Scope:** Architecture inspection, security, performance, accuracy debt, test/build.  
**Out of scope (per brief):** weather-model / AI / UI / crop / Python upgrades — **not implemented**.

---

## 1. Current architecture

### 1.1 Frontend
| Item | Detail |
|------|--------|
| Stack | React 19 + Vite 8 + Tailwind v4 (`@tailwindcss/vite`) + PWA (`vite-plugin-pwa`) |
| Entry | `src/main.jsx` → `App.jsx` (device lab frames only with `?preview=1`) |
| Routing | **No React Router** — tab state in `App.jsx` (`home` / `chat` / `alerts` / `modes` / `more`) |
| State | React `useState` / `useCallback` / `useRef`; prefs + recent cities + chat history in **localStorage** (`src/services/storage.js`); weather cache in **memory + IndexedDB** (`src/services/db.js`) |
| Code-split | Lazy tabs: Chat, Alerts, Farm, Forecast, Cities, Travel, School, Climate, Settings, Onboarding; charts + `ai.js` + `WeatherCharacter` deferred |
| UI shell | Mobile bottom nav + desktop sidebar; glass dashboard `DashboardTab.jsx` |
| Error UI | `ErrorBoundary.jsx` |
| Voice | `src/services/voice.js` (browser STT/TTS) |
| Alerts UX | `useAlertMonitor` polls ~3 min + optional OS notifications |

### 1.2 API / serverless
| Path | Role |
|------|------|
| `api/weather.js` | Open-Meteo forecast proxy + GDACS / flood-ish live alerts bundle |
| `api/geocode.js` | Open-Meteo geocoding proxy |
| `api/aqi.js` | Open-Meteo air-quality proxy |
| `api/chat.js` | Hybrid Intent Router → multi-LLM → validator → rules fallback |
| `api/alerts.js` | Multi-city / multi-source alerts feed |
| `api/climate.js` | Climate / archive-style series |
| `api/models.js` | NWP multi-model compare (Open-Meteo) |
| `api/public.js` | Open discovery + `action=chat` / `bundle` for external AIs / judges |
| Hosting | **Vercel serverless** (`vercel.json`); local: `scripts/local-api-server.mjs` |
| Client weather | Prefer `/api/weather`, race **direct Open-Meteo** (`src/services/weather.js`) |

### 1.3 AI provider architecture
```
USER message
  → Intent Router (weather_crop | general)
  → if weather: Open-Meteo tool pack
  → AI Provider Manager: Groq → OpenRouter → Gemini → OpenAI
  → Response Validator
  → else Rules + weather (free forever)
```
- **Server-only keys** via `process.env` in `api/chat.js` (never intended in Vite bundle).
- Client also has large **rules engine** in `src/services/ai.js` + `ruleEngine.js` for offline / no-key demos.
- Reply language: English or Hindi/Hinglish from `lang` + script detection — **not** a separate “Gemini language”; implementation is **JavaScript**.

### 1.4 Weather-data architecture
- Primary: **Open-Meteo** forecast (current / hourly / daily).
- Client normalize + WMO map: `src/services/weather.js`.
- Honest POP calibration + locked facts: `src/services/ruleEngine.js` → `pack.facts`.
- Alerts: model thresholds + external (GDACS etc. on proxy).
- Offline: IndexedDB last pack → synthetic offline pack (labelled, not fake LIVE).

### 1.5 Crop intelligence
- Catalog + entity detect: `src/data/crops.js`.
- Classify before geocode: `src/services/queryClassify.js` + App chat path.
- Season calendar / disease “may favour” / chem windows: `ruleEngine.js`.
- Server crop hint + grounded LLM: `api/chat.js`.
- Recent cities scrub: noise + crop-as-city guards in `App.jsx`.

### 1.6 Caching
| Layer | Mechanism |
|-------|-----------|
| CDN/edge | `Cache-Control: s-maxage=…` on weather/geocode/aqi/climate/models/public |
| Chat | `no-store` |
| Client memory | `Map` in weather/geocode services |
| IndexedDB | `db.js` weather_cache + alert_events + kv |
| PWA | Workbox precache (charts/motion excluded from forced first install) + runtime NetworkFirst weather |
| LLM | None durable (stateless per request) |

### 1.7 Error handling
- API: try/catch, timeouts via `AbortController`, HTML-as-API detection.
- Chat: provider failover + deterministic fallback.
- UI: toasts, loading skeletons, ErrorBoundary.
- Gaps: no global API rate limit; some client paths swallow errors with empty catch.

### 1.8 Performance posture (already in tree)
- Lazy routes; AI module load-on-chat; IDB-first weather paint; multi-city prefetch deferred; font non-blocking; raced Open-Meteo vs proxy; `cssCodeSplit: false` for one CSS bundle (layout lock).

---

## 2. Security issues

### 2.1 Critical / high (handled this phase where applicable)

| Issue | Severity | Status |
|-------|----------|--------|
| **No real API keys in source** (AIza/sk-/gsk_ scan clean) | — | **OK** |
| **No committed `.env`** | — | **OK** (`.gitignore` has `.env`, `.env.*`, `!.env.example`) |
| **GET `/api/chat` leaked `gemini_key_length`, key counts, exact model env** | Medium (recon) | **Fixed** — booleans + contract only |
| **Local `.vercel/anonymous.json` contains a Vercel auth token (len 60)** | High **if** folder shared/uploaded | **Not in git** (ignored). **Do not zip/share `.vercel`**. If this sandbox/token was ever published, **revoke/rotate Vercel token** in account settings |
| **CORS `Access-Control-Allow-Origin: *` on all APIs** | Medium for browser abuse of POST `/api/chat` (LLM quota burn) | **Accepted for SIH public demo**; future: origin allowlist + light rate limit |
| **Open `/api/public?action=chat`** | Medium (unauthenticated LLM/weather proxy) | Intentional for external AI testing; future: quota / API key optional |

### 2.2 Residual security notes (not changed this phase)
- No auth on chat (by design for demo).
- No server-side rate limiting / abuse protection.
- Client can still call Open-Meteo **directly** (public free API — OK).
- Many markdown “FIX-*.md” docs mention setup; ensure they never gained real keys (scan clean).

### 2.3 Secrets hygiene actions taken
1. Hardened `GET` handler in `api/chat.js` (removed key length/count/model fingerprinting).
2. Expanded `.gitignore` (`*.bak`, extra `.env*.local`).
3. Removed workspace dead file `src/components/DashboardTab.jsx.bak`.
4. Documented rotation note in `.env.example`.

**If any key was ever pasted into chat, GitHub, or a public Vercel log: rotate it manually in the provider console.** This audit did **not** print or find live provider keys in the repo.

---

## 3. Performance issues

| Issue | Impact | Future fix location |
|-------|--------|---------------------|
| Main chunk still ~199KB JS + react-vendor ~178KB | Mobile TTI | Further split `App.jsx` / icons |
| `charts` ~387KB (lazy but heavy) | Forecast/climate tabs | Dynamic import already; consider lighter charts |
| `framer-motion` still on several tabs | Extra KB when those tabs open | CSS transitions only |
| `src/App.jsx` ~1671 lines / `ai.js` ~2063 lines | Maintainability + parse cost | Split modules |
| `src/index.css` ~75KB source | CSS weight | Purge unused ambient later |
| Client + server both implement chat-ish paths | Duplicate work | Consolidate on server for production |
| Alert poll 3 min × watch list | Background network | Backoff when hidden tab |
| PWA SW stale risk | “UI not updating” support burden | Already documented; version bump / skipWaiting UX |

---

## 4. Accuracy issues

| Issue | Notes |
|-------|--------|
| Dual weather stacks | Client `weather.js` + server `api/weather.js` / chat tool pack can diverge slightly |
| WMO / POP | Improved via `ruleEngine` but server compact pack may not always carry full `facts` fingerprint |
| Alerts | “IMD-style” colours are **modelled UX**, not official IMD API |
| Crop calendar | N/Central India heuristic — must stay labelled as guidance |
| LLM drift | Mitigated by locked facts + validator; still possible if validator weak |
| Hindi | Risk of number drift if LLM path ignores lock (prompt forbids; rules path safer) |
| Geocode | Famous-city locks help; obscure names still fuzzy |

---

## 5. Technical debt

- **Monolithic files:** `App.jsx`, `ai.js`, `chat.js`, `DashboardTab.jsx`.
- **Duplicated CORS / fetchJson** copy-pasted across `api/*.js`.
- **Duplicated WMO/POP concepts** (legacy table in `weather.js` + honest table in `ruleEngine.js`).
- **Client AI vs server AI** two pipelines.
- **No formal unit test runner** (Vite build + oxlint + ad-hoc `scripts/*.mjs`).
- **Smoke scripts fail under raw Node ESM** without `.js` extensions in imports (Vite resolves; Node does not).
- **34 oxlint warnings** (hooks deps, unused vars in scripts, etc.) — 0 errors.
- **Docs sprawl:** many FIX-*.md / deploy guides (helpful but noisy).
- **No TypeScript** — faster hackathon velocity, weaker contracts.
- **Backup `.bak` files** — removed one; pattern now gitignored.

---

## 6. Existing strengths

- Clear **honesty story** (HONESTY.txt, public OpenAPI, `/api/public`).
- **Multi-provider free LLM** with rules fallback — demo survives quota death.
- **Crop-before-geocode** routing and recent-city noise filters.
- **Locked weather facts** direction (fingerprint) for number consistency.
- **PWA + IndexedDB** offline resilience.
- **Performance work already landed** (lazy AI, IDB-first, fetch race, SW precache trim).
- **SIH-oriented** bilingual + decision modes (travel/school/farm).
- Build is **green**; secrets not in frontend bundle pattern.

---

## 7. Exact files for future phases (do not implement now)

### Weather models / NWP
- `api/models.js`, `api/climate.js`
- `src/services/climate.js`, `src/components/ClimateTab.jsx`
- `src/services/weather.js`, `api/weather.js` (single source of truth)

### AI
- `api/chat.js` (rate limit, origin allowlist, shared validator)
- `src/services/ai.js` (thin client → server-only LLM)
- `.env.example` / Vercel env docs only

### UI (when allowed)
- `src/components/DashboardTab.jsx`, `WeatherCharacter.jsx`, `src/index.css`, `src/App.jsx`

### Crop
- `src/data/crops.js`, `src/services/ruleEngine.js`, `src/services/queryClassify.js`
- Server crop engine section of `api/chat.js`

### Python (if added later)
- New `services/` or external worker — **not present today**; would need new deploy surface

### Cross-cutting
- Extract `api/_lib/cors.js`, `api/_lib/fetch.js`
- Add Vitest + Node export maps or `.js` extensions for smoke tests
- Optional TypeScript on `api/` first

---

## 8. Test results

| Check | Result |
|-------|--------|
| `npm run lint` (oxlint) | **0 errors**, **34 warnings** (hooks exhaustive-deps, unused script vars, react immutability note on `window.location`) |
| `npm run build` | **PASS** (~1s); PWA precache ~48 entries / ~699 KiB |
| `node scripts/smoke-pop-crop.mjs` | **FAIL** — Node ESM `ERR_MODULE_NOT_FOUND` (imports omit `.js`; works under Vite, not raw Node) |
| `node scripts/accept-crop-fix.mjs` | **FAIL** — same ESM resolution |
| `node scripts/smoke-crop-intel.mjs` | **FAIL** — same ESM resolution |
| Formal unit/e2e suite | **None configured** |
| Secret regex scan (source) | **No provider API keys found** |
| `.env` committed | **No** |

---

## 9. Build result

```
✓ vite build success
  index-*.js ~199 kB (main)
  react-vendor ~178 kB
  ai-*.js ~48 kB (async)
  charts ~387 kB (async)
  motion ~126 kB (async, tab-level)
  style-*.css ~one bundle (cssCodeSplit: false)
PWA: generateSW OK
```

---

## 10. Critical fixes applied in this phase only

1. **`api/chat.js`** — remove key length / key count / detailed model disclosure from public GET.
2. **`.gitignore`** — `*.bak`, stronger local env patterns.
3. **`.env.example`** — security/rotation reminder (placeholders only).
4. **Delete** `src/components/DashboardTab.jsx.bak`.

No UI redesign, no feature upgrades, no Python path.

---

## 11. Production go / no-go (baseline)

| Gate | Verdict |
|------|---------|
| Secrets in repo | **Pass** |
| Production build | **Pass** |
| Lint clean | **Warn-only** (acceptable for baseline) |
| Automated tests | **Weak** (scripts need Node ESM fix later) |
| Abuse resistance on LLM | **Fail for hostile internet** without rate limit |
| Accuracy single-source weather | **Partial** |

**Baseline conclusion:** Safe to continue feature phases on a **green build** and **clean secret tree**, with CORS/public chat treated as **known demo risk**, and smoke scripts + rate limits queued for a hardening sprint—not this audit’s feature scope.
