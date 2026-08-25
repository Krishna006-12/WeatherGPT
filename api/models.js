/**
 * GET /api/models?lat=&lon=&name=
 * Multi-NWP snapshot: Open-Meteo model runs (GFS / ECMWF / ICON / best_match).
 * Compares next-24h temp + precip probability across models for transparency.
 */

const UA = { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.1-SIH' }

const MODELS = [
  { id: 'best_match', label: 'Best match (blend)', short: 'Blend' },
  { id: 'gfs_seamless', label: 'GFS seamless (NCEP)', short: 'GFS' },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS 0.25°', short: 'ECMWF' },
  { id: 'icon_seamless', label: 'ICON seamless (DWD)', short: 'ICON' },
]

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
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

async function fetchModel(lat, lon, model) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&models=${model}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,precipitation` +
    `&hourly=temperature_2m,precipitation_probability,precipitation` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
    `&timezone=auto&forecast_days=2`
  const data = await fetchJson(url, 14000)
  const cur = data.current || {}
  const hourly = data.hourly || {}
  const daily = data.daily || {}
  const temps = (hourly.temperature_2m || []).slice(0, 24)
  const pops = (hourly.precipitation_probability || []).slice(0, 24)
  const rains = (hourly.precipitation || []).slice(0, 24)
  const avg = (a) => (a.length ? a.reduce((x, y) => x + (y || 0), 0) / a.length : null)
  const max = (a) => (a.length ? Math.max(...a.map((x) => x || 0)) : null)
  return {
    model,
    currentTemp: cur.temperature_2m != null ? Math.round(cur.temperature_2m) : null,
    currentCode: cur.weather_code ?? null,
    currentWind: cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : null,
    next24h: {
      tempMean: avg(temps) != null ? +avg(temps).toFixed(1) : null,
      tempMax: max(temps),
      popMax: max(pops),
      rainSum: rains.length ? +rains.reduce((a, b) => a + (b || 0), 0).toFixed(1) : null,
    },
    today: {
      max: daily.temperature_2m_max?.[0] != null ? Math.round(daily.temperature_2m_max[0]) : null,
      min: daily.temperature_2m_min?.[0] != null ? Math.round(daily.temperature_2m_min[0]) : null,
      rain: daily.precipitation_sum?.[0] != null ? +Number(daily.precipitation_sum[0]).toFixed(1) : null,
      pop: daily.precipitation_probability_max?.[0] ?? null,
    },
  }
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const lat = parseFloat(req.query.lat)
    const lon = parseFloat(req.query.lon)
    const name = (req.query.name || 'Area').toString().slice(0, 48)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ ok: false, error: 'lat lon required' })
    }

    const results = await Promise.all(
      MODELS.map(async (m) => {
        try {
          const snap = await fetchModel(lat, lon, m.id)
          return { ...m, ok: true, ...snap }
        } catch (e) {
          return { ...m, ok: false, error: e.message }
        }
      })
    )

    const okRows = results.filter((r) => r.ok && r.next24h?.tempMean != null)
    const temps = okRows.map((r) => r.next24h.tempMean)
    const spread =
      temps.length >= 2 ? +(Math.max(...temps) - Math.min(...temps)).toFixed(1) : null
    const meanTemp = temps.length ? +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : null

    let agreementEn = 'Limited model sample.'
    let agreementHi = 'सीमित मॉडल सैंपल।'
    if (spread != null) {
      if (spread <= 1.2) {
        agreementEn = `High agreement — 24h mean temp spread only ${spread}°C across models.`
        agreementHi = `उच्च सहमति — 24घं औसत तापमान फैल सिर्फ ${spread}°C।`
      } else if (spread <= 2.5) {
        agreementEn = `Moderate agreement — spread ${spread}°C; prefer blend for planning.`
        agreementHi = `मध्यम सहमति — फैल ${spread}°C; प्लानिंग के लिए ब्लेंड बेहतर।`
      } else {
        agreementEn = `Low agreement — spread ${spread}°C; treat forecast with extra caution.`
        agreementHi = `कम सहमति — फैल ${spread}°C; अतिरिक्त सावधानी।`
      }
    }

    return res.status(200).json({
      ok: true,
      live: true,
      place: name,
      lat,
      lon,
      models: results,
      ensemble: {
        meanTemp24h: meanTemp,
        spreadC: spread,
        modelCount: okRows.length,
        agreementEn,
        agreementHi,
      },
      sources: [
        { name: 'Open-Meteo multi-model', role: 'GFS / ECMWF / ICON / best_match', url: 'https://open-meteo.com' },
      ],
      note: 'NWP comparison for transparency — not a full WRF local nest. SIH decision-support layer.',
      fetchedAt: Date.now(),
    })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'models error' })
  }
}
