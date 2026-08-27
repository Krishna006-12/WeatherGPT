# Natural ChatGPT-style answers + working Gemini

## What your screenshot showed
1. Source: `Rules+tools · Kanpur (Gemini: gemini-2.5-flash … no longer available)`
2. Body: rigid **NOW / TODAY / SOURCE** template
3. You asked: *Ignore Crop Intelligence… exactly 3 sentences…* — template **ignored your request**

## Why
- Vercel `GEMINI_MODEL` (or code default) was **gemini-2.5-flash**
- Google: that model is **not available to new API keys**
- Server fell back to deterministic rules → form-like answer, not ChatGPT style

## Code fixes
1. Default + priority: **gemini-3.6-flash** (then 3.7, 3.5, flash-latest)
2. Even if env still says 2.5-flash, **3.6 is tried first**
3. If Google suggests `models/gemini-X`, auto-try that model
4. System prompt = natural conversational assistant (follow user format: N sentences, ignore templates)
5. thinkingBudget 0 + maxOutputTokens 2048 (no mid-sentence cut)

## Deploy (required)
```powershell
cd C:\Users\HP\OneDrive\Desktop\weathergpt
# overwrite with latest zip (especially api/chat.js)
npx vercel --prod
```

### Vercel env (Production) — recommended
| Name | Value |
|------|--------|
| GEMINI_API_KEY | (your key) |
| GEMINI_MODEL | **gemini-3.6-flash** |

Remove or change old `gemini-2.5-flash` if set. Redeploy after env change.

### Test
```powershell
curl.exe -s -X POST "https://YOUR-URL/api/chat" -H "Content-Type: application/json" -d "{\"message\":\"In exactly 3 sentences, is Kanpur weather good or bad for wheat, and one uncertainty.\",\"lat\":26.45,\"lon\":80.33,\"name\":\"Kanpur\",\"lang\":\"en\",\"crop\":\"wheat\"}"
```
Expect: `"mode":"llm_grounded"`, `"provider":"gemini-3.6-flash"`, full 3 natural sentences — not NOW/TODAY template.
