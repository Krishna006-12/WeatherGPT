/**
 * WeatherGPT AI brain — rich multi-section summaries (ChatGPT-style),
 * prediction / travel / school intents, grounded on live weather pack.
 */

import { findCityLocal, CITIES, allKnownCities, normalizePlaceQuery, CITY_ALIASES } from '../data/cities'
import { resolveCity } from './geocode'
import { wmoInfo } from './weather'
import {
  buildPrediction,
  buildTravelInsight,
  buildSchoolInsight,
  predictionSummaryText,
  estimateVisibility,
} from './insights'
import {
  detectCrop,
  isCropToken,
  isCropQuestion,
  isCropFollowUp,
  allCropStopwords,
  getCropById,
} from '../data/crops'
import { classifyQuery, isCropRoute, isCropOnlyClassification } from './queryClassify'

/** Words that are never place names (voice + typed) */
const PLACE_STOP = new Set(
  [
    'hi','hello','hii','hlo','hey','yo','ok','okay','thanks','bye','sup','help','test','what','why','how','yes','no',
    'rain',
    'weather',
    'alert',
    'forecast',
    'today',
    'tomorrow',
    'tonight',
    'week',
    'field',
    'area',
    'my',
    'the',
    'this',
    'that',
    'warning',
    'irrigate',
    'irrigation',
    'travel',
    'school',
    'prediction',
    'mode',
    'right',
    'now',
    'please',
    'good',
    'best',
    'safe',
    'risk',
    'outdoor',
    'indoor',
    'kids',
    'children',
    'farm',
    'farmer',
    'crop',
    'soil',
    'water',
    'doing',
    'do',
    'is',
    'it',
    'to',
    'for',
    'from',
    'with',
    'about',
    'what',
    'when',
    'where',
    'will',
    'can',
    'should',
    'there',
    'here',
    'current',
    'currently',
    'status',
    'summary',
    'advisory',
    'krishi',
    'sincai',
    'sinchai',
    'baarish',
    'barish',
    'mausam',
    'kal',
    'aaj',
    'abhi',
    'tell',
    'give',
    'show',
    'how',
    'much',
    'many',
    'like',
    'looks',
    'looking',
    'check',
    'get',
    'need',
    'want',
    'know',
    'tell',
    'me',
    'you',
    'your',
    'our',
    'any',
    'some',
    'city',
    'country',
    'place',
    'location',
    'outside',
    'inside',
    'chance',
    'condition',
    'conditions',
    'update',
    'report',
    'details',
    'info',
    'information',
    'and',
    'or',
    'but',
    'not',
    'are',
    'was',
    'were',
    'been',
    'being',
    'have',
    'has',
    'had',
    'does',
    'did',
    'its',
    'his',
    'her',
    'their',
    'them',
    'they',
    'we',
    'us',
    'an',
    'a',
    'on',
    'by',
    'vs',
    'than',
    'then',
    'also',
    'just',
    'only',
    'very',
    'really',
    'please',
    'thanks',
    'hello',
    'hi',
    'hey',
    'namaste',
    'humidity',
    'temperature',
    'temp',
    'wind',
    'aqi',
    'climate',
    'model',
    'models',
    'nwp',
    'gfs',
    'ecmwf',
    'icon',
    'irrigation',
    'umbrella',
    'degree',
    'celsius',
    'fahrenheit',
    // Crop / farm lexicon — never treat as city names (wheat → "Wheat US" bug)
    ...allCropStopwords(),
    'gehun',
    'gehu',
    'aloo',
    'alu',
    'paddy',
    'dhan',
    'chawal',
    'ganna',
    'sarson',
    'makka',
    'kapas',
    'pyaz',
    'piyaz',
    'tamatar',
    'soya',
    'soybean',
    'chana',
    'gram',
    'blight',
    'lodging',
    'threshing',
    'sowing',
    'harvest',
    'fertilizer',
    'pesticide',
    'fungicide',
    'vegetables',
    'vegetable',
    'pulse',
    'pulses',
    'oilseed',
    'kharif',
    'rabi',
    'zaid',
  ].map((s) => s.toLowerCase())
)

/** High-signal place tokens (any casing) — used when sentence parsers miss "of Tokyo" etc. */
const FAMOUS_PLACES = [
  'tokyo',
  'osaka',
  'kyoto',
  'london',
  'paris',
  'dubai',
  'singapore',
  'new york',
  'los angeles',
  'san francisco',
  'hong kong',
  'beijing',
  'shanghai',
  'seoul',
  'bangkok',
  'jakarta',
  'manila',
  'sydney',
  'melbourne',
  'toronto',
  'vancouver',
  'moscow',
  'berlin',
  'madrid',
  'rome',
  'milan',
  'istanbul',
  'cairo',
  'lagos',
  'nairobi',
  'chicago',
  'boston',
  'miami',
  'washington',
  'amsterdam',
  'vienna',
  'zurich',
  'geneva',
  'brussels',
  'lisbon',
  'athens',
  'warsaw',
  'prague',
  'budapest',
  'stockholm',
  'oslo',
  'copenhagen',
  'helsinki',
  'dublin',
  'edinburgh',
  'manchester',
  'barcelona',
  'munich',
  'frankfurt',
  'hamburg',
  'taipei',
  'hanoi',
  'auckland',
  'cape town',
  'johannesburg',
  'mexico city',
  'buenos aires',
  'sao paulo',
  'rio de janeiro',
  'lima',
  'bogota',
  'santiago',
  'tehran',
  'baghdad',
  'kuwait',
  'muscat',
  'manama',
  'islamabad',
  'karachi',
  'lahore',
  'dhaka',
  'colombo',
  'kathmandu',
  'abu dhabi',
  'sharjah',
  'doha',
  'riyadh',
  'jeddah',
  'kuala lumpur',
  'ho chi minh',
  'japan',
  'china',
  'usa',
  'uk',
  'france',
  'germany',
  'australia',
  'canada',
  'russia',
  'brazil',
  'italy',
  'spain',
  'turkey',
  'egypt',
  'thailand',
  'vietnam',
  'indonesia',
  'malaysia',
  'pakistan',
  'bangladesh',
  'nepal',
  'sri lanka',
  'uae',
  'qatar',
  'saudi arabia',
  'south korea',
  'north korea',
  'new zealand',
  'south africa',
  'mexico',
  'argentina',
  'chile',
  'peru',
  'colombia',
  'nigeria',
  'kenya',
  'philippines',
  'taiwan',
  'switzerland',
  'netherlands',
  'belgium',
  'portugal',
  'greece',
  'poland',
  'sweden',
  'norway',
  'denmark',
  'finland',
  'ireland',
  'austria',
  'hungary',
  'czechia',
  'noida',
  'nodia',
  'gurugram',
  'gurgaon',
  'mumbai',
  'delhi',
  'bengaluru',
  'bangalore',
  'chennai',
  'kolkata',
  'hyderabad',
  'pune',
  'ahmedabad',
  'jaipur',
  'lucknow',
  'kanpur',
  'indore',
  'bhopal',
  'patna',
  'chandigarh',
  'kochi',
  'goa',
  'varanasi',
  'agra',
  'amritsar',
  'nagpur',
  'surat',
  'coimbatore',
  'madurai',
  'mysuru',
  'mysore',
  'thiruvananthapuram',
  'visakhapatnam',
  'vijayawada',
  'ranchi',
  'raipur',
  'dehradun',
  'shimla',
  'srinagar',
  'guwahati',
  'imphal',
  'shillong',
  'aizawl',
  'gangtok',
  'panaji',
  'pondicherry',
  'puducherry',
].sort((a, b) => b.length - a.length)

const INTENTS = {
  rain: /rain|baarish|barish|barsat|bārish|वर्षा|बारिश|फुहार|bouchhar|drizzle|shower|wet|umbrella|छाता/i,
  alert: /alert|warn|warning|chetavni|chetaavni|चेतावनी|खतरा|danger|red|amber|yellow|ndma|imd\s*warn|disaster|flood|बाढ़/i,
  irrigate: /irrigat|sincai|sinchai|सिंचाई|पानी\s*दे|water\s*(crop|field|khet)|khet|खेत|farm|कृषि|agri|soil|मिट्टी|spray|छिड़काव|sowing|बुआई|harvest|कटाई/i,
  forecast: /forecast|5[\s-]*day|panch|पाँच|पांच|aane\s*wale|outlook|week|hafte|हफ्ते|अगले|next\s*day|kal\s*ka|temperature\s*trend/i,
  predict: /predict|prediction|bhavishya|भविष्य|aage\s*kya|what's\s*coming|kya\s*hone|trend\s*bol|forecast\s*summary|मौसम\s*कैसा\s*रहेगा|weather\s*prediction/i,
  travel: /travel|road|drive|driving|highway|trip|yatra|यात्रा|safar|सफर|commute|visibility|दृश्यता|underpass|traffic|gaadi|गाड़ी|bike\s*chal/i,
  school: /school|school\s*mode|class|pe\s|sports\s*day|assembly|vidyalay|विद्यालय|स्कूल|bacche|बच्चे|heat\s*risk|outdoor\s*activity|pt\s*period/i,
  temp: /temp|degree|celsius|garam|sardi|गर्मी|ठंड|hot|cold|feels\s*like|humidity|nami|नमी|uv|heatwave|लू/i,
  wind: /wind|hawa|हवा|gust|aandhi|आंधी/i,
  hello: /^(hi|hello|hey|namaste|namaskar|हेलो|नमस्ते|नमस्कार|yo|sup)\b/i,
  climate: /climate|historical|history|archive|trend\s*analysis|jalvayu|जलवायु|ऐतिहासिक|past\s*year|last\s*year|reanalysis|normal\s*vs|anomaly|era5|long[\s-]*term\s*rain|monsoon\s*trend/i,
  models: /\bnwp\b|gfs|ecmwf|icon\b|wrf|model\s*compare|ensemble|multi[\s-]*model|मॉडल\s*तुलना|numerica|weather\s*model/i,
  aviation_lite: /aviation|pilot|flight\s*weather|metar|taf|ceiling|visibility\s*for\s*flight/i,
  outofscope: /marine\s*bulletin|ship\s*route|coastal\s*bulletin|30[\s-]*year\s*climate\s*change\s*projection|carbon\s*credit|stock\s*market|crypto/i,
}

function detectLang(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi'
  return null
}

function extractCityLocal(text, fallback) {
  const lower = String(text || '').toLowerCase()

  // Alias scan first (nodia, bangalore, …) — longest alias first
  const aliasEntries = Object.entries(CITY_ALIASES).sort((a, b) => b[0].length - a[0].length)
  for (const [alias, canon] of aliasEntries) {
    const re = new RegExp(`(?:^|[^a-z\\u0900-\\u097f])${alias.replace(/\s+/g, '\\s+')}(?:[^a-z\\u0900-\\u097f]|$)`, 'i')
    if (re.test(lower)) {
      const hit = findCityLocal(canon) || CITIES[canon] || CITIES[String(canon).toLowerCase()]
      if (hit) return hit
    }
  }

  // Explicit id token (noida, kanpur, …)
  const pool = allKnownCities().slice().sort((a, b) => b.name.length - a.name.length)
  for (const c of pool) {
    const name = c.name.toLowerCase()
    // word-boundary style match — avoid "now" inside other words matching wrongly
    const nameRe = new RegExp(
      `(?:^|[^a-z\\u0900-\\u097f])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z\\u0900-\\u097f]|$)`,
      'i'
    )
    const idRe = new RegExp(
      `(?:^|[^a-z])${String(c.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z]|$)`,
      'i'
    )
    if (nameRe.test(lower) || idRe.test(lower) || (c.name_hi && text.includes(c.name_hi))) {
      return c
    }
  }
  if (/new\s*delhi|dilli|दिल्ली/.test(lower) || /दिल्ली/.test(text)) return CITIES.delhi
  if (/bangalore|बेंगल/.test(lower)) return CITIES.bengaluru
  if (/bombay|मुंबई/.test(lower) || /मुंबई/.test(text)) return CITIES.mumbai
  if (/नोएडा|नॉएडा|noida|nodia/.test(lower) || /नोएडा|नॉएडा/.test(text)) return CITIES.noida
  return fallback
}

/** Keep only the place token(s); strip "right now", "today", etc. */
function cleanPlacePhrase(raw) {
  if (!raw) return null
  let phrase = raw.trim().replace(/[?.!,;:]+$/g, '')
  phrase = phrase
    .replace(
      /\b(right\s+now|rightnow|just\s+now|as\s+of\s+now|currently|today|tonight|tomorrow|kal|abhi|please|pls|now|weather|forecast|temperature|temp|rain|aqi|climate)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()

  // Drop trailing/leading stopwords token by token
  let parts = phrase.split(/\s+/).filter(Boolean)
  while (parts.length && PLACE_STOP.has(parts[parts.length - 1].toLowerCase())) parts.pop()
  while (parts.length && PLACE_STOP.has(parts[0].toLowerCase())) parts.shift()
  // Drop any remaining crop tokens (wheat, potato, gehun…)
  parts = parts.filter((p) => !isCropToken(p) && !PLACE_STOP.has(p.toLowerCase()))
  phrase = parts.join(' ').trim()
  if (!phrase || phrase.length < 2) return null
  if (PLACE_STOP.has(phrase.toLowerCase())) return null
  if (isCropToken(phrase) || detectCrop(phrase)) return null

  // Prefer first 1–4 tokens (New York, Mexico City, Abu Dhabi, …)
  parts = phrase.split(/\s+/)
  if (parts.length > 4) phrase = parts.slice(0, 4).join(' ')

  return normalizePlaceQuery(phrase) || phrase
}

/**
 * Pull a place name out of free text.
 * Handles: "weather of Tokyo", "in Noida", "Tokyo weather", "Japan ka mausam", bare "Dubai".
 */

/** Bare chat tokens that must never be geocoded as cities */
const CHAT_PLACE_NOISE = new Set(
  'hi hello hii hlo hola hey yo ok okay thanks thank thx bye good morning good night gm gn sup lol yes no yeah yep nope please pls bro help test abc what why how when where who namaste theek kya kaise'.split(
    ' ',
  ),
)

function isChatPlaceNoise(q) {
  const t = String(q || '')
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:]+$/g, '')
  if (!t) return true
  if (CHAT_PLACE_NOISE.has(t)) return true
  if (/^(ha+|hmm+|ok+|y+o+|h+i+|hlo+|he+y+|sup+)$/i.test(t)) return true
  if (t.length <= 2) return true
  return false
}

function guessPlacePhrase(text) {
  if (!text) return null
  const raw = String(text).trim()
  const lower = raw.toLowerCase()
  if (isChatPlaceNoise(raw) || isChatPlaceNoise(lower.replace(/[?.!,;:]+$/g, ''))) return null

  // Bare crop queries ("wheat", "potato advisory") are NOT places
  if (isCropQuestion(text) && !/\b(in|at|of|near|around)\s+[a-z\u0900-\u097f]{3,}/i.test(lower)) {
    // Allow "weather in Kanpur for wheat" to still extract Kanpur via patterns below
    // but block pure crop / crop+agri phrases
    const onlyCrop =
      detectCrop(text) &&
      !/\b(tokyo|delhi|mumbai|london|paris|dubai|noida|kanpur|lucknow|india|japan|china)\b/i.test(
        lower
      )
    if (onlyCrop) {
      // Still try preposition place patterns; if none, return null
      const placeTry =
        raw.match(
          /\b(?:in|at|near|around|of)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.']{1,40})/i
        )?.[1] || null
      if (!placeTry || isCropToken(placeTry) || detectCrop(placeTry)) return null
    }
  }

  const patterns = [
    // "weather of Tokyo" / "temperature in Paris" / "forecast for London"
    /\b(?:weather|forecast|rain|temperature|temp|climate|aqi|humidity|wind|travel\s+risk|school|conditions?|mausam|baarish)\s+(?:of|in|at|for|near|around|on)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.'-]{1,48})/i,
    // "how is weather in Tokyo" / "what's the weather like in Dubai"
    /\b(?:how(?:'s|\s+is)?|what(?:'s|\s+is)?)\s+(?:the\s+)?(?:weather|forecast|temp(?:erature)?|rain|aqi|climate)\s+(?:like\s+)?(?:in|at|for|of|near|around)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.'-]{1,48})/i,
    // "tell me weather of X" / "show me rain in X"
    /\b(?:tell|show|give|check|get)\s+(?:me\s+)?(?:the\s+)?(?:weather|forecast|rain|temp(?:erature)?|aqi)?\s*(?:of|in|at|for|near|around)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.'-]{1,48})/i,
    // generic preposition: "in Noida right now", "of Tokyo", "near Paris"
    /\b(?:in|at|for|near|around|of)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.'-]{1,48})/i,
    // Hindi postpositions
    /([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.'-]{1,40})\s*(?:में|का|की|के|के\s*लिए|में\s*मौसम)\b/,
    // "Tokyo weather" / "Dubai rain" / "Japan forecast"
    /\b([A-Za-z][A-Za-z.'-]{2,28}(?:\s+[A-Za-z][A-Za-z.'-]{2,20}){0,3})\s+(?:weather|rain|irrigation|forecast|alert|travel|school|temperature|temp|aqi|climate|mausam|baarish)\b/i,
  ]

  for (const re of patterns) {
    const m = raw.match(re)
    if (m?.[1]) {
      const phrase = cleanPlacePhrase(m[1])
      if (phrase && phrase.length >= 2 && !PLACE_STOP.has(phrase.toLowerCase())) return phrase
    }
  }

  // Famous multi-word / single-word places as whole tokens (Tokyo, New York, …)
  for (const name of FAMOUS_PLACES) {
    const re = new RegExp(`(?:^|[^a-z])${name.replace(/\s+/g, '\\s+')}(?:[^a-z]|$)`, 'i')
    if (re.test(lower)) return name
  }

  // City aliases (nodia → noida)
  const aliasEntries = Object.entries(CITY_ALIASES).sort((a, b) => b[0].length - a[0].length)
  for (const [alias, canon] of aliasEntries) {
    const re = new RegExp(`(?:^|[^a-z])${alias.replace(/\s+/g, '\\s+')}(?:[^a-z]|$)`, 'i')
    if (re.test(lower)) return typeof canon === 'string' ? canon : alias
  }

  // Capitalized tokens (typed "weather Tokyo" without preposition)
  const caps = raw.match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,3})\b/g)
  if (caps) {
    for (const c of caps) {
      const phrase = cleanPlacePhrase(c)
      if (phrase && phrase.length >= 3 && !PLACE_STOP.has(phrase.toLowerCase())) return phrase
    }
  }

  // Bare residual tokens: longest non-stop word ≥ 3 chars (e.g. "tokyo?" alone)
  const tokens = lower
    .replace(/[?.!,;:]+/g, ' ')
    .split(/\s+/)
    .filter(
      (t) =>
        t.length >= 3 &&
        !PLACE_STOP.has(t) &&
        !isCropToken(t) &&
        !/^\d+$/.test(t)
    )
  if (tokens.length === 1) {
    if (isChatPlaceNoise(tokens[0]) || tokens[0].length <= 3) return null
    return tokens[0]
  }
  // Prefer last content token in short queries ("weather tokyo")
  if (tokens.length >= 2 && tokens.length <= 6) {
    const last = tokens[tokens.length - 1]
    if (last.length >= 3 && !isCropToken(last) && !isChatPlaceNoise(last)) return last
  }

  return null
}

async function extractCity(text, fallback) {
  if (isChatPlaceNoise(text)) return fallback
  const classified = classifyQuery(text, null)

  // Crop-only: NEVER geocode / resolve the raw crop string as a place
  if (isCropOnlyClassification(classified)) {
    return fallback
  }

  // Crop + location: resolve ONLY the location phrase (Kanpur), never "wheat"
  if (classified.type === 'crop_location' && classified.locationQuery) {
    const locPhrase = classified.locationQuery
    const local = findCityLocal(locPhrase) || extractCityLocal(locPhrase, null)
    if (local) return local
    try {
      const resolved = await resolveCity(locPhrase)
      if (resolved && !isCropToken(resolved.name) && !detectCrop(resolved.name || '')) {
        return resolved
      }
    } catch {
      /* ignore */
    }
    return fallback
  }

  // 1) Curated India list / aliases on full text
  const local = extractCityLocal(text, null)
  if (local) return local

  // Prefer classifier location phrase when present
  const phrase =
    (classified.locationQuery && !isCropToken(classified.locationQuery)
      ? classified.locationQuery
      : null) || guessPlacePhrase(text)
  if (!phrase) return fallback
  if (isCropToken(phrase) || detectCrop(phrase)) return fallback

  const local2 = findCityLocal(phrase) || extractCityLocal(phrase, null)
  if (local2) return local2

  try {
    const resolved = await resolveCity(phrase)
    if (resolved) {
      if (isCropToken(resolved.name) || detectCrop(resolved.name || '')) return fallback
      return resolved
    }
  } catch {
    /* fall through */
  }

  try {
    const again = await resolveCity(String(phrase).split(/\s+/).slice(0, 3).join(' '))
    if (again && !isCropToken(again.name) && !detectCrop(again.name || '')) return again
  } catch {
    /* ignore */
  }

  return fallback
}

function climateAnswer(wx, lang) {
  const city = cityName(wx, lang)
  const d0 = wx.daily[0]
  if (lang === 'hi') {
    return {
      text:
        `## जलवायु / ऐतिहासिक रुझान — ${city}\n\n` +
        `### सारांश\nऐप में **Climate** टैब खोलें — Open-Meteo Archive (ERA5-श्रेणी) से ~12 महीने तापमान/वर्षा चार्ट + पिछले वर्ष से तुलना।\n\n` +
        `### अभी का संदर्भ\nआज ${d0?.max}°/${d0?.min}°C, बारिश संभावना ${d0?.pop}%।\n\n` +
        `### API (बाहरी टूल)\n\`GET /api/climate?lat=${wx.city.lat}&lon=${wx.city.lon}&name=${encodeURIComponent(wx.city.name)}\`\n\n` +
        `### सीमा\nयह **पुनर्विश्लेषण रुझान** है — IMD के आधिकारिक 30-वर्ष climate normal का विकल्प नहीं।`,
      type: 'climate',
      confidence: 0.88,
    }
  }
  return {
    text:
      `## Climate / historical trends — ${city}\n\n` +
      `### Summary\nOpen the **Climate** tab for ~12-month temperature & rainfall charts plus prior-year comparison from Open-Meteo Archive (ERA5-class).\n\n` +
      `### Current context\nToday ${d0?.max}°/${d0?.min}°C, rain chance ${d0?.pop}%.\n\n` +
      `### API (external tools)\n\`GET /api/climate?lat=${wx.city.lat}&lon=${wx.city.lon}&name=${encodeURIComponent(wx.city.name)}\`\n\n` +
      `### Limit\nThis is **reanalysis trend support** — not a substitute for official 30-year climate normals.`,
    type: 'climate',
    confidence: 0.88,
  }
}

function modelsAnswer(wx, lang) {
  const city = cityName(wx, lang)
  if (lang === 'hi') {
    return {
      text:
        `## NWP मॉडल — ${city}\n\n` +
        `### सारांश\n**Climate** टैब में GFS / ECMWF / ICON / best_match की तुलना दिखती है (Open-Meteo मल्टी-मॉडल)। स्प्रेड कम = अधिक सहमति।\n\n` +
        `### API\n\`GET /api/models?lat=${wx.city.lat}&lon=${wx.city.lon}&name=${encodeURIComponent(wx.city.name)}\`\n\n` +
        `### नोट\nपूरा **स्थानीय WRF nest** क्लाउड में नहीं चलाया जाता — SIH के लिए क्लाउड NWP ensemble पारदर्शिता।`,
      type: 'models',
      confidence: 0.9,
    }
  }
  return {
    text:
      `## NWP models — ${city}\n\n` +
      `### Summary\nThe **Climate** tab compares **GFS / ECMWF / ICON / best_match** via Open-Meteo multi-model. Low spread = higher agreement.\n\n` +
      `### API\n\`GET /api/models?lat=${wx.city.lat}&lon=${wx.city.lon}&name=${encodeURIComponent(wx.city.name)}\`\n\n` +
      `### Note\nWe do not run a full on-prem **WRF nest** — SIH layer exposes cloud NWP ensemble transparency for decision support.`,
    type: 'models',
    confidence: 0.9,
  }
}

function aviationLiteAnswer(wx, lang) {
  const city = cityName(wx, lang)
  const vis = estimateVisibility(wx)
  const c = wx.current
  if (lang === 'hi') {
    return {
      text:
        `## उड़ान-सहायक मौसम (लाइट) — ${city}\n\n` +
        `### अवलोकन\nतापमान **${c.temp}°C**, हवा **${c.wind} किमी/घं**, अनुमानित दृश्यता ~**${vis} किमी**, कोड ${c.code}।\n\n` +
        `### सीमा\nयह **METAR/TAF आधिकारिक ब्रीफिंग नहीं** है। पायलट को आधिकारिक AIS/MET स्रोत चाहिए।\n\n` +
        `### उपयोग\nसामान्य योजना/शिक्षा — operational release के लिए नहीं।`,
      type: 'aviation',
      confidence: 0.7,
    }
  }
  return {
    text:
      `## Aviation-assist weather (lite) — ${city}\n\n` +
      `### Snapshot\nTemp **${c.temp}°C**, wind **${c.wind} km/h**, estimated visibility ~**${vis} km**, code ${c.code}.\n\n` +
      `### Limit\n**Not an official METAR/TAF briefing.** Pilots must use authorised AIS/MET sources.\n\n` +
      `### Use\nGeneral planning/education only — not for operational release.`,
    type: 'aviation',
    confidence: 0.7,
  }
}

function detectIntent(text) {
  if (INTENTS.outofscope.test(text)) return 'outofscope'
  if (INTENTS.hello.test(text.trim()) && text.trim().split(/\s+/).length < 4) return 'hello'
  // Crop name (wheat, potato, gehun…) → farmer crop brief, not city weather
  if (detectCrop(text) && isCropQuestion(text)) return 'crop'
  if (INTENTS.climate.test(text)) return 'climate'
  if (INTENTS.models.test(text)) return 'models'
  if (INTENTS.aviation_lite.test(text)) return 'aviation_lite'
  if (INTENTS.travel.test(text)) return 'travel'
  if (INTENTS.school.test(text)) return 'school'
  if (INTENTS.predict.test(text)) return 'predict'
  if (INTENTS.alert.test(text)) return 'alert'
  if (INTENTS.irrigate.test(text)) return 'agri'
  if (INTENTS.forecast.test(text)) return 'forecast'
  if (INTENTS.rain.test(text)) return 'rain'
  if (INTENTS.temp.test(text)) return 'temp'
  if (INTENTS.wind.test(text)) return 'wind'
  return 'general'
}

function fmtDay(d, lang) {
  return lang === 'hi' ? `${d.weekday_hi} ${d.date.slice(8)}` : `${d.weekday} ${d.date.slice(8)}`
}

function cityName(wx, lang) {
  return lang === 'hi' ? wx.city.name_hi || wx.city.name : wx.city.name
}

function wrapSummary(title, sections, footer, conf) {
  const body = sections
    .filter(Boolean)
    .map((s) => (s.heading ? `### ${s.heading}\n${s.body}` : s.body))
    .join('\n\n')
  return {
    text: `## ${title}\n\n${body}${footer ? `\n\n${footer}` : ''}`,
    confidence: conf,
  }
}

/* ───────── RICH ANSWERS ───────── */

function rainAnswer(wx, lang) {
  const t = wx.daily[0]
  const tmr = wx.daily[1]
  const city = cityName(wx, lang)
  const pred = buildPrediction(wx, lang)
  const wet = t.pop >= 60 || tmr.pop >= 60

  if (lang === 'hi') {
    return {
      ...wrapSummary(
        `🌧️ बारिश विश्लेषण — ${city}`,
        [
          {
            heading: 'सारांश',
            body: wet
              ? `**${city}** में आज/कल **गीले मौसम** की अच्छी संभावना है। बाहरी प्लान में बफर रखें।`
              : `**${city}** में बड़े पैमाने पर लगातार बारिश का संकेत कमज़ोर है — सामान्य दिन की योजना ठीक।`,
          },
          {
            heading: 'आज vs कल',
            body:
              `• **आज:** ~${t.pop}% बारिश संभावना · ~${t.rain} मिमी · ${t.condition_hi}\n` +
              `• **कल:** ~${tmr.pop}% बारिश संभावना · ~${tmr.rain} मिमी · ${tmr.condition_hi}\n` +
              `• **5-दिन कुल वर्षा:** ~${wx.agri.forecastRain} मिमी\n` +
              `• नोट: % दिन-प्रतिनिधि है (केवल एक घंटे का max नहीं)`,
          },
          {
            heading: 'घंटेवार संकेत',
            body: pred.bestDryWindow
              ? `सूखा/बेहतर विंडो: **${pred.bestDryWindow.start}–${pred.bestDryWindow.end}** (लगभग ${pred.bestDryWindow.hours} घंटे). बाहर निकलने या छिड़काव के लिए यही बेहतर।`
              : `अगले घंटों में लंबा सूखा विंडो सीमित है — काम छोटे स्लॉट में बाँटें।`,
          },
          {
            heading: 'आप क्या करें',
            body: wet
              ? `• छतरी / रेनवेयर साथ रखें\n• खेत व नाले की निकासी साफ रखें\n• अंडरपास व निचली सड़कों से बचें\n• Travel मोड में रोड-रिस्क देखें`
              : `• सामान्य योजना चलाएँ\n• हल्की बौछार की गुंजाइश रहे तो लाइट जैकेट रखें\n• सिंचाई सलाह Farm टैब पर`,
          },
        ],
        pred.takeaway,
        wet ? 0.87 : 0.8
      ),
      type: 'rain',
    }
  }

  return {
    ...wrapSummary(
      `🌧️ Rain analysis — ${city}`,
      [
        {
          heading: 'Executive summary',
          body: wet
            ? `**${city}** looks **meaningfully wet** today/tomorrow. Build buffer into outdoor plans.`
            : `**${city}** does **not** show a strong sustained rain signal — normal-day planning is fine.`,
        },
        {
          heading: 'Today vs tomorrow',
          body:
            `• **Today:** ~${t.pop}% chance of rain · ~${t.rain} mm · ${t.condition}\n` +
            `• **Tomorrow:** ~${tmr.pop}% chance of rain · ~${tmr.rain} mm · ${tmr.condition}\n` +
            `• **5-day total rainfall:** ~${wx.agri.forecastRain} mm\n` +
            `• Note: % is day-representative (not a single hourly spike)`,
        },
        {
          heading: 'Hourly signal',
          body: pred.bestDryWindow
            ? `Clearer window: **${pred.bestDryWindow.start}–${pred.bestDryWindow.end}** (~${pred.bestDryWindow.hours}h). Prefer this for errands or spraying.`
            : `No long dry stretch in the next hours — split outdoor tasks into short slots.`,
        },
        {
          heading: 'What you should do',
          body: wet
            ? `• Carry umbrella / rainwear\n• Keep field & drain paths clear\n• Avoid underpasses & low roads\n• Check **Travel** mode for road-risk`
            : `• Proceed with normal plans\n• Keep a light layer handy for brief showers\n• See **Farm** tab for irrigation`,
        },
      ],
      pred.takeaway,
      wet ? 0.87 : 0.8
    ),
    type: 'rain',
  }
}

function alertAnswer(wx, lang) {
  const city = cityName(wx, lang)
  if (!wx.alerts.length) {
    const body =
      lang === 'hi'
        ? wrapSummary(
            `✅ अलर्ट स्थिति — ${city}`,
            [
              {
                heading: 'सारांश',
                body: `**${city}** के लिए अभी **कोई सक्रिय रंग-कोड चेतावनी नहीं** है।`,
              },
              {
                heading: 'अभी का मौसम',
                body: `${wx.current.condition_hi}, **${wx.current.temp}°C** (महसूस ${wx.current.feelsLike}°C) · नमी ${wx.current.humidity}% · हवा ${wx.current.wind} किमी/घं`,
              },
              {
                heading: 'निगरानी',
                body: `Alerts टैब पर IMD-शैली बुलेटिन तभी दिखते हैं जब वर्षा/हवा/तूफान थ्रेशोल्ड पार हों। **Simulate RED** से जज-डेमो देखा जा सकता है।`,
              },
            ],
            null,
            0.91
          )
        : wrapSummary(
            `✅ Alert status — ${city}`,
            [
              {
                heading: 'Executive summary',
                body: `**No active colour-code warning** for **${city}** right now.`,
              },
              {
                heading: 'Current conditions',
                body: `${wx.current.condition}, **${wx.current.temp}°C** (feels ${wx.current.feelsLike}°C) · humidity ${wx.current.humidity}% · wind ${wx.current.wind} km/h`,
              },
              {
                heading: 'Monitoring',
                body: `The Alerts tab shows IMD-style bulletins when rain/wind/storm thresholds are crossed. Use **Simulate RED** for the judge demo.`,
              },
            ],
            null,
            0.91
          )
    return { ...body, type: 'alert' }
  }

  const a = wx.alerts[0]
  const title = lang === 'hi' ? a.title_hi : a.title
  const summary = lang === 'hi' ? a.summary_hi : a.summary
  const means = lang === 'hi' ? a.meansForYou_hi : a.meansForYou
  const official = lang === 'hi' ? a.officialText_hi : a.officialText

  if (lang === 'hi') {
    return {
      ...wrapSummary(
        `⚠️ ${a.severity.toUpperCase()} अलर्ट — ${city}`,
        [
          { heading: 'सारांश', body: `**${title}**\n\n${summary}` },
          { heading: 'आपके लिए इसका मतलब', body: means },
          {
            heading: 'आधिकारिक-शैली बुलेटिन (संक्षेप)',
            body: official.length > 280 ? official.slice(0, 280) + '…' : official,
          },
          {
            heading: 'अगला कदम',
            body: `• पूरा पाठ **Alerts** टैब में\n• सड़क के लिए **Travel** मोड\n• स्कूल के लिए **School** मोड`,
          },
        ],
        null,
        0.93
      ),
      type: 'alert',
      alertData: a,
    }
  }

  return {
    ...wrapSummary(
      `⚠️ ${a.severity.toUpperCase()} alert — ${city}`,
      [
        { heading: 'Executive summary', body: `**${title}**\n\n${summary}` },
        { heading: 'What this means for you', body: means },
        {
          heading: 'Official-style bulletin (excerpt)',
          body: official.length > 280 ? official.slice(0, 280) + '…' : official,
        },
        {
          heading: 'Next steps',
          body: `• Full text on the **Alerts** tab\n• Roads → **Travel** mode\n• Campus → **School** mode`,
        },
      ],
      null,
      0.93
    ),
    type: 'alert',
    alertData: a,
  }
}


/**
 * Crop Intelligence — compact, scannable, grounded on live wx + catalog rules.
 * Never invents soil stage, disease diagnosis, or yields.
 */
function levelLabel(lang, key) {
  const map = {
    en: {
      low: 'Low',
      moderate: 'Moderate',
      elevated: 'Elevated',
      high: 'High',
      favourable: 'Favourable',
      watch: 'Watch',
      limited: 'Limited data',
    },
    hi: {
      low: 'कम',
      moderate: 'मध्यम',
      elevated: 'बढ़ा हुआ',
      high: 'उच्च',
      favourable: 'अनुकूल',
      watch: 'निगरानी',
      limited: 'सीमित डेटा',
    },
  }
  return (map[lang] || map.en)[key] || key
}

function cropAnswer(wx, lang, crop, userText = '') {
  if (!crop) {
    return {
      text:
        lang === 'hi'
          ? '## 🌾 फसल बुद्धिमत्ता\n\nफसल पहचानी नहीं गई। गेहूँ, धान, आलू… जैसे नाम आज़माएँ।'
          : '## 🌾 Crop Intelligence\n\nCrop not recognised. Try wheat, rice, potato…',
      type: 'crop',
      confidence: 0.5,
      cropId: null,
      cityId: wx?.city?.id,
    }
  }

  const hasWx = !!(wx?.current && wx?.daily?.[0])
  const city = hasWx
    ? cityName(wx, lang)
    : lang === 'hi'
      ? 'स्थान अनुपलब्ध'
      : 'Location unavailable'
  const d0 = wx?.daily?.[0] || {}
  const c = wx?.current || {}
  const pop = Number(d0.pop) || 0
  const rain = Number(d0.rain) || 0
  const wind = Number(c.wind ?? d0.wind) || 0
  const temp = Number.isFinite(Number(c.temp ?? d0.max)) ? Number(c.temp ?? d0.max) : null
  const humidity = Number.isFinite(Number(c.humidity)) ? Number(c.humidity) : null
  const name = lang === 'hi' ? crop.name_hi : crop.name_en
  const season = lang === 'hi' ? crop.season_hi : crop.season_en
  const lower = String(userText || '').toLowerCase()

  let focusKey = 'general'
  if (/spray|छिड़काव|fungicide|pesticide|blight|दवा/.test(lower)) focusKey = 'spray'
  else if (/irrigat|sincai|sinchai|सिंचाई|पानी|water/.test(lower)) focusKey = 'water'
  else if (/heat|garam|गर्मी|लू|temperature|temp/.test(lower)) focusKey = 'heat'
  else if (/rain|baarish|barish|वर्षा|बारिश|wet|harvest|कटाई|affect|impact|असर/.test(lower))
    focusKey = 'rain'

  let rainRisk = 'low'
  if (!hasWx) rainRisk = 'limited'
  else if (pop >= 70 || rain >= 15) rainRisk = 'high'
  else if (pop >= 45 || rain >= 5) rainRisk = 'elevated'
  else if (pop >= 25 || rain >= 1) rainRisk = 'moderate'

  let tempImpact = 'favourable'
  if (!hasWx || temp == null) tempImpact = 'limited'
  else if (temp >= 38) tempImpact = 'high'
  else if (temp >= 34) tempImpact = 'elevated'
  else if (temp <= 8) tempImpact = 'watch'
  else if (temp >= 18 && temp <= 32) tempImpact = 'favourable'
  else tempImpact = 'moderate'

  let weatherImpact = 'moderate'
  if (!hasWx) weatherImpact = 'limited'
  else if (rainRisk === 'high' || tempImpact === 'high') weatherImpact = 'elevated'
  else if (rainRisk === 'low' && (tempImpact === 'favourable' || tempImpact === 'moderate'))
    weatherImpact = 'favourable'
  else if (rainRisk === 'elevated') weatherImpact = 'watch'

  let irrigateLine
  if (!hasWx) {
    irrigateLine =
      lang === 'hi'
        ? 'स्थानीय मौसम उपलब्ध नहीं — सामान्य फसल ज्ञान ही।'
        : 'Local weather unavailable — general crop notes only.'
  } else if (pop >= 55 || rain >= 8) {
    irrigateLine =
      lang === 'hi'
        ? 'बारिश संकेत (~' + pop + '% / ' + rain + ' मिमी) — सिंचाई टालने पर विचार।'
        : 'Rain signal (~' + pop + '% / ' + rain + ' mm) — consider holding irrigation.'
  } else if (pop < 25 && rain < 1 && temp != null && temp >= 33) {
    irrigateLine =
      lang === 'hi'
        ? 'सूखा + गर्मी संकेत — फसल तनाव दिखे तो हल्की सिंचाई।'
        : 'Dry + heat signal — light irrigation only if crop shows stress.'
  } else {
    irrigateLine =
      lang === 'hi'
        ? 'मध्यम संकेत — खेत/मिट्टी देखकर निर्णय (सेंसर डेटा नहीं)।'
        : 'Moderate signal — decide from field/soil (no on-farm sensors here).'
  }

  const tip =
    focusKey === 'spray'
      ? lang === 'hi'
        ? crop.spray_hi
        : crop.spray_en
      : focusKey === 'water'
        ? lang === 'hi'
          ? crop.water_hi
          : crop.water_en
        : focusKey === 'heat'
          ? lang === 'hi'
            ? crop.heat_hi
            : crop.heat_en
          : focusKey === 'rain'
            ? lang === 'hi'
              ? crop.rain_hi
              : crop.rain_en
            : lang === 'hi'
              ? crop.rain_hi
              : crop.rain_en

  let riskLine = tip
  if (
    hasWx &&
    ((c.code != null && c.code >= 95) ||
      (wx.alerts || []).some((a) => a.severity === 'red' || a.severity === 'amber'))
  ) {
    riskLine =
      (lang === 'hi'
        ? 'सक्रिय खराब मौसम/अलर्ट — बाहरी खेत काम सीमित रखें। '
        : 'Active severe weather/alert — limit exposed field work. ') + tip
  }

  let outlook
  if (!hasWx) {
    outlook =
      lang === 'hi'
        ? name + ': सामान्य ज्ञान — लोकेशन मौसम जुड़ने पर प्रभाव अपडेट होगा।'
        : name + ': general notes — impact updates when location weather is available.'
  } else {
    const tmr = wx.daily?.[1]
    const tmrPop = tmr?.pop ?? '—'
    outlook =
      lang === 'hi'
        ? 'आज **' + temp + '°C**, POP ~**' + pop + '%**. कल POP ~**' + tmrPop + '%**. ' + season
        : 'Today **' + temp + '°C**, rain chance ~**' + pop + '%**. Tomorrow ~**' + tmrPop + '%**. ' + season
  }

  const wxNow = hasWx
    ? lang === 'hi'
      ? '**' + temp + '°C** · ' + (c.condition_hi || c.condition || '—') + ' · नमी ' + (humidity ?? '—') + '% · हवा ' + wind + ' किमी/घं'
      : '**' + temp + '°C** · ' + (c.condition || '—') + ' · humidity ' + (humidity ?? '—') + '% · wind ' + wind + ' km/h'
    : lang === 'hi'
      ? 'मौसम डेटा लोड नहीं'
      : 'Weather data not loaded'

  const tempBit = temp != null ? ' (' + temp + '°C)' : ''
  const rainBitHi = hasWx ? ' (~' + pop + '% · ' + rain + ' मिमी)' : ''
  const rainBitEn = hasWx ? ' (~' + pop + '% · ' + rain + ' mm)' : ''

  if (lang === 'hi') {
    return {
      ...wrapSummary(
        '🌾 फसल बुद्धिमत्ता — ' + name,
        [
          {
            heading: 'संदर्भ',
            body: '**' + name + '** · 📍 **' + city + '**\n' + wxNow,
          },
          {
            heading: 'प्रभाव स्नैपशॉट',
            body:
              '• मौसम प्रभाव: **' + levelLabel('hi', weatherImpact) + '**\n' +
              '• तापमान: **' + levelLabel('hi', tempImpact) + '**' + tempBit + '\n' +
              '• वर्षा जोखिम: **' + levelLabel('hi', rainRisk) + '**' + rainBitHi + '\n' +
              '• सिंचाई संदर्भ: ' + irrigateLine,
          },
          { heading: 'जोखिम / नोट', body: riskLine },
          { heading: 'आउटलुक', body: outlook },
          {
            heading: 'ईमानदारी',
            body: 'सामान्य फसल×मौसम मार्गदर्शन — उपज/रोग निदान/मिट्टी सेंसर नहीं। स्थानीय KVK से पुष्टि करें।',
          },
        ],
        null,
        hasWx ? 0.88 : 0.62
      ),
      type: 'crop',
      cropId: crop.id,
      cityId: wx?.city?.id || null,
      placeResolved: false,
    }
  }

  return {
    ...wrapSummary(
      '🌾 Crop Intelligence — ' + name,
      [
        {
          heading: 'Context',
          body: '**' + name + '** · 📍 **' + city + '**\n' + wxNow,
        },
        {
          heading: 'Impact snapshot',
          body:
            '• Weather impact: **' + levelLabel('en', weatherImpact) + '**\n' +
            '• Temperature: **' + levelLabel('en', tempImpact) + '**' + tempBit + '\n' +
            '• Rainfall risk: **' + levelLabel('en', rainRisk) + '**' + rainBitEn + '\n' +
            '• Irrigation context: ' + irrigateLine,
        },
        { heading: 'Risk / note', body: riskLine },
        { heading: 'Outlook', body: outlook },
        {
          heading: 'Honesty',
          body: 'General crop×weather guidance — not yield prediction, disease diagnosis, or soil-sensor advice. Confirm with local extension / KVK.',
        },
      ],
      null,
      hasWx ? 0.88 : 0.62
    ),
    type: 'crop',
    cropId: crop.id,
    cityId: wx?.city?.id || null,
    placeResolved: false,
  }
}

function agriAnswer(wx, lang, cropHint = null) {
  if (cropHint) return cropAnswer(wx, lang, cropHint, '')

  const city = cityName(wx, lang)
  const soil = lang === 'hi' ? wx.agri.soil.hi : wx.agri.soil.en
  const advice = lang === 'hi' ? wx.agri.advice_hi : wx.agri.advice_en
  const spray = lang === 'hi' ? wx.agri.sprayWindow.hi : wx.agri.sprayWindow.en
  const crops = wx.agri.crops.join(', ')
  const pred = buildPrediction(wx, lang)

  if (lang === 'hi') {
    return {
      ...wrapSummary(
        `🌾 कृषि सलाह — ${city}`,
        [
          {
            heading: 'सारांश',
            body: `मिट्टी नमी **${soil}** है। ${advice}`,
          },
          {
            heading: 'जल व वर्षा बैलेंस',
            body:
              `• हाल की बारिश: **${wx.agri.recentRain} मिमी**\n` +
              `• अगले 5 दिन: **${wx.agri.forecastRain} मिमी**\n` +
              `• छिड़काव विंडो: ${spray}`,
          },
          {
            heading: 'फसल संदर्भ',
            body: `स्थानीय प्रोफ़ाइल फसलें: **${crops}**. गीले शिखर (${pred.peakRainDay ? (pred.peakRainDay.weekday_hi || pred.peakRainDay.weekday) : '—'}) के आसपास कटाई/सुखाई टालें। फसल नाम पूछें (गेहूँ, आलू, धान…) — विस्तृत सलाह मिलेगी।`,
          },
          {
            heading: 'क्रियात्मक योजना',
            body:
              `1. सिंचाई निर्णय ऊपर की सलाह से लें\n` +
              `2. निकासी नालियाँ साफ रखें यदि वर्षा > 20 मिमी अपेक्षित\n` +
              `3. छिड़काव सुबह, कम हवा वाले स्लॉट में\n` +
              `4. Farm टैब पर ग्राफ देखें`,
          },
        ],
        null,
        0.86
      ),
      type: 'agri',
    }
  }

  return {
    ...wrapSummary(
      `🌾 Krishi advisory — ${city}`,
      [
        {
          heading: 'Executive summary',
          body: `Soil moisture is **${soil}**. ${advice}`,
        },
        {
          heading: 'Water & rainfall balance',
          body:
            `• Recent rain: **${wx.agri.recentRain} mm**\n` +
            `• Next 5 days: **${wx.agri.forecastRain} mm**\n` +
            `• Spray window: ${spray}`,
        },
        {
          heading: 'Crop context',
          body: `Local crop profile: **${crops}**. Avoid harvest/drying around the wet peak (${pred.peakRainDay?.weekday || '—'}). Ask a crop name (wheat, potato, rice…) for a tailored brief.`,
        },
        {
          heading: 'Action plan',
          body:
            `1. Follow the irrigation call above\n` +
            `2. Clear drainage if >20 mm rain is expected\n` +
            `3. Spray in calm morning slots\n` +
            `4. Open the **Farm** tab for charts`,
        },
      ],
      null,
      0.86
    ),
    type: 'agri',
  }
}

function forecastAnswer(wx, lang) {
  const city = cityName(wx, lang)
  const pred = buildPrediction(wx, lang)
  const lines = wx.daily
    .map((d) =>
      lang === 'hi'
        ? `• **${fmtDay(d, 'hi')}:** ${d.min}–${d.max}°C · ${d.condition_hi} · बारिश ${d.pop}% (${d.rain}मिमी)`
        : `• **${fmtDay(d, 'en')}:** ${d.min}–${d.max}°C · ${d.condition} · rain ${d.pop}% (${d.rain}mm)`
    )
    .join('\n')

  if (lang === 'hi') {
    return {
      ...wrapSummary(
        `📅 5-दिन पूर्वानुमान — ${city}`,
        [
          { heading: 'सारांश', body: pred.headline },
          { heading: 'दिन-प्रतिदिन', body: lines },
          {
            heading: 'प्रमुख बिंदु',
            body: pred.bullets.map((b) => `• ${b}`).join('\n'),
          },
        ],
        pred.takeaway + `\n\nघंटेवार चार्ट **Forecast** टैब पर।`,
        pred.confidence
      ),
      type: 'forecast',
    }
  }

  return {
    ...wrapSummary(
      `📅 5-day forecast — ${city}`,
      [
        { heading: 'Executive summary', body: pred.headline },
        { heading: 'Day-by-day', body: lines },
        {
          heading: 'Key takeaways',
          body: pred.bullets.map((b) => `• ${b}`).join('\n'),
        },
      ],
      pred.takeaway + `\n\nHourly charts are on the **Forecast** tab.`,
      pred.confidence
    ),
    type: 'forecast',
  }
}

function tempAnswer(wx, lang) {
  const c = wx.current
  const city = cityName(wx, lang)
  const school = buildSchoolInsight(wx, lang)
  const vis = estimateVisibility(wx)

  if (lang === 'hi') {
    return {
      ...wrapSummary(
        `🌡️ तापमान व स्थितियाँ — ${city}`,
        [
          {
            heading: 'सारांश',
            body: `अभी **${c.temp}°C** (महसूस **${c.feelsLike}°C**), ${c.condition_hi}. हीट रिस्क: **${school.heatLabel}**.`,
          },
          {
            heading: 'विवरण',
            body:
              `• नमी: ${c.humidity}% · हवा: ${c.wind} किमी/घं\n` +
              `• दाब: ${c.pressure} hPa · अनुमानित दृश्यता: ~${vis} किमी\n` +
              `• आज उच्च/न्यून: **${wx.daily[0].max}° / ${wx.daily[0].min}°C**\n` +
              `• सूर्योदय/अस्त: ${wx.astro.sunrise} / ${wx.astro.sunset}`,
          },
          {
            heading: 'स्वास्थ्य / आराम',
            body:
              school.heatStress === 'high' || school.heatStress === 'extreme'
                ? `दोपहर 12–3 बजे धूप कम करें, पानी ज़्यादा लें। बच्चों/बुज़ुर्गों का ध्यान।`
                : `आरामदायक दायरे के करीब — हल्की सूती कपड़े पर्याप्त।`,
          },
        ],
        null,
        0.94
      ),
      type: 'temp',
    }
  }

  return {
    ...wrapSummary(
      `🌡️ Temperature & conditions — ${city}`,
      [
        {
          heading: 'Executive summary',
          body: `Now **${c.temp}°C** (feels **${c.feelsLike}°C**), ${c.condition}. Heat risk: **${school.heatLabel}**.`,
        },
        {
          heading: 'Details',
          body:
            `• Humidity: ${c.humidity}% · Wind: ${c.wind} km/h\n` +
            `• Pressure: ${c.pressure} hPa · Est. visibility: ~${vis} km\n` +
            `• Today high/low: **${wx.daily[0].max}° / ${wx.daily[0].min}°C**\n` +
            `• Sunrise/sunset: ${wx.astro.sunrise} / ${wx.astro.sunset}`,
        },
        {
          heading: 'Comfort guidance',
          body:
            school.heatStress === 'high' || school.heatStress === 'extreme'
              ? `Limit sun exposure 12–3 pm and hydrate often. Watch kids/elders.`
              : `Near a comfortable band — light cotton clothing is fine.`,
        },
      ],
      null,
      0.94
    ),
    type: 'temp',
  }
}

function predictAnswer(wx, lang) {
  return {
    text: predictionSummaryText(wx, lang),
    confidence: buildPrediction(wx, lang).confidence,
    type: 'predict',
  }
}

function travelAnswer(wx, lang) {
  const trv = buildTravelInsight(wx, lang)
  const city = cityName(wx, lang)

  if (lang === 'hi') {
    return {
      ...wrapSummary(
        `🚗 यात्रा मोड — ${city}`,
        [
          {
            heading: 'सारांश',
            body: `सड़क जोखिम **${trv.riskLabel}** (स्कोर **${trv.riskScore}/100**). ${trv.advice}`,
          },
          {
            heading: 'दृश्यता · हवा · बारिश',
            body:
              `• दृश्यता: **~${trv.visibilityKm} किमी**\n` +
              `• हवा: **${trv.windKmh} किमी/घं**\n` +
              `• आज बारिश: **${trv.rainToday.pop}%** / ~${trv.rainToday.mm} मिमी`,
          },
          {
            heading: 'चेतावनियाँ',
            body: trv.warnings.map((w) => `• ${w}`).join('\n'),
          },
          {
            heading: 'सुरक्षित यात्रा खिड़की',
            body: trv.saferWindow
              ? `**${trv.saferWindow.start} – ${trv.saferWindow.end}** (~${trv.saferWindow.hours} घंटे, औसत जोखिम ${trv.saferWindow.avgRisk})`
              : `लंबी सुरक्षित खिड़की सीमित — छोटे सफर, दिन की रोशनी प्राथमिकता।`,
          },
        ],
        `पूरा रोड-रिस्क ग्राफ **Travel** टैब पर।`,
        0.88
      ),
      type: 'travel',
    }
  }

  return {
    ...wrapSummary(
      `🚗 Travel mode — ${city}`,
      [
        {
          heading: 'Executive summary',
          body: `Road risk is **${trv.riskLabel}** (score **${trv.riskScore}/100**). ${trv.advice}`,
        },
        {
          heading: 'Visibility · wind · rain',
          body:
            `• Visibility: **~${trv.visibilityKm} km**\n` +
            `• Wind: **${trv.windKmh} km/h**\n` +
            `• Rain today: **${trv.rainToday.pop}%** / ~${trv.rainToday.mm} mm`,
        },
        {
          heading: 'Warnings',
          body: trv.warnings.map((w) => `• ${w}`).join('\n'),
        },
        {
          heading: 'Suggested safer travel window',
          body: trv.saferWindow
            ? `**${trv.saferWindow.start} – ${trv.saferWindow.end}** (~${trv.saferWindow.hours}h, avg risk ${trv.saferWindow.avgRisk})`
            : `No long safe window — prefer short daytime trips only.`,
        },
      ],
      `Full road-risk chart is on the **Travel** tab.`,
      0.88
    ),
    type: 'travel',
  }
}

function schoolAnswer(wx, lang) {
  const s = buildSchoolInsight(wx, lang)
  const city = cityName(wx, lang)

  if (lang === 'hi') {
    return {
      ...wrapSummary(
        `🏫 स्कूल मोड — ${city}`,
        [
          {
            heading: 'सारांश',
            body: `आउटडोर गतिविधि: **${s.outdoorLabel}** (${s.outdoorScore}/100). हीट रिस्क: **${s.heatLabel}** (महसूस ${s.heatFeels}°C).`,
          },
          {
            heading: 'चरम मौसम चेतावनी',
            body: s.extreme.map((e) => `• ${e}`).join('\n'),
          },
          {
            heading: 'आउटडोर सुझाव',
            body: s.bestOutdoor
              ? `सबसे अच्छी खिड़की ~**${s.bestOutdoor.time}** (${s.bestOutdoor.temp}°C, बारिश ${s.bestOutdoor.pop}%).\n` +
                s.recommendations.map((r) => `• ${r}`).join('\n')
              : s.recommendations.map((r) => `• ${r}`).join('\n'),
          },
          {
            heading: 'हीट नोटिफिकेशन',
            body:
              s.heatStress === 'high' || s.heatStress === 'extreme'
                ? `⚠️ दोपहर की असेंबली/मैराथन टालें। पानी ब्रेक अनिवार्य। UV: ${s.uv ?? '—'}.`
                : `हीट सामान्य दायरे में। UV: ${s.uv ?? '—'}. सामान्य जल व्यवस्था चलाएँ।`,
          },
        ],
        `विस्तार **School** टैब पर।`,
        0.89
      ),
      type: 'school',
    }
  }

  return {
    ...wrapSummary(
      `🏫 School mode — ${city}`,
      [
        {
          heading: 'Executive summary',
          body: `Outdoor activity: **${s.outdoorLabel}** (${s.outdoorScore}/100). Heat risk: **${s.heatLabel}** (feels ${s.heatFeels}°C).`,
        },
        {
          heading: 'Extreme weather warning',
          body: s.extreme.map((e) => `• ${e}`).join('\n'),
        },
        {
          heading: 'Outdoor recommendation',
          body: s.bestOutdoor
            ? `Best window ~**${s.bestOutdoor.time}** (${s.bestOutdoor.temp}°C, rain ${s.bestOutdoor.pop}%).\n` +
              s.recommendations.map((r) => `• ${r}`).join('\n')
            : s.recommendations.map((r) => `• ${r}`).join('\n'),
        },
        {
          heading: 'Heat-risk notification',
          body:
            s.heatStress === 'high' || s.heatStress === 'extreme'
              ? `⚠️ Defer midday assembly/marathon drills. Mandatory water breaks. UV: ${s.uv ?? '—'}.`
              : `Heat within a manageable band. UV: ${s.uv ?? '—'}. Normal hydration OK.`,
        },
      ],
      `Full detail on the **School** tab.`,
      0.89
    ),
    type: 'school',
  }
}

function generalAnswer(wx, lang) {
  const c = wx.current
  const city = cityName(wx, lang)
  const pred = buildPrediction(wx, lang)
  const alertLine =
    wx.alerts.length > 0
      ? lang === 'hi'
        ? `सक्रिय: **${wx.alerts[0].severity.toUpperCase()}** — ${wx.alerts[0].title_hi}`
        : `Active: **${wx.alerts[0].severity.toUpperCase()}** — ${wx.alerts[0].title}`
      : lang === 'hi'
        ? `कोई गंभीर चेतावनी नहीं`
        : `No severe warnings`

  if (lang === 'hi') {
    return {
      ...wrapSummary(
        `☁️ मौसम सारांश — ${city}`,
        [
          {
            heading: 'अभी',
            body: `**${c.temp}°C**, ${c.condition_hi} (महसूस ${c.feelsLike}°C). आज ${wx.daily[0].min}–${wx.daily[0].max}°C, बारिश संभावना ${wx.daily[0].pop}%.`,
          },
          { heading: 'अलर्ट', body: alertLine },
          { heading: 'आगे का रुझान', body: pred.headline },
          {
            heading: 'मैं क्या कर सकता हूँ',
            body:
              `मुझसे पूछें:\n` +
              `• बारिश / 5-दिन पूर्वानुमान / **भविष्यवाणी**\n` +
              `• **यात्रा मोड** (सड़क जोखिम, दृश्यता)\n` +
              `• **स्कूल मोड** (हीट, आउटडोर)\n` +
              `• सिंचाई / कृषि सलाह\n\n` +
              `हर जवाब स्रोत + विश्वास स्कोर के साथ आता है।`,
          },
        ],
        null,
        0.9
      ),
      type: 'general',
    }
  }

  return {
    ...wrapSummary(
      `☁️ Weather summary — ${city}`,
      [
        {
          heading: 'Right now',
          body: `**${c.temp}°C**, ${c.condition} (feels ${c.feelsLike}°C). Today ${wx.daily[0].min}–${wx.daily[0].max}°C, rain chance ${wx.daily[0].pop}%.`,
        },
        { heading: 'Alerts', body: alertLine },
        { heading: 'Forward look', body: pred.headline },
        {
          heading: 'What I can do',
          body:
            `Ask me about:\n` +
            `• Rain / 5-day forecast / **prediction**\n` +
            `• **Travel mode** (road risk, visibility)\n` +
            `• **School mode** (heat, outdoor PE)\n` +
            `• Irrigation / farm advice\n\n` +
            `Every answer includes sources + a confidence score.`,
        },
      ],
      null,
      0.9
    ),
    type: 'general',
  }
}

export async function chat(message, ctx) {
  const {
    weather: currentWx,
    lang: uiLang,
    fetchWeatherFor,
    cropContext = null,
    classified: preClassified = null,
  } = ctx
  const text = (message || '').trim()
  if (!text) {
    return {
      text: uiLang === 'hi' ? 'कृपया सवाल लिखें।' : 'Please type a question.',
      type: 'general',
      confidence: 1,
    }
  }

  const detected = detectLang(text)
  const lang = detected || uiLang

  // Prefer App-level classifier (runs before geocode); else classify here
  const classified = preClassified || classifyQuery(text, cropContext)

  // Crop entity first (including follow-ups: "will rain affect it?")
  let cropHit = classified.crop || detectCrop(text)
  if (!cropHit && cropContext?.cropId && isCropFollowUp(text)) {
    cropHit = getCropById(cropContext.cropId)
  }
  let intent = detectIntent(text)
  if (isCropRoute(classified)) {
    intent = 'crop'
  } else if (cropHit && intent === 'agri') {
    intent = 'crop'
  }

  if (intent === 'outofscope') {
    return {
      text:
        lang === 'hi'
          ? `## दायरे से बाहर\n\n### सारांश\nमरीन बुलेटिन / 30-वर्ष climate-change projection / कार्बन क्रेडिट इस बिल्ड में नहीं।\n\n### फोकस\nपूर्वानुमान, अलर्ट, कृषि, यात्रा, स्कूल, **जलवायु रुझान**, **NWP मॉडल**, लाइट उड़ान-सहायक मौसम।`
          : `## Out of scope\n\n### Summary\nMarine bulletins / 30-year climate-change projections / carbon credits are out of this build.\n\n### Focus\nForecasts, alerts, agri, travel, school, **climate trends**, **NWP models**, lite aviation-assist weather.`,
      type: 'outofscope',
      confidence: 0.99,
      chips:
        lang === 'hi'
          ? ['जलवायु रुझान', 'NWP मॉडल', 'मौसम भविष्यवाणी']
          : ['Climate trends', 'NWP models', 'Weather prediction'],
    }
  }

  let wx = currentWx

  // Place fetch rules from classifier — crop-only never geocodes
  if (isCropOnlyClassification(classified)) {
    // stay on currentWx — crop name must never become weather place
  } else if (classified.type === 'crop_location' || (!isCropRoute(classified) && classified.allowGeocode !== false)) {
    try {
      const mentioned = await extractCity(text, null)
      if (
        mentioned &&
        mentioned.id !== currentWx?.city?.id &&
        fetchWeatherFor &&
        !detectCrop(mentioned.name || '') &&
        !isCropToken(mentioned.name || '')
      ) {
        try {
          wx = await fetchWeatherFor(mentioned)
        } catch {
          wx = currentWx
        }
      }
    } catch {
      /* keep current */
    }
  }

  // Guard: never run answers against a city that is actually a crop name
  if (wx?.city && (detectCrop(wx.city.name || '') || isCropToken(wx.city.name || ''))) {
    wx = currentWx
  }

  let result
  switch (intent) {
    case 'crop':
      result = cropAnswer(wx, lang, cropHit || detectCrop(text), text)
      break
    case 'rain':
      result = rainAnswer(wx, lang)
      break
    case 'alert':
      result = alertAnswer(wx, lang)
      break
    case 'agri':
      result = agriAnswer(wx, lang, cropHit)
      break
    case 'forecast':
      result = forecastAnswer(wx, lang)
      break
    case 'predict':
      result = predictAnswer(wx, lang)
      break
    case 'travel':
      result = travelAnswer(wx, lang)
      break
    case 'school':
      result = schoolAnswer(wx, lang)
      break
    case 'climate':
      result = climateAnswer(wx, lang)
      break
    case 'models':
      result = modelsAnswer(wx, lang)
      break
    case 'aviation_lite':
      result = aviationLiteAnswer(wx, lang)
      break
    case 'temp':
    case 'wind':
      result = tempAnswer(wx, lang)
      break
    case 'hello':
      result = generalAnswer(wx, lang)
      break
    default:
      if (cropHit) {
        result = cropAnswer(wx, lang, cropHit, text)
      } else if (INTENTS.rain.test(text) && INTENTS.irrigate.test(text)) {
        result = agriAnswer(wx, lang)
      } else {
        result = generalAnswer(wx, lang)
      }
  }

  if (!wx) {
    result.source =
      lang === 'hi' ? 'स्रोत: मौसम अनुपलब्ध' : 'Source: weather unavailable'
    result.cityId = null
  } else {
    const mins = Math.max(1, Math.round((Date.now() - (wx.fetchedAt || Date.now())) / 60000))
    result.source = wx.live
      ? lang === 'hi'
        ? `स्रोत: Open-Meteo + IMD थ्रेशोल्ड · ${mins} मिनट पहले`
        : `Source: Open-Meteo + IMD thresholds · ${mins} min ago`
      : lang === 'hi'
        ? `स्रोत: ऑफ़लाइन पैक (डेमो-सेफ) · IMD थ्रेशोल्ड`
        : `Source: Offline pack (demo-safe) · IMD thresholds`
    result.cityId = result.type === 'crop' ? wx.city?.id : wx.city?.id
  }

  result.intent = intent
  result.lang = lang
  if (result.type === 'crop' && result.cropId) {
    result.chips =
      lang === 'hi'
        ? ['सिंचाई?', 'बारिश का असर?', 'छिड़काव?', 'कल का मौसम']
        : ['Irrigation?', 'Rain impact?', 'Spray window?', "Tomorrow's weather"]
  } else {
    result.chips =
      lang === 'hi'
        ? ['मौसम भविष्यवाणी', 'जलवायु रुझान', 'NWP मॉडल', 'सिंचाई?']
        : ['Weather prediction', 'Climate trends', 'NWP models', 'Irrigation?']
  }
  result.citations = wx?.sources || []

  return result
}

export function welcomeMessage(wx, lang) {
  const city = cityName(wx, lang)
  const cond = lang === 'hi' ? wx.current.condition_hi : wx.current.condition
  const pred = buildPrediction(wx, lang)
  const text =
    lang === 'hi'
      ? `## नमस्ते — ${city}\n\n### अभी\n**${wx.current.temp}°C**, ${cond}.\n\n### आगे\n${pred.headline}\n\n### पूछ सकते हैं\nबारिश, **भविष्यवाणी**, अलर्ट, सिंचाई, **यात्रा** या **स्कूल** मोड — हर जवाब विस्तृत सारांश + स्रोत के साथ।`
      : `## Namaste — ${city}\n\n### Right now\n**${wx.current.temp}°C**, ${cond}.\n\n### Ahead\n${pred.headline}\n\n### Ask me\nRain, **prediction**, alerts, irrigation, **travel** or **school** mode — every reply is a full summary with sources.`

  return {
    text,
    type: 'general',
    confidence: 0.95,
    source: wx.live
      ? lang === 'hi'
        ? 'स्रोत: Open-Meteo + IMD · लाइव'
        : 'Source: Open-Meteo + IMD · live'
      : lang === 'hi'
        ? 'स्रोत: ऑफ़लाइन पैक'
        : 'Source: Offline pack',
    chips:
      lang === 'hi'
        ? ['मौसम भविष्यवाणी', 'यात्रा जोखिम?', 'स्कूल आउटडोर?', 'कल बारिश?']
        : ['Weather prediction', 'Travel risk?', 'School outdoor?', "Tomorrow's rain?"],
    citations: wx.sources,
  }
}

/**
 * Public helper: which GEOGRAPHIC city does this message refer to?
 * Returns null for crop-only queries (wheat, rice, …) — never geocodes crops.
 * For "wheat in Kanpur" returns Kanpur only.
 */
export async function resolveMentionedCity(message, fallback = null) {
  if (isChatPlaceNoise(message)) return fallback
  const classified = classifyQuery(message, null)

  // crop-only / follow-up: no place entity
  if (isCropOnlyClassification(classified)) {
    return fallback
  }

  // crop + location: resolve location phrase only
  if (classified.type === 'crop_location' && classified.locationQuery) {
    return extractCity(message, fallback)
  }

  // Bare crop token safety
  const bare = String(message || '')
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:]+$/g, '')
  if (isCropToken(bare) || (detectCrop(bare) && bare.split(/\s+/).length <= 2)) {
    return fallback
  }

  return extractCity(message, fallback)
}

/** Expose classifier for App routing (before geocode/weather). */
export function classifyUserQuery(message, cropContext = null) {
  return classifyQuery(message, cropContext)
}

export {
  detectIntent,
  findCityLocal as findCity,
  wmoInfo,
  extractCityLocal,
  detectCrop,
  isCropQuestion,
  isCropToken,
  isCropFollowUp,
  getCropById,
  classifyQuery,
  isCropRoute,
  isCropOnlyClassification,
}
