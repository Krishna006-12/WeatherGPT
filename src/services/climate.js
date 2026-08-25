/**
 * Client: climate history + NWP multi-model
 */

const cache = new Map()
const TTL = 30 * 60 * 1000

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  const text = await res.text()
  if (text.trimStart().startsWith('<')) throw new Error('HTML (API missing)')
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return JSON.parse(text)
}

export async function fetchClimate(city) {
  if (!city?.lat) throw new Error('city required')
  const key = `cl:${city.id || city.lat}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.data

  const name = encodeURIComponent(city.name || 'Area')
  const urls = [
    `/api/climate?lat=${city.lat}&lon=${city.lon}&name=${name}`,
  ]

  let lastErr = null
  for (const url of urls) {
    try {
      const data = await getJson(url)
      if (!data.ok) throw new Error(data.error || 'climate fail')
      cache.set(key, { at: Date.now(), data })
      return data
    } catch (e) {
      lastErr = e
    }
  }

  // Direct archive fallback
  try {
    const end = new Date()
    end.setUTCDate(end.getUTCDate() - 5)
    const start = new Date(end)
    start.setUTCFullYear(start.getUTCFullYear() - 1)
    const startDate = start.toISOString().slice(0, 10)
    const endDate = end.toISOString().slice(0, 10)
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${city.lat}&longitude=${city.lon}` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&daily=temperature_2m_mean,temperature_2m_max,precipitation_sum&timezone=auto`
    const raw = await getJson(url)
    const daily = raw.daily || {}
    const times = daily.time || []
    const means = daily.temperature_2m_mean || []
    const rains = daily.precipitation_sum || []
    const buckets = new Map()
    for (let i = 0; i < times.length; i++) {
      const mk = String(times[i]).slice(0, 7)
      if (!buckets.has(mk)) buckets.set(mk, { mean: [], rain: [] })
      const b = buckets.get(mk)
      if (means[i] != null) b.mean.push(means[i])
      if (rains[i] != null) b.rain.push(rains[i])
    }
    const monthly = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, b]) => ({
        month,
        tempMean: b.mean.length ? +(b.mean.reduce((a, c) => a + c, 0) / b.mean.length).toFixed(1) : null,
        precipMm: +b.rain.reduce((a, c) => a + c, 0).toFixed(1),
      }))
    const data = {
      ok: true,
      live: true,
      fallback: true,
      place: city.name,
      monthly,
      summary: {
        trendEn: 'Archive direct fallback — limited summary.',
        trendHi: 'आर्काइव डायरेक्ट — सीमित सारांश।',
        last12mRainMm: monthly.reduce((a, m) => a + (m.precipMm || 0), 0),
      },
      source: 'Open-Meteo Archive (direct)',
      fetchedAt: Date.now(),
      error: lastErr?.message,
    }
    cache.set(key, { at: Date.now(), data })
    return data
  } catch (e) {
    throw new Error(e.message || lastErr?.message || 'climate failed')
  }
}

export async function fetchModels(city) {
  if (!city?.lat) throw new Error('city required')
  const key = `md:${city.id || city.lat}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.data

  const name = encodeURIComponent(city.name || 'Area')
  try {
    const data = await getJson(`/api/models?lat=${city.lat}&lon=${city.lon}&name=${name}`)
    if (!data.ok) throw new Error(data.error || 'models fail')
    cache.set(key, { at: Date.now(), data })
    return data
  } catch (e) {
    // Minimal single-model fallback
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=2`
    const raw = await getJson(url)
    const c = raw.current || {}
    const d = raw.daily || {}
    const data = {
      ok: true,
      live: true,
      fallback: true,
      place: city.name,
      models: [
        {
          id: 'best_match',
          short: 'Blend',
          label: 'Open-Meteo best match',
          ok: true,
          currentTemp: Math.round(c.temperature_2m ?? 0),
          today: {
            max: Math.round(d.temperature_2m_max?.[0] ?? 0),
            min: Math.round(d.temperature_2m_min?.[0] ?? 0),
            rain: d.precipitation_sum?.[0],
            pop: d.precipitation_probability_max?.[0],
          },
          next24h: { tempMean: c.temperature_2m, popMax: d.precipitation_probability_max?.[0] },
        },
      ],
      ensemble: {
        meanTemp24h: c.temperature_2m,
        spreadC: null,
        agreementEn: 'Single-model fallback (API models route unavailable).',
        agreementHi: 'सिंगल-मॉडल फ़ॉलबैक।',
      },
      error: e.message,
      fetchedAt: Date.now(),
    }
    cache.set(key, { at: Date.now(), data })
    return data
  }
}
