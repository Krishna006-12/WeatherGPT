# Premium glass dashboard (reference tablet)

## What changed
Home dashboard rebuilt as a **bento glass layout** matching the reference weather tablet:

### Desktop (lg+)
```
┌──────────────┬────────────────┬─────────────┐
│  HERO        │  Next 7 Days   │  Cities +   │
│  big temp    │  range bars     │  Alerts     │
│  icon+H/L    │                │             │
├──────────────┴────────────────┴─────────────┤
│  Hourly scroll + optional chart               │
├─────────────────────────────┬───────────────┤
│  Overview trend + metrics   │ AQI + Details │
├─────────────────────────────┴───────────────┤
│  AI Brief · Decisions · Sources               │
└───────────────────────────────────────────────┘
```

### Modules (your brief)
1. Dynamic glassmorphism + weather-tinted sky gradients  
2. Animated clouds / rain / sunrays (CSS, light)  
3. Responsive CSS Grid bento  
4. Hero · Hourly · Metrics bento · 7-day bars  
5. Same live data / features — **UI only**

## Deploy
```bash
npm i && npm run build && npx vercel --prod
```
Then unregister SW + hard refresh.

## Note
If UI still broken after deploy, your live `index.html` had Git conflict markers — never deploy unresolved merges.
