# Fix: Gemini answers cut mid-sentence

## What was wrong
Source line was correct (`Google Gemini+tools · gemini-3.6-flash`) but body looked like:

```
### Now
* Temperature: 26.1°C (Feels like
```

Server returned only ~75–90 characters. **UI was fine** — Gemini API truncated.

## Why
Gemini 2.5 / 3 Flash uses **thinking tokens** by default.
`thinking` + answer share `maxOutputTokens` (we had 700).
Thinking ate almost all tokens → answer cut mid-word.

## Fix in `api/chat.js`
1. `thinkingConfig: { thinkingBudget: 0 }` — no thinking burn
2. `maxOutputTokens: 2048` — room for full brief
3. Reject replies with `finishReason=MAX_TOKENS` and length < 280 (try next model / rules)
4. Stronger prompt: complete answer, irrigation YES/NO/WAIT
5. `compactWeather()` — smaller tool JSON
6. 12s per-model timeout (full answers need a bit more time)

## Deploy
Redeploy latest zip / project (`api/chat.js` must update on Vercel).
Then hard refresh and ask again:
- `Kanpur weather now`
- `kya wheat ke irrigation karna sahi rahega`

Expect full sections: Now, Outlook, What you should do, Source — not a stub.
