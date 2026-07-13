import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { CycleStat } from "./battery-data";
import type { CycleHighlight } from "./battery-rules";

function MacroTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const stat = payload[0]?.payload as CycleStat | undefined;
  return (
    <div className="rounded-lg border border-white/10 bg-black/90 p-3 font-mono text-[11px] shadow-[0_8px_32px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <p className="text-slate-500">循环 {label}</p>
      <p className="mt-1 text-cyan-300">放电容量 {stat?.dischargeCap.toFixed(3)} Ah</p>
      <p className={stat && stat.retention < 80 ? "text-[#FF3C5C]" : "text-slate-300"}>
        保持率 {stat?.retention.toFixed(1)}%
      </p>
      <p className="text-slate-400">内阻 {stat?.ir.toFixed(2)} mΩ</p>
    </div>
  );
}

export function MacroChart({
  data,
  initialCap,
  highlights = {},
  activeCycle,
}: {
  data: CycleStat[];
  initialCap: number;
  highlights?: Record<number, CycleHighlight>;
  activeCycle?: number;
}) {
  const eolThreshold = initialCap * 0.8;
  const highlightedPoints = data
    .map((row) => ({ row, highlight: highlights[row.cycle] }))
    .filter((item): item is { row: CycleStat; highlight: CycleHighlight } => Boolean(item.highlight));

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: 0 }} className="bg-transparent">
          <defs>
            <linearGradient id="batteryFadeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#FF3C5C" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis
            dataKey="cycle"
            type="number"
            domain={["dataMin", "dataMax"]}
            stroke="rgba(255,255,255,0.1)"
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            label={{
              value: "循环",
              position: "insideBottomRight",
              fill: "#475569",
              fontSize: 9,
              fontFamily: "var(--font-mono)",
            }}
          />
          <YAxis
            domain={[0, Math.ceil(initialCap * 1.2 * 10) / 10]}
            stroke="rgba(255,255,255,0.1)"
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            label={{
              value: "Ah",
              position: "insideTopLeft",
              fill: "#64748b",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />
          <Tooltip content={MacroTooltip} cursor={{ stroke: "rgba(255,60,92,0.25)", strokeWidth: 1 }} />
          <ReferenceLine
            y={eolThreshold}
            stroke="#FF3C5C"
            strokeDasharray="6 4"
            label={{
              value: "寿命终止 80%",
              position: "insideBottomLeft",
              fill: "#FF3C5C",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />
          {activeCycle != null ? (
            <ReferenceLine
              x={activeCycle}
              stroke="#67e8f9"
              strokeDasharray="3 3"
              label={{
                value: `当前 ${activeCycle}`,
                position: "insideTopRight",
                fill: "#67e8f9",
                fontSize: 9,
                fontFamily: "var(--font-mono)",
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="dischargeCap"
            name="放电容量"
            stroke="url(#batteryFadeGradient)"
            strokeWidth={3}
            dot={{ r: 3, fill: "#000000", stroke: "#22d3ee", strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: "#FF3C5C", stroke: "#000000" }}
            isAnimationActive={false}
          />
          {highlightedPoints.map(({ row, highlight }) => (
            <ReferenceDot
              key={`${row.cycle}-${highlight.level}`}
              x={row.cycle}
              y={row.dischargeCap}
              r={highlight.level === "Fail" ? 6 : 5}
              fill={highlight.level === "Fail" ? "#FF3C5C" : "#fbbf24"}
              stroke="#020406"
              strokeWidth={2}
              isFront
              label={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
