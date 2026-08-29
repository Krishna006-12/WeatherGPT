/**
 * Performance utilities smoke — no network required for unit checks.
 * Optional: LIVE=1 hits Open-Meteo once for coalesce proof.
 */
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

// Node can't import browser-oriented modules with bare fetch easily under vite aliases —
// dynamic import of perf.js (pure) works.
const perfUrl = pathToFileURL(path.join(root, 'src/services/perf.js')).href

const {
  createTtlCache,
  createInflight,
  getPerfSnapshot,
  setInitialPaintMs,
  perfMark,
  perfTime,
  raceFirstOk,
} = await import(perfUrl)

let failed = 0
function ok(name, cond, detail = '') {
  if (cond) console.log('  PASS', name, detail)
  else {
    failed++
    console.error('  FAIL', name, detail)
  }
}

console.log('=== smoke-perf ===')

// TTL cache
const c = createTtlCache({ name: 't', defaultTtlMs: 50 })
c.set('a', { v: 1 })
ok('cache hit', c.get('a')?.v === 1)
ok('cache miss empty', c.get('missing') == null)
await new Promise((r) => setTimeout(r, 60))
ok('cache expire', c.get('a', 50) == null)
c.set('a', 2)
ok('peek ignores ttl', c.peek('a') === 2)

// Inflight coalesce
const inf = createInflight()
let runs = 0
const p1 = inf.run('k', async () => {
  runs++
  await new Promise((r) => setTimeout(r, 30))
  return 42
})
const p2 = inf.run('k', async () => {
  runs++
  return 99
})
const [a, b] = await Promise.all([p1, p2])
ok('coalesce same result', a === 42 && b === 42)
ok('coalesce single run', runs === 1, `runs=${runs}`)

// raceFirstOk
const raced = await raceFirstOk([
  async () => {
    await new Promise((r) => setTimeout(r, 40))
    return 'slow'
  },
  async () => {
    await new Promise((r) => setTimeout(r, 5))
    return 'fast'
  },
])
ok('race first ok', raced === 'fast')

const empty = await raceFirstOk([
  async () => null,
  async () => {
    await new Promise((r) => setTimeout(r, 5))
    return 'x'
  },
]).catch((e) => e)
ok('race skips null', empty === 'x')

// snapshot
setInitialPaintMs(123)
perfMark('test_mark', { n: 1 })
perfTime('weather_ms', 200)
perfTime('weather_ms', 100)
const snap = getPerfSnapshot()
ok('paint set', snap.initial_paint_ms === 123)
ok('latency avg', snap.latency_avg_ms.weather === 150, JSON.stringify(snap.latency_avg_ms))
ok('counters present', snap.counters.cache_hit >= 1 && snap.counters.coalesce_hit >= 1)

// Optional live coalesce on weather (Open-Meteo)
if (process.env.LIVE === '1') {
  console.log('--- LIVE weather coalesce ---')
  // Minimal inline fetch coalesce
  const liveInf = createInflight()
  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=26.45&longitude=80.33&current=temperature_2m&forecast_days=1'
  const t0 = Date.now()
  const fetcher = () =>
    liveInf.run('live-wx', async () => {
      const res = await fetch(url)
      const j = await res.json()
      return j.current?.temperature_2m
    })
  const [t1, t2] = await Promise.all([fetcher(), fetcher()])
  const ms = Date.now() - t0
  ok('live temps', typeof t1 === 'number' && t1 === t2, `t=${t1}`)
  ok('live fast-ish', ms < 8000, `ms=${ms}`)
  const snap2 = getPerfSnapshot()
  ok('live coalesce counted', snap2.counters.coalesce_hit >= 1)
}

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nALL smoke-perf passed')
console.log('snapshot', JSON.stringify(getPerfSnapshot(), null, 2))
