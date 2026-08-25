/**
 * Air quality via Open-Meteo Air Quality API (free, no key)
 */

const cache = new Map()
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

export async function fetchAQI(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.data

  const urls = [
    // Prefer European AQI + US AQI + PM
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`,
    `/api/aqi?lat=${lat}&lon=${lon}`,
  ]

  let lastErr = null
  for (const url of urls) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 10000)
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      clearTimeout(t)
      const text = await res.text()
      if (text.trimStart().startsWith('<')) throw new Error('HTML')
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const json = JSON.parse(text)
      const cur = json.current || {}
      const us = cur.us_aqi
      const eu = cur.european_aqi
      // Prefer US AQI for India-familiar scale; fallback EU
      const aqi = us != null ? us : eu
      const scale = us != null ? 'US AQI' : eu != null ? 'EAQI' : '—'
      const b = band(aqi)
      const data = {
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
      cache.set(key, { at: Date.now(), data })
      return data
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
  cache.set(key, { at: Date.now(), data })
  return data
}
