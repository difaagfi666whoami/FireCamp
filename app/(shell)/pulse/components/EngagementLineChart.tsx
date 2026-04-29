"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
} from "recharts"

interface TimelineItem {
  day: string
  opens: number
  clicks: number
}

interface EngagementLineChartProps {
  data: TimelineItem[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border/80 rounded-xl shadow-lg p-3 text-[13px]">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function EngagementLineChart({ data }: EngagementLineChartProps) {
  return (
    <div className="bg-white border border-border/60 rounded-xl p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="font-bold text-[15px] text-foreground">Engagement Timeline</h3>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          Tren opens dan clicks harian selama durasi campaign
        </p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fontWeight: 600, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 16 }}
            formatter={(value) => <span style={{ color: "#52525b" }}>{value}</span>}
          />
          <Line
            type="monotone"
            dataKey="opens"
            name="Opens"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="clicks"
            name="Clicks"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            strokeDasharray="5 4"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
