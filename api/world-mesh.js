/**
 * GET /api/world-mesh
 * Live worldwide city weather samples for dashboard map.
 * Uses OpenWeather current (when OPENWEATHER_API_KEY set), else Open-Meteo bulk hourly.
 * Never fabricates values — missing points stay null.
 */
import { fetchOpenWeatherMesh, getOpenWeatherKey } from './_lib/openWeather.js'

const UA = { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.3-world-mesh' }

const SAMPLE_CITIES = [
  { name: 'Kanpur', lat: 26.45, lon: 80.33 },
  { name: 'Delhi', lat: 28.61, lon: 77.21 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Kolkata', lat: 22.57, lon: 88.36 },
  { name: 'Chennai', lat: 13.08, lon: 80.27 },
  { name: 'Dubai', lat: 25.2, lon: 55.27 },
  { name: 'Tokyo', lat: 35.68, lon: 139.65 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Cairo', lat: 30.04, lon: 31.24 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Johannesburg', lat: -26.2, lon: 28.05 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Beijing', lat: 39.9, lon: 116.4 },
  { name: 'Moscow', lat: 55.76, lon: 37.62 },
  { name: 'Istanbul', lat: 41.01, lon: 28.98 },
  { name: 'Jakarta', lat: -6.21, lon: 106.85 },
  { name: 'Bangkok', lat: 13.76, lon: 100.5 },
  { name: 'Toronto', lat: 43.65, lon: -79.38 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'Reykjavik', lat: 64.15, lon: -21.94 },
  { name: 'Cape Town', lat: -33.92, lon: 18.42 },
  { name: 'Perth', lat: -31.95, lon: 115.86 },
  { name: 'Anchorage', lat: 61.22, lon: -149.9 },
]

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600')
}

async function openMeteoMesh(hourOffset = 0) {
  const lats = SAMPLE_CITIES.map((c) => c.lat).join(',')
  const lons = SAMPLE_CITIES.map((c) => c.lon).join(',')
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&hourly=temperature_2m,relative_humidity_2m,cloud_cover,precipitation_probability` +
    `&forecast_days=2&timezone=UTC`
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  const data = await res.json()
  const rows = Array.isArray(data) ? data : [data]
  const byHour = {}
  const n = Math.min(24, rows[0]?.hourly?.time?.length || 0)
  for (let h = 0; h < n; h++) {
    byHour[h] = rows.map((row, i) => {
      const hr = row.hourly || {}
      return {
        name: SAMPLE_CITIES[i].name,
        lat: SAMPLE_CITIES[i].lat,
        lon: SAMPLE_CITIES[i].lon,
        temp: hr.temperature_2m?.[h] ?? null,
        humidity: hr.relative_humidity_2m?.[h] ?? null,
        cloud: hr.cloud_cover?.[h] ?? null,
        pop: hr.precipitation_probability?.[h] ?? null,
        time: hr.time?.[h] || null,
        provider: 'open-meteo',
      }
    })
  }
  // also expose "current" = hour 0
  return { byHour, current: byHour[hourOffset] || byHour[0] || [] }
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const hasOw = !!getOpenWeatherKey()
    let provider = 'open-meteo'
    let points = null
    let byHour = null
    const errors = []

    if (hasOw) {
      try {
        points = await fetchOpenWeatherMesh(SAMPLE_CITIES, { timeoutMs: 14000 })
        if (points?.length) provider = 'openweathermap'
      } catch (e) {
        errors.push('ow-mesh: ' + (e.message || e))
      }
    }

    // Always try OM for forecast-hour timelapse (OW free has no hourly mesh bulk)
    try {
      const om = await openMeteoMesh(0)
      byHour = om.byHour
      if (!points?.length) {
        points = om.current
        provider = 'open-meteo'
      }
    } catch (e) {
      errors.push('om-mesh: ' + (e.message || e))
    }

    if (!points?.length && !byHour) {
      return res.status(502).json({
        ok: false,
        live: false,
        error: 'World mesh upstream failed',
        errors,
        openweather_configured: hasOw,
      })
    }

    return res.status(200).json({
      ok: true,
      live: true,
      provider,
      openweather_configured: hasOw,
      points: points || [],
      byHour: byHour || undefined,
      count: (points || []).length,
      fetchedAt: new Date().toISOString(),
      note:
        provider === 'openweathermap'
          ? 'Live OpenWeather current samples · forecast hours from Open-Meteo when present'
          : 'Open-Meteo live city samples · set OPENWEATHER_API_KEY for OW current mesh',
      errors: errors.length ? errors : undefined,
    })
  } catch (e) {
    return res.status(500).json({ ok: false, live: false, error: e.message || 'mesh error' })
  }
}
