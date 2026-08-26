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

const tipDark = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(12,22,40,0.96)',
  color: '#fff',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
}

export function Hourly({ hourData, lang }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={hourData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="fcTempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5eb0ff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#5eb0ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
          axisLine={false}
          tickLine={false}
          interval={3}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
          axisLine={false}
          tickLine={false}
          width={28}
          unit="°"
        />
        <Tooltip contentStyle={tipDark} />
        <Area
          type="monotone"
          dataKey="temp"
          stroke="#8ec8ff"
          strokeWidth={2.2}
          fill="url(#fcTempFill)"
          name={lang === 'hi' ? 'तापमान' : 'Temp'}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function Daily({ dayData, lang }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={dayData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip contentStyle={tipDark} />
        <Bar
          dataKey="max"
          fill="#5eb0ff"
          radius={[4, 4, 0, 0]}
          name={lang === 'hi' ? 'उच्च' : 'High'}
          isAnimationActive={false}
        />
        <Bar
          dataKey="min"
          fill="rgba(142,200,255,0.35)"
          radius={[4, 4, 0, 0]}
          name={lang === 'hi' ? 'निम्न' : 'Low'}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
