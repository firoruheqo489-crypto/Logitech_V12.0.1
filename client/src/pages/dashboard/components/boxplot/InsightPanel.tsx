import { useState } from "react";
import { Activity, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GlobalStats } from "./statsEngine";

function StabilityGauge({ value }: { value: number }) {
  const normalizedValue = Math.min(100, Math.max(0, value));
  const strokeDasharray = `${(normalizedValue / 100) * 251.2} 251.2`;
  const color = normalizedValue >= 80 ? "#10b981" : normalizedValue >= 60 ? "#fbbf24" : "#f43f5e";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="120" height="120" className="-rotate-90">
        <circle cx="60" cy="60" r="40" fill="none" stroke="#27272a" strokeWidth="8" />
        <circle cx="60" cy="60" r="40" fill="none" stroke={color} strokeWidth="8" strokeDasharray={strokeDasharray} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-2xl font-bold text-zinc-100">{normalizedValue.toFixed(1)}</span>
        <span className="font-mono text-[10px] text-zinc-500">%</span>
      </div>
    </div>
  );
}

function AnomalyBar({ label, labelEn, value, maxValue, color }: { label: string; labelEn: string; value: number; maxValue: number; color: string }) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <div>
          <span className="text-zinc-300">{label}</span>
          <span className="ml-1 text-zinc-600 font-mono">{labelEn}</span>
        </div>
        <span className="font-mono text-zinc-400">{value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}40` }} />
      </div>
    </div>
  );
}

interface InsightPanelProps {
  globalStats: GlobalStats;
}

export function InsightPanel({ globalStats }: InsightPanelProps) {
  const [showAnalysis, setShowAnalysis] = useState(false);

  const tukeyOnlyCount = globalStats.totalOutliers - globalStats.outOfSpecCount;
  const anomalyData = [
    { label: "超出规格上限", labelEn: "Over USL", value: globalStats.overUslCount, color: "#f43f5e" },
    { label: "低于规格下限", labelEn: "Under LSL", value: globalStats.underLslCount, color: "#0891b2" },
    { label: "统计学离群值", labelEn: "Tukey Outliers", value: Math.max(0, tukeyOnlyCount), color: "#fbbf24" },
  ];
  const maxAnomalyValue = Math.max(...anomalyData.map((d) => d.value), 1);
  const totalAnomalies = globalStats.outOfSpecCount + Math.max(0, tukeyOnlyCount);

  const handleRootCauseAnalysis = () => {
    setShowAnalysis(true);
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-800 bg-[#0f1115]" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)" }}>
      <div className="border-b border-zinc-800 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500" />
          <span className="text-sm text-zinc-200">稳定性指数</span>
          <span className="text-xs text-zinc-500 font-mono">Stability Index</span>
        </div>
        <div className="flex justify-center">
          <StabilityGauge value={globalStats.stability} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[10px]">
          <div className="rounded bg-zinc-900/50 p-1.5">
            <div className="font-mono text-zinc-400">Cp</div>
            <div className="font-mono text-sm font-semibold text-zinc-200">{globalStats.cp.toFixed(2)}</div>
          </div>
          <div className="rounded bg-zinc-900/50 p-1.5 relative">
            <div className="font-mono text-zinc-400 flex items-center justify-center gap-1">
              Cpk
              {!globalStats.isNormal && <AlertTriangle size={10} className="text-amber-500" />}
            </div>
            <div className={`font-mono text-sm font-semibold text-zinc-200 ${!globalStats.isNormal ? "line-through opacity-50" : ""}`}>{globalStats.cpk.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 border-b border-zinc-800 p-4">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-zinc-200">异常分布</span>
          <span className="text-xs text-zinc-500 font-mono">Anomaly Distribution</span>
        </div>
        <div className="space-y-3">
          {anomalyData.map((item, index) => (
            <AnomalyBar key={index} label={item.label} labelEn={item.labelEn} value={item.value} maxValue={maxAnomalyValue} color={item.color} />
          ))}
        </div>
        <div className="mt-4 rounded bg-zinc-900/30 p-2 text-center">
          <span className="font-mono text-lg font-bold text-zinc-100">{totalAnomalies}</span>
          <span className="ml-1 text-[10px] text-zinc-500 font-mono">Total Anomalies</span>
        </div>
      </div>

      <div className="p-4">
        <Button
          onClick={handleRootCauseAnalysis}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all"
          style={{ boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)" }}
        >
          <Zap className="mr-2 h-4 w-4" />
          <div className="flex flex-col items-start leading-tight">
            <span className="text-sm">执行深度根因分析</span>
            <span className="text-[10px] text-blue-200 font-mono">Initialize Deep Root Cause Analysis</span>
          </div>
        </Button>
      </div>

      {/* Root Cause Analysis Modal */}
      {showAnalysis && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70" onClick={() => setShowAnalysis(false)}>
          <div className="max-h-[70vh] w-[520px] overflow-auto rounded-lg border border-zinc-700 bg-[#0a0a0a] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-zinc-100">根因分析报告 / Root Cause Analysis</h3>
            {globalStats.anomalyDetails.length === 0 ? (
              <p className="text-sm text-emerald-400 font-mono">系统运行稳定，无根因分析需求 / Process stable, no analysis required.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-zinc-400 font-mono mb-2">
                  检测到 {globalStats.anomalyDetails.length} 个异常数据点:
                </p>
                <div className="max-h-[40vh] overflow-auto rounded border border-zinc-800 bg-[#050505]">
                  <table className="w-full text-[11px] font-mono">
                    <thead className="sticky top-0 bg-[#0a0a0a]">
                      <tr className="border-b border-zinc-800 text-zinc-500">
                        <th className="px-3 py-1.5 text-left">工位 / Station</th>
                        <th className="px-3 py-1.5 text-right">数值 / Value</th>
                        <th className="px-3 py-1.5 text-left">类型 / Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalStats.anomalyDetails.map((d, i) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                          <td className="px-3 py-1 text-zinc-300">{d.station}</td>
                          <td className="px-3 py-1 text-right font-semibold text-zinc-100">{d.value.toFixed(4)}</td>
                          <td className="px-3 py-1">
                            <span className={`text-[10px] ${d.type === 'over-usl' ? 'text-rose-400' : d.type === 'under-lsl' ? 'text-cyan-400' : 'text-amber-400'}`}>
                              {d.type === 'over-usl' ? '超出USL' : d.type === 'under-lsl' ? '低于LSL' : 'Tukey离群'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowAnalysis(false)} className="border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800">
                关闭 / Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
