# WeatherGPT

**AI-assisted weather intelligence for India** (SIH / hackathon build)

> College internal round: **selected**.  
> This README is written for **Round-2 technical honesty** — no overclaims.

---

## What it is

Mobile-first **PWA** that helps people act on weather:

- Live conditions & forecast (Open-Meteo)
- **Hindi + English** UI and Q&A
- Explainable advisories: **Farm / Travel / School**
- Multi-source **alerts** (GDACS, flood model, meteo thresholds) + browser notifications
- **Climate trends** + **NWP multi-model** compare (GFS / ECMWF / ICON / blend)
- **Public JSON APIs** so judges / other AIs can test without rendering React

**Product rule:** weather *numbers* always come from meteorological APIs (or a labelled offline fallback). The app must not invent LIVE temps, alerts, or sources.

---

## What the “AI” actually is (read this)

| Layer | Reality |
|--------|---------|
| **Default brain** | Deterministic **grounded NLU** in `src/services/ai.js` — intent/keyword routing over a live weather pack. **Not** a trained custom ML weather model. |
| **Optional LLM** | If server env `GEMINI_API_KEY` (or `OPENAI_API_KEY`) is set, `api/chat.js` can **polish language** after tools fetch weather. **LLM never invents observations** — it only sees tool JSON. |
| **Name “WeatherGPT”** | Product name for “GPT-style assistant UX”. Without an API key, there is **no** ChatGPT/Gemini network call. |

**Round-2 answer if asked “which model / accuracy / training data?”**

1. Observation & forecast accuracy → **upstream NWP / Open-Meteo / GDACS / flood** (cite them).  
2. Our layer → **decision support + bilingual explanation + alert routing**, evaluated by source attribution & latency, not by claiming a private weather ML model.  
3. Optional Gemini/OpenAI → **language only**, grounded on tool output.  
4. We do **not** claim IMD official district polygon accuracy without an IMD licence.

---

## Languages

| Language | Status |
|----------|--------|
| English | Full UI + NLU + voice |
| Hindi | Full UI + NLU + voice |
| Marathi / other Indic | **Not implemented** (roadmap i18n packs) |

---

## Run

```bash
cd weathergpt
rm -f postcss.config.js   # if present — breaks Tailwind v4
npm install
npm run dev               # http://localhost:5173
```

Full serverless routes locally:

```bash
npx vercel dev
```

Production:

```bash
npm run build
npx vercel --prod
```

Optional LLM (server only — do not put keys in the frontend):

```bash
# Vercel project env
GEMINI_API_KEY=...
# or
OPENAI_API_KEY=...
```

---

## Architecture

```
React PWA (Vite)
  → /api/weather | alerts | climate | models | aqi | geocode | public | chat
       → Open-Meteo (forecast, archive, multi-model, AQI, flood)
       → GDACS (multi-hazard)
  → Optional: Gemini/OpenAI for phrasing only (api/chat.js)
```

**Database:** not required for core demo. Browser `localStorage` holds prefs, chat history, notification dedupe.  
Postgres/Supabase is a **planned** phase (devices, watch list, alert log) — not claimed as live unless wired.

**SMS / IVR:** not a live gateway in this build. App generates **SMS-ready text**, `sms:` links, WhatsApp share, and IVR script templates for rural relay. Production path: MSG91/Twilio + DLT (India) — see `public/IMPACT_AND_SCALE.txt`.

---

## Key URLs (after deploy)

| URL | Purpose |
|-----|---------|
| `/` | App |
| `/api/public` | Machine discovery (no JS) |
| `/llms.txt` | Instructions for external AIs |
| `/sih.html` | SIH matrix (static HTML) |
| `/openapi.json` | OpenAPI sketch |
| `/HONESTY.txt` | Claims vs reality |
| `/IMPACT_AND_SCALE.txt` | Cost / scale / rural / gov plan (transparent model) |

---

## Demo script (~90s)

1. Home — LIVE badge, AI Brief (What → Expect → Do).  
2. Chat — Hindi rain/farm question; tap **Listen** (TTS).  
3. Alerts — nearby feed; **Send test** notification; optional Simulate RED.  
4. Share alert — **SMS text / WhatsApp** (rural relay).  
5. Climate — 12‑month trend + GFS/ECMWF/ICON row.  
6. Open `/sih.html` + `/api/public` for evaluators who cannot render SPA.

---

## Team docs

- **`TEAM_APP_GUIDE.txt`** — full system map for the team  
- **`HONESTY.txt`** (public) — what we claim / don’t claim  
- **`DEPLOY_STEPS_HI.md`** — deploy in Hindi  

---

## Licence / data

Upstream ToS apply (Open-Meteo, GDACS, etc.). IMD official APIs need separate authorisation.
