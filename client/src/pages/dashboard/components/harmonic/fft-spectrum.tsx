"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HarmonicBar } from "@/pages/dashboard/lib/harmonic-report";

const axisTick = { fill: "#64748b", fontSize: 10 };

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
    <div className="rounded-lg border border-white/[0.08] bg-[#030712]/90 px-3 py-2 shadow-xl backdrop-blur-xl">
      <p className="mb-1 font-mono text-[10px] text-slate-500">{bar.order}</p>
      <p className="text-xs font-medium text-cyan-200">实测 {bar.magnitude}%</p>
      <p className="text-xs font-medium text-slate-400">
        限值 {bar.limit}% · {bar.limitSource === "pdf" ? "PDF原始限值" : "规则推导限值"}
      </p>
      {bar.exceeds ? <p className="text-xs font-semibold text-[#FF3C5C]">超过限值</p> : null}
    </div>
  );
}

export function HarmonicFftSpectrum({ data }: { data: HarmonicBar[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
          <defs>
            <linearGradient id="harmonicCyanGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.34} />
            </linearGradient>
            <linearGradient id="harmonicCrimsonGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF3C5C" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#7f1d1d" stopOpacity={0.38} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis dataKey="order" axisLine={false} tickLine={false} tick={axisTick} interval={0} />
          <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(value) => `${value}%`} />
          <Tooltip content={<SpectrumTooltip />} cursor={{ fill: "rgba(255,255,255,0.035)" }} />
          <Bar dataKey="magnitude" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.order} fill={entry.exceeds ? "url(#harmonicCrimsonGradient)" : "url(#harmonicCyanGradient)"} />
            ))}
          </Bar>
          <Line
            type="stepAfter"
            dataKey="limit"
            stroke="#FF3C5C"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            strokeDasharray="4 4"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
