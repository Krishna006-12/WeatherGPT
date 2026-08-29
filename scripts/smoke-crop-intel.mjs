/**
 * Crop Intelligence smoke — detection, city separation, signals, chat answers.
 */
import {
  detectCrop,
  isCropToken,
  isCropQuestion,
  isCropFollowUp,
  getCropById,
} from '../src/data/crops.js'
import {
  classifyQuery,
  isCropRoute,
  isCropOnlyClassification,
} from '../src/services/queryClassify.js'
import {
  buildCropSignals,
  detectGrowthStage,
  formatCropSignalsMarkdown,
} from '../src/services/cropSignals.js'
import {
  resolveMentionedCity,
  detectIntent,
  chat,
  classifyUserQuery,
} from '../src/services/ai.js'

const fakeWx = {
  city: { id: 'kanpur', name: 'Kanpur', name_hi: 'कानपुर', lat: 26.4, lon: 80.3, tz: 'Asia/Kolkata' },
  timezone: 'Asia/Kolkata',
  fetchedAt: Date.now(),
  live: true,
  liveSource: 'test-fixture',
  source: 'test-fixture',
  current: {
    temp: 29,
    feelsLike: 31,
    wind: 12,
    humidity: 78,
    condition: 'Cloudy',
    condition_hi: 'बादल',
    code: 3,
  },
  daily: [
    {
      pop: 55,
      rain: 4.2,
      max: 31,
      min: 24,
      wind: 14,
      condition: 'Showers',
      condition_hi: 'बौछार',
      weekday: 'Fri',
      weekday_hi: 'शुक्र',
      date: '2026-08-29',
    },
    {
      pop: 35,
      rain: 1.0,
      max: 32,
      min: 25,
      wind: 10,
      condition: 'Clouds',
      condition_hi: 'बादल',
      weekday: 'Sat',
      weekday_hi: 'शनि',
      date: '2026-08-30',
    },
    { pop: 20, rain: 0, max: 33, min: 26, wind: 9, date: '2026-08-31' },
  ],
  hourly: Array.from({ length: 24 }, (_, h) => ({
    time: `2026-08-29T${String(h).padStart(2, '0')}:00`,
    temp: 28 + (h % 4),
    pop: 40 + (h % 20),
    rain: 0.1,
  })),
  alerts: [],
  agri: {
    recentRain: 6,
    forecastRain: 10,
    soil: { en: 'Medium', hi: 'मध्यम', level: 'medium' },
    advice_en: 'Defer heavy irrigation if rain holds.',
    advice_hi: 'बारिश रहे तो भारी सिंचाई टालें।',
  },
  sources: [{ name: 'Open-Meteo', role: 'test' }],
}

let failed = 0
function ok(name, cond, detail = '') {
  if (cond) console.log('  PASS', name, detail)
  else {
    failed++
    console.error('  FAIL', name, detail)
  }
}

console.log('=== detect + classify ===')
for (const c of ['wheat', 'rice', 'paddy', 'potato', 'mustard', 'maize', 'gehun', 'aloo', 'sarson']) {
  const d = detectCrop(c)
  ok(`detect ${c}`, !!d?.id, d?.id)
}

ok('paddy→rice', detectCrop('paddy')?.id === 'rice')
ok('unknown crop null', detectCrop('xyznotacrop123') == null)
ok('isCropToken wheat', isCropToken('wheat'))
ok('not crop token kanpur', !isCropToken('kanpur'))
ok('rain not crop (rai exact only)', !isCropToken('rain') && !detectCrop('rain tomorrow'))

const qWheat = classifyQuery('wheat')
ok('class crop only', qWheat.type === 'crop' && !qWheat.allowGeocode && qWheat.crop?.id === 'wheat')

const qLoc = classifyQuery('wheat in Kanpur')
ok(
  'class crop_location',
  qLoc.type === 'crop_location' && qLoc.locationQuery?.toLowerCase().includes('kanpur') && qLoc.allowGeocode,
  JSON.stringify(qLoc),
)

const qPaddy = classifyQuery('paddy irrigation advice')
ok('paddy crop route', isCropRoute(qPaddy) && qPaddy.crop?.id === 'rice')

const qFollow = classifyQuery('will rain affect it?', { cropId: 'wheat' })
ok('followup_crop', qFollow.type === 'followup_crop' && qFollow.crop?.id === 'wheat' && !qFollow.allowGeocode)

const qWeather = classifyQuery('weather in Kanpur')
ok('location weather not crop', qWeather.type === 'location_weather' && !qWeather.crop)

ok('isCropOnly', isCropOnlyClassification(qWheat))
ok('stage flowering', detectGrowthStage('wheat at flowering stage')?.stage === 'flowering')

console.log('=== signals engine ===')
const crops = ['wheat', 'rice', 'potato', 'mustard', 'maize']
for (const id of crops) {
  const b = buildCropSignals({ crop: getCropById(id), weather: fakeWx, userText: id, lang: 'en' })
  ok(`${id} ok`, b.ok && b.engine === 'weathergpt.crop_signals.v1')
  ok(`${id} has 7 signals`, Object.keys(b.signals).length >= 7)
  ok(`${id} irrigation`, !!b.signals.irrigation?.level)
  ok(`${id} rainfall`, !!b.signals.rainfall_risk?.level)
  ok(`${id} disease`, !!b.signals.disease_fungal?.level)
  ok(`${id} spraying`, !!b.signals.spraying?.level)
  ok(`${id} harvest`, !!b.signals.harvest?.level)
  ok(`${id} sowing`, !!b.signals.sowing?.level)
  ok(`${id} heat`, !!b.signals.heat_cold_stress?.level)
  ok(`${id} no guarantee wording in honesty`, /not guarantee|garanteed|गारंटी|Not guaranteed/i.test(b.honesty + b.limitations.join(' ')))
  ok(`${id} weather inputs`, b.weather_inputs.temp_c === 29 && b.weather_inputs.pop_pct === 55)
  const md = formatCropSignalsMarkdown(b, 'en')
  ok(`${id} markdown signals`, /Irrigation|Rainfall|Disease/i.test(md.sections.map((x) => x.body).join(' ')))
}

const unk = buildCropSignals({ crop: null, weather: fakeWx, userText: 'unknown-crop-xyz', lang: 'en' })
ok('unknown crop limited', !unk.crop?.has_catalog && unk.limitations.some((l) => /not recognised|generic/i.test(l)))

const noWx = buildCropSignals({ crop: getCropById('wheat'), weather: null, userText: 'wheat', lang: 'en' })
ok('no location weather', noWx.signals.irrigation.level === 'limited' && noWx.weather_inputs.has_weather === false)

// potato wet → disease elevated/high likely with humidity 78 + pop 55
const pot = buildCropSignals({ crop: getCropById('potato'), weather: fakeWx, userText: 'potato blight?' })
ok(
  'potato disease not low',
  ['moderate', 'elevated', 'high'].includes(pot.signals.disease_fungal.level),
  pot.signals.disease_fungal.level,
)
ok('disease limitation diagnosis', /not a diagnosis|May favour/i.test(JSON.stringify(pot.signals.disease_fungal)))

console.log('=== chat integration ===')
for (const c of crops) {
  const r = await resolveMentionedCity(c, null)
  const intent = detectIntent(c)
  const ans = await chat(c, { weather: fakeWx, lang: 'en' })
  const bad =
    r != null ||
    (intent !== 'crop' && intent !== 'agri') ||
    ans.type !== 'crop' ||
    /Weather summary/i.test(ans.text) ||
    ans.cityId !== 'kanpur' ||
    !ans.cropSignals?.signals?.irrigation
  ok(`chat ${c}`, !bad, `intent=${intent} type=${ans.type} crop=${ans.cropId} city=${ans.cityId}`)
  ok(`chat ${c} signals in text`, /Irrigation suitability|Rainfall risk|conf \d+%/i.test(ans.text))
}

const unkChat = await chat('xyznotacrop999', { weather: fakeWx, lang: 'en' })
// may be general weather — must NOT geocode as city via crop path
ok('unknown not crop type forced', unkChat.type !== 'crop' || !unkChat.cropId)

const follow = await chat('will rain affect it?', {
  weather: fakeWx,
  lang: 'en',
  cropContext: { cropId: 'wheat', cityId: 'kanpur' },
})
ok('follow-up crop', follow.type === 'crop' && follow.cropId === 'wheat', follow.cropId)

const noLoc = await chat('mustard', { weather: null, lang: 'en' })
ok('crop without weather pack', noLoc.type === 'crop' && /Limited data|not loaded|unavailable/i.test(noLoc.text))

// classifier export
ok('classifyUserQuery', classifyUserQuery('rice in Lucknow').type === 'crop_location')

// Hindi
const hi = await chat('गेहूँ', { weather: fakeWx, lang: 'hi' })
ok('hindi wheat', hi.type === 'crop' && hi.cropId === 'wheat' && /फसल/.test(hi.text))

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nALL crop-intel smokes passed')
