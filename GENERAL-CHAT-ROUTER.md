# Weather vs General Gemini router

```
User message
    ↓
Is weather-related? (server isWeatherRelated)
   ↙                    ↘
 YES                     NO
  ↓                       ↓
Open-Meteo tools      General Gemini
  ↓                       ↓
Gemini (grounded)     Gemini (general knowledge)
  ↓                       ↓
mode: llm_grounded    mode: llm_general
route: weather        route: general
```

## Examples
| Question | Route |
|----------|--------|
| Kanpur weather / baarish / wheat irrigation | weather + tools |
| Capital of France / who is PM / 2+2 | general Gemini |
| Ignore crop format — 3 sentences on wheat weather | weather (crop/weather words) |

## Deploy
Overwrite `api/chat.js` + frontend, `npx vercel --prod`.
Set `GEMINI_MODEL=gemini-3.6-flash`.

## UI source lines
- Weather: `Google Gemini+tools · gemini-3.6-flash · Kanpur`
- General: `Google Gemini · general · gemini-3.6-flash`
