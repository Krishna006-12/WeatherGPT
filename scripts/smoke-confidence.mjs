/**
 * Deterministic Forecast Confidence Engine tests
 * node scripts/smoke-confidence.mjs
 */
import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const eng = await import(pathToFileURL(join(root, 'api/_lib/confidenceEngine.js')).href)
const mm = await import(pathToFileURL(join(root, 'api/_lib/multiModel.js')).href)

const {
  calculateForecastConfidence,
  exampleStrongPopAgreementInput,
  confidenceFromMultiModelBundle,
  spreadOf,
} = eng

function assert(c, msg) {
  if (!c) throw new Error(msg)
}

console.log('=== Confidence formula unit tests ===')

// 1) Strong POP agreement example → HIGH
const strongIn = exampleStrongPopAgreementInput()
const strong = calculateForecastConfidence(strongIn)
console.log('Strong POP example:', strong.score, strong.level)
assert(strong.score >= 75, 'strong agreement should be HIGH score ≥75')
assert(strong.level === 'HIGH', 'level HIGH')
assert(strong.modelAgreement.precipitation_probability.spread <= 8, 'POP spread tight')
assert(strong.meta.llm_decides === false, 'no LLM')
assert(strong.meta.random === false, 'no random')
// reproducibility
const strong2 = calculateForecastConfidence(strongIn)
assert(strong2.score === strong.score && strong2.level === strong.level, 'reproducible')
console.log('✓ strong multi-model POP agreement → HIGH + reproducible')

// 2) Large disagreement → lower score
const diverge = calculateForecastConfidence({
  models: [
    {
      id: 'a',
      short: 'A',
      available: true,
      ok: true,
      next24h: { temp_mean: 20, pop_max: 10, rain_sum: 0 },
      current: { temperature: 20, precipitation_probability: 10, wind_speed: 5 },
    },
    {
      id: 'b',
      short: 'B',
      available: true,
      ok: true,
      next24h: { temp_mean: 32, pop_max: 90, rain_sum: 40 },
      current: { temperature: 32, precipitation_probability: 90, wind_speed: 35 },
    },
  ],
  fetchedAt: strongIn.fetchedAt,
  nowMs: strongIn.nowMs,
  horizonHours: 24,
  live: true,
})
console.log('Diverge example:', diverge.score, diverge.level)
assert(diverge.score < strong.score, 'diverge score < strong')
assert(diverge.level === 'LOW' || diverge.level === 'MEDIUM', 'not high on diverge')
console.log('✓ large spread lowers confidence')

// 3) Single model cap
const single = calculateForecastConfidence({
  models: [
    {
      id: 'best_match',
      short: 'Blend',
      available: true,
      ok: true,
      next24h: { temp_mean: 28, pop_max: 50, rain_sum: 2 },
      current: { temperature: 28, precipitation_probability: 50, wind_speed: 10 },
    },
  ],
  fetchedAt: strongIn.fetchedAt,
  nowMs: strongIn.nowMs,
  live: true,
})
console.log('Single model:', single.score, single.level)
assert(single.score <= 62, 'single cap 62')
assert(single.level !== 'HIGH', 'single never HIGH')
assert(single.reasons.some((r) => /single-model/i.test(r)), 'reason mentions single')
console.log('✓ single-model capped, never HIGH')

// 4) No models
const none = calculateForecastConfidence({ models: [], live: true })
assert(none.score === 0 && none.level === 'LOW', 'no models → 0')
console.log('✓ no models → score 0')

// 5) Null-safe POP (AIFS missing)
const nullPop = calculateForecastConfidence({
  models: [
    {
      id: 'ecmwf',
      available: true,
      ok: true,
      next24h: { temp_mean: 27, pop_max: 80, rain_sum: 5 },
      current: { temperature: 27, precipitation_probability: 80, wind_speed: 8 },
    },
    {
      id: 'gfs',
      available: true,
      ok: true,
      next24h: { temp_mean: 27.2, pop_max: 78, rain_sum: 4.5 },
      current: { temperature: 27, precipitation_probability: 78, wind_speed: 9 },
    },
    {
      id: 'aifs',
      available: true,
      ok: true,
      next24h: { temp_mean: 27.1, pop_max: null, rain_sum: 5 },
      current: { temperature: 27, precipitation_probability: null, wind_speed: 8.5 },
    },
  ],
  fetchedAt: strongIn.fetchedAt,
  nowMs: strongIn.nowMs,
  live: true,
})
assert(nullPop.modelAgreement.precipitation_probability.count === 2, 'null POP excluded')
assert(Number.isFinite(nullPop.score), 'score finite with nulls')
console.log('✓ null POP handled; count=2 models with POP')

// 6) Offline cap
const off = calculateForecastConfidence({
  ...strongIn,
  live: false,
})
assert(off.score <= 40, 'offline cap')
console.log('✓ offline cap ≤40')

// 7) Horizon penalty
const far = calculateForecastConfidence({
  ...strongIn,
  horizonHours: 120,
})
assert(far.score < strong.score, 'long horizon lowers score')
console.log('✓ horizon 120h lowers score')

// 8) Stale data
const stale = calculateForecastConfidence({
  ...strongIn,
  fetchedAt: strongIn.nowMs - 20 * 60 * 60 * 1000,
})
assert(stale.score < strong.score, 'stale lowers')
console.log('✓ stale data lowers score')

// 9) spreadOf helper
assert(spreadOf([81, 76, 80, 78]) === 5, 'POP spread 5')
assert(spreadOf([1]) === null, 'single value no spread')
assert(spreadOf([null, 1, null]) === null, 'one finite no spread')
console.log('✓ spreadOf null-safe')

// 10) Live multi-model attach via aggregate
const live = await mm.aggregateMultiModel(26.45, 80.33, {
  name: 'Kanpur',
  nowMs: Date.now(),
})
assert(live.confidence && live.confidence.engine === 'weathergpt.confidence.v1', 'live conf')
assert(typeof live.confidence.score === 'number', 'score number')
assert(['HIGH', 'MEDIUM', 'LOW'].includes(live.confidence.level), 'level enum')
assert(Array.isArray(live.confidence.reasons), 'reasons')
assert(live.confidence.modelAgreement, 'modelAgreement')
console.log(
  '✓ live Kanpur confidence:',
  live.confidence.score,
  live.confidence.level,
  'models',
  live.available_count
)

// 11) confidenceFromMultiModelBundle
const again = confidenceFromMultiModelBundle(live, { nowMs: Date.now() })
assert(again.score === live.confidence.score || Math.abs(again.score - live.confidence.score) <= 2, 'bundle helper ~same (freshness may tick)')

console.log('\nALL confidence smokes passed.')
console.log('\nExample strong output:')
console.log(JSON.stringify({ score: strong.score, level: strong.level, reasons: strong.reasons, modelAgreement: {
  precipitation_probability: strong.modelAgreement.precipitation_probability,
  temperature: { spread: strong.modelAgreement.temperature.spread, values: strong.modelAgreement.temperature.values },
  agreementLevel: strong.modelAgreement.agreementLevel,
}}, null, 2))
