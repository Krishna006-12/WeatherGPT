/**
 * GET /api/climate?lat=&lon=&name=
 * Historical climate trends via Open-Meteo Archive (ERA5-land class).
 * Last ~12 months monthly means + YoY-ish comparison vs prior year window.
 * No fabricated series — empty/error if upstream fails.
 */

const UA = { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.1-SIH' }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200')
}

async function fetchJson(url, ms = 18000) {
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

function monthKey(iso) {
  return String(iso || '').slice(0, 7)
}

function avg(arr) {
  const n = arr.filter((x) => x != null && !Number.isNaN(x))
  if (!n.length) return null
  return n.reduce((a, b) => a + b, 0) / n.length
}

function sum(arr) {
  return arr.reduce((a, b) => a + (Number(b) || 0), 0)
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

    // Two-year daily archive window (ERA5 via Open-Meteo Archive)
    const end = new Date()
    end.setUTCDate(end.getUTCDate() - 5) // archive lag
    const start = new Date(end)
    start.setUTCFullYear(start.getUTCFullYear() - 2)
    const startDate = start.toISOString().slice(0, 10)
    const endDate = end.toISOString().slice(0, 10)

    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=auto`

    const data = await fetchJson(url, 20000)
    const daily = data.daily || {}
    const times = daily.time || []
    const tMean = daily.temperature_2m_mean || []
    const tMax = daily.temperature_2m_max || []
    const tMin = daily.temperature_2m_min || []
    const precip = daily.precipitation_sum || []

    if (!times.length) {
      return res.status(502).json({ ok: false, error: 'No archive rows', live: false })
    }

    // Bucket by month
    const buckets = new Map()
    for (let i = 0; i < times.length; i++) {
      const mk = monthKey(times[i])
      if (!buckets.has(mk)) {
        buckets.set(mk, { mean: [], max: [], min: [], rain: [] })
      }
      const b = buckets.get(mk)
      if (tMean[i] != null) b.mean.push(tMean[i])
      if (tMax[i] != null) b.max.push(tMax[i])
      if (tMin[i] != null) b.min.push(tMin[i])
      if (precip[i] != null) b.rain.push(precip[i])
    }

    const months = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, b]) => ({
        month,
        tempMean: avg(b.mean) != null ? +avg(b.mean).toFixed(1) : null,
        tempMax: avg(b.max) != null ? +avg(b.max).toFixed(1) : null,
        tempMin: avg(b.min) != null ? +avg(b.min).toFixed(1) : null,
        precipMm: +sum(b.rain).toFixed(1),
        days: Math.max(b.mean.length, b.rain.length),
      }))

    const last12 = months.slice(-12)
    const prev12 = months.slice(-24, -12)

    const lastRain = sum(last12.map((m) => m.precipMm))
    const prevRain = sum(prev12.map((m) => m.precipMm))
    const lastTemp = avg(last12.map((m) => m.tempMean).filter((x) => x != null))
    const prevTemp = avg(prev12.map((m) => m.tempMean).filter((x) => x != null))

    const rainDeltaPct =
      prevRain > 0 ? +(((lastRain - prevRain) / prevRain) * 100).toFixed(1) : null
    const tempDelta =
      lastTemp != null && prevTemp != null ? +(lastTemp - prevTemp).toFixed(2) : null

    // Simple anomaly narrative (grounded on deltas only)
    let trendEn = 'Insufficient contrast between windows.'
    let trendHi = 'दो खिड़कियों में पर्याप्त अंतर नहीं।'
    if (tempDelta != null && rainDeltaPct != null) {
      if (tempDelta >= 0.4 && rainDeltaPct <= -8) {
        trendEn = `Warmer (+${tempDelta}°C) and drier (${rainDeltaPct}% rain) vs prior 12 months.`
        trendHi = `पिछले 12 महीनों से गर्म (+${tempDelta}°C) और सूखा (बारिश ${rainDeltaPct}%)।`
      } else if (tempDelta >= 0.3) {
        trendEn = `Mean temperature up about ${tempDelta}°C vs prior year window.`
        trendHi = `औसत तापमान ~${tempDelta}°C बढ़ा (पिछले वर्ष की खिड़की से)।`
      } else if (rainDeltaPct >= 12) {
        trendEn = `Wetter period: rainfall about ${rainDeltaPct}% higher than prior 12 months.`
        trendHi = `अधिक वर्षा अवधि: बारिश ~${rainDeltaPct}% अधिक।`
      } else if (rainDeltaPct <= -12) {
        trendEn = `Drier period: rainfall about ${Math.abs(rainDeltaPct)}% lower than prior 12 months.`
        trendHi = `सूखी अवधि: बारिश ~${Math.abs(rainDeltaPct)}% कम।`
      } else {
        trendEn = `Near-normal vs prior year (ΔT ${tempDelta}°C, rain ${rainDeltaPct}%).`
        trendHi = `लगभग सामान्य (ΔT ${tempDelta}°C, बारिश ${rainDeltaPct}%)।`
      }
    }

    // Extreme days in last 365 archive days
    const n = times.length
    const sliceFrom = Math.max(0, n - 370)
    let hotDays = 0
    let heavyRainDays = 0
    for (let i = sliceFrom; i < n; i++) {
      if ((tMax[i] ?? 0) >= 40) hotDays++
      if ((precip[i] ?? 0) >= 50) heavyRainDays++
    }

    return res.status(200).json({
      ok: true,
      live: true,
      place: name,
      lat,
      lon,
      source: 'Open-Meteo Archive (ERA5-class reanalysis)',
      sourceUrl: 'https://open-meteo.com/en/docs/historical-weather-api',
      window: { startDate, endDate },
      monthly: last12,
      monthlyFull: months,
      summary: {
        last12mRainMm: +lastRain.toFixed(1),
        prev12mRainMm: +prevRain.toFixed(1),
        rainDeltaPct,
        last12mTempMean: lastTemp != null ? +lastTemp.toFixed(2) : null,
        prev12mTempMean: prevTemp != null ? +prevTemp.toFixed(2) : null,
        tempDeltaC: tempDelta,
        hotDaysGe40C: hotDays,
        heavyRainDaysGe50mm: heavyRainDays,
        trendEn,
        trendHi,
      },
      note: 'Historical reanalysis — not a 30-year official climate normal product. Suitable for decision support trends.',
      fetchedAt: Date.now(),
    })
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message || 'climate error', live: false })
  }
}
