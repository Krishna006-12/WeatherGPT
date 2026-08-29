/**
 * Crop Intelligence — deterministic weather×crop signals.
 *
 * Output is risk levels + reasons + confidence + data basis.
 * NEVER claims guaranteed yield, diagnosis, or prescription.
 * Scientific crop-specific KB is limited to catalog + simple thresholds;
 * when insufficient, limitation is stated explicitly.
 *
 * Does not geocode. Callers must pass location weather pack separately.
 */

import { getCropById, detectCrop } from '../data/crops.js'
import {
  buildLockedWeatherFacts,
  cropSeasonCheck,
  monthInTz,
} from './ruleEngine.js'

export const CROP_SIGNAL_ENGINE = 'weathergpt.crop_signals.v1'

/** Risk / suitability levels — shared vocabulary */
export const LEVELS = {
  favourable: 'favourable',
  moderate: 'moderate',
  elevated: 'elevated',
  high: 'high',
  low: 'low',
  limited: 'limited',
  unsuitable: 'unsuitable',
  hold: 'hold',
  caution: 'caution',
}

const STAGE_ALIASES = [
  [/crown\s*root|cri\b/i, 'crown_root'],
  [/tiller/i, 'tillering'],
  [/joint|stem\s*elong|booting/i, 'jointing'],
  [/flower|bloom|anthesis|heading|silking|tassel/i, 'flowering'],
  [/milk\s*stage|grain\s*fill|pod\s*fill|tuber\s*bulk/i, 'grain_fill'],
  [/maturit|ripen|harvest\s*ready/i, 'maturity'],
  [/seedling|emerg/i, 'seedling'],
  [/vegetat|veg\b|knee/i, 'vegetative'],
  [/sow(ing)?|seed(ing)?\b|बुआई|बुवाई/i, 'sowing'],
  [/harvest|कटाई|मड़ाई/i, 'harvest'],
  [/transplant/i, 'transplant'],
]

/**
 * Parse optional growth stage from user text.
 * @returns {{ stage: string|null, source: string }}
 */
export function detectGrowthStage(text) {
  const t = String(text || '')
  if (!t.trim()) return { stage: null, source: 'none' }
  for (const [re, stage] of STAGE_ALIASES) {
    if (re.test(t)) return { stage, source: 'user_text' }
  }
  return { stage: null, source: 'none' }
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

/**
 * Pull observation scalars from weather pack or locked facts.
 */
export function extractWeatherInputs(wx, opts = {}) {
  const horizonHours = num(opts.horizonHours) ?? 24
  const facts =
    wx?.facts ||
    (wx?.current ? buildLockedWeatherFacts(wx) : null)

  const c = wx?.current || {}
  const d0 = wx?.daily?.[0] || {}
  const d1 = wx?.daily?.[1] || {}
  const hourly = Array.isArray(wx?.hourly) ? wx.hourly : []

  const temp = num(c.temp ?? facts?.current?.temp_c ?? d0.max)
  const humidity = num(c.humidity ?? facts?.current?.humidity)
  const wind = num(c.wind ?? facts?.current?.wind_kmh ?? d0.wind)
  const pop = num(d0.pop ?? facts?.rain?.today?.probability_pct) ?? 0
  const rain = num(d0.rain ?? facts?.rain?.today?.amount_mm) ?? 0
  const popTmr = num(d1.pop ?? facts?.rain?.tomorrow?.probability_pct)
  const rainTmr = num(d1.rain ?? facts?.rain?.tomorrow?.amount_mm)
  const next5 = num(facts?.rain?.next5_mm)
  const rain3 =
    num(
      (wx?.daily || []).slice(0, 3).reduce((a, d) => a + (num(d.rain) || 0), 0),
    ) ?? next5
  const tmax = num(d0.max)
  const tmin = num(d0.min)
  const code = num(c.code ?? d0.code)
  const soil = facts?.agri?.soil_level || wx?.agri?.soil?.level || null
  const live = wx?.live !== false && !wx?.demo && !wx?.synthetic

  // Hourly POP max next horizon
  let popHorizon = pop
  const hSlice = hourly.slice(0, Math.min(48, Math.ceil(horizonHours)))
  const hPops = hSlice.map((h) => num(h.pop)).filter((x) => x != null)
  if (hPops.length) popHorizon = Math.max(pop, ...hPops)

  const hasWx = !!(wx?.current && (wx?.daily?.[0] || temp != null))

  return {
    hasWx,
    live: !!live,
    location: {
      id: wx?.city?.id || null,
      name: wx?.city?.name || null,
      name_hi: wx?.city?.name_hi || null,
      lat: wx?.city?.lat ?? null,
      lon: wx?.city?.lon ?? null,
      tz: wx?.timezone || wx?.city?.tz || 'Asia/Kolkata',
    },
    temp_c: temp,
    humidity_pct: humidity,
    wind_kmh: wind,
    pop_pct: pop,
    rain_mm: rain,
    pop_tomorrow_pct: popTmr,
    rain_tomorrow_mm: rainTmr,
    rain_next3d_mm: rain3,
    pop_horizon_pct: popHorizon,
    tmax_c: tmax,
    tmin_c: tmin,
    weather_code: code,
    soil_level: soil,
    horizon_hours: horizonHours,
    fetched_at: wx?.fetchedAt || null,
    source: wx?.liveSource || wx?.source || (hasWx ? 'weather_pack' : null),
    facts,
  }
}

function mkSignal(id, level, opts = {}) {
  return {
    id,
    level,
    label_en: opts.label_en || id,
    label_hi: opts.label_hi || id,
    reasons: opts.reasons || [],
    reasons_hi: opts.reasons_hi || opts.reasons || [],
    confidence: clamp01(opts.confidence ?? 0.7),
    data_basis: opts.data_basis || [],
    limitation: opts.limitation || null,
    limitation_hi: opts.limitation_hi || null,
    // never "guaranteed"
    certainty: 'signal_only',
  }
}

/** Crop-specific heat thresholds (general N India plains heuristics — not lab trials). */
const CROP_THRESH = {
  wheat: { heat: 34, severe_heat: 38, cold: 5, humid_fungal: 75 },
  rice: { heat: 36, severe_heat: 40, cold: 12, humid_fungal: 80 },
  paddy: { heat: 36, severe_heat: 40, cold: 12, humid_fungal: 80 },
  potato: { heat: 30, severe_heat: 35, cold: 2, humid_fungal: 80 },
  mustard: { heat: 32, severe_heat: 36, cold: 4, humid_fungal: 78 },
  maize: { heat: 35, severe_heat: 40, cold: 8, humid_fungal: 80 },
  tomato: { heat: 34, severe_heat: 38, cold: 8, humid_fungal: 80 },
  cotton: { heat: 38, severe_heat: 42, cold: 12, humid_fungal: 75 },
  sugarcane: { heat: 38, severe_heat: 42, cold: 8, humid_fungal: 80 },
  onion: { heat: 35, severe_heat: 40, cold: 5, humid_fungal: 78 },
}

function threshFor(cropId) {
  return (
    CROP_THRESH[cropId] || {
      heat: 35,
      severe_heat: 40,
      cold: 5,
      humid_fungal: 80,
    }
  )
}

function irrigationSignal(w, crop, stage) {
  const basis = []
  const reasons = []
  const reasons_hi = []
  if (!w.hasWx) {
    return mkSignal('irrigation', LEVELS.limited, {
      label_en: 'Irrigation suitability',
      label_hi: 'सिंचाई उपयुक्तता',
      reasons: ['No local weather pack — cannot score irrigation window.'],
      reasons_hi: ['स्थानीय मौसम नहीं — सिंचाई स्कोर नहीं।'],
      confidence: 0.35,
      data_basis: [],
      limitation: 'Requires temperature, rainfall probability, and recent/forecast rain.',
      limitation_hi: 'तापमान, वर्षा संभावना और बारिश डेटा चाहिए।',
    })
  }
  basis.push('pop_pct', 'rain_mm', 'temp_c', 'soil_level', 'horizon')
  let level = LEVELS.moderate
  let conf = 0.72

  if (w.pop_pct >= 55 || w.rain_mm >= 8 || (w.rain_next3d_mm != null && w.rain_next3d_mm >= 25)) {
    level = LEVELS.hold
    reasons.push(
      `Elevated rain signal (POP ~${w.pop_pct}%, today ~${w.rain_mm} mm) — consider holding irrigation.`,
    )
    reasons_hi.push(
      `ऊँची बारिश संकेत (POP ~${w.pop_pct}%, आज ~${w.rain_mm} मिमी) — सिंचाई टालने पर विचार।`,
    )
  } else if (w.soil_level === 'high') {
    level = LEVELS.hold
    reasons.push('Modelled soil moisture band already high — avoid adding water without field check.')
    reasons_hi.push('मॉडल मिट्टी नमी उच्च — खेत जाँच के बिना पानी न जोड़ें।')
  } else if (
    (w.soil_level === 'low' || w.soil_level == null) &&
    w.pop_pct < 30 &&
    w.rain_mm < 2 &&
    w.temp_c != null &&
    w.temp_c >= 33
  ) {
    level = LEVELS.favourable
    reasons.push('Dry + heat signal — light irrigation may help if crop shows stress (field check required).')
    reasons_hi.push('सूखा + गर्मी संकेत — तनाव दिखे तो हल्की सिंचाई (खेत जाँच ज़रूरी)।')
  } else if (w.pop_pct >= 35 && w.pop_pct < 55) {
    level = LEVELS.caution
    reasons.push('Moderate rain chance — prefer waiting if irrigation is not stage-critical.')
    reasons_hi.push('मध्यम बारिश संभावना — अवस्था-गंभीर न हो तो प्रतीक्षा बेहतर।')
  } else {
    level = LEVELS.moderate
    reasons.push('No strong rain pulse — irrigation optional based on soil feel / stage.')
    reasons_hi.push('तेज़ बारिश संकेत नहीं — मिट्टी/अवस्था अनुसार सिंचाई वैकल्पिक।')
  }

  if (stage?.stage === 'harvest' || stage?.stage === 'maturity') {
    reasons.push('User stage suggests maturity/harvest — extra water often undesirable.')
    reasons_hi.push('उपयोगकर्ता अवस्था पकना/कटाई — अतिरिक्त पानी अक्सर अनुपयुक्त।')
    if (level === LEVELS.favourable) level = LEVELS.caution
    conf = Math.min(conf, 0.65)
  } else if (stage?.stage && ['flowering', 'grain_fill', 'silking'].includes(stage.stage)) {
    reasons.push(`Noted stage “${stage.stage}” — moisture sensitivity may be higher; still verify field.`)
    reasons_hi.push(`अवस्था “${stage.stage}” — नमी संवेदनशीलता अधिक हो सकती है; खेत जाँचें।`)
    basis.push('growth_stage_user')
  } else if (!stage?.stage) {
    reasons.push('Growth stage not provided — irrigation is weather-context only.')
    reasons_hi.push('फसल अवस्था नहीं दी — केवल मौसम संदर्भ।')
  }

  if (!w.soil_level) {
    conf -= 0.08
    reasons.push('No soil-sensor input — confidence reduced.')
    reasons_hi.push('मिट्टी सेंसर नहीं — विश्वसनीयता कम।')
  }

  return mkSignal('irrigation', level, {
    label_en: 'Irrigation suitability',
    label_hi: 'सिंचाई उपयुक्तता',
    reasons,
    reasons_hi,
    confidence: conf,
    data_basis: basis,
    limitation:
      'Not a prescription. Soil moisture probes and crop stage beat model rain alone.',
    limitation_hi: 'नुस्खा नहीं। मिट्टी सेंसर व अवस्था मॉडल बारिश से ऊपर।',
  })
}

function rainfallRiskSignal(w) {
  if (!w.hasWx) {
    return mkSignal('rainfall_risk', LEVELS.limited, {
      label_en: 'Rainfall risk',
      label_hi: 'वर्षा जोखिम',
      reasons: ['Weather pack missing.'],
      reasons_hi: ['मौसम पैक नहीं।'],
      confidence: 0.3,
      data_basis: [],
    })
  }
  let level = LEVELS.low
  const reasons = []
  const reasons_hi = []
  if (w.pop_pct >= 70 || w.rain_mm >= 15 || (w.weather_code != null && w.weather_code >= 95)) {
    level = LEVELS.high
  } else if (w.pop_pct >= 50 || w.rain_mm >= 6) {
    level = LEVELS.elevated
  } else if (w.pop_pct >= 30 || w.rain_mm >= 1.5) {
    level = LEVELS.moderate
  }
  reasons.push(
    `Today POP ~${w.pop_pct}% · rain ~${w.rain_mm} mm` +
      (w.pop_tomorrow_pct != null ? ` · tomorrow POP ~${w.pop_tomorrow_pct}%` : ''),
  )
  reasons_hi.push(
    `आज POP ~${w.pop_pct}% · बारिश ~${w.rain_mm} मिमी` +
      (w.pop_tomorrow_pct != null ? ` · कल POP ~${w.pop_tomorrow_pct}%` : ''),
  )
  return mkSignal('rainfall_risk', level, {
    label_en: 'Rainfall risk',
    label_hi: 'वर्षा जोखिम',
    reasons,
    reasons_hi,
    confidence: 0.8,
    data_basis: ['pop_pct', 'rain_mm', 'forecast_daily'],
  })
}

function diseaseFungalSignal(w, cropId) {
  const th = threshFor(cropId)
  if (!w.hasWx) {
    return mkSignal('disease_fungal', LEVELS.limited, {
      label_en: 'Disease / fungal risk (signal)',
      label_hi: 'रोग / फफूंद जोखिम (संकेत)',
      reasons: ['Need humidity + temperature + wetness proxies.'],
      reasons_hi: ['नमी + तापमान + गीलापन संकेत चाहिए।'],
      confidence: 0.3,
      data_basis: [],
      limitation: 'Not a diagnosis. No lab or field scouting data.',
      limitation_hi: 'निदान नहीं। लैब/खेत स्काउटिंग नहीं।',
    })
  }
  const reasons = []
  const reasons_hi = []
  const basis = ['humidity_pct', 'temp_c', 'pop_pct', 'rain_mm']
  let score = 0
  const hum = w.humidity_pct
  const temp = w.temp_c
  if (hum != null && hum >= th.humid_fungal) score += 2
  else if (hum != null && hum >= th.humid_fungal - 10) score += 1
  if (w.pop_pct >= 60 || w.rain_mm >= 5) score += 2
  else if (w.pop_pct >= 40 || w.rain_mm >= 2) score += 1
  if (temp != null && temp >= 15 && temp <= 30) score += 1
  if (cropId === 'potato' || cropId === 'tomato' || cropId === 'grapes') {
    basis.push('crop_kb_blight_humidity')
    if (score >= 3) {
      reasons.push(
        'Warm-moist pattern may favour foliar fungal/bacterial pressure for this crop family — scout; not diagnosed here.',
      )
      reasons_hi.push(
        'गर्म-नम पैटर्न पत्ती फफूंद/जीवाणु दबाव बढ़ा सकता है — स्काउट करें; यहाँ निदान नहीं।',
      )
    }
  } else if (cropId === 'wheat' || cropId === 'mustard') {
    basis.push('crop_kb_general_humid')
    if (score >= 3) {
      reasons.push('Humid/wet signal can favour rust/mildew-type pressure in season — confirm with KVK/IPM.')
      reasons_hi.push('नम/गीला संकेत सीजन में रतुआ/मिल्ड्यू-प्रकार दबाव — KVK/IPM से पुष्टि।')
    }
  } else if (!CROP_THRESH[cropId]) {
    return mkSignal('disease_fungal', LEVELS.limited, {
      label_en: 'Disease / fungal risk (signal)',
      label_hi: 'रोग / फफूंद जोखिम (संकेत)',
      reasons: [
        'No crop-specific disease model in catalog for this crop — only generic wetness note.',
      ],
      reasons_hi: ['इस फसल का विशिष्ट रोग मॉडल नहीं — केवल सामान्य गीलापन नोट।'],
      confidence: 0.45,
      data_basis: basis,
      limitation:
        'Crop-specific scientific disease curves not available in this build for this id.',
      limitation_hi: 'इस id के लिए फसल-विशेष वैज्ञानिक रोग वक्र उपलब्ध नहीं।',
    })
  }

  let level = LEVELS.low
  if (score >= 5) level = LEVELS.high
  else if (score >= 3) level = LEVELS.elevated
  else if (score >= 2) level = LEVELS.moderate

  if (!reasons.length) {
    reasons.push(
      hum != null
        ? `Humidity ~${hum}%, POP ~${w.pop_pct}% — limited wetness pressure right now.`
        : `POP ~${w.pop_pct}% · rain ~${w.rain_mm} mm — humidity missing, weaker signal.`,
    )
    reasons_hi.push(
      hum != null
        ? `नमी ~${hum}%, POP ~${w.pop_pct}% — अभी सीमित गीलापन दबाव।`
        : `POP ~${w.pop_pct}% · बारिश ~${w.rain_mm} मिमी — नमी गायब, कमज़ोर संकेत।`,
    )
  }
  if (hum == null) {
    reasons.push('Humidity absent — fungal confidence reduced.')
    reasons_hi.push('नमी अनुपलब्ध — फफूंद विश्वसनीयता कम।')
  }

  return mkSignal('disease_fungal', level, {
    label_en: 'Disease / fungal risk (signal)',
    label_hi: 'रोग / फफूंद जोखिम (संकेत)',
    reasons,
    reasons_hi,
    confidence: hum == null ? 0.55 : 0.7,
    data_basis: basis,
    limitation:
      'May favour disease pressure only — not pathogen ID, severity, or spray prescription.',
    limitation_hi: 'केवल अनुकूल परिस्थितियाँ — रोग पहचान/तीव्रता/स्प्रे नुस्खा नहीं।',
  })
}

function sprayingSignal(w) {
  if (!w.hasWx) {
    return mkSignal('spraying', LEVELS.limited, {
      label_en: 'Spraying suitability',
      label_hi: 'छिड़काव उपयुक्तता',
      reasons: ['Need wind + rain probability.'],
      reasons_hi: ['हवा + वर्षा संभावना चाहिए।'],
      confidence: 0.3,
      data_basis: [],
      limitation: 'Always follow product label, PHI, and local extension.',
      limitation_hi: 'हमेशा लेबल, PHI और स्थानीय सलाह मानें।',
    })
  }
  const reasons = []
  const reasons_hi = []
  let level = LEVELS.favourable
  if (w.pop_pct >= 55 || w.rain_mm >= 4 || (w.pop_tomorrow_pct != null && w.pop_tomorrow_pct >= 65)) {
    level = LEVELS.unsuitable
    reasons.push('Rain wash-off risk elevated — consider delaying foliar spray.')
    reasons_hi.push('बारिश धुलन जोखिम — पर्णीय स्प्रे टालने पर विचार।')
  } else if (w.wind_kmh != null && w.wind_kmh >= 20) {
    level = LEVELS.unsuitable
    reasons.push(`Wind ~${w.wind_kmh} km/h — drift risk; prefer calm morning.`)
    reasons_hi.push(`हवा ~${w.wind_kmh} किमी/घं — बहाव जोखिम; शांत सुबह बेहतर।`)
  } else if (w.pop_pct >= 35 || (w.wind_kmh != null && w.wind_kmh >= 14)) {
    level = LEVELS.caution
    reasons.push('Moderate wind or rain chance — narrow spray window.')
    reasons_hi.push('मध्यम हवा/बारिश संभावना — संकीर्ण स्प्रे विंडो।')
  } else {
    reasons.push('Relatively calm / lower wash-off signal — still check label & bees/PHI.')
    reasons_hi.push('सापेक्ष शांत / कम धुलन संकेत — फिर भी लेबल व PHI जाँचें।')
  }
  reasons.push('Not a chemical recommendation — weather window only.')
  reasons_hi.push('रसायन सलाह नहीं — केवल मौसम विंडो।')
  return mkSignal('spraying', level, {
    label_en: 'Spraying suitability',
    label_hi: 'छिड़काव उपयुक्तता',
    reasons,
    reasons_hi,
    confidence: 0.78,
    data_basis: ['wind_kmh', 'pop_pct', 'rain_mm'],
    limitation: 'No product, dose, or pest ID. Label + KVK override this signal.',
    limitation_hi: 'उत्पाद/खुराक/कीट ID नहीं। लेबल + KVK ऊपर।',
  })
}

function harvestSignal(w, cropId, stage, seasonCheck) {
  if (!w.hasWx) {
    return mkSignal('harvest', LEVELS.limited, {
      label_en: 'Harvest suitability',
      label_hi: 'कटाई उपयुक्तता',
      reasons: ['Weather missing.'],
      reasons_hi: ['मौसम नहीं।'],
      confidence: 0.3,
      data_basis: [],
    })
  }
  const reasons = []
  const reasons_hi = []
  let level = LEVELS.moderate
  const inHarvestCal = seasonCheck?.phase === 'harvest_window'
  if (w.pop_pct >= 55 || w.rain_mm >= 5) {
    level = LEVELS.unsuitable
    reasons.push('Wet signal — harvest/threshing quality risk if grain/produce is exposed.')
    reasons_hi.push('गीला संकेत — खुली उपज/अनाज पर कटाई-मड़ाई जोखिम।')
  } else if (w.pop_pct >= 35) {
    level = LEVELS.caution
    reasons.push('Some rain chance — protect harvested produce; watch windows.')
    reasons_hi.push('कुछ बारिश संभावना — कटी उपज बचाएँ।')
  } else {
    level = LEVELS.favourable
    reasons.push('Drier signal for field harvest operations (still verify crop maturity).')
    reasons_hi.push('खेत कटाई के लिए सूखा संकेत (पकना फिर भी जाँचें)।')
  }
  if (stage?.stage === 'harvest' || stage?.stage === 'maturity') {
    reasons.push('User indicated harvest/maturity stage.')
    reasons_hi.push('उपयोगकर्ता ने कटाई/पकना बताया।')
  } else if (inHarvestCal) {
    reasons.push('Calendar suggests harvest window for this crop in many N/Central zones.')
    reasons_hi.push('कैलेंडर कई उत्तरी/मध्य क्षेत्रों में कटाई विंडो सुझाता है।')
  } else if (seasonCheck?.mismatch) {
    reasons.push('Calendar mismatch — harvest suitability is weather-only, not seasonal endorsement.')
    reasons_hi.push('कैलेंडर मिसमैच — कटाई केवल मौसम, सीजन समर्थन नहीं।')
    level = level === LEVELS.favourable ? LEVELS.caution : level
  }
  if (cropId === 'onion' || cropId === 'potato') {
    reasons.push('Bulb/tuber crops often need dry curing — rain raises storage risk.')
    reasons_hi.push('कंद/बल्ब फसलों को सूखी सुखाई — बारिश भंडारण जोखिम।')
  }
  return mkSignal('harvest', level, {
    label_en: 'Harvest suitability',
    label_hi: 'कटाई उपयुक्तता',
    reasons,
    reasons_hi,
    confidence: stage?.stage ? 0.74 : 0.62,
    data_basis: ['pop_pct', 'rain_mm', 'season_calendar', stage?.stage ? 'growth_stage_user' : null].filter(
      Boolean,
    ),
    limitation: 'Does not know actual crop maturity, labour, or market timing.',
    limitation_hi: 'वास्तविक पकना, श्रम या बाज़ार समय नहीं जानता।',
  })
}

function sowingSignal(w, cropId, stage, seasonCheck) {
  if (!w.hasWx) {
    return mkSignal('sowing', LEVELS.limited, {
      label_en: 'Sowing suitability',
      label_hi: 'बुआई उपयुक्तता',
      reasons: ['Weather missing.'],
      reasons_hi: ['मौसम नहीं।'],
      confidence: 0.3,
      data_basis: [],
    })
  }
  const reasons = []
  const reasons_hi = []
  let level = LEVELS.moderate
  if (seasonCheck?.phase === 'sowing_window') {
    level = LEVELS.favourable
    reasons.push('Within typical sowing calendar window (regional).')
    reasons_hi.push('सामान्य बुआई कैलेंडर विंडो में (क्षेत्रीय)।')
  } else if (seasonCheck?.mismatch) {
    level = LEVELS.unsuitable
    reasons.push(seasonCheck.message_en || 'Outside typical season window.')
    reasons_hi.push(seasonCheck.message_hi || 'सामान्य सीजन विंडो से बाहर।')
  } else if (seasonCheck?.phase === 'growing') {
    level = LEVELS.caution
    reasons.push('Growing phase on calendar — late sowing only with local advice.')
    reasons_hi.push('कैलेंडर पर वृद्धि चरण — देर बुआई केवल स्थानीय सलाह से।')
  }

  if (w.rain_mm >= 20 || w.pop_pct >= 75) {
    if (level === LEVELS.favourable) level = LEVELS.caution
    reasons.push('Heavy wet signal may delay field access / seedbed work.')
    reasons_hi.push('भारी गीला संकेत खेत/बीज बैड काम टाल सकता है।')
  }
  if (w.temp_c != null && w.temp_c >= 40) {
    level = LEVELS.caution
    reasons.push('Extreme heat — seedling stress risk if sown now without moisture plan.')
    reasons_hi.push('भीषण गर्मी — नमी योजना बिना अंकुर तनाव।')
  }
  if (stage?.stage === 'sowing') {
    reasons.push('User asked in sowing context.')
    reasons_hi.push('उपयोगकर्ता बुआई संदर्भ।')
  }
  reasons.push('Variety, soil, and irrigation availability not modelled.')
  reasons_hi.push('किस्म, मिट्टी, सिंचाई उपलब्धता मॉडल में नहीं।')

  return mkSignal('sowing', level, {
    label_en: 'Sowing suitability',
    label_hi: 'बुआई उपयुक्तता',
    reasons,
    reasons_hi,
    confidence: seasonCheck?.calendar ? 0.7 : 0.5,
    data_basis: ['season_calendar', 'temp_c', 'pop_pct', 'rain_mm'],
    limitation:
      seasonCheck?.calendar
        ? 'Calendar is generalized N/Central India — local microclimate may differ.'
        : 'No fixed calendar entry for this crop — sowing signal is weak/generic.',
    limitation_hi: seasonCheck?.calendar
      ? 'कैलेंडर सामान्यीकृत — स्थानीय भिन्नता संभव।'
      : 'इस फसल का तय कैलेंडर नहीं — बुआई संकेत कमज़ोर।',
  })
}

function heatColdSignal(w, cropId) {
  const th = threshFor(cropId)
  if (!w.hasWx || w.temp_c == null) {
    return mkSignal('heat_cold_stress', LEVELS.limited, {
      label_en: 'Heat / cold stress',
      label_hi: 'गर्मी / ठंड तनाव',
      reasons: ['Temperature unavailable.'],
      reasons_hi: ['तापमान उपलब्ध नहीं।'],
      confidence: 0.3,
      data_basis: [],
    })
  }
  const t = w.temp_c
  const reasons = []
  const reasons_hi = []
  let level = LEVELS.low
  if (t >= th.severe_heat) {
    level = LEVELS.high
    reasons.push(
      `Temp ~${t}°C ≥ severe-heat heuristic (${th.severe_heat}°C) for ${cropId || 'crop'} — stress may rise if soil dry.`,
    )
    reasons_hi.push(`ताप ~${t}°C — भीषण गर्मी संकेत; मिट्टी सूखी हो तो तनाव।`)
  } else if (t >= th.heat) {
    level = LEVELS.elevated
    reasons.push(`Temp ~${t}°C in elevated heat band (heuristic ${th.heat}°C+).`)
    reasons_hi.push(`ताप ~${t}°C ऊँची गर्मी बैंड में।`)
  } else if (t <= th.cold) {
    level = LEVELS.elevated
    reasons.push(`Temp ~${t}°C at/under cold heuristic (${th.cold}°C).`)
    reasons_hi.push(`ताप ~${t}°C ठंड संकेत पर/नीचे।`)
  } else if (w.tmin_c != null && w.tmin_c <= th.cold) {
    level = LEVELS.moderate
    reasons.push(`Tonight/min ~${w.tmin_c}°C — watch cold pockets.`)
    reasons_hi.push(`न्यूनतम ~${w.tmin_c}°C — ठंड जेबों पर नज़र।`)
  } else {
    reasons.push(`Temp ~${t}°C within mild band for generic ${cropId || 'crop'} heuristics.`)
    reasons_hi.push(`ताप ~${t}°C सामान्य हल्के बैंड में।`)
  }
  if (!CROP_THRESH[cropId]) {
    reasons.push('Using generic thresholds — crop-specific trial data not loaded.')
    reasons_hi.push('सामान्य थ्रेशहोल्ड — फसल-विशेष ट्रायल डेटा नहीं।')
  }
  return mkSignal('heat_cold_stress', level, {
    label_en: 'Heat / cold stress',
    label_hi: 'गर्मी / ठंड तनाव',
    reasons,
    reasons_hi,
    confidence: CROP_THRESH[cropId] ? 0.72 : 0.55,
    data_basis: ['temp_c', 'tmin_c', 'crop_heat_thresholds'],
    limitation: 'Heuristics only — not ICAR trial curves for every variety/zone.',
    limitation_hi: 'केवल ह्यूरिस्टिक — हर किस्म/क्षेत्र ICAR वक्र नहीं।',
  })
}

/**
 * Full deterministic crop intelligence bundle.
 *
 * @param {object} opts
 * @param {object|null} opts.crop - catalog crop or null
 * @param {object|null} opts.weather - weather pack for location
 * @param {string} [opts.userText]
 * @param {string} [opts.growthStage] explicit stage override
 * @param {number} [opts.horizonHours=24]
 * @param {string} [opts.lang='en']
 */
export function buildCropSignals({
  crop = null,
  weather = null,
  userText = '',
  growthStage = null,
  horizonHours = 24,
  lang = 'en',
} = {}) {
  const cropObj =
    typeof crop === 'string' ? getCropById(crop) || detectCrop(crop) : crop
  const stage = growthStage
    ? { stage: String(growthStage), source: 'explicit' }
    : detectGrowthStage(userText)

  const w = extractWeatherInputs(weather, { horizonHours })
  const cropId = cropObj?.id || null

  const seasonCheck = cropId
    ? cropSeasonCheck(cropId, {
        tz: w.location.tz,
        at: w.fetched_at || Date.now(),
      })
    : {
        inSeason: true,
        mismatch: false,
        phase: 'unknown',
        message_en: 'No crop selected.',
        message_hi: 'फसल चयन नहीं।',
        calendar: null,
        month: monthInTz(w.location.tz, w.fetched_at || Date.now()),
      }

  const signals = {
    irrigation: irrigationSignal(w, cropObj, stage),
    rainfall_risk: rainfallRiskSignal(w),
    disease_fungal: diseaseFungalSignal(w, cropId),
    spraying: sprayingSignal(w),
    harvest: harvestSignal(w, cropId, stage, seasonCheck),
    sowing: sowingSignal(w, cropId, stage, seasonCheck),
    heat_cold_stress: heatColdSignal(w, cropId),
  }

  // Overall confidence: mean of signal confidences, downweight if no wx / unknown crop
  const confs = Object.values(signals).map((s) => s.confidence)
  let overall = confs.reduce((a, b) => a + b, 0) / (confs.length || 1)
  if (!w.hasWx) overall = Math.min(overall, 0.5)
  if (!cropId) overall = Math.min(overall, 0.45)
  if (!w.live) overall = Math.min(overall, 0.65)

  const limitations = []
  const limitations_hi = []
  if (!cropId) {
    limitations.push('Crop not recognised — signals are weather-generic only.')
    limitations_hi.push('फसल पहचानी नहीं — केवल सामान्य मौसम संकेत।')
  }
  if (!w.hasWx) {
    limitations.push('No location weather — provide city or use current dashboard location.')
    limitations_hi.push('लोकेशन मौसम नहीं — शहर दें या डैशबोर्ड स्थान।')
  }
  if (!stage.stage) {
    limitations.push('Growth stage not provided — stage-critical advice is weaker.')
    limitations_hi.push('फसल अवस्था नहीं — अवस्था-गंभीर सलाह कमज़ोर।')
  }
  if (cropId && !CROP_THRESH[cropId]) {
    limitations.push(
      `Limited crop-specific scientific thresholds for “${cropId}” — generic heuristics used.`,
    )
    limitations_hi.push(`“${cropId}” के सीमित वैज्ञानिक थ्रेशहोल्ड — सामान्य ह्यूरिस्टिक।`)
  }
  limitations.push(
    'Not guaranteed agronomic facts. Not yield prediction, pest ID, or chemical prescription. Confirm KVK/SAU/field.',
  )
  limitations_hi.push(
    'गारंटीशुदा कृषि तथ्य नहीं। उपज/कीट पहचान/रसायन नुस्खा नहीं। KVK/SAU/खेत से पुष्टि।',
  )

  const kb = cropObj
    ? {
        id: cropObj.id,
        name_en: cropObj.name_en,
        name_hi: cropObj.name_hi,
        season_en: cropObj.season_en,
        season_hi: cropObj.season_hi,
        has_catalog: true,
      }
    : { id: null, has_catalog: false }

  return {
    ok: true,
    engine: CROP_SIGNAL_ENGINE,
    schema: 'weathergpt.crop_intelligence.v1',
    crop: kb,
    location: w.location,
    growth_stage: stage,
    season: seasonCheck,
    weather_inputs: {
      temp_c: w.temp_c,
      humidity_pct: w.humidity_pct,
      rainfall_mm: w.rain_mm,
      pop_pct: w.pop_pct,
      wind_kmh: w.wind_kmh,
      horizon_hours: w.horizon_hours,
      rain_next3d_mm: w.rain_next3d_mm,
      live: w.live,
      source: w.source,
      has_weather: w.hasWx,
    },
    signals,
    overall_confidence: Math.round(overall * 100) / 100,
    limitations,
    limitations_hi,
    honesty:
      lang === 'hi'
        ? 'ये सत्यापित मौसम×फसल संकेत हैं — गारंटी नहीं। AI को इन्हें समझाना है, नए कृषि तथ्य गढ़ने नहीं।'
        : 'Verified weather×crop signals — not guarantees. AI should explain these, not invent agronomy.',
  }
}

/**
 * Format signals as markdown sections for chat UI (same card style as before).
 */
export function formatCropSignalsMarkdown(bundle, lang = 'en') {
  const hi = lang === 'hi'
  const cropName = bundle.crop?.has_catalog
    ? hi
      ? bundle.crop.name_hi
      : bundle.crop.name_en
    : hi
      ? 'अज्ञात फसल'
      : 'Unknown crop'
  const city =
    (hi ? bundle.location?.name_hi : null) ||
    bundle.location?.name ||
    (hi ? 'वर्तमान स्थान' : 'current location')

  const w = bundle.weather_inputs || {}
  const wxLine = w.has_weather
    ? hi
      ? `**${w.temp_c ?? '—'}°C** · नमी ${w.humidity_pct ?? '—'}% · POP ~**${w.pop_pct ?? '—'}%** · बारिश ~**${w.rainfall_mm ?? '—'}** मिमी · हवा ${w.wind_kmh ?? '—'} किमी/घं · क्षितिज ${w.horizon_hours}घं`
      : `**${w.temp_c ?? '—'}°C** · humidity ${w.humidity_pct ?? '—'}% · POP ~**${w.pop_pct ?? '—'}%** · rain ~**${w.rainfall_mm ?? '—'}** mm · wind ${w.wind_kmh ?? '—'} km/h · horizon ${w.horizon_hours}h`
    : hi
      ? 'मौसम डेटा लोड नहीं — सामान्य नोट्स'
      : 'Weather not loaded — general notes only'

  const levelWord = (level) => {
    const map = {
      favourable: hi ? 'अनुकूल' : 'Favourable',
      moderate: hi ? 'मध्यम' : 'Moderate',
      elevated: hi ? 'ऊँचा' : 'Elevated',
      high: hi ? 'उच्च' : 'High',
      low: hi ? 'कम' : 'Low',
      limited: hi ? 'सीमित डेटा' : 'Limited data',
      unsuitable: hi ? 'अनुपयुक्त' : 'Unsuitable',
      hold: hi ? 'रोकें / प्रतीक्षा' : 'Hold / wait',
      caution: hi ? 'सावधानी' : 'Caution',
    }
    return map[level] || level
  }

  const order = [
    'irrigation',
    'rainfall_risk',
    'disease_fungal',
    'spraying',
    'harvest',
    'sowing',
    'heat_cold_stress',
  ]

  const signalLines = order
    .map((id) => {
      const s = bundle.signals[id]
      if (!s) return null
      const why = (hi ? s.reasons_hi : s.reasons)?.[0] || ''
      const conf = Math.round((s.confidence || 0) * 100)
      return (
        `• **${hi ? s.label_hi : s.label_en}**: **${levelWord(s.level)}**` +
        ` · ${hi ? 'विश्वास' : 'conf'} ${conf}%` +
        (why ? `\n  — ${why}` : '') +
        (s.limitation && (id === 'disease_fungal' || id === 'spraying' || id === 'irrigation')
          ? `\n  — _${hi ? s.limitation_hi || s.limitation : s.limitation}_`
          : '')
      )
    })
    .filter(Boolean)
    .join('\n')

  const season = bundle.season || {}
  const seasonBody = hi
    ? `${season.mismatch ? '⚠️ **सीजन मिसमैच:** ' : '✓ '}${season.message_hi || '—'}` +
      (bundle.growth_stage?.stage
        ? `\n• अवस्था (उपयोगकर्ता): **${bundle.growth_stage.stage}**`
        : `\n• अवस्था: _नहीं दी_`)
    : `${season.mismatch ? '⚠️ **Season mismatch:** ' : '✓ '}${season.message_en || '—'}` +
      (bundle.growth_stage?.stage
        ? `\n• Stage (user): **${bundle.growth_stage.stage}**`
        : `\n• Stage: _not provided_`)

  const lims = (hi ? bundle.limitations_hi : bundle.limitations) || []
  const basis = w.source
    ? hi
      ? `स्रोत/आधार: ${w.source}${w.live ? ' · लाइव पैक' : ' · कैश/गैर-लाइव'}`
      : `Source/basis: ${w.source}${w.live ? ' · live pack' : ' · cached/non-live'}`
    : hi
      ? 'स्रोत: मौसम पैक अनुपलब्ध'
      : 'Source: weather pack unavailable'

  const sections = [
    {
      heading: hi ? 'संदर्भ' : 'Context',
      body: `**${cropName}** · 📍 **${city}**\n${wxLine}\n${basis}`,
    },
    {
      heading: hi ? 'संकेत (जोखिम / उपयुक्तता)' : 'Signals (risk / suitability)',
      body: signalLines,
    },
    {
      heading: hi ? 'सीजन व अवस्था' : 'Season & stage',
      body: seasonBody,
    },
    {
      heading: hi ? 'सीमाएँ व ईमानदारी' : 'Limitations & honesty',
      body:
        lims.map((x) => `• ${x}`).join('\n') +
        `\n• ${hi ? 'समग्र विश्वास' : 'Overall confidence'}: **${Math.round(
          (bundle.overall_confidence || 0) * 100,
        )}%** (signals only, not a guarantee)`,
    },
  ]

  // Catalog tip (KB text) as optional note — clearly labeled general knowledge
  if (bundle.crop?.has_catalog) {
    const tip = hi
      ? getCropById(bundle.crop.id)?.rain_hi
      : getCropById(bundle.crop.id)?.rain_en
    if (tip) {
      sections.splice(3, 0, {
        heading: hi ? 'कैटलॉग नोट (सामान्य)' : 'Catalog note (general)',
        body: tip + (hi ? '\n_(स्थिर KB — इस स्थान का माप नहीं)_' : '\n_(static KB — not a measurement for this place)_'),
      })
    }
  }

  return {
    title: hi ? `🌾 फसल बुद्धिमत्ता — ${cropName}` : `🌾 Crop Intelligence — ${cropName}`,
    sections,
  }
}

/** Level label helper for legacy callers */
export function signalLevelLabel(lang, key) {
  const hi = lang === 'hi'
  const map = {
    favourable: hi ? 'अनुकूल' : 'Favourable',
    moderate: hi ? 'मध्यम' : 'Moderate',
    elevated: hi ? 'ऊँचा' : 'Elevated',
    high: hi ? 'उच्च' : 'High',
    low: hi ? 'कम' : 'Low',
    limited: hi ? 'सीमित डेटा' : 'Limited data',
    unsuitable: hi ? 'अनुपयुक्त' : 'Unsuitable',
    hold: hi ? 'रोकें' : 'Hold',
    caution: hi ? 'सावधानी' : 'Caution',
    watch: hi ? 'निगरानी' : 'Watch',
  }
  return map[key] || key
}
