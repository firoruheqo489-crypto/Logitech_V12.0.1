"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Download } from "lucide-react";
import { ToolingLifecycleActionCards } from "./tooling-lifecycle/ToolingLifecycleActionCards";
import { ToolingLifecycleBathtubChart } from "./tooling-lifecycle/ToolingLifecycleBathtubChart";
import { ToolingLifecycleStatusPanels } from "./tooling-lifecycle/ToolingLifecycleStatusPanels";
import { ToolingLifecycleWeibullPanel } from "./tooling-lifecycle/ToolingLifecycleWeibullPanel";
import {
  DEFAULT_TOOLING_LIFECYCLE_STATE,
  DEFAULT_WEIBULL_PARAMETERS,
  type ToolingLifecycleState,
} from "./tooling-lifecycle/toolingLifecycleModel";
import { buildQuickJumpPoints } from "./tooling-lifecycle/toolingLifecycleMath";
import { useWeibullEngine } from "./tooling-lifecycle/useWeibullEngine";

interface ToolingLifecyclePrognosticsProps {
  moldId?: string;
  moldNo?: string;
}

export default function ToolingLifecyclePrognostics({
  moldId = "LA26006",
  moldNo = "NO. 1",
}: ToolingLifecyclePrognosticsProps) {
  const [lifecycleState, setLifecycleState] = useState<ToolingLifecycleState>(
    DEFAULT_TOOLING_LIFECYCLE_STATE
  );
  const { currentShots, isCalibrated, events } = lifecycleState;

  const {
    parameters,
    activeEta,
    currentReliability,
    currentHazardRate,
    wearOutThreshold,
  } = useWeibullEngine(currentShots, isCalibrated, DEFAULT_WEIBULL_PARAMETERS);

  const isInDeathSpiral = isCalibrated && currentShots >= wearOutThreshold;

  useEffect(() => {
    if (isCalibrated && currentShots > activeEta) {
      setLifecycleState(prev => ({ ...prev, currentShots: activeEta }));
    }
  }, [activeEta, currentShots, isCalibrated]);

  const quickJumps = useMemo(
    () => buildQuickJumpPoints(isCalibrated),
    [isCalibrated]
  );

  const handleShotsChange = useCallback(
    (shots: number) => {
      setLifecycleState(prev => ({
        ...prev,
        currentShots: Math.max(0, Math.min(shots, activeEta)),
      }));
    },
    [activeEta]
  );

  const handleCalibrate = useCallback(() => {
    setLifecycleState(prev =>
      prev.isCalibrated ? prev : { ...prev, isCalibrated: true }
    );
  }, []);

  const handleGenerateReport = useCallback(async () => {
    // TODO: Hook in html2canvas or jspdf to export the current panel snapshot.
    console.log("EXECUTING: Generating Liability PDF Report...");
    console.log(
      `ASSET: ${moldId} | CURRENT SHOTS: ${currentShots} | DEGRADED: ${isCalibrated}`
    );
    window.alert(
      "资产减值与定责报告已生成，保存在本地缓存。请视行政博弈需要，决定是否流转至财务部。"
    );
  }, [currentShots, isCalibrated, moldId]);

  return (
    <section
      className={`min-h-screen w-full bg-[#020617] font-mono tabular-nums text-slate-200 transition-all duration-700 ${
        isInDeathSpiral
          ? "ring-2 ring-rose-500 shadow-[inset_0_0_50px_rgba(225,29,72,0.1)]"
          : ""
      }`}
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-4 md:p-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-cyan-500" />
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-100 md:text-base">
                模具全生命周期可靠性仿真
              </h1>
              <p className="text-[10px] tracking-[0.1em] text-slate-600">
                TOOLING LIFECYCLE PROGNOSTICS
              </p>
            </div>
            <div className="mx-2 hidden h-4 border-l border-slate-800 md:block" />
            <div className="hidden items-center gap-1.5 md:flex">
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  isCalibrated ? "bg-rose-500" : "bg-emerald-500"
                } animate-pulse`}
              />
              <span className="text-[9px] uppercase tracking-[0.2em] text-slate-600">
                {isCalibrated ? "DEGRADED MODE" : "SYSTEM ONLINE"}
              </span>
            </div>
            {!isCalibrated && (
              <span className="ml-2 hidden animate-pulse rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-500 lg:inline-block">
                MODEL DRIFT DETECTED: REQUIRES CALIBRATION
              </span>
            )}
            {isCalibrated && (
              <span className="ml-2 hidden rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[9px] font-bold text-rose-400 lg:inline-block">
                BAYESIAN PENALTY APPLIED: -200K SHOTS
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-4 lg:flex">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                <span className="text-[9px] text-slate-600">INFANT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] text-slate-600">USEFUL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span className="text-[9px] text-slate-600">WEAR-OUT</span>
              </div>
            </div>

            <div
              className={`rounded-md border px-3 py-1.5 text-[11px] tracking-wide ${
                isCalibrated
                  ? "border-rose-500/30 bg-rose-950/20 text-rose-400"
                  : "border-cyan-500/30 bg-cyan-950/20 text-cyan-400"
              }`}
            >
              <span className="mr-1 text-slate-500">ASSET:</span>
              <span className="font-bold">{moldId}</span>
              <span className="mx-2 text-slate-700">|</span>
              <span className="mr-1 text-slate-500">{moldNo}</span>
              <span className="mx-2 text-slate-700">|</span>
              <span className="mr-1 text-slate-500">LIMIT:</span>
              {isCalibrated ? (
                <>
                  <span className="font-bold text-rose-500 line-through decoration-rose-700/50">
                    {parameters.etaNormal.toLocaleString()}
                  </span>
                  <span className="mx-1 text-slate-600">&gt;</span>
                  <span className="font-bold text-rose-400">
                    {parameters.etaDegraded.toLocaleString()} SHOTS
                  </span>
                </>
              ) : (
                <span className="font-bold">
                  {parameters.etaNormal.toLocaleString()} SHOTS
                </span>
              )}
            </div>

            <button
              type="button"
              className="cursor-pointer rounded border border-slate-700 p-1 text-slate-500 transition-colors hover:border-cyan-500 hover:text-cyan-400"
              title="Export Raw Log"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="relative flex w-full flex-col gap-4 overflow-hidden rounded-xl border border-slate-800 bg-[#050812]/50 p-4 backdrop-blur-sm md:p-6">
              {isCalibrated && (
                <div className="pointer-events-none absolute left-10 top-10 z-0 -rotate-12 whitespace-nowrap border-4 border-rose-500/20 px-4 py-2 text-4xl font-bold uppercase tracking-widest text-rose-500/15 select-none">
                  ASSET DEGRADED
                </div>
              )}

              <div className="relative z-10 flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-4 py-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
                    Shot Counter
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-amber-400 md:text-3xl">
                    {currentShots.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
                    Max Capacity
                  </p>
                  {isCalibrated ? (
                    <div className="flex items-baseline gap-2">
                      <p className="text-lg font-bold tracking-tight text-slate-700 line-through decoration-slate-600">
                        {parameters.etaNormal.toLocaleString()}
                      </p>
                      <p className="animate-pulse text-2xl font-bold tracking-tight text-rose-500 md:text-3xl">
                        {parameters.etaDegraded.toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold tracking-tight text-slate-600 md:text-3xl">
                      {parameters.etaNormal.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {isInDeathSpiral && (
                <div className="relative z-10 w-full animate-pulse rounded bg-rose-600 py-1 text-center text-xs font-bold uppercase tracking-widest text-white">
                  SYSTEM HALT OVERRIDE ENGAGED: CRITICAL WEAR-OUT
                </div>
              )}

              <div className="relative z-10">
                <ToolingLifecycleBathtubChart
                  currentShots={currentShots}
                  onShotsChange={handleShotsChange}
                  maxLifespan={activeEta}
                  isCalibrated={isCalibrated}
                  events={events}
                />
              </div>

              <div className="relative z-10 flex flex-wrap gap-2">
                {quickJumps.map(value => {
                  const isActive = Math.abs(currentShots - value) < 5000;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleShotsChange(value)}
                      className={`cursor-pointer rounded border px-2 py-1 text-[10px] transition-colors ${
                        isActive
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                          : "border-slate-800 bg-slate-900/30 text-slate-500 hover:border-slate-700 hover:text-slate-400"
                      }`}
                    >
                      {value === 0 ? "0" : `${(value / 1000).toFixed(0)}K`}
                    </button>
                  );
                })}
              </div>
            </div>

            <ToolingLifecycleStatusPanels
              currentShots={currentShots}
              activeEta={activeEta}
              currentReliability={currentReliability}
              currentHazardRate={currentHazardRate}
              wearOutThreshold={wearOutThreshold}
              beta={parameters.beta}
              isCalibrated={isCalibrated}
              onGenerateReport={handleGenerateReport}
            />
          </div>

          <div className="lg:col-span-1">
            <ToolingLifecycleWeibullPanel
              currentShots={currentShots}
              currentReliability={currentReliability}
              currentHazardRate={currentHazardRate}
              activeEta={activeEta}
              isCalibrated={isCalibrated}
              parameters={parameters}
              events={events}
              onCalibrate={handleCalibrate}
            />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="shrink-0 text-[9px] uppercase tracking-[0.25em] text-slate-600">
              Tactical Action Center / 战术行动中心
            </span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <ToolingLifecycleActionCards
            currentShots={currentShots}
            maxLifespan={activeEta}
            isCalibrated={isCalibrated}
          />
        </div>

        <footer className="flex items-center justify-between border-t border-slate-800/50 pb-2 pt-3">
          <span className="text-[9px] text-slate-700">
            Weibull Reliability Model | Tooling Lifecycle Prognostics System
          </span>
          <span className="text-[9px] tabular-nums text-slate-700">
            v5.0.0-closure | ASSET {moldId} {isCalibrated && "| DEGRADED"}
            {isInDeathSpiral && " | HALT"}
          </span>
        </footer>
      </div>
    </section>
  );
}
