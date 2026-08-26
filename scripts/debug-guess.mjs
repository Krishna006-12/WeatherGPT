// Inline copy of critical path with logs by importing and patching
import { isCropQuestion, detectCrop, isCropToken } from '../src/data/crops.js'
import { findCityLocal, CITIES, allKnownCities, CITY_ALIASES, normalizePlaceQuery } from '../src/data/cities.js'

const q = 'wheat in Kanpur'
console.log('isCropQ', isCropQuestion(q))
console.log('detectCrop', detectCrop(q)?.id)

// Manually test prep match
const m = q.match(/\b(?:in|at|for|near|around|of)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.']{1,48})/i)
console.log('prep match', m?.[1])

// extractCityLocal path
const lower = q.toLowerCase()
const pool = allKnownCities().slice().sort((a, b) => b.name.length - a.name.length)
for (const c of pool) {
  const name = c.name.toLowerCase()
  const nameRe = new RegExp(`(?:^|[^a-z\\u0900-\\u097f])${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?:[^a-z\\u0900-\\u097f]|$)`, 'i')
  if (nameRe.test(lower)) {
    console.log('extractCityLocal would hit', c.name, c.id)
    break
  }
}

// Why resolve fails - import extract via dynamic re-export
import { resolveMentionedCity } from '../src/services/ai.js'
// Force: does extractCityLocal get wheat as crop city from name "Wheat"?
console.log('find wheat as city name?', pool.filter(c => /wheat/i.test(c.name)).map(c => c.name))

// Test classifier
import { classifyQuery } from '../src/services/queryClassify.js'
console.log('classify', classifyQuery(q))
console.log('classify wheat', classifyQuery('wheat'))
console.log('classify weather kanpur', classifyQuery('weather in Kanpur'))
