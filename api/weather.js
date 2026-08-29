/**
 * Vercel Serverless — LIVE weather proxy + multi-source alerts + multi-model summary
 * GET /api/weather?lat=26.45&lon=80.33&tz=Asia/Kolkata&name=Kanpur&multimodel=1
 *
 * When OPENWEATHER_API_KEY is set on Vercel, OpenWeatherMap is tried FIRST
 * (One Call 3.0 → free 2.5 current+forecast). Open-Meteo remains fallback + multi-model.
 * Key never leaves the server — never put it in Vite frontend env.
 */

import {
  aggregateMultiModel,
  buildDefaultForecastUrl,
} from './_lib/multiModel.js'
import {
  buildRiskSignalsFromForecast,
  buildAlertBundle,
  gdacsToOfficialAlert,
  floodToRiskSignal,
  normalizeAlert,
} from './_lib/alertEngine.js'
import {
  fetchOpenWeatherForecast,
  getOpenWeatherKey,
} from './_lib/openWeather.js'

const UA = { Accept: 'application/json', 'User-Agent': 'WeatherGPT/2.2 (hackathon)' }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
}

async function fetchJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal })
    const text = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (text.trimStart().startsWith('<')) throw new Error('HTML body')
    return JSON.parse(text)
  } finally {
    clearTimeout(t)
  }
}

function buildForecastUrl(lat, lon, tz) {
  return buildDefaultForecastUrl(lat, lon, tz, 7)
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const toR = (d) => (d * Math.PI) / 180
  const dLat = toR(lat2 - lat1)
  const dLon = toR(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

async function fetchGdacsAlerts(lat, lon) {
  try {
    const end = new Date()
    const start = new Date(Date.now() - 14 * 86400000)
    const from = start.toISOString().slice(0, 10)
    const to = end.toISOString().slice(0, 10)
    const url =
      `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH` +
      `?fromDate=${from}&toDate=${to}&alertlevel=Green;Orange;Red`
    const data = await fetchJson(url, 10000)
    const features = data.features || []
    const out = []
    for (const f of features) {
      const coords = f.geometry?.coordinates
      if (!coords || coords.length < 2) continue
      const [elon, elat] = coords
      if (elat < 4 || elat > 38 || elon < 66 || elon > 100) continue
      const dist = haversineKm(lat, lon, elat, elon)
      if (dist > 800) continue
      const p = f.properties || {}
      const level = String(p.alertlevel || 'Green').toLowerCase()
      const severity = level.includes('red') ? 'red' : level.includes('orange') ? 'amber' : 'yellow'
      const et = p.eventtype || 'HZ'
      const typeName =
        { EQ: 'Earthquake', FL: 'Flood', TC: 'Tropical Cyclone', DR: 'Drought', VO: 'Volcano', WF: 'Wildfire' }[
          et
        ] || et
      out.push({
        id: `gdacs-${p.eventid || ''}-${p.episodeid || ''}`,
        severity,
        source: 'GDACS',
        category: typeName,
        title: `${typeName} alert (GDACS ${p.alertlevel || ''})`.trim(),
        title_hi: `${typeName} अलर्ट (GDACS)`,
        summary: p.name || p.eventname || `${typeName} near region (~${Math.round(dist)} km)`,
        summary_hi: p.name || p.eventname || `${typeName} ~${Math.round(dist)} किमी`,
        officialText: `GDACS live event: ${typeName}. ${p.name || p.eventname || ''}. Alert level ${p.alertlevel}. Distance from selected city ≈ ${Math.round(dist)} km. Period: ${p.fromdate || ''} → ${p.todate || ''}. More: https://www.gdacs.org`,
        officialText_hi: `GDACS लाइव: ${typeName}. स्तर ${p.alertlevel}. दूरी ≈ ${Math.round(dist)} किमी। स्रोत: gdacs.org`,
        meansForYou:
          severity === 'red'
            ? 'Monitor official advisories. Avoid unnecessary travel in affected corridors.'
            : 'Stay updated via NDMA/IMD and local administration.',
        meansForYou_hi: 'आधिकारिक सलाह पर नज़र रखें। NDMA/IMD अपडेट देखते रहें।',
        time: 'GDACS · live',
        time_hi: 'GDACS · लाइव',
        distanceKm: Math.round(dist),
        external: true,
        url: p.url || 'https://www.gdacs.org',
      })
    }
    out.sort((a, b) => a.distanceKm - b.distanceKm)
    return out.slice(0, 6)
  } catch {
    return []
  }
}

async function fetchFloodSignal(lat, lon) {
  try {
    const url =
      `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}` +
      `&daily=river_discharge,river_discharge_mean,river_discharge_median&forecast_days=5`
    const data = await fetchJson(url, 10000)
    const d = data.daily || {}
    const q = d.river_discharge || []
    const mean = d.river_discharge_mean || d.river_discharge_median || []
    if (!q.length) return []
    const today = q[0]
    const m = mean[0] || today
    const ratio = m > 0 ? today / m : 1
    const maxQ = Math.max(...q)
    const maxRatio = m > 0 ? maxQ / m : 1
    if (maxRatio < 1.25 && ratio < 1.2) return []
    const severity = maxRatio >= 1.8 || ratio >= 1.6 ? 'red' : maxRatio >= 1.4 ? 'amber' : 'yellow'
    return [
      {
        id: `flood-om-${Date.now()}`,
        severity,
        source: 'Open-Meteo Flood',
        category: 'River flood risk',
        title: 'Elevated river discharge (model)',
        title_hi: 'नदी प्रवाह बढ़ा (मॉडल)',
        summary: `River discharge ~${Math.round(today)} m³/s vs mean ~${Math.round(m)} m³/s (${ratio.toFixed(2)}×).`,
        summary_hi: `नदी प्रवाह ~${Math.round(today)} m³/s, औसत ~${Math.round(m)} (${ratio.toFixed(2)}×)।`,
        officialText: `Open-Meteo Flood API (GloFAS-based): near-term river discharge is elevated versus local mean (${ratio.toFixed(2)}× today, peak ratio ${maxRatio.toFixed(2)}× over 5 days). This is a hydrological model signal — confirm with CWC/IMD/state disaster authority before action.`,
        officialText_hi: `Open-Meteo Flood मॉडल: नदी प्रवाह औसत से अधिक (${ratio.toFixed(2)}×). कार्रवाई से पहले CWC/IMD/राज्य आपदा प्राधिकरण से पुष्टि करें।`,
        meansForYou: 'Avoid riverbanks & low bridges if rising. Farmers: secure pumps near streams.',
        meansForYou_hi: 'नदी किनारे/निचले पुलों से बचें। किसानों: नालों के पास पंप सुरक्षित करें।',
        time: 'Flood model · live',
        time_hi: 'फlood मॉडल · लाइव',
        external: true,
        url: 'https://open-meteo.com/en/docs/flood-api',
      },
    ]
  } catch {
    return []
  }
}

function modelAlertsFromForecast(data, name = 'Area', opts = {}) {
  const daily = data.daily || {}
  const cur = data.current || data.current_weather || {}
  const city = { name, id: name, lat: data.latitude, lon: data.longitude }
  return buildRiskSignalsFromForecast(
    city,
    {
      precipitation_probability_max: daily.precipitation_probability_max || [],
      precipitation_sum: daily.precipitation_sum || [],
      wind_speed_10m_max: daily.wind_speed_10m_max || [],
      weather_code: daily.weather_code || daily.weathercode || [],
    },
    { weather_code: cur.weather_code ?? cur.weathercode ?? 0 },
    { confidence: opts.confidence || null, nowMs: opts.nowMs }
  )
}


export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const lat = parseFloat(req.query.lat)
    const lon = parseFloat(req.query.lon)
    const tz = (req.query.tz || 'auto').toString()
    const name = (req.query.name || 'Area').toString()
    // multimodel=0 disables; default ON (compact summary only — not full hourly×N)
    const wantMulti =
      req.query.multimodel !== '0' &&
      req.query.multimodel !== 'false' &&
      req.query.mm !== '0'

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon required', live: false })
    }

    const errors = []
    let forecast = null
    let source = 'open-meteo'
    let owMeta = null
    const hasOw = !!getOpenWeatherKey()

    // ── Primary: OpenWeatherMap when key present (real live obs + forecast) ──
    if (hasOw) {
      try {
        const ow = await fetchOpenWeatherForecast(lat, lon, { timeoutMs: 12000 })
        owMeta = ow?.meta || null
        if (ow?.forecast?.current) {
          forecast = ow.forecast
          source =
            ow.meta?.api === 'onecall_3.0' ? 'openweather-onecall' : 'openweather-2.5'
        } else if (ow?.meta?.error) {
          errors.push('openweather: ' + ow.meta.error)
        }
      } catch (e) {
        errors.push('openweather: ' + (e.message || e))
      }
    }

    // ── Fallback / default: Open-Meteo (no key required) ──
    if (!forecast) {
      try {
        forecast = await fetchJson(buildForecastUrl(lat, lon, tz), 14000)
        source = hasOw ? 'open-meteo-fallback' : 'open-meteo'
      } catch (e) {
        errors.push('forecast1: ' + e.message)
      }
    }
    if (!forecast) {
      try {
        forecast = await fetchJson(buildForecastUrl(lat, lon, 'auto'), 16000)
        source = 'open-meteo-retry'
      } catch (e) {
        errors.push('forecast2: ' + e.message)
      }
    }
    if (!forecast) {
      try {
        const simple =
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current_weather=true&hourly=temperature_2m,precipitation_probability,weathercode,precipitation` +
          `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset` +
          `&timezone=auto&forecast_days=5`
        forecast = await fetchJson(simple, 14000)
        source = 'open-meteo-simple'
      } catch (e) {
        errors.push('forecast3: ' + e.message)
      }
    }

    if (!forecast) {
      return res.status(502).json({
        error: 'Weather upstream failed',
        errors,
        live: false,
        openweather_configured: hasOw,
      })
    }

    // Parallel: live alerts + multi-model aggregate (server-side only)
    const multiP = wantMulti
      ? aggregateMultiModel(lat, lon, {
          name,
          tz: forecast.timezone || tz,
          timeoutMs: 12000,
          forecastDays: 2,
          hourlyHours: 24,
        }).catch((e) => ({
          ok: false,
          live: false,
          schema: 'weathergpt.multi_model.v1',
          error: e.message || 'multi-model failed',
          multi_model_mode: 'none',
          models: [],
          summary: [],
          ensemble: {
            modelCount: 0,
            agreementEn: 'Multi-model layer unavailable.',
            agreementHi: 'मल्टी-मॉडल परत अनुपलब्ध।',
            single_model_only: false,
            is_consensus: false,
            no_models: true,
          },
          unavailable: [],
          note: 'Primary forecast still live; multi-model attach failed gracefully.',
        }))
      : Promise.resolve(null)

    const [gdacs, flood, multiBundle] = await Promise.all([
      fetchGdacsAlerts(lat, lon),
      fetchFloodSignal(lat, lon),
      multiP,
    ])

    // Compact multi_model first (confidence feeds risk signals)
    let multi_model = null
    if (multiBundle) {
      multi_model = {
        schema: multiBundle.schema || 'weathergpt.multi_model.v1',
        ok: !!multiBundle.ok,
        multi_model_mode: multiBundle.multi_model_mode || 'none',
        primary_model_id: multiBundle.primary_model_id || 'best_match',
        available_count: multiBundle.available_count ?? 0,
        ensemble: multiBundle.ensemble || null,
        summary: multiBundle.summary || [],
        unavailable: multiBundle.unavailable || [],
        note: multiBundle.note,
        fetchedAt: multiBundle.fetchedAt,
        sources: multiBundle.sources,
        // Primary observation in common schema (from best available model)
        primary_observation: multiBundle.primary_observation || null,
        // Deterministic forecast confidence (never LLM)
        confidence: multiBundle.confidence || null,
      }
    }

    const conf = multi_model?.confidence || null
    const riskModel = modelAlertsFromForecast(forecast, name, { confidence: conf })
    const official = (gdacs || []).map((a) =>
      gdacsToOfficialAlert({ ...a, place: name, lat, lon })
    )
    const riskFlood = (flood || []).map((a) =>
      floodToRiskSignal({ ...a, place: name, lat, lon })
    )
    const alert_bundle = buildAlertBundle({
      official: official.filter(Boolean),
      risk: [...riskModel, ...riskFlood.filter(Boolean)],
      demo: [],
      officialAvailable: { gdacs: (gdacs || []).length > 0 || gdacs != null },
    })
    const live_alerts = alert_bundle.alerts
    const model = riskModel

    const primaryIsOw = String(source).startsWith('openweather')
    const primaryLabel = primaryIsOw
      ? source === 'openweather-onecall'
        ? 'OpenWeather One Call 3.0'
        : 'OpenWeather 2.5 (live current + 5-day)'
      : 'Open-Meteo Forecast API'
    const modelId = primaryIsOw
      ? source
      : multi_model?.primary_model_id || 'open-meteo-best_match'

    return res.status(200).json({
      ...forecast,
      live: true,
      _proxy: true,
      _source: source,
      openweather_configured: hasOw,
      openweather_meta: owMeta,
      // Explicit primary model label for honesty footers
      model: modelId,
      model_meta: {
        name: modelId,
        source: primaryLabel,
        multi_model_mode: multi_model?.multi_model_mode || 'unknown',
        fetched_at: new Date().toISOString(),
        openweather: primaryIsOw,
      },
      // Top-level confidence for schema consumers (same object as multi_model.confidence)
      confidence: multi_model?.confidence || null,
      multi_model,
      live_alerts,
      alert_bundle,
      confidence: multi_model?.confidence || conf || null,
      alert_sources: {
        gdacs: gdacs.length,
        flood: flood.length,
        model: model.length,
        official: alert_bundle.counts.official,
        risk_signal: alert_bundle.counts.risk_signal,
        note: 'Official alerts: GDACS only when present. IMD/NDMA NOT integrated — never fabricated. Meteo/flood rows are WeatherGPT risk signals.',
      },
      provider_chain: {
        primary: source,
        openweather_configured: hasOw,
        errors: errors.length ? errors : undefined,
      },
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'proxy error', live: false })
  }
}

