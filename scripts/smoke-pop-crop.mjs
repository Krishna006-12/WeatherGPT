import { calibratePop } from '../src/services/weather.js'
import { detectCrop, isCropToken, isCropQuestion } from '../src/data/crops.js'
import { resolveMentionedCity, detectIntent, chat } from '../src/services/ai.js'
import { searchCities } from '../src/services/geocode.js'

console.log('=== POP calibrate ===')
const cases = [
  [99, 0, 2],
  [95, 0.05, 3],
  [90, 0.4, 51],
  [85, 1.5, 61],
  [80, 6, 63],
  [95, 40, 95],
  [40, 0, 1],
  [10, 0, 0],
]
for (const [p, mm, c] of cases) {
  console.log(`  raw=${p} mm=${mm} code=${c} → ${calibratePop(p, mm, c)}`)
}

console.log('=== Crop detect ===')
for (const t of ['wheat', 'Potato', 'gehun', 'आलू', 'rice spray', 'weather in Tokyo', 'Kanpur rain']) {
  console.log(`  "${t}" crop=${detectCrop(t)?.id || null} isCropQ=${isCropQuestion(t)} token=${isCropToken(t)}`)
}

console.log('=== Intent ===')
for (const t of ['wheat', 'potato advisory', 'will it rain', 'weather tokyo', 'gehun sinchai']) {
  console.log(`  "${t}" → ${detectIntent(t)}`)
}

console.log('=== resolveMentionedCity (should be null for crops) ===')
for (const t of ['wheat', 'potato', 'gehun', 'tokyo weather', 'noida']) {
  const r = await resolveMentionedCity(t, null)
  console.log(`  "${t}" → ${r ? r.name + ' (' + (r.countryCode || r.country || '?') + ')' : null}`)
}

console.log('=== searchCities crop (should be []) ===')
for (const t of ['wheat', 'potato', 'gehun']) {
  const r = await searchCities(t, { count: 5 })
  console.log(`  "${t}" → ${r.length} hits`, r.map((x) => x.name).join(', '))
}

console.log('=== chat crop ===')
const fakeWx = {
  city: { id: 'kanpur', name: 'Kanpur', name_hi: 'कानपुर', lat: 26.4, lon: 80.3 },
  fetchedAt: Date.now(),
  live: true,
  current: { temp: 28, wind: 10, condition: 'Partly cloudy', condition_hi: 'आंशिक बादल', humidity: 60 },
  daily: [
    { pop: 35, rain: 1.2, max: 32, min: 24, wind: 12, condition: 'Clouds', condition_hi: 'बादल', weekday: 'Wed', weekday_hi: 'बुध' },
    { pop: 20, rain: 0.2, max: 33, min: 25, wind: 10, condition: 'Clear', condition_hi: 'साफ', weekday: 'Thu', weekday_hi: 'गुरु' },
  ],
  hourly: [],
  agri: {
    recentRain: 2,
    forecastRain: 5,
    soil: { en: 'Medium', hi: 'मध्यम', level: 'medium' },
    advice_en: 'Light irrigation if stress.',
    advice_hi: 'तनाव पर हल्की सिंचाई।',
    sprayWindow: { en: 'OK morning', hi: 'सुबह OK' },
    crops: ['wheat', 'rice'],
  },
  sources: [],
}
const ans = await chat('wheat', { weather: fakeWx, lang: 'en' })
console.log('  type', ans.type, 'cropId', ans.cropId, 'cityId', ans.cityId)
console.log('  text head:', (ans.text || '').slice(0, 200).replace(/\n/g, ' | '))

const ans2 = await chat('potato', { weather: fakeWx, lang: 'hi' })
console.log('  hi type', ans2.type, 'crop', ans2.cropId, 'cityId', ans2.cityId)

const ans3 = await chat('weather in Tokyo', {
  weather: { ...fakeWx, alerts: [] },
  lang: 'en',
  fetchWeatherFor: async () => ({ ...fakeWx, alerts: [] }),
})
console.log('  tokyo intent path type', ans3.type, 'cityId', ans3.cityId)

const ans4 = await chat('will it rain', { weather: { ...fakeWx, alerts: [] }, lang: 'en' })
console.log('  rain type', ans4.type, 'intent', ans4.intent)

console.log('OK')
