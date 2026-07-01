import { Activity, Radio, Zap } from "lucide-react"
import { GlassCard } from "@/components/dashboard/glass-card"
import { Oscilloscope } from "@/components/dashboard/oscilloscope"
import { FftSpectrum } from "@/components/dashboard/fft-spectrum"
import {
  AlphaMetricCard,
  MarginAuditCard,
  SecondaryStatsCard,
} from "@/components/dashboard/data-panel"
import {
  ALPHA_METRICS,
  generateMarginAudit,
  generateSpectrum,
  generateWaveform,
  SECONDARY_STATS,
} from "@/lib/power-data"

export default function Page() {
  const waveform = generateWaveform()
  const spectrum = generateSpectrum()
  const margins = generateMarginAudit(spectrum)

  return (
    <main className="min-h-screen bg-[#000000] px-4 py-6 text-slate-200 md:px-8 md:py-8">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]">
            <Zap className="h-5 w-5 text-[#00F3FF]" style={{ filter: "drop-shadow(0 0 6px rgba(0,243,255,0.7))" }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-100">
              Obsidian Power Analyzer
            </h1>
            <p className="text-xs text-slate-500">Phase A · Feeder 03 · Real-time harmonics audit</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/[0.03] px-4 py-2 backdrop-blur-xl border border-white/[0.06]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00F3FF] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00F3FF]" />
          </span>
          <span className="text-xs font-medium text-slate-300">Live · 50.01 Hz</span>
        </div>
      </header>

      {/* Asymmetric 12-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Core — charts dominate */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#00F3FF]" />
                <h2 className="text-sm font-semibold text-slate-200">V/I Phase Oscilloscope</h2>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-0.5 w-4 rounded bg-[#475569]" /> Voltage
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span
                    className="h-0.5 w-4 rounded bg-[#00F3FF]"
                    style={{ boxShadow: "0 0 8px rgba(0,243,255,0.9)" }}
                  />
                  Current
                </span>
              </div>
            </div>
            <Oscilloscope data={waveform} />
          </GlassCard>

          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-[#00F3FF]" />
                <h2 className="text-sm font-semibold text-slate-200">FFT Spectrum Array</h2>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-[#FF003C]" />
                IEC Limit
              </span>
            </div>
            <FftSpectrum data={spectrum} />
          </GlassCard>
        </div>

        {/* Right Slave — data & alerts */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          <AlphaMetricCard metrics={ALPHA_METRICS} />
          <SecondaryStatsCard stats={SECONDARY_STATS} />
          <MarginAuditCard rows={margins} />
        </div>
      </div>
    </main>
  )
}
