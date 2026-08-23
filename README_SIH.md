# WeatherGPT - SIH Full Stack Prototype (100% Free)

## ✅ Aapka App Ready Hai - Live Preview Dekho

Ye maine aapke diye hue `weathergpt-prototype-prompt.md` ke hisaab se pura working app bana diya hai.

**Features implemented:**
- Sky Strip (live temp + location)
- Chat with source-attributed answers (Source: IMD · updated X min ago)
- Streaming text + typing indicator
- Advisory Card for irrigation (decision support)
- Alerts screen with red/amber/green + Alert Detail modal
- Locations management
- Language toggle EN/HI/MR - working
- Simulate Alert button
- Out-of-scope honest refusal (anti-hallucination)
- 430px phone frame - mobile first
- Design tokens exactly as per brief

---

## 🆓 SIH ke liye Full Stack Free me Kaise Banaye?

### Option 1: Current Prototype (Sabse Fast - Judge ke liye best)
Jo maine banaya hai - **Frontend only + Mock Data**
- No backend needed, 2 min me demo ho jayega
- Host free: **Vercel** par deploy karo
  ```
  npm run build
  vercel --prod
  ```
- Isi ko SIH PPT me dikhao, judges ko mock data pattern samajh aayega

### Option 2: Full Backend + Database (Free Tier)
Agar full backend chahiye to:

**Frontend:** React + Vite (ye wala) -> Vercel (free)
**Backend + DB:** Supabase (free - 500MB DB, Auth, Realtime)
**AI:** Gemini API free tier ya Groq (free, fast)
**Weather API:** OpenWeatherMap free (1000 calls/day)

#### Supabase Setup (5 min):
1. supabase.com par account banao
2. New project -> SQL Editor me ye chalao:

```sql
create table locations (
  id uuid default gen_random_uuid() primary key,
  user_id text,
  city_key text,
  name text,
  created_at timestamp default now()
);

create table weather_cache (
  city_key text primary key,
  current jsonb,
  forecast jsonb,
  alerts jsonb,
  updated_at timestamp default now()
);

create table alerts_history (
  id uuid default gen_random_uuid() primary key,
  city_key text,
  severity text,
  title text,
  official_text text,
  created_at timestamp default now()
);
```

3. `.env` file me:
```
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

4. Code me:
```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// mock data ki jagah:
const { data } = await supabase.from('weather_cache').select('*').eq('city_key', 'lucknow')
```

#### Backend API (optional - Node.js):
`api/` folder banao, Express + supabase:
- `/api/weather?city=lucknow` -> returns cached data
- `/api/parse` -> Gemini se intent parse

Free host: Render.com / Fly.io / Vercel Functions

---

## 🛠️ Kaunsa Tool Use Karu?

| Tool | Best For | Free? | Mera Suggestion |
|------|----------|-------|-----------------|
| **v0.dev** | UI design fast | Limited free | UI ke liye best |
| **Bolt.new** | Full-stack ek prompt me | Free tier hai | **SIH ke liye #1** - ye prompt paste karo |
| **Lovable** | Prototype | Free trial | Good alternative |
| **Cursor / Windsurf** | Code editing | Free trial | Meri tarah code karne ke liye |
| **Replit** | Host + Code | Free | Backend ke saath deploy |
| **This Arena Workspace** | Maine jo banaya | Free | Already working! |

**Mera workflow SIH ke liye:**
1. Is prompt ko Bolt.new me paste karo -> 1st version
2. Yahan jo maine banaya usko copy karo -> polish
3. Supabase add karo -> full stack
4. Vercel par deploy -> link PPT me

---

## 🚀 Deploy Steps (Free)

```bash
cd weathergpt
npm run build
# Vercel CLI
npm i -g vercel
vercel --prod
# Ya GitHub push + Vercel dashboard import
```

---

## 🎯 Judges ko 2 min me kaise dikhana hai?

1. **Chat:** "Will it rain in Lucknow tomorrow?" -> sourced answer
2. **Alert:** "Is there any warning?" -> amber card -> click detail
3. **Agri:** "Should I irrigate my field?" -> Advisory Card (WOW moment)
4. **Anti-hallucination:** "Give aviation briefing" -> honest refusal
5. **Simulate:** Red alert button -> urgency demo
6. **Language:** EN -> HI toggle -> translation working

Har answer me "Source: IMD" dikhega - trust factor.

---

## 📦 Tech Stack Jo Maine Use Kiya

- React + Vite
- Tailwind CSS (tokens: #0F3D5C, #3E7EA6, #F4F8FA etc)
- Mock data in-memory (easily replaceable with Supabase)
- Rule-based parser (replaceable with Gemini API)
- No external deps - pure frontend

Yehi pattern production me: retrieve-then-phrase, never generate-then-hope.

---

Bana diya hai - ab aap download karke Vercel par daal do. Koi doubt ho to pucho!
