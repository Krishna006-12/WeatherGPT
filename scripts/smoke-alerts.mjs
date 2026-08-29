/**
 * Alert architecture smoke tests
 * node scripts/smoke-alerts.mjs
 */
import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const eng = await import(pathToFileURL(join(root, 'api/_lib/alertEngine.js')).href)

const {
  buildRiskSignalsFromForecast,
  buildAlertBundle,
  buildDemoRedAlert,
  gdacsToOfficialAlert,
  floodToRiskSignal,
  normalizeAlert,
  mergeAlertLists,
} = eng

function assert(c, msg) {
  if (!c) throw new Error(msg)
}

const city = { id: 'kanpur', name: 'Kanpur', name_hi: 'कानपुर', lat: 26.45, lon: 80.33 }
const now = Date.UTC(2026, 7, 29, 12, 0, 0)

console.log('=== 1) No alert (calm weather) ===')
const calm = buildRiskSignalsFromForecast(
  city,
  {
    precipitation_probability_max: [10, 15, 20],
    precipitation_sum: [0, 0, 1],
    wind_speed_10m_max: [12, 14, 10],
    weather_code: [1, 2, 1],
  },
  { weather_code: 1 },
  { nowMs: now }
)
assert(calm.length === 0, 'calm → no risk signals')
const emptyBundle = buildAlertBundle({ official: [], risk: calm, nowMs: now })
assert(emptyBundle.counts.total === 0, 'empty total')
assert(emptyBundle.official_sources_status.imd.integrated === false, 'IMD not integrated')
console.log('✓ no alert')

console.log('=== 2) Moderate weather risk (yellow) ===')
const mod = buildRiskSignalsFromForecast(
  city,
  {
    precipitation_probability_max: [60, 40, 30],
    precipitation_sum: [8, 2, 0],
    wind_speed_10m_max: [20, 15, 12],
    weather_code: [61, 3, 2],
  },
  { weather_code: 61 },
  { nowMs: now, confidence: { score: 70, level: 'MEDIUM' } }
)
assert(mod.length === 1, 'one yellow risk')
assert(mod[0].kind === 'risk_signal', 'kind risk')
assert(mod[0].official === false, 'not official')
assert(mod[0].severity === 'yellow', 'yellow')
assert(/NOT an official|आधिकारिक नहीं|WeatherGPT/i.test(mod[0].officialText + mod[0].disclaimer_en), 'disclaimer')
assert(mod[0].reason && mod[0].reason.length > 10, 'has reason')
assert(mod[0].confidence?.score === 70, 'confidence attached')
assert(!/IMD-style|IMD RED WARNING/i.test(mod[0].title + mod[0].officialText), 'no fake IMD voice in title/body core')
console.log('✓ moderate risk signal', mod[0].severity, mod[0].title)

console.log('=== 3) Severe weather (red) ===')
const sev = buildRiskSignalsFromForecast(
  city,
  {
    precipitation_probability_max: [90, 85, 70],
    precipitation_sum: [120, 40, 10],
    wind_speed_10m_max: [50, 40, 30],
    weather_code: [99, 95, 63],
  },
  { weather_code: 99 },
  { nowMs: now }
)
assert(sev.length === 1 && sev[0].severity === 'red', 'red risk')
assert(sev[0].kind === 'risk_signal', 'still risk not official')
assert(sev[0].thresholds, 'thresholds recorded')
console.log('✓ severe risk', sev[0].title)

console.log('=== 4) Missing official source (IMD never invented) ===')
const noOfficial = buildAlertBundle({
  official: [],
  risk: mod,
  nowMs: now,
})
assert(noOfficial.counts.official === 0, 'no official')
assert(noOfficial.official_sources_status.imd.available === false, 'imd unavailable')
assert(noOfficial.alerts.every((a) => a.kind !== 'official' || a.source.includes('GDACS')), 'no fake official')
// Attempt to force fake IMD official — engine must downgrade
const fakeImd = normalizeAlert(
  {
    id: 'fake-imd',
    severity: 'red',
    title: 'IMD RED WARNING Kanpur',
    source: 'IMD',
    official: true,
    kind: 'official',
    officialText: 'IMD RED WARNING: heavy rain',
  },
  { nowMs: now }
)
assert(fakeImd.kind === 'risk_signal', 'fake IMD downgraded to risk_signal')
assert(fakeImd.official === false, 'not official flag')
console.log('✓ missing official + fake IMD rejected')

console.log('=== 5) Multiple simultaneous risks — de-dupe + no contradiction ===')
const yellow = buildRiskSignalsFromForecast(
  city,
  {
    precipitation_probability_max: [60],
    precipitation_sum: [6],
    wind_speed_10m_max: [15],
    weather_code: [61],
  },
  { weather_code: 61 },
  { nowMs: now }
)
const amber = buildRiskSignalsFromForecast(
  city,
  {
    precipitation_probability_max: [85],
    precipitation_sum: [55],
    wind_speed_10m_max: [50],
    weather_code: [63],
  },
  { weather_code: 63 },
  { nowMs: now }
)
// Both precip family — merge should keep higher severity only
const multi = mergeAlertLists({
  risk: [...yellow, ...amber],
  nowMs: now,
})
assert(multi.length === 1, 'contradictory precip collapsed to 1')
assert(multi[0].severity === 'amber', 'kept amber over yellow')
console.log('✓ multi risk collapsed', multi[0].severity)

// Official GDACS + risk same family flood — official wins
const gdacs = gdacsToOfficialAlert(
  {
    id: 'gdacs-fl-1',
    severity: 'amber',
    source: 'GDACS',
    category: 'Flood',
    title: 'Flood alert (GDACS Orange)',
    summary: 'Flood event ~100 km',
    officialText: 'GDACS live flood',
    place: 'Kanpur',
  },
  { nowMs: now }
)
assert(gdacs.kind === 'official', 'GDACS official')
const floodRisk = floodToRiskSignal(
  {
    id: 'flood-model-1',
    severity: 'yellow',
    source: 'Open-Meteo Flood',
    category: 'River flood risk',
    title: 'Elevated discharge',
    summary: 'model',
    place: 'Kanpur',
  },
  { nowMs: now }
)
const mixed = mergeAlertLists({
  official: [gdacs],
  risk: [floodRisk, ...amber],
  nowMs: now,
})
const floods = mixed.filter((a) => a.hazard_family === 'flood')
assert(floods.length === 1 && floods[0].kind === 'official', 'official flood beats model flood')
assert(mixed.some((a) => a.hazard_family === 'precip'), 'precip risk still present')
console.log('✓ official vs risk same family → official wins; other families kept')

console.log('=== 6) Expired alert dropped ===')
const expired = normalizeAlert(
  {
    id: 'old-1',
    kind: 'risk_signal',
    severity: 'yellow',
    title: 'Old rain',
    source: 'WeatherGPT',
    valid_from: new Date(now - 48 * 3600000).toISOString(),
    valid_until: new Date(now - 1 * 3600000).toISOString(),
    place: 'Kanpur',
    category: 'Rain likely',
  },
  { nowMs: now }
)
assert(expired.expired === true, 'marked expired')
const dropped = mergeAlertLists({ risk: [expired, ...mod], nowMs: now })
assert(!dropped.find((a) => a.id === 'old-1'), 'expired not shown')
console.log('✓ expired filtered')

console.log('=== 7) Demo never official ===')
const demo = buildDemoRedAlert(city, { nowMs: now })
assert(demo.kind === 'demo' && demo.official === false, 'demo')
assert(/DEMO|सिमुलेशन|not official/i.test(demo.officialText + demo.disclaimer_en), 'demo disclaimer')
console.log('✓ demo')

console.log('=== 8) Bundle schema ===')
const bundle = buildAlertBundle({
  official: [gdacs],
  risk: amber,
  demo: [demo],
  nowMs: now,
})
assert(bundle.schema === 'weathergpt.alerts.v1', 'schema')
assert(bundle.alerts.length >= 2, 'has items')
assert(bundle.honesty?.en, 'honesty blurb')
console.log('✓ bundle', bundle.counts)

console.log('\nALL alert smokes passed.')
