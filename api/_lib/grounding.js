/**
 * AI grounding — verified weather context + response validation
 * -------------------------------------------------------------
 * CORE RULE: LLM explains verified weather data; never invents it.
 *
 * Pipeline helpers:
 *  1) buildVerifiedWeatherContext(wx, extras) → frozen JSON for prompts
 *  2) isTrivialWeatherQuery(message) → skip LLM, use rules
 *  3) validateGroundedResponse(text, ctx) → reject hallucinated numbers / fake official claims
 *  4) extractAllowedNumbers(ctx) → whitelist of digits the model may use
 */

export const GROUNDING_SCHEMA = 'weathergpt.verified_context.v1'

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function round1(v) {
  const n = num(v)
  if (n == null) return null
  return Math.round(n * 10) / 10
}

function round0(v) {
  const n = num(v)
  if (n == null) return null
  return Math.round(n)
}

/** Collect every finite number that is "allowed" to appear in LLM text */
export function extractAllowedNumbers(ctx) {
  const set = new Set()
  const add = (v) => {
    const n = num(v)
    if (n == null) return
    // Store several display forms
    set.add(String(round0(n)))
    set.add(String(round1(n)))
    if (Number.isInteger(n)) set.add(String(n))
    else {
      set.add(String(n))
      set.add(n.toFixed(1))
      set.add(n.toFixed(2))
    }
  }

  const walk = (obj, depth = 0) => {
    if (obj == null || depth > 8) return
    if (typeof obj === 'number') {
      add(obj)
      return
    }
    if (Array.isArray(obj)) {
      obj.forEach((x) => walk(x, depth + 1))
      return
    }
    if (typeof obj === 'object') {
      for (const v of Object.values(obj)) walk(v, depth + 1)
    }
  }

  walk(ctx)

  // Common harmless numbers always allowed (years-ish, percentages scaffolding)
  ;['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '24', '48', '100', '2024', '2025', '2026'].forEach(
    (x) => set.add(x)
  )

  return set
}

/**
 * Build the strict verified context object BEFORE any LLM call.
 * Only tool / engine values — never LLM-invented.
 */
export function buildVerifiedWeatherContext(wx, extras = {}) {
  if (!wx || typeof wx !== 'object') {
    return {
      schema: GROUNDING_SCHEMA,
      locked: true,
      empty: true,
      location: extras.location || null,
      note: 'No verified weather pack — LLM must not invent numbers.',
    }
  }

  const c = wx.current || {}
  const dailyIn = Array.isArray(wx.daily) ? wx.daily : []
  const hourlyIn = Array.isArray(wx.hourly) ? wx.hourly : []

  const currentWeather = {
    temperature_c: round1(c.temp_c ?? c.temp ?? c.temperature),
    apparent_temperature_c: round1(c.feels_c ?? c.feelsLike ?? c.apparent_temperature),
    humidity_pct: round0(c.humidity_pct ?? c.humidity),
    wind_speed_kmh: round1(c.wind_kmh ?? c.wind ?? c.wind_speed),
    wind_direction_deg: round0(c.wind_dir ?? c.windDir ?? c.wind_direction),
    precipitation_mm: round1(c.precip_mm ?? c.precip ?? c.precipitation ?? 0),
    weather_code: c.weather_code ?? c.code ?? null,
    condition: c.condition || null,
    pressure_msl: round1(c.pressure ?? c.pressure_msl),
    cloud_cover_pct: round0(c.cloudCover ?? c.cloud_cover),
    is_day: c.is_day ?? c.isDay ?? null,
    time: c.time || null,
  }

  const dailyForecast = dailyIn.slice(0, 7).map((d) => ({
    date: d.date || null,
    temperature_max_c: round1(d.max_c ?? d.temp_max_c ?? d.max),
    temperature_min_c: round1(d.min_c ?? d.temp_min_c ?? d.min),
    precipitation_sum_mm: round1(d.rain_mm ?? d.rain_amount_mm ?? d.rain),
    precipitation_probability_pct: round0(d.pop_pct ?? d.rain_probability_pct ?? d.pop),
    weather_code: d.weather_code ?? d.wmo_code ?? d.code ?? null,
    wind_max_kmh: round1(d.wind ?? d.wind_kmh),
    condition: d.condition_en || d.condition || null,
  }))

  const hourlyForecast = hourlyIn.slice(0, 24).map((h) => ({
    time: h.time || null,
    temperature_c: round1(h.temp ?? h.temperature_c ?? h.temperature),
    precipitation_probability_pct: round0(h.pop ?? h.precipitation_probability),
    precipitation_mm: round1(h.rain ?? h.precipitation),
    weather_code: h.code ?? h.weather_code ?? null,
  }))

  const d0 = dailyForecast[0] || {}
  const precipitation = {
    current_mm: currentWeather.precipitation_mm,
    today_sum_mm: d0.precipitation_sum_mm ?? null,
    today_probability_pct: d0.precipitation_probability_pct ?? null,
    fields_separated: true,
    note: 'probability_pct and amount_mm are separate — never conflate',
  }

  const wind = {
    speed_kmh: currentWeather.wind_speed_kmh,
    direction_deg: currentWeather.wind_direction_deg,
    today_max_kmh: d0.wind_max_kmh ?? null,
  }

  // Alerts — only from verified bundle; never invent
  const rawAlerts = extras.alerts || wx.alerts || wx.alert_bundle?.alerts || []
  const alerts = (Array.isArray(rawAlerts) ? rawAlerts : []).slice(0, 8).map((a) => ({
    kind: a.kind || (a.official ? 'official' : a.simulated ? 'demo' : 'risk_signal'),
    severity: a.severity || null,
    title: a.title || null,
    source: a.source || null,
    official: a.kind === 'official' || a.official === true,
    reason: a.reason || null,
    valid_until: a.valid_until || null,
  }))

  const conf = extras.confidence || wx.confidence || null
  const confidence = conf
    ? {
        score: round0(conf.score),
        level: conf.level || null,
        engine: conf.engine || 'weathergpt.confidence.v1',
        reasons: Array.isArray(conf.reasons) ? conf.reasons.slice(0, 6) : [],
      }
    : null

  const mm = extras.modelConsensus || wx.multi_model || wx.multiModel || null
  const modelConsensus = mm
    ? {
        mode: mm.multi_model_mode || null,
        available_count: mm.available_count ?? mm.ensemble?.modelCount ?? null,
        primary_model_id: mm.primary_model_id || null,
        temp_spread_c: mm.ensemble?.spreadC ?? null,
        agreement: mm.ensemble?.agreementEn || mm.ensemble?.agreementLevel || null,
        // per-model summary temps/pops if present (verified only)
        models: Array.isArray(mm.summary)
          ? mm.summary.slice(0, 6).map((m) => ({
              id: m.id,
              available: !!m.available,
              temperature_c: round1(m.temperature),
              precipitation_probability_pct: round0(m.precipitation_probability),
            }))
          : undefined,
      }
    : null

  const cropContext = extras.crop
    ? {
        crop_id: String(extras.crop).slice(0, 48),
        note: 'Agronomy is advisory only; weather numbers still must come from this context.',
      }
    : null

  const location = {
    name: wx.place || wx.name || extras.name || null,
    lat: num(wx.lat ?? extras.lat),
    lon: num(wx.lon ?? extras.lon),
    timezone: wx.timezone || null,
    country: wx.country || null,
  }

  const ctx = {
    schema: GROUNDING_SCHEMA,
    locked: true,
    empty: false,
    location,
    currentWeather,
    hourlyForecast,
    dailyForecast,
    precipitation,
    wind,
    alerts,
    modelConsensus,
    confidence,
    cropContext,
    sources: {
      weather: wx.source || 'Open-Meteo Forecast API',
      note: 'Grid model forecast — not a personal station. Not official IMD unless alert.kind=official.',
    },
    astro: extras.astro || wx.astro || null,
    limitations: [
      'LLM must COPY numbers from this object only',
      'Never invent temperatures, POP%, mm, wind, alerts',
      'Never claim official IMD/NDMA warning unless alerts[].official===true',
      'Never override deterministic confidence or risk thresholds',
      'WMO 96/99 = hail possible in model class, not confirmed hail',
    ],
    fingerprint: [
      location.name,
      currentWeather.temperature_c,
      currentWeather.humidity_pct,
      precipitation.today_probability_pct,
      precipitation.today_sum_mm,
      dailyForecast.map((d) => `${d.date}:${d.temperature_max_c}/${d.precipitation_probability_pct}`).join('|'),
    ].join('#'),
  }

  return ctx
}

/**
 * Trivial factual queries → rules engine only (no LLM).
 */
export function isTrivialWeatherQuery(message) {
  const t = String(message || '')
    .toLowerCase()
    .trim()
  if (!t || t.length > 120) return false

  // Complex → not trivial
  if (
    /travel|crop|farm|irrigat|sinchai|advice|should i|recommend|impact|explain why|compare|vs\b|versus|plan|wedding|event|risk for|what to do|kaise|kyun|why |how (can|should|do)|fasal|kheti|school|picnic|flight/.test(
      t
    )
  ) {
    return false
  }

  // Multi-clause / long advice
  if ((t.match(/\?/g) || []).length > 1) return false
  if (t.split(/\s+/).length > 14 && !/^(what|kitna|kya|how much|current)\b/.test(t)) return false

  const trivial =
    /^(what('?s| is)?\s+)?(the\s+)?(current\s+)?(temp(erature)?|humidity|wind(\s*speed)?|rain\s*(chance|probability|%|pop)?|precipitation|weather\s*code|condition|feels\s*like|heat\s*index)?\b/.test(
      t
    ) ||
    /\b(temp(erature)?|humidity|wind(\s*speed)?|kitna\s*(temp|garmi|nami|hawa)|tapman|nami|hawa\s*ki\s*raftaar)\b/.test(
      t
    ) ||
    /^(how\s+(hot|cold|humid|windy)|is\s+it\s+(raining|hot|cold|humid))\b/.test(t) ||
    /\b(sunrise|sunset|uv\s*index)\b/.test(t) ||
    /^(rain\s*(%|chance|probability)|pop)\b/.test(t) ||
    /बारिश\s*(की\s*)?(संभावना|%|percent)|तापमान|नमी|हवा/.test(message || '')

  // "weather in X" brief is OK as trivial if short
  const simpleWeather =
    /^(what('?s| is)?\s+)?(the\s+)?weather\b/.test(t) &&
    t.split(/\s+/).length <= 8 &&
    !/travel|crop|farm|advice|tomorrow\s+plan/.test(t)

  return trivial || simpleWeather
}

/** Hard system instructions for grounded weather LLM */
export function groundingSystemPrompt({ lang, hinglish, crop } = {}) {
  return (
    'You are WeatherGPT. You EXPLAIN verified weather data — you never GENERATE weather data.\n' +
    'HARD RULES (violation = invalid answer):\n' +
    '1) Use ONLY values present in VERIFIED_WEATHER_CONTEXT JSON. Copy digits exactly.\n' +
    '2) NEVER invent temperatures, humidity, wind, rain mm, rain probabilities, UV, AQI, or alerts.\n' +
    '3) NEVER invent forecast probabilities or change deterministic confidence scores.\n' +
    '4) NEVER claim an official government/IMD/NDMA warning unless alerts[] contains official:true with that source.\n' +
    '5) WeatherGPT risk_signal alerts are model thresholds — label them as risk signals, not official warnings.\n' +
    '6) If a value is null/missing in context, say "unavailable" — do not guess.\n' +
    '7) Rain probability_pct and amount_mm are SEPARATE fields.\n' +
    '8) WMO 95 = thunderstorm without implied hail; 96/99 = hail possible (model class), not confirmed.\n' +
    '9) Do not claim definite crop yield loss/gain; at most "conditions may favour…".\n' +
    '10) Do not override tool numbers with "corrected" estimates.\n' +
    'ANSWER SHAPE:\n' +
    '• Lead with a direct answer.\n' +
    '• Cite 2–5 verified numbers from context.\n' +
    '• One uncertainty line (grid model / local variance).\n' +
    '• End with: Source: AI + verified Open-Meteo context.\n' +
    (crop ? `Crop focus: ${crop} — tie advice to verified weather only.\n` : '') +
    (hinglish || lang === 'hi'
      ? 'Language: natural Hinglish/Hindi — SAME numbers when translating.\n'
      : 'Language: clear natural English.\n')
  )
}

export function stricterGroundingSystemPrompt(baseOpts) {
  return (
    groundingSystemPrompt(baseOpts) +
    '\nSTRICT RETRY MODE: Your previous draft failed validation. ' +
    'Reply again using ONLY numbers that appear in VERIFIED_WEATHER_CONTEXT. ' +
    'Do not add any extra °C, %, or mm figures. Short answer. No tables of invented values.\n'
  )
}

/**
 * Extract suspicious numeric claims from model text and check against allowlist.
 */
export function findUngroundedNumbers(text, allowedSet) {
  const t = String(text || '')
  const suspicious = []
  // Match numbers that look like weather claims: 32°C, 80%, 12.5 mm, 45 km/h, bare temps near weather words
  const patterns = [
    /(\d{1,3}(?:\.\d+)?)\s*°\s*[Cc]/g,
    /(\d{1,3}(?:\.\d+)?)\s*%/g,
    /(\d{1,3}(?:\.\d+)?)\s*mm\b/gi,
    /(\d{1,3}(?:\.\d+)?)\s*km\/h\b/gi,
    /(\d{1,3}(?:\.\d+)?)\s*kmh\b/gi,
  ]
  for (const re of patterns) {
    let m
    const r = new RegExp(re.source, re.flags)
    while ((m = r.exec(t)) !== null) {
      const raw = m[1]
      const forms = [raw, String(round0(raw)), String(round1(raw))]
      const ok = forms.some((f) => allowedSet.has(f))
      if (!ok) {
        suspicious.push({ value: raw, unit: m[0].replace(raw, '').trim() || 'qty', index: m.index })
      }
    }
  }

  // "temperature is 47" style without unit near weather verbs
  const bare = [
    ...t.matchAll(
      /(?:temp(?:erature)?|humidity|wind|feels(?:\s+like)?|high|low|max|min|pop|rain\s*chance)[^\d]{0,12}(\d{1,3}(?:\.\d+)?)/gi
    ),
  ]
  for (const m of bare) {
    const raw = m[1]
    const forms = [raw, String(round0(raw)), String(round1(raw))]
    if (!forms.some((f) => allowedSet.has(f))) {
      suspicious.push({ value: raw, unit: 'bare', index: m.index })
    }
  }

  return suspicious
}

export function claimsFakeOfficialWarning(text, ctx) {
  const t = String(text || '')
  if (!/\b(imd|ndma|official\s+warning|red\s+alert\s+issued|government\s+warning)\b/i.test(t)) {
    return false
  }
  // Allowed if context has official alerts
  const hasOfficial = (ctx?.alerts || []).some((a) => a.official === true || a.kind === 'official')
  if (hasOfficial) return false
  // Demo mentions OK
  if (/\b(demo|simulated|simulation|not\s+official|not\s+an\s+official)\b/i.test(t)) return false
  return true
}

/**
 * Full grounded validation.
 */
export function validateGroundedResponse(text, ctx, { route = 'weather_crop', message = '' } = {}) {
  const t = String(text || '').trim()
  if (!t) return { ok: false, reason: 'empty', suspicious: [] }
  if (t.length < 20) return { ok: false, reason: 'too_short', suspicious: [] }

  if (/\b(feels like|feels|humidity|wind|temperature|temp)\s*$/i.test(t)) {
    return { ok: false, reason: 'truncated_mid_phrase', suspicious: [] }
  }
  if (/:\s*$/.test(t) && t.length < 80 && !/\n/.test(t)) {
    return { ok: false, reason: 'truncated_colon', suspicious: [] }
  }

  // Malformed JSON dump / tool leakage
  if (/^\s*\{[\s\S]*"temp_c"/.test(t) && t.length < 40) {
    return { ok: false, reason: 'malformed_jsonish', suspicious: [] }
  }
  if (/\bundefined\b|\bNaN\b|\bnull°/.test(t)) {
    return { ok: false, reason: 'malformed_tokens', suspicious: [] }
  }

  if (route === 'weather_crop' && ctx && !ctx.empty) {
    const allowed = extractAllowedNumbers(ctx)
    const suspicious = findUngroundedNumbers(t, allowed)
    // Allow up to 0 ungrounded weather-unit numbers (strict)
    // Filter tiny integers used as counts ("2 sections") — only flag if unit present or weather-bare
    const serious = suspicious.filter((s) => s.unit !== 'bare' || /°|%|mm|km/i.test(s.unit) || true)
    // bare: only fail if many or clearly weather-sized
    const serious2 = suspicious.filter((s) => {
      if (s.unit === 'bare') {
        const n = Number(s.value)
        // bare 0-10 often list counts — ignore
        if (n >= 0 && n <= 10) return false
        return true
      }
      return true
    })

    if (serious2.length >= 1) {
      return {
        ok: false,
        reason: 'ungrounded_numbers',
        suspicious: serious2.slice(0, 8),
        detail: serious2
          .slice(0, 5)
          .map((s) => `${s.value}${s.unit !== 'bare' ? s.unit : ''}`)
          .join(', '),
      }
    }

    if (claimsFakeOfficialWarning(t, ctx)) {
      return { ok: false, reason: 'fake_official_warning', suspicious: [] }
    }

    const q = String(message || '').toLowerCase()
    const wantsNumbers =
      /temp|weather|rain|irrigat|°|celsius|baarish|mausam|forecast|crop|wheat|humidity|wind|kitna/.test(q)
    const hasDigit = /\d/.test(t)
    if (wantsNumbers && !hasDigit && ctx.currentWeather?.temperature_c != null) {
      return { ok: false, reason: 'missing_grounded_numbers', suspicious: [] }
    }
  }

  return { ok: true, text: t, suspicious: [] }
}

/** Deterministic one-liner answers for trivial queries */
export function trivialDeterministicAnswer(ctx, message, lang = 'en') {
  const hi = lang === 'hi' || /[\u0900-\u097F]/.test(message || '')
  const c = ctx?.currentWeather || {}
  const p = ctx?.precipitation || {}
  const w = ctx?.wind || {}
  const place = ctx?.location?.name || 'Area'
  const q = String(message || '').toLowerCase()

  const line = (en, h) => (hi ? h : en)

  if (/humid|nami|नमी/.test(q) && c.humidity_pct != null) {
    return line(
      `## ${place}\n\n**Humidity right now: ${c.humidity_pct}%** (verified Open-Meteo).\n\nSource: rules + verified context (no LLM).`,
      `## ${place}\n\n**अभी नमी: ${c.humidity_pct}%** (सत्यापित Open-Meteo)।\n\nस्रोत: rules + verified context (LLM नहीं)।`
    )
  }
  if (/wind|hawa|हवा/.test(q) && c.wind_speed_kmh != null) {
    return line(
      `## ${place}\n\n**Wind: ${c.wind_speed_kmh} km/h**` +
        (c.wind_direction_deg != null ? ` from ${c.wind_direction_deg}°` : '') +
        ` (verified).\n\nSource: rules + verified context (no LLM).`,
      `## ${place}\n\n**हवा: ${c.wind_speed_kmh} किमी/घं**` +
        (c.wind_direction_deg != null ? ` · दिशा ${c.wind_direction_deg}°` : '') +
        ` (सत्यापित)।\n\nस्रोत: rules + verified context।`
    )
  }
  if (/rain|pop|baarish|बारिश|precip/.test(q)) {
    const pop = p.today_probability_pct
    const mm = p.today_sum_mm
    return line(
      `## ${place}\n\n**Today rain probability: ${pop ?? 'unavailable'}%** · **amount: ${mm ?? 'unavailable'} mm** (separate fields, verified).\n\nSource: rules + verified context (no LLM).`,
      `## ${place}\n\n**आज बारिश संभावना: ${pop ?? 'उपलब्ध नहीं'}%** · **मात्रा: ${mm ?? 'उपलब्ध नहीं'} मिमी** (अलग फ़ील्ड, सत्यापित)।\n\nस्रोत: rules + verified context।`
    )
  }
  if (/sunrise|sunset/.test(q) && ctx?.astro) {
    return line(
      `## ${place}\n\nSunrise **${ctx.astro.sunrise || '—'}** · Sunset **${ctx.astro.sunset || '—'}** (from forecast pack).\n\nSource: rules + verified context.`,
      `## ${place}\n\nसूर्योदय **${ctx.astro.sunrise || '—'}** · सूर्यास्त **${ctx.astro.sunset || '—'}**।\n\nस्रोत: rules + verified context।`
    )
  }
  // default temperature / weather
  const temp = c.temperature_c
  const feels = c.apparent_temperature_c
  return line(
    `## ${place}\n\n**Now: ${temp ?? '—'}°C** (feels ${feels ?? '—'}°C), humidity ${c.humidity_pct ?? '—'}%, wind ${c.wind_speed_kmh ?? '—'} km/h` +
      (c.weather_code != null ? `, weather code ${c.weather_code}` : '') +
      `.\nToday rain **${p.today_probability_pct ?? '—'}%** / **${p.today_sum_mm ?? '—'} mm**.\n\n_Source: rules + verified Open-Meteo context (LLM skipped for factual query)._`,
    `## ${place}\n\n**अभी: ${temp ?? '—'}°C** (महसूस ${feels ?? '—'}°C), नमी ${c.humidity_pct ?? '—'}%, हवा ${c.wind_speed_kmh ?? '—'} किमी/घं` +
      (c.weather_code != null ? `, कोड ${c.weather_code}` : '') +
      `।\nआज बारिश **${p.today_probability_pct ?? '—'}%** / **${p.today_sum_mm ?? '—'} मिमी**।\n\n_स्रोत: rules + verified context (तथ्यात्मक प्रश्न — LLM नहीं)।_`
  )
}
