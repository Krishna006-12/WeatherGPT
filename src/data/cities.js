/**
 * Curated Indian cities + dynamic registry for unlimited search results.
 */

export const CITIES = {
  lucknow: {
    id: 'lucknow',
    name: 'Lucknow',
    name_hi: 'लखनऊ',
    state: 'Uttar Pradesh',
    state_hi: 'उत्तर प्रदेश',
    lat: 26.8467,
    lon: 80.9462,
    imdId: 42369,
    region: 'Indo-Gangetic Plain',
    crops: ['wheat', 'rice', 'sugarcane', 'mustard'],
    countryCode: 'IN',
  },
  kanpur: {
    id: 'kanpur',
    name: 'Kanpur',
    name_hi: 'कानपुर',
    state: 'Uttar Pradesh',
    state_hi: 'उत्तर प्रदेश',
    lat: 26.4499,
    lon: 80.3319,
    imdId: 42361,
    region: 'Indo-Gangetic Plain',
    crops: ['wheat', 'rice', 'potato', 'mustard'],
    countryCode: 'IN',
  },
  delhi: {
    id: 'delhi',
    name: 'New Delhi',
    name_hi: 'नई दिल्ली',
    state: 'Delhi',
    state_hi: 'दिल्ली',
    lat: 28.6139,
    lon: 77.209,
    imdId: 42182,
    region: 'NCR',
    crops: ['wheat', 'mustard', 'vegetables'],
    countryCode: 'IN',
  },
  mumbai: {
    id: 'mumbai',
    name: 'Mumbai',
    name_hi: 'मुंबई',
    state: 'Maharashtra',
    state_hi: 'महाराष्ट्र',
    lat: 19.076,
    lon: 72.8777,
    imdId: 43003,
    region: 'Konkan Coast',
    crops: ['rice', 'coconut', 'mango', 'vegetables'],
    countryCode: 'IN',
  },
  pune: {
    id: 'pune',
    name: 'Pune',
    name_hi: 'पुणे',
    state: 'Maharashtra',
    state_hi: 'महाराष्ट्र',
    lat: 18.5204,
    lon: 73.8567,
    imdId: 43014,
    region: 'Deccan Plateau',
    crops: ['sugarcane', 'onion', 'grapes', 'wheat'],
    countryCode: 'IN',
  },
  bengaluru: {
    id: 'bengaluru',
    name: 'Bengaluru',
    name_hi: 'बेंगलुरु',
    state: 'Karnataka',
    state_hi: 'कर्नाटक',
    lat: 12.9716,
    lon: 77.5946,
    imdId: 43295,
    region: 'South Deccan',
    crops: ['ragi', 'coffee', 'vegetables', 'flowers'],
    countryCode: 'IN',
  },
  chennai: {
    id: 'chennai',
    name: 'Chennai',
    name_hi: 'चेन्नई',
    state: 'Tamil Nadu',
    state_hi: 'तमिल नाडु',
    lat: 13.0827,
    lon: 80.2707,
    imdId: 43279,
    region: 'Coromandel Coast',
    crops: ['rice', 'groundnut', 'sugarcane'],
    countryCode: 'IN',
  },
  hyderabad: {
    id: 'hyderabad',
    name: 'Hyderabad',
    name_hi: 'हैदराबाद',
    state: 'Telangana',
    state_hi: 'तेलंगाना',
    lat: 17.385,
    lon: 78.4867,
    imdId: 43128,
    region: 'Deccan Plateau',
    crops: ['rice', 'cotton', 'maize', 'turmeric'],
    countryCode: 'IN',
  },
  kolkata: {
    id: 'kolkata',
    name: 'Kolkata',
    name_hi: 'कोलकाता',
    state: 'West Bengal',
    state_hi: 'पश्चिम बंगाल',
    lat: 22.5726,
    lon: 88.3639,
    imdId: 42809,
    region: 'Gangetic Delta',
    crops: ['rice', 'jute', 'potato', 'vegetables'],
    countryCode: 'IN',
  },
  jaipur: {
    id: 'jaipur',
    name: 'Jaipur',
    name_hi: 'जयपुर',
    state: 'Rajasthan',
    state_hi: 'राजस्थान',
    lat: 26.9124,
    lon: 75.7873,
    imdId: 42348,
    region: 'Arid West',
    crops: ['wheat', 'mustard', 'bajra', 'gram'],
    countryCode: 'IN',
  },
  ahmedabad: {
    id: 'ahmedabad',
    name: 'Ahmedabad',
    name_hi: 'अहमदाबाद',
    state: 'Gujarat',
    state_hi: 'गुजरात',
    lat: 23.0225,
    lon: 72.5714,
    imdId: 42647,
    region: 'Western Plains',
    crops: ['cotton', 'wheat', 'groundnut', 'cumin'],
    countryCode: 'IN',
  },
  patna: {
    id: 'patna',
    name: 'Patna',
    name_hi: 'पटना',
    state: 'Bihar',
    state_hi: 'बिहार',
    lat: 25.5941,
    lon: 85.1376,
    imdId: 42701,
    region: 'Indo-Gangetic Plain',
    crops: ['rice', 'wheat', 'maize', 'pulses'],
    countryCode: 'IN',
  },
  bhopal: {
    id: 'bhopal',
    name: 'Bhopal',
    name_hi: 'भोपाल',
    state: 'Madhya Pradesh',
    state_hi: 'मध्य प्रदेश',
    lat: 23.2599,
    lon: 77.4126,
    imdId: 42667,
    region: 'Central India',
    crops: ['wheat', 'soybean', 'gram', 'rice'],
    countryCode: 'IN',
  },
  chandigarh: {
    id: 'chandigarh',
    name: 'Chandigarh',
    name_hi: 'चंडीगढ़',
    state: 'Chandigarh',
    state_hi: 'चंडीगढ़',
    lat: 30.7333,
    lon: 76.7794,
    imdId: 42105,
    region: 'North Plains',
    crops: ['wheat', 'rice', 'maize'],
    countryCode: 'IN',
  },
  varanasi: {
    id: 'varanasi',
    name: 'Varanasi',
    name_hi: 'वाराणसी',
    state: 'Uttar Pradesh',
    state_hi: 'उत्तर प्रदेश',
    lat: 25.3176,
    lon: 82.9739,
    imdId: 42483,
    region: 'Indo-Gangetic Plain',
    crops: ['rice', 'wheat', 'sugarcane', 'pulses'],
    countryCode: 'IN',
  },
  agra: {
    id: 'agra',
    name: 'Agra',
    name_hi: 'आगरा',
    state: 'Uttar Pradesh',
    state_hi: 'उत्तर प्रदेश',
    lat: 27.1767,
    lon: 78.0081,
    imdId: 42260,
    region: 'Indo-Gangetic Plain',
    crops: ['wheat', 'mustard', 'potato'],
    countryCode: 'IN',
  },
  indore: {
    id: 'indore',
    name: 'Indore',
    name_hi: 'इंदौर',
    state: 'Madhya Pradesh',
    state_hi: 'मध्य प्रदेश',
    lat: 22.7196,
    lon: 75.8577,
    imdId: 42754,
    region: 'Central India',
    crops: ['wheat', 'soybean', 'gram'],
    countryCode: 'IN',
  },
  nagpur: {
    id: 'nagpur',
    name: 'Nagpur',
    name_hi: 'नागपुर',
    state: 'Maharashtra',
    state_hi: 'महाराष्ट्र',
    lat: 21.1458,
    lon: 79.0882,
    imdId: 42867,
    region: 'Deccan Plateau',
    crops: ['cotton', 'orange', 'soybean'],
    countryCode: 'IN',
  },
  surat: {
    id: 'surat',
    name: 'Surat',
    name_hi: 'सूरत',
    state: 'Gujarat',
    state_hi: 'गुजरात',
    lat: 21.1702,
    lon: 72.8311,
    imdId: 42840,
    region: 'Western Plains',
    crops: ['cotton', 'sugarcane', 'vegetables'],
    countryCode: 'IN',
  },
  coimbatore: {
    id: 'coimbatore',
    name: 'Coimbatore',
    name_hi: 'कोयंबटूर',
    state: 'Tamil Nadu',
    state_hi: 'तमिल नाडु',
    lat: 11.0168,
    lon: 76.9558,
    imdId: 43321,
    region: 'South Deccan',
    crops: ['coconut', 'cotton', 'vegetables'],
    countryCode: 'IN',
  },
  noida: {
    id: 'noida',
    name: 'Noida',
    name_hi: 'नोएडा',
    state: 'Uttar Pradesh',
    state_hi: 'उत्तर प्रदेश',
    lat: 28.5355,
    lon: 77.391,
    imdId: 'geo',
    region: 'NCR',
    crops: ['wheat', 'mustard', 'vegetables'],
    countryCode: 'IN',
  },
  ghaziabad: {
    id: 'ghaziabad',
    name: 'Ghaziabad',
    name_hi: 'गाज़ियाबाद',
    state: 'Uttar Pradesh',
    state_hi: 'उत्तर प्रदेश',
    lat: 28.6692,
    lon: 77.4538,
    imdId: 'geo',
    region: 'NCR',
    crops: ['wheat', 'mustard', 'vegetables'],
    countryCode: 'IN',
  },
  gurgaon: {
    id: 'gurgaon',
    name: 'Gurugram',
    name_hi: 'गुरुग्राम',
    state: 'Haryana',
    state_hi: 'हरियाणा',
    lat: 28.4595,
    lon: 77.0266,
    imdId: 'geo',
    region: 'NCR',
    crops: ['wheat', 'mustard', 'vegetables'],
    countryCode: 'IN',
  },
  // ── Global metros (instant switch — no geocode wait) ──
  dubai: {
    id: 'dubai',
    name: 'Dubai',
    name_hi: 'दुबई',
    state: 'Dubai',
    state_hi: 'दुबई',
    country: 'United Arab Emirates',
    countryShort: 'UAE',
    lat: 25.2048,
    lon: 55.2708,
    imdId: 'geo',
    region: 'Gulf',
    crops: ['date palm', 'vegetables'],
    countryCode: 'AE',
    population: 3600000,
    tz: 'Asia/Dubai',
  },
  tokyo: {
    id: 'tokyo',
    name: 'Tokyo',
    name_hi: 'टोक्यो',
    state: 'Tokyo',
    country: 'Japan',
    countryShort: 'Japan',
    lat: 35.6762,
    lon: 139.6503,
    imdId: 'geo',
    region: 'Kanto',
    crops: ['rice', 'vegetables'],
    countryCode: 'JP',
    population: 14000000,
    tz: 'Asia/Tokyo',
  },
  london: {
    id: 'london',
    name: 'London',
    name_hi: 'लंदन',
    state: 'England',
    country: 'United Kingdom',
    countryShort: 'UK',
    lat: 51.5074,
    lon: -0.1278,
    imdId: 'geo',
    region: 'Europe',
    crops: ['wheat', 'vegetables'],
    countryCode: 'GB',
    population: 9000000,
    tz: 'Europe/London',
  },
  'new-york': {
    id: 'new-york',
    name: 'New York',
    name_hi: 'न्यूयॉर्क',
    state: 'New York',
    country: 'United States',
    countryShort: 'USA',
    lat: 40.7128,
    lon: -74.006,
    imdId: 'geo',
    region: 'Northeast US',
    crops: ['vegetables'],
    countryCode: 'US',
    population: 8000000,
    tz: 'America/New_York',
  },
  singapore: {
    id: 'singapore',
    name: 'Singapore',
    name_hi: 'सिंगापुर',
    state: 'Singapore',
    country: 'Singapore',
    countryShort: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    imdId: 'geo',
    region: 'SE Asia',
    crops: ['vegetables'],
    countryCode: 'SG',
    population: 5600000,
    tz: 'Asia/Singapore',
  },
  paris: {
    id: 'paris',
    name: 'Paris',
    name_hi: 'पेरिस',
    state: 'Île-de-France',
    country: 'France',
    countryShort: 'France',
    lat: 48.8566,
    lon: 2.3522,
    imdId: 'geo',
    region: 'Europe',
    crops: ['wheat', 'grapes'],
    countryCode: 'FR',
    population: 2100000,
    tz: 'Europe/Paris',
  },

}

/**
 * Common speech / spelling aliases → canonical city id or search name.
 * Voice often produces "nodia", "bangalor", "gurgoan", etc.
 */
export const CITY_ALIASES = {
  nodia: 'noida',
  noeda: 'noida',
  noyda: 'noida',
  'new oida': 'noida',
  gurgaon: 'gurgaon',
  gurgoan: 'gurgaon',
  gurugram: 'gurgaon',
  'gaziabad': 'ghaziabad',
  'ghazi abad': 'ghaziabad',
  bombay: 'mumbai',
  bangalore: 'bengaluru',
  bengalooru: 'bengaluru',
  bengaluru: 'bengaluru',
  madras: 'chennai',
  calcutta: 'kolkata',
  poona: 'pune',
  banaras: 'varanasi',
  kashi: 'varanasi',
  'new delhi': 'delhi',
  dilli: 'delhi',
  delhii: 'delhi',
  hyd: 'hyderabad',
  'hyderbad': 'hyderabad',
  lko: 'lucknow',
  cawnpore: 'kanpur',
  'kanpur nagar': 'kanpur',
  dubay: 'dubai',
  'dubai uae': 'dubai',
  'dubai ae': 'dubai',
  dubai: 'dubai',
  'new york': 'new-york',
  nyc: 'new-york',
  'newyork': 'new-york',
}

/** Runtime registry — curated + every city user ever searched */
const dynamicRegistry = new Map()

export function registerCity(city) {
  if (!city?.id) return city
  if (!CITIES[city.id]) {
    // don't mutate export const shape for curated; keep dynamics separate
    dynamicRegistry.set(city.id, city)
  }
  return city
}

export function getCity(idOrCity) {
  if (!idOrCity) return null
  if (typeof idOrCity === 'object') return idOrCity
  return CITIES[idOrCity] || dynamicRegistry.get(idOrCity) || null
}

export const CITY_LIST = Object.values(CITIES)

export function allKnownCities() {
  return [...CITY_LIST, ...dynamicRegistry.values()]
}

/** Normalize free-text / voice place → alias or cleaned string */
export function normalizePlaceQuery(query) {
  if (!query) return ''
  let q = String(query)
    .toLowerCase()
    .trim()
    .replace(/[?.!,]+$/g, '')
    // strip trailing filler from speech: "noida right now", "delhi today"
    .replace(
      /\b(right\s+now|rightnow|just\s+now|as\s+of\s+now|currently|today|tonight|tomorrow|kal|abhi|ab\s+hi|please|pls|now)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()

  // drop leading stop-words left over
  q = q.replace(/^(in|at|for|near|around|of)\s+/i, '').trim()

  if (CITY_ALIASES[q]) return CITY_ALIASES[q]

  // multi-word alias
  for (const [alias, canon] of Object.entries(CITY_ALIASES)) {
    if (alias.includes(' ') && q.includes(alias)) return canon
  }

  // single-token alias inside short phrases: "nodia irrigation" → try tokens
  const tokens = q.split(/\s+/).filter(Boolean)
  for (const t of tokens) {
    if (CITY_ALIASES[t]) return CITY_ALIASES[t]
  }

  return q
}

export function findCityLocal(query) {
  if (!query) return null
  const raw = String(query).trim()
  const q = normalizePlaceQuery(raw)
  if (!q) return null

  const pool = allKnownCities()

  // 1) exact id / alias target
  if (CITIES[q]) return CITIES[q]
  if (dynamicRegistry.get(q)) return dynamicRegistry.get(q)

  // 2) exact name match only (never fuzzy includes for short strings — avoids "now"→Kanpur etc.)
  const exact = pool.find(
    (c) =>
      c.name.toLowerCase() === q ||
      c.name_hi === raw ||
      (c.name_hi && c.name_hi.toLowerCase() === q) ||
      c.id === q
  )
  if (exact) return exact

  // 3) starts-with for longer queries (min 4 chars)
  if (q.length >= 4) {
    const starts = pool.find((c) => c.name.toLowerCase().startsWith(q) || c.id.startsWith(q))
    if (starts) return starts
  }

  // 4) includes only if query is reasonably long AND city name contains it as whole-ish
  if (q.length >= 5) {
    const inc = pool.find((c) => c.name.toLowerCase().includes(q))
    if (inc) return inc
  }

  return null
}

/** @deprecated use findCityLocal or resolveCity from geocode */
export function findCity(query) {
  return findCityLocal(query)
}
