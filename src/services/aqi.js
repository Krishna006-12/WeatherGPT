/**
 * Air quality via Open-Meteo Air Quality API (free, no key)
 * TTL ~20min (AQI changes slowly); coalesce + abort + race direct/proxy
 */

import {
  createInflight,
  createTtlCache,
  timedFetch,
  raceFirstOk,
  perfMark,
} from './perf'

const cache = createTtlCache({ name: 'aqi', defaultTtlMs: 20 * 60 * 1000 })
const inflight = createInflight()
const TTL = 20 * 60 * 1000

function band(aqi) {
  if (aqi == null || Number.isNaN(aqi)) return { level: 'unknown', en: 'Unknown', hi: 'अज्ञात', color: 'ink' }
  if (aqi <= 50) return { level: 'good', en: 'Good', hi: 'अच्छा', color: 'mint' }
  if (aqi <= 100) return { level: 'moderate', en: 'Moderate', hi: 'मध्यम', color: 'sun' }
  if (aqi <= 150) return { level: 'usg', en: 'Unhealthy (SG)', hi: 'संवेदनशील के लिए खराब', color: 'alert' }
  if (aqi <= 200) return { level: 'unhealthy', en: 'Unhealthy', hi: 'अस्वास्थ्यकर', color: 'alert' }
  if (aqi <= 300) return { level: 'very', en: 'Very unhealthy', hi: 'बहुत अस्वास्थ्यकर', color: 'alert' }
  return { level: 'hazard', en: 'Hazardous', hi: 'खतरनाक', color: 'alert' }
}

function advice(level, lang) {
  const map = {
    good: {
      en: 'Air is fine for outdoor activity.',
      hi: 'बाहर की गतिविधि के लिए हवा ठीक है।',
    },
    moderate: {
      en: 'Sensitive people should limit long outdoor exertion.',
      hi: 'संवेदनशील लोग लंबी बाहरी मेहनत सीमित करें।',
    },
    usg: {
      en: 'Kids, elders, asthma — reduce outdoor PE / commuting peak hours.',
      hi: 'बच्चे, बुज़ुर्ग, अस्थमा — बाहर PT / पीक आवागमन कम करें।',
    },
    unhealthy: {
      en: 'Avoid heavy outdoor exercise. Prefer mask in traffic.',
      hi: 'भारी बाहरी व्यायाम से बचें। ट्रैफ़िक में मास्क बेहतर।',
    },
    very: {
      en: 'Stay indoors if possible. Schools: shift PE inside.',
      hi: 'संभव हो तो अंदर रहें। स्कूल: PT इंडोर करें।',
    },
    hazard: {
      en: 'Health emergency band — minimize outdoor exposure.',
      hi: 'स्वास्थ्य आपात स्तर — बाहर निकलना न्यूनतम।',
    },
    unknown: {
      en: 'AQI unavailable right now.',
      hi: 'अभी AQI उपलब्ध नहीं।',
    },
  }
  const row = map[level] || map.unknown
  return lang === 'hi' ? row.hi : row.en
}

function parseAqiJson(json) {
  const cur = json.current || {}
  const us = cur.us_aqi
  const eu = cur.european_aqi
  const aqi = us != null ? us : eu
  const scale = us != null ? 'US AQI' : eu != null ? 'EAQI' : '—'
  const b = band(aqi)
  return {
    live: true,
    aqi: aqi != null ? Math.round(aqi) : null,
    scale,
    band: b,
    pm25: cur.pm2_5 != null ? +Number(cur.pm2_5).toFixed(1) : null,
    pm10: cur.pm10 != null ? +Number(cur.pm10).toFixed(1) : null,
    no2: cur.nitrogen_dioxide != null ? +Number(cur.nitrogen_dioxide).toFixed(1) : null,
    o3: cur.ozone != null ? +Number(cur.ozone).toFixed(1) : null,
    so2: cur.sulphur_dioxide != null ? +Number(cur.sulphur_dioxide).toFixed(1) : null,
    co: cur.carbon_monoxide != null ? +Number(cur.carbon_monoxide).toFixed(0) : null,
    fetchedAt: Date.now(),
    advice: (lang) => advice(b.level, lang),
  }
}

/**
 * @param {number} lat
 * @param {number} lon
 * @param {{ signal?: AbortSignal, force?: boolean }} [opts]
 */
export async function fetchAQI(lat, lon, opts = {}) {
  const { signal, force = false } = opts
  const key = `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`

  if (!force) {
    const hit = cache.get(key, TTL)
    if (hit) return hit
  }

  return inflight.run(`aqi:${key}`, async () => {
    // re-check after coalesce wait
    if (!force) {
      const hit = cache.get(key, TTL)
      if (hit) return hit
    }

    const direct =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`
    const proxy = `/api/aqi?lat=${lat}&lon=${lon}`

    let lastErr = null
    try {
      const winner = await raceFirstOk(
        [
          async () => {
            const { json } = await timedFetch(direct, { timeoutMs: 8000, signal, cache: 'no-cache' }, 'aqi')
            if (!json?.current) return null
            return parseAqiJson(json)
          },
          async () => {
            const { json } = await timedFetch(proxy, { timeoutMs: 7000, signal, cache: 'no-cache' }, 'aqi')
            if (!json?.current && json?.aqi == null && !json?.live) {
              // proxy may already return shaped payload
              if (json?.aqi != null || json?.band) {
                return {
                  live: !!json.live,
                  aqi: json.aqi ?? null,
                  scale: json.scale || '—',
                  band: json.band || band(json.aqi),
                  pm25: json.pm25 ?? null,
                  pm10: json.pm10 ?? null,
                  no2: json.no2 ?? null,
                  o3: json.o3 ?? null,
                  so2: json.so2 ?? null,
                  co: json.co ?? null,
                  fetchedAt: Date.now(),
                  advice: (lang) => advice((json.band || band(json.aqi)).level, lang),
                }
              }
              return null
            }
            if (json?.current) return parseAqiJson(json)
            return null
          },
        ],
        { signal },
      )
      if (winner) {
        cache.set(key, winner)
        perfMark('aqi_ok', { key })
        return winner
      }
    } catch (e) {
      lastErr = e
      if (signal?.aborted || /abort/i.test(String(e.message || ''))) throw e
    }

    // sequential last resort
    for (const url of [direct, proxy]) {
      try {
        const { json } = await timedFetch(url, { timeoutMs: 10000, signal, cache: 'no-cache' }, 'aqi')
        const data = json?.current ? parseAqiJson(json) : null
        if (data) {
          cache.set(key, data)
          return data
        }
      } catch (e) {
        lastErr = e
      }
    }

    const data = {
      live: false,
      aqi: null,
      scale: '—',
      band: band(null),
      pm25: null,
      pm10: null,
      no2: null,
      o3: null,
      so2: null,
      co: null,
      fetchedAt: Date.now(),
      error: lastErr?.message,
      advice: (lang) => advice('unknown', lang),
    }
    cache.set(key, data)
    return data
  })
}

export function clearAqiCache() {
  cache.clear()
  inflight.clear()
}
