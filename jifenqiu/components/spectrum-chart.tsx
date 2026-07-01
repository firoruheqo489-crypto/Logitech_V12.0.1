"use client"

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, ReferenceLine } from "recharts"
import { generateSpectrum, spectrumStats } from "@/lib/report-data"
import { glassPanel, subTitle } from "@/lib/ui"

const data = generateSpectrum()

function Stat({ label, sub, value, unit }: { label: string; sub: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-base font-semibold text-gray-200 tabular-nums">{value}</span>
        <span className="text-[9px] text-slate-500">{unit}</span>
      </div>
      <span className="text-[9px] text-slate-600">{sub}</span>
    </div>
  )
}

export function SpectrumChart() {
  return (
    <div className={`${glassPanel} p-5`}>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className={subTitle}>// SPECTRAL POWER DISTRIBUTION</h3>
        <span className="text-[10px] tracking-wide text-slate-600">光谱功率分布 · 380–780nm</span>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="spectrumFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="wavelength"
              ticks={[400, 450, 500, 550, 600, 650, 700, 750]}
              tick={{ fill: "#71717a", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <ReferenceLine x={451} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="power"
              stroke="#22d3ee"
              strokeWidth={2}
              fill="url(#spectrumFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 border-t border-white/[0.04] pt-4">
        <Stat label="λp" sub="峰值波长" value={spectrumStats.peakWavelength} unit="nm" />
        <Stat label="λd" sub="主波长" value={spectrumStats.dominantWavelength} unit="nm" />
        <Stat label="FWHM" sub="半带宽" value={spectrumStats.halfBandwidth} unit="nm" />
        <Stat label="Purity" sub="颜色纯度" value={spectrumStats.purity} unit="%" />
      </div>
    </div>
  )
}
