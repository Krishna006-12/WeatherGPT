import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

const tipShell = {
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(8, 18, 36, 0.94)',
  color: '#fff',
  fontSize: 12,
  padding: '10px 12px',
  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
  backdropFilter: 'blur(12px)',
}

/** Custom tooltip — time, temp, POP, rain mm, wind */
function HourlyTooltip({ active, payload, label, lang }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const hi = lang === 'hi'
  return (
    <div style={tipShell} className="wx-chart-tip" role="tooltip">
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/45 mb-1.5">
        {label || row.label || '—'}
      </p>
      <div className="space-y-1 tabular-nums">
        <p className="text-[13px] font-semibold text-white">
          {hi ? 'तापमान' : 'Temperature'}{' '}
          <span className="text-sky-300">{row.temp != null ? `${row.temp}°` : '—'}</span>
        </p>
        <p className="text-[12px] text-white/75">
          {hi ? 'बारिश संभावना' : 'Precip chance'}{' '}
          <span className="text-sky-200 font-semibold">
            {row.pop != null ? `${row.pop}%` : '—'}
          </span>
        </p>
        <p className="text-[12px] text-white/75">
          {hi ? 'वर्षा' : 'Precip amount'}{' '}
          <span className="font-semibold text-white/90">
            {row.rain != null ? `${row.rain} mm` : '—'}
          </span>
        </p>
        {row.wind != null && (
          <p className="text-[12px] text-white/75">
            {hi ? 'हवा' : 'Wind'}{' '}
            <span className="font-semibold text-white/90">{row.wind} km/h</span>
          </p>
        )}
      </div>
    </div>
  )
}

/** Sparkline under Live conditions — temp stroke + soft fill */
export function SparkTemp({ data }) {
  const rows = Array.isArray(data) ? data : []
  const temps = rows.map((d) => Number(d.temp)).filter((n) => !Number.isNaN(n))
  const minT = temps.length ? Math.min(...temps) : 0
  const maxT = temps.length ? Math.max(...temps) : 1
  const pad = Math.max(1.5, (maxT - minT) * 0.35 || 2)
  const domain = [Math.floor(minT - pad), Math.ceil(maxT + pad)]

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 6, left: 6, bottom: 4 }}>
        <defs>
          <linearGradient id="sparkStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5eb0ff" stopOpacity={1} />
            <stop offset="55%" stopColor="#ff9f0a" stopOpacity={1} />
            <stop offset="100%" stopColor="#ff453a" stopOpacity={1} />
          </linearGradient>
          <linearGradient id="sparkArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5eb0ff" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#5eb0ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={domain} hide width={0} />
        <Tooltip
          content={<HourlyTooltip lang="en" />}
          cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="temp"
          stroke="url(#sparkStroke)"
          strokeWidth={2.4}
          fill="url(#sparkArea)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** 24h interactive temp area — hover/tap rich tooltip; click picks hour */
export function HourlyTempChart({ data, lang, onPick }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 8, left: -18, bottom: 2 }}
        onClick={(e) => {
          if (e?.activeTooltipIndex != null) onPick?.(e.activeTooltipIndex)
        }}
        style={{ cursor: 'pointer' }}
      >
        <defs>
          <linearGradient id="dashTempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5eb0ff" stopOpacity={0.42} />
            <stop offset="100%" stopColor="#5eb0ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.38)' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.38)' }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip
          content={<HourlyTooltip lang={lang} />}
          cursor={{ stroke: 'rgba(142,200,255,0.35)', strokeWidth: 1.5 }}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="temp"
          stroke="#8ec8ff"
          strokeWidth={2.2}
          fill="url(#dashTempFill)"
          name={lang === 'hi' ? 'तापमान' : 'Temp'}
          activeDot={{ r: 5, fill: '#fff', stroke: '#5eb0ff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
