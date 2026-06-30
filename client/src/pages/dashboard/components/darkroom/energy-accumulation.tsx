import type { DarkroomTelemetry } from "./photometric"

export function EnergyAccumulation({ telemetry }: { telemetry: DarkroomTelemetry }) {
  return (
    <section className="bg-[#070c14]/40 backdrop-blur-3xl border border-white/[0.04] border-t border-cyan-400/20 shadow-2xl rounded-xl p-5 flex flex-col">
      <h3 className="text-[10px] text-slate-500 tracking-[0.2em] font-mono uppercase border-b border-white/5 pb-2 mb-4">
        {"// 区域光通累积 ENERGY ACCUMULATION"}
      </h3>

      <div className="flex-1 flex flex-col justify-center gap-7">
        {telemetry.energyZones.map((zone) => (
          <div key={zone.label} className="space-y-2.5">
            <div className="flex items-end justify-between">
              <span className="text-[10px] text-slate-400 tracking-widest flex items-baseline gap-2">
                {zone.label}
                <span className="text-[8px] text-slate-600 tracking-normal">
                  {zone.sub}
                </span>
              </span>
              <span className="tabular-nums">
                <span className="font-mono text-gray-200">{zone.lumens.toFixed(1)} lm</span>
                <span className="text-slate-600 mx-1">|</span>
                <span className="font-mono text-cyan-400">{zone.percent.toFixed(1)}%</span>
              </span>
            </div>

            <div className="h-[3px] bg-white/[0.03] w-full rounded-full mt-2">
              <div
                className="h-full bg-gradient-to-r from-cyan-900/50 to-cyan-400 shadow-[0_0_8px_rgba(0,243,255,0.6)] rounded-full relative"
                style={{ width: `${Math.max(zone.percent, 0.5)}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_#fff]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-white/5 pt-4">
        <p className="text-[10px] tracking-[0.15em] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>上射光通比 UPWARD FLUX RATIO</span>
          <span className="text-cyan-400 font-mono">
            {telemetry.upwardFluxRatio.toFixed(1)}%
          </span>
        </p>
      </div>
    </section>
  )
}
