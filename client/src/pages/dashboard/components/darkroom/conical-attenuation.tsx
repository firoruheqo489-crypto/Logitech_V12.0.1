import type { DarkroomTelemetry } from "./photometric"

export function ConicalAttenuation({ telemetry }: { telemetry: DarkroomTelemetry }) {
  return (
    <section className="bg-[#070c14]/40 backdrop-blur-3xl border border-white/[0.04] border-t border-cyan-400/20 shadow-2xl rounded-xl p-5 flex flex-col">
      <h3 className="text-[10px] text-slate-500 tracking-[0.2em] font-mono uppercase border-b border-white/5 pb-2 mb-4">
        {"// 锥形照度衰减 CONICAL ATTENUATION"}
      </h3>

      <div className="flex-1 flex flex-col justify-center gap-2">
        {telemetry.attenuationSlots.map((slot) => (
          <div
            key={slot.height}
            className="flex items-center justify-between py-2 px-3 mb-2 bg-black/40 ring-1 ring-white/5 rounded-md hover:ring-cyan-500/30 transition-all group"
          >
            <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-500/20">
              {slot.height}
            </span>

            <span className="text-sm font-mono font-semibold text-gray-100 group-hover:text-white tabular-nums">
              {slot.centerLux.toFixed(2)} <span className="text-[10px] text-slate-500">lx</span>
            </span>

            <span className="text-[10px] font-sans text-slate-500">
              {"Ø "}
              <span className="font-mono text-cyan-500/80">
                {slot.diameter.toFixed(2)}m
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-white/5 pt-4">
        <p className="text-[10px] tracking-[0.15em] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>安装高度 MOUNTING HEIGHT</span>
          <span className="text-cyan-400 font-mono">3.00 m</span>
        </p>
      </div>
    </section>
  )
}
