/**
 * Vercel Serverless — LIVE weather proxy + multi-source alerts
 * GET /api/weather?lat=26.45&lon=80.33&tz=Asia/Kolkata&name=Kanpur
 */

const UA = { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.0 (hackathon)' }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
}

async function fetchJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal })
    const text = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (text.trimStart().startsWith('<')) throw new Error('HTML body')
    return JSON.parse(text)
  } finally {
    clearTimeout(t)
  }
}

function buildForecastUrl(lat, lon, tz) {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,visibility,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset` +
    `&timezone=${encodeURIComponent(tz)}&forecast_days=7`
  )
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toR = (d) => (d * Math.PI) / 180
  const dLat = toR(lat2 - lat1)
  const dLon = toR(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

async function fetchGdacsAlerts(lat, lon) {
  try {
    const end = new Date()
    const start = new Date(Date.now() - 14 * 86400000)
    const from = start.toISOString().slice(0, 10)
    const to = end.toISOString().slice(0, 10)
    const url =
      `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH` +
      `?fromDate=${from}&toDate=${to}&alertlevel=Green;Orange;Red`
    const data = await fetchJson(url, 10000)
    const features = data.features || []
    const out = []
    for (const f of features) {
      const coords = f.geometry?.coordinates
      if (!coords || coords.length < 2) continue
      const [elon, elat] = coords
      // India + neighbourhood box first, then distance
      if (elat < 4 || elat > 38 || elon < 66 || elon > 100) continue
      const dist = haversineKm(lat, lon, elat, elon)
      if (dist > 800) continue
      const p = f.properties || {}
      const level = String(p.alertlevel || 'Green').toLowerCase()
      const severity = level.includes('red') ? 'red' : level.includes('orange') ? 'amber' : 'yellow'
      const et = p.eventtype || 'HZ'
      const typeName =
        { EQ: 'Earthquake', FL: 'Flood', TC: 'Tropical Cyclone', DR: 'Drought', VO: 'Volcano', WF: 'Wildfire' }[
          et
        ] || et
      out.push({
        id: `gdacs-${p.eventid || ''}-${p.episodeid || ''}`,
        severity,
        source: 'GDACS',
        category: typeName,
        title: `${typeName} alert (GDACS ${p.alertlevel || ''})`.trim(),
        title_hi: `${typeName} अलर्ट (GDACS)`,
        summary: p.name || p.eventname || `${typeName} near region (~${Math.round(dist)} km)`,
        summary_hi: p.name || p.eventname || `${typeName} ~${Math.round(dist)} किमी`,
        officialText: `GDACS live event: ${typeName}. ${p.name || p.eventname || ''}. Alert level ${p.alertlevel}. Distance from selected city ≈ ${Math.round(dist)} km. Period: ${p.fromdate || ''} → ${p.todate || ''}. More: https://www.gdacs.org`,
        officialText_hi: `GDACS लाइव: ${typeName}. स्तर ${p.alertlevel}. दूरी ≈ ${Math.round(dist)} किमी। स्रोत: gdacs.org`,
        meansForYou:
          severity === 'red'
            ? 'Monitor official advisories. Avoid unnecessary travel in affected corridors.'
            : 'Stay updated via NDMA/IMD and local administration.',
        meansForYou_hi: 'आधिकारिक सलाह पर नज़र रखें। NDMA/IMD अपडेट देखते रहें।',
        time: 'GDACS · live',
        time_hi: 'GDACS · लाइव',
        distanceKm: Math.round(dist),
        external: true,
        url: p.url || 'https://www.gdacs.org',
      })
    }
    out.sort((a, b) => a.distanceKm - b.distanceKm)
    return out.slice(0, 6)
  } catch {
    return []
  }
}

async function fetchFloodSignal(lat, lon) {
  try {
    const url =
      `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}` +
      `&daily=river_discharge,river_discharge_mean,river_discharge_median&forecast_days=5`
    const data = await fetchJson(url, 10000)
    const d = data.daily || {}
    const q = d.river_discharge || []
    const mean = d.river_discharge_mean || d.river_discharge_median || []
    if (!q.length) return []
    const today = q[0]
    const m = mean[0] || today
    const ratio = m > 0 ? today / m : 1
    const maxQ = Math.max(...q)
    const maxRatio = m > 0 ? maxQ / m : 1
    if (maxRatio < 1.25 && ratio < 1.2) return []
    const severity = maxRatio >= 1.8 || ratio >= 1.6 ? 'red' : maxRatio >= 1.4 ? 'amber' : 'yellow'
    return [
      {
        id: `flood-om-${Date.now()}`,
        severity,
        source: 'Open-Meteo Flood',
        category: 'River flood risk',
        title: 'Elevated river discharge (model)',
        title_hi: 'नदी प्रवाह बढ़ा (मॉडल)',
        summary: `River discharge ~${Math.round(today)} m³/s vs mean ~${Math.round(m)} m³/s (${ratio.toFixed(2)}×).`,
        summary_hi: `नदी प्रवाह ~${Math.round(today)} m³/s, औसत ~${Math.round(m)} (${ratio.toFixed(2)}×)।`,
        officialText: `Open-Meteo Flood API (GloFAS-based): near-term river discharge is elevated versus local mean (${ratio.toFixed(2)}× today, peak ratio ${maxRatio.toFixed(2)}× over 5 days). This is a hydrological model signal — confirm with CWC/IMD/state disaster authority before action.`,
        officialText_hi: `Open-Meteo Flood मॉडल: नदी प्रवाह औसत से अधिक (${ratio.toFixed(2)}×). कार्रवाई से पहले CWC/IMD/राज्य आपदा प्राधिकरण से पुष्टि करें।`,
        meansForYou: 'Avoid riverbanks & low bridges if rising. Farmers: secure pumps near streams.',
        meansForYou_hi: 'नदी किनारे/निचले पुलों से बचें। किसानों: नालों के पास पंप सुरक्षित करें।',
        time: 'Flood model · live',
        time_hi: 'फlood मॉडल · लाइव',
        external: true,
        url: 'https://open-meteo.com/en/docs/flood-api',
      },
    ]
  } catch {
    return []
  }
}

function modelAlertsFromForecast(data, name = 'Area') {
  const daily = data.daily || {}
  const cur = data.current || data.current_weather || {}
  const code = cur.weather_code ?? cur.weathercode ?? 0
  const pops = daily.precipitation_probability_max || []
  const rains = daily.precipitation_sum || []
  const winds = daily.wind_speed_10m_max || []
  const codes = daily.weather_code || daily.weathercode || []
  const maxPop = pops.length ? Math.max(...pops) : 0
  const maxRain = rains.length ? Math.max(...rains) : 0
  const maxWind = winds.length ? Math.max(...winds) : 0
  const maxCode = codes.length ? Math.max(...codes) : code
  const alerts = []

  if (maxCode >= 95 || code >= 95 || (maxRain > 100 && maxPop > 70)) {
    alerts.push({
      id: `model-red-${Date.now()}`,
      severity: 'red',
      source: 'Open-Meteo model',
      category: 'Thunderstorm / extreme rain',
      title: 'Severe thunderstorm / extreme rain risk',
      title_hi: 'गंभीर तूफान / अत्यधिक वर्षा जोखिम',
      summary: `Model flags severe convection / extreme rain near ${name} (code ${maxCode}, peak ${maxRain.toFixed?.(1) ?? maxRain} mm).`,
      summary_hi: `${name} के पास गंभीर संवहन/अत्यधिक वर्षा संकेत।`,
      officialText: `Modelled RED (Open-Meteo WMO weather codes + QPF): Thunderstorm/extreme rain signal. Aligns with IMD colour philosophy (Red = take action). Not a substitute for official IMD district warning polygons.`,
      officialText_hi: `मॉडल RED: तूफान/अत्यधिक वर्षा। आधिकारिक IMD ज़िला चेतावनी का विकल्प नहीं।`,
      meansForYou: 'Postpone outdoor work & travel if possible. Charge devices, avoid trees/poles.',
      meansForYou_hi: 'बाहर काम/यात्रा टालें। पेड़/खंभों से दूर रहें।',
      time: 'Model · live',
      time_hi: 'मॉडल · लाइव',
    })
  } else if (maxRain > 50 || maxPop >= 80 || maxWind > 45) {
    alerts.push({
      id: `model-amber-${Date.now()}`,
      severity: 'amber',
      source: 'Open-Meteo model',
      category: 'Heavy rain / wind',
      title: 'Heavy rain / strong wind watch',
      title_hi: 'भारी वर्षा / तेज़ हवा वॉच',
      summary: `Peak rain ~${(maxRain).toFixed?.(1) ?? maxRain} mm, pop ${maxPop}%, wind ${Math.round(maxWind)} km/h near ${name}.`,
      summary_hi: `वर्षा ~${maxRain} मिमी, संभावना ${maxPop}%, हवा ${Math.round(maxWind)} किमी/घं।`,
      officialText: `Modelled AMBER watch from ensemble precipitation & wind fields.`,
      officialText_hi: `मॉडल एम्बर वॉच: वर्षा व हवा क्षेत्रों से।`,
      meansForYou: 'Carry rain gear; avoid underpasses after dark.',
      meansForYou_hi: 'रेनगियर रखें; अंधेरे में अंडरपास से बचें।',
      time: 'Model · live',
      time_hi: 'मॉडल · लाइव',
    })
  } else if ((pops[0] || 0) >= 55 || (rains[0] || 0) > 5 || code >= 61) {
    alerts.push({
      id: `model-yellow-${Date.now()}`,
      severity: 'yellow',
      source: 'Open-Meteo model',
      category: 'Rain likely',
      title: 'Rain likely — yellow advisory',
      title_hi: 'बारिश संभावित — येलो',
      summary: `Today rain chance ~${pops[0] || 0}% near ${name}.`,
      summary_hi: `आज बारिश संभावना ~${pops[0] || 0}%。`,
      officialText: `Modelled YELLOW advisory from short-range precipitation probability.`,
      officialText_hi: `मॉडल येलो: अल्पकालिक वर्षा संभावना से।`,
      meansForYou: 'Keep umbrella; plan outdoor work in drier morning slots.',
      meansForYou_hi: 'छतरी रखें; बाहर काम सुबह करें।',
      time: 'Model · live',
      time_hi: 'मॉडल · लाइव',
    })
  }
  return alerts
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const lat = parseFloat(req.query.lat)
    const lon = parseFloat(req.query.lon)
    const tz = (req.query.tz || 'auto').toString()
    const name = (req.query.name || 'Area').toString()

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon required', live: false })
    }

    const errors = []
    let forecast = null
    let source = 'open-meteo'

    try {
      forecast = await fetchJson(buildForecastUrl(lat, lon, tz), 14000)
    } catch (e) {
      errors.push('forecast1: ' + e.message)
    }
    if (!forecast) {
      try {
        forecast = await fetchJson(buildForecastUrl(lat, lon, 'auto'), 16000)
        source = 'open-meteo-retry'
      } catch (e) {
        errors.push('forecast2: ' + e.message)
      }
    }
    if (!forecast) {
      try {
        const simple =
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current_weather=true&hourly=temperature_2m,precipitation_probability,weathercode,precipitation` +
          `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset` +
          `&timezone=auto&forecast_days=5`
        forecast = await fetchJson(simple, 14000)
        source = 'open-meteo-simple'
      } catch (e) {
        errors.push('forecast3: ' + e.message)
      }
    }

    if (!forecast) {
      return res.status(502).json({ error: 'Weather upstream failed', errors, live: false })
    }

    // Parallel live alert sources
    const [gdacs, flood] = await Promise.all([fetchGdacsAlerts(lat, lon), fetchFloodSignal(lat, lon)])
    const model = modelAlertsFromForecast(forecast, name)
    const live_alerts = [...gdacs, ...flood, ...model]

    return res.status(200).json({
      ...forecast,
      live: true,
      _proxy: true,
      _source: source,
      live_alerts,
      alert_sources: {
        gdacs: gdacs.length,
        flood: flood.length,
        model: model.length,
        note: 'IMD official district APIs need API key / IP whitelist — using GDACS + flood model + meteo thresholds (IMD colour philosophy).',
      },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'proxy error', live: false })
  }
}
