/**
 * POST /api/chat
 * Body JSON: { message, lat?, lon?, name?, lang?, crop? }
 *
 * Architecture:
 *   USER → Intent Router
 *     ├─ general  → AI Provider Manager (Groq→OpenRouter→Gemini→OpenAI)
 *     └─ weather/crop → Open-Meteo → Crop/Weather Engine
 *                      → AI Provider Manager → Response Validator → UI
 *   If everything fails → Rules + Weather Data (always free)
 *
 * GET /api/chat → capability discovery
 */

const UA = { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.2-chat' }

/** Normalize one API key string */
function sanitizeKey(raw) {
  let k = String(raw || '').trim()
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  k = k.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '')
  return k
}

/**
 * Free-tier survival: support MULTIPLE Gemini keys.
 * Vercel: GEMINI_API_KEY=key1,key2,key3
 * or GEMINI_API_KEY + GEMINI_API_KEY_2 + GEMINI_API_KEY_3
 * When one hits daily quota, rotate to the next.
 */
function getGeminiKeys() {
  const parts = []
  const primary =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  for (const chunk of String(primary).split(/[,;\n]+/)) {
    const k = sanitizeKey(chunk)
    if (k.length >= 20) parts.push(k)
  }
  for (const envName of ['GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GOOGLE_API_KEY_2']) {
    const k = sanitizeKey(process.env[envName] || '')
    if (k.length >= 20) parts.push(k)
  }
  return [...new Set(parts)]
}

function getGeminiKey() {
  return getGeminiKeys()[0] || ''
}

function isQuotaError(msg) {
  return /quota|rate limit|resource.?exhausted|429|exceeded your current|billing details|RPD|RPM/i.test(
    String(msg || ''),
  )
}

/**
 * Free multi-provider AI (any one key works):
 *  1) GROQ_API_KEY     → https://console.groq.com  (fast, free tier, no card)
 *  2) OPENROUTER_API_KEY → https://openrouter.ai   (free models, no card)
 *  3) GEMINI_API_KEY(s)  → Google AI Studio
 *  4) OPENAI_API_KEY     → paid OpenAI (optional)
 *
 * Order: Groq → OpenRouter free → Gemini → OpenAI
 */
function getOpenAiCompatProviders() {
  const out = []
  const groq = sanitizeKey(process.env.GROQ_API_KEY || '')
  if (groq.length >= 10) {
    const models = String(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile,llama-3.1-8b-instant')
      .split(/[,;]+/)
      .map((m) => m.trim())
      .filter(Boolean)
    out.push({
      id: 'groq',
      label: 'Groq',
      base: 'https://api.groq.com/openai/v1',
      key: groq,
      models: models.length ? models : ['llama-3.3-70b-versatile'],
    })
  }
  const ork = sanitizeKey(process.env.OPENROUTER_API_KEY || '')
  if (ork.length >= 10) {
    const models = String(
      process.env.OPENROUTER_MODEL ||
        'meta-llama/llama-3.3-70b-instruct:free,google/gemma-3-27b-it:free,qwen/qwen-2.5-72b-instruct:free',
    )
      .split(/[,;]+/)
      .map((m) => m.trim())
      .filter(Boolean)
    out.push({
      id: 'openrouter',
      label: 'OpenRouter',
      base: 'https://openrouter.ai/api/v1',
      key: ork,
      models: models.length ? models : ['meta-llama/llama-3.3-70b-instruct:free'],
      headers: {
        'HTTP-Referer': process.env.OPENROUTER_SITE || 'https://weather-gpt-delta.vercel.app',
        'X-Title': 'WeatherGPT',
      },
    })
  }
  const oai = sanitizeKey(process.env.OPENAI_API_KEY || '')
  if (oai.length >= 10) {
    out.push({
      id: 'openai',
      label: 'OpenAI',
      base: 'https://api.openai.com/v1',
      key: oai,
      models: [process.env.OPENAI_MODEL || 'gpt-4o-mini'],
    })
  }
  return out
}

async function callOpenAiCompat(provider, model, system, user, timeoutMs = 20000) {
  const url = provider.base.replace(/\/$/, '') + '/chat/completions'
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + provider.key,
        ...(provider.headers || {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 900,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: ac.signal,
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = j.error?.message || j.message || provider.id + ' HTTP ' + r.status
      const err = new Error(msg)
      err.status = r.status
      throw err
    }
    const text = j.choices?.[0]?.message?.content || ''
    if (!text.trim()) throw new Error(provider.id + ' empty response')
    return text
  } catch (e) {
    if (e && (e.name === 'AbortError' || /aborted/i.test(String(e.message || '')))) {
      throw new Error(provider.id + ' timeout after ' + timeoutMs + 'ms')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** Try Groq / OpenRouter / OpenAI then caller may try Gemini */
async function callCompatLlms(system, user, modeTag) {
  const providers = getOpenAiCompatProviders()
  const errors = []
  let sawQuota = false
  for (const p of providers) {
    for (const model of p.models.slice(0, 3)) {
      try {
        const text = await callOpenAiCompat(p, model, system, user, 18000)
        return {
          text,
          provider: p.id + ':' + model,
          mode: modeTag,
          label: p.label,
        }
      } catch (e) {
        const msg = String(e.message || e)
        errors.push(p.id + '/' + model + ': ' + msg.slice(0, 100))
        if (isQuotaError(msg)) {
          sawQuota = true
          break
        }
        continue
      }
    }
  }
  if (!providers.length) return null
  const err = new Error(
    (sawQuota ? 'QUOTA: ' : '') + (errors.slice(0, 4).join(' | ') || 'compat LLMs failed'),
  )
  err.quota = sawQuota
  err.compatTried = true
  throw err
}


function getGeminiModels() {
  // Free tier: prefer Flash-Lite (higher free RPM/RPD) then Flash.
  // Avoid retired 2.x for new keys. Env GEMINI_MODEL overrides first pick if still valid.
  const envModel = (process.env.GEMINI_MODEL || '').trim().replace(/["']/g, '')
  const BLOCKED = /gemini-2\.5-flash$|gemini-2\.0-flash|gemini-1\.5|gemini-pro$/i
  const freeFirst = (process.env.GEMINI_FREE_TIER || '1') !== '0'
  const preferred =
    envModel && !BLOCKED.test(envModel)
      ? envModel
      : freeFirst
        ? 'gemini-3.5-flash-lite'
        : 'gemini-3.6-flash'
  const list = freeFirst
    ? [
        preferred,
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-flash-latest',
      ]
    : [
        preferred,
        'gemini-3.6-flash',
        'gemini-3.7-flash',
        'gemini-3.5-flash',
        'gemini-flash-latest',
      ]
  if (envModel && BLOCKED.test(envModel)) list.push(envModel)
  return [...new Set(list.filter(Boolean))].slice(0, 4)
}

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
  (
    'the a an what where when how is are was were weather forecast rain temp temperature climate please now today tomorrow right just me my of in at for to from ' +
    'good bad why exactly sentences sentence explain ignore normal format current mention uncertainty recommendation ' +
    'capital france who president history define meaning translate jungle forest mountain river'
  ).split(' ')
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

function deterministicAnswer(wx, message, lang, meta = {}) {
  const hi = lang === 'hi' || /[\u0900-\u097F]/.test(message || '')
  const c = wx.current || {}
  const d0 = (wx.daily && wx.daily[0]) || {}
  const d1 = (wx.daily && wx.daily[1]) || {}
  const cond = wmoEn(c.weather_code)
  const q = (message || '').toLowerCase()
  const city = wx.place || 'your area'
  const temp = Math.round(c.temp_c)
  const feels = Math.round(c.feels_c)
  const hum = Math.round(c.humidity_pct)
  const wind = Math.round(c.wind_kmh)
  const pop = d0.pop_pct ?? '—'
  const rain = d0.rain_mm ?? 0
  const hiT = Math.round(d0.max_c)
  const loT = Math.round(d0.min_c)
  const quotaNote = meta.quota
    ? hi
      ? '\n\n_नोट: Gemini free quota खत्म — यह जवाब Open-Meteo live data + rules से है (पूरी तरह free, permanent)._'
      : '\n\n_Note: Gemini free quota exhausted — this answer uses live Open-Meteo + rules (fully free, always on)._'
    : ''

  let action
  if (/rain|baarish|बारिश|precip|umbrella/.test(q)) {
    action = hi
      ? pop >= 60
        ? `आज बारिश की संभावना ~**${pop}%** (~${rain} मिमी) है — छतरी रखें, खुले काम कम करें।`
        : `बारिश संभावना ~**${pop}%** — हल्की सावधानी काफी; भारी बारिश पक्की नहीं।`
      : pop >= 60
        ? `Rain chance ~**${pop}%** (~${rain} mm) — carry an umbrella and limit exposed outdoor work.`
        : `Rain chance ~**${pop}%** — light caution is enough; heavy rain is not locked in.`
  } else if (/irrigat|sinchai|सिंचाई|wheat|crop|farm|कृषि|फसल|gehun/.test(q)) {
    action = hi
      ? pop >= 55 || rain >= 5
        ? `खेत: बारिश/नमी अधिक (POP **${pop}%**) — **सिंचाई टालें**; जलभराव से जड़ सड़न जोखिम। अनिश्चितता: अगले 24 घंटे की असली बारिश मात्रा।`
        : `खेत: POP **${pop}%** — जरूरत हो तो **हल्की सुबह सिंचाई** ठीक; दोपहर गर्मी/नमी (${hum}%) में स्प्रे टालें।`
      : pop >= 55 || rain >= 5
        ? `Farm: rain/moisture elevated (POP **${pop}%**) — **delay irrigation**; waterlogging risk. Uncertainty: exact mm in next 24h.`
        : `Farm: POP **${pop}%** — light morning irrigation OK if soil is dry; avoid spray in high humidity (${hum}%).`
  } else if (/travel|यात्रा|school|स्कूल/.test(q)) {
    action = hi
      ? `यात्रा/स्कूल: ${cond}, हवा ${wind} किमी/घं — तूफान/ओला हो तो बाहर सीमित रखें; वरना सामान्य सावधानी।`
      : `Travel/school: ${cond}, wind ${wind} km/h — limit outdoor time if storm/hail; otherwise normal caution.`
  } else {
    action = hi
      ? `अभी **${temp}°C** (महसूस ${feels}°C), ${cond}. आज **${hiT}°/${loT}°**, बारिश ~**${pop}%**. ` +
        (pop >= 70 ? 'बाहर नमी/बारिश का ख्याल रखें।' : 'सामान्य दिन की योजना ठीक है।')
      : `Right now **${temp}°C** (feels ${feels}°C), ${cond}. Today **${hiT}°/${loT}°**, rain ~**${pop}%**. ` +
        (pop >= 70 ? 'Plan for wet outdoor conditions.' : 'Ordinary day planning is fine.')
  }

  const tomorrow =
    d1 && d1.max_c != null
      ? hi
        ? `कल संकेत: ~**${Math.round(d1.max_c)}°/${Math.round(d1.min_c)}°**, बारिश ~**${d1.pop_pct ?? '—'}%**.`
        : `Tomorrow signal: ~**${Math.round(d1.max_c)}°/${Math.round(d1.min_c)}°**, rain ~**${d1.pop_pct ?? '—'}%**.`
      : ''

  if (hi) {
    return (
      `## ${city} — लाइव मौसम\n\n` +
      `${action}\n\n` +
      `**अभी:** ${temp}°C (महसूस ${feels}°C), ${cond}, नमी ${hum}%, हवा ${wind} किमी/घं.\n\n` +
      (tomorrow ? `${tomorrow}\n\n` : '') +
      `**स्रोत:** Open-Meteo live tools (free). Numbers are real measurements/forecast — not invented.` +
      quotaNote
    )
  }
  return (
    `## ${city} — live weather\n\n` +
    `${action}\n\n` +
    `**Now:** ${temp}°C (feels ${feels}°C), ${cond}, humidity ${hum}%, wind ${wind} km/h.\n\n` +
    (tomorrow ? `${tomorrow}\n\n` : '') +
    `**Source:** Open-Meteo live tools (free forever). Numbers are real — not invented.` +
    quotaNote
  )
}

async function callGemini(model, system, user, apiKey, timeoutMs = 12000) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`
  // Gemini 2.5/3 Flash: thinking tokens COUNT against maxOutputTokens.
  // Without thinkingBudget:0, answers truncate mid-sentence (~50-100 chars).
  const body = {
    contents: [{ role: 'user', parts: [{ text: system + '\n\n' + user }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      // Disable thinking so the full budget is real answer text
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    let r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    })
    let j = await r.json().catch(() => ({}))
    // Older models may reject thinkingConfig — retry without it + higher tokens
    if (
      !r.ok &&
      /thinking|Unknown name|Invalid JSON|thinkingConfig|thinking_budget/i.test(
        String(j.error?.message || ''),
      )
    ) {
      const body2 = {
        contents: body.contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body2),
        signal: ac.signal,
      })
      j = await r.json().catch(() => ({}))
    }
    if (!r.ok) {
      const msg = j.error?.message || 'Gemini HTTP ' + r.status
      const err = new Error(msg)
      err.status = r.status
      err.raw = j
      throw err
    }
    const cand = j.candidates?.[0] || {}
    // Prefer non-thought parts only
    const parts = cand.content?.parts || []
    const text = parts
      .filter((part) => part && part.text && !part.thought)
      .map((part) => part.text)
      .join('')
    const finish = String(cand.finishReason || '')
    if (!text.trim()) {
      throw new Error(
        'Gemini empty response' +
          (finish ? ' finish=' + finish : '') +
          (j.usageMetadata?.thoughtsTokenCount
            ? ' thoughts=' + j.usageMetadata.thoughtsTokenCount
            : ''),
      )
    }
    // Hard fail truncated mid-answer so caller can try next model / rules
    if (finish === 'MAX_TOKENS' && text.trim().length < 120) {
      const err = new Error(
        'Gemini truncated (MAX_TOKENS, only ' + text.trim().length + ' chars) — raise tokens or disable thinking',
      )
      err.partial = text
      err.finishReason = finish
      throw err
    }
    return text
  } catch (e) {
    if (e && (e.name === 'AbortError' || /aborted/i.test(String(e.message || '')))) {
      throw new Error('Gemini timeout after ' + timeoutMs + 'ms (' + model + ')')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}


/** Slim tool pack for Gemini — fewer tokens in, fuller answer out */
function compactWeather(wx) {
  if (!wx || typeof wx !== 'object') return wx
  const daily = Array.isArray(wx.daily) ? wx.daily.slice(0, 5) : wx.daily
  return {
    place: wx.place,
    lat: wx.lat,
    lon: wx.lon,
    current: wx.current,
    daily,
    source: wx.source || 'Open-Meteo',
  }
}


/** True if question needs live weather / place / crop×weather tools */
function isWeatherRelated(message, extra = {}) {
  if (extra.crop) return true
  const t = String(message || '').toLowerCase().trim()
  if (!t) return false

  // Farm / irrigation — use PREFIX (not \birrigat\b) so "irrigation" matches
  if (
    /irrigat|sinchai|सिंचाई|crop|crops|wheat|gehun|rice|paddy|farm|farmer|kheti|kisaan|harvest|sowing|\bsow\b|spray|pesticide|fertilizer|field work|\bfield\b|agri|agriculture|monsoon|drought|flood/.test(
      t,
    )
  )
    return true

  // Core weather
  if (
    /\b(weather|forecast|temperature|\btemp\b|humidity|wind|rainfall|precip|precipitation|thunder|storm|hail|cyclone|heatwave|cold\s*wave|aqi|air\s*quality|\buv\b|visibility|dew\s*point|feels\s*like|barometer|pressure|drizzle|rainy|cloudy|sunny|overcast)\b/i.test(
      t,
    )
  )
    return true
  if (
    /\b(rain|raining|baarish|mausam|tapman|garmi|sardi|andhi|toofan)\b/i.test(t)
  )
    return true
  if (
    /\b(umbrella|travel\s*risk|school\s*(holiday|close|open)|outdoor|picnic|flight\s*weather|metar|taf)\b/i.test(
      t,
    )
  )
    return true
  if (/मौसम|बारिश|तापमान|गर्मी|सर्दी|आँधी|तूफान|फसल|सिंचाई|खेत|किसान|कृषि/u.test(message))
    return true

  // Place + condition
  if (
    /\b(in|at|for|near|around)\s+[a-z\u0900-\u097f]{2,}/i.test(t) &&
    /\b(hot|cold|humid|wet|dry|sunny|cloudy|rain|storm|weather|mausam)\b/i.test(t)
  )
    return true

  // Explicit non-weather trivia
  if (
    /\b(capital\s+of|who\s+is|who\s+was|what\s+is\s+\d|define|meaning\s+of|translate|history\s+of|president|prime\s+minister|population\s+of\s+earth|distance\s+between)\b/i.test(
      t,
    )
  )
    return false

  // Pure WH- trivia without weather/farm tokens → general
  if (
    /^\s*(what|who|when|where|why|how|define|explain|tell\s+me)\b/i.test(t) &&
    !/weather|rain|temp|mausam|crop|farm|forecast|aqi|wind|humid|irrigat|baarish|fasal|kheti/.test(t)
  ) {
    return false
  }

  return false
}


/** Intent Router — weather/crop vs general */
function routeIntent(message, extra = {}) {
  const weather = isWeatherRelated(message, extra)
  return {
    intent: weather ? 'weather_crop' : 'general',
    weather,
    crop: extra.crop || null,
  }
}

/**
 * Response Validator
 * - Reject empty / mid-cut stubs
 * - Weather path: soft-check that live numbers appear when tools exist
 * - Never invent numbers here — only accept/reject model text
 */
function validateResponse(text, { route, wx, message } = {}) {
  const t = String(text || '').trim()
  if (!t) return { ok: false, reason: 'empty' }
  if (t.length < 24) return { ok: false, reason: 'too_short' }
  // Mid-word cut heuristics (e.g. "Feels like 32")
  if (/\b(feels like|feels|humidity|wind|temperature|temp)\s*$/i.test(t)) {
    return { ok: false, reason: 'truncated_mid_phrase' }
  }
  if (/[.:,;]\s*$/.test(t) && t.length < 80 && !/\n/.test(t)) {
    // very short ending with colon often truncated template
    if (/:\s*$/.test(t)) return { ok: false, reason: 'truncated_colon' }
  }
  if (route === 'weather_crop' && wx?.current) {
    const temp = wx.current.temp_c
    const hasDigit = /\d/.test(t)
    // If model ignored tools entirely (no digits) on a weather Q — reject so rules can answer with real numbers
    const q = String(message || '').toLowerCase()
    const wantsNumbers = /temp|weather|rain|irrigat|°|celsius|baarish|mausam|forecast|crop|wheat|humidity|wind/.test(q)
    if (wantsNumbers && !hasDigit && Number.isFinite(temp)) {
      return { ok: false, reason: 'missing_grounded_numbers' }
    }
  }
  return { ok: true, text: t }
}

/**
 * AI Provider Manager
 * Order: Groq → OpenRouter → Gemini → OpenAI (OpenAI is inside compat list after openrouter)
 * Returns { text, provider, mode, label } or throws
 */
async function aiProviderManager(system, user, modeTag) {
  const errors = []
  let sawQuota = false

  // 1–2–4: Groq, OpenRouter, OpenAI (compat layer already ordered groq→openrouter→openai)
  try {
    const r = await callCompatLlms(system, user, modeTag)
    if (r?.text) {
      const v = validateResponse(r.text, {})
      if (v.ok) return { ...r, text: v.text }
      errors.push((r.provider || 'compat') + ': rejected ' + v.reason)
    }
  } catch (e) {
    errors.push(String(e.message || e).slice(0, 140))
    if (e.quota) sawQuota = true
  }

  // 3: Gemini multi-key
  const geminiModels = getGeminiModels()
  const keys = getGeminiKeys()
  for (const apiKey of keys) {
    for (const model of geminiModels) {
      try {
        const text = await callGemini(model, system, user, apiKey, 12000)
        const v = validateResponse(text, {})
        if (!v.ok) {
          errors.push('gemini/' + model + ': rejected ' + v.reason)
          continue
        }
        return {
          text: v.text,
          provider: model,
          mode: modeTag,
          label: 'Google Gemini',
        }
      } catch (e) {
        const msg = String(e.message || e)
        errors.push('gemini/' + model + ': ' + msg.slice(0, 100))
        if (isQuotaError(msg)) {
          sawQuota = true
          break
        }
        if (
          /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg) &&
          !/timeout|no longer available|not found/i.test(msg)
        ) {
          break
        }
        const suggested = msg.match(/models\/(gemini-[a-z0-9.-]+)/i)
        if (suggested && suggested[1] && !geminiModels.includes(suggested[1])) {
          geminiModels.push(suggested[1])
        }
        continue
      }
    }
  }

  const err = new Error(
    (sawQuota ? 'QUOTA: ' : '') + (errors.slice(0, 8).join(' | ') || 'AI Provider Manager: all providers failed'),
  )
  err.quota = sawQuota
  err.pipeline = 'ai_provider_manager'
  throw err
}

async function llmGeneral(message, lang) {
  const system =
    'You are WeatherGPT\'s general assistant (ChatGPT-style). ' +
    'NON-weather question — answer helpfully in natural complete sentences. ' +
    'Do NOT invent live weather numbers or force a weather report. ' +
    'No rigid NOW/TODAY templates. ' +
    'End with: Source: AI (general knowledge). ' +
    (lang === 'hi' ? 'Reply in natural Hindi (Devanagari).' : 'Reply in clear natural English.')

  const user = `User question:\n${message}\n\nAnswer directly.`
  const r = await aiProviderManager(system, user, 'llm_general')
  let text = r.text
  if (r.label) {
    text = text.replace(/Source:\s*AI \(general knowledge\)/i, 'Source: ' + r.label + ' (general knowledge)')
  }
  return { text, provider: r.provider, mode: 'llm_general', label: r.label }
}

async function llmPhrase(wx, message, lang, extra = {}) {
  const system =
    'You are WeatherGPT — weather + farm assistant for India (ChatGPT-style tone). ' +
    'Speak naturally in complete sentences. Be clear, warm, practical. ' +
    'GROUNDING (never break):\n' +
    '1) ONLY use facts from the Open-Meteo tool JSON for numbers.\n' +
    '2) Never invent temps, rain %, alerts, AQI, yields, or disease certainty.\n' +
    '3) If a field is missing, say unavailable.\n' +
    'STYLE:\n' +
    '- Answer the USER QUESTION first, then useful context.\n' +
    '- If user asks N sentences / yes-no / ignore templates — FOLLOW exactly.\n' +
    '- Light markdown OK; complete answer never mid-sentence.\n' +
    '- Include real tool numbers when relevant.\n' +
    '- End with: Source: AI + Open-Meteo (tool-grounded).\n' +
    (extra.crop
      ? 'Crop context: "' + extra.crop + '". Weather×agronomy only; no fake yield %.\n'
      : '') +
    (lang === 'hi' ? 'Reply in natural Hindi.' : 'Reply in clear English (Hinglish OK if user used it).')

  const user =
    `User question:\n${message}\n\n` +
    (extra.crop ? `Crop hint: ${extra.crop}\n\n` : '') +
    `Place: ${wx.place || 'unknown'}\n\n` +
    `Live tool weather JSON (authoritative):\n${JSON.stringify(compactWeather(wx)).slice(0, 3500)}\n\n` +
    `Respond using only this weather data.`

  const r = await aiProviderManager(system, user, 'llm_grounded')
  let text = r.text
  const brand = r.label || 'AI'
  text = text
    .replace(/Source:\s*AI \+ Open-Meteo/i, 'Source: ' + brand + ' + Open-Meteo')
    .replace(/Source:\s*Google Gemini \+ Open-Meteo/i, 'Source: ' + brand + ' + Open-Meteo')

  const v = validateResponse(text, { route: 'weather_crop', wx, message })
  if (!v.ok) {
    const err = new Error('Response Validator rejected: ' + v.reason)
    err.partial = text
    throw err
  }
  return { text: v.text, provider: r.provider, mode: 'llm_grounded', label: r.label }
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
      'utf8',
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
    const geminiKey = getGeminiKey()
    const hasGemini = geminiKey.length >= 20
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    return res.status(200).json({
      ok: true,
      service: 'WeatherGPT hybrid chat',
      preferred_llm: getOpenAiCompatProviders()[0]?.id || (getGeminiKeys().length ? 'google_gemini' : 'rules'),
      gemini_model: (process.env.GEMINI_MODEL || 'gemini-3.6-flash').replace(/["']/g, '').trim(),
      gemini_key_present: getGeminiKeys().length > 0,
      gemini_key_count: getGeminiKeys().length,
      gemini_key_length: geminiKey ? geminiKey.length : 0,
      free_tier_mode: (process.env.GEMINI_FREE_TIER || '1') !== '0',
      default_mode: getOpenAiCompatProviders().length || hasGemini || hasOpenAI ? 'llm_multi_provider' : 'deterministic_grounded',
      llm_configured: hasGemini || hasOpenAI || getOpenAiCompatProviders().length > 0,
      llm_providers: {
        groq: !!sanitizeKey(process.env.GROQ_API_KEY || ''),
        openrouter: !!sanitizeKey(process.env.OPENROUTER_API_KEY || ''),
        gemini: hasGemini,
        openai: hasOpenAI,
      },
      llm_order: 'groq → openrouter → gemini → openai → rules+weather',
      contract:
        'POST JSON { message, lat?, lon?, name?, lang?, crop? }. Router: weather → Open-Meteo + AI; else → general AI. Providers: Groq, OpenRouter, Gemini, OpenAI.',
      honesty: '/HONESTY.txt',
      gemini_timeout_ms_per_model: 12000,
      gemini_max_model_attempts: 2,
      note: 'Pipeline: Intent Router → (weather? Open-Meteo+Engine : skip) → AI Manager Groq→OpenRouter→Gemini→OpenAI → Validator → else Rules+weather.',
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
    const cropHint = body.crop ? String(body.crop).slice(0, 48) : null

    if (!message) return res.status(400).json({ ok: false, error: 'message required' })

    // ══════════════════════════════════════════
    // USER → Intent Router
    // ══════════════════════════════════════════
    const routed = routeIntent(message, { crop: cropHint })
    const pipeline = {
      intent: routed.intent,
      steps: ['intent_router'],
      providers_tried: [],
      fallback: false,
    }

    // ── General question → AI Provider Manager only ──
    if (routed.intent === 'general') {
      pipeline.steps.push('ai_provider_manager')
      let mode = 'deterministic_general'
      let provider = 'rules'
      let text
      let llmError = null
      try {
        const llm = await llmGeneral(message, lang)
        if (llm?.text) {
          const v = validateResponse(llm.text, { route: 'general', message })
          pipeline.steps.push('response_validator')
          if (v.ok) {
            text = v.text
            mode = llm.mode
            provider = llm.provider
          } else {
            llmError = 'validator:' + v.reason
          }
        }
      } catch (e) {
        llmError = e.message
      }
      if (!text) {
        pipeline.steps.push('rules_fallback')
        pipeline.fallback = true
        text =
          lang === 'hi'
            ? '## सामान्य प्रश्न\n\nYeh mausam se juda sawal nahi lagta. AI providers (Groq / OpenRouter / Gemini) abhi jawab nahi de paaye.\n\nMausam, baarish, fasal ya city forecast poochho — Open-Meteo + AI se live jawab milega.\n\n' +
              (llmError ? `_(${String(llmError).slice(0, 120)})_\n` : '')
            : '## General question\n\nThat does not look weather-related. AI providers (Groq → OpenRouter → Gemini → OpenAI) could not answer right now' +
              (llmError ? ` (${String(llmError).slice(0, 100)})` : '') +
              '.\n\nAsk weather / rain / crops / city forecast for live Open-Meteo + AI.\n\nTip: set free GROQ_API_KEY or OPENROUTER_API_KEY on Vercel.'
        mode = 'deterministic_general'
        provider = 'rules'
      }
      return res.status(200).json({
        ok: true,
        mode,
        provider,
        answer: text,
        route: 'general',
        pipeline,
        place: Number.isFinite(lat) && Number.isFinite(lon) ? { name, lat, lon, overridden: false } : null,
        tools: { weather: null },
        citations: [
          {
            name: mode === 'llm_general' ? String(provider).split(':')[0] : 'Rules',
            role: 'General knowledge (not live weather)',
          },
        ],
        llmError: llmError || undefined,
        honesty:
          mode === 'llm_general'
            ? 'General AI answer — not tool-grounded weather'
            : 'General fallback — add GROQ_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY',
        fetchedAt: Date.now(),
      })
    }

    // ══════════════════════════════════════════
    // Weather / Crop → Open-Meteo → Engine → AI → Validator
    // ══════════════════════════════════════════
    pipeline.steps.push('open_meteo')
    const cropOnlyMsg = isCropName(message) || isCropName(String(message).trim().split(/\s+/)[0])

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
      return res.status(400).json({ ok: false, error: 'lat lon required for weather grounding' })
    }

    // Crop/Weather Engine = live tool pack
    pipeline.steps.push('crop_weather_engine')
    const wx = await toolWeather(lat, lon, name)
    let mode = 'deterministic_grounded'
    let provider = 'rules+tools'
    let text
    let llmError = null

    pipeline.steps.push('ai_provider_manager')
    try {
      const llm = await llmPhrase(wx, message, lang, { crop: cropHint })
      if (llm?.text) {
        pipeline.steps.push('response_validator')
        text = llm.text
        mode = llm.mode
        provider = llm.provider
      }
    } catch (e) {
      llmError = e.message
    }

    // If EVERYTHING fails → Rules + Weather Data
    if (!text) {
      pipeline.steps.push('rules_weather_fallback')
      pipeline.fallback = true
      const quota = isQuotaError(llmError) || /QUOTA:/i.test(String(llmError || ''))
      text = deterministicAnswer(wx, message, lang, { quota })
      // validate rules output always has numbers
      const v = validateResponse(text, { route: 'weather_crop', wx, message })
      if (v.ok) text = v.text
      mode = 'deterministic_grounded'
      provider = quota ? 'rules+tools (ai quota)' : 'rules+tools'
    }

    if (cropOnlyMsg && isCropName(name)) {
      name = 'Area'
      text =
        (lang === 'hi'
          ? '## 🌾 फसल बुद्धिमत्ता\n\nफसल का नाम स्थान नहीं है।\n\n'
          : '## 🌾 Crop Intelligence\n\nA crop name is not a location.\n\n') + text
    }

    return res.status(200).json({
      ok: true,
      mode,
      provider,
      answer: text,
      route: 'weather',
      pipeline,
      place: { name, lat, lon, overridden: !!placeOverride },
      tools: { weather: wx },
      citations: [
        { name: 'Open-Meteo', role: 'Live forecast tool' },
        ...(mode === 'llm_grounded'
          ? [{ name: String(provider).split(':')[0], role: 'LLM phrasing (grounded)' }]
          : [{ name: 'Rules engine', role: 'Deterministic grounded brief' }]),
      ],
      llmError: llmError || undefined,
      honesty:
        mode === 'llm_grounded'
          ? 'LLM phrasing only; numbers from Open-Meteo tools'
          : 'Rules + weather data — AI providers unavailable or rejected',
      fetchedAt: Date.now(),
    })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'chat error' })
  }
}
