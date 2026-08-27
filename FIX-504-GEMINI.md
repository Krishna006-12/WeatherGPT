# Fix: "client fallback (Gemini /api/chat not used)"

## Root cause (verified 2026-08-26)

| Host | GET gemini | POST /api/chat |
|------|------------|----------------|
| weather-gmkhatqc6-phantom-c715.vercel.app | true | **200 in ~6s** · llm_grounded · gemini-3.6-flash |
| weather-gpt-delta.vercel.app | true (key_length 53) | **504 FUNCTION_INVOCATION_TIMEOUT ~20s** |

API key is OK. **Production alias times out** before Gemini finishes (or while trying too many models).

Browser then shows:
`Source: Open-Meteo + IMD … · client fallback (Gemini /api/chat not used)`

## What we fixed in code

1. `api/chat.js`
   - Max **2** model attempts (not 6+)
   - **6s abort** per Gemini call
   - Smaller tool JSON
   - Prefer env `GEMINI_MODEL` first
2. `vercel.json` — `maxDuration: 30` (Pro; Hobby may still cap lower)
3. Client — timed `postChatApi` + clearer error labels

## You must redeploy THIS package

1. Download latest `weathergpt-deploy.zip`
2. On Windows:
```powershell
cd C:\Users\HP\OneDrive\Desktop\weathergpt
# overwrite with zip contents
npx vercel --prod
```
3. Vercel → Project → Settings → Environment Variables (Production):

| Name | Value |
|------|--------|
| `GEMINI_API_KEY` | (your key, no quotes) |
| `GEMINI_MODEL` | `gemini-3.6-flash` |

   Use **gemini-3.6-flash** if that worked on phantom (~6s).  
   Or try `gemini-2.5-flash` if 3.6 is not on your key.

4. After env change: **Redeploy** (Deployments → … → Redeploy). Env alone is not enough if old function is cached on a deployment.

5. Browser: Unregister service worker + Ctrl+Shift+R

6. Test in PowerShell:
```powershell
curl.exe -s -X POST "https://weather-gpt-delta.vercel.app/api/chat" -H "Content-Type: application/json" -d "{\"message\":\"Kanpur weather\",\"lat\":26.45,\"lon\":80.33,\"name\":\"Kanpur\",\"lang\":\"en\"}"
```
Must return `"mode":"llm_grounded"` in **under 15 seconds**, not 504.

7. Chat source should become:
`Google Gemini+tools · gemini-… · Kanpur`

## Quick check which URL you opened

- Prefer opening the **latest production** URL after `vercel --prod`
- Phantom URL that already works: `https://weather-gmkhatqc6-phantom-c715.vercel.app`
- If delta still 504 after redeploy, open Vercel logs for `/api/chat` FUNCTION_INVOCATION_TIMEOUT
