/**
 * Multi-model NWP engine (Open-Meteo)
 * ------------------------------------
 * Single place that fetches ECMWF IFS / GFS / ICON / ECMWF AIFS (+ best_match),
 * normalizes each run into one internal observation schema, and aggregates.
 *
 * Rules:
 * - Never invent values. Missing → null + available:false.
 * - Never pretend multi-model consensus when only one model works.
 * - Frontend must not call these model URLs itself — use /api/models or
 *   the multi_model block on /api/weather.
 * - Forecast confidence via confidenceEngine (deterministic; no LLM/random).
 */

import { confidenceFromMultiModelBundle } from './confidenceEngine.js'

const UA = {
  Accept: 'application/json',
  'User-Agent': 'WeatherGPT/2.2-multi-model (hackathon)',
}

/** Catalog — only IDs verified against Open-Meteo Forecast API */
export const MODEL_CATALOG = [
  {
    id: 'best_match',
    name: 'Best match (Open-Meteo blend)',
    short: 'Blend',
    family: 'blend',
    provider: 'Open-Meteo',
    role: 'primary',
    notes: 'Location-aware blend of local + global models — default UI source of truth',
  },
  {
    id: 'ecmwf_ifs025',
    name: 'ECMWF IFS 0.25°',
    short: 'ECMWF IFS',
    family: 'ecmwf_ifs',
    provider: 'ECMWF',
    role: 'compare',
    notes: 'IFS open data via Open-Meteo',
  },
  {
    id: 'gfs_seamless',
    name: 'GFS seamless (NCEP)',
    short: 'GFS',
    family: 'gfs',
    provider: 'NCEP',
    role: 'compare',
    notes: 'GFS global + regional seamless stack',
  },
  {
    id: 'icon_seamless',
    name: 'ICON seamless (DWD)',
    short: 'ICON',
    family: 'icon',
    provider: 'DWD',
    role: 'compare',
    notes: 'ICON global + EU/D2 seamless',
  },
  {
    id: 'ecmwf_aifs025_single',
    name: 'ECMWF AIFS 0.25° single',
    short: 'AIFS',
    family: 'ecmwf_aifs',
    provider: 'ECMWF',
    role: 'compare',
    notes: 'AI IFS — precipitation_probability often unavailable (null kept honest)',
  },
]

export function getModelMeta(id) {
  return MODEL_CATALOG.find((m) => m.id === id) || null
}

export async function fetchJson(url, timeoutMs = 14000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal })
    const text = await res.text()
    if (!res.ok) {
      let reason = `HTTP ${res.status}`
      try {
        const j = JSON.parse(text)
        if (j.reason) reason = j.reason
      } catch {
        /* keep */
      }
      throw new Error(reason)
    }
    if (text.trimStart().startsWith('<')) throw new Error('HTML body from upstream')
    return JSON.parse(text)
  } finally {
    clearTimeout(t)
  }
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function round(v, d = 1) {
  const n = num(v)
  if (n == null) return null
  const f = 10 ** d
  return Math.round(n * f) / f
}

function buildModelUrl(lat, lon, modelId, { tz = 'auto', forecastDays = 2, hourlyHours = 48 } = {}) {
  // Rich current + hourly for common schema; daily for today snapshot
  const current =
    'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,' +
    'cloud_cover,wind_speed_10m,wind_direction_10m,pressure_msl,is_day'
  const hourly =
    'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,' +
    'relative_humidity_2m,cloud_cover,wind_speed_10m,wind_direction_10m'
  const daily =
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max'
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&models=${encodeURIComponent(modelId)}` +
    `&current=${current}` +
    `&hourly=${hourly}` +
    `&daily=${daily}` +
    `&timezone=${encodeURIComponent(tz)}` +
    `&forecast_days=${forecastDays}` +
    `&forecast_hours=${hourlyHours}`
  )
}

/**
 * Common internal observation at one instant (current or hourly slot).
 * Matches the conceptual schema from the multi-model brief.
 */
export function normalizeObservation(location, timestamp, fields, sourceModel, meta = {}) {
  return {
    location: location
      ? {
          name: location.name || null,
          lat: location.lat ?? null,
          lon: location.lon ?? null,
          timezone: location.timezone || meta.timezone || null,
          elevation_m: location.elevation ?? meta.elevation ?? null,
        }
      : null,
    timestamp: timestamp || null,
    temperature: round(fields.temperature, 1),
    apparent_temperature: round(fields.apparent_temperature, 1),
    precipitation_probability:
      fields.precipitation_probability == null ? null : round(fields.precipitation_probability, 0),
    precipitation: round(fields.precipitation, 2),
    wind_speed: round(fields.wind_speed, 1),
    wind_direction: fields.wind_direction == null ? null : round(fields.wind_direction, 0),
    humidity: fields.humidity == null ? null : round(fields.humidity, 0),
    cloud_cover: fields.cloud_cover == null ? null : round(fields.cloud_cover, 0),
    weather_code: fields.weather_code == null ? null : round(fields.weather_code, 0),
    pressure_msl: fields.pressure_msl == null ? null : round(fields.pressure_msl, 1),
    source_model: sourceModel,
    meta: {
      model_name: meta.model_name || sourceModel,
      model_id: meta.model_id || sourceModel,
      provider: meta.provider || null,
      forecast_timestamp: timestamp || null,
      model_run_time: meta.model_run_time || null, // Open-Meteo free tier rarely exposes init; null = unknown
      source: meta.source || 'Open-Meteo Forecast API',
      generationtime_ms: meta.generationtime_ms ?? null,
      fetched_at: meta.fetched_at || new Date().toISOString(),
      variable_notes: meta.variable_notes || null,
    },
  }
}

function indexOfNearestHour(times, targetIso) {
  if (!times?.length) return 0
  if (!targetIso) return 0
  const target = new Date(targetIso).getTime()
  if (Number.isNaN(target)) return 0
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime()
    if (Number.isNaN(t)) continue
    const d = Math.abs(t - target)
    if (d < bestDiff) {
      bestDiff = d
      best = i
    }
  }
  return best
}

/**
 * Normalize a full Open-Meteo model payload → common multi-model record.
 * Returns available:false with error when unusable (no fake fill).
 */
export function normalizeModelPayload(raw, catalogEntry, location, fetchedAtIso) {
  const baseMeta = {
    model_name: catalogEntry.name,
    model_id: catalogEntry.id,
    provider: catalogEntry.provider,
    source: 'Open-Meteo Forecast API',
    fetched_at: fetchedAtIso,
    model_run_time: null,
  }

  if (!raw || raw.error) {
    return {
      available: false,
      ok: false,
      id: catalogEntry.id,
      short: catalogEntry.short,
      label: catalogEntry.name,
      family: catalogEntry.family,
      provider: catalogEntry.provider,
      role: catalogEntry.role,
      error: raw?.reason || raw?.error || 'empty payload',
      current: null,
      hourly: [],
      daily: null,
      next24h: null,
      today: null,
      meta: baseMeta,
    }
  }

  const cur = raw.current || raw.current_weather || {}
  const hourly = raw.hourly || {}
  const daily = raw.daily || {}
  const times = hourly.time || []
  const genMs = raw.generationtime_ms ?? null

  const loc = {
    name: location?.name || null,
    lat: raw.latitude ?? location?.lat ?? null,
    lon: raw.longitude ?? location?.lon ?? null,
    timezone: raw.timezone || location?.timezone || null,
    elevation: raw.elevation ?? null,
  }

  // current_weather legacy
  const curTemp = cur.temperature_2m ?? cur.temperature ?? null
  const curCode = cur.weather_code ?? cur.weathercode ?? null
  const curWind = cur.wind_speed_10m ?? cur.windspeed ?? null
  const curWindDir = cur.wind_direction_10m ?? cur.winddirection ?? null
  const curTime = cur.time || times[0] || null

  if (curTemp == null && !times.length) {
    return {
      available: false,
      ok: false,
      id: catalogEntry.id,
      short: catalogEntry.short,
      label: catalogEntry.name,
      family: catalogEntry.family,
      provider: catalogEntry.provider,
      role: catalogEntry.role,
      error: 'No temperature in model response',
      current: null,
      hourly: [],
      daily: null,
      next24h: null,
      today: null,
      meta: { ...baseMeta, generationtime_ms: genMs },
    }
  }

  // AIFS often returns null POP — record honesty note, do not invent
  const popSample = (hourly.precipitation_probability || []).slice(0, 24)
  const popAllNull =
    popSample.length > 0 && popSample.every((v) => v == null)
  const variableNotes = []
  if (popAllNull) {
    variableNotes.push(
      'precipitation_probability unavailable for this model run (left null — not estimated)'
    )
  }

  const current = normalizeObservation(
    loc,
    curTime,
    {
      temperature: curTemp,
      apparent_temperature: cur.apparent_temperature ?? curTemp,
      precipitation_probability: null, // current block rarely has POP; hourly carries it
      precipitation: cur.precipitation ?? 0,
      wind_speed: curWind,
      wind_direction: curWindDir,
      humidity: cur.relative_humidity_2m ?? null,
      cloud_cover: cur.cloud_cover ?? null,
      weather_code: curCode,
      pressure_msl: cur.pressure_msl ?? null,
    },
    catalogEntry.id,
    {
      ...baseMeta,
      generationtime_ms: genMs,
      timezone: loc.timezone,
      elevation: loc.elevation,
      variable_notes: variableNotes.length ? variableNotes : null,
    }
  )

  // Align POP for "now" from nearest hourly slot when available
  if (times.length) {
    const hi = indexOfNearestHour(times, curTime)
    const hop = hourly.precipitation_probability?.[hi]
    if (hop != null) current.precipitation_probability = round(hop, 0)
    if (current.humidity == null && hourly.relative_humidity_2m?.[hi] != null) {
      current.humidity = round(hourly.relative_humidity_2m[hi], 0)
    }
    if (current.cloud_cover == null && hourly.cloud_cover?.[hi] != null) {
      current.cloud_cover = round(hourly.cloud_cover[hi], 0)
    }
  }

  const hourlyOut = []
  const n = Math.min(times.length, 48)
  for (let i = 0; i < n; i++) {
    hourlyOut.push(
      normalizeObservation(
        loc,
        times[i],
        {
          temperature: hourly.temperature_2m?.[i],
          apparent_temperature: hourly.apparent_temperature?.[i],
          precipitation_probability: hourly.precipitation_probability?.[i],
          precipitation: hourly.precipitation?.[i],
          wind_speed: hourly.wind_speed_10m?.[i],
          wind_direction: hourly.wind_direction_10m?.[i],
          humidity: hourly.relative_humidity_2m?.[i],
          cloud_cover: hourly.cloud_cover?.[i],
          weather_code: hourly.weather_code?.[i] ?? hourly.weathercode?.[i],
          pressure_msl: null,
        },
        catalogEntry.id,
        {
          ...baseMeta,
          generationtime_ms: genMs,
          timezone: loc.timezone,
          elevation: loc.elevation,
        }
      )
    )
  }

  const today = {
    date: daily.time?.[0] || null,
    temp_max: daily.temperature_2m_max?.[0] != null ? round(daily.temperature_2m_max[0], 1) : null,
    temp_min: daily.temperature_2m_min?.[0] != null ? round(daily.temperature_2m_min[0], 1) : null,
    precipitation_sum:
      daily.precipitation_sum?.[0] != null ? round(daily.precipitation_sum[0], 2) : null,
    precipitation_probability_max:
      daily.precipitation_probability_max?.[0] != null
        ? round(daily.precipitation_probability_max[0], 0)
        : null,
    wind_speed_max:
      daily.wind_speed_10m_max?.[0] != null ? round(daily.wind_speed_10m_max[0], 1) : null,
    weather_code: daily.weather_code?.[0] ?? daily.weathercode?.[0] ?? null,
  }

  // next-24h stats from real hourly only (skip nulls — no fake averages from zeros)
  const h24 = hourlyOut.slice(0, 24)
  const temps = h24.map((h) => h.temperature).filter((v) => v != null)
  const pops = h24.map((h) => h.precipitation_probability).filter((v) => v != null)
  const rains = h24.map((h) => h.precipitation).filter((v) => v != null)
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  const max = (a) => (a.length ? Math.max(...a) : null)
  const sum = (a) => (a.length ? a.reduce((x, y) => x + y, 0) : null)

  const next24h = {
    temp_mean: temps.length ? round(avg(temps), 1) : null,
    temp_max: temps.length ? round(max(temps), 1) : null,
    temp_min: temps.length ? round(Math.min(...temps), 1) : null,
    pop_max: pops.length ? round(max(pops), 0) : null,
    pop_mean: pops.length ? round(avg(pops), 0) : null,
    rain_sum: rains.length ? round(sum(rains), 2) : null,
    hours_with_data: temps.length,
    pop_hours_with_data: pops.length,
  }

  return {
    available: true,
    ok: true,
    id: catalogEntry.id,
    short: catalogEntry.short,
    label: catalogEntry.name,
    family: catalogEntry.family,
    provider: catalogEntry.provider,
    role: catalogEntry.role,
    notes: catalogEntry.notes,
    error: null,
    current,
    hourly: hourlyOut,
    daily: {
      time: daily.time || [],
      temperature_2m_max: (daily.temperature_2m_max || []).map((v) => (v == null ? null : round(v, 1))),
      temperature_2m_min: (daily.temperature_2m_min || []).map((v) => (v == null ? null : round(v, 1))),
      precipitation_sum: (daily.precipitation_sum || []).map((v) => (v == null ? null : round(v, 2))),
      precipitation_probability_max: (daily.precipitation_probability_max || []).map((v) =>
        v == null ? null : round(v, 0)
      ),
      wind_speed_10m_max: (daily.wind_speed_10m_max || []).map((v) => (v == null ? null : round(v, 1))),
      weather_code: daily.weather_code || daily.weathercode || [],
    },
    today,
    next24h,
    // Legacy ClimateTab / older clients
    currentTemp: current.temperature != null ? Math.round(current.temperature) : null,
    currentCode: current.weather_code,
    currentWind: current.wind_speed != null ? Math.round(current.wind_speed) : null,
    meta: current.meta,
    raw_units: {
      current: raw.current_units || null,
      hourly: raw.hourly_units || null,
    },
  }
}

/**
 * Fetch one model; never throws — returns available:false on failure.
 */
export async function fetchOneModel(lat, lon, catalogEntry, opts = {}) {
  const fetchedAt = new Date().toISOString()
  const location = {
    name: opts.name || null,
    lat,
    lon,
    timezone: opts.tz || 'auto',
  }
  try {
    const url = buildModelUrl(lat, lon, catalogEntry.id, {
      tz: opts.tz || 'auto',
      forecastDays: opts.forecastDays ?? 2,
      hourlyHours: opts.hourlyHours ?? 48,
    })
    const raw = await fetchJson(url, opts.timeoutMs ?? 14000)
    return normalizeModelPayload(raw, catalogEntry, location, fetchedAt)
  } catch (e) {
    return {
      available: false,
      ok: false,
      id: catalogEntry.id,
      short: catalogEntry.short,
      label: catalogEntry.name,
      family: catalogEntry.family,
      provider: catalogEntry.provider,
      role: catalogEntry.role,
      notes: catalogEntry.notes,
      error: e.message || 'fetch failed',
      current: null,
      hourly: [],
      daily: null,
      next24h: null,
      today: null,
      currentTemp: null,
      currentCode: null,
      currentWind: null,
      meta: {
        model_name: catalogEntry.name,
        model_id: catalogEntry.id,
        provider: catalogEntry.provider,
        model_run_time: null,
        source: 'Open-Meteo Forecast API',
        fetched_at: fetchedAt,
      },
    }
  }
}

function agreementCopy(spreadC, okCount) {
  if (okCount <= 0) {
    return {
      en: 'No reliable NWP model responded.',
      hi: 'कोई विश्वसनीय NWP मॉडल उपलब्ध नहीं।',
      level: 'none',
    }
  }
  if (okCount === 1) {
    return {
      en: 'Single reliable model only — not multi-model consensus. Treat as one-model forecast.',
      hi: 'केवल एक विश्वसनीय मॉडल — मल्टी-मॉडल सहमति नहीं।',
      level: 'single',
    }
  }
  if (spreadC == null) {
    return {
      en: `${okCount} models available; temperature spread not computable.`,
      hi: `${okCount} मॉडल उपलब्ध; तापमान फैलाव गणना नहीं हो सकी।`,
      level: 'unknown',
    }
  }
  if (spreadC <= 1.2) {
    return {
      en: `High agreement — 24h mean temp spread only ${spreadC}°C across ${okCount} models.`,
      hi: `उच्च सहमति — ${okCount} मॉडलों में 24घं औसत तापमान फैलाव सिर्फ ${spreadC}°C।`,
      level: 'high',
    }
  }
  if (spreadC <= 2.5) {
    return {
      en: `Moderate agreement — spread ${spreadC}°C across ${okCount} models; prefer blend for planning.`,
      hi: `मध्यम सहमति — ${okCount} मॉडल, फैलाव ${spreadC}°C; प्लानिंग के लिए ब्लेंड बेहतर।`,
      level: 'moderate',
    }
  }
  return {
    en: `Low agreement — spread ${spreadC}°C across ${okCount} models; extra caution.`,
    hi: `कम सहमति — ${okCount} मॉडल, फैलाव ${spreadC}°C; अतिरिक्त सावधानी।`,
    level: 'low',
  }
}

/**
 * Aggregate all catalog models in parallel.
 * primary = best_match if ok, else first available compare model.
 */
export async function aggregateMultiModel(lat, lon, opts = {}) {
  const name = (opts.name || 'Area').toString().slice(0, 64)
  const tz = opts.tz || 'auto'
  const catalog = opts.catalog || MODEL_CATALOG
  const fetchedAt = new Date().toISOString()

  const results = await Promise.all(
    catalog.map((m) =>
      fetchOneModel(lat, lon, m, {
        name,
        tz,
        timeoutMs: opts.timeoutMs ?? 14000,
        forecastDays: opts.forecastDays ?? 2,
        hourlyHours: opts.hourlyHours ?? 48,
      })
    )
  )

  const available = results.filter((r) => r.available && r.ok)
  const unavailable = results
    .filter((r) => !r.available || !r.ok)
    .map((r) => ({ id: r.id, short: r.short, error: r.error || 'unavailable' }))

  // Prefer best_match as primary UI truth; else first available
  let primary =
    available.find((r) => r.id === 'best_match') ||
    available.find((r) => r.role === 'primary') ||
    available[0] ||
    null

  // Ensemble from compare models that have temp_mean (exclude pure failures)
  const ensembleSources = available.filter((r) => r.next24h?.temp_mean != null)
  // For spread honesty: use distinct families (optional) — include all available with temp
  const temps = ensembleSources.map((r) => r.next24h.temp_mean)
  const spreadC =
    temps.length >= 2 ? round(Math.max(...temps) - Math.min(...temps), 1) : null
  const meanTemp24h =
    temps.length ? round(temps.reduce((a, b) => a + b, 0) / temps.length, 1) : null

  const pops = ensembleSources
    .map((r) => r.next24h?.pop_max)
    .filter((v) => v != null)
  const popSpread =
    pops.length >= 2 ? round(Math.max(...pops) - Math.min(...pops), 0) : null

  const agree = agreementCopy(spreadC, available.length)

  const multiModelMode =
    available.length >= 2 ? 'multi' : available.length === 1 ? 'single' : 'none'

  const summary = results.map((r) => ({
    id: r.id,
    short: r.short,
    label: r.label,
    available: !!r.available,
    error: r.error || null,
    temperature: r.current?.temperature ?? null,
    apparent_temperature: r.current?.apparent_temperature ?? null,
    precipitation_probability: r.current?.precipitation_probability ?? null,
    precipitation: r.current?.precipitation ?? null,
    wind_speed: r.current?.wind_speed ?? null,
    wind_direction: r.current?.wind_direction ?? null,
    humidity: r.current?.humidity ?? null,
    cloud_cover: r.current?.cloud_cover ?? null,
    weather_code: r.current?.weather_code ?? null,
    source_model: r.id,
    next24h: r.next24h,
    today: r.today,
    meta: r.meta
      ? {
          model_name: r.meta.model_name,
          model_run_time: r.meta.model_run_time,
          forecast_timestamp: r.meta.forecast_timestamp || r.current?.timestamp,
          source: r.meta.source,
          fetched_at: r.meta.fetched_at,
          variable_notes: r.meta.variable_notes || null,
        }
      : null,
  }))

  const bundleCore = {
    ok: available.length > 0,
    live: available.length > 0,
    schema: 'weathergpt.multi_model.v1',
    place: name,
    lat,
    lon,
    timezone: primary?.current?.location?.timezone || tz,
    fetchedAt,
    multi_model_mode: multiModelMode,
    primary_model_id: primary?.id || null,
    primary_observation: primary?.current || null,
    models: results,
    available_count: available.length,
    unavailable,
    ensemble: {
      meanTemp24h,
      spreadC,
      popMaxSpread: popSpread,
      modelCount: available.length,
      modelsUsed: ensembleSources.map((r) => r.id),
      agreementLevel: agree.level,
      agreementEn: agree.en,
      agreementHi: agree.hi,
      // Explicit honesty flags
      is_consensus: available.length >= 2 && spreadC != null,
      single_model_only: available.length === 1,
      no_models: available.length === 0,
    },
    sources: [
      {
        name: 'Open-Meteo multi-model',
        role: 'ECMWF IFS · GFS · ICON · ECMWF AIFS · best_match',
        url: 'https://open-meteo.com/en/docs',
      },
    ],
    note:
      multiModelMode === 'multi'
        ? 'Multi-model comparison from live Open-Meteo runs. Values are model grid forecasts — not station observations. AI must not invent missing fields.'
        : multiModelMode === 'single'
          ? 'Only one NWP model returned usable data. UI must not claim multi-model consensus.'
          : 'No NWP model returned usable data.',
    summary,
  }

  // Deterministic confidence — never LLM / never random
  const confidence = confidenceFromMultiModelBundle(bundleCore, {
    fetchedAt,
    horizonHours: opts.horizonHours ?? 24,
    nowMs: opts.nowMs,
  })

  return {
    ...bundleCore,
    confidence,
  }
}

/**
 * Default full forecast URL (no models= → Open-Meteo best_match behaviour).
 * Used by /api/weather primary path — preserves existing 7-day UX.
 */
export function buildDefaultForecastUrl(lat, lon, tz = 'auto', forecastDays = 7) {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,pressure_msl,visibility` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,visibility,wind_speed_10m,relative_humidity_2m,cloud_cover,apparent_temperature,wind_direction_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset` +
    `&timezone=${encodeURIComponent(tz)}&forecast_days=${forecastDays}`
  )
}
