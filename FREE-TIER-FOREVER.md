# Permanent free chat (like other free AI apps)

## Honest truth
**No public Gemini API is unlimited forever on one free key.**  
Google free tier ≈ limited **requests per day (RPD)** + **per minute (RPM)**.  
When you see:

`You exceeded your current quota, please check your plan and billing`

…the **key is fine**, the **daily free allowance is used up** (or RPM spike).

ChatGPT-style apps that feel “always free” usually:
1. Use **their own paid backend** (company pays), or  
2. Stack **free tools + rules** when LLM quota ends, or  
3. Rotate **multiple free keys / projects**.

WeatherGPT now does (2) + (3) on free tier.

---

## What stays FREE forever (no Gemini needed)
| Layer | Cost |
|--------|------|
| Open-Meteo weather tools | Free |
| Rules / crop / rain / irrigation briefs | Free |
| UI + PWA | Free (Vercel hobby) |

App **never dies** when Gemini quota hits — it answers with live Open-Meteo + smart rules.

---

## How to maximize free Gemini (recommended)

### A) Multi-key rotation (best free trick)
1. Open https://aistudio.google.com/apikey  
2. Create **2–3 keys** (ideally **different Google accounts / projects** if one account shares quota)  
3. Vercel → Environment Variables (Production):

```
GEMINI_API_KEY = key1,key2,key3
```
or
```
GEMINI_API_KEY   = key1
GEMINI_API_KEY_2 = key2
GEMINI_API_KEY_3 = key3
```

4. Also set:
```
GEMINI_FREE_TIER = 1
GEMINI_MODEL     = gemini-3.5-flash-lite
```
Lite models usually get **more free requests** than full Flash.

5. **Redeploy** after env change.

Code will try next key when one returns quota/429.

### B) Do NOT enable billing if you want free forever
On Gemini API, **turning on billing can remove free tier** on that project (all calls become paid).  
For permanent free demo: **billing OFF**.

### C) Wait for daily reset
Free RPD often resets on a ~24h window (Google-side).  
After reset, same key works again.

### D) Separate keys for demo vs personal testing
Judges + your testing can burn one key fast — keep a **fresh key** only for SIH demo day.

---

## Paid path (only if you must have ChatGPT volume)
- Google AI Studio → billing / paid tier (costs money)  
- Or `OPENAI_API_KEY` as backup (also paid)

**Not required** for SIH if multi-key + free tools are solid.

---

## Deploy this build
```powershell
cd C:\Users\HP\OneDrive\Desktop\weathergpt
# unzip latest weathergpt-deploy.zip over project
npx vercel --prod
```

### After deploy test
1. Weather Q → live numbers even if source says Open-Meteo free  
2. When Gemini works → `Google Gemini+tools · …`  
3. General Q (capital of France) → needs Gemini; if quota → short free notice (weather path always works)

---

## "Jungle" in source line
That was a bad place parse (noise word), not a real city. Extra noise words were blocked in this build.
