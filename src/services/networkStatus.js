/**
 * Offline / weak-network status — builds on existing IDB + mem weather cache.
 * Does NOT introduce a second weather store. Never touches API secrets.
 *
 * Status enum (UI):
 *   live      — fresh network fetch, within soft TTL
 *   updating  — showing last-good while a refresh is in flight
 *   cached    — serving disk/mem pack; online but not live this moment
 *   offline   — navigator offline OR forced offline; pack may be stale
 *   demo      — synthetic offlinePack (no real observation) — never labeled Live
 */

/** Local net probe — keep free of './db' so Node smokes resolve without extension maps */
function networkHint() {
  if (typeof navigator === 'undefined') {
    return { online: true, saveData: false, effectiveType: '4g' }
  }
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  return {
    online: navigator.onLine !== false,
    saveData: !!(c && c.saveData),
    effectiveType: (c && c.effectiveType) || '4g',
    downlink: c?.downlink,
  }
}

function isSlowNetwork() {
  const n = networkHint()
  if (!n.online) return true
  if (n.saveData) return true
  return n.effectiveType === 'slow-2g' || n.effectiveType === '2g' || n.effectiveType === '3g'
}

/** Soft freshness for “Live” badge (aligned with weather TTL_LIVE_PACK) */
export const FRESH_MS = 5 * 60 * 1000
/** After this, pack is “stale” even if still shown */
export const STALE_MS = 30 * 60 * 1000
/** Max age we will still surface from IDB when fully offline */
export const OFFLINE_MAX_MS = 72 * 60 * 60 * 1000
/** Weak-net: skip non-essential background work under this */
export const WEAK_PREFETCH_CAP = 1

export function getNetworkSnapshot() {
  const n = networkHint()
  const slow = isSlowNetwork()
  return {
    online: n.online !== false,
    saveData: !!n.saveData,
    effectiveType: n.effectiveType || '4g',
    downlink: n.downlink,
    slow,
    /** Core-only mode: 2g/slow-2g/save-data/offline */
    coreOnly:
      !n.online ||
      !!n.saveData ||
      n.effectiveType === 'slow-2g' ||
      n.effectiveType === '2g' ||
      (n.effectiveType === '3g' && (n.downlink == null || n.downlink < 1.2)),
  }
}

export function packAgeMs(pack) {
  if (!pack?.fetchedAt) return null
  const t = typeof pack.fetchedAt === 'number' ? pack.fetchedAt : Date.now()
  return Math.max(0, Date.now() - t)
}

export function formatAge(ms, lang = 'en') {
  if (ms == null || !Number.isFinite(ms)) return lang === 'hi' ? '—' : '—'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return lang === 'hi' ? `${sec}से` : `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return lang === 'hi' ? `${min} मि` : `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 48) return lang === 'hi' ? `${hr} घं` : `${hr}h`
  const d = Math.floor(hr / 24)
  return lang === 'hi' ? `${d} दिन` : `${d}d`
}

/**
 * Derive display status from pack + network + loading flags.
 * Rule: never call synthetic demo or stale disk "Live".
 */
export function deriveDataStatus(pack, {
  online = true,
  updating = false,
  loading = false,
} = {}) {
  if (loading && !pack?.current) {
    return {
      code: 'updating',
      live: false,
      stale: false,
      demo: false,
      ageMs: null,
    }
  }

  const demo = !!(pack?.demo || pack?.synthetic || pack?.liveSource === 'offline-demo')
  const ageMs = packAgeMs(pack)
  const staleFlag = !!(pack?.stale || pack?.fromCache)
  const wasLiveFetch = !!(pack?.live && !demo && !staleFlag)
  const fresh = ageMs != null && ageMs <= FRESH_MS
  const veryStale = ageMs != null && ageMs > STALE_MS

  if (demo) {
    return {
      code: online ? 'cached' : 'offline',
      live: false,
      stale: true,
      demo: true,
      ageMs,
      label_en: 'Demo data',
      label_hi: 'डेमो डेटा',
    }
  }

  if (updating && pack?.current) {
    return {
      code: 'updating',
      live: false,
      stale: staleFlag || veryStale || !wasLiveFetch,
      demo: false,
      ageMs,
    }
  }

  if (!online) {
    return {
      code: 'offline',
      live: false,
      stale: true,
      demo: false,
      ageMs,
    }
  }

  // Online
  if (wasLiveFetch && fresh && !veryStale) {
    return {
      code: 'live',
      live: true,
      stale: false,
      demo: false,
      ageMs,
    }
  }

  // Disk/mem last-good while online
  return {
    code: 'cached',
    live: false,
    stale: staleFlag || veryStale || !wasLiveFetch,
    demo: false,
    ageMs,
  }
}

export function statusLabels(code, lang = 'en') {
  const map = {
    live: { en: 'Live', hi: 'लाइव' },
    updating: { en: 'Updating', hi: 'अपडेट' },
    cached: { en: 'Cached', hi: 'कैश' },
    offline: { en: 'Offline', hi: 'ऑफ़लाइन' },
  }
  const row = map[code] || map.cached
  return lang === 'hi' ? row.hi : row.en
}

/** Human subtitle under the pill */
export function statusDetail(status, lang = 'en') {
  if (!status) return ''
  const age = formatAge(status.ageMs, lang)
  if (status.demo) {
    return lang === 'hi'
      ? 'सिंथेटिक — असली ऑब्ज़र्वेशन नहीं'
      : 'Synthetic — not a real observation'
  }
  if (status.code === 'live') {
    return lang === 'hi' ? `अभी · ${age}` : `now · ${age}`
  }
  if (status.code === 'updating') {
    return lang === 'hi'
      ? `पिछला डेटा · ${age} · रीफ़्रेश…`
      : `last good · ${age} · refresh…`
  }
  if (status.code === 'offline') {
    return lang === 'hi'
      ? `कैश · ${age} पहले` + (status.stale ? ' · पुराना' : '')
      : `cached · ${age} ago` + (status.stale ? ' · stale' : '')
  }
  // cached
  return lang === 'hi'
    ? `${age} पहले` + (status.stale ? ' · पुराना' : '')
    : `${age} ago` + (status.stale ? ' · stale' : '')
}

/**
 * Annotate pack so UI never treats disk/demo as live.
 * Call on every path that returns non-fresh network data.
 */
export function markPackCached(pack, {
  reason = 'cache',
  source = 'IndexedDB',
  online = true,
} = {}) {
  if (!pack) return null
  const ageMs = packAgeMs(pack)
  const stale = ageMs == null || ageMs > STALE_MS || !!pack.stale
  return {
    ...pack,
    live: false,
    stale: true,
    fromCache: true,
    cacheReason: reason,
    liveSource: pack.liveSource && !pack.live ? pack.liveSource : source,
    dataStatus: online ? 'cached' : 'offline',
    cachedAt: Date.now(),
    ageMs,
    // Preserve original observation time
    fetchedAt: pack.fetchedAt || Date.now(),
  }
}

/**
 * Annotate successful live pack.
 */
export function markPackLive(pack, source = 'open-meteo') {
  if (!pack) return null
  return {
    ...pack,
    live: true,
    stale: false,
    fromCache: false,
    demo: false,
    synthetic: false,
    cacheReason: null,
    liveSource: source || pack.liveSource || 'open-meteo',
    dataStatus: 'live',
    ageMs: 0,
    fetchedAt: pack.fetchedAt || Date.now(),
  }
}

/** Should we skip idle multi-city prefetch? */
export function shouldSkipPrefetch(net = getNetworkSnapshot()) {
  return net.coreOnly || net.slow || !net.online
}

/** Should Climate charts / heavy tabs defer load? */
export function shouldDeferHeavyUI(net = getNetworkSnapshot()) {
  return net.coreOnly || net.saveData
}

/** Shorter timeouts on weak net */
export function fetchTimeoutMs(baseMs = 8000, net = getNetworkSnapshot()) {
  if (!net.online) return Math.min(baseMs, 2500)
  if (net.coreOnly) return Math.min(baseMs, 4500)
  if (net.slow) return Math.min(baseMs, 6000)
  return baseMs
}
