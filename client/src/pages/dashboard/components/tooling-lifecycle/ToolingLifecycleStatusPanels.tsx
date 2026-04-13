"use client";

import { AlertOctagon, FileText } from "lucide-react";
import { ZONE_1_END, formatHazardValue } from "./toolingLifecycleMath";

interface ToolingLifecycleStatusPanelsProps {
  activeShotLine: "simulated" | "realtime";
  currentShots: number;
  activeEta: number;
  currentReliability: number;
  currentHazardRate: number;
  wearOutThreshold: number;
  beta: number;
  isCalibrated: boolean;
  onGenerateReport: () => Promise<void>;
}

function getZoneStatus(shots: number, maxLife: number) {
  const pct = shots / maxLife;

  if (pct < ZONE_1_END) {
    return {
      labelZh: "早期失效",
      label: "Early Failure",
      sublabelZh: "婴儿死亡期",
      sublabel: "INFANT MORTALITY",
      color: "text-cyan-400",
      borderColor: "border-cyan-500/30",
      bgColor: "bg-cyan-950/20",
      dotColor: "bg-cyan-400",
      riskZh: "中风险",
      risk: "Medium",
      riskColor: "text-amber-400",
      actionZh: "提高巡检频次",
      action: "Increase inspection frequency",
    };
  }

  if (pct < 0.85) {
    return {
      labelZh: "稳定使用",
      label: "Useful Life",
      sublabelZh: "稳定寿命区",
      sublabel: "USEFUL LIFE",
      color: "text-emerald-400",
      borderColor: "border-emerald-500/30",
      bgColor: "bg-emerald-950/20",
      dotColor: "bg-emerald-400",
      riskZh: "低风险",
      risk: "Low",
      riskColor: "text-emerald-400",
      actionZh: "维持例行保养",
      action: "Maintain routine PM",
    };
  }

  return {
    labelZh: "磨损失效",
    label: "Wear-Out",
    sublabelZh: "磨损失效区",
    sublabel: "WEAR-OUT",
    color: "text-rose-400",
    borderColor: "border-rose-500/30",
    bgColor: "bg-rose-950/20",
    dotColor: "bg-rose-400",
    riskZh: "高风险",
    risk: "High",
    riskColor: "text-rose-400",
    actionZh: "立即安排大修",
    action: "Schedule overhaul immediately",
  };
}

export function ToolingLifecycleStatusPanels({
  activeShotLine,
  currentShots,
  activeEta,
  currentReliability,
  currentHazardRate,
  wearOutThreshold,
  beta,
  isCalibrated,
  onGenerateReport,
}: ToolingLifecycleStatusPanelsProps) {
  const zoneStatus = getZoneStatus(currentShots, activeEta);
  const isTemplateIdle = currentShots <= 0;
  const remainingShots = activeEta - currentShots;
  const lifePct = isTemplateIdle ? 0 : (currentShots / activeEta) * 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={activeShotLine === "realtime" ? "Real-Time Shots" : "Simulated Shots"}
          sublabel={activeShotLine === "realtime" ? "REAL-TIME SHOTS" : "SIMULATED SHOTS"}
          value={currentShots.toLocaleString()}
          unit="shots"
          color={activeShotLine === "realtime" ? "text-cyan-300" : "text-amber-400"}
        />
        <StatCard
          label="Remaining Life"
          sublabel="REMAINING"
          value={isTemplateIdle ? "--" : remainingShots.toLocaleString()}
          unit={isTemplateIdle ? "--" : "shots"}
          color={isTemplateIdle || remainingShots < 150000 ? "text-rose-400" : "text-slate-100"}
        />
        <StatCard
          label="Reliability R(t)"
          sublabel="RELIABILITY"
          value={currentReliability.toFixed(2)}
          unit="%"
          color={
            currentReliability > 90
              ? "text-emerald-400"
              : currentReliability > 70
                ? "text-amber-400"
                : "text-rose-400"
          }
        />
        <StatCard
          label="Hazard Rate h(t)"
          sublabel="HAZARD RATE"
          value={formatHazardValue(currentHazardRate)}
          unit=""
          color="text-cyan-400"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col leading-tight">
            <span
              className="text-[10px] text-slate-400"
              style={{ fontFamily: "var(--font-body)" }}
            >
              生命周期进度 {isCalibrated ? "（降级）" : "（标定）"}
            </span>
            <span
              className="text-[8px] uppercase tracking-[0.15em] text-slate-600"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Lifecycle Progress {isCalibrated ? "(DEGRADED)" : "(NOMINAL)"}
            </span>
          </div>
          <span className="text-[11px] tabular-nums text-slate-400">
            {lifePct.toFixed(1)}%
          </span>
        </div>
        <div
          className={`h-2 w-full overflow-hidden rounded-full ${isCalibrated ? "bg-rose-950/40" : "bg-slate-800/80"}`}
        >
          <div
            className="h-full rounded-full transition-all duration-150 ease-out"
            style={{
              width: `${Math.min(lifePct, 100)}%`,
              background:
                lifePct < 15
                  ? "linear-gradient(90deg, #22d3ee, #06b6d4)"
                  : lifePct < 85
                    ? "linear-gradient(90deg, #06b6d4, #10b981)"
                    : "linear-gradient(90deg, #f59e0b, #ef4444)",
            }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[8px] text-cyan-700">0</span>
          <span className="text-[8px] text-cyan-800">
            {Math.floor((activeEta * 0.15) / 1000)}K
          </span>
          <span
            className={`text-[8px] ${isCalibrated ? "font-bold text-rose-500" : "text-rose-800"}`}
          >
            {Math.floor(wearOutThreshold / 1000)}K
          </span>
          <span
            className={`text-[8px] ${isCalibrated ? "font-bold text-rose-600" : "text-slate-700"}`}
          >
            {Math.floor(activeEta / 1000)}K
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          className={`rounded border p-3 ${zoneStatus.borderColor} ${zoneStatus.bgColor}`}
        >
          <div className="mb-2 flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${zoneStatus.dotColor} animate-pulse`}
            />
            <div className="flex flex-col leading-tight">
              <span
                className="text-[10px] text-slate-400"
                style={{ fontFamily: "var(--font-body)" }}
              >
                当前区间
              </span>
              <span
                className="text-[8px] uppercase tracking-[0.15em] text-slate-600"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                CURRENT ZONE
              </span>
            </div>
          </div>
          <p
            className={`text-base font-semibold ${zoneStatus.color}`}
            style={{ fontFamily: "var(--font-body)" }}
          >
            {zoneStatus.labelZh}
          </p>
          <p
            className={`mt-0.5 text-[10px] uppercase tracking-[0.14em] ${zoneStatus.color}`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {zoneStatus.label}
          </p>
          <p
            className="mt-1 text-[9px] text-slate-500"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {zoneStatus.sublabelZh}
          </p>
          <p className="text-[9px] text-slate-600" style={{ fontFamily: "var(--font-mono)" }}>
            {zoneStatus.sublabel}
          </p>
        </div>

        {!isCalibrated ? (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <div className="mb-2 flex flex-col leading-tight">
              <span
                className="text-[10px] text-slate-400"
                style={{ fontFamily: "var(--font-body)" }}
              >
                风险评估与建议
              </span>
              <span
                className="text-[8px] uppercase tracking-[0.15em] text-slate-600"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Risk Assessment & Advice
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <div>
                <p className="text-[9px] text-slate-500" style={{ fontFamily: "var(--font-body)" }}>
                  风险等级
                </p>
                <p className="mb-0.5 text-[8px] text-slate-600" style={{ fontFamily: "var(--font-mono)" }}>
                  RISK LEVEL
                </p>
                <p className={`text-[13px] font-semibold ${zoneStatus.riskColor}`} style={{ fontFamily: "var(--font-body)" }}>
                  {zoneStatus.riskZh}
                </p>
                <p className={`text-[11px] font-bold ${zoneStatus.riskColor}`} style={{ fontFamily: "var(--font-mono)" }}>
                  {zoneStatus.risk}
                </p>
              </div>
              <div className="h-8 border-l border-slate-800" />
              <div>
                <p className="text-[9px] text-slate-500" style={{ fontFamily: "var(--font-body)" }}>
                  建议动作
                </p>
                <p className="mb-0.5 text-[8px] text-slate-600" style={{ fontFamily: "var(--font-mono)" }}>
                  Recommended Action
                </p>
                <p className="text-[11px] text-slate-200" style={{ fontFamily: "var(--font-body)" }}>
                  {zoneStatus.actionZh}
                </p>
                <p className="text-[10px] text-slate-300" style={{ fontFamily: "var(--font-mono)" }}>
                  {zoneStatus.action}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
              <div>Remaining: {isTemplateIdle ? "--" : remainingShots.toLocaleString()}</div>
              <div>h(t): {formatHazardValue(currentHazardRate)}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-between rounded-xl border border-rose-600 bg-[#1a0505] p-4 shadow-[0_0_15px_rgba(225,29,72,0.2)]">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-rose-500" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[11px] font-semibold text-rose-300" style={{ fontFamily: "var(--font-body)" }}>
                    责任移交
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-rose-500" style={{ fontFamily: "var(--font-mono)" }}>
                    Liability Handover
                  </span>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] text-slate-500" style={{ fontFamily: "var(--font-body)" }}>
                    惩罚项
                  </p>
                  <p className="mb-0.5 text-[8px] text-slate-600" style={{ fontFamily: "var(--font-mono)" }}>
                    Penalty
                  </p>
                  <p className="text-[10px] font-mono font-bold text-slate-400">
                    -200,000 Shots
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500" style={{ fontFamily: "var(--font-body)" }}>
                    原因
                  </p>
                  <p className="mb-0.5 text-[8px] text-slate-600" style={{ fontFamily: "var(--font-mono)" }}>
                    Cause
                  </p>
                  <p className="text-[10px] font-bold text-rose-400">
                    CM anomaly structural damage
                  </p>
                </div>
              </div>

              <div className="mb-3 h-px bg-rose-900/50" />

              <div className="mb-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500" style={{ fontFamily: "var(--font-body)" }}>
                    原始寿命
                  </span>
                  <span className="text-[10px] tabular-nums text-slate-500 line-through">
                    1,000,000
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500" style={{ fontFamily: "var(--font-body)" }}>
                    降级寿命
                  </span>
                  <span className="text-[10px] font-bold tabular-nums text-rose-400">
                    800,000
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500" style={{ fontFamily: "var(--font-body)" }}>
                    折损比例
                  </span>
                  <span className="text-[10px] font-bold tabular-nums text-rose-500">
                    -20.0%
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void onGenerateReport();
              }}
              className="flex w-full items-center justify-center gap-2 rounded bg-rose-700 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-all active:scale-[0.98] hover:bg-rose-600"
            >
              <FileText className="h-4 w-4" />
              生成报告 / Generate Report
            </button>
          </div>
        )}
      </div>

      <div
        className={`rounded border p-3 ${
          isCalibrated
            ? "border-rose-900/50 bg-rose-950/10"
            : "border-slate-800 bg-slate-900/30"
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
              韦伯参数与模型
            </span>
            <span
              className="text-[8px] uppercase tracking-[0.15em] text-slate-600"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Weibull Parameters & Model
            </span>
          </div>
          {isCalibrated && (
            <span className="text-[8px] font-bold text-rose-500">MODIFIED</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
          <ParamCell labelZh="形状参数 Beta" labelEn="BETA" value={beta.toFixed(2)} />
          <ParamCell
            labelZh="最大寿命 N"
            labelEn="MAX LIFE N"
            value={activeEta.toLocaleString()}
            highlight={isCalibrated}
          />
          <ParamCell
            labelZh="区间 1 终点"
            labelEn="ZONE 1 END"
            value={Math.floor(activeEta * 0.15).toLocaleString()}
            highlight={isCalibrated}
          />
          <ParamCell
            labelZh="区间 2 终点"
            labelEn="ZONE 2 END"
            value={wearOutThreshold.toLocaleString()}
            highlight={isCalibrated}
          />
          <ParamCell labelZh="基础 Beta" labelEn="BASE BETA" value="1.80" />
          <ParamCell labelZh="Beta 上限" labelEn="BETA LIMIT" value="4.80" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  sublabel,
  value,
  unit,
  color,
}: {
  label: string;
  sublabel: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
      <p className="mb-0.5 text-[9px] text-slate-500">{label}</p>
      <p className="mb-1 text-[8px] text-slate-700">{sublabel}</p>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold tabular-nums ${color}`}>
          {value}
        </span>
        {unit && <span className="text-[10px] text-slate-600">{unit}</span>}
      </div>
    </div>
  );
}

function ParamCell({
  labelZh,
  labelEn,
  value,
  highlight,
}: {
  labelZh: string;
  labelEn: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] text-slate-500" style={{ fontFamily: "var(--font-body)" }}>
        {labelZh}
      </p>
      <p
        className="mb-0.5 text-[8px] uppercase tracking-[0.12em] text-slate-600"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {labelEn}
      </p>
      <p
        className={`text-[11px] tabular-nums ${highlight ? "font-bold text-rose-400" : "text-slate-300"}`}
      >
        {value}
      </p>
    </div>
  );
}
