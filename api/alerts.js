/**
 * GET /api/alerts?lat=&lon=&name=&radiusKm=600
 * GET /api/alerts?points=26.45,80.33,Kanpur|28.61,77.21,Delhi
 *
 * Live multi-source alerts near location(s):
 *  - GDACS multi-hazard (India bbox + distance)
 *  - Open-Meteo Flood (river discharge)
 *  - Open-Meteo meteo thresholds (IMD colour philosophy)
 *
 * No fabricated events — empty array when sources quiet.
 */

const UA = { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.0 (alerts)' }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=180')
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

function parsePoints(query) {
  const points = []
  if (query.points) {
    String(query.points)
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((chunk, i) => {
        const parts = chunk.split(',').map((x) => x.trim())
        const lat = parseFloat(parts[0])
        const lon = parseFloat(parts[1])
        const name = parts.slice(2).join(',') || `Point ${i + 1}`
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          points.push({ lat, lon, name: name.slice(0, 48) })
        }
      })
  }
  const lat = parseFloat(query.lat)
  const lon = parseFloat(query.lon)
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const name = (query.name || 'Area').toString().slice(0, 48)
    if (!points.some((p) => Math.abs(p.lat - lat) < 0.01 && Math.abs(p.lon - lon) < 0.01)) {
      points.unshift({ lat, lon, name })
    }
  }
  return points.slice(0, 8)
}

async function fetchGdacsNear(lat, lon, radiusKm) {
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
      // South Asia neighbourhood
      if (elat < 4 || elat > 38 || elon < 60 || elon > 100) continue
      const dist = haversineKm(lat, lon, elat, elon)
      if (dist > radiusKm) continue
      const p = f.properties || {}
      const level = String(p.alertlevel || 'Green').toLowerCase()
      const severity = level.includes('red') ? 'red' : level.includes('orange') ? 'amber' : 'yellow'
      const et = p.eventtype || 'HZ'
      const typeName =
        { EQ: 'Earthquake', FL: 'Flood', TC: 'Tropical Cyclone', DR: 'Drought', VO: 'Volcano', WF: 'Wildfire' }[
          et
        ] || et
      out.push({
        id: `gdacs-${p.eventid || elat}-${p.episodeid || elon}`,
        severity,
        source: 'GDACS',
        category: typeName,
        title: `${typeName} alert (GDACS ${p.alertlevel || ''})`.trim(),
        title_hi: `${typeName} अलर्ट (GDACS)`,
        summary: p.name || p.eventname || `${typeName} ~${Math.round(dist)} km away`,
        summary_hi: p.name || p.eventname || `${typeName} ~${Math.round(dist)} किमी`,
        officialText: `GDACS live: ${typeName}. ${p.name || p.eventname || ''}. Level ${p.alertlevel}. ≈${Math.round(dist)} km from watch point. ${p.fromdate || ''} → ${p.todate || ''}. https://www.gdacs.org`,
        officialText_hi: `GDACS लाइव: ${typeName}. स्तर ${p.alertlevel}. दूरी ≈${Math.round(dist)} किमी।`,
        meansForYou:
          severity === 'red'
            ? 'Follow NDMA/IMD and local administration. Limit non-essential travel in affected corridors.'
            : 'Stay updated via official channels.',
        meansForYou_hi: 'NDMA/IMD व स्थानीय प्रशासन की सलाह लें।',
        time: 'GDACS · live',
        time_hi: 'GDACS · लाइव',
        distanceKm: Math.round(dist),
        lat: elat,
        lon: elon,
        external: true,
        url: p.url || 'https://www.gdacs.org',
      })
    }
    out.sort((a, b) => a.distanceKm - b.distanceKm)
    return out.slice(0, 8)
  } catch {
    return []
  }
}

async function fetchFloodSignal(lat, lon, name) {
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
        id: `flood-${lat.toFixed(2)}-${lon.toFixed(2)}-${severity}`,
        severity,
        source: 'Open-Meteo Flood',
        category: 'River flood risk',
        title: `Elevated river discharge near ${name}`,
        title_hi: `${name} के पास नदी प्रवाह बढ़ा`,
        summary: `Discharge ~${Math.round(today)} m³/s vs mean ~${Math.round(m)} (${ratio.toFixed(2)}×).`,
        summary_hi: `प्रवाह ~${Math.round(today)} m³/s, औसत ~${Math.round(m)} (${ratio.toFixed(2)}×)।`,
        officialText: `Open-Meteo Flood (GloFAS-style): elevated river discharge near ${name}. Confirm with CWC/state disaster authority before action.`,
        officialText_hi: `Flood मॉडल: ${name} के पास प्रवाह औसत से अधिक। CWC/राज्य प्राधिकरण से पुष्टि करें।`,
        meansForYou: 'Avoid riverbanks and low bridges if levels rising.',
        meansForYou_hi: 'नदी किनारे व निचले पुलों से बचें।',
        time: 'Flood model · live',
        time_hi: 'फ्लड मॉडल · लाइव',
        distanceKm: 0,
        lat,
        lon,
        external: true,
        url: 'https://open-meteo.com/en/docs/flood-api',
      },
    ]
  } catch {
    return []
  }
}

async function fetchMeteoAlerts(lat, lon, name) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=weather_code,precipitation,wind_speed_10m` +
      `&daily=weather_code,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=5`
    const data = await fetchJson(url, 12000)
    const daily = data.daily || {}
    const cur = data.current || {}
    const code = cur.weather_code ?? 0
    const pops = daily.precipitation_probability_max || []
    const rains = daily.precipitation_sum || []
    const winds = daily.wind_speed_10m_max || []
    const codes = daily.weather_code || []
    const maxPop = pops.length ? Math.max(...pops) : 0
    const maxRain = rains.length ? Math.max(...rains) : 0
    const maxWind = winds.length ? Math.max(...winds) : 0
    const maxCode = codes.length ? Math.max(...codes) : code
    const alerts = []

    if (maxCode >= 95 || code >= 95 || (maxRain > 100 && maxPop > 70)) {
      alerts.push({
        id: `meteo-red-${lat.toFixed(2)}-${lon.toFixed(2)}`,
        severity: 'red',
        source: 'Open-Meteo model',
        category: 'Thunderstorm / extreme rain',
        title: `Severe weather risk — ${name}`,
        title_hi: `गंभीर मौसम जोखिम — ${name}`,
        summary: `Thunderstorm / extreme rain signal near ${name} (code ${maxCode}, peak ~${Number(maxRain).toFixed(0)} mm).`,
        summary_hi: `${name} के पास गंभीर तूफान/अत्यधिक वर्षा संकेत।`,
        officialText: `Modelled RED (Open-Meteo): severe convection / extreme rain near ${name}. Not a substitute for official IMD district warnings.`,
        officialText_hi: `मॉडल RED: ${name} — आधिकारिक IMD चेतावनी का विकल्प नहीं।`,
        meansForYou: 'Postpone outdoor work & non-essential travel if possible.',
        meansForYou_hi: 'बाहर काम/गैर-ज़रूरी यात्रा टालें।',
        time: 'Model · live',
        time_hi: 'मॉडल · लाइव',
        distanceKm: 0,
        lat,
        lon,
        external: false,
      })
    } else if (maxRain > 50 || maxPop >= 80 || maxWind > 45) {
      alerts.push({
        id: `meteo-amber-${lat.toFixed(2)}-${lon.toFixed(2)}`,
        severity: 'amber',
        source: 'Open-Meteo model',
        category: 'Heavy rain / wind',
        title: `Heavy rain / wind watch — ${name}`,
        title_hi: `भारी वर्षा / हवा वॉच — ${name}`,
        summary: `Peak rain ~${Number(maxRain).toFixed(0)} mm, pop ${maxPop}%, wind ${Math.round(maxWind)} km/h.`,
        summary_hi: `वर्षा ~${Number(maxRain).toFixed(0)} मिमी, संभावना ${maxPop}%, हवा ${Math.round(maxWind)} किमी/घं।`,
        officialText: `Modelled AMBER watch near ${name}.`,
        officialText_hi: `मॉडल एम्बर वॉच — ${name}।`,
        meansForYou: 'Carry rain gear; avoid underpasses after dark.',
        meansForYou_hi: 'रेनगियर रखें; अंधेरे में अंडरपास से बचें।',
        time: 'Model · live',
        time_hi: 'मॉडल · लाइव',
        distanceKm: 0,
        lat,
        lon,
        external: false,
      })
    } else if ((pops[0] || 0) >= 55 || (rains[0] || 0) > 5 || code >= 61) {
      alerts.push({
        id: `meteo-yellow-${lat.toFixed(2)}-${lon.toFixed(2)}`,
        severity: 'yellow',
        source: 'Open-Meteo model',
        category: 'Rain likely',
        title: `Rain likely — ${name}`,
        title_hi: `बारिश संभावित — ${name}`,
        summary: `Today rain chance ~${pops[0] || 0}% near ${name}.`,
        summary_hi: `आज बारिश संभावना ~${pops[0] || 0}% — ${name}।`,
        officialText: `Modelled YELLOW advisory near ${name}.`,
        officialText_hi: `मॉडल येलो — ${name}।`,
        meansForYou: 'Keep umbrella; prefer morning outdoor slots.',
        meansForYou_hi: 'छतरी रखें; बाहर काम सुबह करें।',
        time: 'Model · live',
        time_hi: 'मॉडल · लाइव',
        distanceKm: 0,
        lat,
        lon,
        external: false,
      })
    }
    return alerts
  } catch {
    return []
  }
}

function mergeAlerts(list) {
  const rank = { red: 0, amber: 1, yellow: 2, green: 3 }
  const sorted = [...list].sort((a, b) => {
    const rs = (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9)
    if (rs !== 0) return rs
    return (a.distanceKm ?? 999) - (b.distanceKm ?? 999)
  })
  const seen = new Set()
  const out = []
  for (const a of sorted) {
    const k = `${a.id || ''}|${a.severity}|${(a.title || '').slice(0, 48)}|${a.place || ''}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(a)
    if (out.length >= 40) break
  }
  return out
}

async function alertsForPoint(point, radiusKm) {
  const { lat, lon, name } = point
  const [gdacs, flood, meteo] = await Promise.all([
    fetchGdacsNear(lat, lon, radiusKm),
    fetchFloodSignal(lat, lon, name),
    fetchMeteoAlerts(lat, lon, name),
  ])
  const tagged = [...gdacs, ...flood, ...meteo].map((a) => ({
    ...a,
    place: name,
    placeLat: lat,
    placeLon: lon,
    // stable notify key includes place so Delhi ≠ Kanpur
    notifyKey: `${a.id}::${name}`,
  }))
  return {
    place: name,
    lat,
    lon,
    counts: { gdacs: gdacs.length, flood: flood.length, model: meteo.length },
    alerts: tagged,
  }
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const points = parsePoints(req.query || {})
    if (!points.length) {
      return res.status(400).json({
        ok: false,
        alerts: [],
        error: 'Provide lat&lon or points=lat,lon,Name|...',
      })
    }

    const radiusKm = Math.min(1200, Math.max(50, parseFloat(req.query.radiusKm) || 600))
    const settled = await Promise.all(points.map((p) => alertsForPoint(p, radiusKm)))
    const all = mergeAlerts(settled.flatMap((s) => s.alerts))
    const byPlace = settled.map((s) => ({
      place: s.place,
      lat: s.lat,
      lon: s.lon,
      counts: s.counts,
      alertCount: s.alerts.length,
      topSeverity: s.alerts[0]?.severity || null,
    }))

    return res.status(200).json({
      ok: true,
      live: true,
      fetchedAt: Date.now(),
      radiusKm,
      points: byPlace,
      alerts: all,
      sources: [
        { name: 'GDACS', role: 'Live multi-hazard events' },
        { name: 'Open-Meteo Flood', role: 'River discharge signal' },
        { name: 'Open-Meteo forecast', role: 'Meteo threshold alerts' },
      ],
      note: 'IMD district polygon APIs need official key — colour framing follows IMD philosophy on open models.',
    })
  } catch (e) {
    return res.status(500).json({ ok: false, alerts: [], error: e.message || 'alerts error' })
  }
}
