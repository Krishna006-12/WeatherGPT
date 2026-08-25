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

/** Words that are never place names (voice + typed) */
const PLACE_STOP = new Set(
  [
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
  ].map((s) => s.toLowerCase())
)

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
  let phrase = raw.trim().replace(/[?.!,]+$/g, '')
  phrase = phrase
    .replace(
      /\b(right\s+now|rightnow|just\s+now|as\s+of\s+now|currently|today|tonight|tomorrow|kal|abhi|please|pls|now)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()

  // Drop trailing/leading stopwords token by token
  let parts = phrase.split(/\s+/).filter(Boolean)
  while (parts.length && PLACE_STOP.has(parts[parts.length - 1].toLowerCase())) parts.pop()
  while (parts.length && PLACE_STOP.has(parts[0].toLowerCase())) parts.shift()
  phrase = parts.join(' ').trim()
  if (!phrase || phrase.length < 2) return null
  if (PLACE_STOP.has(phrase.toLowerCase())) return null

  // Prefer first 1–3 tokens (city names rarely longer in speech)
  parts = phrase.split(/\s+/)
  if (parts.length > 3) phrase = parts.slice(0, 3).join(' ')

  return normalizePlaceQuery(phrase) || phrase
}

function guessPlacePhrase(text) {
  const patterns = [
    // "in Noida right now" → capture until end but cleaned later
    /\b(?:in|at|for|near|around)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.'-]{1,40})/i,
    /([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s.'-]{1,30})\s*(?:में|का|की|के|के\s*लिए)\b/,
    // "Noida irrigation" / "Dubai weather"
    /\b([A-Za-z][A-Za-z.'-]{2,24})(?:\s+(?:weather|rain|irrigation|forecast|alert|travel|school|temperature|aqi))?\b/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const phrase = cleanPlacePhrase(m[1])
      if (phrase && phrase.length >= 2) return phrase
    }
  }

  // Last resort: any alias token present
  const lower = text.toLowerCase()
  for (const alias of Object.keys(CITY_ALIASES)) {
    if (lower.includes(alias)) return CITY_ALIASES[alias]
  }
  return null
}

async function extractCity(text, fallback) {
  const local = extractCityLocal(text, null)
  if (local) return local
  const phrase = guessPlacePhrase(text)
  if (!phrase) return fallback
  try {
    const resolved = await resolveCity(phrase)
    return resolved || fallback
  } catch {
    return fallback
  }
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
              `• **आज:** ${t.pop}% संभावना · ~${t.rain} मिमी · ${t.condition_hi}\n` +
              `• **कल:** ${tmr.pop}% संभावना · ~${tmr.rain} मिमी · ${tmr.condition_hi}\n` +
              `• **5-दिन कुल वर्षा:** ~${wx.agri.forecastRain} मिमी`,
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
            `• **Today:** ${t.pop}% chance · ~${t.rain} mm · ${t.condition}\n` +
            `• **Tomorrow:** ${tmr.pop}% chance · ~${tmr.rain} mm · ${tmr.condition}\n` +
            `• **5-day total rainfall:** ~${wx.agri.forecastRain} mm`,
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

function agriAnswer(wx, lang) {
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
            body: `स्थानीय प्रोफ़ाइल फसलें: **${crops}**. गीले शिखर (${pred.peakRainDay ? (pred.peakRainDay.weekday_hi || pred.peakRainDay.weekday) : '—'}) के आसपास कटाई/सुखाई टालें।`,
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
          body: `Local crop profile: **${crops}**. Avoid harvest/drying around the wet peak (${pred.peakRainDay?.weekday || '—'}).`,
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
  const { weather: currentWx, lang: uiLang, fetchWeatherFor } = ctx
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
  const intent = detectIntent(text)

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
  const mentioned = await extractCity(text, null)
  if (mentioned && mentioned.id !== currentWx?.city?.id && fetchWeatherFor) {
    try {
      wx = await fetchWeatherFor(mentioned)
    } catch {
      wx = currentWx
    }
  }

  let result
  switch (intent) {
    case 'rain':
      result = rainAnswer(wx, lang)
      break
    case 'alert':
      result = alertAnswer(wx, lang)
      break
    case 'agri':
      result = agriAnswer(wx, lang)
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
      if (INTENTS.rain.test(text) && INTENTS.irrigate.test(text)) {
        result = agriAnswer(wx, lang)
      } else {
        result = generalAnswer(wx, lang)
      }
  }

  const mins = Math.max(1, Math.round((Date.now() - wx.fetchedAt) / 60000))
  result.source = wx.live
    ? lang === 'hi'
      ? `स्रोत: Open-Meteo + IMD थ्रेशोल्ड · ${mins} मिनट पहले`
      : `Source: Open-Meteo + IMD thresholds · ${mins} min ago`
    : lang === 'hi'
      ? `स्रोत: ऑफ़लाइन पैक (डेमो-सेफ) · IMD थ्रेशोल्ड`
      : `Source: Offline pack (demo-safe) · IMD thresholds`

  result.cityId = wx.city.id
  result.intent = intent
  result.lang = lang
  result.chips =
    lang === 'hi'
      ? ['मौसम भविष्यवाणी', 'जलवायु रुझान', 'NWP मॉडल', 'सिंचाई?']
      : ['Weather prediction', 'Climate trends', 'NWP models', 'Irrigation?']
  result.citations = wx.sources

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

/** Public helper: which city does this message refer to? (null = stay on current) */
export async function resolveMentionedCity(message, fallback = null) {
  return extractCity(message, fallback)
}

export { detectIntent, findCityLocal as findCity, wmoInfo, extractCityLocal }
