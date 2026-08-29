/**
 * WeatherGPT Alert Architecture
 * -----------------------------
 * TWO concepts — never conflate:
 *
 * 1) OFFICIAL ALERT  (kind: 'official')
 *    Only when a verified external feed provides it (e.g. GDACS event).
 *    Display real source. NEVER invent IMD / NDMA / state bulletins.
 *    IMD is NOT auto-ingested in this build → no fabricated IMD rows.
 *
 * 2) WEATHERGPT RISK SIGNAL  (kind: 'risk_signal')
 *    Deterministic thresholds on Open-Meteo / flood model data.
 *    Always labelled WeatherGPT-generated. Includes reason + thresholds.
 *
 * 3) DEMO  (kind: 'demo')
 *    Explicit simulation for judges — never "official".
 *
 * Schema (v1):
 * {
 *   id, kind, severity, category, title, title_hi,
 *   summary, summary_hi, reason, reason_hi,
 *   source, source_type, official: boolean,
 *   valid_from, valid_until, expired,
 *   confidence: { score, level } | null,
 *   meansForYou, meansForYou_hi,
 *   ...legacy fields for UI back-compat
 * }
 */

export const ALERT_SCHEMA = 'weathergpt.alerts.v1'

const SEV_RANK = { red: 0, amber: 1, yellow: 2, green: 3 }

/** Hazard families for contradiction / de-dupe */
const HAZARD_FAMILY = {
  rain: 'precip',
  precip: 'precip',
  'heavy rain': 'precip',
  'rain likely': 'precip',
  thunderstorm: 'storm',
  storm: 'storm',
  'extreme rain': 'storm',
  flood: 'flood',
  'river flood': 'flood',
  'river flood risk': 'flood',
  wind: 'wind',
  cyclone: 'cyclone',
  'tropical cyclone': 'cyclone',
  earthquake: 'quake',
  volcano: 'volcano',
  wildfire: 'fire',
  drought: 'drought',
  heat: 'heat',
  demo: 'demo',
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function iso(ms) {
  if (ms == null) return null
  try {
    return new Date(ms).toISOString()
  } catch {
    return null
  }
}

function hazardFamily(category = '', title = '') {
  const s = `${category} ${title}`.toLowerCase()
  for (const [k, fam] of Object.entries(HAZARD_FAMILY)) {
    if (s.includes(k)) return fam
  }
  return 'other'
}

/**
 * Normalize any legacy / raw alert into v1 schema.
 * Does NOT invent official status — only trusted sources get kind=official.
 */
export function normalizeAlert(raw, opts = {}) {
  if (!raw || typeof raw !== 'object') return null
  const now = opts.nowMs ?? Date.now()

  // Determine kind honestly
  let kind = raw.kind || null
  const src = String(raw.source || '')
  const srcLower = src.toLowerCase()

  // Never upgrade model/IMD-style copy to official
  const claimsImd =
    /imd|ndma|official indian|district warning/i.test(src) ||
    /imd (red|amber|yellow)|official imd/i.test(String(raw.officialText || raw.title || ''))

  if (raw.simulated || raw.demo || kind === 'demo') {
    kind = 'demo'
  } else if (kind === 'official' || raw.official === true) {
    // Only keep official if source is in allowlist
    if (isTrustedOfficialSource(src)) {
      kind = 'official'
    } else {
      // Downgrade fake "official" claims
      kind = 'risk_signal'
    }
  } else if (isTrustedOfficialSource(src)) {
    kind = 'official'
  } else if (
    raw.modelled ||
    raw.risk_signal ||
    /open-meteo|model|weathergpt|threshold|flood/i.test(srcLower) ||
    raw.external === false
  ) {
    kind = 'risk_signal'
  } else if (raw.external && isTrustedOfficialSource(src)) {
    kind = 'official'
  } else {
    // Default: treat unknown as risk signal (safer than official)
    kind = 'risk_signal'
  }

  // Strip fabricated IMD official framing from risk signals
  if (kind === 'risk_signal' && claimsImd) {
    // keep content but force labelling
  }

  const severity = ['red', 'amber', 'yellow', 'green'].includes(raw.severity)
    ? raw.severity
    : 'yellow'

  const validFrom = raw.valid_from || raw.validFrom || iso(raw.issuedAt || now)
  let validUntil = raw.valid_until || raw.validUntil || null
  if (!validUntil) {
    // Default windows
    const hours =
      kind === 'demo' ? 2 : severity === 'red' ? 36 : severity === 'amber' ? 48 : 24
    validUntil = iso(now + hours * 3600000)
  }

  const untilMs = validUntil ? new Date(validUntil).getTime() : null
  const expired =
    raw.expired === true || (untilMs != null && Number.isFinite(untilMs) && untilMs < now)

  const family = raw.hazard_family || hazardFamily(raw.category, raw.title)

  const reason =
    raw.reason ||
    raw.threshold_reason ||
    (kind === 'risk_signal'
      ? stripImdOfficialVoice(raw.officialText || raw.summary || '')
      : raw.officialText || raw.summary || '')

  const reason_hi =
    raw.reason_hi ||
    raw.threshold_reason_hi ||
    (kind === 'risk_signal'
      ? stripImdOfficialVoice(raw.officialText_hi || raw.summary_hi || '')
      : raw.officialText_hi || raw.summary_hi || '')

  const sourceLabel =
    kind === 'official'
      ? src || 'Verified external feed'
      : kind === 'demo'
        ? 'WeatherGPT DEMO (not official)'
        : src && !/imd-style/i.test(src)
          ? src.startsWith('WeatherGPT')
            ? src
            : `WeatherGPT · ${src}`
          : 'WeatherGPT risk engine'

  const title =
    kind === 'risk_signal' && !/weathergpt|risk|model/i.test(String(raw.title || ''))
      ? ensureRiskTitle(raw.title || 'Weather risk signal')
      : raw.title || 'Alert'

  const title_hi =
    kind === 'risk_signal' && raw.title_hi && !/वेदर|जोखिम|मॉडल/i.test(raw.title_hi)
      ? `WeatherGPT जोखिम: ${raw.title_hi}`
      : raw.title_hi || title

  // Confidence: official feeds don't need model confidence; risk signals may carry it
  let confidence = raw.confidence || null
  if (kind === 'risk_signal' && !confidence && raw.confidence_score != null) {
    confidence = {
      score: Math.round(Number(raw.confidence_score)),
      level: raw.confidence_level || null,
    }
  }
  if (kind === 'official') {
    // Don't invent confidence for official — leave null unless source provided
    if (confidence && confidence.invented) confidence = null
  }

  const id =
    raw.id ||
    `${kind}-${family}-${severity}-${(raw.place || raw.lat || 'x').toString().slice(0, 12)}`

  return {
    schema: ALERT_SCHEMA,
    id,
    kind, // official | risk_signal | demo
    official: kind === 'official',
    modelled: kind === 'risk_signal',
    simulated: kind === 'demo',
    risk_signal: kind === 'risk_signal',
    severity,
    category: raw.category || family,
    hazard_family: family,
    title,
    title_hi,
    summary: raw.summary || reason,
    summary_hi: raw.summary_hi || reason_hi,
    reason,
    reason_hi,
    // Legacy UI field — for risk signals this is the reason text, NOT an official bulletin
    officialText:
      kind === 'official'
        ? raw.officialText || reason
        : kind === 'demo'
          ? raw.officialText ||
            'DEMO ONLY — not an official IMD/NDMA/government warning.'
          : `[WeatherGPT risk signal — NOT an official government warning]\n${reason}`,
    officialText_hi:
      kind === 'official'
        ? raw.officialText_hi || reason_hi
        : kind === 'demo'
          ? raw.officialText_hi || 'केवल डेमो — आधिकारिक IMD/NDMA चेतावनी नहीं।'
          : `[WeatherGPT जोखिम संकेत — आधिकारिक सरकारी चेतावनी नहीं]\n${reason_hi || reason}`,
    meansForYou: raw.meansForYou || defaultMeans(severity, 'en'),
    meansForYou_hi: raw.meansForYou_hi || defaultMeans(severity, 'hi'),
    source: sourceLabel,
    source_type: kind === 'official' ? 'verified_feed' : kind === 'demo' ? 'demo' : 'model_threshold',
    source_url: raw.url || raw.source_url || null,
    valid_from: validFrom,
    valid_until: validUntil,
    expired: !!expired,
    confidence: confidence
      ? {
          score: num(confidence.score),
          level: confidence.level || null,
          engine: confidence.engine || null,
        }
      : null,
    time: raw.time || (kind === 'official' ? 'Official feed' : 'Risk signal · live'),
    time_hi: raw.time_hi || (kind === 'official' ? 'आधिकारिक फ़ीड' : 'जोखिम संकेत · लाइव'),
    place: raw.place || null,
    placeLat: raw.placeLat ?? raw.lat ?? null,
    placeLon: raw.placeLon ?? raw.lon ?? null,
    distanceKm: raw.distanceKm ?? null,
    lat: raw.lat ?? null,
    lon: raw.lon ?? null,
    external: kind === 'official' ? true : !!raw.external,
    url: raw.url || null,
    notifyKey: raw.notifyKey || null,
    thresholds: raw.thresholds || null,
    disclaimer_en:
      kind === 'official'
        ? 'Verified external multi-hazard feed. Still cross-check national/state authorities for local action.'
        : kind === 'demo'
          ? 'Simulated for demo — not a live or official warning.'
          : 'WeatherGPT-generated risk signal from model thresholds. NOT an IMD, NDMA, or government warning.',
    disclaimer_hi:
      kind === 'official'
        ? 'सत्यापित बाहरी मल्टी-हैज़र्ड फ़ीड। स्थानीय कार्रवाई के लिए राष्ट्रीय/राज्य प्राधिकरण से क्रॉस-चेक करें।'
        : kind === 'demo'
          ? 'डेमो सिमुलेशन — लाइव/आधिकारिक चेतावनी नहीं।'
          : 'WeatherGPT मॉडल-थ्रेशोल्ड जोखिम संकेत। IMD/NDMA/सरकारी चेतावनी नहीं।',
  }
}

function isTrustedOfficialSource(source) {
  const s = String(source || '').toLowerCase()
  // Allowlist only — IMD/NDMA intentionally ABSENT (not integrated)
  if (s.includes('gdacs')) return true
  // Future: 'imd official api', 'ndma cap feed' when real keys exist
  return false
}

function stripImdOfficialVoice(text) {
  if (!text) return text
  return String(text)
    .replace(/IMD-style\s*/gi, '')
    .replace(/IMD\s+(RED|AMBER|YELLOW)\s+WARNING[^:]*:\s*/gi, '')
    .replace(/official IMD[^.]*\./gi, '')
    .replace(/Not a substitute for official IMD[^.]*\./gi, '')
    .trim()
}

function ensureRiskTitle(title) {
  const t = String(title || '').trim()
  if (/^weathergpt/i.test(t) || /risk signal/i.test(t)) return t
  return `WeatherGPT risk: ${t}`
}

function defaultMeans(severity, lang) {
  if (lang === 'hi') {
    if (severity === 'red') return 'गैर-ज़रूरी यात्रा सीमित करें; आधिकारिक चैनल देखें।'
    if (severity === 'amber') return 'बाहर काम सावधानी से; रेनगियर रखें।'
    return 'योजना में बफर रखें; अपडेट देखते रहें।'
  }
  if (severity === 'red') return 'Limit non-essential travel; follow official channels.'
  if (severity === 'amber') return 'Outdoor work with caution; carry rain gear.'
  return 'Keep buffer in plans; monitor updates.'
}

/**
 * Build WeatherGPT risk signals from forecast daily/current (deterministic).
 * Never labelled official / IMD.
 */
export function buildRiskSignalsFromForecast(city, daily, current, opts = {}) {
  const now = opts.nowMs ?? Date.now()
  const conf = opts.confidence || null
  const name = city?.name || 'Area'
  const nameHi = city?.name_hi || name
  const idBase = city?.id || `${city?.lat || 'x'}_${city?.lon || 'y'}`

  const maxPop = maxOf(daily?.precipitation_probability_max)
  const maxRain = maxOf(daily?.precipitation_sum)
  const maxWind = maxOf(daily?.wind_speed_10m_max)
  const maxCode = maxOf(daily?.weather_code)
  const todayRain = num(daily?.precipitation_sum?.[0]) || 0
  const todayPop = num(daily?.precipitation_probability_max?.[0]) || 0
  const code = current?.weather_code ?? current?.weathercode ?? 0

  const hailClass = maxCode >= 96 || code === 96 || code === 99
  const stormClass = maxCode >= 95 || code >= 95
  const out = []

  const confBlock = conf
    ? {
        score: conf.score ?? null,
        level: conf.level ?? null,
        engine: conf.engine || 'weathergpt.confidence.v1',
      }
    : null

  if ((maxRain > 100 && maxPop > 70) || (hailClass && maxRain > 40) || maxCode >= 99) {
    const thresholds = {
      max_rain_mm: maxRain,
      max_pop_pct: maxPop,
      max_wmo_code: maxCode,
      hail_class: hailClass,
      rule: 'red: (rain>100 & pop>70) OR (hail_class & rain>40) OR code>=99',
    }
    out.push(
      normalizeAlert(
        {
          id: `risk-red-storm-${idBase}`,
          kind: 'risk_signal',
          severity: 'red',
          category: hailClass ? 'Thunderstorm / hail class' : 'Thunderstorm / extreme rain',
          title: hailClass
            ? 'Severe thunderstorm risk · hail possible (model class)'
            : 'Extreme rain / thunderstorm risk',
          title_hi: hailClass
            ? 'गंभीर तूफान जोखिम · ओले संभव (मॉडल वर्ग)'
            : 'अत्यधिक वर्षा / तूफान जोखिम',
          summary: hailClass
            ? `Model storm/hail-class signal near ${name} — hail possible, not confirmed. Not an official warning.`
            : `Very heavy rain / storm thresholds met near ${name} (next ~5 days, model).`,
          summary_hi: hailClass
            ? `${nameHi} के पास मॉडल तूफान/ओला-वर्ग — ओला संभव, पुष्ट नहीं। आधिकारिक चेतावनी नहीं।`
            : `${nameHi} में अत्यधिक वर्षा/तूफान थ्रेशोल्ड (मॉडल)।`,
          reason: `Deterministic thresholds: peak rain ${maxRain.toFixed?.(1) ?? maxRain} mm, peak POP ${maxPop}%, WMO code ${maxCode}. ${hailClass ? 'WMO 96/99 = hail possible in model taxonomy only.' : ''}`,
          reason_hi: `थ्रेशोल्ड: वर्षा ${maxRain} मिमी, POP ${maxPop}%, WMO ${maxCode}। आधिकारिक IMD बुलेटिन नहीं।`,
          meansForYou:
            'Avoid low-lying roads. Charge devices. Livestock to shelter. Delay foliar spray if rain likely — check label.',
          meansForYou_hi:
            'निचले इलाकों से बचें। डिवाइस चार्ज रखें। मवेशी सुरक्षित। बारिश पर छिड़काव टालें — लेबल देखें।',
          source: 'WeatherGPT · Open-Meteo WMO/QPF thresholds',
          thresholds,
          confidence: confBlock,
          valid_from: iso(now),
          valid_until: iso(now + 36 * 3600000),
          place: name,
          lat: city?.lat,
          lon: city?.lon,
        },
        { nowMs: now }
      )
    )
  } else if (maxRain > 50 || maxPop >= 80 || maxWind > 45 || (stormClass && maxRain > 20)) {
    const thresholds = {
      max_rain_mm: maxRain,
      max_pop_pct: maxPop,
      max_wind_kmh: maxWind,
      storm_class: stormClass,
      rule: 'amber: rain>50 OR pop>=80 OR wind>45 OR (storm & rain>20)',
    }
    out.push(
      normalizeAlert(
        {
          id: `risk-amber-rain-${idBase}`,
          kind: 'risk_signal',
          severity: 'amber',
          category: 'Heavy rain / wind',
          title: 'Heavy rain / strong wind risk',
          title_hi: 'भारी वर्षा / तेज़ हवा जोखिम',
          summary: `Heavy rain (~${(maxRain).toFixed?.(0) ?? maxRain} mm peak) or strong wind signal near ${name}.`,
          summary_hi: `${nameHi} के पास भारी वर्षा (~${Math.round(maxRain)} मिमी) या तेज़ हवा संकेत।`,
          reason: `Thresholds: peak rain ${maxRain} mm, POP ${maxPop}%, wind ${Math.round(maxWind)} km/h, WMO max ${maxCode}.`,
          reason_hi: `थ्रेशोल्ड: वर्षा ${maxRain} मिमी, POP ${maxPop}%, हवा ${Math.round(maxWind)} किमी/घं।`,
          meansForYou: 'Carry umbrella. Avoid underpasses after dark. Hold non-urgent outdoor work.',
          meansForYou_hi: 'छतरी रखें। अंडरपास से बचें। बाहरी काम टालें।',
          source: 'WeatherGPT · Open-Meteo thresholds',
          thresholds,
          confidence: confBlock,
          valid_from: iso(now),
          valid_until: iso(now + 48 * 3600000),
          place: name,
          lat: city?.lat,
          lon: city?.lon,
        },
        { nowMs: now }
      )
    )
  } else if (todayPop >= 55 || todayRain > 5 || code >= 61) {
    const thresholds = {
      today_pop_pct: todayPop,
      today_rain_mm: todayRain,
      current_wmo: code,
      rule: 'yellow: todayPop>=55 OR todayRain>5 OR code>=61',
    }
    out.push(
      normalizeAlert(
        {
          id: `risk-yellow-rain-${idBase}`,
          kind: 'risk_signal',
          severity: 'yellow',
          category: 'Rain likely',
          title: 'Rain likely — elevated chance',
          title_hi: 'बारिश संभावित — ऊँची संभावना',
          summary: `Rain likely today/near-term around ${name} (~${todayPop}% day chance).`,
          summary_hi: `${nameHi} में आज/निकट बारिश संभावना ~${todayPop}%。`,
          reason: `Thresholds: today POP ${todayPop}%, today rain ${todayRain} mm, current WMO ${code}.`,
          reason_hi: `थ्रेशोल्ड: आज POP ${todayPop}%, वर्षा ${todayRain} मिमी, WMO ${code}।`,
          meansForYou: 'Plan outdoor work in drier morning windows. Tarpaulin for harvested crop.',
          meansForYou_hi: 'बाहर काम सुबह करें। कटी फसल के लिए तिरपाल।',
          source: 'WeatherGPT · Open-Meteo thresholds',
          thresholds,
          confidence: confBlock,
          valid_from: iso(now),
          valid_until: iso(now + 24 * 3600000),
          place: name,
          lat: city?.lat,
          lon: city?.lon,
        },
        { nowMs: now }
      )
    )
  }

  return out.filter(Boolean)
}

function maxOf(arr) {
  if (!arr || !arr.length) return 0
  return Math.max(...arr.map((n) => (Number.isFinite(Number(n)) ? Number(n) : 0)))
}

/**
 * Normalize GDACS feature-derived alert as OFFICIAL (international multi-hazard).
 * Still NOT an IMD district warning.
 */
export function gdacsToOfficialAlert(raw, opts = {}) {
  return normalizeAlert(
    {
      ...raw,
      kind: 'official',
      official: true,
      source: raw.source || 'GDACS',
      category: raw.category,
    },
    opts
  )
}

/**
 * Flood model → risk signal (never official government flood warning)
 */
export function floodToRiskSignal(raw, opts = {}) {
  return normalizeAlert(
    {
      ...raw,
      kind: 'risk_signal',
      source: 'WeatherGPT · Open-Meteo Flood (GloFAS-style model)',
      official: false,
      modelled: true,
    },
    opts
  )
}

/**
 * Merge official + risk + demo:
 * - drop expired (unless keepExpired)
 * - de-dupe same family+severity+place
 * - contradictions: same hazard_family → keep higher severity; official beats risk on same family
 * - never invent empty official list as "all clear from IMD"
 */
export function mergeAlertLists({
  official = [],
  risk = [],
  demo = [],
  nowMs = Date.now(),
  keepExpired = false,
  max = 16,
} = {}) {
  const norm = (list, forceKind) =>
    (list || [])
      .map((a) => {
        const n = normalizeAlert(
          forceKind ? { ...a, kind: forceKind } : a,
          { nowMs }
        )
        return n
      })
      .filter(Boolean)

  let all = [
    ...norm(official, null),
    ...norm(risk, null),
    ...norm(demo, 'demo'),
  ]

  // Filter expired
  if (!keepExpired) {
    all = all.filter((a) => !a.expired)
  }

  // Sort: official first within same severity, then severity rank, then distance
  all.sort((a, b) => {
    const rs = (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9)
    if (rs !== 0) return rs
    const ko = (a.kind === 'official' ? 0 : a.kind === 'demo' ? 2 : 1) -
      (b.kind === 'official' ? 0 : b.kind === 'demo' ? 2 : 1)
    if (ko !== 0) return ko
    return (a.distanceKm ?? 999) - (b.distanceKm ?? 999)
  })

  // Contradiction + de-dupe by place+family
  const byKey = new Map()
  for (const a of all) {
    const place = (a.place || `${a.lat},${a.lon}` || '').toString().toLowerCase()
    const key = `${place}|${a.hazard_family}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, a)
      continue
    }
    // Prefer official over risk_signal for same family
    if (prev.kind !== 'official' && a.kind === 'official') {
      byKey.set(key, a)
      continue
    }
    if (prev.kind === 'official' && a.kind !== 'official') {
      // keep official; skip weaker risk duplicate
      continue
    }
    // Same kind: keep higher severity (lower rank)
    if ((SEV_RANK[a.severity] ?? 9) < (SEV_RANK[prev.severity] ?? 9)) {
      byKey.set(key, a)
      continue
    }
    // Same severity: keep first (already sorted)
  }

  // Also de-dupe exact id
  const seenId = new Set()
  const out = []
  for (const a of byKey.values()) {
    if (seenId.has(a.id)) continue
    seenId.add(a.id)
    out.push(a)
  }

  // Re-sort final
  out.sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9))

  return out.slice(0, max)
}

/**
 * Assemble full alert bundle for API/client.
 */
export function buildAlertBundle({
  official = [],
  risk = [],
  demo = [],
  nowMs = Date.now(),
  officialAvailable = null,
  notes = null,
} = {}) {
  const alerts = mergeAlertLists({ official, risk, demo, nowMs })
  const officialActive = alerts.filter((a) => a.kind === 'official')
  const riskActive = alerts.filter((a) => a.kind === 'risk_signal')
  const demoActive = alerts.filter((a) => a.kind === 'demo')

  const imdIntegrated = false // explicit honesty

  return {
    schema: ALERT_SCHEMA,
    alerts, // flat list for existing UI
    official_alerts: officialActive,
    risk_signals: riskActive,
    demo_alerts: demoActive,
    counts: {
      total: alerts.length,
      official: officialActive.length,
      risk_signal: riskActive.length,
      demo: demoActive.length,
    },
    official_sources_status: {
      gdacs: officialAvailable?.gdacs ?? null,
      imd: {
        integrated: imdIntegrated,
        available: false,
        note: 'IMD district warning APIs are NOT connected. WeatherGPT will never invent IMD bulletins.',
      },
      ndma: {
        integrated: false,
        available: false,
        note: 'NDMA CAP feed not connected.',
      },
    },
    honesty: {
      en: 'Official alerts only from verified feeds (e.g. GDACS). WeatherGPT risk signals are model thresholds — not government warnings. IMD/NDMA are not auto-ingested.',
      hi: 'आधिकारिक अलर्ट केवल सत्यापित फ़ीड (जैसे GDACS) से। WeatherGPT जोखिम संकेत मॉडल थ्रेशोल्ड हैं — सरकारी चेतावनी नहीं। IMD/NDMA ऑटो-इंगैस्ट नहीं।',
    },
    note: notes || null,
    fetchedAt: nowMs,
  }
}

/**
 * Demo / simulate red — always kind=demo
 */
export function buildDemoRedAlert(city, opts = {}) {
  const now = opts.nowMs ?? Date.now()
  const name = city?.name || 'Area'
  return normalizeAlert(
    {
      id: `demo-red-${now}`,
      kind: 'demo',
      simulated: true,
      severity: 'red',
      category: 'Demo extreme rain',
      title: 'SIMULATED: Extreme rain scenario',
      title_hi: 'सिमुलेटेड: अत्यधिक वर्षा परिदृश्य',
      summary: `Red alert drill: 200mm+ rain scenario for ${name}`,
      summary_hi: `रेड अलर्ट ड्रिल: ${city?.name_hi || name} के लिए 200मिमी+ वर्षा परिदृश्य`,
      reason: 'User/judge triggered Simulate Red — not live data, not official.',
      reason_hi: 'सिमुलेट रेड — लाइव डेटा नहीं, आधिकारिक नहीं।',
      officialText:
        'DEMO ONLY — This is a WeatherGPT simulation for hackathon/judge demo. NOT a live IMD, NDMA, or government warning.',
      officialText_hi:
        'केवल डेमो — यह WeatherGPT सिमुलेशन है। लाइव IMD/NDMA/सरकारी चेतावनी नहीं।',
      meansForYou: 'DEMO only. Production would push SMS/IVR to saved users.',
      meansForYou_hi: 'केवल डेमो। प्रोडक्शन में SMS/IVR।',
      source: 'WeatherGPT DEMO',
      valid_from: iso(now),
      valid_until: iso(now + 2 * 3600000),
      place: name,
      lat: city?.lat,
      lon: city?.lon,
    },
    { nowMs: now }
  )
}
