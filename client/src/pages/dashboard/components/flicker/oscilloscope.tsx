import { buildTraceStyles, type Sample } from "./batch-data"

const W = 320
const H = 180
const MID = H / 2

function sinePath(amplitude: number, freq: number, phase: number) {
  const pts: string[] = []
  for (let x = 0; x <= W; x += 2) {
    const y = MID - amplitude * Math.sin((x / W) * freq * Math.PI * 2 + phase)
    pts.push(`${x === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return pts.join(" ")
}

function waveFor(sample: Sample, index: number, maxFlicker: number) {
  const normalizedFlicker = maxFlicker > 0 ? sample.f / maxFlicker : 0
  return {
    amplitude: 18 + normalizedFlicker * 40,
    freq: sample.freq > 0 ? Math.max(1.5, sample.freq / 40) : 2 + index * 0.2,
    phase: index * 0.55,
  }
}

function glowFor(isAnomaly: boolean, id: string) {
  if (isAnomaly) return "drop-shadow(0 0 12px rgba(255,0,60,0.8))"
  if (id === "S1") return "drop-shadow(0 0 12px rgba(0,243,255,0.8))"
  return "none"
}

export function Oscilloscope({ samples }: { samples: Sample[] }) {
  const traceStyles = buildTraceStyles(samples)
  const maxFlicker = Math.max(...samples.map((sample) => sample.f), 0)

  return (
    <div className="flex h-full flex-col rounded-xl border border-t border-white/[0.04] border-t-cyan-400/20 bg-[#070c14]/30 p-6 shadow-2xl backdrop-blur-3xl">
      <h2 className="mb-4 text-xs font-semibold tracking-[0.12em] text-[#00F3FF]">时序波形叠加</h2>

      <div className="relative flex min-h-[400px] flex-1 flex-col">
        <div className="absolute right-1 top-1 z-10 flex flex-col gap-1.5">
          {traceStyles.map((trace) => (
            <div key={trace.id} className="flex items-center justify-end gap-1.5">
              <span className="font-mono text-[8px] tracking-wider text-slate-500">{trace.id}</span>
              <span
                className={`h-[2px] w-5 ${trace.swatch} ${
                  trace.isAnomaly ? "shadow-[0_0_8px_rgba(255,0,60,0.8)]" : ""
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
          aria-label="时序波形叠加图"
        >
          <g className="stroke-white/[0.02]" strokeWidth={0.5}>
            {Array.from({ length: 21 }).map((_, i) => (
              <line key={`v${i}`} x1={(W / 20) * i} y1={0} x2={(W / 20) * i} y2={H} />
            ))}
            {Array.from({ length: 13 }).map((_, i) => (
              <line key={`h${i}`} x1={0} y1={(H / 12) * i} x2={W} y2={(H / 12) * i} />
            ))}
          </g>
          <line x1={0} y1={MID} x2={W} y2={MID} className="stroke-cyan-500/15" strokeWidth={0.5} />

          {samples.map((sample, index) => {
            const wave = waveFor(sample, index, maxFlicker)
            const trace = traceStyles[index]
            return (
              <path
                key={sample.id}
                d={sinePath(wave.amplitude, wave.freq, wave.phase)}
                fill="none"
                className={trace.className}
                strokeWidth={trace.strokeWidth}
                strokeDasharray={trace.dash}
                strokeLinecap="round"
                style={{ filter: glowFor(Boolean(trace.isAnomaly), trace.id) }}
              />
            )
          })}
        </svg>
      </div>

      <p className="mt-4 text-[11px] tracking-wide text-slate-600">
        已叠加 {samples.length} 组波形，已按 t0 对齐，扫描基准为 20 毫秒每格。
      </p>
    </div>
  )
}
