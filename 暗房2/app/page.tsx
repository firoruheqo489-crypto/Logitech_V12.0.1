import { SpatialIntensity } from "@/components/spatial-intensity"
import { EnergyAccumulation } from "@/components/energy-accumulation"
import { ConicalAttenuation } from "@/components/conical-attenuation"
import { fixture } from "@/lib/photometric"

export default function Page() {
  return (
    <main className="min-h-screen bg-[#030508] text-slate-200 px-4 py-8 md:px-10 md:py-12">
      <div className="mx-auto max-w-6xl">
        {/* Telemetry header */}
        <header className="mb-8 flex flex-col gap-3 border-b border-white/5 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] tracking-[0.3em] font-mono text-cyan-400/80 uppercase mb-2">
              {"// AXIOM SIGMA · 暗室光度遥测 DARKROOM TELEMETRY"}
            </p>
            <h1 className="text-lg md:text-xl font-mono font-semibold tracking-tight text-slate-100 text-balance">
              {fixture.name}
            </h1>
            <p className="mt-1 text-[10px] font-mono text-slate-500 tracking-wide">
              {fixture.machine} · {fixture.filename}
            </p>
          </div>

          <dl className="flex gap-6 font-mono">
            <HeaderStat label="光通量 FLUX" value={`${fixture.ratedFlux.toFixed(1)} lm`} />
            <HeaderStat label="功率 POWER" value={`${fixture.testedPower.toFixed(2)} W`} />
            <HeaderStat label="光效 EFFICACY" value={`${fixture.efficacy.toFixed(1)} lm/W`} />
          </dl>
        </header>

        {/* Three precision columns */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-stretch">
          <SpatialIntensity />
          <EnergyAccumulation />
          <ConicalAttenuation />
        </div>

        <footer className="mt-8 flex items-center justify-between border-t border-white/5 pt-4">
          <span className="text-[9px] font-mono text-slate-600 tracking-[0.2em] uppercase">
            测试日期 TEST DATE {fixture.testDate}
          </span>
          <span className="text-[9px] font-mono text-slate-600 tracking-[0.2em] uppercase">
            IES 投光灯报告 FLOOD REPORT
          </span>
        </footer>
      </div>
    </main>
  )
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <dt className="text-[9px] tracking-[0.2em] text-slate-600 uppercase">{label}</dt>
      <dd className="mt-1 text-xs text-cyan-400">{value}</dd>
    </div>
  )
}
