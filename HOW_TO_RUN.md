# WeatherGPT - Kaise Run Kare (Full Guide in Hindi)

## 📦 Abhi Kya Bana Hai?

1. **Frontend:** React + Tailwind - `src/App.jsx` (Phone UI 430px)
2. **Backend:** Express server - `server.js` (Port 3001)
3. **Database:** `database.json` - JSON file (Free, auto-create hota hai, Supabase se replace kar sakte ho)

---

## 🚀 Local Me Run Kaise Kare (Tumhare Laptop/PC Par)

### Step 1: Code Download Karo
```bash
# Agar GitHub se:
git clone <your-repo>
cd weathergpt

# Ya ye folder download karke
```

### Step 2: Install Dependencies
```bash
npm install
```
Ye frontend + backend dono ke dependencies install kar dega (react, express, cors)

### Step 3: Do Terminal Kholna (Important!)

**Terminal 1 - Backend (Database + API):**
```bash
cd weathergpt
npm run server
```
Output:
```
✅ WeatherGPT Backend running on http://0.0.0.0:3001
📁 Database: .../database.json
```

**Terminal 2 - Frontend (UI):**
```bash
cd weathergpt
npm run dev
```
Output:
```
VITE ready in 200ms
Local: http://localhost:5173/
```

### Step 4: Browser Me Kholna
- Frontend: http://localhost:5173
- Backend Health: http://localhost:3001/api/health

Agar dono chal rahe hain to UI me top pe **"Backend: Connected ✓"** green badge dikhega. Agar backend band hai to "Local mock" dikhega - tab bhi app chalega (fallback).

---

## 🧪 API Test Kaise Kare (Postman / curl)

```bash
# Health check
curl http://localhost:3001/api/health

# Lucknow weather
curl http://localhost:3001/api/weather/lucknow

# Alerts
curl http://localhost:3001/api/alerts?city=mumbai&active=true

# Chat (main endpoint)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Will it rain in Lucknow tomorrow?","language":"en"}'

# Simulate alert
curl -X POST http://localhost:3001/api/alerts/simulate \
  -H "Content-Type: application/json" \
  -d '{"city_key":"mumbai","severity":"red"}'

# Locations
curl http://localhost:3001/api/locations
```

---

## 🌐 Free Me Online Deploy Kaise Kare (SIH ke liye)

### Option A: Sabse Easy - Vercel (Frontend + Backend ek saath)

1. **GitHub par push karo:**
```bash
git init
git add .
git commit -m "WeatherGPT SIH prototype"
git branch -M main
git remote add origin https://github.com/<your-username>/weathergpt.git
git push -u origin main
```

2. **Vercel.com par jao:**
- Login with GitHub
- "Add New Project" -> tumhara repo select karo
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables: `VITE_API_URL = https://your-backend.onrender.com` (backend deploy ke baad)
- Deploy

3. **Backend ke liye Render.com (Free):**
- Render.com par account
- New Web Service -> GitHub repo connect
- Build Command: `npm install`
- Start Command: `npm run server`
- Port: 3001
- Free tier select -> Deploy
- URL milega: `https://weathergpt-backend.onrender.com`
- Isko Vercel env me daalo

### Option B: Full Free Stack - Supabase (Real Database)

`database.json` ko Supabase se replace karna hai to:

1. supabase.com -> New Project
2. SQL Editor me ye chalao (file `supabase-schema.sql` dekho)
3. `.env` me:
```
VITE_SUPABASE_URL=https://xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://your-backend.onrender.com
```
4. `server.js` me `loadDB/saveDB` ko supabase client se replace (code comment me likha hai)

**Free Limits:**
- Vercel: Unlimited hobby projects
- Render: 750 hrs/month free (1 service always free)
- Supabase: 500MB DB, 50k users free - SIH ke liye kaafi

---

## 📱 Phone Me Kaise Chalaye?

Vercel deploy ke baad jo link milega (e.g. `https://weathergpt.vercel.app`), usko phone browser me khol lo - responsive hai, 430px phone frame auto center hota hai.

PWA banana hai to `vite-plugin-pwa` add kar sakte ho.

---

## 🔧 Common Problems

**1. Port already in use:**
```bash
# 3001 busy ho to:
PORT=3002 npm run server
# aur .env me VITE_API_URL=http://localhost:3002 kar do
```

**2. Backend Connected nahi dikh raha:**
- Check karo Terminal 1 me server chal raha hai?
- `http://localhost:3001/api/health` browser me kholo - JSON aana chahiye
- CORS error ho to server.js me `cors({origin:true})` hai, refresh karo

**3. npm install fail:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**4. Build fail:**
```bash
npm run build
# dist folder banta hai - isko Vercel automatically banata hai
```

---

## 🎯 SIH Demo Ke Liye Final Checklist

- [ ] `npm run server` + `npm run dev` dono chal rahe hain
- [ ] Frontend pe green badge "Backend: Connected"
- [ ] Chat me 4 test queries try kiye
- [ ] Advisory Card dikh raha hai
- [ ] Alerts tab me red alert
- [ ] Language toggle EN/HI/MR
- [ ] `database.json` file bani hai (auto)
- [ ] GitHub push + Vercel deploy link ready

PPT me ye likhna:
> "Full-stack: React frontend + Express backend + JSON file DB (Supabase-ready). Free tier deployment on Vercel + Render. Retrieve-then-phrase architecture prevents hallucination."

---

## 📂 Folder Structure

```
weathergpt/
├── src/
│   ├── App.jsx          # Main UI (phone frame + all screens)
│   ├── lib/api.js       # Backend API client
│   └── index.css        # Tailwind + design tokens
├── server.js            # Express backend + API routes
├── database.json        # Auto-created DB (free)
├── .env                 # API URL config
├── vite.config.js       # Vite config (host 0.0.0.0 for preview)
├── package.json         # Scripts: dev, server, build
└── HOW_TO_RUN.md        # Ye file
```

---

Koi error aaye to screenshot bhejo, main fix kar dunga!
