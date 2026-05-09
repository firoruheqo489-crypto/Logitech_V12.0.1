"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  labelZh: string;
  labelEn: string;
  value: string | number;
  unit?: string;
  trend: "up" | "down" | "neutral";
  trendValue: string;
  trendPositive?: boolean;
}

function KPICard({
  labelZh,
  labelEn,
  value,
  unit,
  trend,
  trendValue,
  trendPositive,
}: KPICardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trendPositive === undefined
      ? "text-zinc-500"
      : trendPositive
      ? "text-emerald-500"
      : "text-rose-500";

  return (
    <div
      className="relative rounded-lg border border-zinc-800 bg-[#0f1115] p-4 transition-all hover:border-zinc-700"
      style={{
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)",
      }}
    >
      <div className="mb-3">
        <span className="text-sm text-zinc-200">{labelZh}</span>
        <span className="ml-2 text-xs text-zinc-500 font-mono">{labelEn}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold text-zinc-100">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-zinc-500">{unit}</span>
        )}
      </div>
      <div className={`mt-2 flex items-center gap-1 ${trendColor}`}>
        <TrendIcon className="h-3.5 w-3.5" />
        <span className="font-mono text-xs">{trendValue}</span>
      </div>
      {/* Subtle glow indicator */}
      <div
        className={`absolute top-2 right-2 h-2 w-2 rounded-full ${
          trendPositive === undefined
            ? "bg-zinc-600"
            : trendPositive
            ? "bg-emerald-500"
            : "bg-rose-500"
        }`}
        style={{
          boxShadow:
            trendPositive === undefined
              ? "none"
              : trendPositive
              ? "0 0 8px rgba(16, 185, 129, 0.5)"
              : "0 0 8px rgba(244, 63, 94, 0.5)",
        }}
      />
    </div>
  );
}

export function KPICards() {
  const kpis: KPICardProps[] = [
    {
      labelZh: "总样本量",
      labelEn: "Total Samples",
      value: "12,847",
      unit: "pcs",
      trend: "up",
      trendValue: "+324 (2.6%)",
      trendPositive: true,
    },
    {
      labelZh: "平均偏差",
      labelEn: "Avg Deviation",
      value: "0.0023",
      unit: "mm",
      trend: "down",
      trendValue: "-0.0008 (26%)",
      trendPositive: true,
    },
    {
      labelZh: "系统稳定性",
      labelEn: "System Stability",
      value: "98.7",
      unit: "%",
      trend: "up",
      trendValue: "+1.2%",
      trendPositive: true,
    },
    {
      labelZh: "过程能力指数",
      labelEn: "Cpk Index",
      value: "1.42",
      trend: "down",
      trendValue: "-0.08",
      trendPositive: false,
    },
    {
      labelZh: "异常检测数",
      labelEn: "Anomalies Detected",
      value: "23",
      unit: "个",
      trend: "down",
      trendValue: "-12 (34%)",
      trendPositive: true,
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {kpis.map((kpi, index) => (
        <KPICard key={index} {...kpi} />
      ))}
    </div>
  );
}
