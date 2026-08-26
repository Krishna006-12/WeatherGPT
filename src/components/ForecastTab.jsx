import { lazy, Suspense } from 'react'
import { WeatherIcon } from './Icons'
import { tr } from '../data/i18n'
import {
  CloudRain,
  Droplets,
  Gauge,
  Sun,
  Thermometer,
  Wind,
  Sunrise,
  Sunset,
  Activity,
} from 'lucide-react'

const HourlyChart = lazy(() =>
  import('./ForecastCharts').then((m) => ({ default: m.Hourly }))
)
const DailyChart = lazy(() =>
  import('./ForecastCharts').then((m) => ({ default: m.Daily }))
)

export default function ForecastTab({ lang, weather }) {
  if (!weather) {
    return (
      <div className="h-full p-4 space-y-3">
        <div className="h-28 shimmer-dark rounded-2xl" />
        <div className="h-40 shimmer-dark rounded-2xl" />
        <div className="h-48 shimmer-dark rounded-2xl" />
      </div>
    )
  }
  const { current, daily, hourly, astro, city } = weather

  const hourData = hourly.slice(0, 24).map((h) => ({
    label: h.label,
    temp: h.temp,
    pop: h.pop,
  }))

  const dayData = daily.map((d) => ({
    name: lang === 'hi' ? d.weekday_hi : d.weekday,
    max: d.max,
    min: d.min,
    rain: d.rain,
    pop: d.pop,
  }))

  const d0 = daily[0]
  const cityName = lang === 'hi' ? city?.name_hi || city?.name : city?.name

  return (
    <div className="h-full overflow-y-auto scroll-thin scroll-dark page-pad py-4 forecast-desktop">
      <div className="forecast-stack max-w-6xl lg:max-w-none mx-auto">
        <div className="forecast-main space-y-4 min-w-0">
          {/* Current strip */}
          <div className="dash-glass p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">
                  {lang === 'hi' ? 'पूर्वानुमान' : 'Forecast'}
                </p>
                <p className="text-[15px] font-semibold text-white mt-0.5">
                  {cityName || '—'}
                  <span className="text-white/45 font-medium">
                    {' '}
                    · {current.temp}° · {lang === 'hi' ? current.condition_hi : current.condition}
                  </span>
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
                {weather.live ? (
                  <>
                    <span className="live-dot" /> LIVE
                  </>
                ) : (
                  <>
                    <span className="live-dot-off" /> OFFLINE
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                <WeatherIcon name={current.icon} className="w-10 h-10" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[36px] sm:text-[40px] font-semibold text-white leading-none tracking-tight hero-temp">
                  {current.temp}°
                  <span className="text-[16px] text-white/40 font-normal ml-1">C</span>
                </p>
                <p className="text-[13px] text-white/55 mt-1 truncate">
                  {lang === 'hi' ? current.condition_hi : current.condition}
                  {' · '}
                  {tr(lang, 'feelsLike')} {current.feelsLike}°
                </p>
              </div>
              <div className="text-right text-[11px] text-white/55 space-y-1 shrink-0 hidden sm:block">
                <p className="inline-flex items-center gap-1 justify-end">
                  <Sunrise className="w-3 h-3 text-sun-300" />
                  {astro.sunrise}
                </p>
                <p className="inline-flex items-center gap-1 justify-end">
                  <Sunset className="w-3 h-3 text-sky-300" />
                  {astro.sunset}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <Stat
                icon={<Droplets className="w-3.5 h-3.5" />}
                label={tr(lang, 'humidity')}
                value={`${current.humidity}%`}
              />
              <Stat
                icon={<Wind className="w-3.5 h-3.5" />}
                label={tr(lang, 'wind')}
                value={`${current.wind}`}
                unit="km/h"
              />
              <Stat
                icon={<Gauge className="w-3.5 h-3.5" />}
                label={tr(lang, 'pressure')}
                value={`${current.pressure}`}
                unit="hPa"
              />
              <Stat
                icon={<Thermometer className="w-3.5 h-3.5" />}
                label={tr(lang, 'high')}
                value={`${d0?.max}°`}
              />
            </div>

            <div className="mt-4 rounded-xl bg-white/5 border border-white/8 p-3 flex gap-2.5">
              <div className="w-1 rounded-full bg-sky-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">
                  {lang === 'hi' ? 'सरल भाषा में' : 'In plain language'}
                </p>
                <p className="text-[13px] text-white/70 leading-relaxed mt-0.5">
                  {lang === 'hi'
                    ? `आज ${d0?.max}°/${d0?.min}°C, दिन की बारिश संभावना ~${d0?.pop}% (अनुमान ~${d0?.rain} मिमी). यह दिन-प्रतिनिधि आँकड़ा है — सिर्फ एक घंटे का शिखर नहीं। घंटेवार ट्रेंड नीचे देखें।`
                    : `Today ${d0?.max}°/${d0?.min}°C with ~${d0?.pop}% chance of rain (~${d0?.rain} mm expected). Day % is calibrated (not a single hourly spike). Use the hourly trend below.`}
                </p>
              </div>
            </div>
          </div>

          {/* Hourly chart */}
          <div className="dash-glass p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                {lang === 'hi' ? 'अगले 24 घंटे' : 'Next 24 hours'}
              </p>
              <span className="text-[11px] text-white/40 inline-flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {lang === 'hi' ? 'तापमान' : 'Temperature'}
              </span>
            </div>
            <div className="h-44 sm:h-52 -mx-1">
              <Suspense fallback={<div className="h-full shimmer-dark rounded-xl" />}>
                <HourlyChart hourData={hourData} lang={lang} />
              </Suspense>
            </div>

            <div className="flex gap-1.5 overflow-x-auto scroll-thin scroll-dark mt-3 pb-1">
              {hourly.slice(0, 18).map((h) => (
                <div
                  key={h.time}
                  className="shrink-0 w-[58px] flex flex-col items-center gap-0.5 py-2 rounded-2xl bg-white/5 border border-white/8 hour-chip"
                >
                  <span className="text-[9px] text-white/45 font-medium">{h.label}</span>
                  <WeatherIcon name={h.icon} className="w-5 h-5" />
                  <span className="text-[12px] font-semibold text-white">{h.temp}°</span>
                  <span className="text-[9px] text-sky-300">{h.pop}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="forecast-side space-y-4 min-w-0">
          {/* 5 / 7 day */}
          <div className="dash-glass p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-3">
              {lang === 'hi' ? 'दैनिक पूर्वानुमान' : 'Daily forecast'}
            </p>
            <div className="space-y-2.5">
              {daily.map((d) => (
                <div key={d.date} className="flex items-center gap-2">
                  <span className="w-10 text-[12px] font-medium text-white/70">
                    {lang === 'hi' ? d.weekday_hi : d.weekday}
                  </span>
                  <WeatherIcon name={d.icon} className="w-6 h-6" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-300 to-sky-400"
                          style={{ width: `${Math.min(100, d.pop)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-sky-300 font-mono w-8 text-right">{d.pop}%</span>
                    </div>
                  </div>
                  <span className="text-[12px] text-white/40 w-8 text-right">{d.min}°</span>
                  <span className="text-[13px] font-semibold text-white w-8 text-right">{d.max}°</span>
                </div>
              ))}
            </div>

            <div className="h-36 mt-4">
              <Suspense fallback={<div className="h-full shimmer-dark rounded-xl" />}>
                <DailyChart dayData={dayData} lang={lang} />
              </Suspense>
            </div>
          </div>

          {/* Rain + astro card fills side column */}
          <div className="dash-glass p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-3 flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-sky-300" />
              {lang === 'hi' ? 'बारिश व सूर्य' : 'Rain & sun'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="dash-glass-soft p-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wide">
                  {lang === 'hi' ? 'आज बारिश' : 'Rain today'}
                </p>
                <p className="text-[20px] font-semibold text-white mt-1 tabular-nums">{d0?.rain ?? 0}</p>
                <p className="text-[11px] text-white/45">mm · POP {d0?.pop}%</p>
              </div>
              <div className="dash-glass-soft p-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wide">
                  {lang === 'hi' ? 'UV सूचकांक' : 'UV index'}
                </p>
                <p className="text-[20px] font-semibold text-white mt-1 tabular-nums">
                  {d0?.uv ?? '—'}
                </p>
                <p className="text-[11px] text-white/45">{lang === 'hi' ? 'दैनिक अधिकतम' : 'daily max'}</p>
              </div>
              <div className="dash-glass-soft p-3 sm:col-span-1">
                <p className="text-[10px] text-white/40 uppercase tracking-wide flex items-center gap-1">
                  <Sunrise className="w-3 h-3" /> {tr(lang, 'sunrise')}
                </p>
                <p className="text-[18px] font-semibold text-white mt-1">{astro.sunrise}</p>
              </div>
              <div className="dash-glass-soft p-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wide flex items-center gap-1">
                  <Sunset className="w-3 h-3" /> {tr(lang, 'sunset')}
                </p>
                <p className="text-[18px] font-semibold text-white mt-1">{astro.sunset}</p>
              </div>
            </div>
          </div>

          <div className="dash-glass p-3.5 sm:p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-2 flex items-center gap-1">
              <Sun className="w-3 h-3" />
              {lang === 'hi' ? 'डेटा और स्रोत' : 'Data & sources'}
            </p>
            <ul className="space-y-1">
              {(weather.sources || []).map((s) => (
                <li key={s.name} className="text-[12px] text-white/60 flex gap-2 flex-wrap">
                  <span className="font-semibold text-white">{s.name}</span>
                  <span className="text-white/40">— {s.role}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-white/40 mt-2">
              {weather.live ? 'LIVE' : 'offline pack'}
              {weather.liveSource ? ` · ${weather.liveSource}` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value, unit }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-xl p-2.5 text-center">
      <div className="flex justify-center text-sky-300/80 mb-0.5">{icon}</div>
      <p className="text-[13px] font-semibold text-white">
        {value}
        {unit && <span className="text-[9px] text-white/40 font-normal ml-0.5">{unit}</span>}
      </p>
      <p className="text-[9px] text-white/40">{label}</p>
    </div>
  )
}
