import { AlertTriangle, Car, CloudRain, Eye, Shield, Wind, Clock, Activity } from 'lucide-react'
import { buildTravelInsight } from '../services/insights.js'
import { tr } from '../data/i18n.js'
import { motion } from 'framer-motion'

export default function TravelTab({ lang, weather, aqi }) {
  if (!weather) return null
  const t = buildTravelInsight(weather, lang)
  const city = lang === 'hi' ? weather.city.name_hi || weather.city.name : weather.city.name

  const riskColor =
    t.riskLevel === 'high'
      ? 'from-alert-red to-alert-amber'
      : t.riskLevel === 'moderate'
        ? 'from-alert-amber to-sun-400'
        : t.riskLevel === 'elevated'
          ? 'from-sun-400 to-sun-300'
          : 'from-mint-400 to-sky-400'

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="h-full overflow-y-auto scroll-thin scroll-dark px-3 sm:px-4 py-4 space-y-3">
      <div>
        <h2 className="text-[16px] font-semibold text-white flex items-center gap-2">
          <Car className="w-4 h-4 text-sky-400" />
          {lang === 'hi' ? 'यात्रा मोड' : 'Travel Mode'}
        </h2>
        <p className="text-[12px] text-white/55">
          {lang === 'hi' ? 'सड़क जोखिम · दृश्यता · सुरक्षित खिड़की' : 'Road risk · visibility · safer window'}
          {' · '}
          {city}
        </p>
      </div>

      {/* Risk hero */}
      <div className={`rounded-2xl bg-gradient-to-br ${riskColor} p-[1px] shadow-lg`}>
        <div className="rounded-2xl bg-navy-900 text-white p-4">
          <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
            {lang === 'hi' ? 'सड़क जोखिम स्कोर' : 'Road-risk score'}
          </p>
          <div className="flex items-end gap-3 mt-1">
            <span className="text-[40px] font-semibold leading-none">{t.riskScore}</span>
            <div className="pb-1">
              <span className="text-[14px] font-semibold text-sun-300">{t.riskLabel}</span>
              <p className="text-[11px] text-white/50">/ 100</p>
            </div>
          </div>
          <p className="text-[13px] text-white/85 mt-3 leading-relaxed">{t.advice}</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Metric
          icon={<Eye className="w-4 h-4 text-sky-400" />}
          label={tr(lang, 'visibility')}
          value={`${t.visibilityKm} km`}
          hint={
            t.visibilityKm < 3
              ? lang === 'hi'
                ? 'कम — सावधानी'
                : 'Low — caution'
              : lang === 'hi'
                ? 'ठीक'
                : 'OK'
          }
        />
        <Metric
          icon={<Wind className="w-4 h-4 text-white/55" />}
          label={tr(lang, 'wind')}
          value={`${t.windKmh} km/h`}
        />
        <Metric
          icon={<CloudRain className="w-4 h-4 text-sky-400" />}
          label={lang === 'hi' ? 'आज बारिश' : "Today's rain"}
          value={`${t.rainToday.pop}%`}
          hint={`~${t.rainToday.mm} mm`}
        />
        <Metric
          icon={<Shield className="w-4 h-4 text-mint-400" />}
          label={lang === 'hi' ? 'सुरक्षित खिड़की' : 'Safer window'}
          value={t.saferWindow ? `${t.saferWindow.start}` : '—'}
          hint={
            t.saferWindow
              ? `→ ${t.saferWindow.end} (${t.saferWindow.hours}h)`
              : lang === 'hi'
                ? 'सीमित'
                : 'Limited'
          }
        />
      </div>

      {/* Safer travel window banner */}
      {t.saferWindow && (
        <div className="bg-mint-400/15 border border-mint-400/30 rounded-2xl p-3.5 flex gap-3">
          <Clock className="w-5 h-5 text-mint-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-white">
              {lang === 'hi' ? 'सुझाई सुरक्षित यात्रा खिड़की' : 'Suggested safer travel window'}
            </p>
            <p className="text-[15px] font-semibold text-white mt-0.5">
              {t.saferWindow.start} – {t.saferWindow.end}
            </p>
            <p className="text-[11px] text-white/55 mt-0.5">
              {lang === 'hi'
                ? `औसत जोखिम ~${t.saferWindow.avgRisk}/100 · ${t.saferWindow.hours} घंटे`
                : `Avg risk ~${t.saferWindow.avgRisk}/100 · ${t.saferWindow.hours} hours`}
            </p>
          </div>
        </div>
      )}

      {/* AQI for commute */}
      {aqi?.aqi != null && (
        <div className="bg-white/6 border border-white/10 rounded-2xl p-3.5 flex gap-3">
          <Activity
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              aqi.aqi > 150 ? 'text-alert-red' : aqi.aqi > 100 ? 'text-sun-400' : 'text-mint-400'
            }`}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
              {lang === 'hi' ? 'यात्रा · AQI' : 'Commute · AQI'}
            </p>
            <p className="text-[15px] font-semibold text-white">
              {aqi.aqi}{' '}
              <span className="text-[12px] font-medium text-white/55">
                {lang === 'hi' ? aqi.band.hi : aqi.band.en} · {aqi.scale}
              </span>
            </p>
            <p className="text-[12px] text-white/60 mt-0.5 leading-relaxed">{aqi.advice(lang)}</p>
            {aqi.aqi > 100 && (
              <p className="text-[11px] text-white/55 mt-1">
                {lang === 'hi'
                  ? 'बाइक/स्कूटर: मास्क; AC कार में recirculate'
                  : 'Bike/scooter: mask; AC car — use recirculate'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      <div className="bg-white/6 border border-white/10 rounded-2xl p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-2 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-alert-amber" />
          {lang === 'hi' ? 'बारिश / हवा / दृश्यता चेतावनी' : 'Rain / wind / visibility warnings'}
        </p>
        <ul className="space-y-2">
          {t.warnings.map((w, i) => (
            <li key={i} className="text-[13px] text-white/70 flex gap-2 leading-snug">
              <span className="text-alert-amber shrink-0">•</span>
              {w}
            </li>
          ))}
        </ul>
      </div>

      {/* Hourly risk strip */}
      <div className="bg-white/6 border border-white/10 rounded-2xl p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-3">
          {lang === 'hi' ? 'अगले घंटे — सड़क जोखिम' : 'Next hours — road risk'}
        </p>
        <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1">
          {t.hourlyRisk.map((h) => {
            const c =
              h.roadScore >= 55 ? 'bg-alert-red/80' : h.roadScore >= 35 ? 'bg-alert-amber/80' : 'bg-mint-400/80'
            return (
              <div
                key={h.time}
                className="shrink-0 w-12 flex flex-col items-center gap-1"
                title={`risk ${h.roadScore}`}
              >
                <span className="text-[9px] text-white/40">{h.label.replace(' ', '')}</span>
                <div className="w-full h-16 bg-white/8 rounded-md flex items-end overflow-hidden">
                  <div className={`w-full ${c} rounded-t-sm`} style={{ height: `${h.roadScore}%` }} />
                </div>
                <span className="text-[10px] font-mono text-white/60">{h.roadScore}</span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[10px] text-white/40 text-center pb-2">
        {lang === 'hi'
          ? 'मॉडल: दृश्यता अनुमान + वर्षा/हवा/WMO कोड · आधिकारिक ट्रैफ़िक फीड नहीं'
          : 'Model: visibility estimate + rain/wind/WMO codes · not an official traffic feed'}
      </p>
    </motion.div>
  )
}

function Metric({ icon, label, value, hint }) {
  return (
    <div className="bg-white/6 border border-white/10 rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] text-white/55">{label}</span>
      </div>
      <p className="text-[17px] font-semibold text-white">{value}</p>
      {hint && <p className="text-[10px] text-white/40 mt-0.5">{hint}</p>}
    </div>
  )
}
