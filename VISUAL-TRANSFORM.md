# Visual-only dashboard transformation (v2)

**Date:** 2026-08-29  
**Scope:** Presentation only. No API, contracts, AI, crop, routing, or weather-calculation changes.

Reference image = **quality / hierarchy / atmosphere inspiration only** — not copied as UI.

---

## 1. Files changed

| File | Change |
|------|--------|
| `src/components/DashboardTab.jsx` | Environment layout; open panels; metric strip; UV arc + sunrise/sunset from existing `astro`/`uv`; hero rail; desk grid |
| `src/index.css` | Visual v1 + v2 packs (open panels, desk grid, strips, arcs, quieter shell) |
| `src/components/ModelConsensusCard.jsx` | Quieter section classes; optional POP chip when model payload has POP |
| `VISUAL-TRANSFORM.md` | This document |

---

## 2. Exact visual changes

1. **Reduce card dependency** — `wx-open-panel` replaces heavy glass bricks; hairline borders; no stacked “admin card” look.
2. **Hero** — larger dominant temperature; location/date; feels + H/L + status; character in atmospheric slot; key metrics as **rail** (not mini-cards).
3. **Atmosphere** — existing sky modes, clouds, rain, rays, night stars retained/enhanced.
4. **Character** — kept; depth via slot glow + drop shadow (logic untouched).
5. **Metrics** — `MetricStrip` grid (humidity, wind, visibility, rain, pressure, UV); **ArcGauge** for UV; sunrise/sunset strip from `weather.astro`.
6. **Hourly** — open panel; stronger selected chip; POP micro-bar from existing `h.pop`.
7. **7-day** — open list rows + range bars; active left accent.
8. **Risk** — severity-colored story strip (`wx-risk-story`), not generic warning card chrome.
9. **Consensus** — compact strip; only available models; POP when present in data.
10. **Typography** — temp ≫ condition ≫ insight ≫ metrics ≫ meta labels.
11. **Spacing** — wider desk gaps; mobile section rhythm.
12. **Sidebar** — lighter, less dominant.
13. **Live status** — `wx-live-quiet` demoted vs weather.
14. **Motion** — short ease transitions; reduced-motion safe.
15. **Desktop layout** — **hero-led**: `wx-desk-top` = wide hero + side (alert / 7-day / cities); hourly full width; conditions mid-row.
16. **Mobile** — same priority stack (hero → risk → hourly → 7-day → conditions…).

---

## 3. Components / data reused

- `WeatherCharacter`, `WeatherIcon`, `SeverityDot`, `DataStatusPill` / banner  
- `HeroClouds`, `RainAmbient`, `heroSkyStyle`, `skyClass`, `heroCloudMode`  
- `HourlyTempChart`, `SparkTemp` (lazy)  
- `ModelConsensusCard`  
- Existing fields only: `current.*`, `daily`, `hourly`, `astro.sunrise/sunset`, `d0.uv`, `alerts`, multi-model pack  
- Briefing / travel / school / agri **text builders unchanged**

---

## 4. Logic intentionally left untouched

- All fetches & weather math, POP calibration, alert engine  
- AI chat, crop intelligence, geocode, routing, prefs  
- `hourIdx` / `dayIdx` selection behavior (visual only)  
- No new routes or API shapes  

---

## 5. Dependencies added

**None.**

---

## 6. Performance

- CSS transforms/opacity/gradients; UV arc = one SVG path  
- No canvas, no particle systems, no new animation libraries  
- Night stars = CSS backgrounds  
- Lighter blur on open panels vs full glass stack  
- `prefers-reduced-motion` disables lifts / arc transition / stars twinkle  

---

## 7. Desktop result

Immersive hero column (~1.55fr) with character-in-scene; side column for risk + 7-day + cities; full-width hourly; conditions strip + UV/sun; AQI; brief / decisions below.

## 8. Mobile result

Hero-first environment; open panels; metric strip wraps to 2 columns; same feature set, not a shrunk desktop.

---

## 9. Known limitations

- Reference **map** and city **search field** in the inspiration image are **not** added (would be new features / chrome).  
- UV arc max scale is a fixed display scale (0–12) for the existing UV index — not a new data source.  
- Must redeploy + clear service worker to see on live Vercel host.  
- Some grouping remains for brief/decisions/AQI where hierarchy needs a surface.

---

## Deploy

```bash
npm i && npm run build && vercel --prod
```

Then: unregister SW + clear site data → hard refresh Home.
