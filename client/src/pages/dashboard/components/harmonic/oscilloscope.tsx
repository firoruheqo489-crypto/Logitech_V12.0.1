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

const axisTick = { fill: "#475569", fontSize: 10 };

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
    <div className="rounded-xl border border-white/[0.08] bg-black/80 px-3 py-2 backdrop-blur-xl">
      <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">{label}°</p>
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
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 32, left: 32, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="deg"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            ticks={[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360]}
            tickFormatter={(value) => `${value}`}
            label={{ value: "deg", position: "right", offset: 0, fill: "#475569", fontSize: 10 }}
          />
          <YAxis
            yAxisId="current"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            domain={[-0.4, 0.4]}
            ticks={[-0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4]}
            tickFormatter={(value) => value.toFixed(2)}
            label={{ value: "电流 (A)", angle: -90, position: "insideLeft", fill: "#475569", fontSize: 10, offset: -8 }}
          />
          <YAxis
            yAxisId="voltage"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            domain={[-360, 360]}
            ticks={[-360, -270, -180, -90, 0, 90, 180, 270, 360]}
            tickFormatter={(value) => `${value}`}
            label={{ value: "电压 (V)", angle: 90, position: "insideRight", fill: "#475569", fontSize: 10, offset: 10 }}
          />
          <Tooltip content={<ScopeTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
          <Line
            yAxisId="voltage"
            type="monotone"
            dataKey="voltage"
            name="Voltage"
            stroke="#0a9d1a"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="current"
            type="monotone"
            dataKey="current"
            name="Current"
            stroke="#1d2bd1"
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
            style={{ filter: "drop-shadow(0px 0px 4px rgba(29,43,209,0.45))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
