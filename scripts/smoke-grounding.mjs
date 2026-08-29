/**
 * Grounded AI architecture tests (no live LLM keys required)
 * node scripts/smoke-grounding.mjs
 */
import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const g = await import(pathToFileURL(join(root, 'api/_lib/grounding.js')).href)

const {
  buildVerifiedWeatherContext,
  isTrivialWeatherQuery,
  validateGroundedResponse,
  trivialDeterministicAnswer,
  findUngroundedNumbers,
  extractAllowedNumbers,
  claimsFakeOfficialWarning,
  GROUNDING_SCHEMA,
} = g

function assert(c, msg) {
  if (!c) throw new Error(msg)
}

const wx = {
  place: 'Kanpur',
  lat: 26.45,
  lon: 80.33,
  source: 'Open-Meteo',
  current: {
    temp_c: 28.4,
    feels_c: 32.1,
    humidity_pct: 78,
    wind_kmh: 12.5,
    weather_code: 61,
    precip_mm: 0.2,
  },
  daily: [
    { date: '2026-08-29', max_c: 33, min_c: 26, rain_mm: 4.5, pop_pct: 72, weather_code: 61 },
    { date: '2026-08-30', max_c: 32, min_c: 25, rain_mm: 1.0, pop_pct: 40, weather_code: 3 },
  ],
  hourly: [
    { time: '2026-08-29T10:00', temp: 29, pop: 60, rain: 0.1, code: 61 },
  ],
}

console.log('=== verified context schema ===')
const ctx = buildVerifiedWeatherContext(wx, { crop: 'wheat' })
assert(ctx.schema === GROUNDING_SCHEMA, 'schema')
assert(ctx.locked === true, 'locked')
assert(ctx.location.name === 'Kanpur', 'place')
assert(ctx.currentWeather.temperature_c === 28.4, 'temp')
assert(ctx.precipitation.today_probability_pct === 72, 'pop')
assert(ctx.cropContext.crop_id === 'wheat', 'crop')
assert(ctx.fingerprint, 'fingerprint')
console.log('✓ context', ctx.currentWeather.temperature_c, 'pop', ctx.precipitation.today_probability_pct)

console.log('=== trivial queries skip LLM ===')
for (const q of [
  'current temperature',
  'what is the humidity',
  'wind speed',
  'rain probability',
  'kitna temp hai',
  'sunrise',
]) {
  assert(isTrivialWeatherQuery(q), 'trivial: ' + q)
}
for (const q of [
  'should I irrigate wheat tomorrow',
  'travel risk to Delhi with kids',
  'explain crop impact of this rain for paddy',
  'multi-day outdoor wedding plan advice',
]) {
  assert(!isTrivialWeatherQuery(q), 'complex: ' + q)
}
console.log('✓ trivial vs complex routing')

console.log('=== trivial deterministic answer ===')
const ans = trivialDeterministicAnswer(ctx, 'what is the temperature', 'en')
assert(/28\.4/.test(ans), 'uses verified temp')
assert(/no LLM|rules/i.test(ans), 'marks rules')
console.log('✓ trivial answer grounded')

console.log('=== validation: good grounded text ===')
const good =
  'Kanpur is 28.4°C (feels 32.1°C), humidity 78%, wind 12.5 km/h. Today rain chance 72% and about 4.5 mm. Source: AI + verified Open-Meteo context.'
const vGood = validateGroundedResponse(good, ctx, { route: 'weather_crop', message: 'weather' })
assert(vGood.ok, 'good ok: ' + vGood.reason)
console.log('✓ good text passes')

console.log('=== hallucination-prone: invented numbers ===')
const bad =
  'Temperature will hit 47°C with 95% rain and 200 mm flood. IMD RED warning issued. Wind 80 km/h.'
const vBad = validateGroundedResponse(bad, ctx, { route: 'weather_crop', message: 'weather now' })
assert(!vBad.ok, 'should fail')
assert(
  vBad.reason === 'ungrounded_numbers' || vBad.reason === 'fake_official_warning',
  'reason ' + vBad.reason
)
console.log('✓ hallucinated numbers/official rejected:', vBad.reason, vBad.detail || '')

console.log('=== fake official without official alert ===')
assert(claimsFakeOfficialWarning('IMD official warning is active', ctx) === true, 'fake official')
const ctxOff = buildVerifiedWeatherContext(wx, {
  alerts: [{ kind: 'official', official: true, source: 'GDACS', title: 'Flood' }],
})
assert(claimsFakeOfficialWarning('GDACS official feed shows flood risk', ctxOff) === false, 'ok with official')
console.log('✓ official claim gate')

console.log('=== malformed AI response ===')
const mal = validateGroundedResponse('temp undefined NaN', ctx, { route: 'weather_crop', message: 'temp' })
assert(!mal.ok, 'malformed')
console.log('✓ malformed rejected:', mal.reason)

console.log('=== empty / short ===')
assert(!validateGroundedResponse('', ctx).ok, 'empty')
assert(!validateGroundedResponse('Hi.', ctx).ok, 'short')
console.log('✓ empty/short')

console.log('=== allowed number set ===')
const allowed = extractAllowedNumbers(ctx)
assert(allowed.has('28.4') || allowed.has('28'), 'temp allowed')
assert(allowed.has('72'), 'pop allowed')
const sus = findUngroundedNumbers('It is 99°C today', allowed)
assert(sus.length >= 1, '99 ungrounded')
console.log('✓ allowlist')

console.log('=== provider/quota failure path (deterministic fallback shape) ===')
// Simulate: no LLM — trivial path still works; complex would use deterministicAnswer in chat.js
const fallbackish = trivialDeterministicAnswer(ctx, 'humidity', 'en')
assert(/78%/.test(fallbackish), 'fallback humidity')
console.log('✓ fallback numbers still verified')

console.log('\nALL grounding smokes passed.')
