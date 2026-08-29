/**
 * Performance utilities — cache, coalesce, abort, instrumentation
 * No large deps. Safe for Vite + React.
 */

const g =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : {}

/** Ring buffer of recent marks */
const marks = []
const MAX_MARKS = 80
const counters = {
  cache_hit: 0,
  cache_miss: 0,
  coalesce_hit: 0,
  fetch_ok: 0,
  fetch_err: 0,
  weather_ms: [],
  geocode_ms: [],
  aqi_ms: [],
  climate_ms: [],
  models_ms: [],
  chat_ms: [],
  paint_ms: null,
}

export function perfMark(name, detail = {}) {
  const row = { t: Date.now(), name, ...detail }
  marks.push(row)
  if (marks.length > MAX_MARKS) marks.shift()
  try {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`wgpt:${name}`)
    }
  } catch {
    /* */
  }
  return row
}

export function perfInc(key, n = 1) {
  counters[key] = (counters[key] || 0) + n
}

export function perfTime(key, ms) {
  const arr = counters[key]
  if (Array.isArray(arr)) {
    arr.push(ms)
    if (arr.length > 40) arr.shift()
  }
}

function avg(arr) {
  if (!arr?.length) return null
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

export function getPerfSnapshot() {
  return {
    counters: {
      cache_hit: counters.cache_hit,
      cache_miss: counters.cache_miss,
      coalesce_hit: counters.coalesce_hit,
      fetch_ok: counters.fetch_ok,
      fetch_err: counters.fetch_err,
    },
    latency_avg_ms: {
      weather: avg(counters.weather_ms),
      geocode: avg(counters.geocode_ms),
      aqi: avg(counters.aqi_ms),
      climate: avg(counters.climate_ms),
      models: avg(counters.models_ms),
      chat: avg(counters.chat_ms),
    },
    initial_paint_ms: counters.paint_ms,
    recent: marks.slice(-20),
  }
}

export function setInitialPaintMs(ms) {
  if (counters.paint_ms == null) counters.paint_ms = Math.round(ms)
}

/** Expose for Settings / console */
if (typeof g !== 'undefined') {
  g.__WEATHERGPT_PERF__ = getPerfSnapshot
}

/**
 * TTL memory cache with optional stale-while-revalidate hook
 */
export function createTtlCache({ name = 'cache', defaultTtlMs = 60_000 } = {}) {
  const map = new Map()
  return {
    name,
    get(key, ttlMs = defaultTtlMs) {
      const hit = map.get(key)
      if (!hit) {
        perfInc('cache_miss')
        return null
      }
      if (Date.now() - hit.at > ttlMs) {
        perfInc('cache_miss')
        return null
      }
      perfInc('cache_hit')
      perfMark('cache_hit', { cache: name, key: String(key).slice(0, 40) })
      return hit.value
    },
    peek(key) {
      return map.get(key)?.value ?? null
    },
    set(key, value) {
      map.set(key, { at: Date.now(), value })
    },
    delete(key) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
    size() {
      return map.size
    },
  }
}

/**
 * In-flight request coalescing — identical key shares one promise
 */
export function createInflight() {
  const map = new Map()
  return {
    run(key, fn) {
      const k = String(key)
      const existing = map.get(k)
      if (existing) {
        perfInc('coalesce_hit')
        perfMark('coalesce', { key: k.slice(0, 48) })
        return existing
      }
      const p = Promise.resolve()
        .then(fn)
        .finally(() => {
          map.delete(k)
        })
      map.set(k, p)
      return p
    },
    has(key) {
      return map.has(String(key))
    },
    clear() {
      map.clear()
    },
  }
}

/**
 * Timed fetch wrapper with optional external AbortSignal
 */
export async function timedFetch(url, opts = {}, label = 'fetch') {
  const t0 =
    typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
  const timeoutMs = opts.timeoutMs ?? 10000
  const outer = opts.signal
  const ctrl = new AbortController()
  const onOuter = () => ctrl.abort()
  if (outer) {
    if (outer.aborted) ctrl.abort()
    else outer.addEventListener('abort', onOuter, { once: true })
  }
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(opts.headers || {}) },
    })
    const text = await res.text()
    const ms = Math.round(
      (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0
    )
    perfTime(`${label}_ms`.replace(/[^a-z_]/gi, '') , ms)
    // map common labels
    if (/weather/i.test(label)) perfTime('weather_ms', ms)
    else if (/geo/i.test(label)) perfTime('geocode_ms', ms)
    else if (/aqi/i.test(label)) perfTime('aqi_ms', ms)
    else if (/climate/i.test(label)) perfTime('climate_ms', ms)
    else if (/model/i.test(label)) perfTime('models_ms', ms)
    else if (/chat/i.test(label)) perfTime('chat_ms', ms)

    if (text.trimStart().startsWith('<')) throw new Error('HTML response')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    let json
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error('Invalid JSON')
    }
    perfInc('fetch_ok')
    perfMark('fetch_ok', { label, ms, url: String(url).slice(0, 80) })
    return { json, ms, status: res.status }
  } catch (e) {
    perfInc('fetch_err')
    perfMark('fetch_err', { label, err: String(e.message || e).slice(0, 80) })
    throw e
  } finally {
    clearTimeout(timer)
    if (outer) outer.removeEventListener('abort', onOuter)
  }
}

/** Race multiple independent fetchers; first successful wins */
export async function raceFirstOk(tasks, { signal } = {}) {
  return new Promise((resolve, reject) => {
    let pending = tasks.length
    let settled = false
    const errors = []
    if (!pending) {
      reject(new Error('no tasks'))
      return
    }
    const onAbort = () => {
      if (!settled) {
        settled = true
        reject(new Error('aborted'))
      }
    }
    if (signal) {
      if (signal.aborted) {
        reject(new Error('aborted'))
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }
    tasks.forEach((fn, i) => {
      Promise.resolve()
        .then(fn)
        .then((v) => {
          if (settled) return
          if (v == null) {
            pending -= 1
            if (pending <= 0) reject(errors[0] || new Error('all empty'))
            return
          }
          settled = true
          resolve(v)
        })
        .catch((e) => {
          errors[i] = e
          pending -= 1
          if (!settled && pending <= 0) reject(errors.find(Boolean) || e)
        })
    })
  })
}
