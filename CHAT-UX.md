# Chat UX upgrade (WeatherGPT)

## Goals
- Useful loading **stages** (no fake %)
- Structured answers: summary · weather facts · recommendation · risk · confidence · sources
- Cancel in-flight request + block duplicate submits
- Error taxonomy: cancel / offline / timeout / quota / api_missing / malformed / network / provider
- Progressive **reveal** of complete answer (backend is JSON, not SSE — no fake token stream)

## Architecture
| Piece | Role |
|-------|------|
| `api/chat.js` | One-shot JSON response (unchanged) |
| `src/services/chatClient.js` | `postChatApi` (abortable + timeout), stages, `classifyChatError`, `structureAssistantResult`, `progressiveReveal` |
| `src/App.jsx` `onSend` | Request id + `AbortController`, stage callbacks, structure + reveal, crop/place/follow-up preserved |
| `src/components/ChatTab.jsx` | Stage copy, Cancel button, dedupe submit, streaming caret |
| `src/components/ChatIntelligence.jsx` | Renders markdown sections **or** structured prop cards |

## Stages (labels only — never %)
`classify` → `weather` / `forecast` / `crop` → `ai` or `rules` → `reveal`

## Cancel / dedupe
- Send while `chatLoading` is ignored (composer + chips)
- Cancel aborts fetch + stops progressive reveal
- New send after cancel starts a fresh `reqId`

## Streaming policy
True SSE would need a new route. UI “stream” = client progressive reveal **after** full grounded payload so numbers never drift mid-token.

## Preserve
- Crop route + `cropContext` follow-ups
- Multilingual `lang` (HI/EN)
- Place resolve guards (no crop/noise → Recent)
- Client rules fallback when `/api/chat` fails
