import { GraduationCap, Sun, Thermometer, Users, CloudLightning, CheckCircle2, Wind } from 'lucide-react'
import { buildSchoolInsight } from '../services/insights'
import { motion } from 'framer-motion'

export default function SchoolTab({ lang, weather, aqi }) {
  if (!weather) return null
  const s = buildSchoolInsight(weather, lang)
  const city = lang === 'hi' ? weather.city.name_hi || weather.city.name : weather.city.name
  const aqiBad = aqi?.aqi != null && aqi.aqi > 100

  const outdoorColor =
    s.outdoorLevel === 'good'
      ? 'text-mint-400'
      : s.outdoorLevel === 'caution'
        ? 'text-sun-400'
        : 'text-alert-red'

  const heatColor =
    s.heatStress === 'extreme' || s.heatStress === 'high'
      ? 'bg-alert-red/10 text-alert-red border-alert-red/30'
      : s.heatStress === 'moderate'
        ? 'bg-sun-400/15 text-sun-400 border-sun-400/30'
        : 'bg-mint-400/15 text-navy-800 border-mint-400/30'

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="h-full overflow-y-auto scroll-thin scroll-dark px-3 sm:px-4 py-4 space-y-3">
      <div>
        <h2 className="text-[16px] font-semibold text-navy-900 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-sun-400" />
          {lang === 'hi' ? 'स्कूल मोड' : 'School Mode'}
        </h2>
        <p className="text-[12px] text-ink-500">
          {lang === 'hi'
            ? 'चरम मौसम · आउटडोर · हीट रिस्क'
            : 'Extreme weather · outdoor · heat risk'}
          {' · '}
          {city}
        </p>
      </div>

      {/* Outdoor + heat */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-navy-900 text-white rounded-2xl p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
            {lang === 'hi' ? 'आउटडोर गतिविधि' : 'Outdoor activity'}
          </p>
          <p className={`text-[22px] font-semibold mt-1 ${outdoorColor}`}>{s.outdoorLabel}</p>
          <p className="text-[11px] text-white/50 mt-1">
            {lang === 'hi' ? 'स्कोर' : 'Score'} {s.outdoorScore}/100
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-mint-400"
              style={{ width: `${s.outdoorScore}%` }}
            />
          </div>
        </div>
        <div className={`rounded-2xl border p-3.5 ${heatColor}`}>
          <p className="text-[10px] uppercase tracking-wider font-semibold opacity-70 flex items-center gap-1">
            <Thermometer className="w-3 h-3" />
            {lang === 'hi' ? 'हीट रिस्क' : 'Heat risk'}
          </p>
          <p className="text-[22px] font-semibold mt-1">{s.heatLabel}</p>
          <p className="text-[11px] opacity-80 mt-1">
            {lang === 'hi' ? 'महसूस' : 'Feels'} {s.heatFeels}° · {lang === 'hi' ? 'उच्च' : 'Max'}{' '}
            {s.maxTemp}°
          </p>
        </div>
      </div>

      {/* Best outdoor slot */}
      {s.bestOutdoor && (
        <div className="bg-sky-100/60 border border-sky-400/20 rounded-2xl p-3.5 flex gap-3">
          <Sun className="w-5 h-5 text-sun-400 shrink-0" />
          <div>
            <p className="text-[12px] font-semibold text-navy-900">
              {lang === 'hi' ? 'सबसे अच्छी आउटडोर खिड़की' : 'Best outdoor window'}
            </p>
            <p className="text-[15px] font-semibold text-navy-900">
              ~{s.bestOutdoor.time}
              <span className="text-[12px] font-normal text-ink-500 ml-2">
                {s.bestOutdoor.temp}°C · rain {s.bestOutdoor.pop}%
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Extreme warnings */}
      <div className="bg-white border border-cloud-200 rounded-2xl p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2 flex items-center gap-1">
          <CloudLightning className="w-3.5 h-3.5 text-alert-red" />
          {lang === 'hi' ? 'चरम मौसम चेतावनी' : 'Extreme weather warning'}
        </p>
        <ul className="space-y-2">
          {s.extreme.map((e, i) => (
            <li key={i} className="text-[13px] text-ink-700 leading-snug flex gap-2">
              <span className="text-alert-red shrink-0">•</span>
              {e}
            </li>
          ))}
        </ul>
      </div>

      {/* Recommendations */}
      <div className="bg-white border border-cloud-200 rounded-2xl p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2 flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-sky-400" />
          {lang === 'hi' ? 'स्कूल सुझाव' : 'School recommendations'}
        </p>
        <ul className="space-y-2">
          {s.recommendations.map((r, i) => (
            <li key={i} className="text-[13px] text-ink-700 flex gap-2 leading-snug">
              <CheckCircle2 className="w-4 h-4 text-mint-400 shrink-0 mt-0.5" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* AQI for PE / outdoor */}
      {aqi?.aqi != null && (
        <div
          className={`rounded-2xl border p-3.5 ${
            aqiBad
              ? 'bg-alert-red/10 border-alert-red/30'
              : 'bg-white border-cloud-200'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1 flex items-center gap-1">
            <Wind className="w-3.5 h-3.5 text-sky-400" />
            {lang === 'hi' ? 'वायु गुणवत्ता (PE)' : 'Air quality (PE)'}
          </p>
          <p className="text-[18px] font-semibold text-navy-900">
            AQI {aqi.aqi}
            <span className="text-[12px] font-medium text-ink-500 ml-2">
              {lang === 'hi' ? aqi.band.hi : aqi.band.en}
            </span>
          </p>
          <p className="text-[12px] text-ink-600 mt-1 leading-relaxed">{aqi.advice(lang)}</p>
          {aqiBad && (
            <p className="text-[12px] font-semibold text-alert-red mt-1.5">
              {lang === 'hi'
                ? 'सुझाव: आउटडोर PT इंडोर शिफ्ट करें / अवधि घटाएँ'
                : 'Tip: shift outdoor PE indoors or shorten duration'}
            </p>
          )}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <Mini label="UV" value={s.uv ?? '—'} />
        <Mini label={lang === 'hi' ? 'नमी' : 'Humidity'} value={`${s.humidity}%`} />
        <Mini label={lang === 'hi' ? 'हवा' : 'Wind'} value={`${s.wind}`} unit="km/h" />
      </div>

      <p className="text-[10px] text-ink-400 text-center pb-2">
        {lang === 'hi'
          ? 'सलाह शैक्षिक है — अंतिम निर्णय प्रधानाचार्य / जिला प्रशासन के अनुसार'
          : 'Advisory only — final call rests with principal / district admin'}
      </p>
    </motion.div>
  )
}

function Mini({ label, value, unit }) {
  return (
    <div className="bg-cloud-50 border border-cloud-200 rounded-xl p-2.5 text-center">
      <p className="text-[10px] text-ink-400">{label}</p>
      <p className="text-[15px] font-semibold text-navy-900">
        {value}
        {unit && <span className="text-[9px] text-ink-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}
