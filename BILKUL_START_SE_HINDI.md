# WeatherGPT - Bilkul Zero Se Start (1st Year Student Guide)

## Aapko kya chahiye?
1. Laptop/PC (Windows / Mac / Linux koi bhi)
2. Internet
3. 15 minute

---

## STEP 0: Node.js Install Karna (Sirf ek baar)

Ye app chalane ke liye Node.js chahiye - ye free hai.

**Windows:**
1. Google pe jao: "nodejs.org download"
2. nodejs.org khulega -> LTS wala green button dabao (v20)
3. Download hoke .msi file ayegi -> double click -> Next Next Install
4. Install ke baad: Start Menu me "cmd" search karo -> Command Prompt kholo -> likho:
```
node --version
```
Agar v20.x.x dikha to ho gaya!

**Mac:**
1. nodejs.org se download ya terminal me: `brew install node`

---

## STEP 1: Mera Bana Hua Code Download Karna

### Tarika A (Is Arena se - Sabse Easy):
1. Left side me "weathergpt" folder dikh raha hai
2. Har file pe right click karke download kar sakte ho
3. Ya main aapke liye ZIP bana deta hu:

**Terminal me ye likho (yahi Arena me):**
```bash
cd /home/user && zip -r weathergpt.zip weathergpt -x "weathergpt/node_modules/*" "weathergpt/dist/*"
```
Fir file manager se `weathergpt.zip` download kar lo

### Tarika B (GitHub se - Future ke liye):
Agar aap GitHub pe daloge to wahan se clone karna.

---

## STEP 2: Folder Ko Kholna

1. ZIP download hua to usko Extract karo (Right click -> Extract All)
2. `weathergpt` naam ka folder milega
3. Is folder ko Desktop pe rakh do easy ke liye

---

## STEP 3: VS Code Install Karna (Free Code Editor)

1. Google: "vs code download" -> code.visualstudio.com
2. Download -> Install
3. VS Code kholo -> File -> Open Folder -> `weathergpt` folder select karo

---

## STEP 4: Terminal Kholna (VS Code ke andar)

VS Code me:
- Top menu: Terminal -> New Terminal
- Neeche ek black screen khulega - yahi terminal hai

Ya Windows me:
- `weathergpt` folder me jao -> address bar me `cmd` likh ke Enter -> Command Prompt khulega

---

## STEP 5: Dependencies Install Karna (Ek baar)

Terminal me ye likho aur Enter dabao:
```
npm install
```
2-3 minute lagega, bahut saari lines ayengi - darna nahi, ye libraries download ho rahi hain.

Agar error aaye "npm not recognized" to Node.js sahi se install nahi hua - STEP 0 dobara karo.

---

## STEP 6: App Chalana (2 Terminal Chahiye)

### Ye Sabse Important Hai!

**Terminal 1 - Backend (Database):**
Terminal me likho:
```
npm run server
```
Enter dabao. Aisa dikhega:
```
✅ WeatherGPT Backend running on http://0.0.0.0:3001
📁 Database: .../database.json
```
**Is terminal ko band mat karo! Minimize kar do.**

**Terminal 2 - Frontend (Naya Terminal):**
VS Code me: Terminal -> New Terminal (upar + icon)
Naye terminal me likho:
```
npm run dev
```
Enter dabao. Dikhega:
```
VITE v8.2.2 ready in 200ms
Local: http://localhost:5173/
```

**Dono terminals chal rahe hone chahiye ek saath!**

---

## STEP 7: Browser Me App Kholna

Chrome me jao, address bar me likho:
```
http://localhost:5173
```
Enter dabao.

**Aapka WeatherGPT app khul jayega! Phone jaisa dikhega!**

Top pe check karo:
- Agar "Backend: Connected ✓" green dikhe to backend sahi chal raha hai
- Agar "Local mock" dikhe to Terminal 1 band hai - use dobara chalao

Backend check karne ke liye alag tab me kholo:
```
http://localhost:3001/api/health
```
JSON dikhna chahiye.

---

## STEP 8: App Kaise Use Kare?

App khulne ke baad:

1. **Chat me type karo:**
   - "Will it rain in Lucknow tomorrow?" -> Enter
   - "Is there any warning for my area?"
   - "Should I irrigate my field this week?" -> Advisory Card ayega (judge impress hoga)
   - "Give me aviation briefing" -> Mana karega (anti-hallucination demo)

2. **Neeche chips pe click karo** - quick questions

3. **Bottom me 3 tabs:**
   - 💬 Chat - main screen
   - ⚠️ Alerts - active alerts dekho, click karke detail
   - 📍 Locations - Lucknow, Mumbai, Guwahati switch karo

4. **Top pe:**
   - EN/HI/MR buttons - language badlo, pura UI translate hoga
   - Sky Strip (32°C Lucknow) pe click karo -> locations khulenge

5. **Simulate Alert button** dabao Alerts tab me - red alert demo

---

## STEP 9: Band Kaise Kare?

Dono terminals me jao, `Ctrl + C` dabao (2 baar).
Terminal band ho jayega.

Dobara chalana ho to STEP 6 se repeat.

---

## STEP 10: Free Me Online Dalna (SIH PPT ke liye link chahiye)

### Vercel pe Frontend (2 min):

1. github.com pe account banao (free)
2. New Repository -> naam: weathergpt -> Create
3. VS Code terminal me:
```
git init
git add .
git commit -m "SIH prototype"
git branch -M main
git remote add origin https://github.com/TUMHARA_USERNAME/weathergpt.git
git push -u origin main
```
(TUMHARA_USERNAME ki jagah apna GitHub username)

4. vercel.com pe jao -> Sign up with GitHub -> Add New Project -> weathergpt select -> Deploy

5. 1 minute me link milega: `https://weathergpt-xyz.vercel.app` - ye PPT me daal do!

### Backend ke liye Render.com:

1. render.com pe sign up
2. New Web Service -> GitHub repo connect
3. Build Command: `npm install`
4. Start Command: `npm run server`
5. Deploy -> URL milega `https://weathergpt-backend.onrender.com`
6. Vercel me jaake Settings -> Environment Variables -> `VITE_API_URL` = tumhara Render URL -> Redeploy

---

## 🆘 Common Problems

**Q: npm install me error?**
A: `npm cache clean --force` fir `npm install`

**Q: Port 3001 already in use?**
A: Terminal me: `npx kill-port 3001` fir `npm run server`

**Q: Backend Connected nahi aa raha?**
A: Terminal 1 me server chal raha hai kya check karo. http://localhost:3001/api/health kholo.

**Q: VS Code me terminal nahi khul raha?**
A: Windows me folder me Shift + Right Click -> Open PowerShell window

---

## 📹 Video Jaisa Samjho

Soch lo 2 dukaan hai:
- **Dukaan 1 (Backend - 3001):** Godown hai, saara samaan (weather data) yahan rakha hai
- **Dukaan 2 (Frontend - 5173):** Showroom hai, customer yahan aata hai

Dono dukaan khuli honi chahiye tab customer ko samaan milega. Ek band to dusri local samaan se kaam chalati hai.

---

Bas itna hi! Ab try karo. Kahi atko to mujhe exact error bhejo.
