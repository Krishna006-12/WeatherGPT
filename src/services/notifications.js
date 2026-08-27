/**
 * Browser / PWA local notifications for live alerts.
 * - Permission request
 * - Dedup via localStorage (notifyKey)
 * - Multi-city watch list poll → /api/alerts
 * - Falls back to Service Worker showNotification when available
 */

import { CITIES, getCity } from '../data/cities.js'

const SEEN_KEY = 'wgpt_alert_seen_v1'
const WATCH_KEY = 'wgpt_alert_watch_v1'
const MAX_SEEN = 200

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJson(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* quota */
  }
}

export function notificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getPermission() {
  if (!notificationSupported()) return 'unsupported'
  return Notification.permission // granted | denied | default
}

export async function requestNotificationPermission() {
  if (!notificationSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const p = await Notification.requestPermission()
    return p
  } catch {
    return 'denied'
  }
}

function loadSeen() {
  const arr = readJson(SEEN_KEY, [])
  return new Set(Array.isArray(arr) ? arr : [])
}

function saveSeen(set) {
  const arr = [...set].slice(-MAX_SEEN)
  writeJson(SEEN_KEY, arr)
}

export function markAlertSeen(notifyKey) {
  if (!notifyKey) return
  const s = loadSeen()
  s.add(String(notifyKey))
  saveSeen(s)
}

export function wasAlertSeen(notifyKey) {
  return loadSeen().has(String(notifyKey))
}

/** Default watch: home + a few metros user cares about */
export function loadWatchList(homeCityId = 'kanpur') {
  const saved = readJson(WATCH_KEY, null)
  if (Array.isArray(saved) && saved.length) {
    return saved
      .map((id) => getCity(id) || CITIES[id])
      .filter((c) => c?.lat)
      .slice(0, 8)
  }
  const seeds = [homeCityId, 'lucknow', 'delhi', 'mumbai', 'varanasi', 'noida']
  const uniq = []
  const seen = new Set()
  for (const id of seeds) {
    const c = getCity(id) || CITIES[id]
    if (!c?.lat || seen.has(c.id)) continue
    seen.add(c.id)
    uniq.push(c)
    if (uniq.length >= 5) break
  }
  return uniq
}

export function saveWatchCityIds(ids) {
  writeJson(WATCH_KEY, (ids || []).slice(0, 8))
}

export function getWatchCityIds(homeCityId) {
  const list = loadWatchList(homeCityId)
  return list.map((c) => c.id)
}

function severityRank(s) {
  return { red: 0, amber: 1, yellow: 2, green: 3 }[s] ?? 9
}

/**
 * Show a system notification (page open OR via SW if registered).
 */
export async function showAlertNotification(alert, { lang = 'en' } = {}) {
  if (!notificationSupported()) return { ok: false, reason: 'unsupported' }
  if (Notification.permission !== 'granted') return { ok: false, reason: 'denied' }

  const key = alert.notifyKey || alert.id
  if (key && wasAlertSeen(key)) return { ok: false, reason: 'duplicate' }

  const place = alert.place || alert.cityName || ''
  const titleBase = lang === 'hi' ? alert.title_hi || alert.title : alert.title
  const title = place ? `${place}: ${titleBase}` : titleBase
  const body =
    lang === 'hi'
      ? alert.summary_hi || alert.summary || ''
      : alert.summary || ''
  const tag = String(key || title).slice(0, 64)

  const opts = {
    body: body.slice(0, 180),
    tag,
    renotify: true,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: {
      url: '/?tab=alerts',
      alertId: alert.id,
      place,
      severity: alert.severity,
    },
    // silent: false — let OS decide
  }

  try {
    // Prefer SW so it works better when tab is backgrounded
    const reg = await navigator.serviceWorker?.ready?.catch?.(() => null)
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        ...opts,
        body: body.slice(0, 180),
      })
    } else {
      // eslint-disable-next-line no-new
      new Notification(title, opts)
    }
    if (key) markAlertSeen(key)
    return { ok: true }
  } catch (e) {
    try {
      // eslint-disable-next-line no-new
      new Notification(title, opts)
      if (key) markAlertSeen(key)
      return { ok: true }
    } catch (e2) {
      return { ok: false, reason: e2.message || e.message }
    }
  }
}

/**
 * Notify for a list of alerts (newest / highest severity first). Caps per tick.
 */
export async function notifyNewAlerts(alerts, { lang = 'en', minSeverity = 'yellow', maxPerTick = 3 } = {}) {
  if (!alerts?.length) return { sent: 0 }
  if (getPermission() !== 'granted') return { sent: 0, reason: 'no-permission' }

  const minRank = severityRank(minSeverity)
  const fresh = alerts
    .filter((a) => severityRank(a.severity) <= minRank)
    .filter((a) => {
      const k = a.notifyKey || a.id
      return k && !wasAlertSeen(k)
    })
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, maxPerTick)

  let sent = 0
  for (const a of fresh) {
    const r = await showAlertNotification(a, { lang })
    if (r.ok) sent++
    // small gap so OS doesn't collapse all
    await new Promise((r) => setTimeout(r, 350))
  }
  return { sent, candidates: fresh.length }
}

/**
 * Fetch live alerts for watch cities (+ optional focus city).
 */
export async function fetchLiveAlertsFeed({
  homeCityId = 'kanpur',
  focusCity = null,
  radiusKm = 600,
  signal,
} = {}) {
  const watch = loadWatchList(homeCityId)
  const points = []
  const pushCity = (c) => {
    if (!c?.lat) return
    if (points.some((p) => p.id === c.id)) return
    points.push(c)
  }
  if (focusCity) pushCity(typeof focusCity === 'object' ? focusCity : getCity(focusCity))
  watch.forEach(pushCity)

  if (!points.length) {
    return { ok: false, alerts: [], error: 'no points' }
  }

  const pointsParam = points
    .slice(0, 6)
    .map((c) => `${c.lat},${c.lon},${encodeURIComponent(c.name || c.id)}`)
    .join('|')

  // Prefer serverless; fallback to client-side Open-Meteo-only if HTML/404
  const urls = [
    `/api/alerts?points=${pointsParam}&radiusKm=${radiusKm}`,
  ]

  let lastErr = null
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      const text = await res.text()
      if (text.trimStart().startsWith('<')) throw new Error('HTML (API missing)')
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const json = JSON.parse(text)
      if (!json || !Array.isArray(json.alerts)) throw new Error('bad payload')
      return {
        ok: !!json.ok,
        live: !!json.live,
        alerts: json.alerts,
        points: json.points || [],
        sources: json.sources || [],
        fetchedAt: json.fetchedAt || Date.now(),
        radiusKm: json.radiusKm || radiusKm,
      }
    } catch (e) {
      lastErr = e
    }
  }

  // Client-side fallback: meteo-only for focus / home (no GDACS without API)
  try {
    const c = points[0]
    const wxUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
      `&current=weather_code,precipitation,wind_speed_10m` +
      `&daily=weather_code,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=5`
    const res = await fetch(wxUrl, { signal, headers: { Accept: 'application/json' } })
    const data = await res.json()
    const alerts = clientMeteoAlerts(data, c)
    return {
      ok: true,
      live: true,
      alerts,
      points: [{ place: c.name, lat: c.lat, lon: c.lon, alertCount: alerts.length }],
      sources: [{ name: 'Open-Meteo (direct fallback)', role: 'Meteo thresholds only' }],
      fetchedAt: Date.now(),
      fallback: true,
      error: lastErr?.message,
    }
  } catch (e) {
    return { ok: false, alerts: [], error: e.message || lastErr?.message }
  }
}

function clientMeteoAlerts(data, city) {
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
  const name = city.name
  const place = name
  const base = {
    place,
    placeLat: city.lat,
    placeLon: city.lon,
    source: 'Open-Meteo model',
    time: 'Model · live',
    time_hi: 'मॉडल · लाइव',
    distanceKm: 0,
  }
  if (maxCode >= 95 || code >= 95 || (maxRain > 100 && maxPop > 70)) {
    const a = {
      ...base,
      id: `client-red-${city.id}`,
      notifyKey: `client-red-${city.id}::${place}`,
      severity: 'red',
      title: `Severe weather risk — ${name}`,
      title_hi: `गंभीर मौसम — ${name}`,
      summary: `Thunderstorm / extreme rain near ${name}.`,
      summary_hi: `${name} के पास गंभीर तूफान/वर्षा।`,
    }
    return [a]
  }
  if (maxRain > 50 || maxPop >= 80 || maxWind > 45) {
    return [
      {
        ...base,
        id: `client-amber-${city.id}`,
        notifyKey: `client-amber-${city.id}::${place}`,
        severity: 'amber',
        title: `Heavy rain / wind — ${name}`,
        title_hi: `भारी वर्षा/हवा — ${name}`,
        summary: `Peak rain ~${Number(maxRain).toFixed(0)} mm, pop ${maxPop}%.`,
        summary_hi: `वर्षा ~${Number(maxRain).toFixed(0)} मिमी, संभावना ${maxPop}%。`,
      },
    ]
  }
  if ((pops[0] || 0) >= 55 || (rains[0] || 0) > 5 || code >= 61) {
    return [
      {
        ...base,
        id: `client-yellow-${city.id}`,
        notifyKey: `client-yellow-${city.id}::${place}`,
        severity: 'yellow',
        title: `Rain likely — ${name}`,
        title_hi: `बारिश संभावित — ${name}`,
        summary: `Today rain chance ~${pops[0] || 0}%.`,
        summary_hi: `आज संभावना ~${pops[0] || 0}%。`,
      },
    ]
  }
  return []
}

/**
 * Seed seen-set with current alerts so enabling notifications
 * doesn't spam everything already on screen.
 */
export function seedSeenFromAlerts(alerts) {
  if (!alerts?.length) return
  const s = loadSeen()
  for (const a of alerts) {
    const k = a.notifyKey || a.id
    if (k) s.add(String(k))
  }
  saveSeen(s)
}
