/**
 * Forecast Confidence Engine (deterministic)
 * ----------------------------------------
 * score 0–100 from measurable multi-model / freshness / horizon factors.
 * LLM never chooses the score. No Math.random. Same inputs → same output.
 *
 * Output:
 * {
 *   score, level: 'HIGH'|'MEDIUM'|'LOW',
 *   reasons: string[],
 *   modelAgreement: { ... spreads, per-model values },
 *   factors: { ... sub-scores used },
 *   formula: string,
 *   engine: 'weathergpt.confidence.v1'
 * }
 */

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function round(v, d = 1) {
  const n = num(v)
  if (n == null) return null
  const f = 10 ** d
  return Math.round(n * f) / f
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function finiteList(arr) {
  return (arr || []).map(num).filter((v) => v != null)
}

/** max - min, or null if < 2 values */
export function spreadOf(values) {
  const a = finiteList(values)
  if (a.length < 2) return null
  return round(Math.max(...a) - Math.min(...a), 2)
}

export function meanOf(values) {
  const a = finiteList(values)
  if (!a.length) return null
  return round(a.reduce((x, y) => x + y, 0) / a.length, 2)
}

/**
 * Piecewise score from spread (lower spread → higher score).
 * thresholds: array of [maxSpreadInclusive, score] ascending by spread
 */
function scoreFromSpread(spread, thresholds, { missingScore = null } = {}) {
  if (spread == null) return missingScore
  for (const [maxS, sc] of thresholds) {
    if (spread <= maxS) return sc
  }
  return thresholds.length ? thresholds[thresholds.length - 1][1] : missingScore
}

/** Temperature spread (°C) → 0–100 */
const TEMP_SPREAD_TABLE = [
  [0.8, 100],
  [1.2, 92],
  [1.8, 84],
  [2.5, 74],
  [3.5, 60],
  [5.0, 45],
  [7.0, 30],
  [10.0, 18],
  [999, 10],
]

/** POP spread (percentage points) → 0–100 */
const POP_SPREAD_TABLE = [
  [5, 100],
  [8, 94],
  [12, 86],
  [18, 74],
  [25, 60],
  [35, 44],
  [50, 28],
  [999, 12],
]

/** Rain amount spread (mm / 24h) → 0–100 */
const RAIN_SPREAD_TABLE = [
  [1.0, 100],
  [2.5, 90],
  [5.0, 78],
  [10.0, 60],
  [20.0, 40],
  [40.0, 22],
  [999, 10],
]

/** Wind speed spread (km/h) → 0–100 */
const WIND_SPREAD_TABLE = [
  [2, 100],
  [4, 92],
  [7, 80],
  [12, 65],
  [20, 45],
  [30, 28],
  [999, 12],
]

/** Availability of independent model runs */
function availabilityScore(modelCount) {
  if (modelCount <= 0) return 0
  if (modelCount === 1) return 38
  if (modelCount === 2) return 62
  if (modelCount === 3) return 78
  if (modelCount === 4) return 90
  return 100 // 5+
}

/** Horizon in hours ahead of "now" for the slice being scored (default near-term 24h) */
function horizonScore(horizonHours) {
  const h = num(horizonHours)
  if (h == null) return 88 // default near-term / unspecified treated as ~24h product
  if (h <= 6) return 98
  if (h <= 12) return 94
  if (h <= 24) return 88
  if (h <= 48) return 72
  if (h <= 72) return 58
  if (h <= 120) return 42
  if (h <= 168) return 30
  return 18
}

/**
 * Freshness from age of fetch (ms). Pass nowMs for reproducible tests.
 */
function freshnessScore(fetchedAt, nowMs = Date.now()) {
  if (fetchedAt == null) return 55 // unknown → mild penalty, not random
  let t
  if (typeof fetchedAt === 'number') t = fetchedAt
  else t = new Date(fetchedAt).getTime()
  if (!Number.isFinite(t)) return 55
  const ageMin = Math.max(0, (nowMs - t) / 60000)
  if (ageMin <= 10) return 100
  if (ageMin <= 30) return 94
  if (ageMin <= 60) return 88
  if (ageMin <= 180) return 72
  if (ageMin <= 360) return 55
  if (ageMin <= 720) return 38
  if (ageMin <= 1440) return 22
  return 10
}

function levelFromScore(score) {
  if (score >= 75) return 'HIGH'
  if (score >= 50) return 'MEDIUM'
  return 'LOW'
}

/**
 * Pull comparable scalars from a multi-model row (full or summary).
 */
function extractModelScalars(m) {
  if (!m || !(m.available || m.ok)) return null
  const id = m.id || m.source_model || 'unknown'
  const short = m.short || id
  const cur = m.current || {}
  const n24 = m.next24h || {}
  const today = m.today || {}

  const temp =
    num(n24.temp_mean) ??
    num(n24.tempMean) ??
    num(cur.temperature) ??
    num(m.temperature) ??
    num(m.currentTemp)

  const pop =
    num(n24.pop_max) ??
    num(n24.popMax) ??
    num(today.precipitation_probability_max) ??
    num(today.pop) ??
    num(cur.precipitation_probability) ??
    num(m.precipitation_probability)

  const rain =
    num(n24.rain_sum) ??
    num(n24.rainSum) ??
    num(today.precipitation_sum) ??
    num(today.rain) ??
    num(cur.precipitation) ??
    num(m.precipitation)

  const wind =
    num(cur.wind_speed) ??
    num(m.wind_speed) ??
    num(m.currentWind) ??
    num(today.wind_speed_max)

  return { id, short, temp, pop, rain, wind }
}

/**
 * Build per-variable agreement block from available model rows.
 */
export function buildModelAgreement(models = []) {
  const rows = (models || []).map(extractModelScalars).filter(Boolean)
  const byVar = (key) => {
    const values = {}
    for (const r of rows) {
      if (r[key] != null) values[r.id] = r[key]
    }
    const list = Object.values(values)
    return {
      values,
      count: list.length,
      mean: meanOf(list),
      spread: spreadOf(list),
      models: Object.keys(values),
    }
  }

  const temperature = byVar('temp')
  const precipitation_probability = byVar('pop')
  const precipitation = byVar('rain')
  const wind_speed = byVar('wind')

  temperature.unit = '°C'
  precipitation_probability.unit = 'pp'
  precipitation.unit = 'mm'
  wind_speed.unit = 'km/h'

  const n = rows.length
  let agreementLevel = 'none'
  if (n === 0) agreementLevel = 'none'
  else if (n === 1) agreementLevel = 'single'
  else {
    const t = temperature.spread
    const p = precipitation_probability.spread
    // Strong agreement example: POP spread ≤ 8 and temp ≤ 1.5
    if (
      (t == null || t <= 1.5) &&
      (p == null || p <= 10) &&
      (wind_speed.spread == null || wind_speed.spread <= 8)
    ) {
      agreementLevel = 'high'
    } else if (
      (t == null || t <= 3.0) &&
      (p == null || p <= 25) &&
      (wind_speed.spread == null || wind_speed.spread <= 15)
    ) {
      agreementLevel = 'moderate'
    } else {
      agreementLevel = 'low'
    }
  }

  return {
    modelCount: n,
    modelsUsed: rows.map((r) => r.id),
    labels: Object.fromEntries(rows.map((r) => [r.id, r.short])),
    temperature,
    precipitation_probability,
    precipitation,
    wind_speed,
    agreementLevel,
  }
}

/**
 * Core deterministic confidence calculation.
 *
 * @param {object} input
 * @param {array}  input.models - multi-model rows (available/ok flagged)
 * @param {string|number} [input.fetchedAt]
 * @param {number} [input.nowMs] - inject for tests
 * @param {number} [input.horizonHours=24]
 * @param {boolean} [input.live=true]
 * @param {string}  [input.multi_model_mode]
 */
export function calculateForecastConfidence(input = {}) {
  const nowMs = num(input.nowMs) ?? Date.now()
  const horizonHours = num(input.horizonHours) ?? 24
  const live = input.live !== false
  const models = Array.isArray(input.models) ? input.models : []

  const agreement = buildModelAgreement(models)
  const n = agreement.modelCount

  const reasons = []
  const factors = {}

  // --- factor scores ---
  const sAvail = availabilityScore(n)
  factors.availability = { score: sAvail, modelCount: n, weight: 0.15 }

  const sTemp = scoreFromSpread(agreement.temperature.spread, TEMP_SPREAD_TABLE, {
    missingScore: n >= 2 ? 50 : null,
  })
  factors.temperature_spread = {
    score: sTemp,
    spread_C: agreement.temperature.spread,
    mean_C: agreement.temperature.mean,
    values: agreement.temperature.values,
    weight: 0.25,
  }

  const sPop = scoreFromSpread(agreement.precipitation_probability.spread, POP_SPREAD_TABLE, {
    missingScore: n >= 2 ? 52 : null,
  })
  factors.precipitation_probability_spread = {
    score: sPop,
    spread_pp: agreement.precipitation_probability.spread,
    mean_pp: agreement.precipitation_probability.mean,
    values: agreement.precipitation_probability.values,
    weight: 0.25,
  }

  const sRain = scoreFromSpread(agreement.precipitation.spread, RAIN_SPREAD_TABLE, {
    missingScore: n >= 2 ? 55 : null,
  })
  factors.precipitation_amount_spread = {
    score: sRain,
    spread_mm: agreement.precipitation.spread,
    mean_mm: agreement.precipitation.mean,
    values: agreement.precipitation.values,
    weight: 0.1,
  }

  const sWind = scoreFromSpread(agreement.wind_speed.spread, WIND_SPREAD_TABLE, {
    missingScore: n >= 2 ? 55 : null,
  })
  factors.wind_spread = {
    score: sWind,
    spread_kmh: agreement.wind_speed.spread,
    mean_kmh: agreement.wind_speed.mean,
    values: agreement.wind_speed.values,
    weight: 0.1,
  }

  const sHorizon = horizonScore(horizonHours)
  factors.forecast_horizon = {
    score: sHorizon,
    horizon_hours: horizonHours,
    weight: 0.08,
  }

  const sFresh = freshnessScore(input.fetchedAt, nowMs)
  factors.data_freshness = {
    score: sFresh,
    fetchedAt: input.fetchedAt ?? null,
    weight: 0.07,
  }

  // Weighted average over factors that have a numeric score
  const parts = [
    factors.availability,
    factors.temperature_spread,
    factors.precipitation_probability_spread,
    factors.precipitation_amount_spread,
    factors.wind_spread,
    factors.forecast_horizon,
    factors.data_freshness,
  ].filter((f) => f && f.score != null && Number.isFinite(f.score))

  let weightSum = parts.reduce((a, f) => a + f.weight, 0)
  let raw = 0
  if (weightSum > 0) {
    raw = parts.reduce((a, f) => a + f.score * f.weight, 0) / weightSum
  }

  let score = Math.round(clamp(raw, 0, 100))

  // --- hard policy caps (deterministic) ---
  if (n === 0) {
    score = 0
    reasons.push('No reliable NWP model data available')
  } else if (n === 1) {
    // Single-model: never claim multi-model confidence; hard cap
    const before = score
    score = Math.min(score, 62)
    reasons.push('Single-model forecast only — not multi-model consensus (score capped at 62)')
    if (before > 62) {
      reasons.push(`Raw blend was ${before}; applied single-model cap`)
    }
  } else {
    reasons.push(`${n} models available for comparison`)
  }

  if (!live) {
    const before = score
    score = Math.min(score, 40)
    reasons.push('Non-live / offline pack — confidence capped at 40')
    if (before > 40) reasons.push(`Live score would have been ${before}`)
  }

  // Spread-based reasons
  if (n >= 2) {
    if (agreement.temperature.spread != null) {
      reasons.push(
        `Temperature 24h-mean spread ${agreement.temperature.spread}°C across ${agreement.temperature.count} models`
      )
    } else {
      reasons.push('Temperature spread not computable (insufficient temp values)')
    }

    if (agreement.precipitation_probability.spread != null) {
      const sp = agreement.precipitation_probability.spread
      const mean = agreement.precipitation_probability.mean
      reasons.push(
        `Precipitation probability spread ${sp} pp (mean ${mean}%) across ${agreement.precipitation_probability.count} models`
      )
      if (sp <= 8) {
        reasons.push('Strong POP agreement between models')
      } else if (sp >= 30) {
        reasons.push('Large POP disagreement between models')
      }
    } else {
      reasons.push(
        'POP spread unavailable for ≥2 models (null POP left honest — e.g. AIFS often lacks POP)'
      )
    }

    if (agreement.wind_speed.spread != null) {
      reasons.push(`Wind speed spread ${agreement.wind_speed.spread} km/h`)
    }
    if (agreement.precipitation.spread != null) {
      reasons.push(`24h rain amount spread ${agreement.precipitation.spread} mm`)
    }
  }

  if (sFresh != null) {
    if (sFresh >= 88) reasons.push('Data is fresh (<1 h)')
    else if (sFresh <= 38) reasons.push('Data is stale — lower confidence')
  }

  if (horizonHours > 48) {
    reasons.push(`Longer forecast horizon (${horizonHours} h) reduces confidence`)
  } else if (horizonHours <= 24) {
    reasons.push(`Near-term horizon (${horizonHours} h) supports higher confidence`)
  }

  const level = n === 0 ? 'LOW' : levelFromScore(score)

  // Align level messaging for single-model: never HIGH
  let finalLevel = level
  if (n === 1 && finalLevel === 'HIGH') finalLevel = 'MEDIUM'

  const formula =
    'score = round( clamp( Σ(factor_score × weight) / Σ(weight) , 0, 100) ); ' +
    'then apply caps: no_models→0; single_model→min(score,62); offline→min(score,40); ' +
    'level = HIGH if score≥75 else MEDIUM if score≥50 else LOW ' +
    '(single-model level never HIGH). ' +
    'Weights: availability 0.15, temp_spread 0.25, pop_spread 0.25, rain_spread 0.10, ' +
    'wind_spread 0.10, horizon 0.08, freshness 0.07. ' +
    'Missing multi-model spread factors are omitted from the average (not filled with random values).'

  return {
    engine: 'weathergpt.confidence.v1',
    score,
    level: finalLevel,
    reasons,
    modelAgreement: agreement,
    factors,
    formula,
    meta: {
      deterministic: true,
      llm_decides: false,
      random: false,
      multi_model_mode: input.multi_model_mode || (n >= 2 ? 'multi' : n === 1 ? 'single' : 'none'),
      computed_at: new Date(nowMs).toISOString(),
      horizon_hours: horizonHours,
      live: !!live,
    },
  }
}

/**
 * Convenience: confidence from aggregateMultiModel /api/models bundle.
 */
export function confidenceFromMultiModelBundle(bundle, opts = {}) {
  if (!bundle) {
    return calculateForecastConfidence({
      models: [],
      fetchedAt: opts.fetchedAt || null,
      nowMs: opts.nowMs,
      horizonHours: opts.horizonHours ?? 24,
      live: false,
      multi_model_mode: 'none',
    })
  }
  const models = bundle.models || bundle.summary || []
  return calculateForecastConfidence({
    models,
    fetchedAt: bundle.fetchedAt || opts.fetchedAt || null,
    nowMs: opts.nowMs,
    horizonHours: opts.horizonHours ?? 24,
    live: bundle.live !== false && bundle.ok !== false,
    multi_model_mode: bundle.multi_model_mode,
  })
}

/**
 * Example fixture for docs/tests: strong POP agreement → HIGH
 * ECMWF 81, GFS 76, ICON 80, AIFS 78 (and tight temps)
 */
export function exampleStrongPopAgreementInput() {
  const mk = (id, short, pop, temp = 28.0, wind = 10) => ({
    id,
    short,
    available: true,
    ok: true,
    current: {
      temperature: temp,
      precipitation_probability: pop,
      precipitation: 2.0,
      wind_speed: wind,
      source_model: id,
    },
    next24h: {
      temp_mean: temp,
      pop_max: pop,
      rain_sum: 5.0,
    },
    today: {
      precipitation_probability_max: pop,
      precipitation_sum: 5.0,
    },
  })
  return {
    models: [
      mk('ecmwf_ifs025', 'ECMWF', 81, 28.0, 10),
      mk('gfs_seamless', 'GFS', 76, 28.3, 11),
      mk('icon_seamless', 'ICON', 80, 27.9, 9.5),
      mk('ecmwf_aifs025_single', 'AIFS', 78, 28.1, 10.5),
    ],
    fetchedAt: Date.UTC(2026, 7, 29, 12, 0, 0), // fixed
    nowMs: Date.UTC(2026, 7, 29, 12, 5, 0),
    horizonHours: 24,
    live: true,
    multi_model_mode: 'multi',
  }
}
