/**
 * GET /api/models?lat=&lon=&name=&tz=
 * Multi-NWP engine: ECMWF IFS · GFS · ICON · ECMWF AIFS · best_match
 * All aggregation happens here — frontend must not fan-out to model URLs.
 *
 * Response schema: weathergpt.multi_model.v1
 * - models[] each normalized to common observation schema
 * - unavailable models: available:false + error (never faked)
 * - single reliable model → multi_model_mode:"single" (no false consensus)
 */

import { aggregateMultiModel, MODEL_CATALOG } from './_lib/multiModel.js'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=420')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const lat = parseFloat(req.query.lat)
    const lon = parseFloat(req.query.lon)
    const name = (req.query.name || 'Area').toString().slice(0, 64)
    const tz = (req.query.tz || 'auto').toString()

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        ok: false,
        error: 'lat and lon required',
        schema: 'weathergpt.multi_model.v1',
        catalog: MODEL_CATALOG.map((m) => ({
          id: m.id,
          name: m.name,
          short: m.short,
          family: m.family,
          provider: m.provider,
        })),
      })
    }

    // Optional: ?models=ecmwf_ifs025,gfs_seamless to subset (still server-side)
    let catalog = MODEL_CATALOG
    const filter = (req.query.models || req.query.only || '').toString().trim()
    if (filter) {
      const ids = new Set(
        filter
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )
      const subset = MODEL_CATALOG.filter((m) => ids.has(m.id))
      if (subset.length) catalog = subset
    }

    // Probe mode: force one fake-unavailable id for tests
    if (req.query.probe === 'unavailable') {
      catalog = [
        ...catalog,
        {
          id: 'not_a_real_model_xyz',
          name: 'Invalid probe model',
          short: 'BAD',
          family: 'probe',
          provider: 'none',
          role: 'compare',
          notes: 'Intentional invalid id for graceful failure tests',
        },
      ]
    }

    const bundle = await aggregateMultiModel(lat, lon, {
      name,
      tz,
      catalog,
      timeoutMs: 14000,
      forecastDays: 2,
      hourlyHours: 48,
    })

    // Legacy ClimateTab fields kept on each model row:
    // ok, currentTemp, today, next24h (engine already maps these)

    return res.status(200).json({
      ...bundle,
      // Back-compat aliases used by older ClimateTab copy
      models: bundle.models.map((m) => ({
        ...m,
        // ClimateTab historically expected next24h.tempMean / popMax / rainSum
        next24h: m.next24h
          ? {
              ...m.next24h,
              tempMean: m.next24h.temp_mean,
              tempMax: m.next24h.temp_max,
              popMax: m.next24h.pop_max,
              rainSum: m.next24h.rain_sum,
            }
          : m.next24h,
        today: m.today
          ? {
              max: m.today.temp_max != null ? Math.round(m.today.temp_max) : null,
              min: m.today.temp_min != null ? Math.round(m.today.temp_min) : null,
              rain: m.today.precipitation_sum,
              pop: m.today.precipitation_probability_max,
              ...m.today,
            }
          : m.today,
      })),
    })
  } catch (e) {
    return res.status(500).json({
      ok: false,
      live: false,
      schema: 'weathergpt.multi_model.v1',
      error: e.message || 'models error',
      multi_model_mode: 'none',
      models: [],
      ensemble: {
        modelCount: 0,
        agreementEn: 'Engine error — no model data.',
        agreementHi: 'इंजन त्रुटि — मॉडल डेटा नहीं।',
        single_model_only: false,
        is_consensus: false,
        no_models: true,
      },
    })
  }
}
