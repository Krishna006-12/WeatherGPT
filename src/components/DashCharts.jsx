import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

const tipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(12,22,40,0.95)',
  color: '#fff',
  fontSize: 12,
}

/** Sparkline under Live conditions — temp stroke + soft fill (reads even when flat) */
export function SparkTemp({ data }) {
  const rows = Array.isArray(data) ? data : []
  // Pad domain so flat storm lines still show a band
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

/** 24h temp area — click sets hour index via parent */
export function HourlyTempChart({ data, lang, onPick }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
        onClick={(e) => {
          if (e?.activeTooltipIndex != null) onPick?.(e.activeTooltipIndex)
        }}
      >
        <defs>
          <linearGradient id="dashTempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5eb0ff" stopOpacity={0.45} />
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
        <Tooltip contentStyle={tipStyle} />
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
