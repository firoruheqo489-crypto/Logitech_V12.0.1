"use client";

import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HarmonicBar } from "@/pages/dashboard/lib/harmonic-report";

const axisTick = { fill: "#475569", fontSize: 10 };

function SpectrumTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: HarmonicBar }[];
}) {
  if (!active || !payload?.length) return null;
  const bar = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/80 px-3 py-2 backdrop-blur-xl">
      <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">{bar.order}</p>
      <p className="text-xs font-medium text-[#00F3FF]">谐波值: {bar.magnitude}%</p>
      <p className="text-xs font-medium text-slate-400">IEC 限值: {bar.limit}%</p>
      {bar.exceeds ? <p className="text-xs font-semibold text-[#FF003C]">超过 IEC 限值</p> : null}
    </div>
  );
}

export function HarmonicFftSpectrum({ data }: { data: HarmonicBar[] }) {
  const limitLine = 5;

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }} barCategoryGap="22%">
          <defs>
            <linearGradient id="harmonicCyanGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00F3FF" stopOpacity={1} />
              <stop offset="100%" stopColor="#0066FF" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="harmonicCrimsonGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF003C" stopOpacity={1} />
              <stop offset="100%" stopColor="#7A0020" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="order" axisLine={false} tickLine={false} tick={axisTick} interval={0} />
          <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(value) => `${value}%`} />
          <Tooltip content={<SpectrumTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="magnitude" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.order} fill={entry.exceeds ? "url(#harmonicCrimsonGradient)" : "url(#harmonicCyanGradient)"} />
            ))}
          </Bar>
          <Line
            type="stepAfter"
            dataKey="limit"
            stroke="#FF003C"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            strokeDasharray="4 4"
            style={{ filter: "drop-shadow(0px 0px 6px rgba(255, 0, 60, 0.6))" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
