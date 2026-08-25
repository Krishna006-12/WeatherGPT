/**
 * Weather service — LIVE-first with:
 * 1) Same-origin /api/weather proxy (Vercel serverless)
 * 2) Direct Open-Meteo (local dev / fallback)
 * 3) Simplified Open-Meteo schema
 * 4) Offline pack only if everything fails
 */

import { CITIES, getCity } from '../data/cities'

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
  95: { en: 'Thunderstorm', hi: 'आंधी-तूफान', icon: 'cloud-lightning', severity: 'red' },
  96: { en: 'Thunderstorm with hail', hi: 'ओलावृष्टि तूफान', icon: 'cloud-lightning', severity: 'red' },
  99: { en: 'Severe thunderstorm with hail', hi: 'गंभीर ओलावृष्टि', icon: 'cloud-lightning', severity: 'red' },
}

export function wmoInfo(code, lang = 'en') {
  const info = WMO[code] || WMO[2]
  return {
    condition: lang === 'hi' ? info.hi : info.en,
    icon: info.icon,
    severity: info.severity,
    code,
  }
}

function safeMax(arr, fallback = 0) {
  if (!arr || !arr.length) return fallback
  return Math.max(...arr.map((n) => (Number.isFinite(n) ? n : fallback)))
}

function soilMoistureLevel(mmRecent, mmForecast, humidity) {
  const score = mmRecent * 0.6 + mmForecast * 0.3 + (humidity > 70 ? 15 : 0)
  if (score > 80) return { en: 'High', hi: 'उच्च', level: 'high', color: 'sky' }
  if (score > 35) return { en: 'Medium', hi: 'मध्यम', level: 'medium', color: 'sun' }
  return { en: 'Low', hi: 'कम', level: 'low', color: 'alert' }
}

function irrigationAdvice(recent, forecast, soil, lang) {
  if (soil.level === 'high' || forecast > 40) {
    return lang === 'hi'
      ? 'अगले 3–4 दिन सिंचाई रोकें। जल निकासी सुनिश्चित करें।'
      : 'Hold irrigation for 3–4 days. Ensure field drainage is clear.'
  }
  if (soil.level === 'low' && forecast < 10) {
    return lang === 'hi'
      ? 'इस सप्ताह हल्की सिंचाई करें — मिट्टी सूखी है, बारिश कम संभावना।'
      : 'Light irrigation recommended this week — soil is dry, low rain chance.'
  }
  if (forecast >= 15 && forecast <= 40) {
    return lang === 'hi'
      ? 'सिंचाई टालें; मध्यम बारिश की संभावना। रोपाई/छिड़काव के लिए सुबह चुनें।'
      : 'Defer irrigation; moderate rain likely. Prefer morning for spraying/sowing.'
  }
  return lang === 'hi'
    ? 'मिट्टी नमी मध्यम — जरूरत अनुसार हल्की सिंचाई।'
    : 'Soil moisture medium — light irrigation only if crop shows stress.'
}

function buildAlerts(city, daily, current) {
  const alerts = []
  const maxPop = safeMax(daily.precipitation_probability_max)
  const maxRain = safeMax(daily.precipitation_sum)
  const maxWind = safeMax(daily.wind_speed_10m_max)
  const maxCode = safeMax(daily.weather_code)
  const todayRain = daily.precipitation_sum?.[0] || 0
  const todayPop = daily.precipitation_probability_max?.[0] || 0
  const code = current.weather_code ?? current.weathercode ?? 0

  if (maxCode >= 95 || (maxRain > 100 && maxPop > 70)) {
    alerts.push({
      id: `${city.id}-red-${Date.now()}`,
      severity: 'red',
      title: 'Extremely Heavy Rain / Thunderstorm Watch',
      title_hi: 'अत्यधिक भारी वर्षा / तूफान वॉच',
      summary: `Very heavy rainfall and thunderstorm risk over ${city.name} in the next 5 days.`,
      summary_hi: `${city.name_hi || city.name} में अगले 5 दिनों में अत्यधिक भारी वर्षा व तूफान का खतरा।`,
      time: 'Updated just now',
      time_hi: 'अभी अपडेट',
      officialText: `IMD-style RED WARNING (modelled): Extremely heavy rainfall / severe thunderstorm very likely at isolated places over ${city.name} (${city.state || ''}). Avoid waterlogged areas. Farmers: postpone harvesting, ensure drainage.`,
      officialText_hi: `IMD-शैली RED चेतावनी: ${city.name_hi || city.name} में अत्यधिक भारी वर्षा/गंभीर तूफान की संभावना। जलभराव से बचें।`,
      meansForYou: 'Avoid low-lying roads. Charge devices. Move livestock to shelter. Delay pesticide spray.',
      meansForYou_hi: 'निचले इलाकों से बचें। डिवाइस चार्ज रखें। मवेशी सुरक्षित रखें। छिड़काव टालें।',
    })
  } else if (maxRain > 50 || maxPop >= 80 || maxWind > 45) {
    alerts.push({
      id: `${city.id}-amber-${Date.now()}`,
      severity: 'amber',
      title: 'Heavy Rain Watch',
      title_hi: 'भारी वर्षा वॉच',
      summary: `Heavy rainfall (${maxRain.toFixed(0)} mm peak) likely near ${city.name}.`,
      summary_hi: `${city.name_hi || city.name} के आसपास भारी वर्षा (${maxRain.toFixed(0)} मिमी) की संभावना।`,
      time: 'Updated just now',
      time_hi: 'अभी अपडेट',
      officialText: `IMD-style Amber Watch: Heavy rainfall likely at isolated places over ${city.name}. Wind gusts up to ${Math.round(maxWind)} km/h.`,
      officialText_hi: `IMD-शैली एम्बर वॉच: ${city.name_hi || city.name} में भारी वर्षा संभावित। हवा ${Math.round(maxWind)} किमी/घं।`,
      meansForYou: 'Carry umbrella. Avoid underpasses after dark. Hold non-urgent outdoor work.',
      meansForYou_hi: 'छतरी रखें। अंडरपास से बचें। बाहरी काम टालें।',
    })
  } else if (todayPop >= 55 || todayRain > 5 || code >= 61) {
    alerts.push({
      id: `${city.id}-yellow-${Date.now()}`,
      severity: 'yellow',
      title: 'Rain Likely — Yellow Advisory',
      title_hi: 'बारिश संभावित — येलो एडवाइजरी',
      summary: `Rain likely today/tomorrow around ${city.name} (${todayPop}% chance).`,
      summary_hi: `${city.name_hi || city.name} में आज/कल बारिश संभावना ${todayPop}%。`,
      time: 'Updated just now',
      time_hi: 'अभी अपडेट',
      officialText: `IMD-style Yellow Advisory: Light to moderate rain / thundershowers likely over ${city.name}.`,
      officialText_hi: `IMD-शैली येलो एडवाइजरी: ${city.name_hi || city.name} में हल्की से मध्यम बारिश संभावित।`,
      meansForYou: 'Plan outdoor work in morning windows. Keep tarpaulin ready for harvested crop.',
      meansForYou_hi: 'बाहर का काम सुबह करें। कटी फसल के लिए तिरपाल तैयार रखें।',
    })
  }
  return alerts
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
  const days = times.slice(0, 5).map((date, i) => {
    const dCode = (daily.weather_code || daily.weathercode || [])[i] ?? 2
    const di = wmoInfo(dCode)
    return {
      date,
      weekday: new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' }),
      weekday_hi: new Date(date + 'T12:00:00').toLocaleDateString('hi-IN', { weekday: 'short' }),
      max: Math.round(daily.temperature_2m_max?.[i] ?? cur.temperature_2m ?? 30),
      min: Math.round(daily.temperature_2m_min?.[i] ?? (cur.temperature_2m ?? 30) - 6),
      rain: +((daily.precipitation_sum?.[i] ?? 0)).toFixed(1),
      pop: daily.precipitation_probability_max?.[i] ?? 0,
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

  const now = Date.now()
  const hours = []
  const hTimes = hourly.time || []
  for (let i = 0; i < hTimes.length && hours.length < 24; i++) {
    const t = new Date(hTimes[i]).getTime()
    if (t < now - 45 * 60 * 1000) continue
    const hCode = (hourly.weather_code || hourly.weathercode || [])[i] ?? code
    hours.push({
      time: hTimes[i],
      label: new Date(hTimes[i]).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true }),
      temp: Math.round(hourly.temperature_2m?.[i] ?? cur.temperature_2m ?? 28),
      pop: hourly.precipitation_probability?.[i] ?? 0,
      rain: hourly.precipitation?.[i] ?? 0,
      code: hCode,
      icon: wmoInfo(hCode).icon,
      visibility: hourly.visibility?.[i] != null ? hourly.visibility[i] / 1000 : null,
    })
  }

  // Synthetic hourly if missing
  if (!hours.length) {
    for (let i = 0; i < 12; i++) {
      const d = new Date(now + i * 3600000)
      hours.push({
        time: d.toISOString(),
        label: d.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true }),
        temp: Math.round((cur.temperature_2m ?? 28) + Math.sin(i / 3) * 2),
        pop: days[0]?.pop ?? 20,
        rain: 0,
        code,
        icon: info.icon,
        visibility: null,
      })
    }
  }

  const visibilityKm =
    cur.visibility != null
      ? cur.visibility > 100
        ? cur.visibility / 1000
        : cur.visibility
      : null

  const modelAlerts = buildAlerts(
    city,
    {
      precipitation_probability_max: days.map((d) => d.pop),
      precipitation_sum: days.map((d) => d.rain),
      wind_speed_10m_max: days.map((d) => d.wind),
      weather_code: days.map((d) => d.code),
    },
    { weather_code: code }
  )

  // Live external alerts from proxy (GDACS, flood model, etc.)
  const external = Array.isArray(raw.live_alerts)
    ? raw.live_alerts
    : Array.isArray(liveMeta.live_alerts)
      ? liveMeta.live_alerts
      : []

  const mergedAlerts = mergeAlerts(external, modelAlerts)

  const sunrise = daily.sunrise?.[0]
  const sunset = daily.sunset?.[0]

  return {
    city,
    fetchedAt: Date.now(),
    live: true,
    liveSource: liveMeta.source || raw._source || 'open-meteo',
    alertMeta: raw.alert_sources || liveMeta.alert_sources || null,
    current: {
      temp: Math.round(cur.temperature_2m ?? 28),
      feelsLike: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 28),
      humidity: Math.round(humidity),
      wind: Math.round(cur.wind_speed_10m ?? 0),
      windDir: cur.wind_direction_10m ?? 0,
      pressure: Math.round(cur.pressure_msl ?? 1010),
      precip: cur.precipitation || 0,
      code,
      condition: info.condition,
      condition_hi: wmoInfo(code, 'hi').condition,
      icon: info.icon,
      isDay: cur.is_day === 1 || cur.is_day === true,
      visibility: visibilityKm,
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
    sources: [
      {
        name: liveMeta.source === 'proxy' ? 'Open-Meteo (via secure proxy)' : 'Open-Meteo',
        role: 'Live forecast model',
        url: 'https://open-meteo.com',
      },
      { name: 'GDACS', role: 'Live multi-hazard events near India', url: 'https://www.gdacs.org' },
      { name: 'Open-Meteo Flood', role: 'River discharge / flood signal', url: 'https://open-meteo.com/en/docs/flood-api' },
      { name: 'IMD colour philosophy', role: 'Yellow/Amber/Red framing (official API needs key)', url: 'https://mausam.imd.gov.in' },
      { name: 'WeatherGPT AI', role: 'Prediction + travel/school/farm layer', url: null },
    ],
  }
}

/** Prefer external live alerts, then model; de-dupe by severity+category */
function mergeAlerts(external = [], model = []) {
  const rank = { red: 0, amber: 1, yellow: 2, green: 3 }
  const all = [...external, ...model].filter(Boolean)
  all.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))
  const seen = new Set()
  const out = []
  for (const a of all) {
    const k = `${a.severity}|${(a.category || a.title || '').slice(0, 40)}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(a)
    if (out.length >= 12) break
  }
  return out
}

function offlinePack(city) {
  const baseTemp = city.region?.includes('Coast') ? 30 : city.region?.includes('Arid') ? 34 : 28
  const seed = (city.lat || 26) + (city.lon || 80)
  const rainBias = (Math.sin(seed) + 1) * 20
  const code = rainBias > 28 ? 63 : rainBias > 18 ? 61 : 2
  const info = wmoInfo(code)
  const today = new Date()
  const daily = []
  for (let i = 0; i < 5; i++) {
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
      pop: Math.min(95, Math.round(r * 3)),
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
      pop: Math.min(90, Math.round(rainBias + (i > 12 ? 10 : -5))),
      rain: i > 14 && i < 20 ? 1.2 : 0,
      code: i > 14 && i < 20 ? 61 : 2,
      icon: i > 14 && i < 20 ? 'cloud-rain' : 'cloud-sun',
    })
  }
  const recentRain = daily.slice(0, 2).reduce((a, b) => a + b.rain, 0)
  const forecastRain = daily.reduce((a, b) => a + b.rain, 0)
  const soil = soilMoistureLevel(recentRain, forecastRain, 60)
  const alerts = buildAlerts(
    city,
    {
      precipitation_probability_max: daily.map((d) => d.pop),
      precipitation_sum: daily.map((d) => d.rain),
      wind_speed_10m_max: daily.map((d) => d.wind),
      weather_code: daily.map((d) => d.code),
    },
    { weather_code: code }
  )
  return {
    city,
    fetchedAt: Date.now(),
    live: false,
    liveSource: 'offline',
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
      { name: 'IMD thresholds', role: 'Alert colour categories', url: 'https://mausam.imd.gov.in' },
    ],
  }
}

const cache = new Map()
const CACHE_TTL_LIVE = 5 * 60 * 1000
const CACHE_TTL_OFFLINE = 30 * 1000 // retry live soon

function openMeteoDirectUrl(lat, lon, tz = 'auto') {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,visibility` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset` +
    `&timezone=${encodeURIComponent(tz)}&forecast_days=5`
  )
}

async function fetchJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
      mode: 'cors',
      cache: 'no-cache',
    })
    const text = await res.text()
    // Critical: Vercel SPA fallback returns index.html for missing /api — treat as failure
    const trimmed = text.trimStart()
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      throw new Error('HTML response (API missing or blocked)')
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('Invalid JSON')
    }
  } finally {
    clearTimeout(timer)
  }
}

function isForecastPayload(data) {
  return !!(data && (data.current || data.current_weather) && !data.error)
}

/**
 * Multi-path LIVE fetch — proxy first, then direct Open-Meteo paths
 */
async function fetchLiveRaw(city) {
  const lat = city.lat
  const lon = city.lon
  const tz = city.countryCode && city.countryCode !== 'IN' ? 'auto' : 'Asia/Kolkata'
  const name = encodeURIComponent(city.name || 'Area')
  const errors = []

  // 1) Same-origin Vercel proxy (LIVE weather + live_alerts bundle)
  try {
    const proxyUrl =
      `/api/weather?lat=${lat}&lon=${lon}&tz=${encodeURIComponent(tz)}&name=${name}`
    const data = await fetchJson(proxyUrl, 16000)
    if (isForecastPayload(data)) {
      return { data, source: data._proxy ? 'proxy' : 'proxy-ok' }
    }
    errors.push('proxy: empty/invalid')
  } catch (e) {
    errors.push('proxy: ' + e.message)
  }

  // 2) Direct Open-Meteo full schema
  try {
    const data = await fetchJson(openMeteoDirectUrl(lat, lon, tz), 14000)
    if (isForecastPayload(data)) return { data, source: 'open-meteo-direct' }
    errors.push('direct: empty')
  } catch (e) {
    errors.push('direct: ' + e.message)
  }

  // 3) Direct retry auto TZ
  try {
    await new Promise((r) => setTimeout(r, 400))
    const data = await fetchJson(openMeteoDirectUrl(lat, lon, 'auto'), 16000)
    if (isForecastPayload(data)) return { data, source: 'open-meteo-retry' }
  } catch (e) {
    errors.push('retry: ' + e.message)
  }

  // 4) Simplified schema
  try {
    const simple =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&hourly=temperature_2m,precipitation_probability,weathercode,precipitation` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset` +
      `&timezone=auto&forecast_days=5`
    const data = await fetchJson(simple, 14000)
    if (isForecastPayload(data)) return { data, source: 'open-meteo-simple' }
  } catch (e) {
    errors.push('simple: ' + e.message)
  }

  // 5) Last resort: Open-Meteo via CORS-friendly allapis style is N/A —
  // try httpbin no — throw
  const err = new Error('All live sources failed: ' + errors.join(' | '))
  err.details = errors
  throw err
}

export async function fetchWeather(cityOrId, { force = false } = {}) {
  const city =
    typeof cityOrId === 'string' ? getCity(cityOrId) || CITIES[cityOrId] || CITIES.lucknow : cityOrId
  if (!city?.lat || !city?.lon) throw new Error('Invalid city for weather fetch')

  const key = city.id
  const hit = cache.get(key)
  if (!force && hit) {
    const ttl = hit.live ? CACHE_TTL_LIVE : CACHE_TTL_OFFLINE
    if (Date.now() - hit.fetchedAt < ttl) return hit
  }

  try {
    const { data, source } = await fetchLiveRaw(city)
    const parsed = parseWeather(city, data, { source })
    cache.set(key, parsed)
    console.info('[WeatherGPT] LIVE ok via', source, city.name, parsed.current.temp + '°C')
    return parsed
  } catch (e) {
    console.warn('[WeatherGPT] LIVE failed → offline pack:', e.message)
    const pack = offlinePack(city)
    // Don't poison cache long — allow quick retry
    cache.set(key, pack)
    return pack
  }
}

export function injectSimulatedAlert(weather, cityOverride) {
  const city = cityOverride || weather.city
  const alert = {
    id: `sim-red-${Date.now()}`,
    severity: 'red',
    title: 'SIMULATED: Extreme Rain Warning',
    title_hi: 'सिमुलेटेड: अत्यधिक वर्षा चेतावनी',
    summary: `Red alert drill: 200mm+ rain scenario for ${city.name}`,
    summary_hi: `रेड अलर्ट ड्रिल: ${city.name_hi || city.name} के लिए 200मिमी+ वर्षा परिदृश्य`,
    time: 'Just now · DEMO',
    time_hi: 'अभी · डेमो',
    officialText: `IMD RED WARNING (SIMULATION FOR DEMO): Extremely heavy rainfall very likely over ${city.name} within 24–36 hrs. This is a hackathon simulation — not a live IMD bulletin.`,
    officialText_hi: `IMD RED चेतावनी (डेमो): ${city.name_hi || city.name} में 24–36 घंटे में अत्यधिक भारी वर्षा। यह सिमुलेशन है।`,
    meansForYou: 'DEMO only. Production would push SMS/IVR to saved users.',
    meansForYou_hi: 'केवल डेमो। प्रोडक्शन में SMS/IVR अलर्ट मिलेगा।',
    simulated: true,
  }
  return {
    ...weather,
    alerts: [alert, ...weather.alerts.filter((a) => !a.simulated)],
  }
}

export function clearCache(cityId) {
  if (cityId) cache.delete(cityId)
  else cache.clear()
}
