# WeatherGPT → Vercel Update Guide

Purana link: https://weather-gpt-delta.vercel.app/

Naya code is folder mein hai (`weathergpt/`). Neeche **3 easy tarike** hain — koi ek choose karo.

---

## Method 1 — Vercel Dashboard (sabse simple, no terminal)

### Pehli baar / naya project
1. Open [vercel.com/dashboard](https://vercel.com/dashboard) → login (GitHub se best)
2. **Add New… → Project**
3. Agar GitHub pe repo nahi hai:
   - Pehle GitHub pe naya repo banao: `weathergpt`
   - Local se push (Method 2 ke git steps)
4. Import repo → Framework: **Vite** (auto-detect)
5. Build settings (auto hona chahiye):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
6. **Deploy** → milega URL jaise `weathergpt-xxx.vercel.app`

### Purane project pe UPDATE (weather-gpt-delta)
1. Vercel Dashboard → project **weather-gpt-delta** (ya jo bhi naam hai)
2. **Settings → Git** check karo — kaunsa GitHub repo connected hai
3. Us repo mein naya code push karo (Method 2)
4. Push ke baad Vercel **auto redeploy** karega
5. Agar auto nahi hua: **Deployments → … → Redeploy**

### Bina GitHub — ZIP upload (fastest emergency)
1. Is folder ko zip karo (`weathergpt` — `node_modules` mat dalna)
2. Vercel Dashboard → project → **Deployments**
3. Kabhi-kabhi **Upload** option dikhta hai; warna:
   - [vercel.com/new](https://vercel.com/new) → “Upload” / drag-drop folder
4. Naya deployment live ho jayega

---

## Method 2 — GitHub + auto deploy (recommended)

```bash
cd weathergpt

# agar pehle se git nahi
git init
git branch -M main
git add .
git commit -m "WeatherGPT selection-ready update"

# GitHub pe naya repo banao (github.com/new), phir:
git remote add origin https://github.com/YOUR_USERNAME/weathergpt.git
git push -u origin main
```

Phir Vercel:
1. Dashboard → **Add New Project** → import `weathergpt`
2. Deploy
3. **Custom domain / same URL chahiye?**  
   Purane `weather-gpt-delta` project ke **Settings → Domains** se domain hatao, naye project pe add karo  
   **YA** purane project ko hi isi GitHub repo se reconnect kar do (Settings → Git → Connect)

### Baad mein har update
```bash
# code change ke baad
git add .
git commit -m "fix: ..."
git push
# Vercel khud build + deploy karega (~1 min)
```

---

## Method 3 — Vercel CLI (terminal se seedha)

```bash
cd weathergpt
npx vercel login          # browser se login
npx vercel                # pehli baar: link/create project
npx vercel --prod         # production URL pe update
```

### Purane project se link
```bash
npx vercel link
# list se weather-gpt-delta choose karo
npx vercel --prod
```

---

## Build settings (agar fail ho)

| Setting | Value |
|--------|--------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node Version | 20.x (Settings → General) |
| Root Directory | `.` (ya monorepo ho to `weathergpt`) |

`vercel.json` pehle se project mein hai — SPA routes ke liye rewrite set hai.

---

## Checklist after deploy

- [ ] Open production URL — Kanpur weather load hota hai?
- [ ] Chat demo chips kaam karte hain?
- [ ] हिंदी toggle OK?
- [ ] Alerts → Simulate RED works?
- [ ] Farm + Forecast charts dikhte hain?
- [ ] Mobile pe try (Chrome) — judges phone se dekhenge

---

## Same old URL rakhni ho (`weather-gpt-delta.vercel.app`)

**Option A:** Us Vercel project ko isi repo se reconnect + redeploy  
**Option B:** Naya deploy karo, phir purane project ke Domains mein naya project assign karo  

Hackathon pitch mein naya clean URL bhi theek hai — judges ko short link do.

---

## Common errors

| Error | Fix |
|-------|-----|
| `404` on refresh | `vercel.json` rewrites already added |
| Blank page | Output must be `dist`, not `build` |
| Build fail Tailwind | `npm install` local pe chalao, lockfile commit karo |
| Old UI still showing | Hard refresh `Ctrl+Shift+R` / Redeploy without cache |

---

**TL;DR for you right now**

1. Code GitHub pe push karo  
2. Vercel pe import / reconnect  
3. `npx vercel --prod` ya Dashboard **Redeploy**  
4. Live link pitch deck + team chat mein bhejo  
