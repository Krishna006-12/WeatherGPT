# UI/UX polish (preserve product identity)

Kept: dark navy glass (`#0B1F3A`), matte frosted cards, hero sky + clouds, bento desktop, LIVE/status pills, cat character, bilingual labels.

## Improvements

| Area | Change |
|------|--------|
| **Hero** | Clear hierarchy: location → temp → condition → feels-like + H/L + status pill |
| **Metrics** | Humidity, wind, precip, UV, visibility, pressure tiles (existing + tighter spacing) |
| **24h** | Interactive chart on mobile+desktop; hover/tap tooltip (time, temp, POP, mm, wind); detail strip |
| **7-day** | Scan rows + range bars; hover/active only — no card spam |
| **Models** | `ModelConsensusCard` — ECMWF/GFS/ICON/AIFS when available; consensus + confidence; hide missing |
| **Alerts** | Official vs WeatherGPT risk vs demo badges + inset tone strip |
| **Chat** | `ChatIntelligence` structured cards (Summary / Risk / Action / Timing / Confidence / Sources) |
| **Motion** | Soft rise stagger; reduced-motion disables clouds/rays/rise/chip hover |
| **a11y** | focus-ring, semantic buttons, alert aria-labels, chart tooltip role |
| **Mobile** | Hierarchy: hero → alert → hourly → 7-day → metrics → models → brief → decisions |

## Perf
- Charts `isAnimationActive={false}`
- Models deferred on weak network (`coreOnly`)
- Lazy charts / character unchanged

## Test checklist
- [ ] Desktop bento + consensus row
- [ ] Tablet mid width
- [ ] Mobile stack order
- [ ] Slow 3G / core-only banner
- [ ] `prefers-reduced-motion`
- [ ] Long crop AI answer → section cards
- [ ] Missing weather / empty models (no fake NWP)
- [ ] Official vs risk alert styling
