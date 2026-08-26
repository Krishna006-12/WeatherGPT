import {
  detectCrop,
  isCropToken,
  isCropQuestion,
  isCropFollowUp,
} from '../src/data/crops.js'
import {
  resolveMentionedCity,
  detectIntent,
  chat,
} from '../src/services/ai.js'
import { searchCities } from '../src/services/geocode.js'

const fakeWx = {
  city: { id: 'kanpur', name: 'Kanpur', name_hi: 'कानपुर', lat: 26.4, lon: 80.3 },
  fetchedAt: Date.now(),
  live: true,
  current: {
    temp: 29,
    feelsLike: 31,
    wind: 12,
    humidity: 70,
    condition: 'Thunderstorm',
    condition_hi: 'तूफान',
    code: 95,
  },
  daily: [
    {
      pop: 42,
      rain: 3.2,
      max: 31,
      min: 24,
      wind: 14,
      condition: 'Stormy',
      condition_hi: 'तूफ़ानी',
      weekday: 'Wed',
      weekday_hi: 'बुध',
      date: '2026-08-26',
    },
    {
      pop: 28,
      rain: 1.0,
      max: 32,
      min: 25,
      wind: 10,
      condition: 'Clouds',
      condition_hi: 'बादल',
      weekday: 'Thu',
      weekday_hi: 'गुरु',
      date: '2026-08-27',
    },
  ],
  hourly: [],
  alerts: [],
  agri: {
    recentRain: 4,
    forecastRain: 8,
    soil: { en: 'Medium', hi: 'मध्यम', level: 'medium' },
    advice_en: 'Defer heavy irrigation if rain holds.',
    advice_hi: 'बारिश रहे तो भारी सिंचाई टालें।',
    sprayWindow: { en: 'Limited', hi: 'सीमित' },
    crops: ['wheat', 'rice'],
  },
  sources: [{ name: 'Open-Meteo', role: 'test' }],
}

const crops = [
  'wheat',
  'rice',
  'maize',
  'cotton',
  'potato',
  'sugarcane',
  'mustard',
  'tomato',
  'barley',
  'mango',
]

console.log('=== Entity: crop only ===')
for (const c of crops) {
  const r = await resolveMentionedCity(c, null)
  const intent = detectIntent(c)
  const ans = await chat(c, { weather: fakeWx, lang: 'en' })
  const bad =
    r != null ||
    intent !== 'crop' ||
    ans.type !== 'crop' ||
    /Weather summary/i.test(ans.text) ||
    ans.cityId !== 'kanpur'
  console.log(
    bad ? 'FAIL' : 'OK  ',
    c,
    '→',
    intent,
    ans.type,
    ans.cropId,
    'city',
    ans.cityId,
    r ? 'GEOCODED!' : ''
  )
  if (bad) console.log('   head:', ans.text?.slice(0, 120))
}

console.log('=== Crop + place ===')
for (const q of ['wheat in Kanpur', 'rice in Punjab', 'cotton in Gujarat']) {
  const ans = await chat(q, {
    weather: fakeWx,
    lang: 'en',
    fetchWeatherFor: async (city) => ({
      ...fakeWx,
      city: { ...city, name: city.name || 'Place' },
    }),
  })
  console.log(
    ans.type === 'crop' ? 'OK  ' : 'FAIL',
    q,
    '→',
    ans.type,
    ans.cropId,
    ans.text?.includes('Crop Intelligence') ? 'CI' : 'no-CI'
  )
}

console.log('=== Agri phrasings ===')
for (const q of [
  'will rain affect my wheat?',
  'should I irrigate my wheat tomorrow?',
  'is the weather good for wheat?',
  'how is rice affected by the current weather?',
]) {
  const ans = await chat(q, { weather: fakeWx, lang: 'en' })
  console.log(ans.type === 'crop' ? 'OK  ' : 'FAIL', q, '→', ans.type, ans.cropId)
}

console.log('=== Follow-up context ===')
{
  const a1 = await chat('wheat', { weather: fakeWx, lang: 'en' })
  const a2 = await chat('will rain affect it?', {
    weather: fakeWx,
    lang: 'en',
    cropContext: { cropId: a1.cropId, cityId: 'kanpur' },
  })
  const a3 = await chat('how about irrigation?', {
    weather: fakeWx,
    lang: 'en',
    cropContext: { cropId: 'wheat', cityId: 'kanpur' },
  })
  console.log(
    a2.type === 'crop' && a2.cropId === 'wheat' ? 'OK  ' : 'FAIL',
    'affect it →',
    a2.type,
    a2.cropId
  )
  console.log(
    a3.type === 'crop' && a3.cropId === 'wheat' ? 'OK  ' : 'FAIL',
    'irrigation →',
    a3.type,
    a3.cropId
  )
}

console.log('=== Normal weather (unchanged) ===')
for (const q of [
  'weather in Kanpur',
  'weather in Delhi',
  'forecast for Mumbai',
  'rain in Lucknow',
  'will it rain',
]) {
  const r = await resolveMentionedCity(q, null)
  const ans = await chat(q, {
    weather: fakeWx,
    lang: 'en',
    fetchWeatherFor: async (c) => ({ ...fakeWx, city: { ...fakeWx.city, ...c } }),
  })
  const ok = ans.type !== 'crop' && !/Crop Intelligence/i.test(ans.text || '')
  console.log(ok ? 'OK  ' : 'FAIL', q, '→', ans.type, 'place', r?.name || '—')
}

console.log('=== searchCities crops empty ===')
for (const c of ['wheat', 'potato', 'rice']) {
  const hits = await searchCities(c, { count: 5 })
  console.log(hits.length === 0 ? 'OK  ' : 'FAIL', c, hits.length, hits.map((h) => h.name).join(','))
}

console.log('=== rain must not match mustard rai ===')
console.log(detectCrop('will it rain') ? 'FAIL rain→crop' : 'OK  rain clean')
console.log(isCropFollowUp('will rain affect it?') ? 'OK  followup' : 'FAIL followup')
console.log(isCropQuestion('wheat') && !isCropQuestion('weather in Tokyo') ? 'OK  isCropQ' : 'FAIL isCropQ')

console.log('DONE')
