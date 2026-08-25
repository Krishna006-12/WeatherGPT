# WeatherGPT — Vercel pe UPDATE (bilkul step-by-step)

Tumhara naya code yahan hai: **`weathergpt`** folder  
Purana live link: https://weather-gpt-delta.vercel.app/

Neeche **Method A (GitHub — best)** full detail mein hai.  
Agar GitHub nahi aata to **Method B (CLI)** use karo.

---

# METHOD A — GitHub + Vercel (recommended)

## PART 1: Code apne computer pe lao

### Step 1 — Folder download
1. Arena workspace se poora **`weathergpt`** folder apne laptop pe copy/download karo  
2. Confirm karo andar ye files hain:
   - `package.json`
   - `vercel.json`
   - `src/App.jsx`
   - `src/services/geocode.js`  ← naya unlimited city search

### Step 2 — Terminal kholo
- **Windows:** PowerShell ya Git Bash  
- **Mac:** Terminal  
- Folder ke andar jao:

```bash
cd path/to/weathergpt
```

Example:
```bash
cd Desktop/weathergpt
```

### Step 3 — Dependencies (optional check)
```bash
npm install
npm run build
```
Agar `built in …` dikhe → code theek hai.

---

## PART 2: GitHub pe repo banao

### Step 4 — GitHub login
1. Browser mein jao: https://github.com  
2. Login / Sign up

### Step 5 — Naya repository
1. Right-top **+** → **New repository**  
2. Repository name: `weathergpt` (kuch bhi chalega)  
3. **Public** choose karo  
4. **README add mat karo** (empty repo better)  
5. **Create repository** dabao  
6. Jo URL dikhe copy karo, jaise:  
   `https://github.com/YOUR_USERNAME/weathergpt.git`

### Step 6 — Code push (laptop terminal)

```bash
cd path/to/weathergpt

git init
git branch -M main
git add .
git commit -m "WeatherGPT: unlimited city search + selection build"

git remote add origin https://github.com/YOUR_USERNAME/weathergpt.git
git push -u origin main
```

> Agar poochhe username/password:  
> Password ki jagah **GitHub Personal Access Token** use karo  
> (GitHub → Settings → Developer settings → Personal access tokens)

Push successful → GitHub pe files dikhengi.

---

## PART 3: Vercel pe jodna / update

### Option A1 — PURANA project update (same URL rakhni ho)

1. https://vercel.com/login → login (GitHub se best)  
2. **Dashboard** → purana project dhoondo: **`weather-gpt-delta`** (ya jo naam hai)  
3. Project kholo → **Settings** (top)  
4. Left: **Git**  
5. Agar koi purana repo connected hai:
   - **Disconnect** karo (optional but clean)
6. **Connect Git Repository** → apna naya `weathergpt` repo select  
7. **Settings → General** mein check:

| Field | Value |
|--------|--------|
| Framework Preset | **Vite** |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js Version | **20.x** |

8. **Deployments** tab → **Redeploy**  
   - “Use existing Build Cache” **OFF** rakho pehli baar  
9. 1–2 min wait → **Visit** pe click  
10. Same URL pe naya app: https://weather-gpt-delta.vercel.app/

### Option A2 — BILKUL NAYA project (naya URL OK hai)

1. Vercel Dashboard → **Add New… → Project**  
2. Import **`weathergpt`** GitHub repo  
3. Framework **Vite** auto aana chahiye  
4. Build settings upar jaisi table  
5. **Deploy**  
6. Naya URL milega jaise: `https://weathergpt-xxx.vercel.app`  
7. Ye URL judges ko do

---

## PART 4: Baad mein har baar UPDATE kaise kare

Code change ke baad laptop pe:

```bash
cd path/to/weathergpt
git add .
git commit -m "update: my changes"
git push
```

Vercel **auto deploy** karega (1–2 min).  
Manual: Deployments → ⋮ → **Redeploy**

---

# METHOD B — Vercel CLI (bina GitHub bhi)

```bash
cd path/to/weathergpt
npx vercel login
```
Browser open hoga → login allow karo.

### Pehli baar / link
```bash
npx vercel
```
Questions roughly:
- Set up & deploy? **Y**
- Which scope? apna account
- Link to existing project?  
  - Purana update: **Y** → `weather-gpt-delta` choose  
  - Naya: **N** → name `weathergpt`
- Directory? **./** (Enter)
- Want to modify settings? **N**

### Production pe daalo
```bash
npx vercel --prod
```

End mein **Production** URL print hoga — wahi live link.

Har update baad:
```bash
npx vercel --prod
```

---

# METHOD C — ZIP upload (emergency, 5 min)

1. `weathergpt` folder zip karo  
   ⚠️ **`node_modules` folder ZIP mein mat daalna**  
2. https://vercel.com/new  
3. **Upload** / drag-drop  
4. Framework Vite, output `dist`  
5. Deploy  

(Is method se baad ke updates thode mushkil — A/B better)

---

# Deploy ke baad CHECKLIST ✅

Browser mein live URL kholo:

1. [ ] Page load — Kanpur temp dikhe  
2. [ ] Neeche **Cities** tab → search box mein type karo: `Agra` / `Goa` / `Dubai`  
3. [ ] Result pe tap → weather change  
4. [ ] Chat: `Will it rain in Shimla tomorrow?`  
5. [ ] **भाषा** → Hindi OK  
6. [ ] Alerts → **Simulate RED alert**  
7. [ ] Farm + Forecast charts  
8. [ ] Phone Chrome se bhi try (hard refresh: Ctrl+Shift+R)

---

# Common problems

| Problem | Fix |
|---------|-----|
| Purana UI aa raha hai | Hard refresh / Redeploy **without cache** |
| Build failed | Output Directory = `dist` (not `build`) |
| 404 refresh pe | `vercel.json` commit hona chahiye (pehle se hai) |
| Blank white page | Browser console dekho; build log Vercel pe check |
| Git push auth fail | Personal Access Token use karo |
| “No Git connected” | Settings → Git → Connect repo |

---

# Short cheatsheet

```text
1. weathergpt folder laptop pe
2. GitHub repo banao + git push
3. Vercel → purana project Git reconnect  OR  new import
4. Build: npm run build | Output: dist
5. Deploy / Redeploy
6. Live URL test (city search!)
7. Judges ko link bhejo
```

---

**Naya feature jo ab deploy hoga:**  
Cities tab pe **koi bhi city search** (Agra, Nashik, Shimla, Dubai…) — list limited nahi.  
Chat mein bhi city name se weather nikalega.
