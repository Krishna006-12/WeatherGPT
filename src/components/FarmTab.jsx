import { Droplets, Leaf, Sprout, CloudRain, Wind } from 'lucide-react'
import { tr } from '../data/i18n'
import { motion } from 'framer-motion'

export default function FarmTab({ lang, weather }) {
  if (!weather) return null
  const { agri, city, daily } = weather
  const soil = lang === 'hi' ? agri.soil.hi : agri.soil.en
  const advice = lang === 'hi' ? agri.advice_hi : agri.advice_en
  const spray = lang === 'hi' ? agri.sprayWindow.hi : agri.sprayWindow.en

  const soilColor =
    agri.soil.level === 'high'
      ? 'from-sky-400 to-sky-300'
      : agri.soil.level === 'medium'
        ? 'from-sun-400 to-sun-300'
        : 'from-alert-red to-alert-amber'

  const soilPct = agri.soil.level === 'high' ? 82 : agri.soil.level === 'medium' ? 52 : 22

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="h-full overflow-y-auto scroll-thin scroll-dark px-3 sm:px-4 py-4 space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold text-navy-900 flex items-center gap-2">
          <Sprout className="w-4 h-4 text-mint-400" />
          {tr(lang, 'agriTitle')}
        </h2>
        <p className="text-[12px] text-ink-500">
          {tr(lang, 'agriSub')} · {lang === 'hi' ? city.name_hi : city.name}
        </p>
      </div>

      {/* Hero advice card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 text-white p-4 shadow-lg">
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-mint-400/10" />
        <div className="absolute -left-4 -bottom-8 w-24 h-24 rounded-full bg-sun-400/10" />
        <p className="text-[11px] uppercase tracking-wider text-white/60 font-semibold mb-1">
          {tr(lang, 'irrigation')}
        </p>
        <p className="text-[15px] leading-relaxed font-medium relative">{advice}</p>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-mint-300">
          <Leaf className="w-3.5 h-3.5" />
          {spray}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={<Droplets className="w-4 h-4 text-sky-400" />}
          label={tr(lang, 'soilMoisture')}
          value={soil}
        >
          <div className="mt-2 h-2 rounded-full bg-cloud-200 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${soilColor} transition-all`}
              style={{ width: `${soilPct}%` }}
            />
          </div>
        </Metric>
        <Metric
          icon={<CloudRain className="w-4 h-4 text-sky-400" />}
          label={tr(lang, 'recentRain')}
          value={`${agri.recentRain} mm`}
        />
        <Metric
          icon={<CloudRain className="w-4 h-4 text-sun-400" />}
          label={tr(lang, 'forecastRain')}
          value={`${agri.forecastRain} mm`}
        />
        <Metric
          icon={<Wind className="w-4 h-4 text-ink-500" />}
          label={lang === 'hi' ? 'आज हवा' : "Today's wind"}
          value={`${daily[0]?.wind || 0} km/h`}
        />
      </div>

      {/* Crops */}
      <div className="bg-white border border-cloud-200 rounded-2xl p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-2">
          {tr(lang, 'crops')}
        </p>
        <div className="flex flex-wrap gap-2">
          {agri.crops.map((c) => (
            <span
              key={c}
              className="text-[12px] px-2.5 py-1 rounded-full bg-mint-400/15 text-navy-800 font-medium capitalize"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Rain outlook mini */}
      <div className="bg-white border border-cloud-200 rounded-2xl p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-3">
          {lang === 'hi' ? '5-दिन वर्षा' : '5-day rainfall'}
        </p>
        <div className="flex items-end gap-2 h-28">
          {daily.map((d) => {
            const h = Math.min(100, (d.rain / Math.max(...daily.map((x) => x.rain), 1)) * 100)
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-ink-500 font-mono">{d.rain}</span>
                <div className="w-full bg-cloud-100 rounded-t-md relative h-20 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-sky-400 to-sky-300"
                    style={{ height: `${Math.max(6, h)}%` }}
                  />
                </div>
                <span className="text-[10px] text-ink-500">
                  {lang === 'hi' ? d.weekday_hi : d.weekday}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[10px] text-ink-400 text-center pb-2">
        {lang === 'hi'
          ? 'सलाह मॉडल: वर्षा + नमी + हवा थ्रेशोल्ड · IMD श्रेणियों से संरेखित'
          : 'Advisory model: rain + moisture + wind thresholds · aligned to IMD categories'}
      </p>
    </motion.div>
  )
}

function Metric({ icon, label, value, children }) {
  return (
    <div className="bg-white border border-cloud-200 rounded-2xl p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] text-ink-500">{label}</span>
      </div>
      <p className="text-[18px] font-semibold text-navy-900">{value}</p>
      {children}
    </div>
  )
}
