"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface PerEmailData {
  name: string
  opens: number
  clicks: number
  replies: number
}

interface PerformanceBarChartProps {
  data: PerEmailData[]
}

const COLORS = {
  opens: "#3b82f6",
  clicks: "#8b5cf6",
  replies: "#10b981",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border/80 rounded-xl shadow-lg p-3 text-[13px]">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground capitalize">{entry.name}:</span>
          <span className="font-bold text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function PerformanceBarChart({ data }: PerformanceBarChartProps) {
  return (
    <div className="bg-white border border-border/60 rounded-xl p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="font-bold text-[15px] text-foreground">Performa per Email</h3>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          Jumlah opens, clicks, dan replies per email dalam sekuens
        </p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 13, fontWeight: 600, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f4f4f5", radius: 4 }} />
          <Legend
            wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 16 }}
            formatter={(value) => <span style={{ color: "#52525b", textTransform: "capitalize" }}>{value}</span>}
          />
          <Bar dataKey="opens" name="Opens" fill={COLORS.opens} radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="clicks" name="Clicks" fill={COLORS.clicks} radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="replies" name="Replies" fill={COLORS.replies} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
