/**
 * GET /api/public
 * Open discovery + health for external AIs, evaluators, Postman, SIH judges.
 *
 * GET /api/public?action=chat&q=...&lat=&lon=&lang=en
 * Stateless NL weather answer (no browser required) — other AIs can call this.
 *
 * GET /api/public?action=bundle&lat=&lon=&name=
 * Weather + alerts snapshot JSON.
 */

const UA = { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.1-public' }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
  res.setHeader('X-WeatherGPT-API', 'public-v1')
}

async function fetchJson(url, ms = 15000) {
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

function originFromReq(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  return `${proto}://${host}`
}

async function loadForecast(lat, lon, name) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
    `&timezone=auto&forecast_days=5`
  const data = await fetchJson(url)
  const c = data.current || {}
  const d = data.daily || {}
  const days = (d.time || []).map((date, i) => ({
    date,
    max: d.temperature_2m_max?.[i],
    min: d.temperature_2m_min?.[i],
    rain: d.precipitation_sum?.[i],
    pop: d.precipitation_probability_max?.[i],
    code: d.weather_code?.[i],
  }))
  return {
    place: name,
    lat,
    lon,
    current: {
      temp: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      wind: c.wind_speed_10m,
      code: c.weather_code,
      precip: c.precipitation,
    },
    daily: days,
    live: true,
    source: 'Open-Meteo',
  }
}

function wmoEn(code) {
  const map = {
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
    96: 'Thunderstorm with hail',
  }
  return map[code] || `Weather code ${code}`
}

function answerChat(wx, q, lang) {
  const t = (q || '').toLowerCase()
  const city = wx.place
  const cur = wx.current
  const d0 = wx.daily[0] || {}
  const cond = wmoEn(cur.code)

  const isHi = lang === 'hi' || /[\u0900-\u097F]/.test(q || '')
  if (/alert|warn|flood|बाढ़|चेतावनी/.test(t)) {
    return isHi
      ? `${city}: अलर्ट के लिए /api/alerts?lat=${wx.lat}&lon=${wx.lon} देखें। अभी तापमान ${Math.round(cur.temp)}°C, ${cond}। आज बारिश संभावना ${d0.pop ?? '—'}%.`
      : `${city}: For live multi-source alerts call /api/alerts?lat=${wx.lat}&lon=${wx.lon}. Now ${Math.round(cur.temp)}°C, ${cond}. Today rain chance ${d0.pop ?? '—'}%.`
  }
  if (/rain|baarish|बारिश|precip/.test(t)) {
    return isHi
      ? `${city}: आज बारिश संभावना ~${d0.pop ?? 0}% (~${d0.rain ?? 0} मिमी). अभी ${Math.round(cur.temp)}°C, ${cond}.`
      : `${city}: Today rain chance ~${d0.pop ?? 0}% (~${d0.rain ?? 0} mm). Now ${Math.round(cur.temp)}°C, ${cond}.`
  }
  if (/forecast|5.?day|outlook|पूर्वानुमान/.test(t)) {
    const lines = wx.daily
      .slice(0, 5)
      .map((d) => `${d.date}: ${Math.round(d.max)}°/${Math.round(d.min)}° pop ${d.pop}%`)
      .join('; ')
    return isHi ? `${city} 5-दिन: ${lines}` : `${city} 5-day: ${lines}`
  }
  return isHi
    ? `${city}: अभी ${Math.round(cur.temp)}°C (महसूस ${Math.round(cur.feelsLike)}°C), ${cond}, नमी ${Math.round(cur.humidity)}%, हवा ${Math.round(cur.wind)} किमी/घं। आज उच्च/न्यून ${Math.round(d0.max)}°/${Math.round(d0.min)}°।`
    : `${city}: Now ${Math.round(cur.temp)}°C (feels ${Math.round(cur.feelsLike)}°C), ${cond}, humidity ${Math.round(cur.humidity)}%, wind ${Math.round(cur.wind)} km/h. Today H/L ${Math.round(d0.max)}°/${Math.round(d0.min)}°.`
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const origin = originFromReq(req)
  const action = (req.query.action || 'discover').toString()

  try {
    if (action === 'discover' || action === 'health' || action === '') {
      return res.status(200).json({
        ok: true,
        service: 'WeatherGPT Public API',
        version: '2.1-sih',
        product: 'SIH-ready AI weather intelligence (India focus)',
        homepage: origin + '/',
        openapi: origin + '/openapi.json',
        llms_txt: origin + '/llms.txt',
        sih_matrix: origin + '/sih.html',
        endpoints: {
          weather: {
            method: 'GET',
            path: '/api/weather',
            params: ['lat', 'lon', 'tz', 'name'],
            desc: 'Live forecast + live_alerts (GDACS, flood, model)',
          },
          alerts: {
            method: 'GET',
            path: '/api/alerts',
            params: ['lat', 'lon', 'name', 'points', 'radiusKm'],
            desc: 'Multi-city live alerts',
          },
          climate: {
            method: 'GET',
            path: '/api/climate',
            params: ['lat', 'lon', 'name'],
            desc: 'Historical monthly trends (archive reanalysis)',
          },
          models: {
            method: 'GET',
            path: '/api/models',
            params: ['lat', 'lon', 'name'],
            desc: 'NWP multi-model compare (GFS/ECMWF/ICON/blend)',
          },
          aqi: {
            method: 'GET',
            path: '/api/aqi',
            params: ['lat', 'lon'],
            desc: 'Air quality',
          },
          geocode: {
            method: 'GET',
            path: '/api/geocode',
            params: ['q', 'count', 'language'],
            desc: 'Place search',
          },
          public_chat: {
            method: 'GET',
            path: '/api/public',
            params: ['action=chat', 'q', 'lat', 'lon', 'name', 'lang'],
            desc: 'Stateless NL weather answer for external agents',
            example: `${origin}/api/public?action=chat&q=rain%20today&lat=26.45&lon=80.33&name=Kanpur&lang=en`,
          },
          public_bundle: {
            method: 'GET',
            path: '/api/public',
            params: ['action=bundle', 'lat', 'lon', 'name'],
            desc: 'Compact weather JSON for evaluators',
          },
        },
        sample_locations: {
          kanpur: { lat: 26.4499, lon: 80.3319 },
          delhi: { lat: 28.6139, lon: 77.209 },
          mumbai: { lat: 19.076, lon: 72.8777 },
        },
        cors: '*',
        auth: 'none',
        notes: [
          'All JSON. No login. Safe for automated evaluators and other AIs.',
          'If a crawler cannot render SPA JS, use these /api/* endpoints + /llms.txt + /sih.html.',
          'IMD official district polygons need IMD API key — colour philosophy applied on open models + GDACS.',
        ],
        fetchedAt: Date.now(),
      })
    }

    const lat = parseFloat(req.query.lat)
    const lon = parseFloat(req.query.lon)
    const name = (req.query.name || 'Area').toString().slice(0, 48)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        ok: false,
        error: 'lat and lon required for this action',
        hint: `${origin}/api/public?action=chat&q=weather&lat=26.45&lon=80.33&name=Kanpur`,
      })
    }

    if (action === 'bundle') {
      const wx = await loadForecast(lat, lon, name)
      return res.status(200).json({ ok: true, ...wx, fetchedAt: Date.now() })
    }

    if (action === 'chat') {
      const q = (req.query.q || req.query.query || 'weather now').toString().slice(0, 500)
      const lang = (req.query.lang || 'en').toString()
      const wx = await loadForecast(lat, lon, name)
      const answer = answerChat(wx, q, lang)
      return res.status(200).json({
        ok: true,
        query: q,
        lang,
        answer,
        weather: wx,
        citations: [{ name: 'Open-Meteo', role: 'Live forecast' }],
        fetchedAt: Date.now(),
      })
    }

    return res.status(400).json({ ok: false, error: 'Unknown action. Use discover|chat|bundle|health' })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'public api error' })
  }
}
