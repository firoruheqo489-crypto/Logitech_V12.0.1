import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { GlobalStats } from "./statsEngine";

interface KPICardProps {
  labelZh: string;
  labelEn: string;
  value: string | number;
  unit?: string;
  trend: "up" | "down" | "neutral";
  trendValue: string;
  trendPositive?: boolean;
  strikethrough?: boolean;
  normalityStatus?: boolean;
}

function KPICard({ labelZh, labelEn, value, unit, trend, trendValue, trendPositive, strikethrough, normalityStatus }: KPICardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trendPositive === undefined ? "text-zinc-500" : trendPositive ? "text-emerald-500" : "text-rose-500";

  return (
    <div className="relative rounded-lg border border-zinc-800 bg-[#0f1115] p-4 transition-all hover:border-zinc-700" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)" }}>
      <div className="mb-3">
        <span className="text-sm text-zinc-200">{labelZh}</span>
        <span className="ml-2 text-xs text-zinc-500 font-mono">{labelEn}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-2xl font-semibold text-zinc-100 ${strikethrough ? "line-through opacity-50" : ""}`}>{value}</span>
        {unit && <span className="font-mono text-xs text-zinc-500">{unit}</span>}
      </div>
      <div className={`mt-2 flex items-center gap-1 ${trendColor}`}>
        <TrendIcon className="h-3.5 w-3.5" />
        <span className="font-mono text-xs">{trendValue}</span>
      </div>
      {normalityStatus !== undefined && (
        <div className="mt-1.5 flex items-center gap-1">
          <div className={`h-1.5 w-1.5 rounded-full ${normalityStatus ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
          <span className={`text-[9px] font-mono ${normalityStatus ? "text-emerald-500/80" : "text-amber-500/80"}`}>
            {normalityStatus ? "分布合规" : "Non-Normal"}
          </span>
        </div>
      )}
      <div
        className={`absolute top-2 right-2 h-2 w-2 rounded-full ${trendPositive === undefined ? "bg-zinc-600" : trendPositive ? "bg-emerald-500" : "bg-rose-500"}`}
        style={{ boxShadow: trendPositive === undefined ? "none" : trendPositive ? "0 0 8px rgba(16, 185, 129, 0.5)" : "0 0 8px rgba(244, 63, 94, 0.5)" }}
      />
    </div>
  );
}

interface KPICardsProps {
  globalStats: GlobalStats;
}

export function KPICards({ globalStats }: KPICardsProps) {
  const kpis: KPICardProps[] = [
    {
      labelZh: "总样本量",
      labelEn: "Total Samples",
      value: globalStats.totalSamples.toLocaleString(),
      unit: "pcs",
      trend: "up",
      trendValue: `n=${globalStats.totalSamples}`,
      trendPositive: true,
    },
    {
      labelZh: "平均偏差",
      labelEn: "Avg Deviation",
      value: globalStats.avgDeviation.toFixed(4),
      unit: "mm",
      trend: globalStats.avgDeviation < 0.01 ? "down" : "up",
      trendValue: `σ=${globalStats.globalSigma.toFixed(4)}`,
      trendPositive: globalStats.avgDeviation < 0.01,
    },
    {
      labelZh: "系统稳定性",
      labelEn: "System Stability",
      value: globalStats.stability.toFixed(1),
      unit: "%",
      trend: globalStats.stability >= 95 ? "up" : "down",
      trendValue: globalStats.stability >= 95 ? "稳定" : "需关注",
      trendPositive: globalStats.stability >= 95,
    },
    {
      labelZh: "过程能力指数",
      labelEn: "Cpk Index",
      value: globalStats.cpk.toFixed(2),
      trend: globalStats.cpk >= 1.33 ? "up" : "down",
      trendValue: globalStats.isNormal ? `Cp=${globalStats.cp.toFixed(2)}` : "非正态: Cpk失效",
      trendPositive: globalStats.cpk >= 1.33 && globalStats.isNormal,
      strikethrough: !globalStats.isNormal,
      normalityStatus: globalStats.isNormal,
    },
    {
      labelZh: "异常检测数",
      labelEn: "Anomalies Detected",
      value: String(globalStats.outOfSpecCount),
      unit: "个",
      trend: globalStats.outOfSpecCount <= 5 ? "down" : "up",
      trendValue: `Tukey异常: ${globalStats.totalOutliers}`,
      trendPositive: globalStats.outOfSpecCount <= 5,
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
