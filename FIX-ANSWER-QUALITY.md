# Why answers felt "not AI" + fix

## What you saw
`pune me wheaat ke irrigation`
→ long Hinglish **textbook** on CRI stages  
→ Source: **Google Gemini (general knowledge)**  
→ **No live Pune temp/rain**

## Root cause
1. Intent Router treated it as **general** (typo `wheaat` / irrigation path miss on older deploy)
2. General path = no Open-Meteo → model dumps generic farm theory (feels like Wikipedia, not ChatGPT copilot)

## Fix in this build
1. Router: irrigation / wheaat / gehun / sinchai / fasal → **always weather_crop**
2. `normalizeCropHint()` maps wheaat→wheat
3. Weather AI prompt:
   - First line = **YES/NO/WAIT** decision from **LIVE** numbers
   - Short What weather is doing + What to do (24–48h)
   - Max ~160 words, no long CRI essay unless asked
   - Hinglish when user writes Hinglish
4. Live snapshot injected into prompt so model must use real °C / POP%

## After deploy expect
```
pune me wheaat ke irrigation
```
Source: `Groq+tools` or `Google Gemini+tools · … · Pune`  
Body starts like: **Abhi sinchai wait/delay** — Pune mein X°C, baarish chance Y% …

## Deploy
```powershell
npx vercel --prod
```
Then hard refresh. Must use **new** api/chat.js (irrigation → route weather).
