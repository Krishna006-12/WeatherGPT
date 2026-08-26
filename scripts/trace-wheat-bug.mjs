/**
 * End-to-end trace: what happens for "wheat"?
 * Stubs geocode + weather network to see if crop name leaks.
 */
const geocodeCalls = []
const weatherCalls = []
const recentPushes = []

// Monkey-patch fetch before imports that use it
const realFetch = globalThis.fetch
globalThis.fetch = async (url, opts) => {
  const u = String(url)
  if (u.includes('geocoding-api.open-meteo') || u.includes('/api/geocode') || u.includes('name=')) {
    geocodeCalls.push(u)
    console.log('[NET GEOCODE]', u.slice(0, 180))
  }
  if (u.includes('api.open-meteo.com/v1/forecast') || u.includes('/api/weather')) {
    weatherCalls.push(u)
    console.log('[NET WEATHER]', u.slice(0, 180))
  }
  return realFetch(url, opts)
}

import { resolveMentionedCity, detectIntent, chat, extractCityLocal } from '../src/services/ai.js'
import { searchCities, resolveCity } from '../src/services/geocode.js'
import { detectCrop, isCropQuestion, isCropToken } from '../src/data/crops.js'
import { findCityLocal } from '../src/data/cities.js'

const queries = ['wheat', 'rice', 'maize', 'cotton', 'potato', 'sugarcane', 'wheat in Kanpur', 'weather in Kanpur']

const fakeWx = {
  city: { id: 'kanpur', name: 'Kanpur', name_hi: 'कानपुर', lat: 26.4499, lon: 80.3319 },
  fetchedAt: Date.now(),
  live: true,
  current: { temp: 30, feelsLike: 32, wind: 12, humidity: 70, condition: 'Thunderstorm with hail', condition_hi: 'ओला', code: 96 },
  daily: [
    { pop: 40, rain: 2, max: 32, min: 24, wind: 12, condition: 'Storm', condition_hi: 'तूफान', weekday: 'Wed', weekday_hi: 'बुध', date: '2026-08-26' },
    { pop: 20, rain: 0.5, max: 33, min: 25, wind: 10, condition: 'Clouds', condition_hi: 'बादल', weekday: 'Thu', weekday_hi: 'गुरु', date: '2026-08-27' },
  ],
  hourly: [],
  alerts: [],
  agri: {
    recentRain: 2, forecastRain: 5,
    soil: { en: 'Medium', hi: 'मध्यम', level: 'medium' },
    advice_en: 'ok', advice_hi: 'ok',
    sprayWindow: { en: 'limited', hi: 'सीमित' },
    crops: ['wheat', 'rice'],
  },
  sources: [],
}

console.log('\n======== LAYER TRACE ========')
for (const q of queries) {
  geocodeCalls.length = 0
  weatherCalls.length = 0
  console.log('\n--- QUERY:', JSON.stringify(q), '---')
  console.log('1 detectCrop:', detectCrop(q)?.id || null)
  console.log('2 isCropQuestion:', isCropQuestion(q))
  console.log('3 isCropToken bare:', isCropToken(q))
  console.log('4 detectIntent:', detectIntent(q))
  console.log('5 findCityLocal:', findCityLocal(q)?.name || null)

  const mentioned = await resolveMentionedCity(q, null)
  console.log('6 resolveMentionedCity:', mentioned ? `${mentioned.name} (${mentioned.lat},${mentioned.lon}) id=${mentioned.id}` : null)

  const search = await searchCities(q, { count: 5 })
  console.log('7 searchCities hits:', search.map(c => `${c.name}/${c.countryCode}`).join(' | ') || '(empty)')

  const resolved = await resolveCity(q)
  console.log('8 resolveCity:', resolved ? `${resolved.name}` : null)

  // Simulate App fetchWeatherFor being called with mentioned
  let weatherTarget = null
  if (mentioned) {
    weatherTarget = `lat=${mentioned.lat}&lon=${mentioned.lon}&name=${mentioned.name}`
    console.log('9 WOULD call weather API with:', weatherTarget)
  } else {
    console.log('9 weather API: NOT called for place (stay current)')
  }

  const ans = await chat(q, {
    weather: fakeWx,
    lang: 'en',
    fetchWeatherFor: async (city) => {
      console.log('10 fetchWeatherFor CALLED with:', city?.name, city?.lat, city?.lon)
      weatherCalls.push(`fetchWeatherFor:${city?.name}`)
      // Return weather labeled with that city - if name is Wheat, bug visible
      return {
        ...fakeWx,
        city: { ...city, name: city.name },
        current: { ...fakeWx.current, temp: 15, condition: 'Clear sky' }, // screenshot had 15C
      }
    },
  })
  console.log('11 chat type:', ans.type, 'cropId:', ans.cropId, 'cityId:', ans.cityId)
  console.log('12 title line:', (ans.text || '').split('\n')[0])
  console.log('13 is Weather summary?:', /^##\s*☁️?\s*Weather summary/i.test(ans.text || '') || /Weather summary/i.test((ans.text||'').slice(0,80)))
  console.log('14 geocode net calls this query:', geocodeCalls.length, geocodeCalls.map(u => u.match(/name=([^&]+)/)?.[1]).join(','))
}

console.log('\n======== DONE ========')
