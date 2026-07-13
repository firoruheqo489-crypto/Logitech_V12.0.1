"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WavePoint } from "@/pages/dashboard/lib/harmonic-report";

const axisTick = { fill: "#64748b", fontSize: 10 };

function ScopeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#030712]/90 px-3 py-2 shadow-xl backdrop-blur-xl">
      <p className="mb-1 font-mono text-[10px] text-slate-500">{label} deg</p>
      {payload.map((item) => (
        <p key={item.name} className="text-xs font-medium" style={{ color: item.color }}>
          {item.name === "Voltage" ? "电压" : item.name === "Current" ? "电流" : item.name}:{" "}
          {item.name === "Voltage" ? `${item.value} V` : `${item.value} A`}
        </p>
      ))}
    </div>
  );
}

export function HarmonicOscilloscope({ data }: { data: WavePoint[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 24, left: 12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
          <XAxis
            dataKey="deg"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            ticks={[0, 60, 120, 180, 240, 300, 360]}
            tickFormatter={(value) => `${value}`}
          />
          <YAxis
            yAxisId="current"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            domain={[-0.4, 0.4]}
            ticks={[-0.4, -0.2, 0, 0.2, 0.4]}
            tickFormatter={(value) => value.toFixed(1)}
          />
          <YAxis
            yAxisId="voltage"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            domain={[-360, 360]}
            ticks={[-360, -180, 0, 180, 360]}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip content={<ScopeTooltip />} cursor={{ stroke: "rgba(255,255,255,0.14)" }} />
          <Line
            yAxisId="voltage"
            type="monotone"
            dataKey="voltage"
            name="Voltage"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="current"
            type="monotone"
            dataKey="current"
            name="Current"
            stroke="#67e8f9"
            strokeWidth={2.4}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
