# Gemini WeatherGPT pe — Baby steps (Windows)

Pehle ye samjho:
- Key browser (Vercel website) pe add hoti hai
- `/home/user/...` mat use karo — wo Arena ka path hai
- Tumhara folder: Desktop pe `weathergpt`

---

## PART A — Nayi Gemini key banao (2 minute)

1. Chrome / Edge kholo
2. Ye link kholo: https://aistudio.google.com/apikey
3. Google account se login
4. Button: **Create API key** (ya Get API key)
5. Key copy karo (ek baar dikhegi)
6. Notepad mein temporarily save kar lo (kisi se share mat karna)

Agar pehli key screenshot mein aa chuki thi → pehle usko Delete karo, phir nayi banao.

---

## PART B — Vercel pe key daalo (sabse zaroori)

### B1. Vercel kholo
1. https://vercel.com kholo
2. Login (GitHub/Google se jo pehle use kiya)

### B2. Sahi project chuno
1. **Dashboard** pe projects list dikhegi
2. Jis project se tumhari live WeatherGPT site chalti hai — **uspe click**
   - Name kuch aisa ho sakta hai: weathergpt, weather-gpt, phantom-c715, etc.
3. Confirm: project ke andar **Domains** ya **Deployments** mein wahi URL ho jo browser mein kholte ho

### B3. Environment Variable add
1. Upar tabs mein **Settings** pe click
2. Left side **Environment Variables** pe click
3. **Add New** / **Create new** pe click

**Pehli variable:**

| Field | Kya likho |
|--------|-----------|
| Key (name) | `GEMINI_API_KEY` |
| Value | apni Gemini key paste (poori) |
| Environment | **Production** MUST tick. Preview bhi tick kar sakte ho. |

4. **Save** dabao

**Dusri variable (optional but good):**

| Field | Kya likho |
|--------|-----------|
| Key | `GEMINI_MODEL` |
| Value | `gemini-3.6-flash` |
| Environment | Production (same) |

5. **Save**

### B4. Galati check
- Name mein space mat do: `GEMINI_API_KEY` bilkul aisa
- Value ke aas-paas `"` quotes mat lagao
- Extra space mat chhodo key ke peeche

### B5. Redeploy (bina iske key kaam nahi karti)
1. Upar **Deployments** tab
2. Sabse upar wali deployment (Latest)
3. Right side **⋯** (three dots)
4. **Redeploy** click
5. Confirm Redeploy
6. Wait jab tak status **Ready** ho (1–3 min)

---

## PART C — Check ki Gemini ON hai

### C1. Browser test
1. Apni live site URL copy karo, example:
   `https://something.vercel.app`
2. End mein ye jod do:
   `/api/chat`
3. Poora link aisa:
   `https://something.vercel.app/api/chat`
4. Enter

### C2. Kya dikhna chahiye (SUCCESS)
JSON mein ye lines:

```text
"llm_configured": true
"gemini": true
```

### C3. Agar ab bhi false hai
- Galat Vercel **project** pe key daali
- Production tick nahi tha
- Redeploy nahi kiya
- Typo: `GEMINI_API_KEY` galat spell

Phir se B2–B5 repeat karo.

---

## PART D — App mein Gemini dikhao

1. Live WeatherGPT site kholo
2. **Ctrl + Shift + R** (hard refresh)
3. Chat tab
4. Likho: `Kanpur weather kaisa hai?`
5. Send
6. Reply ke neeche / source pe dekho:
   `Google Gemini+tools` ya `gemini-3.6-flash`

Agar purana answer aaye:
- Chrome DevTools (F12) → Application → Service Workers → Unregister
- Site data clear → reload

---

## PART E — (Optional) Windows local

Sirf tab jab PC pe `npm run dev` se chalana ho.

1. Folder:
   ```text
   C:\Users\HP\OneDrive\Desktop\weathergpt
   ```
2. Check `scripts\local-api-server.mjs` hai ya nahi
   - Nahi hai to pehle full project copy chahiye (Arena zip / complete repo)
3. PowerShell:
   ```powershell
   cd C:\Users\HP\OneDrive\Desktop\weathergpt
   npm install
   ```
4. Key file:
   ```powershell
   notepad .env.local
   ```
   Andar sirf:
   ```text
   GEMINI_API_KEY=your_new_key
   GEMINI_MODEL=gemini-3.6-flash
   ```
   Save close
5. Do windows:
   - Window1: `npm run api`  → wait “GEMINI_API_KEY: SET”
   - Window2: `npm run dev` → browser URL kholo

Judges ke liye PART B (Vercel) kaafi hai. Local optional hai.

---

## One-page cheat sheet

```text
1. aistudio.google.com/apikey → new key
2. vercel.com → sahi project → Settings → Environment Variables
3. GEMINI_API_KEY = key  (Production ✓)
4. Deployments → ⋯ → Redeploy → Ready
5. https://YOUR-SITE.vercel.app/api/chat → gemini true
6. Site hard refresh → chat test
```
