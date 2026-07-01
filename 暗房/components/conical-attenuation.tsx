import { attenuationSlots } from "@/lib/photometric"

export function ConicalAttenuation() {
  return (
    <section className="bg-white/[0.01] backdrop-blur-2xl ring-1 ring-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.8),_inset_0_1px_0_rgba(255,255,255,0.02)] rounded-lg p-6 flex flex-col">
      <h3 className="text-[10px] tracking-[0.2em] font-bold text-slate-400 font-mono uppercase mb-6 border-b border-white/5 pb-2">
        {"// 锥形照度衰减 CONICAL ATTENUATION"}
      </h3>

      <div className="flex-1 flex flex-col justify-center">
        {attenuationSlots.map((slot) => (
          <div
            key={slot.height}
            className="flex items-center justify-between p-3 mb-3 bg-black/40 ring-1 ring-white/5 rounded-md shadow-inner"
          >
            <span className="bg-[#00F3FF]/10 text-cyan-400 text-[9px] px-2 py-1 rounded font-mono">
              {slot.height}
            </span>

            <span className="text-gray-200 text-sm font-mono font-semibold tabular-nums">
              {slot.centerLux.toFixed(2)} Lx
            </span>

            <span className="text-slate-500 text-[10px] font-sans">
              {"Ø: "}
              <span className="text-cyan-400 font-mono">
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
