# Fix: Gemini key ON but still Open-Meteo source

## Live error (we checked your site)
```
llmError: API key not valid. Please pass a valid API key.
```

So Vercel *has* some GEMINI_API_KEY value, but **Google rejects it**.

## Baby steps to fix the KEY

### 1) New key from Google
1. Open https://aistudio.google.com/apikey
2. Delete old keys (especially any that leaked in screenshots)
3. **Create API key**
4. Copy the FULL key (starts with `AIza...`, long)

### 2) Fix on Vercel (exact)
1. vercel.com → project that serves **weather-gpt-delta.vercel.app**
2. Settings → Environment Variables
3. Find `GEMINI_API_KEY` → **Edit** (or delete + add new)
4. Paste key:
   - NO quotes `"..."`
   - NO space before/after
   - full key
5. Environments: **Production** + **Preview** both tick
6. Optional: `GEMINI_MODEL` = `gemini-2.5-flash`
7. Save

### 3) Redeploy
Deployments → ⋯ → Redeploy → Ready

### 4) Prove key works
Open:
https://YOUR-URL.vercel.app/api/chat

Look for:
- gemini_key_length: should be ~39 (not 0, not tiny)
- llm_configured: true

Then ask in chat. Source should become Google Gemini+tools.

### 5) If still invalid
- Key from wrong Google account vs Studio project
- Generative Language API not enabled on that Google Cloud project
- Key restricted to wrong APIs / HTTP referrers (for server key use **no app restriction** or IP none; API restriction allow Generative Language API)
- Copied only part of key

### 6) SW cache
Unregister service worker + hard refresh after deploy.
