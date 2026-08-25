import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Car,
  ChevronDown,
  ChevronRight,
  CloudRain,
  Droplets,
  Eye,
  Gauge,
  GraduationCap,
  Info,
  MapPin,
  Share2,
  Sparkles,
  Sprout,
  Wind,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { WeatherIcon, SeverityDot } from './Icons'
import {
  buildTravelInsight,
  buildSchoolInsight,
  estimateVisibility,
} from '../services/insights'
import { buildStructuredBrief, buildDailyBriefing, shareBriefing } from '../services/briefing'
import { toDisplayTemp, tempUnitLabel } from '../services/storage'

function skyClass(weather) {
  if (!weather) return 'sky-partly'
  if (!weather.current?.isDay) return 'sky-night'
  const icon = weather.current.icon || ''
  if (icon.includes('lightning') || icon.includes('storm')) return 'sky-storm'
  if (icon.includes('rain') || icon.includes('drizzle')) return 'sky-rain'
  if (icon.includes('fog')) return 'sky-fog'
  if (icon === 'cloud') return 'sky-overcast'
  if (icon === 'sun') return 'sky-clear'
  return 'sky-partly'
}

const ease = [0.22, 1, 0.36, 1]

function sevClass(level, onDark = false) {
  const hi = level === 'high' || level === 'avoid' || level === 'poor' || level === 'extreme'
  const mid = level === 'moderate' || level === 'elevated' || level === 'caution'
  if (onDark) {
    if (hi) return 'sev-high'
    if (mid) return 'sev-moderate'
    return 'sev-low'
  }
  if (hi) return 'sev-high-light'
  if (mid) return 'sev-moderate-light'
  return 'sev-low-light'
}

function alertSev(severity) {
  if (severity === 'red') return { label: 'SEVERE', cls: 'sev-severe-light' }
  if (severity === 'amber') return { label: 'HIGH', cls: 'sev-high-light' }
  if (severity === 'yellow') return { label: 'MODERATE', cls: 'sev-moderate-light' }
  return { label: 'LOW', cls: 'sev-low-light' }
}

function stripMd(s) {
  return String(s || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
}

function weekdayLabel(d, i, lang) {
  if (i === 0) return lang === 'hi' ? 'आज' : 'Today'
  if (i === 1) return lang === 'hi' ? 'कल' : 'Tomorrow'
  return lang === 'hi' ? d.weekday_hi : d.weekday
}

export default function DashboardTab({
  lang,
  weather,
  aqi,
  units = 'C',
  minsAgo = 1,
  onOpenMode,
  onOpenChat,
  onOpenAlerts,
  onOpenCities,
  onOpenForecast,
}) {
  // ALL hooks before any conditional return (blank-page guard)
  const [shareState, setShareState] = useState('')
  const [whyId, setWhyId] = useState(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [daySeg, setDaySeg] = useState('today') // today | week

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setIsDesktop(!!mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  const sky = skyClass(weather)

  if (!weather) {
    return (
      <div className={`h-full overflow-y-auto scroll-thin ${sky}`}>
        <div className="p-4 space-y-3">
          <div className="h-48 shimmer-dark rounded-3xl" />
          <div className="h-36 shimmer-dark rounded-3xl" />
          <div className="h-28 shimmer-dark rounded-3xl" />
        </div>
      </div>
    )
  }

  const travel = buildTravelInsight(weather, lang)
  const school = buildSchoolInsight(weather, lang)
  const brief = buildStructuredBrief(weather, aqi, lang)
  const vis = estimateVisibility(weather)
  const c = weather.current
  const d0 = weather.daily[0]
  const d1 = weather.daily[1]
  const city = lang === 'hi' ? weather.city.name_hi || weather.city.name : weather.city.name
  const unit = tempUnitLabel(units)
  const t = (n) => toDisplayTemp(n, units)
  const hours = (weather.hourly || []).slice(0, 12)
  const chartData = (weather.hourly || []).slice(0, 18).map((h) => ({
    label: h.label,
    temp: t(h.temp),
    pop: h.pop,
  }))

  const onShare = async () => {
    const text = buildDailyBriefing(weather, aqi, lang)
    const r = await shareBriefing(text)
    setShareState(r === 'shared' || r === 'copied' ? (lang === 'hi' ? 'कॉपी ✓' : 'Copied ✓') : '—')
    setTimeout(() => setShareState(''), 2000)
  }

  const aqiPct = aqi?.aqi != null ? Math.min(1, aqi.aqi / 300) : 0

  const decisions = [
    {
      id: 'travel',
      icon: Car,
      title: lang === 'hi' ? 'यात्रा' : 'Travel',
      label: travel.riskLabel,
      level: travel.riskLevel,
      why: travel.warnings,
      advice: travel.advice,
      factors: [
        lang === 'hi' ? `दृश्यता ~${travel.visibilityKm} किमी` : `Visibility ~${travel.visibilityKm} km`,
        lang === 'hi' ? `हवा ${travel.windKmh} किमी/घं` : `Wind ${travel.windKmh} km/h`,
        lang === 'hi'
          ? `बारिश ${travel.rainToday.pop}% / ${travel.rainToday.mm} मिमी`
          : `Rain ${travel.rainToday.pop}% / ${travel.rainToday.mm} mm`,
        lang === 'hi' ? `स्कोर ${travel.riskScore}/100` : `Score ${travel.riskScore}/100`,
      ],
    },
    {
      id: 'school',
      icon: GraduationCap,
      title: lang === 'hi' ? 'स्कूल' : 'School',
      label: school.outdoorLabel,
      level: school.outdoorLevel,
      why: school.extreme,
      advice: school.recommendations[0],
      factors: [
        lang === 'hi'
          ? `हीट ${school.heatLabel} (महसूस ${school.heatFeels}°)`
          : `Heat ${school.heatLabel} (feels ${school.heatFeels}°)`,
        `UV ${school.uv ?? '—'}`,
        lang === 'hi' ? `आउटडोर स्कोर ${school.outdoorScore}/100` : `Outdoor score ${school.outdoorScore}/100`,
        lang === 'hi' ? `नमी ${school.humidity}%` : `Humidity ${school.humidity}%`,
      ],
    },
    {
      id: 'farm',
      icon: Sprout,
      title: lang === 'hi' ? 'कृषि' : 'Farm',
      label: lang === 'hi' ? weather.agri.soil.hi : weather.agri.soil.en,
      level:
        weather.agri.soil.level === 'low'
          ? 'moderate'
          : weather.agri.soil.level === 'high'
            ? 'elevated'
            : 'low',
      why: [
        lang === 'hi' ? weather.agri.advice_hi : weather.agri.advice_en,
        lang === 'hi' ? weather.agri.sprayWindow.hi : weather.agri.sprayWindow.en,
      ],
      advice: lang === 'hi' ? weather.agri.advice_hi : weather.agri.advice_en,
      factors: [
        lang === 'hi' ? `हाल बारिश ${weather.agri.recentRain} मिमी` : `Recent rain ${weather.agri.recentRain} mm`,
        lang === 'hi' ? `5-दिन ${weather.agri.forecastRain} मिमी` : `Next 5d ${weather.agri.forecastRain} mm`,
        lang === 'hi' ? `मिट्टी: ${weather.agri.soil.hi}` : `Soil: ${weather.agri.soil.en}`,
      ],
    },
  ]

  const topAlert = weather.alerts?.[0]
  const alertMeta = topAlert ? alertSev(topAlert.severity) : null

  const dateLine = (() => {
    try {
      const now = new Date()
      return now.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    } catch {
      return ''
    }
  })()

  /* ---------- HERO (mock DNA) ---------- */
  const heroBlock = (
    <section className="hero-soft px-5 pt-5 pb-6 text-white text-center relative overflow-hidden">
      {/* soft glow */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/10 to-transparent" />

      <button
        type="button"
        onClick={onOpenCities}
        className="relative z-[1] inline-flex items-center gap-1.5 text-white/90 text-[14px] font-semibold pressable focus-ring rounded-full px-2 py-1"
      >
        <MapPin className="w-3.5 h-3.5" />
        {city}
        <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-white/70">
          {weather.live ? (
            <>
              <span className="live-dot" /> LIVE
            </>
          ) : (
            <>
              <span className="live-dot-off" /> OFFLINE
            </>
          )}
          <span className="opacity-60">· {minsAgo}m</span>
        </span>
      </button>

      <div className="relative z-[1] flex justify-center my-3">
        <WeatherIcon name={c.icon} className="w-[112px] h-[112px] drop-shadow-lg" />
      </div>

      <div className="relative z-[1] flex items-start justify-center gap-1 hero-temp">
        <span
          className="font-semibold text-white leading-none drop-shadow-sm"
          style={{ fontSize: isDesktop ? '72px' : 'clamp(68px, 20vw, 88px)' }}
        >
          {t(c.temp)}
        </span>
        <span className="text-[22px] font-medium text-white/70 mt-2">{unit}</span>
      </div>

      <p className="relative z-[1] text-[20px] font-semibold text-white mt-1">
        {lang === 'hi' ? c.condition_hi : c.condition}
      </p>
      <p className="relative z-[1] text-[13px] text-white/70 mt-0.5">{dateLine}</p>
      <p className="relative z-[1] text-[13px] text-white/75 mt-1">
        {lang === 'hi' ? 'महसूस' : 'Feels'} {t(c.feelsLike)}
        {unit}
        <span className="mx-1.5 opacity-40">·</span>H {t(d0.max)}° · L {t(d0.min)}°
      </p>

      <div className="relative z-[1] grid grid-cols-3 gap-2 mt-5">
        <div className="metric-pill px-2 py-2.5">
          <Wind className="w-3.5 h-3.5 mx-auto text-white/70 mb-1" />
          <p className="text-[15px] font-semibold tabular-nums leading-none">{c.wind}</p>
          <p className="text-[10px] text-white/60 mt-1">km/h</p>
        </div>
        <div className="metric-pill px-2 py-2.5">
          <Droplets className="w-3.5 h-3.5 mx-auto text-white/70 mb-1" />
          <p className="text-[15px] font-semibold tabular-nums leading-none">{c.humidity}%</p>
          <p className="text-[10px] text-white/60 mt-1">{lang === 'hi' ? 'नमी' : 'Humidity'}</p>
        </div>
        <div className="metric-pill px-2 py-2.5">
          <CloudRain className="w-3.5 h-3.5 mx-auto text-white/70 mb-1" />
          <p className="text-[15px] font-semibold tabular-nums leading-none">{d0.pop}%</p>
          <p className="text-[10px] text-white/60 mt-1">{lang === 'hi' ? 'बारिश' : 'Chance of rain'}</p>
        </div>
      </div>

      {/* secondary metrics row */}
      <div className="relative z-[1] flex justify-center gap-4 mt-3 text-[11px] text-white/65">
        <span className="inline-flex items-center gap-1">
          <Eye className="w-3 h-3" /> {vis} km
        </span>
        <span className="inline-flex items-center gap-1">
          <Gauge className="w-3 h-3" /> {c.pressure} hPa
        </span>
      </div>
    </section>
  )

  /* ---------- DARK SHEET: Today hourly / 7-day (mock) ---------- */
  const darkSheet = (
    <section className="sheet-dark p-4">
      {/* segment like mock Today | 7 days */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 p-1 rounded-full bg-white/6 border border-white/8">
          <button
            type="button"
            onClick={() => setDaySeg('today')}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition focus-ring ${
              daySeg === 'today' ? 'bg-sky-400 text-white shadow-md' : 'text-white/55 hover:text-white'
            }`}
          >
            {lang === 'hi' ? 'आज' : 'Today'}
          </button>
          <button
            type="button"
            onClick={() => setDaySeg('week')}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition focus-ring ${
              daySeg === 'week' ? 'bg-sky-400 text-white shadow-md' : 'text-white/55 hover:text-white'
            }`}
          >
            {lang === 'hi' ? '5 दिन' : '5 days'}
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenForecast}
          className="text-[12px] font-semibold text-sky-300 focus-ring rounded-lg px-2 py-1"
        >
          {lang === 'hi' ? 'पूरा →' : 'Full →'}
        </button>
      </div>

      {daySeg === 'today' ? (
        <>
          {/* Tomorrow teaser like right phone */}
          {d1 && (
            <div className="rounded-2xl bg-white/6 border border-white/8 px-3.5 py-3 mb-3 flex items-center gap-3">
              <WeatherIcon name={d1.icon} className="w-11 h-11 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-white/50 font-medium">
                  {lang === 'hi' ? 'कल' : 'Tomorrow'}
                </p>
                <p className="text-[15px] font-semibold text-white leading-tight">
                  {t(d1.max)}
                  <span className="text-white/45 font-medium">/{t(d1.min)}°</span>
                </p>
                <p className="text-[12px] text-white/55 truncate">
                  {lang === 'hi' ? d1.condition_hi : d1.condition}
                </p>
              </div>
              <div className="text-right text-[11px] text-white/50 space-y-0.5 shrink-0">
                <p>
                  <Wind className="w-3 h-3 inline mr-0.5" />
                  {d1.wind ?? '—'} km/h
                </p>
                <p>
                  <Droplets className="w-3 h-3 inline mr-0.5" />
                  {d1.pop}%
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto scroll-thin snap-x pb-1">
            {hours.map((h, i) => (
              <div
                key={h.time + i}
                className={`shrink-0 w-[62px] py-2.5 px-1 flex flex-col items-center gap-1 snap-start ${
                  i === 0 ? 'hour-chip-active' : 'hour-chip'
                }`}
              >
                <span className={`text-[10px] font-medium ${i === 0 ? 'text-white/85' : 'text-white/45'}`}>
                  {i === 0 ? (lang === 'hi' ? 'अब' : 'Now') : h.label.replace(':00', '')}
                </span>
                <WeatherIcon name={h.icon} className="w-8 h-8" />
                <span className="text-[14px] font-semibold tabular-nums text-white">{t(h.temp)}°</span>
                <span className={`text-[10px] ${i === 0 ? 'text-white/80' : 'text-sky-300'}`}>{h.pop}%</span>
              </div>
            ))}
          </div>

          <div className="mt-4 h-[120px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashTempFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5eb0ff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#5eb0ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: '#1a2238',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="temp"
                  stroke="#7ec0f2"
                  strokeWidth={2.2}
                  fill="url(#dashTempFill)"
                  name={lang === 'hi' ? 'तापमान' : 'Temp'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="space-y-0.5">
          {weather.daily.map((d, i) => (
            <div
              key={d.date}
              className={`flex items-center gap-3 px-2 py-2.5 rounded-xl ${
                i === 0 ? 'bg-white/6' : ''
              }`}
            >
              <span className="w-12 text-[12px] font-semibold text-white/90">
                {weekdayLabel(d, i, lang)}
              </span>
              <WeatherIcon name={d.icon} className="w-8 h-8 shrink-0" />
              <span className="flex-1 text-[12px] text-white/50 truncate">
                {lang === 'hi' ? d.condition_hi : d.condition}
              </span>
              <span className="text-[11px] text-sky-300 font-medium w-9 text-right">{d.pop}%</span>
              <span className="text-[13px] font-semibold text-white tabular-nums w-[58px] text-right">
                +{t(d.max)}°
                <span className="text-white/40 font-medium ml-1">/{t(d.min)}°</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  /* ---------- AI BRIEF (product) ---------- */
  const briefBlock = (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-300 text-white flex items-center justify-center shadow-md shadow-sky-400/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">
              {lang === 'hi' ? 'AI मौसम ब्रीफ' : 'AI Weather Brief'}
            </p>
            <p className="text-[11px] text-ink-400">
              {lang === 'hi' ? 'व्याख्या · सलाह' : 'What · Expect · Do'} · {brief?.confidenceLabel} (
              {brief?.confidencePct}%)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onShare}
          className="text-[12px] font-semibold text-sky-400 flex items-center gap-1 pressable focus-ring rounded-lg px-2 py-1"
        >
          <Share2 className="w-3.5 h-3.5" />
          {shareState || (lang === 'hi' ? 'शेयर' : 'Share')}
        </button>
      </div>

      <BriefBlock kicker={lang === 'hi' ? 'क्या हो रहा है' : "What's happening"} body={brief?.what} tone="fact" />
      <BriefBlock kicker={lang === 'hi' ? 'क्या उम्मीद करें' : 'What to expect'} body={brief?.expect} tone="forecast" />
      <BriefBlock
        kicker={lang === 'hi' ? 'आपको क्या करना चाहिए' : 'What you should do'}
        body={brief?.recommendation}
        tone="action"
      />

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => onOpenChat?.(lang === 'hi' ? 'आज का पूर्वानुमान समझाओ' : "Explain today's forecast")}
          className="text-[12px] font-semibold px-3.5 py-2 rounded-full bg-gradient-to-r from-sky-400 to-[#3d8fef] text-white shadow-md shadow-sky-400/25 pressable focus-ring"
        >
          {lang === 'hi' ? 'पूर्वानुमान समझाओ' : 'Explain this forecast'}
        </button>
        <button
          type="button"
          onClick={() => onOpenChat?.(lang === 'hi' ? 'मौसम भविष्यवाणी' : 'Weather prediction')}
          className="text-[12px] font-semibold px-3.5 py-2 rounded-full border border-cloud-200 text-navy-900 pressable focus-ring"
        >
          {lang === 'hi' ? 'AI पूछो' : 'Ask AI'}
        </button>
      </div>
    </section>
  )

  /* ---------- ALERT ---------- */
  const alertBlock = topAlert ? (
    <button
      type="button"
      onClick={onOpenAlerts}
      className="card p-4 text-left w-full pressable focus-ring"
    >
      <div className="flex items-start gap-3">
        <SeverityDot severity={topAlert.severity} className="mt-1.5 scale-125" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${alertMeta.cls}`}>
              {alertMeta.label}
            </span>
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">
              {topAlert.source || 'MODEL'}
            </span>
          </div>
          <p className="text-[14px] font-semibold text-navy-900">
            {lang === 'hi' ? topAlert.title_hi || topAlert.title : topAlert.title}
          </p>
          <p className="text-[12px] text-ink-500 mt-0.5 line-clamp-2">
            {lang === 'hi' ? topAlert.summary_hi || topAlert.summary : topAlert.summary}
          </p>
          <p className="text-[11px] text-ink-400 mt-1.5">
            {city} · {lang === 'hi' ? 'विवरण के लिए टैप' : 'Tap for details'}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-ink-400 shrink-0 mt-1" />
      </div>
    </button>
  ) : (
    <div className="card px-4 py-3 flex items-center gap-2 text-[13px] text-navy-900">
      <span className="live-dot" />
      {lang === 'hi' ? 'कोई गंभीर अलर्ट नहीं' : 'No severe alerts for this area'}
    </div>
  )

  /* ---------- DECISIONS + Why ---------- */
  const decisionsBlock = (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2 text-white/70">
        {lang === 'hi' ? 'आज के फैसले' : "Today's decisions"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {decisions.map((d) => {
          const Icon = d.icon
          const open = whyId === d.id
          return (
            <div key={d.id} className="card p-3.5">
              <button
                type="button"
                onClick={() => onOpenMode?.(d.id)}
                className="w-full text-left pressable focus-ring rounded-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="w-4 h-4 text-sky-400" />
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sevClass(d.level)}`}>
                    {d.label}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-navy-900 mt-2">{d.title}</p>
                <p className="text-[12px] text-ink-500 mt-0.5 line-clamp-2">{d.advice}</p>
              </button>
              <button
                type="button"
                onClick={() => setWhyId(open ? null : d.id)}
                className="mt-2 text-[11px] font-semibold text-sky-400 flex items-center gap-0.5 focus-ring rounded"
              >
                {lang === 'hi' ? 'क्यों?' : 'Why?'}
                <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease }}
                    className="overflow-hidden"
                  >
                    <ul className="mt-2 space-y-1 border-t border-cloud-100 pt-2">
                      {d.factors.map((f, i) => (
                        <li key={i} className="text-[11px] text-ink-600 flex gap-1.5">
                          <span className="text-sky-400">•</span>
                          {f}
                        </li>
                      ))}
                      {(d.why || []).slice(0, 2).map((w, i) => (
                        <li key={`w${i}`} className="text-[11px] text-ink-500 flex gap-1.5">
                          <span className="text-ink-300">•</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </section>
  )

  /* ---------- AQI ---------- */
  const aqiBlock =
    aqi?.aqi != null ? (
      <section className="card p-4">
        <div className="flex items-center gap-3">
          <div className="aqi-ring w-14 h-14 rounded-full p-[3px] shrink-0" style={{ ['--p']: aqiPct }}>
            <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center border border-cloud-100">
              <span className="text-[14px] font-bold text-navy-900 leading-none">{aqi.aqi}</span>
              <span className="text-[8px] text-ink-400 font-semibold">AQI</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
              {lang === 'hi' ? 'वायु गुणवत्ता' : 'Air quality'}
            </p>
            <p className="text-[14px] font-semibold text-navy-900">
              {lang === 'hi' ? aqi.band.hi : aqi.band.en}
              <span className="text-[11px] font-medium text-ink-400 ml-1.5">{aqi.scale}</span>
            </p>
            <p className="text-[12px] text-ink-500 mt-0.5">{aqi.advice(lang)}</p>
          </div>
        </div>
      </section>
    ) : null

  /* ---------- Sources ---------- */
  const sourcesBlock = (
    <section className="rounded-2xl bg-black/20 border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setSourcesOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left focus-ring text-white"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          <Info className="w-3.5 h-3.5 opacity-70" />
          {lang === 'hi' ? 'डेटा और स्रोत' : 'Data & sources'}
        </span>
        <ChevronDown className={`w-4 h-4 opacity-60 transition ${sourcesOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {sourcesOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <ul className="px-4 pb-3 space-y-1.5 text-white/80">
              {(weather.sources || []).map((s, i) => (
                <li key={i} className="text-[12px] leading-snug">
                  <span className="font-semibold">{s.name}</span>
                  <span className="opacity-70"> — {s.role}</span>
                </li>
              ))}
              <li className="text-[11px] opacity-60 pt-1">
                {lang === 'hi' ? 'अंतिम अपडेट' : 'Last updated'}: {minsAgo}{' '}
                {lang === 'hi' ? 'मिनट पहले' : 'min ago'}
                {weather.liveSource ? ` · ${weather.liveSource}` : ''}
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )

  return (
    <div className={`relative h-full overflow-y-auto scroll-thin ${sky}`}>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/5 via-transparent to-black/25" />
      <div
        className={`relative px-3 sm:px-4 lg:px-6 pt-2 pb-6 ${
          isDesktop ? 'desktop-grid max-w-6xl mx-auto' : 'space-y-3 max-w-lg mx-auto'
        }`}
      >
        {isDesktop ? (
          <>
            <div className="space-y-3">
              {heroBlock}
              {darkSheet}
            </div>
            <div className="space-y-3">
              {briefBlock}
              {alertBlock}
              {decisionsBlock}
              {aqiBlock}
              {sourcesBlock}
              <p className="text-[10px] text-center text-white/40 pb-1">
                WeatherGPT · {weather.live ? 'LIVE' : 'offline pack'} · hybrid
              </p>
            </div>
          </>
        ) : (
          <>
            {heroBlock}
            {darkSheet}
            {briefBlock}
            {alertBlock}
            {decisionsBlock}
            {aqiBlock}
            {sourcesBlock}
            <p className="text-[10px] text-center text-white/40 pb-1">
              WeatherGPT · {weather.live ? 'LIVE' : 'offline pack'} ·{' '}
              {lang === 'hi' ? 'निर्णय समर्थन' : 'decision support'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function BriefBlock({ kicker, body, tone }) {
  const bar = tone === 'action' ? 'bg-mint-400' : tone === 'forecast' ? 'bg-sky-400' : 'bg-navy-700'
  return (
    <div className="flex gap-2.5 mb-2.5 last:mb-0">
      <div className={`w-1 rounded-full shrink-0 ${bar}`} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">{kicker}</p>
        <p className="text-[13px] text-ink-700 leading-relaxed mt-0.5">{stripMd(body)}</p>
      </div>
    </div>
  )
}
