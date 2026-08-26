import * as ai from '../src/services/ai.js'
// re-test resolve with logging by importing internals via chat path
import { resolveMentionedCity } from '../src/services/ai.js'
import { resolveCity, searchCities } from '../src/services/geocode.js'
import { findCityLocal, CITIES } from '../src/data/cities.js'

console.log('CITIES.kanpur', CITIES.kanpur?.name)
console.log('findCityLocal kanpur', findCityLocal('kanpur')?.name)
console.log('findCityLocal Kanpur', findCityLocal('Kanpur')?.name)
console.log('resolveCity Kanpur', await resolveCity('Kanpur').then(r=>r&&r.name))
console.log('resolveMentioned wheat in Kanpur', await resolveMentionedCity('wheat in Kanpur', null))
console.log('resolveMentioned in Kanpur', await resolveMentionedCity('in Kanpur', null))
console.log('resolveMentioned Kanpur', await resolveMentionedCity('Kanpur', null))
console.log('resolveMentioned weather in Kanpur', await resolveMentionedCity('weather in Kanpur', null))
