/**
 * Weather service — LIVE-first with:
 * 1) Same-origin /api/weather proxy (Vercel serverless)
 * 2) Direct Open-Meteo (local dev / fallback)
 * 3) Simplified Open-Meteo schema
 * 4) Offline pack only if everything fails
 */

import { CITIES, getCity } from '../data/cities.js'
import { dbGetWeather, dbPutWeather, dbGetWeatherAny, isSlowNetwork } from './db.js'
import {
  markPackCached,
  markPackLive,
  getNetworkSnapshot,
  fetchTimeoutMs,
  shouldSkipPrefetch,
  FRESH_MS,
  STALE_MS,
  OFFLINE_MAX_MS,
} from './networkStatus.js'
import {
  wmoInfoHonest,
  rainIntensityFromMm,
  calibratePop as reCalibratePop,
  dayPopFrom as reDayPopFrom,
  buildLockedWeatherFacts,
  formatSourceFooter,
} from './ruleEngine.js'
import {
  createInflight,
  createTtlCache,
  perfMark,
  perfTime,
  timedFetch,
  getPerfSnapshot,
} from './perf.js'
import {
  buildRiskSignalsFromForecast,
  buildAlertBundle,
  buildDemoRedAlert,
  gdacsToOfficialAlert,
  floodToRiskSignal,
  normalizeAlert,
  mergeAlertLists,
} from './alertEngine.js'

const WMO = {
  0: { en: 'Clear sky', hi: 'साफ आसमान', icon: 'sun', severity: 'green' },
  1: { en: 'Mainly clear', hi: 'मुख्यतः साफ', icon: 'sun', severity: 'green' },
  2: { en: 'Partly cloudy', hi: 'आंशिक बादल', icon: 'cloud-sun', severity: 'green' },
  3: { en: 'Overcast', hi: 'घने बादल', icon: 'cloud', severity: 'green' },
  45: { en: 'Fog', hi: 'कोहरा', icon: 'cloud-fog', severity: 'yellow' },
  48: { en: 'Depositing rime fog', hi: 'कोहरा', icon: 'cloud-fog', severity: 'yellow' },
  51: { en: 'Light drizzle', hi: 'हल्की फुहार', icon: 'cloud-drizzle', severity: 'yellow' },
  53: { en: 'Drizzle', hi: 'फुहार', icon: 'cloud-drizzle', severity: 'yellow' },
  55: { en: 'Dense drizzle', hi: 'घनी फुहार', icon: 'cloud-drizzle', severity: 'amber' },
  61: { en: 'Slight rain', hi: 'हल्की बारिश', icon: 'cloud-rain', severity: 'yellow' },
  63: { en: 'Moderate rain', hi: 'मध्यम बारिश', icon: 'cloud-rain', severity: 'amber' },
  65: { en: 'Heavy rain', hi: 'तेज़ बारिश', icon: 'cloud-rain', severity: 'amber' },
  66: { en: 'Light freezing rain', hi: 'हल्की जमने वाली बारिश', icon: 'cloud-rain', severity: 'amber' },
  67: { en: 'Heavy freezing rain', hi: 'तेज़ जमने वाली बारिश', icon: 'cloud-rain', severity: 'red' },
  71: { en: 'Slight snow', hi: 'हल्की बर्फ', icon: 'snow', severity: 'yellow' },
  73: { en: 'Moderate snow', hi: 'मध्यम बर्फ', icon: 'snow', severity: 'amber' },
  75: { en: 'Heavy snow', hi: 'भारी बर्फ', icon: 'snow', severity: 'red' },
  80: { en: 'Slight rain showers', hi: 'हल्की बौछारें', icon: 'cloud-rain', severity: 'yellow' },
  81: { en: 'Rain showers', hi: 'बौछारें', icon: 'cloud-rain', severity: 'amber' },
  82: { en: 'Violent rain showers', hi: 'तेज़ बौछारें', icon: 'cloud-rain', severity: 'red' },
  95: { en: 'Thunderstorm', hi: 'आंधी-तूफान', icon: 'cloud-lightning', severity: 'amber' },
  96: { en: 'Thunderstorm · hail possible (model)', hi: 'तूफान · ओले संभव (मॉडल)', icon: 'cloud-lightning', severity: 'red' },
  99: { en: 'Severe thunderstorm · heavy hail possible (model)', hi: 'गंभीर तूफान · भारी ओले संभव (मॉडल)', icon: 'cloud-lightning', severity: 'red' },
}

export function wmoInfo(code, lang = 'en') {
  // Prefer rule-engine honest table (hail = possible, not guaranteed)
  try {
    const h = wmoInfoHonest(code, lang)
    return {
      condition: h.condition,
      icon: h.icon,
      severity: h.severity,
      code: h.code,
      hailPossible: h.hailPossible,
      storm: h.storm,
      note: h.note,
      intensity: h.intensity,
    }
  } catch {
    const info = WMO[code] || WMO[2]
    return {
      condition: lang === 'hi' ? info.hi : info.en,
      icon: info.icon,
      severity: info.severity,
      code,
      hailPossible: code === 96 || code === 99,
      storm: code >= 95,
      note: null,
      intensity: null,
    }
  }
}

// Re-export calibrate helpers (single implementation in ruleEngine)
export function calibratePop(rawPop, rainMm = 0, code = 0) {
  return reCalibratePop(rawPop, rainMm, code)
}

function safeMax(arr, fallback = 0) {
  if (!arr || !arr.length) return fallback
  return Math.max(...arr.map((n) => (Number.isFinite(n) ? n : fallback)))
}

function dayPopFrom(dailyPopMax, rainMm, code, hourlyPopsForDay = []) {
  return reDayPopFrom(dailyPopMax, rainMm, code, hourlyPopsForDay)
}

function soilMoistureLevel(mmRecent, mmForecast, humidity) {
  const score = mmRecent * 0.6 + mmForecast * 0.3 + (humidity > 70 ? 15 : 0)
  if (score > 80) return { en: 'High', hi: 'उच्च', level: 'high', color: 'sky' }
  if (score > 35) return { en: 'Medium', hi: 'मध्यम', level: 'medium', color: 'sun' }
  return { en: 'Low', hi: 'कम', level: 'low', color: 'alert' }
}

function irrigationAdvice(recent, forecast, soil, lang) {
  const disc = lang === 'hi'
    ? ' (केवल मौसम-प्रॉक्सी — फसल अवस्था/मिट्टी सेंसर नहीं)'
    : ' (weather-proxy only — no crop stage/soil sensor)'
  if (soil.level === 'high' || forecast > 40) {
    return (lang === 'hi'
      ? 'अगले 3–4 दिन सिंचाई रोकने पर विचार। जल निकासी सुनिश्चित करें।'
      : 'Consider holding irrigation 3–4 days. Ensure field drainage is clear.') + disc
  }
  if (soil.level === 'low' && forecast < 10) {
    return (lang === 'hi'
      ? 'इस सप्ताह हल्की सिंचाई — मिट्टी सूखी संकेत, बारिश कम।'
      : 'Light irrigation this week — dry-soil signal, low rain.') + disc
  }
  if (forecast >= 15 && forecast <= 40) {
    return (lang === 'hi'
      ? 'सिंचाई टालने पर विचार; मध्यम बारिश संकेत। छिड़काव लेबल/स्थानीय सलाह से।'
      : 'Consider deferring irrigation; moderate rain signal. Spray per label/local advice.') + disc
  }
  return (lang === 'hi'
    ? 'मिट्टी नमी मध्यम संकेत — तनाव दिखे तो हल्की सिंचाई।'
    : 'Medium soil-moisture signal — light irrigation only if crop shows stress.') + disc
}

function buildAlerts(city, daily, current, opts = {}) {
  // WeatherGPT RISK SIGNALS only — never official IMD/NDMA
  return buildRiskSignalsFromForecast(city, daily, current, opts)
}


/** Normalize both full and simple Open-Meteo payloads */
function normalizePayload(data) {
  // Modern current block
  if (data.current) {
    return data
  }
  // Legacy current_weather
  if (data.current_weather) {
    const cw = data.current_weather
    const hourly = data.hourly || {}
    const daily = data.daily || {}
    // map weathercode → weather_code
    const hCodes = hourly.weather_code || hourly.weathercode || []
    const dCodes = daily.weather_code || daily.weathercode || []
    return {
      current: {
        temperature_2m: cw.temperature,
        weather_code: cw.weathercode ?? cw.weather_code ?? 0,
        wind_speed_10m: cw.windspeed ?? cw.wind_speed ?? 0,
        wind_direction_10m: cw.winddirection ?? 0,
        is_day: cw.is_day ?? 1,
        relative_humidity_2m: 60,
        apparent_temperature: cw.temperature,
        precipitation: 0,
        pressure_msl: 1010,
        visibility: null,
        time: cw.time,
      },
      hourly: {
        time: hourly.time || [],
        temperature_2m: hourly.temperature_2m || [],
        precipitation_probability: hourly.precipitation_probability || [],
        precipitation: hourly.precipitation || [],
        weather_code: hCodes,
        visibility: hourly.visibility || [],
      },
      daily: {
        time: daily.time || [],
        weather_code: dCodes,
        temperature_2m_max: daily.temperature_2m_max || [],
        temperature_2m_min: daily.temperature_2m_min || [],
        precipitation_sum: daily.precipitation_sum || [],
        precipitation_probability_max: daily.precipitation_probability_max || daily.precipitation_sum?.map(() => 40) || [],
        wind_speed_10m_max: daily.wind_speed_10m_max || [],
        uv_index_max: daily.uv_index_max || [],
        sunrise: daily.sunrise || [],
        sunset: daily.sunset || [],
      },
      _source: data._source || 'normalized-legacy',
    }
  }
  throw new Error('Unrecognized weather payload')
}

function parseWeather(city, raw, liveMeta = {}) {
  const data = normalizePayload(raw)
  const cur = data.current
  const daily = data.daily || {}
  const hourly = data.hourly || {}
  const code = cur.weather_code ?? cur.weathercode ?? 0
  const info = wmoInfo(code)

  const precipSum = daily.precipitation_sum || []
  const recentRain = precipSum.slice(0, 2).reduce((a, b) => a + (b || 0), 0)
  const forecastRain = precipSum.slice(0, 5).reduce((a, b) => a + (b || 0), 0)
  const humidity = cur.relative_humidity_2m ?? 60
  const soil = soilMoistureLevel(recentRain + forecastRain * 0.2, forecastRain, humidity)

  const times = daily.time || []
  const hTimesAll = hourly.time || []
  const hPopAll = hourly.precipitation_probability || []
  const days = times.slice(0, 7).map((date, i) => {
    const dCode = (daily.weather_code || daily.weathercode || [])[i] ?? 2
    const di = wmoInfo(dCode)
    const rainMm = +((daily.precipitation_sum?.[i] ?? 0)).toFixed(1)
    const rawPop = daily.precipitation_probability_max?.[i] ?? 0
    // Collect hourly POPs that fall on this calendar date (model tz / ISO date prefix)
    const dayHourlyPops = []
    for (let hi = 0; hi < hTimesAll.length; hi++) {
      const ht = hTimesAll[hi]
      if (typeof ht === 'string' && ht.slice(0, 10) === date) {
        const pv = hPopAll[hi]
        if (pv != null && Number.isFinite(Number(pv))) dayHourlyPops.push(Number(pv))
      }
    }
    return {
      date,
      weekday: new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' }),
      weekday_hi: new Date(date + 'T12:00:00').toLocaleDateString('hi-IN', { weekday: 'short' }),
      max: Math.round(daily.temperature_2m_max?.[i] ?? cur.temperature_2m ?? 30),
      min: Math.round(daily.temperature_2m_min?.[i] ?? (cur.temperature_2m ?? 30) - 6),
      rain: rainMm,
      pop: dayPopFrom(rawPop, rainMm, dCode, dayHourlyPops),
      popRaw: Math.round(Number(rawPop) || 0),
      intensity: rainIntensityFromMm(rainMm, 24),
      wind: Math.round(daily.wind_speed_10m_max?.[i] || 0),
      uv: daily.uv_index_max?.[i] ?? null,
      code: dCode,
      condition: di.condition,
      condition_hi: wmoInfo(dCode, 'hi').condition,
      icon: di.icon,
    }
  })

  // Ensure at least 1 day
  if (!days.length) {
    days.push({
      date: new Date().toISOString().slice(0, 10),
      weekday: 'Today',
      weekday_hi: 'आज',
      max: Math.round(cur.temperature_2m ?? 30),
      min: Math.round((cur.temperature_2m ?? 30) - 5),
      rain: 0,
      pop: 0,
      wind: Math.round(cur.wind_speed_10m ?? 0),
      uv: null,
      code,
      condition: info.condition,
      condition_hi: wmoInfo(code, 'hi').condition,
      icon: info.icon,
    })
  }

  // Align "now" to station timezone so past-hour filter isn't UTC-skewed
  const tzName =
    (typeof data.timezone === 'string' && data.timezone) ||
    city.tz ||
    'Asia/Kolkata'
  let nowMs = Date.now()
  try {
    // Prefer Open-Meteo current.time when present
    if (cur.time) {
      const ct = new Date(cur.time).getTime()
      if (!Number.isNaN(ct)) nowMs = ct
    }
  } catch {
    /* keep Date.now */
  }
  const hours = []
  const hTimes = hourly.time || []
  for (let i = 0; i < hTimes.length && hours.length < 24; i++) {
    const t = new Date(hTimes[i]).getTime()
    // Drop slots more than ~50 min in the past relative to current observation
    if (!Number.isNaN(t) && t < nowMs - 50 * 60 * 1000) continue
    const hCode = (hourly.weather_code || hourly.weathercode || [])[i] ?? code
    let label = ''
    try {
      label = new Date(hTimes[i]).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        hour12: true,
        timeZone: tzName,
      })
    } catch {
      label = new Date(hTimes[i]).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true })
    }
    const hRain = hourly.precipitation?.[i] ?? 0
    const hPopRaw = hourly.precipitation_probability?.[i] ?? 0
    hours.push({
      time: hTimes[i],
      label,
      temp: Math.round(hourly.temperature_2m?.[i] ?? cur.temperature_2m ?? 28),
      pop: calibratePop(hPopRaw, hRain, hCode),
      popRaw: Math.round(Number(hPopRaw) || 0),
      rain: hRain,
      code: hCode,
      icon: wmoInfo(hCode).icon,
      visibility: hourly.visibility?.[i] != null ? hourly.visibility[i] / 1000 : null,
    })
  }

  // Synthetic hourly if missing — start at current hour
  if (!hours.length) {
    for (let i = 0; i < 12; i++) {
      const d = new Date(nowMs + i * 3600000)
      let label = ''
      try {
        label = d.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true, timeZone: tzName })
      } catch {
        label = d.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true })
      }
      hours.push({
        time: d.toISOString(),
        label,
        temp: Math.round((cur.temperature_2m ?? 28) + Math.sin(i / 3) * 2),
        pop: days[0]?.pop ?? 20,
        rain: 0,
        code,
        icon: info.icon,
        visibility: null,
      })
    }
  }

  // First tray slot always mirrors live current temp (avoids hour-bucket mismatch)
  if (hours[0] && cur.temperature_2m != null) {
    hours[0] = {
      ...hours[0],
      temp: Math.round(cur.temperature_2m),
      pop: hours[0].pop ?? days[0]?.pop ?? 0,
      icon: info.icon,
      code,
    }
  }

  const visibilityKm =
    cur.visibility != null
      ? cur.visibility > 100
        ? cur.visibility / 1000
        : cur.visibility
      : null

  // Confidence may arrive later in pack; risk signals can omit until then
  const earlyConfidence =
    (raw.confidence && typeof raw.confidence === 'object' ? raw.confidence : null) ||
    (raw.multi_model?.confidence && typeof raw.multi_model.confidence === 'object'
      ? raw.multi_model.confidence
      : null)

  const riskSignals = buildAlerts(
    city,
    {
      precipitation_probability_max: days.map((d) => d.pop),
      precipitation_sum: days.map((d) => d.rain),
      wind_speed_10m_max: days.map((d) => d.wind),
      weather_code: days.map((d) => d.code),
    },
    { weather_code: code },
    { confidence: earlyConfidence }
  )

  // Live external from proxy — classify official vs risk (never invent IMD)
  const external = Array.isArray(raw.live_alerts)
    ? raw.live_alerts
    : Array.isArray(liveMeta.live_alerts)
      ? liveMeta.live_alerts
      : []

  const official = []
  const externalRisk = []
  for (const a of external) {
    const src = String(a.source || '')
    if (/gdacs/i.test(src) || a.kind === 'official') {
      official.push(gdacsToOfficialAlert({ ...a, place: a.place || city.name }))
    } else if (/flood/i.test(src)) {
      externalRisk.push(floodToRiskSignal({ ...a, place: a.place || city.name }))
    } else {
      // Modelled proxy rows → risk signals
      externalRisk.push(
        normalizeAlert({
          ...a,
          kind: 'risk_signal',
          place: a.place || city.name,
          source: a.source || 'WeatherGPT · proxy model',
        })
      )
    }
  }

  const alertBundle = buildAlertBundle({
    official: official.filter(Boolean),
    risk: [...riskSignals, ...externalRisk.filter(Boolean)],
    demo: [],
  })
  const mergedAlerts = alertBundle.alerts

  const sunrise = daily.sunrise?.[0]
  const sunset = daily.sunset?.[0]

  // Multi-model block from server only (never invented client-side)
  const multiModel =
    raw.multi_model && typeof raw.multi_model === 'object' ? raw.multi_model : null
  const primaryModelId =
    multiModel?.primary_model_id ||
    raw.model_meta?.name ||
    raw.model ||
    liveMeta.model ||
    'open-meteo-best_match'

  // Deterministic confidence from server engine only — never invent client-side scores
  const confidence =
    (raw.confidence && typeof raw.confidence === 'object' && raw.confidence.engine
      ? raw.confidence
      : null) ||
    (multiModel?.confidence && typeof multiModel.confidence === 'object'
      ? multiModel.confidence
      : null)

  const pack = {
    city,
    location: city
      ? {
          id: city.id,
          name: city.name,
          lat: city.lat,
          lon: city.lon,
          tz: city.tz || tzName,
          countryCode: city.countryCode,
        }
      : null,
    fetchedAt: Date.now(),
    timezone: tzName,
    live: true,
    stale: false,
    fromCache: false,
    demo: false,
    synthetic: false,
    dataStatus: 'live',
    liveSource: liveMeta.source || raw._source || 'open-meteo',
    source: liveMeta.source || raw._source || 'open-meteo',
    alertMeta: raw.alert_sources || liveMeta.alert_sources || null,
    // Server-aggregated multi-model (common schema summaries)
    multiModel,
    multi_model_mode: multiModel?.multi_model_mode || null,
    // Forecast confidence (deterministic engine — LLM must not override)
    confidence,
    current: {
      temp: Math.round(cur.temperature_2m ?? 28),
      feelsLike: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 28),
      humidity: Math.round(humidity),
      wind: Math.round(cur.wind_speed_10m ?? 0),
      windDir: cur.wind_direction_10m ?? 0,
      pressure: Math.round(cur.pressure_msl ?? 1010),
      precip: cur.precipitation || 0,
      cloudCover: cur.cloud_cover != null ? Math.round(cur.cloud_cover) : null,
      code,
      condition: info.condition,
      condition_hi: wmoInfo(code, 'hi').condition,
      icon: info.icon,
      isDay: cur.is_day === 1 || cur.is_day === true,
      visibility: visibilityKm,
      time: cur.time || null,
      source_model: primaryModelId,
    },
    daily: days,
    hourly: hours,
    astro: {
      sunrise: typeof sunrise === 'string' ? sunrise.slice(11, 16) : '--:--',
      sunset: typeof sunset === 'string' ? sunset.slice(11, 16) : '--:--',
    },
    agri: {
      recentRain: +recentRain.toFixed(1),
      forecastRain: +forecastRain.toFixed(1),
      soil,
      advice_en: irrigationAdvice(recentRain, forecastRain, soil, 'en'),
      advice_hi: irrigationAdvice(recentRain, forecastRain, soil, 'hi'),
      crops: city.crops || ['wheat', 'rice', 'vegetables'],
      sprayWindow:
        (days[0]?.pop || 0) < 40 && (cur.wind_speed_10m ?? 0) < 15
          ? { en: 'Favourable morning spray window', hi: 'सुबह छिड़काव के लिए अनुकूल' }
          : { en: 'Unfavourable for spraying (rain/wind)', hi: 'छिड़काव अनुकूल नहीं (बारिश/हवा)' },
    },
    alerts: mergedAlerts,
    alertBundle: {
      schema: alertBundle.schema,
      official_alerts: alertBundle.official_alerts,
      risk_signals: alertBundle.risk_signals,
      counts: alertBundle.counts,
      official_sources_status: alertBundle.official_sources_status,
      honesty: alertBundle.honesty,
    },
    sources: [
      {
        name: liveMeta.source === 'proxy' ? 'Open-Meteo Forecast API (via proxy)' : 'Open-Meteo Forecast API',
        role: 'Primary NWP grid forecast (temp/wind/precip/WMO codes) — not a personal station',
        url: 'https://open-meteo.com/en/docs',
      },
      {
        name: 'Model / feed',
        role: String(primaryModelId),
        url: 'https://open-meteo.com/en/docs',
      },
      ...(multiModel?.available_count >= 2
        ? [
            {
              name: 'Multi-model NWP',
              role: `Server-side ${multiModel.available_count} models · mode=${multiModel.multi_model_mode} · ${multiModel.ensemble?.agreementEn || ''}`.slice(
                0,
                160
              ),
              url: 'https://open-meteo.com/en/docs',
            },
          ]
        : multiModel?.multi_model_mode === 'single'
          ? [
              {
                name: 'Single NWP model',
                role: 'Only one reliable model available — not multi-model consensus',
                url: 'https://open-meteo.com/en/docs',
              },
            ]
          : []),
      { name: 'GDACS', role: 'Multi-hazard events near region (when proxy attaches)', url: 'https://www.gdacs.org' },
      { name: 'Open-Meteo Flood API', role: 'River discharge signal (when enabled)', url: 'https://open-meteo.com/en/docs/flood-api' },
      {
        name: 'IMD',
        role: 'IMD/NDMA NOT auto-ingested — never invent official Indian warnings; risk signals are WeatherGPT-only',
        url: 'https://mausam.imd.gov.in',
      },
      {
        name: 'WeatherGPT rules + AI',
        role: 'Explains locked weather JSON; must not invent numbers',
        url: null,
      },
    ],
    model: primaryModelId,
    model_meta: raw.model_meta || {
      name: primaryModelId,
      source: 'Open-Meteo Forecast API',
      multi_model_mode: multiModel?.multi_model_mode || null,
      fetched_at: new Date().toISOString(),
    },
  }
  try {
    pack.facts = buildLockedWeatherFacts(pack)
  } catch (e) {
    pack.facts = null
  }
  return pack
}


function offlinePack(city) {
  const baseTemp = city.region?.includes('Coast') ? 30 : city.region?.includes('Arid') ? 34 : 28
  const seed = (city.lat || 26) + (city.lon || 80)
  const rainBias = (Math.sin(seed) + 1) * 20
  const code = rainBias > 28 ? 63 : rainBias > 18 ? 61 : 2
  const info = wmoInfo(code)
  const today = new Date()
  const daily = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const r = Math.max(0, rainBias - i * 4 + (i % 2) * 6)
    const c = r > 25 ? 63 : r > 10 ? 61 : i === 2 ? 3 : 1
    daily.push({
      date: iso,
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      weekday_hi: d.toLocaleDateString('hi-IN', { weekday: 'short' }),
      max: Math.round(baseTemp + 4 - i * 0.5),
      min: Math.round(baseTemp - 6),
      rain: +r.toFixed(1),
      // Offline: keep POP honest vs mm (old r*3 hit 95 too often)
      pop: calibratePop(Math.min(75, Math.round(r * 2.2 + 8)), r, c),
      wind: 12 + i * 2,
      uv: 7 - i * 0.5,
      code: c,
      condition: wmoInfo(c).condition,
      condition_hi: wmoInfo(c, 'hi').condition,
      icon: wmoInfo(c).icon,
    })
  }
  const hourly = []
  for (let i = 0; i < 24; i++) {
    const d = new Date(today)
    d.setHours(d.getHours() + i, 0, 0, 0)
    hourly.push({
      time: d.toISOString(),
      label: d.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true }),
      temp: Math.round(baseTemp + Math.sin(i / 3) * 3),
      pop: calibratePop(
        Math.min(70, Math.round(rainBias * 0.7 + (i > 12 ? 8 : -8))),
        i > 14 && i < 20 ? 1.2 : 0,
        i > 14 && i < 20 ? 61 : 2
      ),
      rain: i > 14 && i < 20 ? 1.2 : 0,
      code: i > 14 && i < 20 ? 61 : 2,
      icon: i > 14 && i < 20 ? 'cloud-rain' : 'cloud-sun',
    })
  }
  const recentRain = daily.slice(0, 2).reduce((a, b) => a + b.rain, 0)
  const forecastRain = daily.reduce((a, b) => a + b.rain, 0)
  const soil = soilMoistureLevel(recentRain, forecastRain, 60)
  const alerts = buildAlertBundle({
    official: [],
    risk: buildAlerts(
      city,
      {
        precipitation_probability_max: daily.map((d) => d.pop),
        precipitation_sum: daily.map((d) => d.rain),
        wind_speed_10m_max: daily.map((d) => d.wind),
        weather_code: daily.map((d) => d.code),
      },
      { weather_code: code },
      { confidence: { score: 22, level: 'LOW', engine: 'weathergpt.confidence.v1' } }
    ),
    demo: [],
  }).alerts
  const pack = {
    city,
    fetchedAt: Date.now(),
    timezone: city.tz || 'Asia/Kolkata',
    live: false,
    demo: true,
    synthetic: true,
    stale: true,
    fromCache: false,
    dataStatus: 'offline',
    liveSource: 'offline-demo',
    source: 'offline-demo',
    // Deterministic low confidence for synthetic offline (not random, not LLM)
    confidence: {
      engine: 'weathergpt.confidence.v1',
      score: 22,
      level: 'LOW',
      reasons: [
        'Offline synthetic pack — not live multi-model data',
        'Confidence capped for non-live forecasts',
      ],
      modelAgreement: {
        modelCount: 0,
        agreementLevel: 'none',
        modelsUsed: [],
        temperature: { values: {}, count: 0, mean: null, spread: null },
        precipitation_probability: { values: {}, count: 0, mean: null, spread: null },
        precipitation: { values: {}, count: 0, mean: null, spread: null },
        wind_speed: { values: {}, count: 0, mean: null, spread: null },
      },
      meta: { deterministic: true, llm_decides: false, random: false, live: false },
    },
    current: {
      temp: Math.round(baseTemp),
      feelsLike: Math.round(baseTemp + 2),
      humidity: 60,
      wind: 14,
      windDir: 220,
      pressure: 1008,
      precip: 0,
      code,
      condition: info.condition,
      condition_hi: wmoInfo(code, 'hi').condition,
      icon: info.icon,
      isDay: true,
      visibility: 8,
      time: new Date().toISOString(),
    },
    daily,
    hourly,
    astro: { sunrise: '05:48', sunset: '18:32' },
    agri: {
      recentRain: +recentRain.toFixed(1),
      forecastRain: +forecastRain.toFixed(1),
      soil,
      advice_en: irrigationAdvice(recentRain, forecastRain, soil, 'en'),
      advice_hi: irrigationAdvice(recentRain, forecastRain, soil, 'hi'),
      crops: city.crops || ['wheat', 'rice', 'vegetables'],
      sprayWindow:
        daily[0].pop < 40
          ? { en: 'Favourable morning spray window', hi: 'सुबह छिड़काव के लिए अनुकूल' }
          : { en: 'Unfavourable for spraying (rain/wind)', hi: 'छिड़काव अनुकूल नहीं (बारिश/हवा)' },
    },
    alerts,
    sources: [
      { name: 'Offline pack', role: 'Fallback when network blocked', url: null },
      { name: 'WeatherGPT risk engine', role: 'Model thresholds only — NOT official IMD/NDMA', url: null },
    ],
  }
  try {
    pack.facts = buildLockedWeatherFacts(pack)
  } catch {
    pack.facts = null
  }
  return pack
}

const memCache = createTtlCache({ name: 'weather', defaultTtlMs: 4 * 60 * 1000 })
const inflight = createInflight()
/** generation token per city — prevents stale overwrite */
const cityGen = new Map()

// TTLs (sensible for free NWP + UX)
const TTL_LIVE_PACK = FRESH_MS // soft-fresh window for mem "live" packs
const TTL_OFFLINE = 45 * 1000 // synthetic demo packs must not stick
const IDB_SOFT_AGE = STALE_MS // prefer revalidate after 30 min
const IDB_MAX_AGE = 12 * 60 * 60 * 1000 // slow-net may keep disk longer before force
const IDB_STALE_OK = OFFLINE_MAX_MS // absolute offline ceiling 72h

// Legacy Map facade for clearCache / memoryCacheStats
const cache = {
  get(key) {
    return memCache.peek(key)
  },
  set(key, value) {
    memCache.set(key, value)
  },
  delete(key) {
    memCache.delete(key)
    cityGen.delete(key)
  },
  clear() {
    memCache.clear()
    cityGen.clear()
    inflight.clear()
  },
  get size() {
    return memCache.size()
  },
  keys() {
    return []
  },
}

function openMeteoDirectUrl(lat, lon, tz = 'auto') {
  // Compact daily/hourly — still enough for UI (7d + 48h)
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility,cloud_cover` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,visibility,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset` +
    `&timezone=${encodeURIComponent(tz)}&forecast_days=7&forecast_hours=48`
  )
}

async function fetchJson(url, timeoutMs = 8000, signal) {
  const ms = fetchTimeoutMs(timeoutMs)
  const { json } = await timedFetch(
    url,
    { timeoutMs: ms, signal, cache: 'no-cache', mode: 'cors' },
    'weather'
  )
  return json
}

function isForecastPayload(data) {
  return !!(data && (data.current || data.current_weather) && !data.error)
}

/**
 * Multi-path LIVE fetch — race direct Open-Meteo vs proxy (independent).
 * Supports AbortSignal for rapid city switches.
 */
async function fetchLiveRaw(city, signal) {
  const lat = city.lat
  const lon = city.lon
  const tz =
    city.tz ||
    (city.countryCode && city.countryCode !== 'IN' ? 'auto' : 'Asia/Kolkata')
  const name = encodeURIComponent(city.name || 'Area')
  const errors = []

  const directUrl = openMeteoDirectUrl(lat, lon, tz === 'auto' ? 'auto' : tz)
  // multimodel=0 on hot path — multi-model is Climate tab /api/models (saves ~N upstream calls)
  const proxyUrl =
    `/api/weather?lat=${lat}&lon=${lon}&tz=${encodeURIComponent(tz)}&name=${name}&multimodel=0`

  const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()

  const race = await new Promise((resolve) => {
    let pending = 2
    let done = false
    const fail = () => {
      pending -= 1
      if (pending <= 0 && !done) resolve(null)
    }
    const win = (v) => {
      if (done) return
      done = true
      resolve(v)
    }
    if (signal?.aborted) {
      resolve(null)
      return
    }
    fetchJson(directUrl, 5000, signal)
      .then((data) => {
        if (isForecastPayload(data)) win({ data, source: 'open-meteo-direct' })
        else fail()
      })
      .catch(fail)
    fetchJson(proxyUrl, 4500, signal)
      .then((data) => {
        if (isForecastPayload(data)) win({ data, source: data._proxy ? 'proxy' : 'proxy-ok' })
        else fail()
      })
      .catch(fail)
  })

  if (race) {
    const ms = Math.round(
      (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0
    )
    perfTime('weather_ms', ms)
    perfMark('weather_fetch', { source: race.source, ms, city: city.id || city.name })
    return race
  }

  if (signal?.aborted) throw new Error('aborted')

  try {
    const data = await fetchJson(openMeteoDirectUrl(lat, lon, 'auto'), 7000, signal)
    if (isForecastPayload(data)) return { data, source: 'open-meteo-retry' }
    errors.push('retry: empty')
  } catch (e) {
    errors.push('retry: ' + e.message)
  }

  try {
    const simple =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&hourly=temperature_2m,precipitation_probability,weathercode,precipitation` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset` +
      `&timezone=auto&forecast_days=7`
    const data = await fetchJson(simple, 6000, signal)
    if (isForecastPayload(data)) return { data, source: 'open-meteo-simple' }
  } catch (e) {
    errors.push('simple: ' + e.message)
  }

  try {
    const data = await fetchJson(proxyUrl, 8000, signal)
    if (isForecastPayload(data)) {
      return { data, source: data._proxy ? 'proxy-late' : 'proxy-ok-late' }
    }
  } catch (e) {
    errors.push('proxy-late: ' + e.message)
  }

  const err = new Error('All live sources failed: ' + errors.join(' | '))
  err.details = errors
  throw err
}

export async function fetchWeather(cityOrId, { force = false, signal } = {}) {
  const city =
    typeof cityOrId === 'string' ? getCity(cityOrId) || CITIES[cityOrId] || CITIES.lucknow : cityOrId
  if (!city?.lat || !city?.lon) throw new Error('Invalid city for weather fetch')

  const key = city.id || `${city.lat.toFixed(3)},${city.lon.toFixed(3)}`
  const net = getNetworkSnapshot()
  const slow = net.slow || isSlowNetwork()

  // Hard offline: never hit network — last successful pack only
  if (!net.online && !force) {
    const mem = memCache.peek(key)
    if (mem?.current && !mem.demo) {
      return markPackCached(mem, { reason: 'offline-mem', source: mem.liveSource || 'memory', online: false })
    }
    try {
      const disk = await dbGetWeatherAny(key)
      if (disk?.current) {
        const pack = markPackCached(disk, {
          reason: 'offline-idb',
          source: disk.liveSource || 'IndexedDB',
          online: false,
        })
        memCache.set(key, pack)
        return pack
      }
    } catch {
      /* */
    }
    const demo = offlinePack(city)
    memCache.set(key, demo)
    return demo
  }

  if (!force) {
    const hit = memCache.get(key, slow ? TTL_LIVE_PACK * 2 : TTL_LIVE_PACK)
    if (hit?.current) {
      if (hit.demo || hit.synthetic) {
        const age = Date.now() - (hit.fetchedAt || 0)
        if (age < TTL_OFFLINE) return hit
      } else if (hit.live && !hit.stale && !hit.fromCache) {
        return markPackLive(hit, hit.liveSource)
      } else if (!hit.live) {
        // Cached mem: still return but labeled cached; bg refresh if online
        const labeled = markPackCached(hit, {
          reason: 'mem-ttl',
          source: hit.liveSource || 'memory',
          online: net.online,
        })
        if (net.online) refreshLiveInBackground(city, key)
        return labeled
      }
    }
  }

  // Instant paint: IDB then background refresh (never labeled live)
  if (!force) {
    try {
      const disk = await dbGetWeather(key, slow ? IDB_MAX_AGE : IDB_SOFT_AGE)
      if (disk?.current) {
        const pack = markPackCached(disk, {
          reason: disk.softExpired ? 'idb-stale' : 'idb',
          source: disk.liveSource || 'IndexedDB',
          online: net.online,
        })
        memCache.set(key, pack)
        if (net.online) refreshLiveInBackground(city, key)
        return pack
      }
    } catch {
      /* continue live */
    }
  }

  // Online live path — coalesce
  return inflight.run(`wx:${key}:${force ? 1 : 0}`, async () => {
    const gen = (cityGen.get(key) || 0) + 1
    cityGen.set(key, gen)
    const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
    try {
      // Re-check online inside worker
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const disk = await dbGetWeatherAny(key)
        if (disk?.current) {
          return markPackCached(disk, { reason: 'offline-race', source: 'IndexedDB', online: false })
        }
        return offlinePack(city)
      }

      const { data, source } = await fetchLiveRaw(city, signal)
      if (signal?.aborted || cityGen.get(key) !== gen) {
        const peek = memCache.peek(key)
        if (peek) return peek.live ? peek : markPackCached(peek, { reason: 'stale-gen', online: true })
      }
      let parsed = parseWeather(city, data, { source })
      parsed = markPackLive(parsed, source)
      if (cityGen.get(key) === gen) {
        memCache.set(key, parsed)
        // Persist last successful — no secrets
        dbPutWeather(key, parsed).catch(() => {})
      }
      const ms = Math.round(
        (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0,
      )
      perfTime('weather_ms', ms)
      return parsed
    } catch (e) {
      if (signal?.aborted || /abort/i.test(String(e.message || ''))) throw e
      console.warn('[WeatherGPT] LIVE failed → cache/offline:', e.message)
      // Prefer real last-success over demo
      try {
        const disk = await dbGetWeatherAny(key)
        if (disk?.current) {
          const pack = markPackCached(disk, {
            reason: 'fetch-fail',
            source: disk.liveSource || 'IndexedDB',
            online: getNetworkSnapshot().online,
          })
          memCache.set(key, pack)
          return pack
        }
      } catch {
        /* fall through */
      }
      const mem = memCache.peek(key)
      if (mem?.current && !mem.demo) {
        return markPackCached(mem, { reason: 'fetch-fail-mem', online: getNetworkSnapshot().online })
      }
      const pack = offlinePack(city)
      memCache.set(key, pack)
      return pack
    }
  })
}

function refreshLiveInBackground(city, key) {
  const net = getNetworkSnapshot()
  if (!net.online) return
  // Weak net: skip background refresh unless pack is very stale
  if (net.coreOnly) {
    const peek = memCache.peek(key)
    const age = peek?.fetchedAt ? Date.now() - peek.fetchedAt : Infinity
    if (age < STALE_MS) return
  }
  setTimeout(() => {
    const gen = cityGen.get(key) || 0
    inflight
      .run(`wx:${key}:bg`, async () => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
        const { data, source } = await fetchLiveRaw(city)
        if (cityGen.get(key) !== gen && cityGen.get(key) > gen) return null
        let parsed = parseWeather(city, data, { source })
        parsed = markPackLive(parsed, source)
        memCache.set(key, parsed)
        dbPutWeather(key, parsed).catch(() => {})
        return parsed
      })
      .catch(() => {})
  }, net.slow ? 1200 : 400)
}

export { shouldSkipPrefetch, getNetworkSnapshot, markPackCached, markPackLive }

export function injectSimulatedAlert(weather, cityOverride) {
  const city = cityOverride || weather.city
  const alert = buildDemoRedAlert(city)
  const rest = (weather.alerts || []).filter((a) => !a.simulated && a.kind !== 'demo')
  return {
    ...weather,
    alerts: [alert, ...rest],
    alertBundle: {
      ...(weather.alertBundle || {}),
      demo_alerts: [alert],
      alerts: [alert, ...rest],
      counts: {
        total: 1 + rest.length,
        official: rest.filter((a) => a.kind === 'official').length,
        risk_signal: rest.filter((a) => a.kind === 'risk_signal').length,
        demo: 1,
      },
    },
  }
}

export function clearCache(cityId) {
  if (cityId) {
    cache.delete(cityId)
    // bump gen so in-flight stale writes are ignored
    cityGen.set(cityId, (cityGen.get(cityId) || 0) + 1)
  } else cache.clear()
}

/** Memory footprint helper for Settings / debug */
export function memoryCacheStats() {
  return {
    cities: memCache.size(),
    keys: [],
    perf: getPerfSnapshot(),
  }
}

export { getPerfSnapshot }
