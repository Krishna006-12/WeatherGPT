/**
 * WeatherGPT local DB — IndexedDB (browser SQLite-class store)
 * Tables (object stores):
 *   weather_cache  — city weather packs for offline / low-bandwidth
 *   alert_events   — alert history for demo + audit
 *   kv             — prefs, recent cities, meta
 *
 * Design goals: low memory, fast reads, works offline, no server required.
 * Does NOT replace live Open-Meteo — only caches last good packs.
 */

const DB_NAME = 'weathergpt_db'
const DB_VER = 1
const STORE_WX = 'weather_cache'
const STORE_ALERTS = 'alert_events'
const STORE_KV = 'kv'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null)
    return dbPromise
  }
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VER)
      req.onerror = () => resolve(null)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_WX)) {
          const s = db.createObjectStore(STORE_WX, { keyPath: 'cityId' })
          s.createIndex('by_fetched', 'fetchedAt', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_ALERTS)) {
          const s = db.createObjectStore(STORE_ALERTS, { keyPath: 'id' })
          s.createIndex('by_time', 'ts', { unique: false })
          s.createIndex('by_city', 'cityId', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV, { keyPath: 'key' })
        }
      }
      req.onsuccess = () => resolve(req.result)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('idb tx'))
    tx.onabort = () => reject(tx.error || new Error('idb abort'))
  })
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Slim weather pack before disk write — drop heavy unused fields.
 * NEVER persists API secrets / keys / auth headers (none exist client-side for OM).
 * Stores: location, weather, forecast, timestamp, source.
 */
export function slimWeatherPack(wx) {
  if (!wx) return null
  const city = wx.city
    ? {
        id: wx.city.id,
        name: wx.city.name,
        name_hi: wx.city.name_hi,
        state: wx.city.state,
        state_hi: wx.city.state_hi,
        lat: wx.city.lat,
        lon: wx.city.lon,
        tz: wx.city.tz,
        country: wx.city.country,
        countryCode: wx.city.countryCode,
        region: wx.city.region,
      }
    : null
  return {
    city,
    location: city
      ? {
          id: city.id,
          name: city.name,
          lat: city.lat,
          lon: city.lon,
          tz: city.tz,
          countryCode: city.countryCode,
        }
      : null,
    fetchedAt: wx.fetchedAt || Date.now(),
    // On disk always non-live — UI must re-derive status
    live: false,
    stale: true,
    fromCache: true,
    offlineCached: true,
    liveSource: wx.liveSource || wx.source || 'cache',
    source: wx.liveSource || wx.source || 'open-meteo',
    timezone: wx.timezone,
    current: wx.current,
    // forecast
    hourly: Array.isArray(wx.hourly) ? wx.hourly.slice(0, 24) : [],
    daily: Array.isArray(wx.daily) ? wx.daily.slice(0, 7) : [],
    agri: wx.agri
      ? {
          soil: wx.agri.soil,
          recentRain: wx.agri.recentRain,
          advice_en: wx.agri.advice_en,
          advice_hi: wx.agri.advice_hi,
        }
      : undefined,
    alerts: Array.isArray(wx.alerts) ? wx.alerts.slice(0, 8) : [],
    astro: wx.astro,
    sources: wx.sources,
    // strip multi-model bulk / confidence blobs if huge — keep tiny summary
    multi_model_mode: wx.multi_model_mode || null,
    confidence: wx.confidence
      ? {
          level: wx.confidence.level,
          score: wx.confidence.score,
          engine: wx.confidence.engine,
        }
      : null,
  }
}

export async function dbPutWeather(cityId, pack) {
  const db = await openDb()
  if (!db || !cityId || !pack) return false
  // Never write demo/synthetic packs over a real observation
  if (pack.demo || pack.synthetic) return false
  try {
    const slim = slimWeatherPack(pack)
    const row = {
      cityId,
      fetchedAt: slim.fetchedAt || Date.now(),
      live: false,
      source: slim.source || slim.liveSource,
      location: slim.location,
      pack: slim,
    }
    const tx = db.transaction(STORE_WX, 'readwrite')
    tx.objectStore(STORE_WX).put(row)
    await txDone(tx)
    // Cap store size: keep 24 newest cities
    await trimWeatherStore(24)
    return true
  } catch {
    return false
  }
}

/**
 * Read last successful weather pack.
 * @param maxAgeMs — soft TTL: older packs still returned with stale:true (caller decides).
 *                    Pass 0 to always accept (offline last-resort).
 */
export async function dbGetWeather(cityId, maxAgeMs = 6 * 60 * 60 * 1000) {
  const db = await openDb()
  if (!db || !cityId) return null
  try {
    const tx = db.transaction(STORE_WX, 'readonly')
    const row = await reqToPromise(tx.objectStore(STORE_WX).get(cityId))
    if (!row?.pack) return null
    const fetchedAt = row.fetchedAt || row.pack.fetchedAt || 0
    const age = Date.now() - fetchedAt
    const overSoft = maxAgeMs > 0 && age > maxAgeMs
    // Always mark disk packs as non-live — never present as Live
    return {
      ...row.pack,
      city: row.pack.city || row.location || row.pack.location,
      location: row.pack.location || row.location,
      fetchedAt,
      live: false,
      stale: true,
      fromDb: true,
      fromCache: true,
      offlineCached: true,
      source: row.source || row.pack.source || row.pack.liveSource,
      liveSource: row.pack.liveSource || row.source || 'IndexedDB',
      ageMs: age,
      softExpired: overSoft,
    }
  } catch {
    return null
  }
}

/** Last pack even if ancient — for complete offline */
export async function dbGetWeatherAny(cityId) {
  return dbGetWeather(cityId, 0)
}

async function trimWeatherStore(keep = 24) {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE_WX, 'readwrite')
    const store = tx.objectStore(STORE_WX)
    const all = await reqToPromise(store.getAll())
    if (!all || all.length <= keep) {
      await txDone(tx)
      return
    }
    all.sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0))
    const drop = all.slice(keep)
    for (const r of drop) store.delete(r.cityId)
    await txDone(tx)
  } catch {
    /* ignore */
  }
}

export async function dbLogAlert(event) {
  const db = await openDb()
  if (!db || !event) return false
  try {
    const row = {
      id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ts: event.ts || Date.now(),
      cityId: event.cityId || '',
      severity: event.severity || '',
      title: String(event.title || '').slice(0, 160),
      source: event.source || '',
      kind: event.kind || 'alert', // alert | simulate | notify
    }
    const tx = db.transaction(STORE_ALERTS, 'readwrite')
    tx.objectStore(STORE_ALERTS).put(row)
    await txDone(tx)
    await trimAlerts(80)
    return true
  } catch {
    return false
  }
}

async function trimAlerts(keep = 80) {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE_ALERTS, 'readwrite')
    const store = tx.objectStore(STORE_ALERTS)
    const idx = store.index('by_time')
    const all = await reqToPromise(idx.getAll())
    if (!all || all.length <= keep) {
      await txDone(tx)
      return
    }
    // index returns ascending by time
    const drop = all.slice(0, all.length - keep)
    for (const r of drop) store.delete(r.id)
    await txDone(tx)
  } catch {
    /* ignore */
  }
}

export async function dbListAlerts(limit = 30) {
  const db = await openDb()
  if (!db) return []
  try {
    const tx = db.transaction(STORE_ALERTS, 'readonly')
    const all = await reqToPromise(tx.objectStore(STORE_ALERTS).index('by_time').getAll())
    return (all || []).slice(-limit).reverse()
  } catch {
    return []
  }
}

export async function dbKvSet(key, value) {
  const db = await openDb()
  if (!db || !key) return false
  try {
    const tx = db.transaction(STORE_KV, 'readwrite')
    tx.objectStore(STORE_KV).put({ key, value, at: Date.now() })
    await txDone(tx)
    return true
  } catch {
    return false
  }
}

export async function dbKvGet(key) {
  const db = await openDb()
  if (!db || !key) return null
  try {
    const tx = db.transaction(STORE_KV, 'readonly')
    const row = await reqToPromise(tx.objectStore(STORE_KV).get(key))
    return row ? row.value : null
  } catch {
    return null
  }
}

export async function dbStats() {
  const db = await openDb()
  if (!db) return { ok: false, engine: 'none' }
  try {
    const wx = await reqToPromise(db.transaction(STORE_WX, 'readonly').objectStore(STORE_WX).count())
    const al = await reqToPromise(
      db.transaction(STORE_ALERTS, 'readonly').objectStore(STORE_ALERTS).count()
    )
    return {
      ok: true,
      engine: 'indexeddb',
      name: DB_NAME,
      weatherCities: wx,
      alertEvents: al,
    }
  } catch {
    return { ok: false, engine: 'error' }
  }
}

/** Network quality hint for UI */
export function networkHint() {
  if (typeof navigator === 'undefined') return { online: true, saveData: false, effectiveType: '4g' }
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  return {
    online: navigator.onLine !== false,
    saveData: !!(c && c.saveData),
    effectiveType: (c && c.effectiveType) || '4g',
    downlink: c?.downlink,
  }
}

export function isSlowNetwork() {
  const n = networkHint()
  if (!n.online) return true
  if (n.saveData) return true
  return n.effectiveType === 'slow-2g' || n.effectiveType === '2g' || n.effectiveType === '3g'
}
