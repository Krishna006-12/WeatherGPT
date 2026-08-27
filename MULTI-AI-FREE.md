# Free smart chat — not only Gemini

Gemini free quota khatam? **Koi baat nahi.** WeatherGPT ab kai free AIs use karta hai.

## Flow
```
User message
    ↓
Weather? ──YES──► Open-Meteo tools ──► AI phrasing
         └──NO───► General AI answer

AI order (first success wins):
  1. Groq          (GROQ_API_KEY)         ← free, fast, no card
  2. OpenRouter    (OPENROUTER_API_KEY)   ← free models, no card
  3. Google Gemini (GEMINI_API_KEY…)      ← free tier / multi-key
  4. OpenAI        (OPENAI_API_KEY)       ← paid
  5. Rules+Open-Meteo                     ← always free forever
```

## Fastest setup for you (5 min)

### Option A — Groq (best free default)
1. Open https://console.groq.com/keys  
2. Create API key (login Google/GitHub, **no billing needed**)  
3. Vercel → Settings → Environment Variables → Production:

| Name | Value |
|------|--------|
| `GROQ_API_KEY` | `gsk_...` |

4. Redeploy  
5. Chat: source line → **`Groq+tools · llama-… · Kanpur`**

### Option B — OpenRouter (many free models)
1. https://openrouter.ai/keys  
2. Create key  
3. Vercel:

| Name | Value |
|------|--------|
| `OPENROUTER_API_KEY` | `sk-or-…` |

4. Redeploy → source **`OpenRouter+tools · …`**

### Option C — Both + Gemini multi-key
Put all three. App auto-falls through if one is rate-limited.

```
GROQ_API_KEY=...
OPENROUTER_API_KEY=...
GEMINI_API_KEY=key1,key2
```

## What stays free forever without any LLM key
- Live weather numbers (Open-Meteo)
- Rain / irrigation / crop rules briefs
- App UI

LLM keys only make answers **sound like ChatGPT**.

## Deploy
```powershell
cd C:\Users\HP\OneDrive\Desktop\weathergpt
# latest zip overwrite
npx vercel --prod
```

## SIH honesty
Say: *“Hybrid free stack — Open-Meteo grounding + optional free LLMs (Groq/OpenRouter/Gemini). Never invents weather numbers.”*


See also ARCHITECTURE.md for the full flowchart.
