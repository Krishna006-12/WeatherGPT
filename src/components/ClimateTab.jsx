import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, CloudRain, Layers, Thermometer } from 'lucide-react'
import { fetchClimate, fetchModels } from '../services/climate'

export default function ClimateTab({ lang, city, weather }) {
  const [climate, setClimate] = useState(null)
  const [models, setModels] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const c = city || weather?.city
    if (!c?.lat) {
      setLoading(false)
      return undefined
    }
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const [cl, md] = await Promise.all([
          fetchClimate(c).catch((e) => {
            throw e
          }),
          fetchModels(c).catch(() => null),
        ])
        if (cancelled) return
        setClimate(cl)
        setModels(md)
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [city?.id, city?.lat, weather?.city?.id])

  if (loading) {
    return (
      <div className="h-full p-4 space-y-3">
        <div className="h-28 shimmer-dark" />
        <div className="h-40 shimmer-dark" />
        <div className="h-40 shimmer-dark" />
      </div>
    )
  }

  if (err && !climate) {
    return (
      <div className="h-full p-4">
        <div className="dash-glass p-4 text-[13px] text-white/60">
          {lang === 'hi' ? 'क्लाइमेट डेटा लोड नहीं हुआ: ' : 'Climate failed: '}
          {err}
        </div>
      </div>
    )
  }

  const s = climate?.summary || {}
  const monthly = climate?.monthly || []
  const chartTemp = monthly.map((m) => ({
    name: m.month.slice(5),
    temp: m.tempMean,
    rain: m.precipMm,
  }))

  const modelRows = (models?.models || []).filter((m) => m.ok)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full overflow-y-auto scroll-thin px-3 sm:px-4 lg:px-5 py-4 space-y-4 max-w-4xl"
    >
      <div>
        <h2 className="text-[16px] font-semibold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          {lang === 'hi' ? 'जलवायु रुझान व NWP मॉडल' : 'Climate trends & NWP models'}
        </h2>
        <p className="text-[12px] text-white/55 mt-0.5">
          {climate?.place || city?.name || '—'} ·{' '}
          {lang === 'hi' ? 'आर्काइव + मल्टी-मॉडल (SIH)' : 'Archive + multi-model (SIH)'}
        </p>
      </div>

      {/* Trend summary */}
      <section className="dash-glass p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">
          {lang === 'hi' ? '12-महीना रुझान' : '12-month trend'}
        </p>
        <p className="text-[14px] text-white font-medium leading-relaxed">
          {lang === 'hi' ? s.trendHi || s.trendEn : s.trendEn || s.trendHi}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <Stat
            icon={<CloudRain className="w-3.5 h-3.5" />}
            label={lang === 'hi' ? '12मि बारिश' : '12m rain'}
            value={s.last12mRainMm != null ? `${Math.round(s.last12mRainMm)}` : '—'}
            unit="mm"
          />
          <Stat
            icon={<Thermometer className="w-3.5 h-3.5" />}
            label={lang === 'hi' ? 'Δ तापमान' : 'Δ temp'}
            value={s.tempDeltaC != null ? `${s.tempDeltaC > 0 ? '+' : ''}${s.tempDeltaC}` : '—'}
            unit="°C"
          />
          <Stat
            icon={<Thermometer className="w-3.5 h-3.5" />}
            label={lang === 'hi' ? 'गर्म दिन ≥40°' : 'Hot days ≥40°'}
            value={s.hotDaysGe40C ?? '—'}
          />
          <Stat
            icon={<CloudRain className="w-3.5 h-3.5" />}
            label={lang === 'hi' ? 'भारी वर्षा दिन' : 'Heavy rain days'}
            value={s.heavyRainDaysGe50mm ?? '—'}
          />
        </div>
        <p className="text-[11px] text-white/40 mt-3">
          {climate?.source || 'Open-Meteo Archive'} ·{' '}
          {lang === 'hi'
            ? 'पुनर्विश्लेषण — आधिकारिक 30-वर्ष normal नहीं'
            : 'Reanalysis — not official 30-year normals'}
        </p>
      </section>

      {/* Charts */}
      <section className="dash-glass p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">
          {lang === 'hi' ? 'मासिक औसत तापमान' : 'Monthly mean temperature'}
        </p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartTemp}>
              <defs>
                <linearGradient id="clTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4da3e6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#4da3e6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} unit="°" />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0' }} />
              <Area type="monotone" dataKey="temp" stroke="#4da3e6" fill="url(#clTemp)" name="°C" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="dash-glass p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">
          {lang === 'hi' ? 'मासिक वर्षा (मिमी)' : 'Monthly rainfall (mm)'}
        </p>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartTemp}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="rain" fill="#5b9fd4" radius={[4, 4, 0, 0]} name="mm" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* NWP models */}
      <section className="dash-glass p-4">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
            {lang === 'hi' ? 'NWP मॉडल तुलना' : 'NWP model comparison'}
          </p>
        </div>
        <p className="text-[13px] text-white font-medium mb-3">
          {lang === 'hi'
            ? models?.ensemble?.agreementHi || models?.ensemble?.agreementEn
            : models?.ensemble?.agreementEn || models?.ensemble?.agreementHi}
        </p>
        {models?.ensemble?.spreadC != null && (
          <p className="text-[12px] text-white/55 mb-3">
            {lang === 'hi' ? '24घं तापमान स्प्रेड: ' : '24h temp spread: '}
            <strong>{models.ensemble.spreadC}°C</strong>
            {models.ensemble.meanTemp24h != null && (
              <>
                {' '}
                · {lang === 'hi' ? 'मध्य: ' : 'mean: '}
                {models.ensemble.meanTemp24h}°C
              </>
            )}
          </p>
        )}
        <div className="space-y-2">
          {modelRows.map((m) => (
            <div
              key={m.id || m.short}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8"
            >
              <span className="text-[11px] font-bold bg-navy-900 text-white px-2 py-0.5 rounded-full w-14 text-center">
                {m.short || m.id}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">{m.label || m.id}</p>
                <p className="text-[11px] text-white/55">
                  {lang === 'hi' ? 'अभी ' : 'Now '}
                  {m.currentTemp ?? '—'}°
                  {m.today && (
                    <>
                      {' '}
                      · H/L {m.today.max}°/{m.today.min}° · pop {m.today.pop ?? '—'}%
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
          {!modelRows.length && (
            <p className="text-[12px] text-white/55">
              {lang === 'hi' ? 'मॉडल डेटा अनुपलब्ध' : 'Model data unavailable'}
            </p>
          )}
        </div>
        <p className="text-[10px] text-white/40 mt-3">
          GFS · ECMWF · ICON · best_match via Open-Meteo ·{' '}
          {lang === 'hi' ? 'स्थानीय WRF nest नहीं (क्लाउड NWP)' : 'not a local WRF nest (cloud NWP)'}
        </p>
      </section>
    </motion.div>
  )
}

function Stat({ icon, label, value, unit }) {
  return (
    <div className="bg-white/5 rounded-xl p-2.5 border border-white/8">
      <div className="flex items-center gap-1 text-white/40 mb-1">
        {icon}
        <span className="text-[10px] font-medium truncate">{label}</span>
      </div>
      <p className="text-[15px] font-semibold text-white tabular-nums">
        {value}
        {unit && <span className="text-[10px] text-white/40 font-medium ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}
