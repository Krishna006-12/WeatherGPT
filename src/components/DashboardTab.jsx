import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import DataStatusPill, { DataStatusBanner } from './DataStatusPill'
import ModelConsensusCard from './ModelConsensusCard'
import { shouldDeferHeavyUI } from '../services/networkStatus'
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
  Plus,
  Share2,
  Sparkles,
  Sprout,
  Sun,
  Wind,
} from 'lucide-react'
import { WeatherIcon, SeverityDot } from './Icons'
import {
  buildTravelInsight,
  buildSchoolInsight,
  estimateVisibility,
} from '../services/insights'
import { buildStructuredBrief, buildDailyBriefing, shareBriefing } from '../services/briefing'
import { toDisplayTemp, tempUnitLabel } from '../services/storage'
import { CITIES, getCity } from '../data/cities'

const WeatherCharacter = lazy(() => import('./WeatherCharacter'))
const LiveWorldMap = lazy(() => import('./LiveWorldMap'))

const SparkTemp = lazy(() =>
  import('./DashCharts').then((m) => ({ default: m.SparkTemp })),
)
const HourlyTempChart = lazy(() =>
  import('./DashCharts').then((m) => ({ default: m.HourlyTempChart })),
)

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

function heroSkyStyle(weather) {
  const icon = weather?.current?.icon || ''
  const night = weather?.current?.isDay === false
  if (night) {
    return {
      background: `
        radial-gradient(ellipse 40% 50% at 20% 30%, rgba(80,100,180,0.35), transparent 60%),
        linear-gradient(155deg, #0a1428 0%, #121c38 45%, #070d18 100%)`,
    }
  }
  if (icon.includes('lightning') || icon.includes('storm')) {
    return {
      background: `linear-gradient(155deg, #2a3348 0%, #1a2030 50%, #0c1018 100%)`,
    }
  }
  if (icon.includes('rain') || icon.includes('drizzle')) {
    return {
      background: `
        radial-gradient(ellipse 50% 40% at 70% 20%, rgba(100,160,220,0.25), transparent 55%),
        linear-gradient(155deg, #3d5a7a 0%, #243848 50%, #121e2c 100%)`,
    }
  }
  if (icon === 'sun') {
    return {
      background: `
        radial-gradient(ellipse 48% 42% at 78% 18%, rgba(255,210,100,0.55), transparent 58%),
        linear-gradient(155deg, #6eb4f5 0%, #4a8ee0 40%, #2a5fb0 100%)`,
    }
  }
  return {
    background: `
      radial-gradient(ellipse 55% 40% at 75% 15%, rgba(255,255,255,0.28), transparent 55%),
      linear-gradient(155deg, #6aa8f0 0%, #4a82d4 48%, #2a58a8 100%)`,
  }
}

function heroCloudMode(weather) {
  if (!weather?.current?.isDay) return 'night'
  const icon = weather?.current?.icon || ''
  if (icon.includes('lightning') || icon.includes('storm')) return 'storm'
  if (icon.includes('rain') || icon.includes('drizzle')) return 'rain'
  if (icon === 'sun') return 'clear'
  return 'cloudy'
}

function sevGlass(level) {
  const hi = level === 'high' || level === 'avoid' || level === 'poor' || level === 'extreme'
  const mid = level === 'moderate' || level === 'elevated' || level === 'caution'
  if (hi) return 'sev-on-glass-high'
  if (mid) return 'sev-on-glass-mid'
  return 'sev-on-glass-low'
}

function alertSev(severity) {
  if (severity === 'red') return { label: 'SEVERE', cls: 'sev-severe' }
  if (severity === 'amber') return { label: 'HIGH', cls: 'sev-high' }
  if (severity === 'yellow') return { label: 'MODERATE', cls: 'sev-moderate' }
  return { label: 'LOW', cls: 'sev-low' }
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

function shortHourLabel(h, i, lang) {
  if (i === 0) return lang === 'hi' ? 'अब' : 'Now'
  const raw = String(h.label || '')
  return raw.replace(':00', '').replace(/^0/, '') || raw
}

function windCompass(deg, lang) {
  const d = ((Number(deg) % 360) + 360) % 360
  const dirsEn = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const dirsHi = ['उ', 'ईउ', 'पू', 'दपू', 'द', 'दप', 'प', 'उप']
  const idx = Math.round(d / 45) % 8
  const fullEn = [
    'North',
    'Northeast',
    'East',
    'Southeast',
    'South',
    'Southwest',
    'West',
    'Northwest',
  ]
  const fullHi = [
    'उत्तर',
    'उत्तर-पूर्व',
    'पूर्व',
    'दक्षिण-पूर्व',
    'दक्षिण',
    'दक्षिण-पश्चिम',
    'पश्चिम',
    'उत्तर-पश्चिम',
  ]
  return {
    short: lang === 'hi' ? dirsHi[idx] : dirsEn[idx],
    full: lang === 'hi' ? fullHi[idx] : fullEn[idx],
    deg: Math.round(d),
  }
}

function conditionTitle(c, lang) {
  const raw = lang === 'hi' ? c.condition_hi || c.condition : c.condition
  const s = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (/thunder|storm|hail|तूफान|गर्ज|ओला/i.test(s)) {
    return {
      primary: lang === 'hi' ? 'तूफ़ानी' : 'Stormy',
      // Don't repeat the long model string under the title — keep one line
      secondary: lang === 'hi' ? 'मॉडल संकेत · सावधानी' : 'Model signal · stay alert',
    }
  }
  if (/rain|drizzle|बारिश|बौछ/i.test(s)) {
    return {
      primary: lang === 'hi' ? 'बारिश' : 'Rainy',
      secondary: lang === 'hi' ? 'गीली स्थितियाँ' : 'Wet conditions',
    }
  }
  if (/clear|साफ|sunny/i.test(s)) {
    return {
      primary: lang === 'hi' ? 'साफ़' : 'Clear',
      secondary: lang === 'hi' ? 'खुला आसमान' : 'Open skies',
    }
  }
  if (/overcast|cloud|बादल|घने/i.test(s)) {
    return {
      primary: s || (lang === 'hi' ? 'बादल' : 'Overcast'),
      secondary: lang === 'hi' ? 'आकाश ढका' : 'Sky covered',
    }
  }
  // Never put "Feels like" here — meta row already shows it once
  return {
    primary: s || (lang === 'hi' ? 'मौसम' : 'Weather'),
    secondary: null,
  }
}

function RainAmbient({ active }) {
  const drops = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: `${(i * 19 + 7) % 100}%`,
        delay: `${(i % 6) * 0.25}s`,
        dur: `${1.05 + (i % 4) * 0.18}s`,
      })),
    [],
  )
  if (!active) return null
  return (
    <div className="ambient-rain" aria-hidden>
      {drops.map((d) => (
        <span
          key={d.id}
          style={{ left: d.left, animationDelay: d.delay, animationDuration: d.dur }}
        />
      ))}
    </div>
  )
}

function HeroClouds({ mode }) {
  const cls =
    mode === 'storm'
      ? 'is-storm'
      : mode === 'rain'
        ? 'is-rain'
        : mode === 'clear'
          ? 'is-clear'
          : mode === 'night'
            ? 'is-night'
            : ''
  return (
    <div className={`hero-clouds ${cls}`} aria-hidden>
      <span className="cloud c1" />
      <span className="cloud c2" />
      <span className="cloud c3" />
      <span className="cloud c4" />
      <span className="mist mist-a" />
      <span className="mist mist-b" />
      {mode === 'storm' && <span className="flash" />}
      {mode === 'clear' && <span className="sun-glow" />}
    </div>
  )
}

function MetricTile({ icon: Icon, label, value, unit, sub }) {
  return (
    <div className="pg-metric wx-metric">
      <div className="pg-metric-icon wx-metric-icon">
        {Icon ? <Icon className="w-4 h-4" /> : null}
      </div>
      <div className="wx-metric-copy">
        <p className="pg-metric-label">{label}</p>
        <p className="pg-metric-value">
          {value}
          {unit ? <span className="pg-metric-unit">{unit}</span> : null}
        </p>
        {sub ? <p className="pg-metric-sub">{sub}</p> : null}
      </div>
    </div>
  )
}

function DayRangeBar({ min, max, absMin, absMax }) {
  const span = Math.max(1, absMax - absMin)
  const left = ((min - absMin) / span) * 100
  const width = ((max - min) / span) * 100
  return (
    <div className="pg-day-bar-track">
      <div
        className="pg-day-bar-fill"
        style={{ left: `${left}%`, width: `${Math.max(8, width)}%` }}
      />
    </div>
  )
}

/** Compact arc gauge — CSS only, uses real numeric value (no invented scale labels beyond min/max props). */
function ArcGauge({ value, max = 12, label, sub, tone = 'sky' }) {
  const v = Number(value)
  const safe = Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0
  const pct = max > 0 ? safe / max : 0
  // semicircle path length ~ 126 for r=40
  const len = 126
  const dash = `${(pct * len).toFixed(1)} ${len}`
  return (
    <div className={`wx-arc wx-arc-${tone}`} title={sub || label}>
      <svg className="wx-arc-svg" viewBox="0 0 100 60" aria-hidden>
        <path
          className="wx-arc-track"
          d="M 10 52 A 40 40 0 0 1 90 52"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          className="wx-arc-value"
          d="M 10 52 A 40 40 0 0 1 90 52"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={dash}
        />
      </svg>
      <div className="wx-arc-readout">
        <span className="wx-arc-num tabular-nums">{Number.isFinite(v) ? (Number.isInteger(v) ? v : v.toFixed(1)) : '—'}</span>
        <span className="wx-arc-label">{label}</span>
        {sub ? <span className="wx-arc-sub">{sub}</span> : null}
      </div>
    </div>
  )
}

function MetricStrip({ items }) {
  return (
    <div className="wx-metric-strip" role="list">
      {items.map((it) => {
        const Icon = it.icon
        return (
          <div key={it.label} className="wx-metric-strip-item" role="listitem">
            {Icon ? (
              <span className="wx-metric-strip-ico" aria-hidden>
                <Icon className="w-3.5 h-3.5" />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="wx-metric-strip-lbl">{it.label}</p>
              <p className="wx-metric-strip-val tabular-nums">
                {it.value}
                {it.unit ? <span className="wx-metric-strip-unit">{it.unit}</span> : null}
              </p>
              {it.sub ? <p className="wx-metric-strip-sub">{it.sub}</p> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardTab({
  weather,
  aqi,
  lang,
  units,
  minsAgo: minsAgoProp,
  dataStatus,
  netSnap,
  onRefresh,
  onOpenMode,
  onOpenChat,
  onOpenAlerts,
  onOpenCities,
  onOpenForecast,
  recentCities = [],
  onSelectCity,
}) {
  const [shareState, setShareState] = useState('')
  const [whyId, setWhyId] = useState(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [hourIdx, setHourIdx] = useState(0)
  const [dayIdx, setDayIdx] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setIsDesktop(!!mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  useEffect(() => {
    setHourIdx(0)
    setDayIdx(0)
  }, [weather?.city?.id, weather?.fetchedAt])

  const sky = skyClass(weather)

  if (!weather) {
    return (
      <div className={`h-full overflow-y-auto scroll-thin scroll-dark ${sky}`}>
        <div className="page-pad pt-3 pb-6 space-y-3.5 max-w-lg lg:max-w-[1400px] mx-auto">
          <div className="skel skel-hero" />
          <div className="grid grid-cols-3 gap-2">
            <div className="skel skel-row" />
            <div className="skel skel-row" />
            <div className="skel skel-row" />
          </div>
          <div className="skel skel-card" />
          <p className="type-meta text-center pt-2">
            {lang === 'hi' ? 'लाइव मौसम लोड हो रहा है…' : 'Loading live weather…'}
          </p>
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
  const city =
    lang === 'hi' ? weather.city.name_hi || weather.city.name : weather.city.name
  const stateLine = (() => {
    const st = lang === 'hi' ? weather.city.state_hi || weather.city.state : weather.city.state
    const cc = (weather.city.countryCode || weather.city.countryShort || '').toUpperCase()
    const country = weather.city.countryShort || weather.city.country
    if (st && (!cc || cc === 'IN')) return st
    return [st, country].filter(Boolean).join(', ')
  })()
  const unit = tempUnitLabel(units)
  const t = (n) => toDisplayTemp(n, units)
  const hours = (weather.hourly || []).slice(0, 24)
  const activeHour = hours[hourIdx] || hours[0]
  const displayTemp = hourIdx > 0 && activeHour ? t(activeHour.temp) : t(c.temp)
  const displayPop =
    hourIdx > 0 ? activeHour?.pop ?? d0?.pop ?? 0 : d0?.pop ?? activeHour?.pop ?? 0
  const chartData = hours.slice(0, 24).map((h, i) => ({
    label: shortHourLabel(h, i, lang),
    temp: i === 0 ? t(c.temp) : t(h.temp),
    pop: h.pop ?? 0,
    rain: h.rain ?? h.precipitation ?? 0,
    wind: h.wind ?? c.wind ?? null,
    i,
  }))

  const onShare = async () => {
    const text = buildDailyBriefing(weather, aqi, lang)
    const r = await shareBriefing(text)
    setShareState(r === 'shared' || r === 'copied' ? (lang === 'hi' ? 'कॉपी ✓' : 'Copied ✓') : '—')
    setTimeout(() => setShareState(''), 2000)
  }

  const aqiPct = aqi?.aqi != null ? Math.min(1, aqi.aqi / 300) : 0
  const topAlert = weather.alerts?.[0]
  const alertMeta = topAlert ? alertSev(topAlert.severity) : null
  const rainy = sky === 'sky-rain' || sky === 'sky-storm'
  const sunny = sky === 'sky-clear'
  const cloudMode = heroCloudMode(weather)
  const cond = conditionTitle(c, lang)
  const windMeta = windCompass(c.windDir ?? 0, lang)
  const hourTray = hours.slice(0, isDesktop ? 12 : 14)
  const dayTray = (weather.daily || []).slice(0, 7)
  const dayMins = dayTray.map((d) => d.min).filter((n) => n != null && !Number.isNaN(Number(n)))
  const dayMaxs = dayTray.map((d) => d.max).filter((n) => n != null && !Number.isNaN(Number(n)))
  const absMin = dayMins.length ? Math.min(...dayMins) : 0
  const absMax = dayMaxs.length ? Math.max(...dayMaxs) : 1

  const dateLine = (() => {
    try {
      const raw =
        weather.current?.time || weather.hourly?.[0]?.time || weather.fetchedAt || Date.now()
      const d = raw instanceof Date ? raw : new Date(raw)
      const tz = weather.city?.tz || weather.timezone || 'Asia/Kolkata'
      return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: tz,
      })
    } catch {
      return ''
    }
  })()

  const coreOnly = !!(netSnap?.coreOnly || shouldDeferHeavyUI(netSnap || {}))
  const minsAgo = (() => {
    if (minsAgoProp != null && Number.isFinite(Number(minsAgoProp))) return Number(minsAgoProp)
    try {
      const ts = weather.fetchedAt || Date.now()
      return Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000))
    } catch {
      return 0
    }
  })()

  const riskBadge = (() => {
    if (topAlert?.severity === 'red')
      return { label: lang === 'hi' ? 'गंभीर' : 'Dangerous', cls: 'sev-severe' }
    if (topAlert?.severity === 'amber')
      return { label: lang === 'hi' ? 'उच्च' : 'Elevated', cls: 'sev-high' }
    if ((d0?.pop ?? 0) >= 70 || c.wind >= 40)
      return { label: lang === 'hi' ? 'सावधान' : 'Caution', cls: 'sev-moderate' }
    return { label: lang === 'hi' ? 'स्थिर' : 'Stable', cls: 'sev-low' }
  })()

  const decisions = [
    {
      id: 'travel',
      icon: Car,
      title: lang === 'hi' ? 'यात्रा' : 'Travel',
      label: travel.riskLabel,
      level: travel.riskLevel,
      advice: travel.advice,
      factors: [
        lang === 'hi'
          ? `दृश्यता ~${travel.visibilityKm} किमी`
          : `Visibility ~${travel.visibilityKm} km`,
        lang === 'hi' ? `हवा ${travel.windKmh} किमी/घं` : `Wind ${travel.windKmh} km/h`,
      ],
    },
    {
      id: 'school',
      icon: GraduationCap,
      title: lang === 'hi' ? 'स्कूल' : 'School',
      label: school.outdoorLabel,
      level: school.outdoorLevel,
      advice: school.recommendations[0],
      factors: [
        lang === 'hi'
          ? `हीट ${school.heatLabel}`
          : `Heat ${school.heatLabel}`,
        `UV ${school.uv ?? '—'}`,
      ],
    },
    {
      id: 'farm',
      icon: Sprout,
      title: lang === 'hi' ? 'कृषि' : 'Farm',
      label: lang === 'hi' ? (weather?.agri?.soil?.hi || '—') : (weather?.agri?.soil?.en || '—'),
      level:
        weather?.agri?.soil?.level === 'low'
          ? 'moderate'
          : weather?.agri?.soil?.level === 'high'
            ? 'elevated'
            : 'low',
      advice: lang === 'hi' ? (weather?.agri?.advice_hi || '—') : (weather?.agri?.advice_en || '—'),
      factors: [
        lang === 'hi'
          ? `हाल बारिश ${weather?.agri?.recentRain ?? '—'} मिमी`
          : `Recent rain ${weather?.agri?.recentRain ?? '—'} mm`,
      ],
    },
  ]

  const recentRaw = (recentCities || []).filter((r) => r.id !== weather.city?.id)
  const SUGGEST_IDS = ['delhi', 'lucknow', 'mumbai', 'varanasi', 'patna']
  const suggestions = SUGGEST_IDS.map((id) => getCity(id) || CITIES[id])
    .filter((x) => x && x.id !== weather.city?.id)
    .slice(0, 3)
  const sideCities = (recentRaw.length ? recentRaw : suggestions).slice(0, 4)

  /* ═══════════ PREMIUM BENTO LAYOUT ═══════════ */

  const heroCard = (
    <section className={`pg-hero dash-hero wx-env-hero sky-mode-${cloudMode}`}>
      <div className="dash-hero-bg" style={heroSkyStyle(weather)} />
      <HeroClouds mode={cloudMode} />
      {sunny && <div className="ambient-rays" aria-hidden />}
      {sunny && (
        <div className="hero-sparkles" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </div>
      )}
      <RainAmbient active={rainy} />
      {cloudMode === 'night' && <div className="hero-night-stars" aria-hidden />}

      <div className="pg-hero-content">
        <div className="wx-hero-top flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onOpenCities}
            className="text-left pressable focus-ring rounded-xl wx-loc-btn"
          >
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/95">
              <MapPin className="w-3.5 h-3.5 text-white/70" />
              <span className="truncate">
                {city}
                {stateLine ? <span className="text-white/45 font-medium">{`, ${stateLine}`}</span> : null}
              </span>
            </p>
            <p className="text-[11px] text-white/50 mt-1 pl-5">{dateLine}</p>
          </button>
          <div className="wx-live-quiet">
            <DataStatusPill status={dataStatus} lang={lang} />
          </div>
        </div>

        {/* Tight hero: temp + condition LEFT, character RIGHT — no empty void */}
        <div className="pg-hero-main wx-hero-stage">
          <div className="pg-hero-temp-block">
            <div className="wx-temp-line">
              <span className="pg-hero-temp type-hero-temp temp-fade" key={displayTemp}>
                {displayTemp}
              </span>
              <span className="wx-hero-unit">{unit}</span>
            </div>
            <p className="wx-hero-condition">{cond.primary}</p>
            {cond.secondary ? <p className="wx-hero-sub">{cond.secondary}</p> : null}
            <div className="hero-meta-row">
              <span className="hero-feels tabular-nums">
                {lang === 'hi' ? 'महसूस' : 'Feels'} <strong>{t(c.feelsLike)}°</strong>
              </span>
              <span className="hl-pill" title={lang === 'hi' ? 'उच्च' : 'High'}>
                H {t(d0.max)}°
              </span>
              <span className="hl-pill" title={lang === 'hi' ? 'निम्न' : 'Low'}>
                L {t(d0.min)}°
              </span>
              <span className={`wx-status-chip text-[10px] font-bold px-2.5 py-1 rounded-full ${riskBadge.cls}`}>
                {riskBadge.label}
              </span>
            </div>
          </div>
          <div className="wx-character-slot" aria-hidden={false}>
            <Suspense fallback={<div className="wx-character-skel" aria-hidden />}>
              <WeatherCharacter weather={weather} lang={lang} />
            </Suspense>
          </div>
        </div>

        <div className="wx-hero-rail" role="group" aria-label={lang === 'hi' ? 'मुख्य मेट्रिक्स' : 'Key metrics'}>
          <div className="wx-hero-rail-item">
            <Wind className="w-3.5 h-3.5 text-white/45" aria-hidden />
            <div className="wx-hero-rail-text">
              <span className="wx-hero-rail-val tabular-nums">{c.wind}</span>
              <span className="wx-hero-rail-lbl">
                km/h · {windMeta.short}
              </span>
            </div>
          </div>
          <div className="wx-hero-rail-item">
            <Droplets className="w-3.5 h-3.5 text-white/45" aria-hidden />
            <div className="wx-hero-rail-text">
              <span className="wx-hero-rail-val tabular-nums">{c.humidity}%</span>
              <span className="wx-hero-rail-lbl">{lang === 'hi' ? 'नमी' : 'Humidity'}</span>
            </div>
          </div>
          <div className="wx-hero-rail-item">
            <Eye className="w-3.5 h-3.5 text-white/45" aria-hidden />
            <div className="wx-hero-rail-text">
              <span className="wx-hero-rail-val tabular-nums">{vis}</span>
              <span className="wx-hero-rail-lbl">{lang === 'hi' ? 'दृश्यता' : 'Visibility'} km</span>
            </div>
          </div>
          <div className="wx-hero-rail-item">
            <CloudRain className="w-3.5 h-3.5 text-white/45" aria-hidden />
            <div className="wx-hero-rail-text">
              <span className="wx-hero-rail-val tabular-nums">{displayPop}%</span>
              <span className="wx-hero-rail-lbl">{lang === 'hi' ? 'बारिश' : 'Rain chance'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )

  const weekCard = (
    <section className="wx-section wx-section-week wx-open-panel">
      <div className="flex items-center justify-between mb-2">
        <h3 className="wx-section-title">{lang === 'hi' ? '7 दिन' : '7-day forecast'}</h3>
        <button
          type="button"
          onClick={onOpenForecast}
          className="text-[11px] font-semibold text-sky-300/90 hover:text-sky-200 focus-ring rounded px-1"
        >
          {lang === 'hi' ? 'पूरा →' : 'See all'}
        </button>
      </div>
      <div className="wx-day-list">
        {dayTray.map((d, i) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setDayIdx(i)}
            className={`pg-day-row wx-day-row focus-ring ${i === dayIdx ? 'is-active' : ''}`}
          >
            <span className="pg-day-name">{weekdayLabel(d, i, lang)}</span>
            <WeatherIcon name={d.icon} className="w-7 h-7 shrink-0" />
            <span className="pg-day-pop">
              {d.pop >= 30 ? (
                <span className="text-sky-300 font-semibold">{d.pop}%</span>
              ) : (
                <span className="text-white/25">—</span>
              )}
            </span>
            <span className="pg-day-temps">
              <span className="text-white/40 tabular-nums">{t(d.min)}°</span>
              <DayRangeBar min={d.min} max={d.max} absMin={absMin} absMax={absMax} />
              <span className="text-white font-semibold tabular-nums">{t(d.max)}°</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )

  const hourlyCard = (
    <section className="wx-section wx-section-hourly wx-open-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="wx-section-title">{lang === 'hi' ? 'घंटेवार' : '24-hour forecast'}</h3>
        <span className="text-[11px] text-white/40">
          {lang === 'hi' ? 'अगले घंटे' : 'Next hours'}
        </span>
      </div>
      <div className="tray-scroll scroll-thin scroll-dark gap-2 pb-1 wx-hour-tray">
        {hourTray.map((h, i) => {
          const active = i === hourIdx
          return (
            <button
              key={h.time + i}
              type="button"
              onClick={() => setHourIdx(i)}
              className={`pg-hour-chip wx-hour-chip focus-ring ${active ? 'is-active' : ''}`}
              aria-pressed={active}
            >
              <span className="text-[11px] font-semibold text-white/50">
                {shortHourLabel(h, i, lang)}
              </span>
              <WeatherIcon name={h.icon} className="w-8 h-8" />
              {h.pop >= 40 && (
                <span className="wx-hour-pop text-[10px] font-semibold text-sky-300">{h.pop}%</span>
              )}
              <span className="text-[15px] font-semibold text-white tabular-nums">{t(h.temp)}°</span>
              {typeof h.pop === 'number' && h.pop > 0 && (
                <span
                  className="wx-hour-pop-bar"
                  style={{ ['--pop']: Math.min(100, Math.max(0, h.pop)) / 100 }}
                  aria-hidden
                />
              )}
            </button>
          )
        })}
      </div>
      {activeHour && (
        <div className="hour-detail-strip" aria-live="polite">
          <span className="tabular-nums font-semibold text-white">
            {shortHourLabel(activeHour, hourIdx, lang)}
          </span>
          <span className="tabular-nums text-sky-200">{t(hourIdx > 0 ? activeHour.temp : c.temp)}°</span>
          <span className="text-white/55">
            POP <strong className="text-white/85">{activeHour.pop ?? '—'}%</strong>
          </span>
          <span className="text-white/55">
            {lang === 'hi' ? 'वर्षा' : 'Rain'}{' '}
            <strong className="text-white/85">{activeHour.rain ?? activeHour.precipitation ?? 0} mm</strong>
          </span>
          {(activeHour.wind != null || c.wind != null) && (
            <span className="text-white/55 hidden xs:inline sm:inline">
              {lang === 'hi' ? 'हवा' : 'Wind'}{' '}
              <strong className="text-white/85">{activeHour.wind ?? c.wind} km/h</strong>
            </span>
          )}
        </div>
      )}
      <div
        className={`mt-3 w-full rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06] ${
          isDesktop ? 'h-[128px]' : 'h-[100px]'
        }`}
      >
        <Suspense fallback={<div className="h-full shimmer-dark rounded-xl" />}>
          <HourlyTempChart data={chartData} lang={lang} onPick={setHourIdx} />
        </Suspense>
      </div>
    </section>
  )

  const uvVal = d0?.uv ?? school.uv ?? null
  const sunrise = weather.astro?.sunrise || '—'
  const sunset = weather.astro?.sunset || '—'

  const overviewCard = (
    <section className="wx-section wx-section-metrics wx-open-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="wx-section-title">{lang === 'hi' ? 'स्थितियाँ' : 'Conditions'}</h3>
        <span className={`wx-status-chip text-[10px] font-bold px-2.5 py-1 rounded-full ${riskBadge.cls}`}>
          {riskBadge.label}
        </span>
      </div>
      <MetricStrip
        items={[
          {
            icon: Droplets,
            label: lang === 'hi' ? 'नमी' : 'Humidity',
            value: c.humidity ?? '—',
            unit: '%',
          },
          {
            icon: Wind,
            label: lang === 'hi' ? 'हवा' : 'Wind',
            value: c.wind ?? '—',
            unit: 'km/h',
            sub: windMeta.full,
          },
          {
            icon: Eye,
            label: lang === 'hi' ? 'दृश्यता' : 'Visibility',
            value: vis ?? '—',
            unit: 'km',
          },
          {
            icon: CloudRain,
            label: lang === 'hi' ? 'बारिश' : 'Rain',
            value: displayPop ?? '—',
            unit: '%',
          },
          {
            icon: Gauge,
            label: lang === 'hi' ? 'दबाव' : 'Pressure',
            value: c.pressure ?? '—',
            unit: 'hPa',
          },
          {
            icon: Sun,
            label: 'UV',
            value: uvVal ?? '—',
          },
        ]}
      />
      <div className="wx-gauge-row mt-4">
        <ArcGauge
          value={uvVal}
          max={12}
          label="UV"
          sub={lang === 'hi' ? 'सूचकांक' : 'Index'}
          tone="uv"
        />
        <div className="wx-sun-strip" aria-label={lang === 'hi' ? 'सूर्योदय सूर्यास्त' : 'Sunrise sunset'}>
          <div className="wx-sun-item">
            <span className="wx-sun-ico" aria-hidden>
              <Sun className="w-4 h-4" />
            </span>
            <div>
              <p className="wx-metric-strip-lbl">{lang === 'hi' ? 'सूर्योदय' : 'Sunrise'}</p>
              <p className="wx-metric-strip-val tabular-nums">{sunrise}</p>
            </div>
          </div>
          <div className="wx-sun-arc" aria-hidden />
          <div className="wx-sun-item">
            <span className="wx-sun-ico is-set" aria-hidden>
              <Sun className="w-4 h-4" />
            </span>
            <div>
              <p className="wx-metric-strip-lbl">{lang === 'hi' ? 'सूर्यास्त' : 'Sunset'}</p>
              <p className="wx-metric-strip-val tabular-nums">{sunset}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[12px] text-white/40 mt-4 mb-2">
        {lang === 'hi' ? 'तापमान ट्रेंड · अगले घंटे' : 'Temperature trend · coming hours'}
      </p>
      <div className="h-[120px] sm:h-[140px] w-full rounded-2xl overflow-hidden wx-chart-well">
        <Suspense fallback={<div className="h-full shimmer-dark rounded-xl" />}>
          <SparkTemp data={chartData.slice(0, 14)} />
        </Suspense>
      </div>
    </section>
  )

  const citiesCard = (
    <section className="wx-section wx-section-cities wx-open-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="wx-section-title">
          {lang === 'hi' ? 'शहर' : 'Cities'}
        </h3>
        <button
          type="button"
          onClick={onOpenCities}
          className="text-[11px] font-semibold text-sky-300 focus-ring rounded"
        >
          {lang === 'hi' ? 'सभी →' : 'See all'}
        </button>
      </div>
      <div className="space-y-2">
        {sideCities.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelectCity?.(r)}
            className="pg-city-row focus-ring"
          >
            <WeatherIcon name="cloud-sun" className="w-9 h-9 shrink-0" />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[13px] font-semibold text-white truncate">
                {lang === 'hi' ? r.name_hi || r.name : r.name}
              </p>
              <p className="text-[11px] text-white/40 truncate">
                {r.state || r.countryShort || r.country || ''}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
          </button>
        ))}
        <button type="button" onClick={onOpenCities} className="pg-city-add focus-ring">
          <Plus className="w-4 h-4" />
          {lang === 'hi' ? 'शहर जोड़ें' : 'Add cities you care about'}
        </button>
      </div>
    </section>
  )

  const aqiCard =
    aqi?.aqi != null ? (
      <section className="wx-section wx-section-aqi wx-open-panel">
        <div className="flex items-center gap-3.5">
          <div
            className="aqi-ring w-14 h-14 rounded-full p-[3px] shrink-0"
            style={{ ['--p']: aqiPct }}
          >
            <div className="w-full h-full rounded-full bg-[#0B1F3A]/95 flex flex-col items-center justify-center border border-white/12">
              <span className="text-[15px] font-bold text-white leading-none tabular-nums">
                {aqi.aqi}
              </span>
              <span className="text-[8px] text-white/45 font-semibold mt-0.5">AQI</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
              {lang === 'hi' ? 'वायु गुणवत्ता' : 'Air quality'}
            </p>
            <p className="text-[14px] font-semibold text-white">
              {lang === 'hi' ? aqi.band.hi : aqi.band.en}
              {aqi.scale ? (
                <span className="text-[11px] font-medium text-white/40 ml-2">{aqi.scale}</span>
              ) : null}
            </p>
            <p className="text-[12px] text-white/50 mt-1 leading-snug">{aqi.advice(lang)}</p>
          </div>
        </div>
      </section>
    ) : null

  const alertCard = topAlert ? (
    <button
      type="button"
      onClick={onOpenAlerts}
      className={`wx-open-panel pg-alert-card wx-risk-story focus-ring text-left w-full sev-${topAlert.severity || 'yellow'}`}
    >
      <div className="flex items-start gap-3">
        <SeverityDot severity={topAlert.severity} className="mt-1.5 scale-125" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`pg-badge ${alertMeta.cls}`}>{alertMeta.label}</span>
            <span
              className={`pg-badge-source ${
                topAlert.kind === 'official' || topAlert.official
                  ? 'is-official'
                  : topAlert.kind === 'demo' || topAlert.simulated
                    ? 'is-demo'
                    : 'is-risk'
              }`}
            >
              {topAlert.kind === 'official' || topAlert.official
                ? lang === 'hi'
                  ? 'आधिकारिक'
                  : 'Official'
                : topAlert.kind === 'demo' || topAlert.simulated
                  ? 'Demo'
                  : lang === 'hi'
                    ? 'जोखिम संकेत'
                    : 'Risk signal'}
            </span>
          </div>
          <p className="text-[14px] font-semibold text-white">
            {lang === 'hi' ? topAlert.title_hi || topAlert.title : topAlert.title}
          </p>
          <p className="text-[12px] text-white/50 mt-0.5 line-clamp-2">
            {lang === 'hi' ? topAlert.summary_hi || topAlert.summary : topAlert.summary}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-white/35 shrink-0 mt-1" />
      </div>
    </button>
  ) : (
    <div className="wx-section wx-section-calm flex items-center gap-2 text-[13px] text-white/70 py-3.5 px-1">
      <span className="live-dot" />
      {lang === 'hi' ? 'कोई गंभीर अलर्ट नहीं' : 'No severe alerts for this area'}
    </div>
  )

  const briefCard = (
    <section className="wx-section wx-section-brief wx-open-panel">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400/90 to-sky-500/80 text-navy-950 flex items-center justify-center shadow-lg shadow-sky-400/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
              {lang === 'hi' ? 'AI मौसम ब्रीफ' : 'AI Weather Brief'}
            </p>
            <p className="text-[12px] text-white/55 mt-0.5">
              {lang === 'hi' ? 'क्या · उम्मीद · करें' : 'What · Expect · Do'}
              <span className="text-white/35">
                {' '}
                · {brief?.confidenceLabel} ({brief?.confidencePct}%)
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onShare}
          className="shrink-0 text-[12px] font-semibold text-sky-300 flex items-center gap-1 pressable focus-ring rounded-lg px-2.5 py-1.5 border border-white/10 bg-white/5"
        >
          <Share2 className="w-3.5 h-3.5" />
          {shareState || (lang === 'hi' ? 'शेयर' : 'Share')}
        </button>
      </div>
      <div className={isDesktop ? 'grid grid-cols-3 gap-4' : 'space-y-3'}>
        {[
          { k: lang === 'hi' ? 'क्या हो रहा है' : "What's happening", b: brief?.what, t: 'fact' },
          { k: lang === 'hi' ? 'क्या उम्मीद करें' : 'What to expect', b: brief?.expect, t: 'forecast' },
          {
            k: lang === 'hi' ? 'आपको क्या करना चाहिए' : 'What you should do',
            b: brief?.recommendation,
            t: 'action',
          },
        ].map((x) => (
          <div key={x.k} className="flex gap-2.5">
            <div
              className={`w-1 rounded-full shrink-0 min-h-[3.5rem] ${
                x.t === 'action' ? 'bg-mint-400' : x.t === 'forecast' ? 'bg-sky-400' : 'bg-white/50'
              }`}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">{x.k}</p>
              <p className="text-[13px] sm:text-[14px] text-white/80 leading-relaxed mt-1">
                {stripMd(x.b)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/8">
        <button
          type="button"
          onClick={() =>
            onOpenChat?.(lang === 'hi' ? 'आज का पूर्वानुमान समझाओ' : "Explain today's forecast")
          }
          className="text-[12px] font-semibold px-3.5 py-2 rounded-full bg-gradient-to-r from-sky-400 to-[#3d8fef] text-white shadow-md shadow-sky-400/25 pressable focus-ring"
        >
          {lang === 'hi' ? 'पूर्वानुमान समझाओ' : 'Explain this forecast'}
        </button>
        <button
          type="button"
          onClick={() => onOpenChat?.(lang === 'hi' ? 'मौसम भविष्यवाणी' : 'Weather prediction')}
          className="text-[12px] font-semibold px-3.5 py-2 rounded-full border border-white/15 text-white/90 pressable focus-ring bg-white/5"
        >
          {lang === 'hi' ? 'AI पूछो' : 'Ask AI'}
        </button>
      </div>
    </section>
  )

  const decisionsCard = (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2 text-white/45 px-0.5">
        {lang === 'hi' ? 'आज के फैसले' : "Today's decisions"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {decisions.map((d) => {
          const Icon = d.icon
          const open = whyId === d.id
          return (
            <div key={d.id} className="wx-open-panel wx-decision-tile !p-3.5">
              <button
                type="button"
                onClick={() => onOpenMode?.(d.id)}
                className="w-full text-left pressable focus-ring rounded-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="w-4 h-4 text-sky-300" />
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sevGlass(d.level)}`}>
                    {d.label}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-white mt-2">{d.title}</p>
                <p className="text-[12px] text-white/50 mt-0.5 line-clamp-2">{d.advice}</p>
              </button>
              <button
                type="button"
                onClick={() => setWhyId(open ? null : d.id)}
                className="mt-2 text-[11px] font-semibold text-sky-300 flex items-center gap-0.5 focus-ring rounded"
              >
                {lang === 'hi' ? 'क्यों?' : 'Why?'}
                <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="overflow-hidden">
                  <ul className="mt-2 space-y-1 border-t border-white/8 pt-2">
                    {(d.factors || []).map((f, i) => (
                      <li key={i} className="text-[11px] text-white/60 flex gap-1.5">
                        <span className="text-sky-300">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )

  const consensusCard = !coreOnly ? (
    <ModelConsensusCard lang={lang} city={weather?.city} weather={weather} />
  ) : null

  const worldMapCard = !coreOnly ? (
    <Suspense
      fallback={
        <section className="wx-world-map wx-open-panel" aria-hidden>
          <div className="wx-world-head">
            <h3 className="wx-section-title">
              {lang === 'hi' ? 'लाइव विश्व मौसम' : 'Live world weather'}
            </h3>
            <p className="wx-world-sub">{lang === 'hi' ? 'मानचित्र लोड…' : 'Loading map…'}</p>
          </div>
          <div className="wx-world-stage" style={{ minHeight: 220 }} />
        </section>
      }
    >
      <LiveWorldMap lang={lang} city={weather?.city} weather={weather} compact={!isDesktop} />
    </Suspense>
  ) : null

  const sourcesCard = (
    <section className="wx-open-panel !p-0 overflow-hidden">
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
      {sourcesOpen && (
        <div className="overflow-hidden">
          <ul className="px-4 pb-3 space-y-1.5 text-white/70">
            {(weather.sources || []).map((s, i) => (
              <li key={i} className="text-[12px] leading-snug">
                <span className="font-semibold text-white/90">{s.name}</span>
                <span className="opacity-70"> — {s.role}</span>
              </li>
            ))}
            <li className="text-[11px] opacity-50 pt-1">
              {lang === 'hi' ? 'अंतिम अपडेट' : 'Last updated'}: {minsAgo ?? 0}{' '}
              {lang === 'hi' ? 'मिनट पहले' : 'min ago'}
            </li>
          </ul>
        </div>
      )}
    </section>
  )

  return (
    <div className={`relative h-full overflow-y-auto scroll-thin scroll-dark wx-dash-env ${sky}`}>
      <div className="absolute inset-0 pointer-events-none wx-env-veil" aria-hidden />
      <div className="relative z-[2] page-pad pt-1 pb-0">
        <DataStatusBanner status={dataStatus} lang={lang} onRetry={onRefresh} />
        {coreOnly ? (
          <p className="text-[10px] text-white/40 px-1 pb-1">
            {lang === 'hi' ? 'कम बैंडविड्थ · मुख्य मौसम प्राथमिक' : 'Low bandwidth · core weather first'}
          </p>
        ) : null}
      </div>
      <div
        className={`relative reveal-stagger page-pad pt-2 sm:pt-3 pb-8 wx-dash-flow ${
          isDesktop ? 'pg-desk max-w-[1440px] mx-auto' : 'space-y-4 max-w-lg mx-auto'
        }`}
      >
        {isDesktop ? (
          <>
            {/* Immersive environment: hero spans, intel column on the side */}
            <div className="wx-desk-top">
              <div className="wx-desk-hero">{heroCard}</div>
              <aside className="wx-desk-side">
                {alertCard}
                {weekCard}
                {citiesCard}
              </aside>
            </div>
            <div className="wx-desk-hourly">{hourlyCard}</div>
            {worldMapCard ? <div className="wx-desk-world desktop-span-2">{worldMapCard}</div> : null}
            {consensusCard ? <div className="wx-desk-consensus">{consensusCard}</div> : null}
            <div className="wx-desk-mid">
              <div className="min-w-0">{overviewCard}</div>
              <div className="wx-desk-side-stack min-w-0">
                {aqiCard}
              </div>
            </div>
            <div className="desktop-span-2">{briefCard}</div>
            <div className="desktop-span-2">{decisionsCard}</div>
            <div className="desktop-span-2 max-w-md">{sourcesCard}</div>
            <p className="text-[10px] text-center text-white/25 pb-1">
              WeatherGPT · {dataStatus?.code || (weather.live ? 'live' : 'cached')} ·{' '}
              {dataStatus?.stale ? 'stale ok' : 'fresh'}
            </p>
          </>
        ) : (
          <>
            {/* Mobile hierarchy: hero → alert → hours → 7-day → metrics → models → decisions */}
            {heroCard}
            {alertCard}
            {hourlyCard}
            {weekCard}
            {worldMapCard}
            {overviewCard}
            {aqiCard}
            {consensusCard}
            {citiesCard}
            {briefCard}
            {decisionsCard}
            {sourcesCard}
            <p className="text-[10px] text-center text-white/25 pb-1 pt-1">
              WeatherGPT · {dataStatus?.code || (weather.live ? 'live' : 'cached')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
