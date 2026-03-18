"use client";

import { AlertOctagon, FileText } from "lucide-react";
import { ZONE_1_END } from "./toolingLifecycleMath";

interface ToolingLifecycleStatusPanelsProps {
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
      label: "Early Failure",
      sublabel: "INFANT MORTALITY",
      color: "text-cyan-400",
      borderColor: "border-cyan-500/30",
      bgColor: "bg-cyan-950/20",
      dotColor: "bg-cyan-400",
      risk: "Medium",
      riskColor: "text-amber-400",
      action: "Increase inspection frequency",
    };
  }

  if (pct < 0.85) {
    return {
      label: "Useful Life",
      sublabel: "USEFUL LIFE",
      color: "text-emerald-400",
      borderColor: "border-emerald-500/30",
      bgColor: "bg-emerald-950/20",
      dotColor: "bg-emerald-400",
      risk: "Low",
      riskColor: "text-emerald-400",
      action: "Maintain routine PM",
    };
  }

  return {
    label: "Wear-Out",
    sublabel: "WEAR-OUT",
    color: "text-rose-400",
    borderColor: "border-rose-500/30",
    bgColor: "bg-rose-950/20",
    dotColor: "bg-rose-400",
    risk: "High",
    riskColor: "text-rose-400",
    action: "Schedule overhaul immediately",
  };
}

export function ToolingLifecycleStatusPanels({
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
  const remainingShots = activeEta - currentShots;
  const lifePct = (currentShots / activeEta) * 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Current Shots"
          sublabel="CURRENT SHOTS"
          value={currentShots.toLocaleString()}
          unit="shots"
          color="text-amber-400"
        />
        <StatCard
          label="Remaining Life"
          sublabel="REMAINING"
          value={remainingShots.toLocaleString()}
          unit="shots"
          color={remainingShots < 150000 ? "text-rose-400" : "text-slate-100"}
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
          value={currentHazardRate.toFixed(4)}
          unit=""
          color="text-cyan-400"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Lifecycle Progress {isCalibrated ? "(DEGRADED)" : "(NOMINAL)"}
          </span>
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
            <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
              Current Zone
            </span>
          </div>
          <p className={`text-lg font-bold tabular-nums ${zoneStatus.color}`}>
            {zoneStatus.label}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-600">
            {zoneStatus.sublabel}
          </p>
        </div>

        {!isCalibrated ? (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
                Risk Assessment & Advice
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <div>
                <p className="mb-0.5 text-[9px] text-slate-600">Risk Level</p>
                <p className={`text-base font-bold ${zoneStatus.riskColor}`}>
                  {zoneStatus.risk}
                </p>
              </div>
              <div className="h-8 border-l border-slate-800" />
              <div>
                <p className="mb-0.5 text-[9px] text-slate-600">
                  Recommended Action
                </p>
                <p className="text-[11px] text-slate-300">
                  {zoneStatus.action}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
              <div>Remaining: {remainingShots.toLocaleString()}</div>
              <div>h(t): {currentHazardRate.toFixed(4)}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-between rounded-xl border border-rose-600 bg-[#1a0505] p-4 shadow-[0_0_15px_rgba(225,29,72,0.2)]">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-rose-500" />
                <span className="text-xs font-bold uppercase text-rose-500">
                  Liability Handover
                </span>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-0.5 text-[9px] text-slate-600">Penalty</p>
                  <p className="text-[10px] font-mono font-bold text-slate-400">
                    -200,000 Shots
                  </p>
                </div>
                <div>
                  <p className="mb-0.5 text-[9px] text-slate-600">Cause</p>
                  <p className="text-[10px] font-bold text-rose-400">
                    CM anomaly structural damage
                  </p>
                </div>
              </div>

              <div className="mb-3 h-px bg-rose-900/50" />

              <div className="mb-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-600">
                    Original Life
                  </span>
                  <span className="text-[10px] tabular-nums text-slate-500 line-through">
                    1,000,000
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-600">
                    Degraded Life
                  </span>
                  <span className="text-[10px] font-bold tabular-nums text-rose-400">
                    800,000
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-600">Impairment</span>
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
              Generate Report
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
          <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Weibull Parameters & Model
          </span>
          {isCalibrated && (
            <span className="text-[8px] font-bold text-rose-500">MODIFIED</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
          <ParamCell label="Beta" value={beta.toFixed(2)} />
          <ParamCell
            label="Max Life N"
            value={activeEta.toLocaleString()}
            highlight={isCalibrated}
          />
          <ParamCell
            label="Zone 1 End"
            value={Math.floor(activeEta * 0.15).toLocaleString()}
            highlight={isCalibrated}
          />
          <ParamCell
            label="Zone 2 End"
            value={wearOutThreshold.toLocaleString()}
            highlight={isCalibrated}
          />
          <ParamCell label="Beta (Useful)" value="= 1.0" />
          <ParamCell label="Beta (Wear)" value="> 1.0" />
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
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="mb-0.5 text-[8px] text-slate-600">{label}</p>
      <p
        className={`text-[11px] tabular-nums ${highlight ? "font-bold text-rose-400" : "text-slate-300"}`}
      >
        {value}
      </p>
    </div>
  );
}
