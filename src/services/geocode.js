/**
 * Unlimited city search via Open-Meteo Geocoding (free, no key).
 * Filters tiny same-name villages (Dubai UP) so famous cities win.
 * Speech aliases + phrase cleanup: cities.js normalizePlaceQuery.
 */

import {
  CITIES,
  CITY_LIST,
  registerCity,
  findCityLocal,
  normalizePlaceQuery,
} from '../data/cities.js'
import { isCropToken, detectCrop, allCropStopwords } from '../data/crops.js'

/** Blocklist: crop names must never become geocode hits / Recent cities */
const CROP_QUERY_RE = (() => {
  const words = allCropStopwords()
    .filter((w) => w && w.length >= 3)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // whole-query match for bare crop ("wheat", "potato", "gehun")
  return new RegExp(`^(?:${words.join('|')})$`, 'i')
})()

function isCropOnlyQuery(query) {
  const q = String(query || '')
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:]+$/g, '')
  if (!q) return false
  if (CROP_QUERY_RE.test(q)) return true
  if (isCropToken(q)) return true
  // single-token or "wheat crop" / "potato farming" style
  const parts = q.split(/\s+/).filter(Boolean)
  if (parts.length <= 3 && parts.every((p) => isCropToken(p) || /^(crop|farming|farm|cultivation|fasal|फसल|advice|advisory|sowing|harvest)$/i.test(p))) {
    return !!detectCrop(q)
  }
  return false
}

const GEO_DIRECT = 'https://geocoding-api.open-meteo.com/v1/search'
const searchCache = new Map()
const SEARCH_TTL = 15 * 60 * 1000 // shorter — ranking fixes ship faster

/** Hard locks for famous cities (must beat same-name villages) */
const WORLD_CITY_LOCK = {
  dubai: { countryCode: 'AE', minPop: 100000 },
  'abu dhabi': { countryCode: 'AE', minPop: 50000 },
  sharjah: { countryCode: 'AE', minPop: 50000 },
  london: { countryCode: 'GB', minPop: 100000 },
  paris: { countryCode: 'FR', minPop: 100000 },
  tokyo: { countryCode: 'JP', minPop: 100000 },
  singapore: { countryCode: 'SG', minPop: 50000 },
  'new york': { countryCode: 'US', minPop: 100000 },
  toronto: { countryCode: 'CA', minPop: 50000 },
  sydney: { countryCode: 'AU', minPop: 50000 },
  melbourne: { countryCode: 'AU', minPop: 50000 },
  moscow: { countryCode: 'RU', minPop: 100000 },
  beijing: { countryCode: 'CN', minPop: 100000 },
  shanghai: { countryCode: 'CN', minPop: 100000 },
  bangkok: { countryCode: 'TH', minPop: 50000 },
  'kuala lumpur': { countryCode: 'MY', minPop: 50000 },
  doha: { countryCode: 'QA', minPop: 50000 },
  riyadh: { countryCode: 'SA', minPop: 50000 },
  jeddah: { countryCode: 'SA', minPop: 50000 },
  'hong kong': { countryCode: 'HK', minPop: 50000 },
  seoul: { countryCode: 'KR', minPop: 100000 },
  berlin: { countryCode: 'DE', minPop: 100000 },
  madrid: { countryCode: 'ES', minPop: 100000 },
  rome: { countryCode: 'IT', minPop: 100000 },
  istanbul: { countryCode: 'TR', minPop: 100000 },
  cairo: { countryCode: 'EG', minPop: 100000 },
  lagos: { countryCode: 'NG', minPop: 100000 },
  nairobi: { countryCode: 'KE', minPop: 50000 },
  chicago: { countryCode: 'US', minPop: 100000 },
  'los angeles': { countryCode: 'US', minPop: 100000 },
  'san francisco': { countryCode: 'US', minPop: 50000 },
  washington: { countryCode: 'US', minPop: 100000 },
  boston: { countryCode: 'US', minPop: 50000 },
  miami: { countryCode: 'US', minPop: 50000 },
  vancouver: { countryCode: 'CA', minPop: 50000 },
  amsterdam: { countryCode: 'NL', minPop: 50000 },
  vienna: { countryCode: 'AT', minPop: 50000 },
  zurich: { countryCode: 'CH', minPop: 50000 },
  geneva: { countryCode: 'CH', minPop: 50000 },
  brussels: { countryCode: 'BE', minPop: 50000 },
  lisbon: { countryCode: 'PT', minPop: 50000 },
  athens: { countryCode: 'GR', minPop: 50000 },
  warsaw: { countryCode: 'PL', minPop: 50000 },
  prague: { countryCode: 'CZ', minPop: 50000 },
  budapest: { countryCode: 'HU', minPop: 50000 },
  stockholm: { countryCode: 'SE', minPop: 50000 },
  oslo: { countryCode: 'NO', minPop: 50000 },
  copenhagen: { countryCode: 'DK', minPop: 50000 },
  helsinki: { countryCode: 'FI', minPop: 50000 },
  dublin: { countryCode: 'IE', minPop: 50000 },
  edinburgh: { countryCode: 'GB', minPop: 50000 },
  manchester: { countryCode: 'GB', minPop: 50000 },
  birmingham: { countryCode: 'GB', minPop: 50000 },
  barcelona: { countryCode: 'ES', minPop: 100000 },
  munich: { countryCode: 'DE', minPop: 50000 },
  frankfurt: { countryCode: 'DE', minPop: 50000 },
  hamburg: { countryCode: 'DE', minPop: 50000 },
  milan: { countryCode: 'IT', minPop: 50000 },
  venice: { countryCode: 'IT', minPop: 50000 },
  florence: { countryCode: 'IT', minPop: 50000 },
  manila: { countryCode: 'PH', minPop: 50000 },
  jakarta: { countryCode: 'ID', minPop: 100000 },
  'ho chi minh': { countryCode: 'VN', minPop: 50000 },
  hanoi: { countryCode: 'VN', minPop: 50000 },
  taipei: { countryCode: 'TW', minPop: 50000 },
  osaka: { countryCode: 'JP', minPop: 100000 },
  kyoto: { countryCode: 'JP', minPop: 50000 },
  auckland: { countryCode: 'NZ', minPop: 50000 },
  'cape town': { countryCode: 'ZA', minPop: 50000 },
  johannesburg: { countryCode: 'ZA', minPop: 50000 },
  'mexico city': { countryCode: 'MX', minPop: 100000 },
  'buenos aires': { countryCode: 'AR', minPop: 100000 },
  'sao paulo': { countryCode: 'BR', minPop: 100000 },
  'rio de janeiro': { countryCode: 'BR', minPop: 100000 },
  lima: { countryCode: 'PE', minPop: 50000 },
  bogota: { countryCode: 'CO', minPop: 50000 },
  santiago: { countryCode: 'CL', minPop: 50000 },
  tehran: { countryCode: 'IR', minPop: 100000 },
  baghdad: { countryCode: 'IQ', minPop: 50000 },
  kuwait: { countryCode: 'KW', minPop: 50000 },
  muscat: { countryCode: 'OM', minPop: 50000 },
  manama: { countryCode: 'BH', minPop: 50000 },
  islamabad: { countryCode: 'PK', minPop: 50000 },
  karachi: { countryCode: 'PK', minPop: 100000 },
  lahore: { countryCode: 'PK', minPop: 100000 },
  dhaka: { countryCode: 'BD', minPop: 100000 },
  colombo: { countryCode: 'LK', minPop: 50000 },
  kathmandu: { countryCode: 'NP', minPop: 50000 },
}

/** Admin seats / capitals rank higher than plain villages */
const FEATURE_SCORE = {
  PPLC: 100, // capital
  PPLA: 80, // seat of first-order admin
  PPLA2: 55,
  PPLA3: 40,
  PPLA4: 30,
  PPL: 15, // populated place
  PPLX: 10,
  MT: 0, // mountain
  default: 5,
}

async function fetchGeocode(q, count, lang) {
  const errors = []
  try {
    const proxy =
      `/api/geocode?q=${encodeURIComponent(q)}&count=${count}&language=${encodeURIComponent(lang)}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(proxy, { signal: ctrl.signal, cache: 'no-cache' })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (data?.results) return data
    }
    errors.push('proxy ' + res.status)
  } catch (e) {
    errors.push('proxy ' + e.message)
  }
  const url =
    `${GEO_DIRECT}?name=${encodeURIComponent(q)}&count=${count}&language=${lang}&format=json`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, mode: 'cors', cache: 'no-cache' })
    clearTimeout(timer)
    if (!res.ok) throw new Error('geocode ' + res.status)
    return await res.json()
  } catch (e) {
    clearTimeout(timer)
    throw new Error(errors.concat(e.message).join(' | '))
  }
}

const REGION_BY_ADMIN = {
  'uttar pradesh': 'Indo-Gangetic Plain',
  bihar: 'Indo-Gangetic Plain',
  jharkhand: 'Indo-Gangetic Plain',
  'west bengal': 'Gangetic Delta',
  odisha: 'Eastern Coast',
  'tamil nadu': 'Coromandel Coast',
  kerala: 'Malabar Coast',
  karnataka: 'South Deccan',
  telangana: 'Deccan Plateau',
  'andhra pradesh': 'Deccan Plateau',
  maharashtra: 'Deccan Plateau',
  gujarat: 'Western Plains',
  rajasthan: 'Arid West',
  punjab: 'North Plains',
  haryana: 'North Plains',
  delhi: 'NCR',
  goa: 'Konkan Coast',
  assam: 'Northeast',
  'madhya pradesh': 'Central India',
  chhattisgarh: 'Central India',
}

const DEFAULT_CROPS = {
  'Indo-Gangetic Plain': ['wheat', 'rice', 'sugarcane', 'mustard'],
  'Gangetic Delta': ['rice', 'jute', 'potato', 'vegetables'],
  'Eastern Coast': ['rice', 'coconut', 'pulses'],
  'Coromandel Coast': ['rice', 'groundnut', 'sugarcane'],
  'Malabar Coast': ['rice', 'coconut', 'spices', 'rubber'],
  'South Deccan': ['ragi', 'coffee', 'vegetables'],
  'Deccan Plateau': ['cotton', 'soybean', 'sorghum', 'pulses'],
  'Western Plains': ['cotton', 'wheat', 'groundnut'],
  'Arid West': ['bajra', 'mustard', 'gram', 'wheat'],
  'North Plains': ['wheat', 'rice', 'maize'],
  NCR: ['wheat', 'mustard', 'vegetables'],
  'Konkan Coast': ['rice', 'mango', 'coconut'],
  Northeast: ['rice', 'tea', 'vegetables'],
  'Central India': ['wheat', 'soybean', 'gram', 'rice'],
  default: ['wheat', 'rice', 'vegetables', 'pulses'],
  International: ['—'],
}

function slugify(name, lat, lon) {
  const base = String(name || 'place')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const tag = `${Math.round(lat * 100)}_${Math.round(lon * 100)}`
  return `${base || 'place'}-${tag}`
}

function regionFor(admin1, countryCode) {
  if (countryCode && countryCode !== 'IN') return 'International'
  const key = (admin1 || '').toLowerCase()
  return REGION_BY_ADMIN[key] || 'default'
}

function cropsFor(region) {
  return DEFAULT_CROPS[region] || DEFAULT_CROPS.default
}

const CC_NAME = {
  AE: 'UAE',
  US: 'USA',
  GB: 'UK',
  IN: 'India',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  NP: 'Nepal',
  LK: 'Sri Lanka',
  CN: 'China',
  JP: 'Japan',
  SG: 'Singapore',
  TH: 'Thailand',
  MY: 'Malaysia',
  QA: 'Qatar',
  SA: 'Saudi Arabia',
  FR: 'France',
  DE: 'Germany',
  AU: 'Australia',
  CA: 'Canada',
  RU: 'Russia',
  HK: 'Hong Kong',
  KR: 'South Korea',
  ES: 'Spain',
  IT: 'Italy',
  TR: 'Turkey',
  EG: 'Egypt',
  NG: 'Nigeria',
  KE: 'Kenya',
  NL: 'Netherlands',
  AT: 'Austria',
  CH: 'Switzerland',
  BE: 'Belgium',
  PT: 'Portugal',
  GR: 'Greece',
  PL: 'Poland',
  CZ: 'Czechia',
  HU: 'Hungary',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  IE: 'Ireland',
  PH: 'Philippines',
  ID: 'Indonesia',
  VN: 'Vietnam',
  TW: 'Taiwan',
  NZ: 'New Zealand',
  ZA: 'South Africa',
  MX: 'Mexico',
  AR: 'Argentina',
  BR: 'Brazil',
  PE: 'Peru',
  CO: 'Colombia',
  CL: 'Chile',
  IR: 'Iran',
  IQ: 'Iraq',
  KW: 'Kuwait',
  OM: 'Oman',
  BH: 'Bahrain',
}

/** Map geocoding hit → our city object */
export function placeToCity(place) {
  const lat = place.latitude
  const lon = place.longitude
  const id = slugify(place.name, lat, lon)
  const region = regionFor(place.admin1, place.country_code)
  const country = place.country || ''
  const countryCode = place.country_code || ''
  const admin1 = place.admin1 || ''
  const feature = place.feature_code || ''
  const short = CC_NAME[countryCode] || country || countryCode

  let state = admin1 || country
  if (countryCode && countryCode !== 'IN') {
    if (!admin1 || admin1.toLowerCase() === String(place.name || '').toLowerCase()) {
      state = short
    } else {
      state = `${admin1}, ${short}`
    }
  }

  const name = place.name
  const name_hi = place.name_hi || (countryCode === 'IN' ? name : name)

  return {
    id,
    name,
    name_hi,
    state,
    state_hi: state,
    lat,
    lon,
    imdId: countryCode === 'IN' ? 'geo' : 'intl',
    region,
    crops: cropsFor(region),
    country: country || short,
    countryCode,
    countryShort: short,
    population: place.population || 0,
    feature,
    dynamic: true,
  }
}

function nameScore(name, q) {
  const n = (name || '').toLowerCase().trim()
  if (n === q) return 100
  if (n.startsWith(q)) return 70
  if (n.includes(q)) return 40
  // fuzzy start (Dubail vs Dubai)
  if (q.length >= 4 && n.startsWith(q.slice(0, Math.max(4, q.length - 1)))) return 25
  return 0
}

function cityScore(c, q, lock) {
  const pop = c.population || 0
  const feat = FEATURE_SCORE[c.feature] ?? FEATURE_SCORE.default
  const exact = nameScore(c.name, q)
  let s = exact * 20 + Math.log10(pop + 10) * 35 + feat

  if (lock) {
    if (c.countryCode === lock.countryCode && pop >= (lock.minPop || 0)) s += 5000
    else if (c.countryCode === lock.countryCode) s += 800
    // punish locked mismatches hard
    if (c.countryCode !== lock.countryCode) s -= 2000
  }

  // Capitals / admin seats of matching name
  if (exact >= 100 && (c.feature === 'PPLC' || c.feature === 'PPLA')) s += 400

  // Tiny villages with exact famous-looking names still lose on pop
  if (exact >= 100 && pop > 0 && pop < 5000) s -= 300
  if (exact >= 100 && pop === 0) s -= 500

  // Mountains etc.
  if (c.feature === 'MT' || c.feature === 'HLL') s -= 800

  return s
}

/**
 * Drop noise: same-name villages when a major city exists.
 * Generic — works for Dubai, Paris (keeps FR + big US), London (GB + CA), etc.
 */
function filterNoise(results, query) {
  if (!results.length) return results
  const q = (query || '').toLowerCase().trim()
  const lock = WORLD_CITY_LOCK[q]

  // Score & sort first
  const scored = results
    .map((c) => ({ c, s: cityScore(c, q, lock) }))
    .sort((a, b) => b.s - a.s)

  const best = scored[0]?.c
  const bestPop = best?.population || 0
  const bestExact = best && nameScore(best.name, q) >= 100

  let list = scored.map((x) => x.c)

  // 1) World lock: keep lock country first; only add other countries if pop is meaningful
  if (lock) {
    const locked = list.filter(
      (c) => c.countryCode === lock.countryCode && (c.population || 0) >= (lock.minPop || 0)
    )
    if (locked.length) {
      // Keep locked hits + other REAL cities (pop >= 50k or different exact admin cities)
      const others = list.filter((c) => {
        if (c.countryCode === lock.countryCode) return (c.population || 0) >= 10000
        // other countries: only if reasonably big OR different name
        const exact = nameScore(c.name, q) >= 100
        if (exact) return (c.population || 0) >= 50000
        return (c.population || 0) >= 100000
      })
      // Prefer lock city first
      const merged = []
      const seen = new Set()
      for (const c of [...locked, ...others]) {
        const k = `${c.countryCode}|${Math.round(c.lat * 20)}|${Math.round(c.lon * 20)}`
        if (seen.has(k)) continue
        seen.add(k)
        merged.push(c)
      }
      list = merged
    }
  }

  // 2) Generic: if top exact match is a major city (pop >= 100k), drop tiny same-name clones
  if (bestExact && bestPop >= 100000) {
    const floor = Math.max(8000, Math.floor(bestPop * 0.01)) // 1% of best or 8k
    list = list.filter((c) => {
      const exact = nameScore(c.name, q) >= 100
      if (!exact) return (c.population || 0) >= 20000 || nameScore(c.name, q) >= 70
      // exact name
      if ((c.population || 0) >= floor) return true
      // keep if admin capital feature even if pop missing
      if ((c.feature === 'PPLC' || c.feature === 'PPLA') && (c.population || 0) >= 20000) return true
      // drop village
      return false
    })
  }

  // 3) If best is medium city (>= 30k), drop near-zero pop exact clones
  if (bestExact && bestPop >= 30000) {
    list = list.filter((c) => {
      const exact = nameScore(c.name, q) >= 100
      if (!exact) return true
      return (c.population || 0) >= 5000 || c.feature === 'PPLC' || c.feature === 'PPLA'
    })
  }

  // 4) Dedupe: same name + same country → keep highest population only
  const byKey = new Map()
  for (const c of list) {
    const key = `${(c.name || '').toLowerCase()}|${c.countryCode || ''}`
    const prev = byKey.get(key)
    if (!prev || (c.population || 0) > (prev.population || 0)) byKey.set(key, c)
  }
  list = [...byKey.values()]

  // 5) Re-score final
  list.sort((a, b) => cityScore(b, q, lock) - cityScore(a, q, lock))

  // 6) Soft cap: if top is locked famous city, show top + at most 3 alternatives with pop>=20k
  if (lock && list[0]?.countryCode === lock.countryCode) {
    const head = list[0]
    const rest = list.slice(1).filter((c) => (c.population || 0) >= 20000).slice(0, 4)
    list = [head, ...rest]
  }

  return list
}

/**
 * Search any city worldwide.
 */
export async function searchCities(query, { count = 8, indiaOnly = false } = {}) {
  const raw = (query || '').trim()
  if (raw.length < 2) return []
  if (isChatNoiseQuery(raw)) return []
// Farmer crop names are not cities — empty results (no "Wheat US")
  if (isCropOnlyQuery(raw)) return []

  const q = normalizePlaceQuery(raw) || raw
  if (q.length < 2) return []
  if (isCropOnlyQuery(q)) return []

  const cacheKey = `v4|${q.toLowerCase()}|${count}|${indiaOnly}`
  const hit = searchCache.get(cacheKey)
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.results

  const ql = q.toLowerCase()
  const local = CITY_LIST.filter(
    (c) =>
      c.name.toLowerCase() === ql ||
      c.id === ql ||
      c.name.toLowerCase().startsWith(ql) ||
      (c.name_hi && c.name_hi.includes(raw)) ||
      (ql.length >= 4 && c.name.toLowerCase().includes(ql))
  ).slice(0, count)

  try {
    const lang = /[\u0900-\u097F]/.test(raw) ? 'hi' : 'en'
    // Fetch more raw hits so filter has room to drop villages
    const data = await fetchGeocode(q, Math.max(count * 2, 20), lang)
    let results = (data.results || []).map(placeToCity)

    if (indiaOnly) {
      results = results.filter((c) => c.countryCode === 'IN')
    }

    results = filterNoise(results, ql)
    // Drop geocode hits whose primary name is a crop token (Wheat, Potato Point, …)
    results = results.filter((c) => {
      const n = (c.name || '').toLowerCase().trim()
      const first = n.split(/\s+/)[0]
      if (isCropToken(n) || isCropToken(first)) return false
      if (detectCrop(n) && (c.population || 0) < 50000) return false
      return true
    })

    // Merge curated locals (only if they match query well)
    const merged = []
    const seen = new Set()
    const keyOf = (c) =>
      `${(c.name || '').toLowerCase()}|${c.countryCode || 'IN'}|${Math.round((c.lat || 0) * 10)}`

    for (const c of [...local, ...results]) {
      const k = keyOf(c)
      if (seen.has(k)) continue
      seen.add(k)
      registerCity(c)
      merged.push(c)
    }

    const final = filterNoise(merged, ql).slice(0, count)
    searchCache.set(cacheKey, { at: Date.now(), results: final })
    return final
  } catch (e) {
    console.warn('Geocode failed, local only:', e.message)
    const fallback = local.length
      ? local
      : CITY_LIST.filter((c) => c.name.toLowerCase().startsWith(ql)).slice(0, count)
    searchCache.set(cacheKey, { at: Date.now(), results: fallback })
    return fallback
  }
}

/**
 * Resolve free-text place → single best city.
 */

function isChatNoiseQuery(query) {
  const t = String(query || '')
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:]+$/g, '')
  if (!t) return true
  const noise = new Set(
    'hi hello hii hlo hola hey yo ok okay thanks thx bye gm gn sup lol yes no yeah help test what why how'.split(
      ' ',
    ),
  )
  if (noise.has(t)) return true
  if (/^(hlo+|h+i+|he+y+|ok+|sup+)$/i.test(t)) return true
  if (t.length <= 2) return true
  return false
}

export async function resolveCity(query) {
  if (!query) return null
  if (isChatNoiseQuery(query)) return null
  if (isCropOnlyQuery(query)) return null
  const cleaned = normalizePlaceQuery(query)
  if (!cleaned) return null
  if (isCropOnlyQuery(cleaned)) return null

  const local = findCityLocal(cleaned) || findCityLocal(query)
  if (local) return local
  if (CITIES[cleaned]) return CITIES[cleaned]

  const results = await searchCities(cleaned, { count: 8 })
  if (!results.length) return null

  const q = cleaned.toLowerCase().trim()
  const lock = WORLD_CITY_LOCK[q]

  if (lock) {
    const locked = results.find(
      (c) => c.countryCode === lock.countryCode && (c.population || 0) >= (lock.minPop || 0)
    )
    if (locked) return locked
  }

  const exact = results.find((c) => c.name.toLowerCase() === q)
  if (exact) return exact

  return results[0]
}

/** Reverse: nearest known / GPS pin */
export async function resolveCoords(lat, lon) {
  let best = CITY_LIST[0]
  let bestD = Infinity
  for (const c of CITY_LIST) {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  if (bestD < 0.25) return best

  try {
    const pin = {
      id: slugify(`near-${best.name}`, lat, lon),
      name: `Near ${best.name}`,
      name_hi: `${best.name_hi || best.name} के पास`,
      state: best.state,
      state_hi: best.state_hi || best.state,
      lat,
      lon,
      imdId: 'gps',
      region: best.region,
      crops: best.crops,
      country: 'India',
      countryCode: 'IN',
      countryShort: 'India',
      dynamic: true,
      gps: true,
    }
    registerCity(pin)
    return pin
  } catch {
    return best
  }
}

/** Clear search cache (tests / after deploy) */
export function clearGeocodeCache() {
  searchCache.clear()
}
