/**
 * WeatherGPT Rule Engine — review-driven grounding layer.
 *
 * Goals (chat review PDF):
 * 1) One locked weather facts JSON (LLM never invents numbers)
 * 2) Honest WMO interpretation (no hail "guarantees")
 * 3) Separate rain probability / amount / intensity
 * 4) Crop calendar season mismatch (wheat in August → rabi flag)
 * 5) Conditional agri advice + disease "may favour" only
 * 6) City comparison only with complete packs
 * 7) Source / model / timestamp honesty
 * 8) Hindi = translate locked payload, never recalculate
 */

/** Official-ish WMO weather interpretation codes (Open-Meteo / WMO 4677 subset) */
export const WMO_TABLE = {
  0: {
    en: 'Clear sky',
    hi: 'साफ आसमान',
    icon: 'sun',
    severity: 'green',
    hail: false,
    storm: false,
    note_en: 'No precipitation implied.',
    note_hi: 'वर्षा निहित नहीं।',
  },
  1: {
    en: 'Mainly clear',
    hi: 'मुख्यतः साफ',
    icon: 'sun',
    severity: 'green',
    hail: false,
    storm: false,
  },
  2: {
    en: 'Partly cloudy',
    hi: 'आंशिक बादल',
    icon: 'cloud-sun',
    severity: 'green',
    hail: false,
    storm: false,
  },
  3: {
    en: 'Overcast',
    hi: 'घने बादल',
    icon: 'cloud',
    severity: 'green',
    hail: false,
    storm: false,
  },
  45: {
    en: 'Fog',
    hi: 'कोहरा',
    icon: 'cloud-fog',
    severity: 'yellow',
    hail: false,
    storm: false,
  },
  48: {
    en: 'Depositing rime fog',
    hi: 'पाला-युक्त कोहरा',
    icon: 'cloud-fog',
    severity: 'yellow',
    hail: false,
    storm: false,
  },
  51: {
    en: 'Light drizzle',
    hi: 'हल्की फुहार',
    icon: 'cloud-drizzle',
    severity: 'yellow',
    hail: false,
    storm: false,
    intensity: 'light',
  },
  53: {
    en: 'Drizzle',
    hi: 'फुहार',
    icon: 'cloud-drizzle',
    severity: 'yellow',
    hail: false,
    storm: false,
    intensity: 'moderate',
  },
  55: {
    en: 'Dense drizzle',
    hi: 'घनी फुहार',
    icon: 'cloud-drizzle',
    severity: 'amber',
    hail: false,
    storm: false,
    intensity: 'heavy',
  },
  56: {
    en: 'Light freezing drizzle',
    hi: 'हल्की जमने वाली फुहार',
    icon: 'cloud-drizzle',
    severity: 'amber',
    hail: false,
    storm: false,
  },
  57: {
    en: 'Dense freezing drizzle',
    hi: 'घनी जमने वाली फुहार',
    icon: 'cloud-drizzle',
    severity: 'amber',
    hail: false,
    storm: false,
  },
  61: {
    en: 'Slight rain',
    hi: 'हल्की बारिश',
    icon: 'cloud-rain',
    severity: 'yellow',
    hail: false,
    storm: false,
    intensity: 'light',
  },
  63: {
    en: 'Moderate rain',
    hi: 'मध्यम बारिश',
    icon: 'cloud-rain',
    severity: 'amber',
    hail: false,
    storm: false,
    intensity: 'moderate',
  },
  65: {
    en: 'Heavy rain',
    hi: 'तेज़ बारिश',
    icon: 'cloud-rain',
    severity: 'amber',
    hail: false,
    storm: false,
    intensity: 'heavy',
  },
  66: {
    en: 'Light freezing rain',
    hi: 'हल्की जमने वाली बारिश',
    icon: 'cloud-rain',
    severity: 'amber',
    hail: false,
    storm: false,
  },
  67: {
    en: 'Heavy freezing rain',
    hi: 'तेज़ जमने वाली बारिश',
    icon: 'cloud-rain',
    severity: 'red',
    hail: false,
    storm: false,
    intensity: 'heavy',
  },
  71: {
    en: 'Slight snow fall',
    hi: 'हल्की बर्फबारी',
    icon: 'snow',
    severity: 'yellow',
    hail: false,
    storm: false,
  },
  73: {
    en: 'Moderate snow fall',
    hi: 'मध्यम बर्फबारी',
    icon: 'snow',
    severity: 'amber',
    hail: false,
    storm: false,
  },
  75: {
    en: 'Heavy snow fall',
    hi: 'भारी बर्फबारी',
    icon: 'snow',
    severity: 'red',
    hail: false,
    storm: false,
  },
  77: {
    en: 'Snow grains',
    hi: 'बर्फ के दाने',
    icon: 'snow',
    severity: 'yellow',
    hail: false,
    storm: false,
  },
  80: {
    en: 'Slight rain showers',
    hi: 'हल्की बौछारें',
    icon: 'cloud-rain',
    severity: 'yellow',
    hail: false,
    storm: false,
    intensity: 'light',
  },
  81: {
    en: 'Moderate rain showers',
    hi: 'मध्यम बौछारें',
    icon: 'cloud-rain',
    severity: 'amber',
    hail: false,
    storm: false,
    intensity: 'moderate',
  },
  82: {
    en: 'Violent rain showers',
    hi: 'तेज़ बौछारें',
    icon: 'cloud-rain',
    severity: 'red',
    hail: false,
    storm: false,
    intensity: 'violent',
  },
  85: {
    en: 'Slight snow showers',
    hi: 'हल्की बर्फ बौछार',
    icon: 'snow',
    severity: 'yellow',
    hail: false,
    storm: false,
  },
  86: {
    en: 'Heavy snow showers',
    hi: 'भारी बर्फ बौछार',
    icon: 'snow',
    severity: 'amber',
    hail: false,
    storm: false,
  },
  /**
   * WMO 95 = Thunderstorm (slight/moderate) — does NOT guarantee hail.
   * WMO 96/99 = Thunderstorm with slight/heavy hail — model may suggest hail POSSIBLE, not observed.
   */
  95: {
    en: 'Thunderstorm',
    hi: 'आंधी-तूफान',
    icon: 'cloud-lightning',
    severity: 'amber',
    hail: false,
    hailPossible: false,
    storm: true,
    note_en:
      'Thunderstorm conditions possible. Hail is NOT implied by code 95. Official IMD warnings override model colour.',
    note_hi:
      'तूफान संभव। कोड 95 से ओले की गारंटी नहीं। आधिकारिक IMD चेतावनी प्राथमिक।',
  },
  96: {
    en: 'Thunderstorm · hail possible (model)',
    hi: 'तूफान · ओले संभव (मॉडल)',
    icon: 'cloud-lightning',
    severity: 'red',
    hail: false,
    hailPossible: true,
    storm: true,
    note_en:
      'Model class includes hail risk — NOT a confirmed hail event. Treat as elevated storm watch until IMD/local warning.',
    note_hi:
      'मॉडल में ओला जोखिम वर्ग — पुष्ट ओला घटना नहीं। IMD/स्थानीय चेतावनी तक उन्नत तूफान वॉच।',
  },
  99: {
    en: 'Severe thunderstorm · heavy hail possible (model)',
    hi: 'गंभीर तूफान · भारी ओले संभव (मॉडल)',
    icon: 'cloud-lightning',
    severity: 'red',
    hail: false,
    hailPossible: true,
    storm: true,
    note_en:
      'Highest model storm/hail class — still a forecast signal, not a ground-truth hail report.',
    note_hi:
      'उच्चतम मॉडल तूफान/ओला वर्ग — पूर्वानुमान संकेत, ज़मीनी ओला रिपोर्ट नहीं।',
  },
}

export function wmoLookup(code) {
  const c = Number(code)
  if (WMO_TABLE[c]) return { ...WMO_TABLE[c], code: c }
  // Fallback bands
  if (c >= 95) return { ...WMO_TABLE[95], code: c }
  if (c >= 80) return { ...WMO_TABLE[80], code: c }
  if (c >= 70) return { ...WMO_TABLE[71], code: c }
  if (c >= 60) return { ...WMO_TABLE[61], code: c }
  if (c >= 50) return { ...WMO_TABLE[51], code: c }
  if (c >= 40) return { ...WMO_TABLE[45], code: c }
  return { ...WMO_TABLE[2], code: Number.isFinite(c) ? c : 2 }
}

export function wmoInfoHonest(code, lang = 'en') {
  const info = wmoLookup(code)
  return {
    condition: lang === 'hi' ? info.hi : info.en,
    icon: info.icon,
    severity: info.severity,
    code: info.code,
    hailPossible: !!info.hailPossible,
    storm: !!info.storm,
    note: lang === 'hi' ? info.note_hi || null : info.note_en || null,
    intensity: info.intensity || null,
  }
}

/** Rain intensity from expected mm (period amount) — separate from probability */
export function rainIntensityFromMm(mm, hours = 24) {
  const m = Math.max(0, Number(mm) || 0)
  const rate = hours > 0 ? m / hours : m
  // thresholds: light / moderate / heavy / violent (guidance, not IMD official)
  if (m < 0.1 && rate < 0.05) return { id: 'none', en: 'None / dry', hi: 'शुष्क / नगण्य' }
  if (m < 2.5 || rate < 0.5) return { id: 'light', en: 'Light', hi: 'हल्की' }
  if (m < 7.5 || rate < 4) return { id: 'moderate', en: 'Moderate', hi: 'मध्यम' }
  if (m < 50 || rate < 8) return { id: 'heavy', en: 'Heavy', hi: 'तेज़' }
  return { id: 'violent', en: 'Very heavy', hi: 'बहुत तेज़' }
}

/**
 * Day-representative POP calibration (not raw hourly max as "chance of rain").
 * Keeps probability SEPARATE from amount + intensity labels.
 */
export function calibratePop(rawPop, rainMm = 0, code = 0) {
  let p = Number(rawPop)
  if (!Number.isFinite(p)) p = 0
  p = Math.max(0, Math.min(100, p))
  const mm = Math.max(0, Number(rainMm) || 0)
  const c = Number(code) || 0

  if (c >= 95) return Math.round(Math.min(92, Math.max(p * 0.92, 55 + Math.min(mm, 40))))
  if (c >= 80 && c < 90) {
    const base = p * 0.85
    const fromMm = mm < 0.2 ? 18 : mm < 1 ? 35 : mm < 5 ? 55 : mm < 15 ? 70 : 82
    return Math.round(Math.min(88, Math.max(fromMm, base * 0.7 + fromMm * 0.3)))
  }
  if (mm < 0.1) {
    if (p >= 70) return Math.min(28, Math.round(p * 0.25 + 5))
    if (p >= 40) return Math.min(22, Math.round(p * 0.35))
    return Math.round(Math.min(p, 15))
  }
  if (mm < 0.5) return Math.round(Math.min(42, p * 0.45 + 8))
  if (mm < 2) return Math.round(Math.min(58, p * 0.55 + 12 + mm * 4))
  if (mm < 8) return Math.round(Math.min(78, p * 0.7 + 10 + mm * 1.5))
  if (mm < 25) return Math.round(Math.min(88, Math.max(p * 0.85, 50 + mm)))
  return Math.round(Math.min(94, Math.max(p * 0.9, 70)))
}

export function dayPopFrom(dailyPopMax, rainMm, code, hourlyPopsForDay = []) {
  const raw = dailyPopMax ?? 0
  let peakHourly = raw
  if (hourlyPopsForDay.length) {
    const finite = hourlyPopsForDay.filter((n) => Number.isFinite(n))
    if (finite.length) {
      const sorted = [...finite].sort((a, b) => a - b)
      const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))
      const p75 = sorted[idx]
      const mx = sorted[sorted.length - 1]
      peakHourly = Math.round(p75 * 0.65 + mx * 0.35)
    }
  }
  const blendedRaw = Math.round((Number(raw) || 0) * 0.55 + peakHourly * 0.45)
  return calibratePop(blendedRaw || raw, rainMm, code)
}

/* ─── Crop calendar (N. India / general India guidance — ICAR-style windows) ─── */

/**
 * Sowing windows are approximate guidance for North/Central India plains.
 * month: 1–12. Always flag mismatch rather than inventing "ok to sow wheat in Aug".
 */
export const CROP_CALENDAR = {
  wheat: {
    season: 'rabi',
    sowMonths: [10, 11, 12],
    harvestMonths: [3, 4],
    activeGrowMonths: [10, 11, 12, 1, 2, 3, 4],
    regionsNote_en: 'Cool-season rabi cereal (N. India plains typical).',
    regionsNote_hi: 'शीत-ऋतु रबी अनाज (उत्तर भारत मैदान सामान्य)।',
  },
  barley: {
    season: 'rabi',
    sowMonths: [10, 11, 12],
    harvestMonths: [3, 4],
    activeGrowMonths: [10, 11, 12, 1, 2, 3, 4],
  },
  mustard: {
    season: 'rabi',
    sowMonths: [9, 10, 11],
    harvestMonths: [2, 3],
    activeGrowMonths: [9, 10, 11, 12, 1, 2, 3],
  },
  chickpea: {
    season: 'rabi',
    sowMonths: [10, 11],
    harvestMonths: [2, 3],
    activeGrowMonths: [10, 11, 12, 1, 2, 3],
  },
  potato: {
    season: 'rabi',
    sowMonths: [10, 11],
    harvestMonths: [1, 2, 3],
    activeGrowMonths: [10, 11, 12, 1, 2, 3],
  },
  rice: {
    season: 'kharif',
    sowMonths: [6, 7, 8],
    harvestMonths: [10, 11],
    activeGrowMonths: [6, 7, 8, 9, 10, 11],
  },
  maize: {
    season: 'kharif',
    sowMonths: [6, 7],
    harvestMonths: [9, 10],
    activeGrowMonths: [6, 7, 8, 9, 10],
  },
  millet: {
    season: 'kharif',
    sowMonths: [6, 7],
    harvestMonths: [9, 10],
    activeGrowMonths: [6, 7, 8, 9, 10],
  },
  sorghum: {
    season: 'kharif',
    sowMonths: [6, 7],
    harvestMonths: [9, 10, 11],
    activeGrowMonths: [6, 7, 8, 9, 10, 11],
  },
  cotton: {
    season: 'kharif',
    sowMonths: [4, 5, 6],
    harvestMonths: [10, 11, 12],
    activeGrowMonths: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  sugarcane: {
    season: 'long',
    sowMonths: [1, 2, 3, 9, 10],
    harvestMonths: [11, 12, 1, 2, 3],
    activeGrowMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  onion: {
    season: 'rabi',
    sowMonths: [10, 11, 12],
    harvestMonths: [3, 4],
    activeGrowMonths: [10, 11, 12, 1, 2, 3, 4],
  },
  tomato: {
    season: 'multi',
    sowMonths: [6, 7, 8, 9, 10, 11],
    harvestMonths: [1, 2, 3, 10, 11, 12],
    activeGrowMonths: [1, 2, 3, 6, 7, 8, 9, 10, 11, 12],
  },
  soybean: {
    season: 'kharif',
    sowMonths: [6, 7],
    harvestMonths: [9, 10],
    activeGrowMonths: [6, 7, 8, 9, 10],
  },
  groundnut: {
    season: 'kharif',
    sowMonths: [6, 7],
    harvestMonths: [9, 10],
    activeGrowMonths: [6, 7, 8, 9, 10],
  },
  pigeonpea: {
    season: 'kharif',
    sowMonths: [6, 7],
    harvestMonths: [12, 1],
    activeGrowMonths: [6, 7, 8, 9, 10, 11, 12, 1],
  },
}

const MONTH_EN = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const MONTH_HI = [
  '',
  'जनवरी',
  'फ़रवरी',
  'मार्च',
  'अप्रैल',
  'मई',
  'जून',
  'जुलाई',
  'अगस्त',
  'सितंबर',
  'अक्टूबर',
  'नवंबर',
  'दिसंबर',
]

export function monthInTz(tz = 'Asia/Kolkata', at = Date.now()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: tz })
    return Number(fmt.format(new Date(at)))
  } catch {
    return new Date(at).getMonth() + 1
  }
}

/**
 * @returns {{ inSeason: boolean, mismatch: boolean, phase: string, message_en: string, message_hi: string, calendar: object|null }}
 */
export function cropSeasonCheck(cropId, { month = null, tz = 'Asia/Kolkata', at = Date.now() } = {}) {
  const cal = CROP_CALENDAR[cropId]
  const m = month || monthInTz(tz, at)
  if (!cal) {
    return {
      inSeason: true,
      mismatch: false,
      phase: 'unknown',
      message_en: 'No fixed calendar entry — treat as general guidance only.',
      message_hi: 'निर्धारित कैलेंडर नहीं — केवल सामान्य मार्गदर्शन।',
      calendar: null,
      month: m,
    }
  }
  const sow = cal.sowMonths.includes(m)
  const harvest = cal.harvestMonths.includes(m)
  const grow = cal.activeGrowMonths.includes(m)
  let phase = 'off_season'
  if (sow) phase = 'sowing_window'
  else if (harvest) phase = 'harvest_window'
  else if (grow) phase = 'growing'
  const mismatch = !grow && !sow && !harvest
  const monEn = MONTH_EN[m] || String(m)
  const monHi = MONTH_HI[m] || String(m)
  const sowEn = cal.sowMonths.map((x) => MONTH_EN[x]).join(', ')
  const sowHi = cal.sowMonths.map((x) => MONTH_HI[x]).join(', ')

  let message_en
  let message_hi
  if (mismatch) {
    message_en =
      `${monEn} is outside the typical ${cal.season} window for this crop in much of North/Central India. ` +
      `Usual sowing: ${sowEn}. Advice below is weather-context only — not a recommendation to sow/harvest now. Confirm with local KVK/SAU.`
    message_hi =
      `${monHi} इस फसल की सामान्य ${cal.season === 'rabi' ? 'रबी' : cal.season === 'kharif' ? 'खरीफ' : ''} अवधि से बाहर (उत्तर/मध्य भारत)। ` +
      `सामान्य बुआई: ${sowHi}। नीचे केवल मौसम संदर्भ है — अभी बुआई/कटाई की सिफारिश नहीं। स्थानीय KVK/कृषि विश्वविद्यालय से पुष्टि करें।`
  } else if (sow) {
    message_en = `${monEn} overlaps a typical sowing window (${sowEn}). Still verify variety, soil moisture and local advisory.`
    message_hi = `${monHi} सामान्य बुआई खिड़की से मिलती है (${sowHi})। किस्म, नमी व स्थानीय सलाह जाँचें।`
  } else if (harvest) {
    message_en = `${monEn} is near a typical harvest window — weather risk to grain quality matters most.`
    message_hi = `${monHi} सामान्य कटाई खिड़की के पास — अनाज गुणवत्ता पर मौसम जोखिम महत्वपूर्ण।`
  } else {
    message_en = `${monEn} is within a typical growing period for this ${cal.season} crop.`
    message_hi = `${monHi} इस ${cal.season === 'rabi' ? 'रबी' : cal.season === 'kharif' ? 'खरीफ' : ''} फसल की सामान्य वृद्धि अवधि में है।`
  }

  return {
    inSeason: !mismatch,
    mismatch,
    phase,
    season: cal.season,
    message_en,
    message_hi,
    calendar: cal,
    month: m,
  }
}

/** IPM-style: conditions may favour — never diagnose disease */
export function diseaseRiskNotes(cropId, wxFacts, lang = 'en') {
  const hi = lang === 'hi'
  const notes = []
  if (!wxFacts?.current) return notes
  const hum = Number(wxFacts.current.humidity)
  const pop = Number(wxFacts.rain?.today?.probability_pct)
  const rain = Number(wxFacts.rain?.today?.amount_mm)
  const temp = Number(wxFacts.current.temp_c)

  const wet =
    (Number.isFinite(hum) && hum >= 80) ||
    (Number.isFinite(pop) && pop >= 60) ||
    (Number.isFinite(rain) && rain >= 5)

  if (cropId === 'potato' && wet && temp >= 15 && temp <= 28) {
    notes.push(
      hi
        ? 'नमी/बारिश संकेत: लेट ब्लाइट जैसी बीमारियों के लिए अनुकूल परिस्थितियाँ बन सकती हैं — निदान नहीं। खेत निगरानी + KVK/IPM सलाह।'
        : 'Wet/humid signal: conditions may favour late-blight–type pressure — not a diagnosis. Scout fields; follow KVK/IPM guidance.',
    )
  }
  if ((cropId === 'tomato' || cropId === 'potato') && wet && temp >= 24) {
    notes.push(
      hi
        ? 'गर्म + नम संकेत: जीवाणु/फफूंद दबाव बढ़ सकता है — पुष्टि प्रयोगशाला/विशेषज्ञ से।'
        : 'Warm + wet signal: bacterial/fungal pressure may increase — confirm with local expert, not this app.',
    )
  }
  if (cropId === 'rice' && wet && temp >= 26) {
    notes.push(
      hi
        ? 'नम/उष्ण संकेत: कुछ धान रोगों के लिए अनुकूल हो सकता है — स्काउटिंग करें।'
        : 'Humid/warm signal: may favour some paddy diseases — scout; no automatic diagnosis.',
    )
  }
  if (cropId === 'wheat' && Number.isFinite(temp) && temp >= 32) {
    notes.push(
      hi
        ? 'उच्च तापमान संकेत: दाना भरने पर तनाव संभव (टर्मिनल हीट) — मिट्टी नमी देखें।'
        : 'High temperature signal: grain-fill stress possible (terminal heat) — check soil moisture.',
    )
  }
  return notes
}

/**
 * Conditional spray / fertilizer rules — never "ban all chemicals forever".
 */
export function chemicalWindowAdvice(wxFacts, lang = 'en') {
  const hi = lang === 'hi'
  const pop = Number(wxFacts?.rain?.today?.probability_pct) || 0
  const rain = Number(wxFacts?.rain?.today?.amount_mm) || 0
  const wind = Number(wxFacts?.current?.wind_kmh) || 0
  const nextPop = Number(wxFacts?.rain?.tomorrow?.probability_pct) || 0

  if (pop >= 60 || rain >= 5 || nextPop >= 65) {
    return {
      spray: hi
        ? 'अगले ~24–48 घं में बारिश संकेत — पर्णीय छिड़काव टालने पर विचार (धुलने का जोखिम)। लेबल/स्थानीय सलाह देखें।'
        : 'Rain signal next ~24–48h — consider delaying foliar sprays (wash-off risk). Check product label & local advice.',
      fertilizer: hi
        ? 'सभी उर्वरक बंद नहीं — केवल सतह छिड़काव/यूरिया टॉप-ड्रेस अगर भारी धुलन जोखिम हो तो टालें। लेबल व मिट्टी जाँचें।'
        : 'Not a blanket ban on all fertilizer — delay foliar/top-dress if heavy wash-off risk. Follow label & soil test.',
      ok: false,
    }
  }
  if (wind >= 20) {
    return {
      spray: hi
        ? `हवा ~${wind} किमी/घं — बहाव जोखिम; छिड़काव शांत सुबह में।`
        : `Wind ~${wind} km/h — drift risk; prefer calm morning spray.`,
      fertilizer: hi
        ? 'हवा अधिक हो तो छिड़काव-रूप उर्वरक सावधानी से।'
        : 'High wind: be careful with spray-form nutrients.',
      ok: false,
    }
  }
  if (pop < 35 && rain < 1 && wind < 15) {
    return {
      spray: hi
        ? 'सुबह का शांत/सूखा संकेत — छिड़काव विंडो अपेक्षाकृत अनुकूल (फिर भी लेबल देखें)।'
        : 'Calm/drier morning signal — relatively favourable spray window (still check label).',
      fertilizer: hi
        ? 'मौसम पक्ष अनुकूल; मात्रा मिट्टी/फसल अवस्था पर निर्भर — यहाँ सेंसर नहीं।'
        : 'Weather side OK; rates depend on soil/crop stage — no on-farm sensors here.',
      ok: true,
    }
  }
  return {
    spray: hi
      ? 'मिश्रित संकेत — छोटे स्लॉट में काम; लेबल व स्थानीय सलाह।'
      : 'Mixed signal — short work slots; label + local advice.',
    fertilizer: hi
      ? 'सामान्य सावधानी — वर्षा/हवा दोनों देखें।'
      : 'Standard caution — watch both rain and wind.',
    ok: null,
  }
}

/** Irrigation flags — weather-based only unless stage known */
export function irrigationFlags(wxFacts, { cropStage = null, soilKnown = false } = {}) {
  const pop = Number(wxFacts?.rain?.today?.probability_pct) || 0
  const rain = Number(wxFacts?.rain?.today?.amount_mm) || 0
  const next5 = Number(wxFacts?.rain?.next5_mm) || 0
  const soil = wxFacts?.agri?.soil_level || 'medium'
  const temp = Number(wxFacts?.current?.temp_c)

  let action = 'monitor'
  let reason_en = 'Weather-based only — soil moisture sensors / crop stage not provided.'
  let reason_hi = 'केवल मौसम आधारित — मिट्टी सेंसर/फसल अवस्था यहाँ नहीं।'

  if (pop >= 55 || rain >= 8 || next5 >= 40 || soil === 'high') {
    action = 'hold'
    reason_en = 'Elevated rain / wet soil signal — consider holding irrigation.'
    reason_hi = 'ऊँची बारिश/गीली मिट्टी संकेत — सिंचाई टालने पर विचार।'
  } else if (soil === 'low' && pop < 25 && rain < 1 && (temp >= 33 || next5 < 10)) {
    action = 'light'
    reason_en = 'Dry + heat/low rain signal — light irrigation only if crop shows stress.'
    reason_hi = 'सूखा + गर्मी/कम बारिश — तनाव दिखे तो हल्की सिंचाई।'
  } else if (cropStage) {
    reason_en = `Weather signal moderate; you noted stage “${cropStage}” — still verify field moisture.`
    reason_hi = `मौसम मध्यम; अवस्था “${cropStage}” बताई — फिर भी खेत नमी जाँचें।`
  }

  return {
    action,
    reason_en,
    reason_hi,
    soilKnown: !!soilKnown,
    cropStage: cropStage || null,
    disclaimer_en:
      'Irrigation guidance is weather-proxy only unless soil moisture & crop stage are provided.',
    disclaimer_hi:
      'सिंचाई सलाह मौसम-प्रॉक्सी है जब तक मिट्टी नमी व फसल अवस्था न दी जाए।',
  }
}

/**
 * Best-crop-now: suitability engine FIRST (calendar + rain/heat), never free invent.
 */
export function bestCropsNow({ month, tz = 'Asia/Kolkata', wxFacts = null, limit = 4 } = {}) {
  const m = month || monthInTz(tz)
  const scored = []
  for (const [id, cal] of Object.entries(CROP_CALENDAR)) {
    const check = cropSeasonCheck(id, { month: m, tz })
    if (check.mismatch) continue
    let score = check.phase === 'sowing_window' ? 90 : check.phase === 'growing' ? 70 : 55
    const rain = Number(wxFacts?.rain?.next5_mm)
    const temp = Number(wxFacts?.current?.temp_c)
    if (cal.season === 'kharif' && Number.isFinite(rain) && rain > 5) score += 5
    if (cal.season === 'rabi' && Number.isFinite(temp) && temp < 30) score += 5
    if (cal.season === 'rabi' && Number.isFinite(temp) && temp > 36) score -= 15
    scored.push({
      id,
      score,
      phase: check.phase,
      season: cal.season,
      message_en: check.message_en,
      message_hi: check.message_hi,
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return {
    month: m,
    month_en: MONTH_EN[m],
    month_hi: MONTH_HI[m],
    crops: scored.slice(0, limit),
    note_en:
      'Rule-engine sowing-window shortlist for general N/Central India — not soil-test or market advice. Confirm KVK/SAU.',
    note_hi:
      'नियम इंजन बुआई-खिड़की शॉर्टलिस्ट (सामान्य उत्तर/मध्य भारत) — मिट्टी जाँच/बाज़ार सलाह नहीं। KVK पुष्टि करें।',
  }
}

/**
 * Locked facts blob — single source of truth for UI + LLM + Hindi translate.
 * Numbers only from weather pack; never regenerated per language.
 */
export function buildLockedWeatherFacts(wx, { model = null } = {}) {
  if (!wx?.current) return null
  const c = wx.current
  const d0 = wx.daily?.[0] || {}
  const d1 = wx.daily?.[1] || {}
  const wmo = wmoInfoHonest(c.code, 'en')
  const intensity = rainIntensityFromMm(d0.rain, 24)
  const fetchedAt = wx.fetchedAt || Date.now()
  const tz = wx.timezone || wx.city?.tz || 'Asia/Kolkata'

  const daily = (wx.daily || []).slice(0, 7).map((d) => {
    const di = wmoInfoHonest(d.code, 'en')
    const inten = rainIntensityFromMm(d.rain, 24)
    return {
      date: d.date,
      weekday: d.weekday,
      weekday_hi: d.weekday_hi,
      temp_max_c: d.max,
      temp_min_c: d.min,
      // SEPARATE rain fields
      rain_probability_pct: d.pop,
      rain_probability_raw_peak_pct: d.popRaw ?? null,
      rain_amount_mm: d.rain,
      rain_intensity: inten.id,
      rain_intensity_en: inten.en,
      rain_intensity_hi: inten.hi,
      wmo_code: d.code,
      condition_en: d.condition,
      condition_hi: d.condition_hi,
      hail_possible: !!di.hailPossible,
      storm: !!di.storm,
      wmo_note_en: di.note,
      wind_kmh: d.wind,
      uv: d.uv ?? null,
    }
  })

  const hourly = (wx.hourly || []).slice(0, 24).map((h) => ({
    time: h.time,
    label: h.label,
    temp_c: h.temp,
    rain_probability_pct: h.pop,
    rain_amount_mm: h.rain ?? h.precip ?? 0,
    wmo_code: h.code,
    icon: h.icon,
  }))

  const facts = {
    schema: 'weathergpt.facts.v1',
    locked: true,
    place: {
      id: wx.city?.id || null,
      name: wx.city?.name || null,
      name_hi: wx.city?.name_hi || null,
      state: wx.city?.state || null,
      country: wx.city?.countryShort || wx.city?.country || null,
      lat: wx.city?.lat,
      lon: wx.city?.lon,
      tz,
    },
    meta: {
      fetched_at_ms: fetchedAt,
      fetched_at_iso: new Date(fetchedAt).toISOString(),
      timezone: tz,
      live: !!wx.live,
      offline: !wx.live,
      units: { temp: 'C', wind: 'km/h', precip: 'mm', pop: 'percent' },
      model: model || wx.model || wx.liveSource || 'open-meteo',
      api: 'Open-Meteo Forecast API (model grid — not a personal weather station)',
      api_docs: 'https://open-meteo.com/en/docs',
      limitations: [
        'Grid-model forecast; local street-level weather can differ.',
        'Not an official IMD warning feed unless explicitly marked.',
        'Rain % is day-representative calibrated probability — separate from mm amount.',
        'WMO hail-class codes mean hail possible in model class — not confirmed hail on ground.',
      ],
      alert_philosophy: 'IMD colour framing for UX; official bulletins need IMD/state sources.',
    },
    current: {
      temp_c: c.temp,
      feels_c: c.feelsLike,
      humidity_pct: c.humidity,
      wind_kmh: c.wind,
      wind_dir_deg: c.windDir,
      pressure_hpa: c.pressure,
      precip_mm: c.precip,
      wmo_code: c.code,
      condition_en: c.condition,
      condition_hi: c.condition_hi,
      icon: c.icon,
      is_day: c.isDay,
      visibility_km: c.visibility ?? null,
      observation_time: c.time || null,
      hail_possible: !!wmo.hailPossible,
      storm: !!wmo.storm,
      wmo_note_en: wmo.note,
    },
    rain: {
      today: {
        probability_pct: d0.pop ?? null,
        amount_mm: d0.rain ?? null,
        intensity_id: intensity.id,
        intensity_en: intensity.en,
        intensity_hi: intensity.hi,
      },
      tomorrow: {
        probability_pct: d1.pop ?? null,
        amount_mm: d1.rain ?? null,
      },
      next5_mm: wx.agri?.forecastRain ?? null,
      recent2_mm: wx.agri?.recentRain ?? null,
      fields_separated: true,
    },
    daily,
    hourly,
    agri: {
      soil_level: wx.agri?.soil?.level || null,
      soil_en: wx.agri?.soil?.en || null,
      soil_hi: wx.agri?.soil?.hi || null,
      advice_en: wx.agri?.advice_en || null,
      advice_hi: wx.agri?.advice_hi || null,
      spray_en: wx.agri?.sprayWindow?.en || null,
      spray_hi: wx.agri?.sprayWindow?.hi || null,
      basis: 'weather-proxy (no field soil probe)',
    },
    alerts: (wx.alerts || []).slice(0, 5).map((a) => ({
      severity: a.severity,
      title: a.title,
      title_hi: a.title_hi,
      summary: a.summary,
      source: a.source || 'model-threshold',
      modelled: a.modelled !== false,
    })),
    sources: (wx.sources || []).map((s) => ({
      name: s.name,
      role: s.role,
      url: s.url || null,
    })),
  }

  // Stable fingerprint so UI/LLM can detect same pack
  facts.fingerprint = [
    facts.place.id,
    facts.current.temp_c,
    facts.current.humidity_pct,
    facts.rain.today.probability_pct,
    facts.rain.today.amount_mm,
    facts.daily.map((d) => `${d.date}:${d.temp_max_c}/${d.rain_amount_mm}/${d.rain_probability_pct}`).join('|'),
    facts.meta.fetched_at_ms,
  ].join('::')

  return facts
}

/** Compact tool JSON for Gemini — numbers only from locked facts */
export function factsToLlmToolJson(facts) {
  if (!facts) return null
  return {
    schema: facts.schema,
    fingerprint: facts.fingerprint,
    place: facts.place,
    meta: {
      fetched_at_iso: facts.meta.fetched_at_iso,
      timezone: facts.meta.timezone,
      model: facts.meta.model,
      api: facts.meta.api,
      live: facts.meta.live,
      limitations: facts.meta.limitations,
    },
    current: facts.current,
    rain: facts.rain,
    daily: facts.daily,
    hourly: facts.hourly.slice(0, 12),
    agri: facts.agri,
    alerts: facts.alerts,
    sources: facts.sources,
  }
}

/**
 * City comparison — only when every city has a complete pack.
 */
export function compareCities(packs, { metric = 'temp_c' } = {}) {
  const list = (packs || []).filter(Boolean)
  if (list.length < 2) {
    return {
      ok: false,
      reason: 'need_at_least_two',
      message_en: 'Comparison unavailable — need at least two cities with live data.',
      message_hi: 'तुलना उपलब्ध नहीं — कम से कम दो शहरों का लाइव डेटा चाहिए।',
    }
  }
  const incomplete = list.filter(
    (p) =>
      !p?.current ||
      p.current.temp_c == null ||
      !p.daily?.length ||
      p.rain?.today?.probability_pct == null,
  )
  if (incomplete.length) {
    return {
      ok: false,
      reason: 'incomplete_data',
      message_en:
        'Comparison unavailable — one or more cities are missing complete current/daily rain fields. Not ranking partial data.',
      message_hi:
        'तुलना उपलब्ध नहीं — एक/अधिक शहरों में पूरा करंट/दैनिक वर्षा डेटा नहीं। अधूरे डेटा से रैंकिंग नहीं।',
      missing: incomplete.map((p) => p.place?.name || p.place?.id || '?'),
    }
  }

  const rows = list.map((p) => ({
    id: p.place.id,
    name: p.place.name,
    temp_c: p.current.temp_c,
    humidity_pct: p.current.humidity_pct,
    rain_probability_pct: p.rain.today.probability_pct,
    rain_amount_mm: p.rain.today.amount_mm,
    condition: p.current.condition_en,
    fingerprint: p.fingerprint,
  }))

  const sorted = [...rows].sort((a, b) => {
    if (metric === 'rain_probability_pct') return (b.rain_probability_pct || 0) - (a.rain_probability_pct || 0)
    if (metric === 'rain_amount_mm') return (b.rain_amount_mm || 0) - (a.rain_amount_mm || 0)
    return (b.temp_c || 0) - (a.temp_c || 0)
  })

  return {
    ok: true,
    metric,
    ranked: sorted,
    message_en: `Ranked ${sorted.length} cities by ${metric} using complete locked packs only.`,
    message_hi: `${sorted.length} शहरों की रैंकिंग (${metric}) — केवल पूर्ण लॉक्ड पैक।`,
  }
}

/** Source lines for UI / chat footer */
export function formatSourceFooter(facts, lang = 'en') {
  if (!facts) {
    return lang === 'hi' ? 'स्रोत: मौसम अनुपलब्ध' : 'Source: weather unavailable'
  }
  const mins = Math.max(
    0,
    Math.round((Date.now() - (facts.meta.fetched_at_ms || Date.now())) / 60000),
  )
  const model = facts.meta.model || 'open-meteo'
  if (lang === 'hi') {
    return (
      `स्रोत: Open-Meteo Forecast API · मॉडल/प्रॉक्सी: ${model} · ` +
      `अपडेट: ${mins} मि पहले · TZ ${facts.meta.timezone} · ` +
      `आधिकारिक IMD बुलेटिन नहीं (जब तक अलग से न कहा जाए)`
    )
  }
  return (
    `Source: Open-Meteo Forecast API · model/proxy: ${model} · ` +
    `updated ${mins} min ago · TZ ${facts.meta.timezone} · ` +
    `not an official IMD bulletin unless marked`
  )
}

/** System prompt fragment for LLM — hard grounding */
export function llmGroundingSystemAddon(factsJsonString) {
  return (
    'GROUNDING (non-negotiable):\n' +
    '1) Use ONLY numbers present in the LOCKED_WEATHER_FACTS JSON below.\n' +
    '2) Never invent or recalculate temperature, humidity, wind, rain %, or mm.\n' +
    '3) Rain probability_pct, amount_mm, and intensity are SEPARATE — do not conflate them.\n' +
    '4) WMO codes 96/99 mean hail POSSIBLE in model class — never say hail is occurring/guaranteed.\n' +
    '5) Code 95 is thunderstorm without implied hail.\n' +
    '6) Do not diagnose crop disease; say "conditions may favour" at most.\n' +
    '7) Do not ban all fertilizer/pesticides; use conditional spray/fertilizer language + check label.\n' +
    '8) If comparing cities without complete packs, say comparison unavailable.\n' +
    '9) Hindi/Hinglish: translate the same facts — do not change numbers.\n' +
    '10) End with the Source line using meta.model + fetched time from JSON.\n\n' +
    'LOCKED_WEATHER_FACTS:\n' +
    factsJsonString
  )
}
