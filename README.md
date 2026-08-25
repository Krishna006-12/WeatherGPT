# WeatherGPT ☀️  
### AI Weather Intelligence for India — Hackathon Edition

**Live pitch line:** *“IMD-style alerts + bilingual AI chat + krishi advisories — every answer source-attributed.”*

---

## 🎯 Problem
Generic weather apps fail Indian users:
- No trustworthy **alert plain-language** (“what this means for *me*”)
- Weak **Hindi-first** experience
- Zero **farm irrigation / spray** guidance tied to local rain & soil signals
- Black-box answers with **no source citations**

## ✅ Solution
**WeatherGPT** is a mobile-first AI weather copilot for India:

| Pillar | What judges see |
|--------|-----------------|
| **Chat** | EN/HI intent AI grounded on live weather · confidence + citations |
| **Alerts** | Yellow / Amber / Red thresholds · official-style bulletin · “means for you” |
| **Farm** | Soil moisture model · irrigation advice · spray window · crop tags |
| **Forecast** | Hourly + 5-day charts · live Open-Meteo |
| **Cities** | 15 India metros · GPS snap · IMD station IDs |
| **Demo superpower** | One-tap **Simulate RED alert** for live pitch |

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React UI   │────▶│  AI Intent Brain │────▶│  Grounded reply │
│  EN ⇄ HI    │     │  rain/alert/agri │     │  + confidence   │
└──────┬──────┘     └────────▲─────────┘     └─────────────────┘
       │                     │
       ▼                     │
┌─────────────┐     ┌────────┴─────────┐
│ Open-Meteo  │────▶│ Weather pack     │
│ (live free) │     │ + IMD thresholds │
└─────────────┘     └──────────────────┘
       │
       ▼ offline fallback pack (demo never dies)
```

## 🚀 Run locally

```bash
cd weathergpt
npm install
npm run dev
```

Open the printed URL (binds `0.0.0.0:5173`).

```bash
npm run build    # production bundle
npm run preview  # serve build
```

## 🎤 90-second judge script

1. Open app → **Kanpur / Lucknow** live temp loads.  
2. Tap demo chip: *“Will it rain in Lucknow tomorrow?”* → sourced answer.  
3. Switch **हिंदी** → ask *“क्या सिंचाई करूँ?”* → krishi advisory.  
4. **Alerts** tab → hit **⚡ Simulate RED alert** → bulletin + chat push.  
5. **Farm** + **Forecast** tabs → charts & soil meter.  
6. Info (ⓘ) → architecture / production path.

## 🆓 Production free tier
- **Web:** Vercel  
- **DB:** Supabase (locations, alert log, chat audit)  
- **LLM:** Gemini free tier for open-ended chat (current brain is deterministic + grounded — swap-ready)  
- **SMS:** MSG91 / Twilio on RED  
- **Official:** IMD authorised API when licensed; thresholds already IMD-aligned

## 📁 Key files
- `src/services/weather.js` — fetch, cache, alert engine, agri model, offline pack  
- `src/services/ai.js` — bilingual intent + grounded answers  
- `src/data/cities.js` — India cities + IMD IDs + crop profiles  
- `src/App.jsx` — shell, tabs, demo simulation  

## 🛡️ Honesty note
Alert *wording* follows IMD colour categories for UX; live colour triggers use model precipitation/wind/code thresholds on Open-Meteo data. Production should merge authorised IMD warning polygons.

---

Built to **win selection** · India-first · demo-bulletproof
