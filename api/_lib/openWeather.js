/**
 * OpenWeatherMap live adapter → Open-Meteo-shaped forecast payload.
 * Key: process.env.OPENWEATHER_API_KEY (server only — never ship to browser).
 *
 * Tries One Call 3.0 first, then 2.5 current + 5-day/3-hour forecast.
 * Returns null if no key or all upstreams fail (caller keeps Open-Meteo).
 */

const UA = {
  Accept: 'application/json',
  'User-Agent': 'WeatherGPT/2.3 (OpenWeather adapter)',
}

export function getOpenWeatherKey() {
  const k = String(
    process.env.OPENWEATHER_API_KEY ||
      process.env.OPEN_WEATHER_API_KEY ||
      process.env.OWM_API_KEY ||
      '',
  )
    .trim()
    .replace(/^["']|["']$/g, '')
  return k || ''
}

async function fetchJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal })
    const text = await res.text()
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try {
        const j = JSON.parse(text)
        if (j?.message) msg += `: ${j.message}`
      } catch {
        /* */
      }
      throw new Error(msg)
    }
    if (text.trimStart().startsWith('<')) throw new Error('HTML body')
    return JSON.parse(text)
  } finally {
    clearTimeout(t)
  }
}

/** Map OpenWeather condition id → WMO-ish code used by app icon/condition tables */
export function owIdToWmo(id, isDay = true) {
  const n = Number(id) || 800
  if (n >= 200 && n < 300) {
    if (n === 212 || n === 221 || n === 232) return 99
    if (n >= 230) return 96
    return 95
  }
  if (n >= 300 && n < 400) {
    if (n >= 312) return 55
    if (n >= 302) return 53
    return 51
  }
  if (n >= 500 && n < 600) {
    if (n === 511) return 66
    if (n === 502 || n === 503 || n === 504) return 65
    if (n === 501) return 63
    if (n >= 520 && n <= 531) return n >= 522 ? 82 : 80
    return 61
  }
  if (n >= 600 && n < 700) {
    if (n >= 622) return 75
    if (n >= 601) return 73
    return 71
  }
  if (n >= 700 && n < 800) {
    if (n === 781) return 95
    return 45
  }
  if (n === 800) return 0
  if (n === 801) return 1
  if (n === 802) return 2
  if (n === 803 || n === 804) return 3
  return isDay ? 2 : 3
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function ymdInTz(ms, tzOffsetSec) {
  // OpenWeather gives timezone offset seconds from UTC
  const d = new Date(ms + tzOffsetSec * 1000)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

function hmInTz(ms, tzOffsetSec) {
  const d = new Date(ms + tzOffsetSec * 1000)
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
}

function isoLocal(ms, tzOffsetSec) {
  return `${ymdInTz(ms, tzOffsetSec)}T${hmInTz(ms, tzOffsetSec)}`
}

function popPct(p) {
  if (p == null || Number.isNaN(Number(p))) return 0
  const n = Number(p)
  // One Call uses 0..1; 2.5 forecast sometimes 0..1
  if (n <= 1) return Math.round(n * 100)
  return Math.round(Math.min(100, n))
}

/**
 * One Call 3.0 → OM-shaped
 * https://openweathermap.org/api/one-call-3
 */
function fromOneCall(data, lat, lon) {
  const tzOff = Number(data.timezone_offset) || 0
  const cur = data.current || {}
  const w0 = (cur.weather && cur.weather[0]) || {}
  const isDay =
    cur.sunrise && cur.sunset
      ? cur.dt >= cur.sunrise && cur.dt < cur.sunset
      : true

  const hourly = { time: [], temperature_2m: [], precipitation_probability: [], precipitation: [], weather_code: [], visibility: [], relative_humidity_2m: [], cloud_cover: [], wind_speed_10m: [] }
  const hSrc = (data.hourly || []).slice(0, 48)
  for (const h of hSrc) {
    const wid = h.weather?.[0]?.id
    const rainMm = (h.rain?.['1h'] ?? h.rain ?? 0) || 0
    const snowMm = (h.snow?.['1h'] ?? h.snow ?? 0) || 0
    hourly.time.push(isoLocal(h.dt * 1000, tzOff))
    hourly.temperature_2m.push(h.temp)
    hourly.precipitation_probability.push(popPct(h.pop))
    hourly.precipitation.push(Number(rainMm) + Number(snowMm))
    hourly.weather_code.push(owIdToWmo(wid, true))
    hourly.visibility.push(h.visibility != null ? h.visibility : null)
    hourly.relative_humidity_2m.push(h.humidity)
    hourly.cloud_cover.push(h.clouds)
    hourly.wind_speed_10m.push(h.wind_speed != null ? h.wind_speed * 3.6 : null) // m/s → km/h
  }

  const daily = {
    time: [],
    weather_code: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    precipitation_sum: [],
    precipitation_probability_max: [],
    wind_speed_10m_max: [],
    uv_index_max: [],
    sunrise: [],
    sunset: [],
  }
  for (const d of (data.daily || []).slice(0, 8)) {
    const wid = d.weather?.[0]?.id
    const rain = Number(d.rain || 0) + Number(d.snow || 0)
    daily.time.push(ymdInTz(d.dt * 1000, tzOff))
    daily.weather_code.push(owIdToWmo(wid, true))
    daily.temperature_2m_max.push(d.temp?.max)
    daily.temperature_2m_min.push(d.temp?.min)
    daily.precipitation_sum.push(rain)
    daily.precipitation_probability_max.push(popPct(d.pop))
    daily.wind_speed_10m_max.push(d.wind_speed != null ? d.wind_speed * 3.6 : null)
    daily.uv_index_max.push(d.uvi ?? null)
    daily.sunrise.push(isoLocal((d.sunrise || cur.sunrise || 0) * 1000, tzOff))
    daily.sunset.push(isoLocal((d.sunset || cur.sunset || 0) * 1000, tzOff))
  }

  return {
    latitude: lat,
    longitude: lon,
    timezone: data.timezone || 'GMT',
    timezone_abbreviation: data.timezone || 'GMT',
    utc_offset_seconds: tzOff,
    current: {
      time: isoLocal((cur.dt || Date.now() / 1000) * 1000, tzOff),
      temperature_2m: cur.temp,
      relative_humidity_2m: cur.humidity,
      apparent_temperature: cur.feels_like,
      is_day: isDay ? 1 : 0,
      precipitation: Number(cur.rain?.['1h'] || cur.rain || 0) + Number(cur.snow?.['1h'] || cur.snow || 0),
      weather_code: owIdToWmo(w0.id, isDay),
      cloud_cover: cur.clouds,
      pressure_msl: cur.pressure,
      surface_pressure: cur.pressure,
      wind_speed_10m: cur.wind_speed != null ? cur.wind_speed * 3.6 : 0,
      wind_direction_10m: cur.wind_deg ?? 0,
      visibility: cur.visibility ?? null,
    },
    hourly,
    daily,
    _ow_condition_en: w0.description || w0.main || null,
    _ow_condition_id: w0.id,
    _ow_api: 'onecall_3.0',
  }
}

/**
 * Free tier: current + 5day/3h → OM-shaped (hourly denser from 3h slots)
 */
function from25(current, forecast, lat, lon) {
  const tzOff = Number(current.timezone ?? forecast.city?.timezone) || 0
  const main = current.main || {}
  const wind = current.wind || {}
  const clouds = current.clouds || {}
  const w0 = (current.weather && current.weather[0]) || {}
  const sys = current.sys || {}
  const dt = (current.dt || Math.floor(Date.now() / 1000)) * 1000
  const isDay =
    sys.sunrise && sys.sunset
      ? current.dt >= sys.sunrise && current.dt < sys.sunset
      : true

  const list = forecast.list || []
  const hourly = {
    time: [],
    temperature_2m: [],
    precipitation_probability: [],
    precipitation: [],
    weather_code: [],
    visibility: [],
    relative_humidity_2m: [],
    cloud_cover: [],
    wind_speed_10m: [],
  }

  // Expand 3-hour steps to hourly by linear hold (honest: same 3h bucket values)
  for (const item of list.slice(0, 40)) {
    const baseMs = item.dt * 1000
    const rain3 = Number(item.rain?.['3h'] || 0)
    const snow3 = Number(item.snow?.['3h'] || 0)
    const rain1 = (rain3 + snow3) / 3
    const wid = item.weather?.[0]?.id
    const pop = popPct(item.pop)
    for (let k = 0; k < 3; k++) {
      const ms = baseMs + k * 3600000
      hourly.time.push(isoLocal(ms, tzOff))
      hourly.temperature_2m.push(item.main?.temp)
      hourly.precipitation_probability.push(pop)
      hourly.precipitation.push(+rain1.toFixed(2))
      hourly.weather_code.push(owIdToWmo(wid, true))
      hourly.visibility.push(item.visibility ?? null)
      hourly.relative_humidity_2m.push(item.main?.humidity)
      hourly.cloud_cover.push(item.clouds?.all)
      hourly.wind_speed_10m.push(item.wind?.speed != null ? item.wind.speed * 3.6 : null)
    }
  }

  // Aggregate daily from 3h list
  const byDay = new Map()
  for (const item of list) {
    const day = ymdInTz(item.dt * 1000, tzOff)
    if (!byDay.has(day)) {
      byDay.set(day, {
        temps: [],
        pops: [],
        rain: 0,
        wind: [],
        codes: [],
      })
    }
    const b = byDay.get(day)
    if (item.main?.temp != null) b.temps.push(item.main.temp)
    if (item.main?.temp_max != null) b.temps.push(item.main.temp_max)
    if (item.main?.temp_min != null) b.temps.push(item.main.temp_min)
    b.pops.push(popPct(item.pop))
    b.rain += Number(item.rain?.['3h'] || 0) + Number(item.snow?.['3h'] || 0)
    if (item.wind?.speed != null) b.wind.push(item.wind.speed * 3.6)
    if (item.weather?.[0]?.id) b.codes.push(owIdToWmo(item.weather[0].id, true))
  }

  const daily = {
    time: [],
    weather_code: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    precipitation_sum: [],
    precipitation_probability_max: [],
    wind_speed_10m_max: [],
    uv_index_max: [],
    sunrise: [],
    sunset: [],
  }
  const sunriseIso = sys.sunrise ? isoLocal(sys.sunrise * 1000, tzOff) : null
  const sunsetIso = sys.sunset ? isoLocal(sys.sunset * 1000, tzOff) : null
  for (const [day, b] of [...byDay.entries()].slice(0, 7)) {
    daily.time.push(day)
    daily.temperature_2m_max.push(b.temps.length ? Math.max(...b.temps) : main.temp)
    daily.temperature_2m_min.push(b.temps.length ? Math.min(...b.temps) : main.temp)
    daily.precipitation_sum.push(+b.rain.toFixed(1))
    daily.precipitation_probability_max.push(b.pops.length ? Math.max(...b.pops) : 0)
    daily.wind_speed_10m_max.push(b.wind.length ? Math.max(...b.wind) : (wind.speed || 0) * 3.6)
    daily.weather_code.push(b.codes[Math.floor(b.codes.length / 2)] ?? owIdToWmo(w0.id, true))
    daily.uv_index_max.push(null)
    daily.sunrise.push(sunriseIso || `${day}T06:00`)
    daily.sunset.push(sunsetIso || `${day}T18:00`)
  }

  // Ensure today exists even if forecast starts later
  if (!daily.time.length) {
    const day = ymdInTz(dt, tzOff)
    daily.time.push(day)
    daily.temperature_2m_max.push(main.temp_max ?? main.temp)
    daily.temperature_2m_min.push(main.temp_min ?? main.temp)
    daily.precipitation_sum.push(0)
    daily.precipitation_probability_max.push(0)
    daily.wind_speed_10m_max.push((wind.speed || 0) * 3.6)
    daily.weather_code.push(owIdToWmo(w0.id, isDay))
    daily.uv_index_max.push(null)
    daily.sunrise.push(sunriseIso || `${day}T06:00`)
    daily.sunset.push(sunsetIso || `${day}T18:00`)
  }

  return {
    latitude: lat,
    longitude: lon,
    timezone: forecast.city?.name ? undefined : undefined,
    timezone_abbreviation: 'local',
    utc_offset_seconds: tzOff,
    current: {
      time: isoLocal(dt, tzOff),
      temperature_2m: main.temp,
      relative_humidity_2m: main.humidity,
      apparent_temperature: main.feels_like ?? main.temp,
      is_day: isDay ? 1 : 0,
      precipitation: Number(current.rain?.['1h'] || 0) + Number(current.snow?.['1h'] || 0),
      weather_code: owIdToWmo(w0.id, isDay),
      cloud_cover: clouds.all ?? null,
      pressure_msl: main.pressure,
      surface_pressure: main.pressure,
      wind_speed_10m: wind.speed != null ? wind.speed * 3.6 : 0,
      wind_direction_10m: wind.deg ?? 0,
      visibility: current.visibility ?? null,
    },
    hourly,
    daily,
    _ow_condition_en: w0.description || w0.main || null,
    _ow_condition_id: w0.id,
    _ow_api: 'data_2.5',
    _ow_name: current.name || forecast.city?.name || null,
  }
}

/**
 * Fetch live OpenWeather for lat/lon. Returns OM-shaped object or null.
 */
export async function fetchOpenWeatherForecast(lat, lon, { timeoutMs = 12000 } = {}) {
  const key = getOpenWeatherKey()
  if (!key) return null

  const q = `lat=${lat}&lon=${lon}&appid=${encodeURIComponent(key)}&units=metric`

  // 1) One Call 3.0 (paid tier / some keys)
  try {
    const url = `https://api.openweathermap.org/data/3.0/onecall?${q}&exclude=minutely,alerts`
    const data = await fetchJson(url, timeoutMs)
    if (data?.current) {
      return {
        forecast: fromOneCall(data, lat, lon),
        meta: {
          provider: 'openweathermap',
          api: 'onecall_3.0',
          live: true,
        },
      }
    }
  } catch (e) {
    // continue to 2.5
    var oneCallErr = e.message || String(e)
  }

  // 2) Free Current Weather + 5 day / 3 hour
  try {
    const [cur, fc] = await Promise.all([
      fetchJson(`https://api.openweathermap.org/data/2.5/weather?${q}`, timeoutMs),
      fetchJson(`https://api.openweathermap.org/data/2.5/forecast?${q}`, timeoutMs),
    ])
    if (!cur?.main) throw new Error('OW current missing main')
    return {
      forecast: from25(cur, fc || { list: [] }, lat, lon),
      meta: {
        provider: 'openweathermap',
        api: 'data_2.5',
        live: true,
        onecall_error: oneCallErr || undefined,
      },
    }
  } catch (e) {
    return {
      forecast: null,
      meta: {
        provider: 'openweathermap',
        live: false,
        error: e.message || String(e),
        onecall_error: oneCallErr || undefined,
      },
    }
  }
}

/**
 * Batch current weather for map mesh (free current endpoint).
 * cities: [{name, lat, lon}, ...]
 */
export async function fetchOpenWeatherMesh(cities, { timeoutMs = 14000 } = {}) {
  const key = getOpenWeatherKey()
  if (!key || !cities?.length) return null

  const out = []
  // sequential small batches to respect free RPM — parallel 4
  const chunk = 4
  for (let i = 0; i < cities.length; i += chunk) {
    const slice = cities.slice(i, i + chunk)
    const part = await Promise.all(
      slice.map(async (c) => {
        try {
          const url =
            `https://api.openweathermap.org/data/2.5/weather?lat=${c.lat}&lon=${c.lon}` +
            `&appid=${encodeURIComponent(key)}&units=metric`
          const j = await fetchJson(url, timeoutMs)
          const main = j.main || {}
          const w0 = j.weather?.[0] || {}
          return {
            name: c.name,
            lat: c.lat,
            lon: c.lon,
            temp: main.temp ?? null,
            humidity: main.humidity ?? null,
            cloud: j.clouds?.all ?? null,
            pressure: main.pressure ?? null,
            wind: j.wind?.speed != null ? +(j.wind.speed * 3.6).toFixed(1) : null,
            condition: w0.description || w0.main || null,
            code: owIdToWmo(w0.id, true),
            time: j.dt ? new Date(j.dt * 1000).toISOString() : null,
            provider: 'openweathermap',
          }
        } catch {
          return {
            name: c.name,
            lat: c.lat,
            lon: c.lon,
            temp: null,
            humidity: null,
            cloud: null,
            error: true,
            provider: 'openweathermap',
          }
        }
      }),
    )
    out.push(...part)
  }
  return out
}
