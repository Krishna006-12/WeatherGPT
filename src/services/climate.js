/**
 * Client: climate history + NWP multi-model
 * Climate TTL 30min; models TTL 5min; coalesce + timed fetch
 */

import {
  createInflight,
  createTtlCache,
  timedFetch,
  perfMark,
  perfTime,
} from './perf'

const cache = createTtlCache({ name: 'climate', defaultTtlMs: 30 * 60 * 1000 })
const inflight = createInflight()
const TTL_CLIMATE = 30 * 60 * 1000
const TTL_MODELS = 5 * 60 * 1000

async function getJson(url, label = 'climate', signal) {
  const { json } = await timedFetch(
    url,
    { timeoutMs: 15000, signal, cache: 'no-store' },
    label,
  )
  return json
}

export async function fetchClimate(city, { signal, force = false } = {}) {
  if (!city?.lat) throw new Error('city required')
  const key = `cl:${city.id || city.lat}`
  if (!force) {
    const hit = cache.get(key, TTL_CLIMATE)
    if (hit) return hit
  }

  return inflight.run(`climate:${key}`, async () => {
    if (!force) {
      const hit = cache.get(key, TTL_CLIMATE)
      if (hit) return hit
    }

    const name = encodeURIComponent(city.name || 'Area')
    const urls = [`/api/climate?lat=${city.lat}&lon=${city.lon}&name=${name}`]

    let lastErr = null
    for (const url of urls) {
      try {
        const data = await getJson(url, 'climate', signal)
        if (!data.ok) throw new Error(data.error || 'climate fail')
        cache.set(key, data)
        perfMark('climate_ok', { place: city.name })
        return data
      } catch (e) {
        lastErr = e
        if (signal?.aborted) throw e
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
      const raw = await getJson(url, 'climate', signal)
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
      cache.set(key, data)
      return data
    } catch (e) {
      throw new Error(e.message || lastErr?.message || 'climate failed')
    }
  })
}

/**
 * Multi-model NWP — ALWAYS via backend /api/models (server aggregates).
 * Direct Open-Meteo is only a last-resort single-model fallback when the
 * API route is missing (local static preview). Never fans out multiple
 * model URLs from the browser.
 */
export async function fetchModels(city, { signal, force = false } = {}) {
  if (!city?.lat) throw new Error('city required')
  const key = `md:${city.id || city.lat}`
  if (!force) {
    const hit = cache.get(key, TTL_MODELS)
    if (hit) return hit
  }

  return inflight.run(`models:${key}`, async () => {
    if (!force) {
      const hit = cache.get(key, TTL_MODELS)
      if (hit) return hit
    }

    const name = encodeURIComponent(city.name || 'Area')
    const tz = encodeURIComponent(city.tz || 'auto')
    const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
    try {
      const data = await getJson(
        `/api/models?lat=${city.lat}&lon=${city.lon}&name=${name}&tz=${tz}`,
        'models',
        signal,
      )
      if (!data.ok && !(data.models || []).some((m) => m.ok || m.available)) {
        throw new Error(data.error || 'models fail')
      }
      cache.set(key, data)
      const ms = Math.round(
        (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0,
      )
      perfTime('models_ms', ms)
      perfMark('models_ok', { place: city.name, ms })
      return data
    } catch (e) {
      if (signal?.aborted) throw e
      // Single-model client fallback — never multi-model from browser
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
        `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,wind_direction_10m` +
        `&hourly=temperature_2m,precipitation_probability,precipitation` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=2`
      const raw = await getJson(url, 'models', signal)
      const c = raw.current || {}
      const d = raw.daily || {}
      const h = raw.hourly || {}
      const temps = (h.temperature_2m || []).slice(0, 24).filter((v) => v != null)
      const tempMean = temps.length
        ? +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)
        : c.temperature_2m ?? null
      const obs = {
        location: { name: city.name, lat: city.lat, lon: city.lon },
        timestamp: c.time || null,
        temperature: c.temperature_2m ?? null,
        apparent_temperature: c.apparent_temperature ?? null,
        precipitation_probability: h.precipitation_probability?.[0] ?? null,
        precipitation: c.precipitation ?? null,
        wind_speed: c.wind_speed_10m ?? null,
        wind_direction: c.wind_direction_10m ?? null,
        humidity: c.relative_humidity_2m ?? null,
        cloud_cover: c.cloud_cover ?? null,
        weather_code: c.weather_code ?? null,
        source_model: 'best_match',
        meta: {
          model_name: 'Open-Meteo best match',
          model_id: 'best_match',
          model_run_time: null,
          forecast_timestamp: c.time || null,
          source: 'Open-Meteo Forecast API (direct client fallback)',
          fetched_at: new Date().toISOString(),
        },
      }
      const data = {
        ok: true,
        live: true,
        fallback: true,
        schema: 'weathergpt.multi_model.v1',
        place: city.name,
        multi_model_mode: 'single',
        primary_model_id: 'best_match',
        primary_observation: obs,
        models: [
          {
            id: 'best_match',
            short: 'Blend',
            label: 'Open-Meteo best match',
            ok: true,
            available: true,
            currentTemp: c.temperature_2m != null ? Math.round(c.temperature_2m) : null,
            current: obs,
            today: {
              max: d.temperature_2m_max?.[0] != null ? Math.round(d.temperature_2m_max[0]) : null,
              min: d.temperature_2m_min?.[0] != null ? Math.round(d.temperature_2m_min[0]) : null,
              rain: d.precipitation_sum?.[0] ?? null,
              pop: d.precipitation_probability_max?.[0] ?? null,
            },
            next24h: {
              tempMean,
              temp_mean: tempMean,
              popMax: d.precipitation_probability_max?.[0] ?? null,
              pop_max: d.precipitation_probability_max?.[0] ?? null,
              rainSum: null,
            },
            meta: obs.meta,
          },
        ],
        ensemble: {
          meanTemp24h: tempMean,
          spreadC: null,
          modelCount: 1,
          agreementLevel: 'single',
          agreementEn:
            'Single-model fallback only (API /api/models unavailable). Not multi-model consensus.',
          agreementHi: 'सिंगल-मॉडल फ़ॉलबैक — मल्टी-मॉडल सहमति नहीं।',
          is_consensus: false,
          single_model_only: true,
          no_models: false,
        },
        unavailable: [],
        error: e.message,
        note: 'Client fell back to one Open-Meteo best_match call. Do not treat as multi-model.',
        fetchedAt: Date.now(),
      }
      cache.set(key, data)
      return data
    }
  })
}

export function clearClimateCache() {
  cache.clear()
  inflight.clear()
}
