import { energyZones, fixture } from "@/lib/photometric"

export function EnergyAccumulation() {
  return (
    <section className="bg-white/[0.01] backdrop-blur-2xl ring-1 ring-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.8),_inset_0_1px_0_rgba(255,255,255,0.02)] rounded-lg p-6 flex flex-col">
      <h3 className="text-[10px] tracking-[0.2em] font-bold text-slate-400 font-mono uppercase mb-6 border-b border-white/5 pb-2">
        {"// 区域光通累积 ENERGY ACCUMULATION"}
      </h3>

      <div className="flex-1 flex flex-col justify-center gap-7">
        {energyZones.map((zone) => (
          <div key={zone.label} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono tracking-wide">
                {zone.label}
              </span>
              <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                {zone.lumens.toFixed(1)} lm{" "}
                <span className="text-cyan-400">{zone.percent.toFixed(1)}%</span>
              </span>
            </div>

            {/* micro-machined progress track */}
            <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden flex items-center">
              <div
                className="h-[2px] bg-cyan-400 drop-shadow-[0_0_5px_rgba(0,243,255,0.8)] flex items-center justify-end"
                style={{ width: `${Math.max(zone.percent, 0.5)}%` }}
              >
                {/* glowing hardware dial dot */}
                <span className="block h-[5px] w-[5px] -mr-[1px] rounded-full bg-cyan-300 shadow-[0_0_6px_2px_rgba(0,243,255,0.9)]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-white/5 pt-4">
        <p className="text-[10px] tracking-[0.15em] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>上射光通比 UPWARD FLUX RATIO</span>
          <span className="text-cyan-400 font-mono">
            {fixture.upwardFluxRatio.toFixed(1)}%
          </span>
        </p>
      </div>
    </section>
  )
}
