/**
 * POST /api/chat
 * Body JSON: { message, lat, lon, name, lang }
 *
 * Hybrid AI:
 *  1) Always fetch live weather tools (grounding)
 *  2) If GEMINI_API_KEY or OPENAI_API_KEY set → LLM phrases answer from tool JSON only
 *  3) Else → deterministic grounded template (no fake "neural" claim)
 *
 * GET /api/chat → capability discovery
 */

const UA = { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.2-chat' }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

async function fetchJson(url, ms = 14000) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, { headers: UA, signal: c.signal })
    const text = await r.text()
    if (!r.ok) throw new Error('HTTP ' + r.status)
    if (text.trimStart().startsWith('<')) throw new Error('HTML')
    return JSON.parse(text)
  } finally {
    clearTimeout(t)
  }
}

/** Lightweight place extract for server (mirrors client aliases) */
const PLACE_ALIASES = {
  nodia: 'Noida',
  noeda: 'Noida',
  noyda: 'Noida',
  noida: 'Noida',
  gurgaon: 'Gurugram',
  gurugram: 'Gurugram',
  gurgoan: 'Gurugram',
  bombay: 'Mumbai',
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
  calcutta: 'Kolkata',
  madras: 'Chennai',
  dilli: 'Delhi',
  'new delhi': 'Delhi',
  kanpur: 'Kanpur',
  lucknow: 'Lucknow',
}


/** Crop names must NEVER be geocoded as cities (Crop Intelligence is client-side). */
const CROP_BLOCK = new Set(
  [
    'wheat', 'rice', 'maize', 'corn', 'barley', 'millet', 'sorghum', 'sugarcane', 'cotton',
    'potato', 'tomato', 'onion', 'mustard', 'soybean', 'soya', 'groundnut', 'peanut',
    'chickpea', 'chana', 'lentil', 'masoor', 'peas', 'pea', 'pigeon pea', 'pigeonpea',
    'arhar', 'tur', 'apple', 'mango', 'banana', 'grapes', 'grape', 'tea', 'coffee',
    'gehun', 'gehu', 'dhan', 'chawal', 'makka', 'ganna', 'kapas', 'aloo', 'alu', 'tamatar',
    'pyaz', 'sarson', 'bajra', 'jowar', 'jau', 'matar', 'seb', 'aam', 'kela', 'angur',
    'moongphali', 'mungfali', 'paddy', 'cane',
  ].map((x) => x.toLowerCase())
)

function isCropName(q) {
  if (!q) return false
  const t = String(q).toLowerCase().trim().replace(/[?.!,;:]+$/g, '')
  if (CROP_BLOCK.has(t)) return true
  const first = t.split(/\s+/)[0]
  return CROP_BLOCK.has(first)
}

async function geocodePlace(name) {
  if (isCropName(name)) return null
  const q = encodeURIComponent(name)
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=5&language=en&format=json`
  const data = await fetchJson(url, 10000)
  const results = data.results || []
  if (!results.length) return null
  // Prefer India / higher population
  const scored = results
    .map((r) => ({
      ...r,
      _s:
        (r.country_code === 'IN' ? 50 : 0) +
        Math.min(40, Math.log10((r.population || 1) + 1) * 8) +
        (String(r.name).toLowerCase() === String(name).toLowerCase() ? 20 : 0),
    }))
    .sort((a, b) => b._s - a._s)
  const best = scored[0]
  return {
    name: best.name,
    lat: best.latitude,
    lon: best.longitude,
    country: best.country_code,
  }
}

const FAMOUS = [
  'tokyo',
  'osaka',
  'london',
  'paris',
  'dubai',
  'singapore',
  'new york',
  'beijing',
  'shanghai',
  'seoul',
  'bangkok',
  'sydney',
  'melbourne',
  'toronto',
  'moscow',
  'berlin',
  'madrid',
  'rome',
  'istanbul',
  'cairo',
  'chicago',
  'hong kong',
  'los angeles',
  'san francisco',
  'japan',
  'china',
  'usa',
  'uk',
  'france',
  'germany',
  'australia',
  'canada',
  'brazil',
  'noida',
  'mumbai',
  'delhi',
  'bangalore',
  'bengaluru',
]

const PLACE_NOISE = new Set(
  'the a an what where when how is are was were weather forecast rain temp temperature climate please now today tomorrow right just me my of in at for to from'.split(
    ' '
  )
)

function extractPlaceFromMessage(message) {
  if (!message) return null
  const lower = message.toLowerCase()
  // Bare crop query → no place (client handles Crop Intelligence)
  const bare = lower.trim().replace(/[?.!,;:]+$/g, '')
  if (isCropName(bare)) return null
  if (PLACE_NOISE.has(bare) || bare.length < 3) return null
  // aliases first
  for (const [alias, canon] of Object.entries(PLACE_ALIASES)) {
    const re = new RegExp(`(?:^|[^a-z])${alias.replace(/\s+/g, '\\s+')}(?:[^a-z]|$)`, 'i')
    if (re.test(lower)) return canon
  }
  const patterns = [
    /\b(?:weather|forecast|rain|temperature|temp|climate|aqi|travel\s+risk|conditions?)\s+(?:of|in|at|for|near|around)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.']{1,48})/i,
    /\b(?:in|at|for|near|around|of)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.']{1,48})/i,
    /\b([A-Za-z][A-Za-z.']{2,28}(?:\s+[A-Za-z][A-Za-z.']{2,20}){0,2})\s+(?:weather|rain|forecast|temperature|temp|aqi|climate)\b/i,
  ]
  for (const re of patterns) {
    const m = message.match(re)
    if (m?.[1]) {
      let p = m[1]
        .replace(/\b(right\s+now|today|tonight|tomorrow|please|now|risk|weather|forecast)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (p.length >= 2 && !PLACE_NOISE.has(p.toLowerCase()) && !isCropName(p)) return p
    }
  }
  for (const name of FAMOUS) {
    const re = new RegExp(`(?:^|[^a-z])${name.replace(/\s+/g, '\\s+')}(?:[^a-z]|$)`, 'i')
    if (re.test(lower)) return name
  }
  return null
}

async function toolWeather(lat, lon, name) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code` +
    `&timezone=auto&forecast_days=5`
  const data = await fetchJson(url)
  const c = data.current || {}
  const d = data.daily || {}
  return {
    place: name,
    lat,
    lon,
    current: {
      temp_c: c.temperature_2m,
      feels_c: c.apparent_temperature,
      humidity_pct: c.relative_humidity_2m,
      wind_kmh: c.wind_speed_10m,
      weather_code: c.weather_code,
      precip_mm: c.precipitation,
    },
    daily: (d.time || []).map((date, i) => ({
      date,
      max_c: d.temperature_2m_max?.[i],
      min_c: d.temperature_2m_min?.[i],
      rain_mm: d.precipitation_sum?.[i],
      pop_pct: d.precipitation_probability_max?.[i],
      weather_code: d.weather_code?.[i],
    })),
    source: 'Open-Meteo forecast API',
  }
}

function wmoEn(code) {
  const m = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    61: 'Rain',
    63: 'Rain',
    65: 'Heavy rain',
    80: 'Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm/hail',
  }
  return m[code] || `Code ${code}`
}

function deterministicAnswer(wx, message, lang) {
  const hi = lang === 'hi' || /[\u0900-\u097F]/.test(message || '')
  const c = wx.current
  const d0 = wx.daily[0] || {}
  const cond = wmoEn(c.weather_code)
  const q = (message || '').toLowerCase()
  const city = wx.place

  let focus
  if (/rain|baarish|बारिश|precip/.test(q)) {
    focus = hi
      ? `बारिश फोकस: आज संभावना ~${d0.pop_pct ?? '—'}% (~${d0.rain_mm ?? 0} मिमी).`
      : `Rain focus: today chance ~${d0.pop_pct ?? '—'}% (~${d0.rain_mm ?? 0} mm).`
  } else if (/irrigat|sinchai|सिंचाई|farm|कृषि/.test(q)) {
    const pop = d0.pop_pct ?? 0
    focus = hi
      ? pop >= 55
        ? `कृषि: बारिश संभावना अधिक (${pop}%) — सिंचाई टालने पर विचार।`
        : `कृषि: बारिश संभावना ${pop}% — हल्की सिंचाई सुबह बेहतर हो सकती है।`
      : pop >= 55
        ? `Farm: rain chance high (${pop}%) — consider delaying irrigation.`
        : `Farm: rain chance ${pop}% — light morning irrigation may be ok.`
  } else {
    focus = hi ? 'सामान्य स्थिति सारांश।' : 'General situation summary.'
  }

  if (hi) {
    return (
      `## ${city}\n\n` +
      `### अभी\n**${Math.round(c.temp_c)}°C** (महसूस ${Math.round(c.feels_c)}°C), ${cond}, नमी ${Math.round(c.humidity_pct)}%, हवा ${Math.round(c.wind_kmh)} किमी/घं।\n\n` +
      `### आज\nउच्च/न्यून **${Math.round(d0.max_c)}°/${Math.round(d0.min_c)}°**, बारिश संभावना **${d0.pop_pct ?? '—'}%**.\n\n` +
      `### ${focus}\n\n` +
      `### स्रोत\nOpen-Meteo (live tool). यह उत्तर **नियम-आधारित grounded** मोड में है` +
      (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
        ? ' (LLM key मौजूद होने पर भी tool-first)।'
        : ' — सर्वर पर LLM key सेट नहीं।')
    )
  }
  return (
    `## ${city}\n\n` +
    `### Now\n**${Math.round(c.temp_c)}°C** (feels ${Math.round(c.feels_c)}°C), ${cond}, humidity ${Math.round(c.humidity_pct)}%, wind ${Math.round(c.wind_kmh)} km/h.\n\n` +
    `### Today\nHigh/low **${Math.round(d0.max_c)}°/${Math.round(d0.min_c)}°**, rain chance **${d0.pop_pct ?? '—'}%**.\n\n` +
    `### ${focus}\n\n` +
    `### Source\nOpen-Meteo (live tool). This reply is **deterministic grounded** mode` +
    (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
      ? ' (tool-first even when LLM keys exist).'
      : ' — no LLM API key configured on server.')
  )
}

async function callGemini(model, system, user, apiKey) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: system + '\n\n' + user }] }],
    generationConfig: { temperature: 0.25, maxOutputTokens: 900 },
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) {
    const msg = j.error?.message || 'Gemini HTTP ' + r.status
    const err = new Error(msg)
    err.status = r.status
    err.raw = j
    throw err
  }
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
  if (!text.trim()) throw new Error('Gemini empty response')
  return text
}

async function llmPhrase(wx, message, lang, extra = {}) {
  // Default: current Google Flash (gemini-2.0-flash was retired)
  const preferred = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const geminiFallbacks = [
    preferred,
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash-001',
    'gemini-flash-latest',
    'gemini-1.5-flash',
  ]
  // unique preserve order
  const geminiModels = [...new Set(geminiFallbacks.filter(Boolean))]

  const system =
    'You are WeatherGPT, a careful bilingual (EN/HI) weather assistant for India. ' +
    'You MUST only use facts from the provided JSON tool result (Open-Meteo live pack). ' +
    'Never invent temperatures, rain %, alerts, AQI, or sources. ' +
    'If a field is missing, say it is unavailable. ' +
    'Do not claim to be a private foundation model. ' +
    'Keep answers scannable: short markdown with ## title, ### Now, ### Today/Outlook, ### What you should do, ### Source. ' +
    'In the Source section write exactly: Google Gemini + Open-Meteo (tool-grounded). ' +
    'Numbers must match the tool JSON. ' +
    (extra.crop
      ? 'User asked about crop "' +
        extra.crop +
        '". Give crop×weather guidance only from weather JSON + general agronomy; no fake yield/disease diagnosis. Title must be Crop Intelligence, not a city named after the crop. '
      : '') +
    (lang === 'hi' ? 'Answer in Hindi (Devanagari).' : 'Answer in clear English.')

  const user =
    `User question: ${message}\n\n` +
    (extra.crop ? `Crop context: ${extra.crop}\n\n` : '') +
    `Place for this weather pack: ${wx.place || 'unknown'}\n\n` +
    `Tool weather JSON (authoritative):\n${JSON.stringify(wx).slice(0, 12000)}`

  // Prefer Google Gemini when key is present — try models until one works
  if (process.env.GEMINI_API_KEY) {
    const errors = []
    for (const model of geminiModels) {
      try {
        const text = await callGemini(model, system, user, process.env.GEMINI_API_KEY)
        return { text, provider: model, mode: 'llm_grounded' }
      } catch (e) {
        errors.push(model + ': ' + (e.message || e))
        continue
      }
    }
    throw new Error(errors.slice(0, 3).join(' | ') || 'All Gemini models failed')
  }

  if (process.env.OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error?.message || 'OpenAI HTTP ' + r.status)
    const text = j.choices?.[0]?.message?.content || ''
    if (!text.trim()) throw new Error('OpenAI empty')
    return { text, provider: process.env.OPENAI_MODEL || 'gpt-4o-mini', mode: 'llm_grounded' }
  }

  return null
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  // Readable stream (Node)
  if (req[Symbol.asyncIterator]) {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c)))).toString(
      'utf8'
    )
    if (!raw) return {}
    return JSON.parse(raw)
  }
  return {}
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method === 'GET') {
    const hasGemini = !!process.env.GEMINI_API_KEY
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    return res.status(200).json({
      ok: true,
      service: 'WeatherGPT hybrid chat',
      preferred_llm: 'google_gemini',
      gemini_model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      default_mode: hasGemini ? 'llm_grounded_gemini' : hasOpenAI ? 'llm_grounded_openai' : 'deterministic_grounded',
      llm_configured: hasGemini || hasOpenAI,
      llm_providers: {
        gemini: hasGemini,
        openai: hasOpenAI,
      },
      contract:
        'POST JSON { message, lat, lon, name?, lang?, crop? }. Tools (Open-Meteo) always first. Gemini phrases tool JSON only when GEMINI_API_KEY set.',
      honesty: '/HONESTY.txt',
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST JSON body required' })
  }

  try {
    const body = await readBody(req)
    const message = String(body.message || body.q || '').trim().slice(0, 2000)
    let lat = parseFloat(body.lat)
    let lon = parseFloat(body.lon)
    let name = String(body.name || 'Area').slice(0, 48)
    const lang = body.lang === 'hi' ? 'hi' : 'en'

    if (!message) return res.status(400).json({ ok: false, error: 'message required' })

    // Crop-only messages must never re-ground tools onto a geocoded "Wheat" place.
    // Client handles Crop Intelligence; server keeps body lat/lon/name (current city).
    const cropOnlyMsg = isCropName(message) || isCropName(String(message).trim().split(/\s+/)[0])

    // If user named another city in the message, re-ground tools there
    // (fixes "travel risk in Noida" while client still sends home=Kanpur).
    // Never geocode crop names (wheat/rice/…) — Crop Intelligence is client-side.
    let placeOverride = null
    try {
      if (!cropOnlyMsg) {
        const mentioned = extractPlaceFromMessage(message)
        if (mentioned && !isCropName(mentioned)) {
          const geo = await geocodePlace(mentioned)
          if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
            const sameName = String(geo.name).toLowerCase() === String(name).toLowerCase()
            const dist =
              Number.isFinite(lat) && Number.isFinite(lon)
                ? Math.hypot(geo.lat - lat, geo.lon - lon)
                : 99
            if (!sameName || dist > 0.35) {
              lat = geo.lat
              lon = geo.lon
              name = geo.name
              placeOverride = geo
            }
          }
        }
      }
    } catch {
      /* keep body coords */
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ ok: false, error: 'lat lon required for grounding' })
    }

    const wx = await toolWeather(lat, lon, name)
    let mode = 'deterministic_grounded'
    let provider = 'rules+tools'
    let text
    let llmError = null

    const cropHint = body.crop ? String(body.crop).slice(0, 48) : null

    try {
      const llm = await llmPhrase(wx, message, lang, { crop: cropHint })
      if (llm?.text) {
        text = llm.text
        mode = llm.mode
        provider = llm.provider
      }
    } catch (e) {
      llmError = e.message
    }

    if (!text) {
      text = deterministicAnswer(wx, message, lang)
      mode = 'deterministic_grounded'
      provider = 'rules+tools'
    }

    // If client somehow hit API with bare crop, do NOT present place as the crop name
    if (cropOnlyMsg && isCropName(name)) {
      name = 'Area'
      text =
        (lang === 'hi'
          ? '## 🌾 फसल बुद्धिमत्ता\n\nफसल का नाम स्थान नहीं है। ऐप के Crop Intelligence (client) का उपयोग करें।\n\n'
          : '## 🌾 Crop Intelligence\n\nA crop name is not a location. Use the app Crop Intelligence path.\n\n') + text
    }

    return res.status(200).json({
      ok: true,
      mode,
      provider,
      answer: text,
      place: { name, lat, lon, overridden: !!placeOverride },
      tools: { weather: wx },
      citations: [{ name: 'Open-Meteo', role: 'Live forecast tool' }],
      llmError: llmError || undefined,
      honesty:
        mode === 'llm_grounded'
          ? 'LLM phrasing only; numbers from tools'
          : 'No LLM used — deterministic grounded templates',
      fetchedAt: Date.now(),
    })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'chat error' })
  }
}
