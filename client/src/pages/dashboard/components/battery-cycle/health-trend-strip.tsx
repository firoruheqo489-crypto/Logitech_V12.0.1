import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CycleStat } from "./battery-data";

function minMax(values: number[]) {
  if (values.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { min: min - 1, max: max + 1 };
  const padding = (max - min) * 0.18;
  return { min: min - padding, max: max + padding };
}

function TrendMiniChart({
  title,
  unit,
  color,
  data,
  dataKey,
}: {
  title: string;
  unit: string;
  color: string;
  data: CycleStat[];
  dataKey: "ir" | "medianV";
}) {
  const range = minMax(data.map((row) => row[dataKey]));

  return (
    <div className="min-w-0 rounded-md border border-white/[0.05] bg-black/25 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px]">
        <span className="truncate tracking-[0.16em] text-slate-500">{title}</span>
        <span className="text-slate-600">{unit}</span>
      </div>
      <div className="h-[58px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="cycle" hide />
            <YAxis domain={[range.min, range.max]} hide />
            <Tooltip
              cursor={{ stroke: "rgba(148,163,184,0.25)", strokeWidth: 1 }}
              contentStyle={{
                background: "rgba(2,6,23,0.92)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "#cbd5e1",
                fontSize: 11,
              }}
              formatter={(value) => [`${Number(value).toFixed(dataKey === "ir" ? 2 : 3)} ${unit}`, title]}
              labelFormatter={(label) => `循环 ${label}`}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function HealthTrendStrip({ data }: { data: CycleStat[] }) {
  return (
    <div className="grid h-[92px] grid-cols-2 gap-3">
      <TrendMiniChart title="// DCIR 趋势" unit="mΩ" color="#67e8f9" data={data} dataKey="ir" />
      <TrendMiniChart title="// 中值电压趋势" unit="V" color="#E8B84B" data={data} dataKey="medianV" />
    </div>
  );
}
