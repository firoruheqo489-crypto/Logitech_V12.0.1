import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { TimeSeriesPoint } from "./battery-data";

function formatSec(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function MicroTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as TimeSeriesPoint | undefined;
  return (
    <div className="rounded-lg border border-white/10 bg-black/90 p-3 font-mono text-[11px] shadow-[0_8px_32px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <p className="text-slate-500">T+ {formatSec(Number(label))}</p>
      {point && <p className="mt-1 text-slate-400">{point.step}</p>}
      <p className="mt-1 text-cyan-300">电压 {point?.v.toFixed(3)} V</p>
      <p className="text-slate-300">电流 {point?.i.toFixed(3)} A</p>
    </div>
  );
}

export function MicroChart({ data }: { data: TimeSeriesPoint[] }) {
  return (
    <div className="h-[285px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: 0 }} className="bg-transparent">
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis
            dataKey="sec"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatSec}
            stroke="rgba(255,255,255,0.1)"
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="voltage"
            domain={[5.0, 8.5]}
            allowDataOverflow
            stroke="rgba(255,255,255,0.1)"
            tick={{ fill: "#22d3ee", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            label={{
              value: "V",
              position: "insideTopLeft",
              fill: "#22d3ee",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />
          <YAxis
            yAxisId="current"
            orientation="right"
            domain={[-6, 3]}
            stroke="rgba(255,255,255,0.1)"
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            label={{
              value: "A",
              position: "insideTopRight",
              fill: "#64748b",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />
          <Tooltip content={MicroTooltip} cursor={{ stroke: "rgba(232,184,75,0.25)", strokeWidth: 1 }} />
          <Line
            yAxisId="current"
            type="stepAfter"
            dataKey="i"
            name="电流"
            stroke="#475569"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="voltage"
            type="monotone"
            dataKey="v"
            name="电压"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            style={{ filter: "drop-shadow(0px 0px 8px rgba(34, 211, 238, 0.55))" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
