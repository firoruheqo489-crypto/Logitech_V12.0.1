"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { WavePoint } from "@/lib/power-data"

const axisTick = { fill: "#475569", fontSize: 10 }

function ScopeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/80 px-3 py-2 backdrop-blur-xl">
      <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">{label}°</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export function Oscilloscope({ data }: { data: WavePoint[] }) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="deg"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            interval={29}
            tickFormatter={(v) => `${v}°`}
          />
          <YAxis axisLine={false} tickLine={false} tick={axisTick} domain={[-120, 120]} />
          <Tooltip content={<ScopeTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
          <Line
            type="monotone"
            dataKey="voltage"
            name="Voltage"
            stroke="#475569"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="current"
            name="Current"
            stroke="#00F3FF"
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
            style={{ filter: "drop-shadow(0px 0px 10px rgba(0, 243, 255, 0.8))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
