# OpenWeather API key — WeatherGPT pe kaise lagaye

**Goal:** Accurate **live** weather (city + worldwide map samples) — **generate/fake nahi**.

Key **sirf server** pe rehti hai (`api/weather.js`, `api/world-mesh.js`). Browser / Vite bundle mein **kabhi mat dalo**.

---

## 1) Key lo

1. [openweathermap.org](https://home.openweathermap.org/api_keys) → sign up / login  
2. API keys → Create key (free tier OK)  
3. Nayi key **~10 min–2 hr** activate hone mein lag sakti hai  

Free tier typically:

- Current Weather (`/data/2.5/weather`)
- 5 day / 3 hour forecast (`/data/2.5/forecast`)

Agar One Call 3.0 plan hai to app pehle usko try karegi, warna auto **2.5** pe padegi.

---

## 2) Vercel pe env set karo (production)

1. [vercel.com/dashboard](https://vercel.com/dashboard) → project **weather-gpt-delta** (ya jo bhi)  
2. **Settings → Environment Variables**  
3. Add:

| Name | Value | Environments |
|------|--------|----------------|
| `OPENWEATHER_API_KEY` | `your_real_key_here` | Production (+ Preview optional) |

4. **Save**  
5. **Deployments → … → Redeploy** (env tab change ke baad naya deploy zaroori)

CLI se:

```bash
cd weathergpt
npx vercel env add OPENWEATHER_API_KEY production
# paste key when asked
npx vercel --prod
```

---

## 3) Local test (optional)

`weathergpt/.env.local` (git mein mat commit karo):

```bash
OPENWEATHER_API_KEY=your_key_here
```

Phir Vercel dev / `vercel dev` se `/api/weather` chalao — plain `vite` alone serverless `api/` run nahi karta.

---

## 4) App kya karti hai (key ke baad)

| Route | Behaviour |
|--------|-----------|
| `GET /api/weather?lat=&lon=` | **OpenWeather first** → fail ho to Open-Meteo. Response `_source`: `openweather-2.5` / `openweather-onecall` |
| `GET /api/world-mesh` | Worldwide city **live current** (OW) + forecast-hour mesh (OM) — map ke liye |
| Dashboard map | `/api/world-mesh` prefer; radar ab bhi RainViewer |

Numbers **AI se invent nahi** hote — sirf OWM / Open-Meteo JSON.

---

## 5) Verify

Deploy + SW clear ke baad:

1. Koi city open karo → **Data & sources** mein **OpenWeatherMap (live)** dikhna chahiye  
2. Network tab: `/api/weather` → `"_source":"openweather-2.5"` (ya onecall)  
3. World map footer: OpenWeather live current…  

Agar key galat / inactive:

- `_source` wapas `open-meteo*`  
- `provider_chain.errors` mein openweather message  
- Weather **phir bhi live** rahega (OM fallback) — blank / fake nahi

---

## 6) Security — mat karo

- ❌ `VITE_OPENWEATHER_API_KEY`  
- ❌ Key ko `src/` ya client JS mein  
- ❌ Key GitHub pe commit  
- ❌ Key screenshot / public chat mein share (rotate karo agar leak ho)

---

## 7) Limits (free)

OW free RPM/day limited hai. App:

- Weather proxy cache headers (`s-maxage≈120`)
- World mesh `s-maxage≈180` + city list ~28 points, batched

Heavy refresh pe 429 aa sakta hai → OM fallback.

---

## Files touched

- `api/_lib/openWeather.js` — adapter  
- `api/weather.js` — OW primary  
- `api/world-mesh.js` — map live mesh  
- `src/components/LiveWorldMap.jsx` — `/api/world-mesh`  
- `src/services/weather.js` — source labels  
- `.env.example` — `OPENWEATHER_API_KEY=`
