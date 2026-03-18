"use client";

interface ToolingLifecycleActionCardsProps {
  currentShots: number;
  maxLifespan: number;
  isCalibrated: boolean;
}

export function ToolingLifecycleActionCards({
  currentShots,
  maxLifespan,
  isCalibrated,
}: ToolingLifecycleActionCardsProps) {
  const zone1End = Math.floor(maxLifespan * 0.15);
  const zone2End = Math.floor(maxLifespan * 0.85);
  const isInfant = currentShots < zone1End;
  const isUseful = currentShots >= zone1End && currentShots < zone2End;
  const isWearOut = currentShots >= zone2End;

  return (
    <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-800">
            <svg
              className="h-3.5 w-3.5 text-cyan-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085"
              />
            </svg>
          </div>
          <p className="text-xs font-bold text-slate-200">
            例行维护 / Routine Maintenance (PM)
          </p>
        </div>

        {isInfant && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold tracking-wide text-cyan-400">
                INFANT MORTALITY CHECK
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              模具处于早期磨合阶段，建议执行高频巡检，重点关注浇口磨损、配合精度及排气系统状态。
              首个 {(zone1End / 1000).toFixed(0)}K 周期内每 5,000 shots
              执行一次全面检查。
            </p>
            <div className="mt-1 flex items-center gap-2 rounded border border-cyan-900/30 bg-cyan-950/30 px-2 py-1.5">
              <svg
                className="h-3 w-3 shrink-0 text-cyan-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <span className="text-[10px] text-cyan-400/80">
                巡检间隔: 5,000 shots | 重点: 浇口 / 排气 / 配合面
              </span>
            </div>
          </div>
        )}

        {isUseful && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold tracking-wide text-emerald-400">
                ROUTINE PM ACTIVE
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              模具运行处于稳定期，随机失效率恒定。执行标准预防性维护即可，包括定期润滑、清洗模腔、
              检查冷却管路及顶针系统。
            </p>
            <div className="mt-1 flex items-center gap-2 rounded border border-emerald-900/30 bg-emerald-950/30 px-2 py-1.5">
              <svg
                className="h-3 w-3 shrink-0 text-emerald-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-[10px] text-emerald-400/80">
                巡检间隔: 50,000 shots | 标准 PM 流程
              </span>
            </div>
          </div>
        )}

        {isWearOut && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-bold tracking-wide text-amber-400">
                ENHANCED PM REQUIRED
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              模具已进入耗损阶段，常规 PM 不足以控制风险。需提升巡检频率至每
              10,000 shots 一次， 并重点关注疲劳裂纹与尺寸漂移。
            </p>
            <div className="mt-1 flex items-center gap-2 rounded border border-amber-900/30 bg-amber-950/30 px-2 py-1.5">
              <svg
                className="h-3 w-3 shrink-0 text-amber-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
                />
              </svg>
              <span className="text-[10px] text-amber-400/80">
                巡检间隔: 10,000 shots | 加密检查疲劳裂纹
              </span>
            </div>
          </div>
        )}
      </div>

      <div
        className={`rounded-lg p-4 transition-all duration-500 ${
          isWearOut
            ? "border border-rose-500 bg-rose-950/20 opacity-100 shadow-[0_0_20px_rgba(225,29,72,0.3)]"
            : "pointer-events-none border border-slate-800 bg-slate-900/20 opacity-50"
        }`}
      >
        <div className="mb-3 flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded ${isWearOut ? "bg-rose-900/50" : "bg-slate-800"}`}
          >
            <svg
              className={`h-3.5 w-3.5 ${isWearOut ? "text-rose-500" : "text-slate-600"}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <p
            className={`text-xs font-bold ${isWearOut ? "text-rose-400" : "text-slate-600"}`}
          >
            寿终大修 / End-of-Life Overhaul
          </p>
        </div>

        {isWearOut ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-rose-500">
              关键耗损预警 / CRITICAL WEAR-OUT IMMINENT
            </p>
            <p className="text-[11px] leading-relaxed text-rose-400/80">
              模具物理疲劳已超临界值，随时面临灾难性宕机风险。Weibull
              耗损模型预测失效概率正在指数级抬升，
              需要立即启动大修或重开模决策流。
            </p>
            <div className="mt-1 flex items-center gap-3 text-[10px] tabular-nums">
              <span className="text-rose-500/70">
                当前 shot: {currentShots.toLocaleString()}
              </span>
              <span className="text-rose-800">|</span>
              <span className="text-rose-500/70">
                剩余: {(maxLifespan - currentShots).toLocaleString()}
              </span>
              {isCalibrated && (
                <>
                  <span className="text-rose-800">|</span>
                  <span className="font-bold text-rose-400">
                    DEGRADED MAX: {maxLifespan.toLocaleString()}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded bg-rose-600 px-4 py-2.5 text-xs font-bold text-white transition-colors active:scale-[0.98] hover:bg-rose-500"
            >
              下达大修/重开模工单 (GENERATE EOL WORK ORDER)
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-600">EOL 协议待命中...</p>
            <p className="text-[11px] leading-relaxed text-slate-700">
              模具尚未进入耗损失效期。该控制面板将在注射次数超过{" "}
              {zone2End.toLocaleString()} 时自动激活。
            </p>
            <button
              type="button"
              disabled
              className="mt-3 w-full cursor-not-allowed rounded bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600"
            >
              下达大修/重开模工单 (GENERATE EOL WORK ORDER)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
