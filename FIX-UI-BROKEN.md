# UI poora "chala gaya" — root cause & fix

## Root cause (verified on live)
Deployed `index.html` contained **Git merge conflict markers**:

```
<<<<<<< HEAD
...
=======
...
>>>>>>> ...
```

Browser then fails to parse head/CSS correctly → huge empty blue area, stuck badges
(`SEVEREOpen-Meteo`, `ModerateUS AQI`), broken layout.

## How it happens
```bash
git pull   # or merge GitHub + local
# conflict in index.html
# someone ran: npm run build && npx vercel --prod
# WITHOUT fixing conflicts first
```

## Never deploy with conflicts
```bash
# BEFORE build/deploy:
grep -R "<<<<<<\|>>>>>>" --include='*.html' --include='*.jsx' --include='*.js' --include='*.css' .
# must print NOTHING

npm run build
npx vercel --prod
```

## Fix now
1. Use clean project (this zip) — local `index.html` has NO conflict markers
2. `npm i && npm run build && npx vercel --prod`
3. Hard refresh + unregister service worker

## Premium feel (also in this build)
- Stronger matte glass cards + hero depth
- Desktop grid fills main column (less empty navy)
- Severity / AQI badges never glue together
- Cleaner AQI ring typography
