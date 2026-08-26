# WeatherGPT + Google Gemini — Easy Setup (Windows)

## 0) Security first
If you pasted your Gemini key in a terminal that was visible in a screenshot or chat:
1. Open https://aistudio.google.com/apikey
2. Delete / rotate that key
3. Create a **new** key
4. Use only the new key below

Never commit `.env.local` to GitHub.

---

## Path mistake (what went wrong)

| Wrong (Arena Linux) | Right (your PC) |
|---------------------|-----------------|
| `/home/user/weathergpt` | `C:\Users\HP\OneDrive\Desktop\weathergpt` |

Always `cd` into **your** Desktop folder first.

---

# Way A — Production only (EASIEST for SIH demo)

Use this if you only need the live Vercel site to use Gemini.

### Steps
1. Open https://vercel.com → login
2. Open your **WeatherGPT** project
3. **Settings** → **Environment Variables**
4. Add:
   - Name: `GEMINI_API_KEY`
   - Value: *(your new key)*
   - Environment: Production (and Preview if you want)
5. Optional second variable:
   - Name: `GEMINI_MODEL`
   - Value: `gemini-3.6-flash`
6. **Deployments** → latest → **Redeploy**  
   OR on PC in project folder:
   ```bash
   npx vercel --prod
   ```
7. Open your live URL → hard refresh (Ctrl+Shift+R)
8. Chat mein sawal poocho → source line mein dikhna chahiye:
   `Google Gemini+tools · gemini-3.6-flash`

### Check without UI
```bash
curl https://YOUR-APP.vercel.app/api/chat
```
Should show `"gemini": true` and `"llm_configured": true`.

---

# Way B — Local on Windows (dev + Gemini)

Your Desktop folder must contain these files (from the full Arena project, not an old copy):

```
weathergpt/
  api/chat.js
  scripts/local-api-server.mjs
  package.json
  src/
  ...
```

If `scripts\local-api-server.mjs` is **missing**, copy the latest project from Arena zip
`weathergpt-deploy.zip` **or** pull the full repo that includes `scripts/`.

### Step 1 — Open terminal in the right folder
PowerShell or Git Bash:

```bash
cd C:\Users\HP\OneDrive\Desktop\weathergpt
dir
```

You should see `package.json`, `api`, `src`.

### Step 2 — Install once
```bash
npm install
```

### Step 3 — Create env file (NEW key)
PowerShell:

```powershell
cd C:\Users\HP\OneDrive\Desktop\weathergpt
@"
GEMINI_API_KEY=YOUR_NEW_KEY_HERE
GEMINI_MODEL=gemini-3.6-flash
"@ | Set-Content -Encoding utf8 .env.local
```

Git Bash / CMD style:

```bash
cd /c/Users/HP/OneDrive/Desktop/weathergpt
cat > .env.local << 'EOF'
GEMINI_API_KEY=YOUR_NEW_KEY_HERE
GEMINI_MODEL=gemini-3.6-flash
EOF
```

### Step 4 — Two terminals

**Terminal 1 — API (Gemini):**
```bash
cd C:\Users\HP\OneDrive\Desktop\weathergpt
npm run api
```
Wait for:
```text
GEMINI_API_KEY: SET
model: gemini-3.6-flash
```

**Terminal 2 — Website:**
```bash
cd C:\Users\HP\OneDrive\Desktop\weathergpt
npm run dev
```
Open the URL it prints (usually http://localhost:5173).

### Step 5 — Test
Browser chat: `Kanpur weather kaisa hai?`  
Footer/source: **Google Gemini+tools**

Or:
```bash
curl http://127.0.0.1:8787/api/chat
```

---

## Errors you hit — meaning

| Error | Meaning | Fix |
|-------|---------|-----|
| `No such file or directory /home/user/...` | Linux path on Windows | Use `Desktop\weathergpt` |
| `Cannot find module ... local-api-server.mjs` | Old/incomplete folder | Copy full project with `scripts/` |
| `pkill: command not found` | Linux command | Windows pe ignore; just close the terminal |
| `llm_configured: false` | Key not loaded | Fix `.env.local` + restart `npm run api` |

---

## After it works

- Keep using **Way A (Vercel)** for the link you share with judges.
- Local is only for development.
