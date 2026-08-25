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
import { WeatherIcon } from './Icons'
import { tr } from '../data/i18n'
import { Droplets, Gauge, Sun, Thermometer, Wind } from 'lucide-react'
import { motion } from 'framer-motion'

export default function ForecastTab({ lang, weather }) {
  if (!weather) {
    return (
      <div className="h-full p-4 space-y-3">
        <div className="h-28 shimmer" />
        <div className="h-40 shimmer" />
        <div className="h-48 shimmer" />
      </div>
    )
  }
  const { current, daily, hourly, astro } = weather

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="h-full overflow-y-auto scroll-thin scroll-dark px-3 sm:px-4 lg:px-5 py-4 space-y-4 max-w-4xl"
    >
      {/* Current strip */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-sky-100/80 flex items-center justify-center">
            <WeatherIcon name={current.icon} className="w-10 h-10" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[32px] font-semibold text-navy-900 leading-none tracking-tight hero-temp">
              {current.temp}°
              <span className="text-[16px] text-ink-400 font-normal ml-1">C</span>
            </p>
            <p className="text-[13px] text-ink-500 mt-0.5 truncate">
              {lang === 'hi' ? current.condition_hi : current.condition}
              {' · '}
              {tr(lang, 'feelsLike')} {current.feelsLike}°
            </p>
          </div>
          <div className="text-right text-[11px] text-ink-500 space-y-0.5 shrink-0">
            <p>
              {tr(lang, 'sunrise')} {astro.sunrise}
            </p>
            <p>
              {tr(lang, 'sunset')} {astro.sunset}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <Stat icon={<Droplets className="w-3.5 h-3.5" />} label={tr(lang, 'humidity')} value={`${current.humidity}%`} />
          <Stat icon={<Wind className="w-3.5 h-3.5" />} label={tr(lang, 'wind')} value={`${current.wind}`} unit="km/h" />
          <Stat icon={<Gauge className="w-3.5 h-3.5" />} label={tr(lang, 'pressure')} value={`${current.pressure}`} unit="hPa" />
          <Stat icon={<Thermometer className="w-3.5 h-3.5" />} label={tr(lang, 'high')} value={`${d0?.max}°`} />
        </div>

        {/* Plain-language outlook */}
        <div className="mt-4 rounded-xl bg-cloud-50 border border-cloud-100 p-3 flex gap-2.5">
          <div className="w-1 rounded-full bg-sky-400 shrink-0" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
              {lang === 'hi' ? 'सरल भाषा में' : 'In plain language'}
            </p>
            <p className="text-[13px] text-ink-700 leading-relaxed mt-0.5">
              {lang === 'hi'
                ? `आज ${d0?.max}°/${d0?.min}°C, बारिश संभावना ${d0?.pop}% (~${d0?.rain} मिमी). अगले घंटों का ट्रेंड नीचे चार्ट में — प्लानिंग के लिए POP और तापमान दोनों देखें।`
                : `Today ${d0?.max}°/${d0?.min}°C with ${d0?.pop}% rain chance (~${d0?.rain} mm). Use the hourly trend below — watch both POP and temperature when planning.`}
            </p>
          </div>
        </div>
      </div>

      {/* Hourly chart */}
      <div className="card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-3">
          {tr(lang, 'hourly')}
        </p>
        <div className="h-40 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourData}>
              <defs>
                <linearGradient id="fcTempFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b9fd4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5b9fd4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                interval={3}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={28}
                unit="°"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                }}
              />
              <Area
                type="monotone"
                dataKey="temp"
                stroke="#5b9fd4"
                strokeWidth={2}
                fill="url(#fcTempFill)"
                name={lang === 'hi' ? 'तापमान' : 'Temp'}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly rain pills */}
        <div className="flex gap-1.5 overflow-x-auto scroll-thin mt-2 pb-1">
          {hourly.slice(0, 12).map((h) => (
            <div
              key={h.time}
              className="shrink-0 w-14 flex flex-col items-center gap-0.5 py-1.5 rounded-xl bg-cloud-50 border border-cloud-100"
            >
              <span className="text-[9px] text-ink-400">{h.label}</span>
              <WeatherIcon name={h.icon} className="w-5 h-5" />
              <span className="text-[12px] font-semibold text-navy-900">{h.temp}°</span>
              <span className="text-[9px] text-sky-400">{h.pop}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5 day */}
      <div className="card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-3">
          {tr(lang, 'daily')}
        </p>
        <div className="space-y-2.5">
          {daily.map((d) => (
            <div key={d.date} className="flex items-center gap-2">
              <span className="w-10 text-[12px] font-medium text-ink-700">
                {lang === 'hi' ? d.weekday_hi : d.weekday}
              </span>
              <WeatherIcon name={d.icon} className="w-6 h-6" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-cloud-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-300 to-sky-400"
                      style={{ width: `${d.pop}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-sky-400 font-mono w-8 text-right">{d.pop}%</span>
                </div>
              </div>
              <span className="text-[12px] text-ink-400 w-8 text-right">{d.min}°</span>
              <span className="text-[13px] font-semibold text-navy-900 w-8 text-right">{d.max}°</span>
            </div>
          ))}
        </div>

        <div className="h-32 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="max" fill="#5b9fd4" radius={[4, 4, 0, 0]} name={tr(lang, 'high')} />
              <Bar dataKey="min" fill="#c5dcf0" radius={[4, 4, 0, 0]} name={tr(lang, 'low')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sources */}
      <div className="card p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2 flex items-center gap-1">
          <Sun className="w-3 h-3" />
          {lang === 'hi' ? 'डेटा और स्रोत' : 'Data & sources'}
        </p>
        <ul className="space-y-1">
          {(weather.sources || []).map((s) => (
            <li key={s.name} className="text-[12px] text-ink-600 flex gap-2 flex-wrap">
              <span className="font-semibold text-navy-900">{s.name}</span>
              <span className="text-ink-400">— {s.role}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-ink-400 mt-2">
          {weather.live ? 'LIVE' : 'offline pack'}
          {weather.liveSource ? ` · ${weather.liveSource}` : ''}
        </p>
      </div>
    </motion.div>
  )
}

function Stat({ icon, label, value, unit }) {
  return (
    <div className="bg-cloud-50 rounded-xl p-2 text-center">
      <div className="flex justify-center text-ink-400 mb-0.5">{icon}</div>
      <p className="text-[13px] font-semibold text-navy-900">
        {value}
        {unit && <span className="text-[9px] text-ink-400 font-normal ml-0.5">{unit}</span>}
      </p>
      <p className="text-[9px] text-ink-400">{label}</p>
    </div>
  )
}
