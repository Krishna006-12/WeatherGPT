# Vercel deploy ≠ GitHub upload

Ye **do alag kaam** hain:

| Command | Kahan jata hai |
|---------|----------------|
| `npx vercel --prod` | Sirf **Vercel** (live website) |
| `git push` | Sirf **GitHub/GitLab** (code history) |

`npm i && npm run build && npx vercel --prod` se site live hoti hai,  
lekin **Git pe kuch auto-push nahi hota** — isliye "git par upload nahi hota".

---

## Ek baar setup (GitHub pe pehli baar)

### 1) GitHub pe naya repo banao
- https://github.com/new  
- Name: `weathergpt` (public/private jo chaho)  
- **README mat add karo** agar local pe pehle se code hai  
- Create repository  
- Jo URL mile copy karo, jaise:  
  `https://github.com/YOUR_USERNAME/weathergpt.git`

### 2) Git Bash — apne project folder mein

```bash
cd ~/Desktop/weathergpt
# ya jahan project hai:
# cd /c/Users/HP/OneDrive/Desktop/weathergpt
```

### 3) Remote jodo (abhi tumhare project pe remote nahi tha)

```bash
git remote -v
# agar khali hai:
git remote add origin https://github.com/YOUR_USERNAME/weathergpt.git
```

Agar galat remote pehle se ho:

```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/weathergpt.git
```

### 4) Code commit + push

```bash
git add -A
git status
git commit -m "feat: multi-AI chat, weather router, deploy-ready"
git branch -M main
git push -u origin main
```

Login maange to:
- GitHub username  
- Password jagah **Personal Access Token** (Settings → Developer settings → PAT)

SSH use karte ho to:

```bash
git remote add origin git@github.com:YOUR_USERNAME/weathergpt.git
git push -u origin main
```

---

## Har baar ka normal flow (fix)

```bash
cd ~/Desktop/weathergpt   # apna path

# 1) changes save on GitHub
git add -A
git commit -m "update: describe what changed"
git push

# 2) live site on Vercel
npm i
npm run build
npx vercel --prod
```

Short:

```bash
git add -A && git commit -m "update" && git push
npm run ship
```

(`npm run ship` = `build` + `vercel --prod` — Git nahi)

---

## Optional: Vercel ko GitHub se auto-deploy

1. Vercel Dashboard → Project → Settings → Git  
2. **Connect Git Repository** → apna `weathergpt` repo  
3. Phir sirf `git push` se bhi deploy ho sakta hai (build Vercel pe chalegi)

Iske baad bhi env keys (`GROQ_API_KEY`, `GEMINI_API_KEY`, …) Vercel pe hi rehti hain — Git mein mat daalna.

---

## Kabhi mat commit karo

- `.env` / `.env.local` / API keys  
- `node_modules/`  
- `.vercel/` (local link)

`.gitignore` mein ye already block hain.

---

## Check commands

```bash
git remote -v          # origin URL dikhna chahiye
git status             # clean after commit
git log -1 --oneline   # last commit
```

### Common errors

| Error | Fix |
|-------|-----|
| `fatal: No configured push destination` | `git remote add origin <url>` |
| `rejected non-fast-forward` | `git pull origin main --rebase` phir `git push` |
| `Authentication failed` | PAT token / `gh auth login` |
| Push ho gaya lekin site purani | Alag se `npx vercel --prod` ya Git-connect enable karo |

---

## Seedha jawab

> "vercel se upload link milta hai par git pe nahi jata"

**Sahi behaviour hai.**  
Vercel = hosting link.  
Git = `git remote` + `git push` alag se.

Pehle `git remote add origin ...` + `git push` karo — tab GitHub pe code dikhega.
