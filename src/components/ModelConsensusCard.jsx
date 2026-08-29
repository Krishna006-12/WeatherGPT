/**
 * Clean multi-model consensus strip for the dashboard.
 * Only renders models that are available (ok). Never invents missing NWP.
 */
import { useEffect, useState } from 'react'
import { Layers, Activity } from 'lucide-react'
import { fetchModels } from '../services/climate'
import { shouldDeferHeavyUI, getNetworkSnapshot } from '../services/networkStatus'

const ORDER = ['ecmwf_ifs025', 'ecmwf_aifs025', 'gfs_seamless', 'icon_global', 'best_match']
const SHORT = {
  ecmwf_ifs025: 'ECMWF',
  ecmwf_aifs025: 'AIFS',
  gfs_seamless: 'GFS',
  icon_global: 'ICON',
  best_match: 'Blend',
}

function confLevel(c) {
  if (!c) return null
  if (typeof c === 'string') return c
  return c.level || null
}

function confScore(c) {
  if (!c || typeof c !== 'object') return null
  return c.score != null ? Math.round(c.score) : null
}

export default function ModelConsensusCard({ lang, city, weather, compact = false }) {
  const [models, setModels] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(false)

  const place = city || weather?.city
  // Prefer pack multi-model if already present (no extra fetch)
  const packMm = weather?.multiModel || weather?.multi_model || null

  useEffect(() => {
    if (packMm?.models?.length) {
      setModels(packMm)
      return undefined
    }
    if (!place?.lat) return undefined
    if (shouldDeferHeavyUI(getNetworkSnapshot())) return undefined

    let cancelled = false
    const ac = new AbortController()
    setLoading(true)
    setErr(null)
    fetchModels(place, { signal: ac.signal })
      .then((md) => {
        if (!cancelled) setModels(md)
      })
      .catch((e) => {
        if (!cancelled && !/abort/i.test(String(e?.message || ''))) setErr(e.message || 'fail')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      try {
        ac.abort()
      } catch {
        /* */
      }
    }
  }, [place?.id, place?.lat, place?.lon, packMm])

  const rows = (models?.models || []).filter((m) => m && (m.ok || m.available))
  // Sort by preferred order, drop unknown unavailable
  rows.sort((a, b) => {
    const ia = ORDER.indexOf(a.id)
    const ib = ORDER.indexOf(b.id)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })

  if (loading && !rows.length) {
    return (
      <section className="pg-card" aria-busy="true" aria-label={lang === 'hi' ? 'मॉडल लोड' : 'Loading models'}>
        <div className="h-16 shimmer-dark rounded-xl" />
      </section>
    )
  }

  if (!rows.length) {
    // Silent if nothing available — never show fake models
    if (err && !compact) {
      return (
        <section className="pg-card">
          <p className="text-[12px] text-white/45">
            {lang === 'hi' ? 'मल्टी-मॉडल अभी उपलब्ध नहीं' : 'Multi-model consensus unavailable right now'}
          </p>
        </section>
      )
    }
    return null
  }

  const ensemble = models?.ensemble || {}
  const conf = models?.confidence || weather?.confidence || null
  const level = confLevel(conf) || ensemble.agreementLevel || null
  const score = confScore(conf)
  const mode = models?.multi_model_mode || (rows.length >= 2 ? 'multi' : 'single')

  const meanT =
    ensemble.meanTemp24h ??
    ensemble.mean_temp ??
    (rows.map((r) => r.currentTemp ?? r.next24h?.tempMean ?? r.next24h?.temp_mean).filter((x) => x != null)[0] ??
      null)

  return (
    <section
      className="pg-card model-consensus-card wx-section wx-section-consensus"
      aria-label={lang === 'hi' ? 'मॉडल सहमति' : 'Model consensus'}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="pg-card-title wx-section-title flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-sky-300 opacity-90" aria-hidden />
            {lang === 'hi' ? 'मॉडल सहमति' : 'Model consensus'}
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            {mode === 'multi'
              ? lang === 'hi'
                ? 'उपलब्ध NWP · केवल लाइव मॉडल'
                : 'Available NWP · live models only'
              : lang === 'hi'
                ? 'सिंगल-मॉडल (सहमति नहीं)'
                : 'Single-model (not consensus)'}
          </p>
        </div>
        {(level || score != null) && (
          <div className="text-right shrink-0">
            {level && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  level === 'HIGH' || level === 'high'
                    ? 'bg-mint-400/20 text-mint-300'
                    : level === 'LOW' || level === 'low'
                      ? 'bg-alert-amber/20 text-alert-amber'
                      : 'bg-sky-400/15 text-sky-200'
                }`}
              >
                {String(level).toUpperCase()}
                {score != null ? ` · ${score}` : ''}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {rows.map((m) => {
          const label = SHORT[m.id] || m.short || m.label || m.id
          const temp =
            m.currentTemp ??
            m.current?.temperature ??
            m.next24h?.temp_mean ??
            m.next24h?.tempMean ??
            null
          const pop =
            m.today?.pop ??
            m.today?.precipitation_probability_max ??
            m.next24h?.pop ??
            m.next24h?.precipitation_probability ??
            m.current?.precipitation_probability ??
            null
          return (
            <div key={m.id} className="model-chip" title={m.label || m.id}>
              <span className="model-chip-name">{label}</span>
              <span className="model-chip-temp tabular-nums">
                {temp != null ? `${Math.round(temp)}°` : '—'}
              </span>
              {pop != null && Number.isFinite(Number(pop)) ? (
                <span className="model-chip-pop tabular-nums text-sky-300/90">
                  {Math.round(Number(pop))}%
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      {(meanT != null || ensemble.spreadC != null || ensemble.spreadTempC != null) && (
        <div className="mt-3 pt-2.5 border-t border-white/8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/65">
          {meanT != null && (
            <span className="inline-flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-sky-300" aria-hidden />
              {lang === 'hi' ? 'सहमति ताप' : 'Consensus'}{' '}
              <strong className="text-white tabular-nums">{Math.round(Number(meanT))}°</strong>
            </span>
          )}
          {(ensemble.spreadC != null || ensemble.spreadTempC != null) && (
            <span>
              {lang === 'hi' ? 'फैलाव' : 'Spread'}{' '}
              <strong className="text-white/90 tabular-nums">
                {ensemble.spreadC ?? ensemble.spreadTempC}°
              </strong>
            </span>
          )}
          <span className="text-white/35 text-[11px]">
            {lang === 'hi' ? 'अनुपलब्ध मॉडल छुपाए' : 'Unavailable models hidden'}
          </span>
        </div>
      )}
    </section>
  )
}
