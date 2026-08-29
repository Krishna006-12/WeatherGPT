# Why UI "fix nahi ho raha" tha

## Screenshot diagnosis
- Hero = only clouds + H/L pills (big temp missing)
- Mobile chrome + desktop chrome both showing (LIVELIVE, icons pile)
- `SEVERE` glued to `Open-Meteo model`

## Root cause
1. **Hero content used Tailwind class `z-[3]`**
2. Live CSS sometimes **missing many Tailwind utilities** (or SW served old CSS)
3. `.dash-hero::before` veil is `z-index: 2` → content without z-index sits **under** the dark veil → invisible temp
4. `hidden` / `lg:flex` missing → mobile + desktop headers stack

## Fix in this build (permanent)
1. Hero content class **`pg-hero-content`** with plain CSS `z-index: 5` (always)
2. **CRITICAL LAYOUT LOCK** block in `index.css` — flex/grid/hidden/lg breakpoints without Tailwind
3. `mobile-only-chrome` / `desktop-only-chrome` plain CSS split
4. Badge classes `pg-badge` + `pg-badge-source` (never glue)
5. `@source` for Tailwind + `cssCodeSplit: false`
6. Clean `index.html` (no merge conflict markers)

## Deploy steps (must do fully)
```bash
cd your/weathergpt
# use THIS zip / pull latest

# kill old PWA cache after deploy:
# Chrome → Application → Service Workers → Unregister
# Application → Clear storage → clear
# Ctrl+Shift+R

npm i
npm run build
npx vercel --prod
```

### Verify live HTML has NO conflicts
View-source → search `<<<<<<` → must be zero.

### Verify CSS
Network tab → main `.css` file size should be ~90KB+ and contain string `pg-hero-content`.
