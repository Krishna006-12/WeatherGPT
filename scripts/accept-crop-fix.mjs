import { classifyQuery, isCropRoute, isCropOnlyClassification } from '../src/services/queryClassify.js'
import { resolveMentionedCity, chat, detectCrop } from '../src/services/ai.js'
import { searchCities } from '../src/services/geocode.js'

const geocodeLeak = []
const realFetch = globalThis.fetch
globalThis.fetch = async (url, opts) => {
  const u = String(url)
  if (u.includes('geocoding') || u.includes('name=')) {
    const name = decodeURIComponent(u.match(/name=([^&]+)/)?.[1] || u.match(/q=([^&]+)/)?.[1] || '')
    geocodeLeak.push(name)
    // Fail loud if crop-only name geocoded
    if (/^(wheat|rice|maize|cotton|potato|sugarcane|mustard|tomato)$/i.test(name.trim())) {
      console.error('LEAK GEOCODE CROP:', name)
    }
  }
  if (u.includes('forecast') && /wheat|potato|rice/i.test(u)) {
    console.error('LEAK WEATHER URL', u.slice(0, 100))
  }
  return realFetch(url, opts)
}

const wx = {
  city: { id: 'kanpur', name: 'Kanpur', lat: 26.45, lon: 80.33, name_hi: 'कानपुर' },
  fetchedAt: Date.now(), live: true,
  current: { temp: 30, feelsLike: 32, wind: 12, humidity: 70, condition: 'Thunderstorm with hail', condition_hi: 'ओला', code: 96 },
  daily: [
    { pop: 45, rain: 4, max: 32, min: 24, wind: 14, condition: 'Storm', condition_hi: 'त', weekday: 'W', weekday_hi: 'ब', date: '2026-08-26' },
    { pop: 20, rain: 0, max: 33, min: 25, wind: 10, condition: 'C', condition_hi: 'ब', weekday: 'T', weekday_hi: 'ग', date: '2026-08-27' },
  ],
  hourly: [], alerts: [],
  agri: { recentRain: 2, forecastRain: 5, soil: { en: 'M', hi: 'म', level: 'medium' }, advice_en: 'a', advice_hi: 'a', sprayWindow: { en: 'x', hi: 'x' }, crops: ['wheat'] },
  sources: [],
}

async function simulateOnSend(raw, cropContext = null) {
  geocodeLeak.length = 0
  const classified = classifyQuery(raw, cropContext)
  const cropRoute = isCropRoute(classified)
  let targetCity = wx.city
  let targetWx = wx
  let recent = null

  if (cropRoute) {
    if (classified.locationQuery) {
      const mentioned = await resolveMentionedCity(raw, null)
      if (mentioned && !detectCrop(mentioned.name || '')) {
        targetCity = mentioned
        // weather would use mentioned lat/lon NOT crop name
      }
    }
    const result = await chat(raw, { weather: targetWx, lang: 'en', cropContext, classified })
    // never recent
    return { classified, result, recent, geocodeLeak: [...geocodeLeak], weatherPlace: targetCity.name }
  } else {
    const mentioned = await resolveMentionedCity(raw, null)
    if (mentioned && !detectCrop(mentioned.name || '')) {
      targetCity = mentioned
      recent = mentioned.name
    }
    const result = await chat(raw, { weather: { ...wx, city: targetCity }, lang: 'en', classified })
    return { classified, result, recent, geocodeLeak: [...geocodeLeak], weatherPlace: targetCity.name }
  }
}

let fails = 0
function check(name, cond, detail = '') {
  if (!cond) { fails++; console.log('FAIL', name, detail) }
  else console.log('OK  ', name, detail)
}

console.log('\n=== CROP ONLY ===')
for (const q of ['wheat','rice','maize','cotton','potato','sugarcane','mustard','tomato']) {
  const r = await simulateOnSend(q)
  check(q+':type', r.classified.type === 'crop', r.classified.type)
  check(q+':noGeocodeRaw', !r.geocodeLeak.some(x => /^(wheat|rice|maize|cotton|potato|sugarcane|mustard|tomato)$/i.test(x.trim())), r.geocodeLeak.join(','))
  check(q+':chatCrop', r.result.type === 'crop' && r.result.cropId, `${r.result.type}/${r.result.cropId}`)
  check(q+':title', /Crop Intelligence/i.test(r.result.text) && !/Weather summary — (Wheat|Rice|Maize|Cotton|Potato)/i.test(r.result.text), r.result.text?.split('\n')[0])
  check(q+':cityKanpur', r.result.cityId === 'kanpur' || r.weatherPlace === 'Kanpur', r.weatherPlace)
  check(q+':noRecent', r.recent == null, r.recent)
}

console.log('\n=== CROP + LOCATION ===')
for (const q of ['wheat in Kanpur', 'rice in Punjab', 'cotton in Gujarat']) {
  const r = await simulateOnSend(q)
  check(q+':class', r.classified.type === 'crop_location', r.classified.type + ' loc=' + r.classified.locationQuery)
  check(q+':chatCrop', r.result.type === 'crop', r.result.type)
  check(q+':notWeatherSummaryCrop', !/Weather summary — (Wheat|Rice|Cotton)/i.test(r.result.text||''))
}

console.log('\n=== NORMAL WEATHER ===')
for (const q of ['weather in Kanpur', 'weather in Delhi', 'forecast for Mumbai', 'rain in Lucknow']) {
  const r = await simulateOnSend(q)
  check(q+':notCrop', r.result.type !== 'crop', r.result.type)
  check(q+':hasPlace', !!r.classified.locationQuery || r.result.cityId, r.classified.locationQuery || r.result.cityId)
}

console.log('\n=== FOLLOW-UP ===')
{
  const a = await simulateOnSend('wheat')
  const b = await simulateOnSend('will rain affect it?', { cropId: 'wheat', cityId: 'kanpur' })
  check('followup', b.result.type === 'crop' && b.result.cropId === 'wheat', `${b.result.type}/${b.result.cropId}`)
}

console.log('\n=== searchCities bare crop ===')
for (const q of ['wheat','potato']) {
  const h = await searchCities(q)
  check('search '+q, h.length === 0, h.map(x=>x.name).join())
}

console.log(fails === 0 ? '\nALL PASSED' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
