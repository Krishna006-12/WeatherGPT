# CRITICAL: Frontend must be redeployed for Gemini source in chat

## What we found
- Server `/api/chat` → Gemini works (`mode: llm_grounded`, provider gemini-3.6-flash)
- Live site JS bundle `index-DTVhbX6r.js` is OLD
  - NO string "Google Gemini"
  - Crop answers use **client rules** → source "Open-Meteo + IMD"

So API key is fine. **UI code on Vercel is old.**

## Fix (Windows) — 5 minutes

1. Download latest `weathergpt-deploy.zip` from Arena (or copy full project)
2. Open PowerShell:
```powershell
cd C:\Users\HP\OneDrive\Desktop\weathergpt
```
3. Replace project files with new zip contents (especially `dist/`, `api/`, `src/`)
   OR if you use git: pull latest then:
```powershell
npm install
npm run build
npx vercel --prod
```
4. Wait Ready
5. Open live URL
6. F12 → Application → Service workers → **Unregister**
7. Ctrl+Shift+R
8. Chat: `Kanpur weather kaisa hai?`
9. Source MUST say: **Google Gemini+tools · gemini-… · Kanpur**

## How to know frontend is new
View page source / Network → main JS file name should NOT stay forever as
`index-DTVhbX6r.js` — new hash after deploy (e.g. index-B_….js)

## Crop "wheat"
After new frontend:
- Tries Gemini first with crop=wheat + Kanpur coords
- Source: Google Gemini+tools
- If Gemini fails: "Client rules + Open-Meteo (Gemini API not used)"
