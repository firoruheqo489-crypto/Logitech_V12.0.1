import { SummaryBanner } from "@/components/summary-banner"
import { SpectrumChart } from "@/components/spectrum-chart"
import { CieDiagram } from "@/components/cie-diagram"
import { TelemetryVector } from "@/components/telemetry-vector"
import { electricalInput, luminousOutput, colorQuality } from "@/lib/report-data"

export default function Page() {
  return (
    <main className="min-h-screen bg-[#020406] bg-[radial-gradient(circle_at_50%_20%,_rgba(0,243,255,0.06),_transparent_50%)] px-6 py-8 text-zinc-50 md:px-10 lg:px-14">
      <div className="mx-auto w-full max-w-7xl">
        {/* STEP 3 — 数据完整性与检测状态横幅 */}
        <SummaryBanner />

        {/* STEP 1 — 上层：物理证据 (光谱 + 色品) 50/50 */}
        <div className="mb-6 grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
          <SpectrumChart />
          <CieDiagram />
        </div>

        {/* STEP 2 — 下层：定量矩阵 (3 路遥测机架) */}
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
          <TelemetryVector title="// ELECTRICAL INPUT TELEMETRY" fields={electricalInput} />
          <TelemetryVector title="// LUMINOUS OUTPUT TELEMETRY" fields={luminousOutput} />
          <TelemetryVector title="// COLOR QUALITY TELEMETRY" fields={colorQuality} />
        </div>

        <footer className="mt-8 flex items-center justify-between border-t border-white/[0.04] pt-4">
          <span className="font-mono text-[10px] tracking-widest text-slate-600">
            INTEGRATING SPHERE DIAGNOSTIC WORKSPACE · v1
          </span>
          <span className="font-mono text-[10px] tracking-widest text-slate-600">
            CIE 1931 · IES TM-30 · CIE 13.3 Ra
          </span>
        </footer>
      </div>
    </main>
  )
}
