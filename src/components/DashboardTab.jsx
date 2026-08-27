import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
import { WeatherIcon, SeverityDot } from './Icons'
import {
  buildTravelInsight,
  buildSchoolInsight,
  estimateVisibility,
} from '../services/insights'
import { buildStructuredBrief, buildDailyBriefing, shareBriefing } from '../services/briefing'
import { toDisplayTemp, tempUnitLabel } from '../services/storage'
import { CITIES, getCity } from '../data/cities'

/** Recharts is heavy (~110KB gzip) — load only when dashboard paints charts */
const SparkTemp = lazy(() =>
  import('./DashCharts').then((m) => ({ default: m.SparkTemp }))
)
const HourlyTempChart = lazy(() =>
  import('./DashCharts').then((m) => ({ default: m.HourlyTempChart }))
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

/** Base sky wash — clouds are a separate layer (no blur-orb) */
function heroSkyStyle(weather) {
  const icon = weather?.current?.icon || ''
  const night = weather?.current?.isDay === false
  if (night) {
    return {
      background: `
        radial-gradient(ellipse 28% 22% at 78% 16%, rgba(200,210,255,0.25), transparent 55%),
        linear-gradient(165deg, #0a1020 0%, #121c30 40%, #080e18 100%)`,
    }
  }
  if (icon.includes('lightning') || icon.includes('storm')) {
    return {
      background: `
        linear-gradient(165deg, #3a4558 0%, #252d3c 32%, #161c28 68%, #0c1018 100%)`,
    }
  }
  if (icon.includes('rain') || icon.includes('drizzle')) {
    return {
      background: `
        linear-gradient(165deg, #3a4e66 0%, #243848 45%, #121e2c 100%)`,
    }
  }
  if (icon === 'sun') {
    return {
      background: `
        radial-gradient(ellipse 42% 38% at 78% 16%, rgba(255,220,130,0.55), transparent 58%),
        linear-gradient(165deg, #5aa8f0 0%, #3a78d0 45%, #1a4a8c 100%)`,
    }
  }
  if (icon === 'cloud' || icon.includes('fog')) {
    return {
      background: `linear-gradient(165deg, #5a6a7c 0%, #354556 48%, #1a2532 100%)`,
    }
  }
  return {
    background: `
      radial-gradient(ellipse 50% 38% at 72% 14%, rgba(255,255,255,0.22), transparent 55%),
      linear-gradient(165deg, #5aa0e8 0%, #3a72c8 48%, #1e4a8c 100%)`,
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

const ease = [0.22, 1, 0.36, 1]

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
  const name = lang === 'hi' ? dirsHi[idx] : dirsEn[idx]
  const fullEn = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest']
  const fullHi = ['उत्तर', 'उत्तर-पूर्व', 'पूर्व', 'दक्षिण-पूर्व', 'दक्षिण', 'दक्षिण-पश्चिम', 'पश्चिम', 'उत्तर-पश्चिम']
  return { short: name, full: lang === 'hi' ? fullHi[idx] : fullEn[idx], deg: Math.round(d) }
}

function conditionTitle(c, lang) {
  const raw = lang === 'hi' ? c.condition_hi || c.condition : c.condition
  const s = String(raw || '').replace(/\s+/g, ' ').trim()
  // Avoid "with thunderstorm with hail" — primary short + clean secondary (sentence case)
  if (/thunder|storm|hail|तूफान|गर्ज|ओला/i.test(s)) {
    return {
      primary: lang === 'hi' ? 'तूफ़ानी' : 'Stormy',
      secondary: s, // e.g. "Thunderstorm with hail" — no extra "with"
    }
  }
  if (/rain|drizzle|बारिश|बौछ/i.test(s)) {
    return {
      primary: lang === 'hi' ? 'बारिश' : 'Rainy',
      secondary: s,
    }
  }
  if (/clear|साफ|sunny/i.test(s)) {
    return {
      primary: lang === 'hi' ? 'साफ़' : 'Clear',
      secondary: lang === 'hi' ? 'खुला आसमान' : 'open skies',
    }
  }
  return {
    primary: s || (lang === 'hi' ? 'मौसम' : 'Weather'),
    secondary: lang === 'hi' ? `महसूस ${c.feelsLike}°` : `Feels like ${c.feelsLike}°`,
  }
}

function RainAmbient({ active }) {
  const drops = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: `${(i * 23 + 9) % 100}%`,
        delay: `${(i % 6) * 0.28}s`,
        dur: `${1.1 + (i % 4) * 0.2}s`,
      })),
    []
  )
  if (!active) return null
  return (
    <div className="ambient-rain" aria-hidden>
      {drops.map((d) => (
        <span key={d.id} style={{ left: d.left, animationDelay: d.delay, animationDuration: d.dur }} />
      ))}
    </div>
  )
}

/** Layered CSS clouds behind hero temp — condition-aware, no blur-orb */
function HeroClouds({ mode }) {
  // mode: storm | rain | clear | night | cloudy
  const cls =
    mode === 'storm'
      ? 'is-storm'
      : mode === 'rain'
        ? 'is-rain'
        : mode === 'clear'
          ? 'is-clear'
          : mode === 'night'
            ? 'is-night'
            : 'is-cloudy'
  return (
    <div className={`hero-clouds ${cls}`} aria-hidden>
      <div className="mist mist-a" />
      <div className="mist mist-b" />
      {mode === 'clear' && <div className="sun-glow" />}
      {mode === 'storm' && <div className="flash" />}
      <span className="cloud c1" />
      <span className="cloud c2" />
      <span className="cloud c3" />
      <span className="cloud c4" />
      <span className="cloud c5" />
    </div>
  )
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
          <div className="skel skel-card" />
          <div className="flex gap-2">
            <div className="skel skel-row flex-1" />
            <div className="skel skel-row flex-1" />
            <div className="skel skel-row flex-1" />
          </div>
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
  const city = lang === 'hi' ? weather.city.name_hi || weather.city.name : weather.city.name
  // India: "Kanpur, Uttar Pradesh" — foreign: "Tokyo, Japan" (no ", IN" noise)
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
  // Hero temp: always live current on "Now" (idx 0) so brief/hero never disagree
  const displayTemp = hourIdx > 0 && activeHour ? t(activeHour.temp) : t(c.temp)
  const displayPop = hourIdx > 0 ? activeHour?.pop ?? d0?.pop ?? 0 : d0?.pop ?? activeHour?.pop ?? 0
  const displayIcon = hourIdx > 0 ? activeHour?.icon || c.icon : c.icon
  const chartData = hours.slice(0, 18).map((h, i) => ({
    label: shortHourLabel(h, i, lang),
    temp: i === 0 ? t(c.temp) : t(h.temp),
    pop: h.pop ?? 0,
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

  const dateLine = (() => {
    try {
      // Prefer pack clock (current.time / fetchedAt) so midnight IST isn't "yesterday"
      const raw =
        weather.current?.time ||
        weather.hourly?.[0]?.time ||
        weather.fetchedAt ||
        Date.now()
      const d = raw instanceof Date ? raw : new Date(raw)
      const tz = weather.city?.tz || weather.timezone || 'Asia/Kolkata'
      return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: tz,
      })
    } catch {
      try {
        return new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Asia/Kolkata',
        })
      } catch {
        return ''
      }
    }
  })()

  const riskBadge = (() => {
    if (topAlert?.severity === 'red') return { label: lang === 'hi' ? 'गंभीर' : 'Dangerous', cls: 'sev-severe' }
    if (topAlert?.severity === 'amber') return { label: lang === 'hi' ? 'उच्च' : 'Elevated', cls: 'sev-high' }
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
      why: travel.warnings,
      advice: travel.advice,
      factors: [
        lang === 'hi' ? `दृश्यता ~${travel.visibilityKm} किमी` : `Visibility ~${travel.visibilityKm} km`,
        lang === 'hi' ? `हवा ${travel.windKmh} किमी/घं` : `Wind ${travel.windKmh} km/h`,
        lang === 'hi'
          ? `बारिश ${travel.rainToday.pop}% / ${travel.rainToday.mm} मिमी`
          : `Rain ${travel.rainToday.pop}% / ${travel.rainToday.mm} mm`,
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
        lang === 'hi' ? `आउटडोर ${school.outdoorScore}/100` : `Outdoor ${school.outdoorScore}/100`,
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
      ],
    },
  ]

  const recentRaw = (recentCities || []).filter((r) => r.id !== weather.city?.id)
  const SUGGEST_IDS = ['delhi', 'lucknow', 'mumbai', 'varanasi', 'patna']
  const suggestions = SUGGEST_IDS.map((id) => getCity(id) || CITIES[id])
    .filter((x) => x && x.id !== weather.city?.id)
    .slice(0, 3)
  const recent = recentRaw.slice(0, 4)
  const showSuggestions = recent.length === 0
  const sideCities = showSuggestions ? suggestions : recent

  const cond = conditionTitle(c, lang)
  const windMeta = windCompass(c.windDir ?? 0, lang)
  const hourTray = isDesktop ? hours.slice(0, 8) : hours.slice(0, 12)
  const dayTray = (weather.daily || []).slice(0, 7)
  const dayLabel =
    dayTray.length >= 7
      ? lang === 'hi'
        ? '7 दिन'
        : '7-day'
      : lang === 'hi'
        ? `${dayTray.length || 5} दिन`
        : `${dayTray.length || 5}-day`

  /* —— HERO (reference: big temp over sky stage) —— */
  const heroBlock = (
    <section className="dash-hero">
      <div className="dash-hero-bg" style={heroSkyStyle(weather)} />
      <HeroClouds mode={cloudMode} />
      {sunny && <div className="ambient-rays" aria-hidden />}
      {sunny && (
        <div className="hero-sparkles" aria-hidden>
          <i /><i /><i /><i /><i /><i />
        </div>
      )}
      <RainAmbient active={rainy} />

      <div className="relative z-[3] p-5 sm:p-6 lg:p-7 flex flex-col h-full min-h-[260px] lg:min-h-[300px]">
        {/* Location row — reference top of hero */}
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onOpenCities}
            className="text-left pressable focus-ring rounded-xl -ml-0.5 px-0.5"
          >
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white tracking-tight">
              <MapPin className="w-3.5 h-3.5 text-white/70 shrink-0" />
              <span className="truncate">
                {city}
                {stateLine ? (
                  <span className="text-white/45 font-medium">{`, ${stateLine}`}</span>
                ) : null}
              </span>
            </p>
            <p className="text-[12px] text-white/50 mt-1 pl-5">{dateLine}</p>
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/65 shrink-0 bg-black/20 border border-white/10 rounded-full px-2.5 py-1 backdrop-blur-md">
            {weather.live ? (
              <>
                <span className="live-dot" /> LIVE
              </>
            ) : (
              <>
                <span className="live-dot-off" /> OFFLINE
              </>
            )}
            <span className="text-white/40">· {minsAgo}m</span>
          </span>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mt-5 lg:mt-6">
          <div className="min-w-0">
            <div className="flex items-end gap-1 hero-temp">
              <span
                key={displayTemp + '-' + hourIdx}
                className="type-hero-temp temp-fade"
                style={{
                  fontSize: isDesktop ? '96px' : 'clamp(64px, 18vw, 84px)',
                }}
              >
                {displayTemp}
              </span>
              <span className="text-[26px] sm:text-[28px] font-medium text-white/50 mb-2 sm:mb-3">{unit}</span>
            </div>
            <p className="type-primary text-[24px] sm:text-[28px] mt-1.5 leading-tight">
              {cond.primary}
            </p>
            <p className="type-secondary mt-0.5">{cond.secondary}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3.5">
              <span className="hl-pill">H {t(d0.max)}°</span>
              <span className="hl-pill">L {t(d0.min)}°</span>
              {hourIdx > 0 && (
                <span className="hl-pill text-sky-200/90">
                  {shortHourLabel(activeHour, hourIdx, lang)} · {displayPop}%
                </span>
              )}
            </div>
          </div>

          <div className="hero-tip px-4 py-3.5 max-w-[220px] text-[12px] text-white/75 leading-relaxed hidden md:block shrink-0">
            {lang === 'hi'
              ? 'लाइव डेटा और स्रोत-युक्त जवाब — चैट में किसी भी शहर का नाम लिखें।'
              : 'With real-time data we provide reliable forecasts for any location — name a city in chat.'}
          </div>
        </div>
      </div>
    </section>
  )

  /* —— HOURLY tray (reference: clean slots, no heavy chart on desktop row) —— */
  const hourlyBlock = (
    <section className="dash-glass p-3.5 sm:p-4">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <p className="text-[11px] font-semibold tracking-wide text-white/45">
          {lang === 'hi' ? 'अगले घंटे' : 'Hourly'}
        </p>
        <button
          type="button"
          onClick={onOpenForecast}
          className="text-[12px] font-semibold text-white/55 hover:text-white focus-ring rounded-lg px-2 py-1 transition"
        >
          {lang === 'hi' ? 'पूरा →' : 'Full →'}
        </button>
      </div>

      <div
        className={`${
          isDesktop ? 'hour-tray-desktop' : 'tray-scroll scroll-thin scroll-dark'
        }`}
      >
        {hourTray.map((h, i) => {
          const active = i === hourIdx
          return (
            <button
              key={h.time + i}
              type="button"
              onClick={() => setHourIdx(i)}
              className={`shrink-0 ${isDesktop ? '' : 'w-[72px]'} py-3 px-1.5 flex flex-col items-center gap-1.5 focus-ring ${
                active ? 'hour-chip-active' : 'hour-chip'
              }`}
            >
              <span
                className={`text-[11px] font-semibold ${active ? 'text-white' : 'text-white/45'}`}
              >
                {shortHourLabel(h, i, lang)}
              </span>
              <WeatherIcon name={h.icon} className="w-7 h-7 drop-shadow-sm" />
              {h.pop >= 40 && (
                <span className="text-[10px] font-semibold text-sky-300 leading-none">{h.pop}%</span>
              )}
              <span className="text-[15px] font-semibold tabular-nums text-white leading-none mt-0.5">
                {t(h.temp)}°
              </span>
            </button>
          )
        })}
      </div>

      {/* Compact spark only on mobile under hourly */}
      {!isDesktop && (
        <div className="mt-3 h-[72px] w-full">
          <Suspense fallback={<div className="h-full w-full shimmer-dark rounded-xl" />}>
            <HourlyTempChart data={chartData} lang={lang} onPick={setHourIdx} />
          </Suspense>
        </div>
      )}
    </section>
  )

  /* —— 7-day tray —— */
  const weekBlock = (
    <section className="dash-glass p-3.5 sm:p-4">
      <p className="text-[11px] font-semibold tracking-wide text-white/45 mb-2.5 px-0.5">
        {dayLabel}
      </p>
      <div className={isDesktop ? 'week-grid-7' : 'tray-scroll scroll-thin scroll-dark'}>
        {dayTray.map((d, i) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setDayIdx(i)}
            className={`shrink-0 ${isDesktop ? '' : 'w-[78px]'} py-3 px-1.5 flex flex-col items-center gap-1 focus-ring ${
              i === dayIdx ? 'day-chip-active' : 'day-chip'
            }`}
          >
            <span className="text-[12px] font-semibold text-white/75">
              {weekdayLabel(d, i, lang)}
            </span>
            <WeatherIcon name={d.icon} className="w-8 h-8" />
            {d.pop >= 40 && (
              <span className="text-[10px] text-sky-300 font-semibold">{d.pop}%</span>
            )}
            <span className="text-[14px] font-semibold text-white tabular-nums leading-none mt-0.5">
              {t(d.max)}°
            </span>
            <span className="text-[11px] text-white/40 font-medium tabular-nums">{t(d.min)}°</span>
          </button>
        ))}
      </div>
    </section>
  )

  /* —— Live conditions (reference right rail) —— */
  const liveRail = (
    <section className="dash-glass p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[13px] font-semibold text-white/90">
          {lang === 'hi' ? 'लाइव स्थितियाँ' : 'Live Conditions'}
        </p>
        <button
          type="button"
          onClick={onOpenForecast}
          className="text-white/35 hover:text-white/70 focus-ring rounded p-0.5"
          aria-label="Open forecast"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-medium text-mint-300/90 tabular-nums">
          {d0?.pop != null ? `↑ ${d0.pop}%` : '—'}{' '}
          <span className="text-white/35 font-normal">
            {lang === 'hi' ? 'बारिश संभावना' : 'chance of rain'}
          </span>
        </span>
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${riskBadge.cls}`}>
          {riskBadge.label}
        </span>
      </div>

      <p className="text-[10px] text-white/35 mb-1.5">
        {lang === 'hi' ? 'अगले 12 घंटे · तापमान' : 'Next 12h · temperature'}
      </p>
      <div className="h-[88px] w-full mb-3.5 rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
        <Suspense fallback={<div className="h-full w-full shimmer-dark rounded-xl" />}>
          <SparkTemp data={chartData.slice(0, 12)} />
        </Suspense>
      </div>

      <div className="grid grid-cols-3 gap-2 metric-quiet">
        <div className="text-center px-1">
          <Droplets className="w-3.5 h-3.5 mx-auto text-white/35 mb-1" />
          <p className="metric-val">{c.humidity}%</p>
          <p className="metric-lbl">{lang === 'hi' ? 'नमी' : 'Humidity'}</p>
        </div>
        <div className="text-center px-1 border-x border-white/8">
          <span className="inline-flex justify-center mb-1">
            <WeatherIcon name="wind" className="w-4 h-4 opacity-80" />
          </span>
          <p className="metric-val">{c.wind}</p>
          <p className="metric-lbl">km/h</p>
        </div>
        <div className="text-center px-1">
          <Gauge className="w-3.5 h-3.5 mx-auto text-white/35 mb-1" />
          <p className="metric-val">{c.pressure}</p>
          <p className="metric-lbl">hPa</p>
        </div>
      </div>
    </section>
  )

  /* —— Recent / suggested cities (never empty rail) —— */
  const recentBlock = (
    <section className="dash-glass p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-semibold text-white/90">
          {showSuggestions
            ? lang === 'hi'
              ? 'सुझाए शहर'
              : 'Suggested cities'
            : lang === 'hi'
              ? 'हाल के शहर'
              : 'Recently Searched'}
        </p>
        <button
          type="button"
          onClick={onOpenCities}
          className="text-[11px] font-semibold text-white/45 hover:text-white focus-ring rounded"
        >
          {lang === 'hi' ? 'सभी →' : 'See All →'}
        </button>
      </div>
      {showSuggestions && (
        <p className="text-[11px] text-white/40 mb-2 -mt-1">
          {lang === 'hi' ? 'टैप कर लाइव मौसम लोड करें' : 'Tap to load live weather'}
        </p>
      )}
      <div className="space-y-1">
        {(sideCities.length ? sideCities : suggestions).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelectCity?.(r)}
            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-white/[0.05] transition text-left focus-ring"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
              <WeatherIcon name="cloud" className="w-7 h-7 opacity-90" />
            </div>
            <div className="min-w-0 flex-1">
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
      </div>
    </section>
  )

  /* —— Wind (CSS visual from live wind dir — not a map API) —— */
  const windBlock = (
    <section className="dash-glass p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <p className="text-[13px] font-semibold text-white/90">
          {lang === 'hi' ? 'हवा' : 'Wind'}
        </p>
        <p className="text-[10px] text-white/35">
          {lang === 'hi' ? 'लाइव दिशा · Open-Meteo' : 'Live dir · Open-Meteo'}
        </p>
      </div>
      <div className="flex gap-3 items-stretch">
        <div className="shrink-0 flex flex-col justify-center pr-1 min-w-[88px]">
          <p className="text-[22px] font-semibold text-white tabular-nums leading-none">
            {c.wind}
            <span className="text-[12px] font-medium text-white/40 ml-1">km/h</span>
          </p>
          <p className="text-[12px] text-white/50 mt-1.5">{windMeta.full}</p>
          <p className="text-[11px] text-white/35 mt-0.5 tabular-nums">{windMeta.deg}°</p>
        </div>
        <div className="wind-map flex-1 min-w-0">
          <div className="swirl" aria-hidden />
          <div className="swirl-2" aria-hidden />
          <div
            className="pin"
            style={{ transform: `translate(-50%, -50%) rotate(${windMeta.deg}deg)` }}
            title={windMeta.full}
          >
            <MapPin className="w-4 h-4 text-white" style={{ transform: `rotate(-${windMeta.deg}deg)` }} />
          </div>
        </div>
      </div>
      <div className="flex justify-between mt-3 text-[11px] text-white/40">
        <span className="inline-flex items-center gap-1">
          <Eye className="w-3 h-3" /> {vis} km
        </span>
        <span className="inline-flex items-center gap-1">
          <CloudRain className="w-3 h-3" /> {d0.pop}%
        </span>
      </div>
    </section>
  )

  /* —— AI Brief glass —— */
  const briefBlock = (
    <section className={`dash-glass ${isDesktop ? 'p-5 sm:p-6' : 'p-4'}`}>
      <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400/90 to-sky-300/80 text-navy-900 flex items-center justify-center shadow-md shadow-sky-400/20 shrink-0">
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

      <div className={isDesktop ? 'grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5' : 'space-y-3'}>
        <BriefBlock
          kicker={lang === 'hi' ? 'क्या हो रहा है' : "What's happening"}
          body={brief?.what}
          tone="fact"
          roomy={isDesktop}
        />
        <BriefBlock
          kicker={lang === 'hi' ? 'क्या उम्मीद करें' : 'What to expect'}
          body={brief?.expect}
          tone="forecast"
          roomy={isDesktop}
        />
        <BriefBlock
          kicker={lang === 'hi' ? 'आपको क्या करना चाहिए' : 'What you should do'}
          body={brief?.recommendation}
          tone="action"
          roomy={isDesktop}
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/8">
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
          className="text-[12px] font-semibold px-3.5 py-2 rounded-full border border-white/15 text-white/90 pressable focus-ring bg-white/5"
        >
          {lang === 'hi' ? 'AI पूछो' : 'Ask AI'}
        </button>
      </div>
    </section>
  )

  const alertBlock = topAlert ? (
    <button type="button" onClick={onOpenAlerts} className="dash-glass p-4 text-left w-full pressable focus-ring">
      <div className="flex items-start gap-3">
        <SeverityDot severity={topAlert.severity} className="mt-1.5 scale-125" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              className={`inline-flex items-center text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full shrink-0 ${alertMeta.cls}`}
            >
              {alertMeta.label}
            </span>
            <span className="inline-flex items-center text-[10px] font-semibold text-white/45 uppercase tracking-wider shrink-0">
              {topAlert.source || 'MODEL'}
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
    <div className="dash-glass px-4 py-3 flex items-center gap-2 text-[13px] text-white/80">
      <span className="live-dot" />
      {lang === 'hi' ? 'कोई गंभीर अलर्ट नहीं' : 'No severe alerts for this area'}
    </div>
  )

  const decisionsBlock = (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2 text-white/45">
        {lang === 'hi' ? 'आज के फैसले' : "Today's decisions"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {decisions.map((d) => {
          const Icon = d.icon
          const open = whyId === d.id
          return (
            <div key={d.id} className="dash-glass p-3.5">
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
              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease }}
                    className="overflow-hidden"
                  >
                    <ul className="mt-2 space-y-1 border-t border-white/8 pt-2">
                      {d.factors.map((f, i) => (
                        <li key={i} className="text-[11px] text-white/60 flex gap-1.5">
                          <span className="text-sky-300">•</span>
                          {f}
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

  const aqiBlock =
    aqi?.aqi != null ? (
      <section className="dash-glass p-4">
        <div className="flex items-center gap-3.5">
          <div
            className="aqi-ring w-14 h-14 rounded-full p-[3px] shrink-0"
            style={{ ['--p']: aqiPct }}
            aria-label={`AQI ${aqi.aqi}`}
          >
            <div className="w-full h-full rounded-full bg-[#0B1F3A]/95 flex flex-col items-center justify-center border border-white/12">
              <span className="text-[15px] font-bold text-white leading-none tabular-nums">
                {aqi.aqi}
              </span>
              <span className="text-[8px] text-white/45 font-semibold tracking-wide mt-0.5">AQI</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
              {lang === 'hi' ? 'वायु गुणवत्ता' : 'Air quality'}
            </p>
            <p className="text-[14px] font-semibold text-white leading-snug">
              <span>{lang === 'hi' ? aqi.band.hi : aqi.band.en}</span>
              {aqi.scale ? (
                <span className="text-[11px] font-medium text-white/40 ml-2">{aqi.scale}</span>
              ) : null}
            </p>
            <p className="text-[12px] text-white/50 mt-1 leading-snug">{aqi.advice(lang)}</p>
          </div>
        </div>
      </section>
    ) : null

  const sourcesBlock = (
    <section className="dash-glass overflow-hidden">
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
            <ul className="px-4 pb-3 space-y-1.5 text-white/70">
              {(weather.sources || []).map((s, i) => (
                <li key={i} className="text-[12px] leading-snug">
                  <span className="font-semibold text-white/90">{s.name}</span>
                  <span className="opacity-70"> — {s.role}</span>
                </li>
              ))}
              <li className="text-[11px] opacity-50 pt-1">
                {lang === 'hi' ? 'अंतिम अपडेट' : 'Last updated'}: {minsAgo}{' '}
                {lang === 'hi' ? 'मिनट पहले' : 'min ago'}
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )

  return (
    <div className={`relative h-full overflow-y-auto scroll-thin scroll-dark ${sky}`}>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.04] via-transparent to-black/35" />
      <div
        className={`relative reveal-stagger page-pad pt-2 sm:pt-3 pb-6 ${
          isDesktop ? 'max-w-[1400px] mx-auto space-y-4' : 'space-y-3.5 max-w-lg mx-auto'
        }`}
      >
        {isDesktop ? (
          <>
            <div className="desktop-grid">
              <div className="stack-cards min-w-0">
                {heroBlock}
                {hourlyBlock}
                {weekBlock}
              </div>
              <div className="stack-cards min-w-0">
                {liveRail}
                {recentBlock}
                {windBlock}
                {alertBlock}
                {aqiBlock}
              </div>
            </div>
            <div className="desktop-span-2">{briefBlock}</div>
            <div className="desktop-span-2">{decisionsBlock}</div>
            <div className="desktop-span-2 max-w-lg">{sourcesBlock}</div>
            <p className="text-[10px] text-center text-white/25 pb-1">
              WeatherGPT · {weather.live ? 'LIVE' : 'offline'} · grounded met data
            </p>
          </>
        ) : (
          <>
            {heroBlock}
            {liveRail}
            {hourlyBlock}
            {weekBlock}
            {windBlock}
            {briefBlock}
            {alertBlock}
            {decisionsBlock}
            {recentBlock}
            {aqiBlock}
            {sourcesBlock}
            <p className="text-[10px] text-center text-white/25 pb-1">
              WeatherGPT · {weather.live ? 'LIVE' : 'offline'} ·{' '}
              {lang === 'hi' ? 'निर्णय समर्थन' : 'decision support'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function BriefBlock({ kicker, body, tone, roomy = false }) {
  const bar = tone === 'action' ? 'bg-mint-400' : tone === 'forecast' ? 'bg-sky-400' : 'bg-white/50'
  return (
    <div className={`flex gap-2.5 ${roomy ? 'mb-0' : 'mb-0'}`}>
      <div className={`w-1 rounded-full shrink-0 ${roomy ? 'min-h-[4rem]' : 'min-h-[3rem]'} ${bar}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">{kicker}</p>
        <p className={`text-white/80 leading-relaxed mt-1 ${roomy ? 'text-[14px]' : 'text-[13px]'}`}>
          {stripMd(body)}
        </p>
      </div>
    </div>
  )
}
