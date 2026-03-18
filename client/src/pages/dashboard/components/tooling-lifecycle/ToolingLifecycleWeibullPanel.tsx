"use client";

import { useState } from "react";
import { CheckCircle, RefreshCw } from "lucide-react";
import type {
  MaintenanceEvent,
  WeibullParameters,
} from "./toolingLifecycleModel";

interface ToolingLifecycleWeibullPanelProps {
  currentShots: number;
  currentReliability: number;
  currentHazardRate: number;
  activeEta: number;
  isCalibrated: boolean;
  parameters: WeibullParameters;
  events: MaintenanceEvent[];
  onCalibrate: () => void;
}

export function ToolingLifecycleWeibullPanel({
  currentShots,
  currentReliability,
  currentHazardRate,
  activeEta,
  isCalibrated,
  parameters,
  events,
  onCalibrate,
}: ToolingLifecycleWeibullPanelProps) {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const cmEvents = events.filter(eventItem => eventItem.type === "CM").length;
  const pmEvents = events.filter(eventItem => eventItem.type === "PM").length;
  const isCritical = currentShots > activeEta * 0.85;

  const handleCalibrate = () => {
    if (isCalibrated || isCalibrating) return;
    setIsCalibrating(true);
    window.setTimeout(() => {
      setIsCalibrating(false);
      onCalibrate();
    }, 2500);
  };

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-800 bg-[#0a0f1c] p-5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-cyan-500">{">_"}</span>
        <div>
          <p className="text-xs font-mono tracking-wide text-cyan-500">
            WEIBULL ENGINE
          </p>
        </div>
        {isCalibrated && (
          <span className="ml-auto rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-bold text-rose-400">
            DEGRADED
          </span>
        )}
      </div>

      <div className="h-px bg-slate-800" />

      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
          Survival Function
        </p>
        <div className="rounded border border-slate-800/50 bg-slate-900 p-2.5 font-mono text-sm text-slate-300">
          {"R(t) = exp[-(t/η)^β]"}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
          Hazard Function
        </p>
        <div className="rounded border border-slate-800/50 bg-slate-900 p-2.5 font-mono text-sm text-slate-300">
          {"h(t) = (β/η)(t/η)^(β-1)"}
        </div>
      </div>

      <div className="h-px bg-slate-800" />

      <div className="flex flex-col gap-3">
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
          Parameters
        </p>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded border border-slate-800/30 bg-slate-900/60 px-3 py-2">
            <span className="text-[11px] text-slate-500">
              <span className="text-cyan-400">β</span> Shape Parameter
            </span>
            <span className="text-sm font-bold tabular-nums text-slate-200">
              {parameters.beta.toFixed(2)}
            </span>
          </div>

          <div
            className={`flex items-center justify-between rounded border px-3 py-2 transition-colors duration-700 ${
              isCalibrated
                ? "border-rose-500/40 bg-rose-950/30"
                : "border-slate-800/30 bg-slate-900/60"
            }`}
          >
            <span className="text-[11px] text-slate-500">
              <span className="text-cyan-400">η</span> Scale Parameter
            </span>
            {isCalibrated ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tabular-nums text-slate-600 line-through">
                  {parameters.etaNormal.toLocaleString()}
                </span>
                <span className="animate-pulse text-sm font-bold tabular-nums text-rose-400">
                  {parameters.etaDegraded.toLocaleString()}
                </span>
              </div>
            ) : (
              <span className="text-sm font-bold tabular-nums text-slate-200">
                {parameters.etaNormal.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between rounded border border-slate-800/30 bg-slate-900/60 px-3 py-2">
            <span className="text-[11px] text-slate-500">
              <span className="text-amber-400">t</span> Current
            </span>
            <span className="text-sm font-bold tabular-nums text-amber-400">
              {currentShots.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="h-px bg-slate-800" />

      <div className="flex flex-col gap-1">
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
          Instantaneous Hazard h(t)
        </p>
        <p className="text-xl font-bold tabular-nums text-cyan-400">
          {currentHazardRate.toFixed(6)}
        </p>
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-slate-800/50 bg-slate-900/40 p-4">
        <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
          Real-Time Reliability R(t)
        </p>
        <p
          className={`text-3xl font-bold tabular-nums ${
            isCritical ? "animate-pulse text-rose-500" : "text-emerald-400"
          }`}
        >
          {currentReliability.toFixed(4)}%
        </p>
        <p className="text-[9px] tabular-nums text-slate-600">
          Raw: {(currentReliability / 100).toFixed(8)}
        </p>
      </div>

      <hr className="my-1 border-slate-800" />

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-orange-400">{">_"}</span>
          <p className="text-xs font-mono tracking-wide text-orange-400">
            经验数据校准 / EMPIRICAL CALIBRATION
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-800/50 bg-slate-900/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400">
              已记录异常宕机 (CM EVENTS)
            </span>
            <span className="text-sm font-bold tabular-nums text-rose-400">
              {cmEvents}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400">
              预防性维护 (PM EVENTS)
            </span>
            <span className="text-sm font-bold tabular-nums text-amber-400">
              {pmEvents}
            </span>
          </div>

          <div className="my-1 h-px bg-slate-800" />

          {!isCalibrated ? (
            <>
              <p className="text-[10px] font-bold leading-relaxed text-rose-400">
                检测到偶然失效期异常峰值。理论模型存在高估风险。
              </p>
              <p className="text-[10px] leading-relaxed text-slate-500">
                Anomalous CM events detected in useful-life zone.
                <br />
                Theoretical model may overestimate reliability.
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold leading-relaxed text-rose-400">
                降级校准已执行。资产最大寿命惩罚 -200,000 shots.
              </p>
              <p className="text-[10px] leading-relaxed text-slate-500">
                Bayesian penalty applied. Asset maximum lifespan reduced from
                1,000,000 to 800,000. This action is irreversible.
              </p>
            </>
          )}

          {isCalibrated && (
            <div className="flex items-center gap-2 rounded border border-rose-900/30 bg-rose-950/30 px-2 py-1.5">
              <CheckCircle className="h-3 w-3 shrink-0 text-rose-400" />
              <span className="text-[10px] font-mono text-rose-400">
                PENALTY EXECUTED | η 1M &gt; 800K | IRREVERSIBLE
              </span>
            </div>
          )}
        </div>

        {isCalibrated ? (
          <div className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-mono tracking-widest text-slate-500">
            <CheckCircle className="h-3 w-3 text-emerald-500" />
            已执行贝叶斯降级校准 (CALIBRATED: -200K)
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCalibrate}
            disabled={isCalibrating}
            className="flex w-full items-center justify-center gap-2 rounded border border-orange-700/50 bg-orange-950/30 px-3 py-2 text-[10px] font-mono tracking-widest text-orange-500 transition-all active:scale-[0.98] hover:bg-orange-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${isCalibrating ? "animate-spin" : ""}`}
            />
            {isCalibrating
              ? "运行贝叶斯降级校准中... (RUNNING)"
              : "运行贝叶斯降级校准 (BAYESIAN UPDATE)"}
          </button>
        )}
      </div>
    </div>
  );
}
