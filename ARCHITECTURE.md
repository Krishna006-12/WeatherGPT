# WeatherGPT chat architecture

```
USER
  ↓
Intent Router          (routeIntent / isWeatherRelated)
  ↓
  ├── General question
  │       ↓
  │   AI Provider Manager
  │       ↓
  │   Groq → OpenRouter → Gemini → OpenAI
  │       ↓
  │   Response Validator
  │
  └── Weather / Crop question
          ↓
       Open-Meteo           (toolWeather)
          ↓
       Crop/Weather Engine  (compact pack + place resolve)
          ↓
       AI Provider Manager
          ↓
       Groq → OpenRouter → Gemini → OpenAI
          ↓
       Response Validator   (no empty / mid-cut / missing numbers)
          ↓
        UI

If EVERYTHING fails
          ↓
   Rules + Weather Data     (deterministicAnswer — free forever)
```

## API response fields
| Field | Meaning |
|--------|---------|
| `route` | `general` \| `weather` |
| `mode` | `llm_general` \| `llm_grounded` \| `deterministic_*` |
| `provider` | e.g. `groq:llama-…` \| `gemini-3.6-flash` \| `rules+tools` |
| `pipeline` | `{ intent, steps[], fallback }` for debug/demo honesty |
| `tools.weather` | Open-Meteo pack (null on general) |

## Env (any subset)
```
GROQ_API_KEY=
OPENROUTER_API_KEY=
GEMINI_API_KEY=          # or key1,key2
OPENAI_API_KEY=          # optional paid
```

## Files
- `api/chat.js` — full pipeline (server)
- `src/App.jsx` — UI calls `/api/chat`, brands Groq/OpenRouter/Gemini source lines


## Multi-model NWP (2026-08)

See **MULTI-MODEL.md** and `api/_lib/multiModel.js`. Primary forecast remains Open-Meteo best_match on `/api/weather`; multi-model aggregate on `/api/models` (ECMWF IFS · GFS · ICON · AIFS). Frontend must not fan-out model URLs.
