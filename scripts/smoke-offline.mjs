/**
 * Offline / cache / status smoke — no secrets.
 */
import { pathToFileURL } from 'url'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const netUrl = pathToFileURL(path.join(root, 'src/services/networkStatus.js')).href

const {
  deriveDataStatus,
  markPackCached,
  markPackLive,
  formatAge,
  packAgeMs,
  statusLabels,
  FRESH_MS,
  STALE_MS,
  getNetworkSnapshot,
  shouldSkipPrefetch,
  shouldDeferHeavyUI,
  fetchTimeoutMs,
} = await import(netUrl)

let failed = 0
function ok(name, cond, detail = '') {
  if (cond) console.log('  PASS', name, detail)
  else {
    failed++
    console.error('  FAIL', name, detail)
  }
}

console.log('=== smoke-offline ===')

const livePack = markPackLive(
  {
    city: { id: 'kanpur', name: 'Kanpur', lat: 26.45, lon: 80.33 },
    location: { id: 'kanpur', name: 'Kanpur', lat: 26.45, lon: 80.33 },
    current: { temp: 32 },
    hourly: [{ temp: 31 }],
    daily: [{ max: 34, min: 26 }],
    fetchedAt: Date.now(),
    source: 'open-meteo-direct',
  },
  'open-meteo-direct',
)

ok('live pack flags', livePack.live === true && livePack.stale === false && livePack.fromCache === false)
ok('live has location', livePack.location?.name === 'Kanpur')
ok('live has source', livePack.source === 'open-meteo-direct' || livePack.liveSource === 'open-meteo-direct')

const stLive = deriveDataStatus(livePack, { online: true, updating: false })
ok('status live', stLive.code === 'live' && stLive.live === true, stLive.code)

const cached = markPackCached(
  { ...livePack, fetchedAt: Date.now() - 10 * 60 * 1000 },
  { reason: 'idb', source: 'IndexedDB', online: true },
)
ok('cached never live', cached.live === false && cached.fromCache === true && cached.stale === true)
const stCached = deriveDataStatus(cached, { online: true })
ok('status cached', stCached.code === 'cached' && !stCached.live, stCached.code)

const stOff = deriveDataStatus(cached, { online: false })
ok('status offline', stOff.code === 'offline', stOff.code)

const stUpd = deriveDataStatus(cached, { online: true, updating: true })
ok('status updating', stUpd.code === 'updating', stUpd.code)

const demo = {
  current: { temp: 28 },
  fetchedAt: Date.now(),
  demo: true,
  synthetic: true,
  live: false,
  liveSource: 'offline-demo',
}
const stDemo = deriveDataStatus(demo, { online: false })
ok('demo not live', stDemo.live === false && stDemo.demo === true)

const old = markPackCached(
  { current: { temp: 1 }, fetchedAt: Date.now() - 2 * 60 * 60 * 1000 },
  { online: true },
)
const stOld = deriveDataStatus(old, { online: true })
ok('stale cached', stOld.stale === true && stOld.code === 'cached')

ok('formatAge min', /m|मि/.test(formatAge(5 * 60 * 1000, 'en')))
ok('FRESH < STALE', FRESH_MS < STALE_MS)
ok('labels', statusLabels('live', 'en') === 'Live' && statusLabels('offline', 'hi') === 'ऑफ़लाइन')

// Age helpers
ok('packAgeMs', packAgeMs({ fetchedAt: Date.now() - 1000 }) >= 1000)

// Timeouts shrink offline/weak (simulate via monkey — functions use navigator)
const tNormal = fetchTimeoutMs(8000, {
  online: true,
  slow: false,
  coreOnly: false,
  saveData: false,
  effectiveType: '4g',
})
const tWeak = fetchTimeoutMs(8000, {
  online: true,
  slow: true,
  coreOnly: true,
  saveData: true,
  effectiveType: '2g',
})
const tOff = fetchTimeoutMs(8000, {
  online: false,
  slow: true,
  coreOnly: true,
  saveData: false,
  effectiveType: '4g',
})
ok('timeout normal', tNormal === 8000, String(tNormal))
ok('timeout weak shorter', tWeak < tNormal, String(tWeak))
ok('timeout offline shorter', tOff <= tWeak, String(tOff))

ok(
  'skip prefetch offline',
  shouldSkipPrefetch({ online: false, slow: true, coreOnly: true, saveData: false }),
)
ok(
  'defer heavy 2g',
  shouldDeferHeavyUI({ online: true, coreOnly: true, saveData: false, effectiveType: '2g' }),
)
ok(
  'no defer 4g',
  !shouldDeferHeavyUI({
    online: true,
    coreOnly: false,
    saveData: false,
    effectiveType: '4g',
    slow: false,
  }),
)

// Fresh live must not become cached when online
const stFresh = deriveDataStatus(
  markPackLive({ current: { temp: 30 }, fetchedAt: Date.now() }, 'x'),
  { online: true },
)
ok('fresh stays live', stFresh.code === 'live')

// Expired live age → cached even if live flag still true
const agedLive = {
  ...markPackLive({ current: { temp: 30 }, fetchedAt: Date.now() - FRESH_MS - 1000 }, 'x'),
}
const stAged = deriveDataStatus(agedLive, { online: true })
ok('aged live → cached', stAged.code === 'cached' || stAged.live === false, stAged.code)

console.log('network snapshot (host)', getNetworkSnapshot())

if (process.env.LIVE === '1') {
  console.log('--- LIVE open-meteo then “offline” cache shape ---')
  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=26.45&longitude=80.33&current=temperature_2m&daily=temperature_2m_max&timezone=auto&forecast_days=1'
  const res = await fetch(url)
  const j = await res.json()
  const pack = markPackLive(
    {
      city: { id: 'kanpur', name: 'Kanpur', lat: 26.45, lon: 80.33 },
      location: { id: 'kanpur', lat: 26.45, lon: 80.33 },
      current: { temp: j.current?.temperature_2m },
      daily: [{ max: j.daily?.temperature_2m_max?.[0] }],
      fetchedAt: Date.now(),
    },
    'open-meteo-direct',
  )
  ok('live temp', typeof pack.current.temp === 'number', String(pack.current.temp))
  const asCache = markPackCached(pack, { reason: 'test', online: false })
  ok('as offline cached', asCache.live === false && deriveDataStatus(asCache, { online: false }).code === 'offline')
}

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nALL smoke-offline passed')
