import { traceStyles } from "@/lib/batch-data"

const W = 320
const H = 180
const MID = H / 2

// Build a sine-wave path string across the full width.
function sinePath(amplitude: number, freq: number, phase: number) {
  const pts: string[] = []
  for (let x = 0; x <= W; x += 2) {
    const y = MID - amplitude * Math.sin((x / W) * freq * Math.PI * 2 + phase)
    pts.push(`${x === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return pts.join(" ")
}

// Per-trace wave config. S4 (anomaly) gets higher amplitude + irregular freq.
const waves = [
  { amplitude: 34, freq: 3, phase: 0 },
  { amplitude: 30, freq: 3, phase: 0.6 },
  { amplitude: 28, freq: 3, phase: 1.2 },
  { amplitude: 58, freq: 2.4, phase: 0.3 },
]

// Per-trace glow filter for the live light-trail effect.
function glowFor(t: (typeof traceStyles)[number]) {
  if (t.isAnomaly) return "drop-shadow(0 0 12px rgba(255,0,60,0.8))"
  if (t.id === "S1") return "drop-shadow(0 0 12px rgba(0,243,255,0.8))"
  return "none"
}

export function Oscilloscope() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-t border-white/[0.04] border-t-cyan-400/20 bg-[#070c14]/30 p-6 shadow-2xl backdrop-blur-3xl">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.2em] text-[#00F3FF]">
        {"// TEMPORAL WAVEFORM OVERLAY — MASTER CORE // 时序波形叠加 — 主核"}
      </h2>

      <div className="relative flex min-h-[400px] flex-1 flex-col">
        {/* floating legend, no background box */}
        <div className="absolute right-1 top-1 z-10 flex flex-col gap-1.5">
          {traceStyles.map((t) => (
            <div key={t.id} className="flex items-center justify-end gap-1.5">
              <span className="font-mono text-[8px] tracking-wider text-slate-500">{t.id}</span>
              <span
                className={`h-[2px] w-5 ${t.swatch} ${
                  t.isAnomaly ? "shadow-[0_0_8px_rgba(255,0,60,0.8)]" : ""
                }`}
              />
            </div>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full flex-1"
          role="img"
          aria-label="Oscilloscope overlay of four temporal waveforms; sample S4 shows anomalous high-amplitude signal"
        >
          {/* fine, faint background grid */}
          <g className="stroke-white/[0.02]" strokeWidth={0.5}>
            {Array.from({ length: 21 }).map((_, i) => (
              <line key={`v${i}`} x1={(W / 20) * i} y1={0} x2={(W / 20) * i} y2={H} />
            ))}
            {Array.from({ length: 13 }).map((_, i) => (
              <line key={`h${i}`} x1={0} y1={(H / 12) * i} x2={W} y2={(H / 12) * i} />
            ))}
          </g>
          {/* center baseline */}
          <line x1={0} y1={MID} x2={W} y2={MID} className="stroke-cyan-500/15" strokeWidth={0.5} />

          {/* overlapping sine waves */}
          {traceStyles.map((t, i) => {
            const w = waves[i]
            return (
              <path
                key={t.id}
                d={sinePath(w.amplitude, w.freq, w.phase)}
                fill="none"
                className={t.className}
                strokeWidth={t.strokeWidth}
                strokeDasharray={t.dash}
                strokeLinecap="round"
                style={{ filter: glowFor(t) }}
              />
            )
          })}
        </svg>
      </div>

      <p className="mt-4 font-mono text-[9px] tracking-wider text-slate-600">
        OVERLAY: 4 TRACES 叠加4路 // ALIGNED @ t0 对齐于t0 // SWEEP 20ms/div 扫描
      </p>
    </div>
  )
}
