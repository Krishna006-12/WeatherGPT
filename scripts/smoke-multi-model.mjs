/**
 * Smoke: multi-model engine (direct import of api/_lib — no Vite)
 * Run: node scripts/smoke-multi-model.mjs
 */
import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mmUrl = pathToFileURL(join(root, 'api/_lib/multiModel.js')).href
const { aggregateMultiModel, normalizeObservation, MODEL_CATALOG, fetchOneModel } = await import(mmUrl)

const places = [
  { name: 'Kanpur', lat: 26.4499, lon: 80.3319 },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
]

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

console.log('Catalog:', MODEL_CATALOG.map((m) => m.id).join(', '))

// Schema unit
const obs = normalizeObservation(
  { name: 'Test', lat: 1, lon: 2 },
  '2026-08-29T12:00',
  {
    temperature: 30.44,
    apparent_temperature: 33.1,
    precipitation_probability: 55,
    precipitation: 1.2,
    wind_speed: 12.2,
    wind_direction: 180,
    humidity: 70,
    cloud_cover: 40,
    weather_code: 61,
  },
  'gfs_seamless',
  { model_name: 'GFS', provider: 'NCEP', model_run_time: null }
)
assert(obs.source_model === 'gfs_seamless', 'source_model')
assert(obs.temperature === 30.4, 'temp round')
assert(obs.meta.model_run_time === null, 'no fake run time')
console.log('✓ normalizeObservation schema OK')

// Unavailable model
const bad = await fetchOneModel(26.45, 80.33, {
  id: 'not_a_real_model_xyz',
  name: 'Bad',
  short: 'BAD',
  family: 'x',
  provider: 'none',
  role: 'compare',
})
assert(bad.available === false && bad.ok === false, 'bad model unavailable')
assert(bad.current === null, 'no fake current')
console.log('✓ unavailable model → available:false, no fake data')

// Multi-location live
for (const p of places) {
  const t0 = Date.now()
  const bundle = await aggregateMultiModel(p.lat, p.lon, { name: p.name, tz: 'auto' })
  const ms = Date.now() - t0
  assert(bundle.schema === 'weathergpt.multi_model.v1', 'schema')
  assert(Array.isArray(bundle.models), 'models array')
  assert(bundle.models.length === MODEL_CATALOG.length, 'full catalog length')
  const ok = bundle.models.filter((m) => m.available)
  console.log(
    `\n${p.name}: mode=${bundle.multi_model_mode} available=${bundle.available_count}/${bundle.models.length} in ${ms}ms`
  )
  for (const m of bundle.models) {
    if (m.available) {
      assert(m.current?.source_model === m.id, `source_model ${m.id}`)
      assert(m.current?.temperature != null, `temp ${m.id}`)
      // AIFS may null POP — must not be a fake number
      if (m.id.includes('aifs')) {
        const pops = (m.hourly || []).slice(0, 12).map((h) => h.precipitation_probability)
        const allNull = pops.length && pops.every((v) => v == null)
        if (allNull) console.log(`  · ${m.short}: POP honestly null`)
      }
      console.log(
        `  ✓ ${m.short}: T=${m.current.temperature}° pop=${m.current.precipitation_probability ?? 'null'} wind=${m.current.wind_speed}`
      )
    } else {
      console.log(`  · ${m.short}: UNAVAILABLE (${m.error})`)
    }
  }
  if (ok.length === 1) {
    assert(bundle.multi_model_mode === 'single', 'single mode flag')
    assert(bundle.ensemble.single_model_only === true, 'single_model_only')
    assert(bundle.ensemble.is_consensus === false, 'no false consensus')
  }
  if (ok.length >= 2) {
    assert(bundle.multi_model_mode === 'multi', 'multi mode')
    assert(bundle.ensemble.spreadC != null || ok.every((m) => m.next24h?.temp_mean == null), 'spread or no temps')
  }
  assert(bundle.primary_observation == null || bundle.primary_observation.source_model, 'primary obs')
}

// Simulate total API failure path via absurd coords still should return structure
const emptyish = await aggregateMultiModel(999, 999, { name: 'Invalid', catalog: MODEL_CATALOG })
console.log(`\nAbsurd coords: mode=${emptyish.multi_model_mode} available=${emptyish.available_count}`)
// Open-Meteo may still return something for clamped coords — just ensure no throw + schema
assert(emptyish.schema === 'weathergpt.multi_model.v1', 'schema on edge')

console.log('\nALL multi-model smokes passed.')
