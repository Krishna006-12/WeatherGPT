/**
 * Chat client helpers — abortable fetch, error taxonomy, stage labels.
 * Backend `/api/chat` is request/response JSON (not SSE). True token streaming
 * would need a separate SSE route; we progressive-reveal the final answer in UI.
 */

export const CHAT_TIMEOUT_MS = 22_000

/** Ordered status lines — never fake % */
export function chatStageLabels(lang = 'en') {
  if (lang === 'hi') {
    return {
      classify: 'सवाल समझ रहे हैं…',
      weather: 'लाइव मौसम पढ़ रहे हैं…',
      forecast: 'पूर्वानुमान जाँच…',
      crop: 'फसल संकेत विश्लेषण…',
      analyze: 'स्थितियाँ समझ रहे हैं…',
      ai: 'AI जवाब तैयार…',
      rules: 'नियम इंजन से जवाब…',
      reveal: 'जवाब दिखा रहे हैं…',
      cancel: 'रद्द किया',
      offline: 'ऑफ़लाइन — कैश/नियम से…',
    }
  }
  return {
    classify: 'Understanding your question…',
    weather: 'Reading live weather…',
    forecast: 'Checking forecast…',
    crop: 'Analyzing crop signals…',
    analyze: 'Analyzing conditions…',
    ai: 'Composing AI answer…',
    rules: 'Building rules-based answer…',
    reveal: 'Showing answer…',
    cancel: 'Cancelled',
    offline: 'Offline — using cache/rules…',
  }
}

/**
 * Classify network / API failures for UI (no secrets).
 */
export function classifyChatError(err, resJson = null) {
  const msg = String(err?.message || err || resJson?.error || '')
  const status = err?.status || resJson?.status
  const llm = String(resJson?.llmError || resJson?.raw?.llmError || '')

  if (err?.name === 'AbortError' || /abort|cancelled|canceled/i.test(msg)) {
    return {
      code: 'cancelled',
      retryable: false,
      en: 'Request cancelled.',
      hi: 'अनुरोध रद्द।',
    }
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      code: 'offline',
      retryable: true,
      en: 'You appear offline. Reconnect, or ask again for a rules-based answer on cached weather.',
      hi: 'आप ऑफ़लाइन लगते हैं। कनेक्ट करें, या कैश मौसम पर नियम-आधारित जवाब फिर पूछें।',
    }
  }
  if (/timeout|504/i.test(msg) || status === 504) {
    return {
      code: 'timeout',
      retryable: true,
      en: 'Weather AI timed out. Showing fallback when available — try a shorter question.',
      hi: 'AI समय समाप्त। फ़ॉलबैक उपलब्ध हो तो दिखेगा — छोटा सवाल आज़माएँ।',
    }
  }
  if (/quota|rate limit|429|RESOURCE_EXHAUSTED|exceeded your current/i.test(msg + llm) || status === 429) {
    return {
      code: 'quota',
      retryable: true,
      en: 'AI quota busy. Grounded rules + live weather still work — try again shortly.',
      hi: 'AI कोटा व्यस्त। नियम + लाइव मौसम चलते हैं — थोड़ी देर बाद कोशिश करें।',
    }
  }
  if (/HTML from \/api\/chat|SPA fallback|api missing/i.test(msg) || status === 404) {
    return {
      code: 'api_missing',
      retryable: false,
      en: 'Chat API not deployed on this host — using on-device weather brain.',
      hi: 'चैट API यहाँ नहीं — ऑन-डिवाइस मौसम ब्रेन।',
    }
  }
  if (/Bad JSON|malformed|invalid json/i.test(msg)) {
    return {
      code: 'malformed',
      retryable: true,
      en: 'Malformed AI response. Please try again.',
      hi: 'AI जवाब विकृत। फिर कोशिश करें।',
    }
  }
  if (/Failed to fetch|NetworkError|ECONN|network/i.test(msg)) {
    return {
      code: 'network',
      retryable: true,
      en: 'Network error reaching the server. Check connection and retry.',
      hi: 'सर्वर से नेटवर्क त्रुटि। कनेक्शन जाँचें।',
    }
  }
  if (status >= 500) {
    return {
      code: 'provider',
      retryable: true,
      en: 'AI provider failed. Fallback rules may still answer from live weather.',
      hi: 'AI प्रदाता असफल। फ़ॉलबैक नियम लाइव मौसम से जवाब दे सकते हैं।',
    }
  }
  return {
    code: 'unknown',
    retryable: true,
    en: msg.slice(0, 160) || 'Something went wrong.',
    hi: msg.slice(0, 160) || 'कुछ गड़बड़ हुई।',
  }
}

/**
 * Abortable POST /api/chat
 */
export async function postChatApi(payload, { signal, timeoutMs = CHAT_TIMEOUT_MS } = {}) {
  const ac = new AbortController()
  const onOuter = () => ac.abort()
  if (signal) {
    if (signal.aborted) {
      const e = new Error('cancelled')
      e.name = 'AbortError'
      throw e
    }
    signal.addEventListener('abort', onOuter, { once: true })
  }
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: ac.signal,
    })
    const textBody = await res.text()
    const ms = Math.round(
      (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0,
    )
    if (textBody.trimStart().startsWith('<')) {
      return {
        ok: false,
        error: 'HTML from /api/chat (SPA fallback — api missing)',
        status: res.status,
        ms,
      }
    }
    let j
    try {
      j = JSON.parse(textBody)
    } catch {
      return { ok: false, error: 'Bad JSON from /api/chat', status: res.status, ms }
    }
    if (!res.ok) {
      const errMsg =
        (typeof j.error === 'string' && j.error) ||
        j.error?.message ||
        j.message ||
        `HTTP ${res.status}`
      return { ok: false, error: errMsg, status: res.status, raw: j, llmError: j.llmError, ms }
    }
    return { ...j, ms }
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error('timeout or cancelled')
      err.name = 'AbortError'
      throw err
    }
    throw e
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onOuter)
  }
}

/**
 * Normalize assistant payload into structured chat fields for UI cards.
 * Does not invent weather numbers — only maps existing markdown / meta.
 *
 * Critical: never treat bare ## City title as the whole answer. Trivial API
 * replies are often "## Kanpur\n\n**Now: 32°C**…" with no ### sections — the
 * body must stay visible (as summary/weather_facts or plain markdown).
 */
export function structureAssistantResult(result, lang = 'en') {
  if (!result || typeof result !== 'object') {
    return {
      text: lang === 'hi' ? 'खाली जवाब।' : 'Empty answer.',
      type: 'general',
      confidence: 0.4,
      structured: null,
    }
  }
  const text = String(result.text || '')
  const sections = splitMarkdownSections(text)

  const fromHeading = {
    summary: pickSection(sections, [
      'summary',
      'सारांश',
      'context',
      'संदर्भ',
      "what's happening",
      'overview',
      'executive',
      'अभी',
      'right now',
    ]),
    weather_facts: pickSection(sections, [
      'weather facts',
      'weather',
      'facts',
      'मौसम',
      'impact',
      'प्रभाव',
      'signals',
      'संकेत',
      'outlook',
      'आउटलुक',
      'details',
      'तथ्य',
    ]),
    recommendation: pickSection(sections, [
      'recommend',
      'action',
      'advice',
      'सिफारिश',
      'करें',
      'what you should',
      'irrigation',
      'सिंचाई',
      'next step',
      'अगला',
    ]),
    risk: pickSection(sections, ['risk', 'जोखिम', 'alert', 'caution', 'सावधान', 'warning']),
    timing: pickSection(sections, ['timing', 'समय', 'when', 'window']),
  }

  // Body under ## title (no ###) — this is the real weather brief
  const preamble = String(sections.preamble || '').trim()
  const hasRealSections = Object.values(fromHeading).some((v) => v && String(v).trim())

  let summary = fromHeading.summary || null
  let weather_facts = fromHeading.weather_facts || null

  if (!hasRealSections && preamble) {
    // "## Kanpur\n\n**Now: 32°C**…" → put full body in summary (not the title alone)
    summary = preamble
  } else if (summary && preamble && preamble.length > String(summary).length + 20) {
    // Prefer richer preamble if summary heading was thin
    if (String(summary).trim().length < 40) summary = preamble
  } else if (!summary && !weather_facts && preamble) {
    summary = preamble
  }

  // Never use bare place title as summary — that hid all weather in the UI
  if (summary && isBarePlaceTitle(summary, sections.title)) {
    summary = preamble || null
  }
  if (summary && isBarePlaceTitle(summary, sections.title) && !preamble) {
    summary = null
  }

  const confidence =
    result.confidence != null
      ? Math.round(Number(result.confidence) * (Number(result.confidence) <= 1 ? 100 : 1))
      : null
  const sources =
    result.source || pickSection(sections, ['source', 'स्रोत', 'honesty', 'ईमानदारी']) || null

  const structured = {
    summary,
    weather_facts,
    recommendation: fromHeading.recommendation || null,
    risk: fromHeading.risk || null,
    timing: fromHeading.timing || null,
    confidence,
    sources,
    title: sections.title || null,
  }

  // Only attach structured cards when there is real answer body —
  // confidence+sources alone must NOT flip the UI into empty shells
  const contentful = [structured.summary, structured.weather_facts, structured.recommendation, structured.risk, structured.timing].some(
    (v) => v && String(v).trim().length >= 8,
  )

  let outText = text
  // If we only have free-form body, keep original markdown for MarkdownText
  if (!contentful) {
    return {
      ...result,
      text: outText,
      structured: null,
    }
  }

  // Optional: normalize to ### cards only when original had no usable markdown body
  if (!/^##\s/m.test(outText) && contentful) {
    outText = ensureStructuredMarkdown(structured, lang, result)
  }

  return {
    ...result,
    text: outText,
    structured,
  }
}

/** Title-only strings like "Kanpur" / "Dubai" must not replace the weather body */
function isBarePlaceTitle(value, title) {
  const v = String(value || '')
    .trim()
    .replace(/\*\*/g, '')
  if (!v) return true
  if (v.length > 48) return false
  // single token / short place-like, no digits (temps), no weather words
  if (/\d/.test(v)) return false
  if (/°|temp|rain|humid|wind|pop|mm|forecast|overcast|clear|cloud|barish|mausam|°c/i.test(v)) return false
  if (title && v.toLowerCase() === String(title).replace(/^🌾\s*/, '').trim().toLowerCase()) return true
  // one or two words, no punctuation heavy content
  if (/^[\p{L}\s.'-]{2,40}$/u.test(v) && v.split(/\s+/).length <= 3) return true
  return false
}

function splitMarkdownSections(text) {
  const lines = String(text || '').split('\n')
  let title = null
  const map = {}
  let cur = null
  let buf = []
  const preambleLines = []
  const flush = () => {
    if (cur) map[cur.toLowerCase()] = buf.join('\n').trim()
    buf = []
  }
  for (const line of lines) {
    if (line.startsWith('## ') && !title) {
      title = line.replace(/^##\s+/, '').trim()
      continue
    }
    if (line.startsWith('### ')) {
      flush()
      cur = line.replace(/^###\s+/, '').trim()
      continue
    }
    if (cur) buf.push(line)
    else if (line.trim()) preambleLines.push(line)
  }
  flush()
  return { title, map, preamble: preambleLines.join('\n').trim() }
}

function pickSection(sections, keys) {
  const map = sections.map || {}
  for (const [h, body] of Object.entries(map)) {
    if (keys.some((k) => h.includes(String(k).toLowerCase()))) return body
  }
  return null
}

function ensureStructuredMarkdown(structured, lang, result) {
  const hi = lang === 'hi'
  const parts = []
  const title =
    result.type === 'crop'
      ? hi
        ? '🌾 फसल बुद्धिमत्ता'
        : '🌾 Crop Intelligence'
      : hi
        ? 'मौसम इंटेलिजेंस'
        : 'Weather intelligence'
  parts.push(`## ${title}`)
  if (structured.summary) {
    parts.push(`### ${hi ? 'सारांश' : 'Summary'}`, structured.summary)
  }
  if (structured.weather_facts) {
    parts.push(`### ${hi ? 'मौसम तथ्य' : 'Weather facts'}`, structured.weather_facts)
  }
  if (structured.risk) {
    parts.push(`### ${hi ? 'जोखिम' : 'Risk'}`, structured.risk)
  }
  if (structured.recommendation) {
    parts.push(`### ${hi ? 'सिफारिश' : 'Recommendation'}`, structured.recommendation)
  }
  if (structured.timing) {
    parts.push(`### ${hi ? 'समय' : 'Timing'}`, structured.timing)
  }
  if (structured.confidence != null) {
    parts.push(
      `### ${hi ? 'विश्वास' : 'Confidence'}`,
      `${structured.confidence}% · ${hi ? 'संकेत मात्र, गारंटी नहीं' : 'signal only, not a guarantee'}`,
    )
  }
  if (structured.sources) {
    parts.push(`### ${hi ? 'स्रोत' : 'Sources'}`, String(structured.sources))
  }
  if (parts.length <= 1 && result.text) return result.text
  return parts.join('\n\n')
}

/**
 * Progressive reveal helper — yields growing prefixes of text.
 * Not backend streaming; safe UX layer after a complete payload.
 */
export async function* progressiveReveal(fullText, { signal, chunkMs = 16, charsPerTick = 12 } = {}) {
  const s = String(fullText || '')
  if (!s) {
    yield ''
    return
  }
  // Prefer paragraph boundaries for snappier perceived structure
  let i = 0
  while (i < s.length) {
    if (signal?.aborted) return
    i = Math.min(s.length, i + charsPerTick)
    // snap forward to next space occasionally for cleaner words
    if (i < s.length && s[i] !== ' ' && s[i] !== '\n') {
      const nextSp = s.indexOf(' ', i)
      const nextNl = s.indexOf('\n', i)
      let snap = -1
      if (nextSp >= 0) snap = nextSp
      if (nextNl >= 0 && (snap < 0 || nextNl < snap)) snap = nextNl
      if (snap >= 0 && snap - i < 28) i = snap + 1
    }
    yield s.slice(0, i)
    await new Promise((r) => setTimeout(r, chunkMs))
  }
}
