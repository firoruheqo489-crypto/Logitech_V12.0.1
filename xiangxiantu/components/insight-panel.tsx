"use client";

import { Activity, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StabilityGaugeProps {
  value: number;
}

function StabilityGauge({ value }: StabilityGaugeProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));
  const strokeDasharray = `${(normalizedValue / 100) * 251.2} 251.2`;
  const color =
    normalizedValue >= 80
      ? "#10b981"
      : normalizedValue >= 60
      ? "#fbbf24"
      : "#f43f5e";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="120" height="120" className="-rotate-90">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r="40"
          fill="none"
          stroke="#27272a"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="60"
          cy="60"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${color}60)`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-2xl font-bold text-zinc-100">
          {normalizedValue.toFixed(1)}
        </span>
        <span className="font-mono text-[10px] text-zinc-500">%</span>
      </div>
    </div>
  );
}

interface AnomalyBarProps {
  label: string;
  labelEn: string;
  value: number;
  maxValue: number;
  color: string;
}

function AnomalyBar({ label, labelEn, value, maxValue, color }: AnomalyBarProps) {
  const percentage = (value / maxValue) * 100;

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
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>
    </div>
  );
}

export function InsightPanel() {
  const anomalyData = [
    { label: "尺寸超差", labelEn: "Dimension", value: 12, color: "#f43f5e" },
    { label: "形位公差", labelEn: "GD&T", value: 6, color: "#fbbf24" },
    { label: "表面缺陷", labelEn: "Surface", value: 3, color: "#3b82f6" },
    { label: "材料异常", labelEn: "Material", value: 2, color: "#8b5cf6" },
  ];

  const maxAnomalyValue = Math.max(...anomalyData.map((d) => d.value));

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-zinc-800 bg-[#0f1115]"
      style={{
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)",
      }}
    >
      {/* Stability Index */}
      <div className="border-b border-zinc-800 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500" />
          <span className="text-sm text-zinc-200">稳定性指数</span>
          <span className="text-xs text-zinc-500 font-mono">Stability Index</span>
        </div>
        <div className="flex justify-center">
          <StabilityGauge value={87.3} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[10px]">
          <div className="rounded bg-zinc-900/50 p-1.5">
            <div className="font-mono text-zinc-400">Cp</div>
            <div className="font-mono text-sm font-semibold text-zinc-200">1.52</div>
          </div>
          <div className="rounded bg-zinc-900/50 p-1.5">
            <div className="font-mono text-zinc-400">Cpk</div>
            <div className="font-mono text-sm font-semibold text-zinc-200">1.42</div>
          </div>
        </div>
      </div>

      {/* Anomaly Distribution */}
      <div className="flex-1 border-b border-zinc-800 p-4">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-zinc-200">异常分布</span>
          <span className="text-xs text-zinc-500 font-mono">Anomaly Distribution</span>
        </div>
        <div className="space-y-3">
          {anomalyData.map((item, index) => (
            <AnomalyBar
              key={index}
              label={item.label}
              labelEn={item.labelEn}
              value={item.value}
              maxValue={maxAnomalyValue}
              color={item.color}
            />
          ))}
        </div>
        <div className="mt-4 rounded bg-zinc-900/30 p-2 text-center">
          <span className="font-mono text-lg font-bold text-zinc-100">23</span>
          <span className="ml-1 text-[10px] text-zinc-500 font-mono">Total Anomalies</span>
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4">
        <Button
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all"
          style={{
            boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
          }}
        >
          <Zap className="mr-2 h-4 w-4" />
          <div className="flex flex-col items-start leading-tight">
            <span className="text-sm">执行深度根因分析</span>
            <span className="text-[10px] text-blue-200 font-mono">Initialize Deep Root Cause Analysis</span>
          </div>
        </Button>
      </div>
    </div>
  );
}
