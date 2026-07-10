import type { DarkroomTelemetry } from "./photometric"

export function EnergyAccumulation({ telemetry }: { telemetry: DarkroomTelemetry }) {
  return (
    <section className="flex flex-col rounded-xl border border-white/[0.04] border-t border-cyan-400/20 bg-[#070c14]/40 p-5 shadow-2xl backdrop-blur-3xl">
      <h3 className="mb-4 border-b border-white/5 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {"// 区域光通累积 ENERGY ACCUMULATION"}
      </h3>

      <div className="flex flex-1 flex-col justify-center gap-7">
        {telemetry.energyZones.map((zone) => (
          <div key={zone.label} className="space-y-2.5">
            <div className="flex items-end justify-between">
              <span className="flex items-baseline gap-2 text-[10px] tracking-widest text-slate-400">
                {zone.label}
                <span className="text-[8px] tracking-normal text-slate-600">{zone.sub}</span>
              </span>
              <span className="tabular-nums">
                <span className="font-mono text-gray-200">{zone.lumens.toFixed(1)} lm</span>
                <span className="mx-1 text-slate-600">|</span>
                <span className="font-mono text-cyan-400">{zone.percent.toFixed(1)}%</span>
              </span>
            </div>

            <div className="mt-2 h-[3px] w-full rounded-full bg-white/[0.03]">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-cyan-900/50 to-cyan-400 shadow-[0_0_8px_rgba(0,243,255,0.6)]"
                style={{ width: `${Math.min(100, Math.max(zone.percent, 0.5))}%` }}
              >
                <div className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_5px_#fff]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-white/5 pt-4">
        <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">
          <span>上射光通比 UPWARD FLUX RATIO</span>
          <span className="font-mono text-cyan-400">{telemetry.upwardFluxRatio.toFixed(1)}%</span>
        </p>
      </div>
    </section>
  )
}
