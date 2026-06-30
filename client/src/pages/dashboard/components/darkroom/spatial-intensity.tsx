import { intensityAt, type DarkroomTelemetry } from "./photometric"

const SIZE = 280
const CX = SIZE / 2
const CY = SIZE / 2
const R = 110

function buildCurvePath(telemetry: DarkroomTelemetry): string {
  const pts: string[] = []
  for (let a = -90; a <= 90; a += 1.5) {
    const frac = intensityAt(a, telemetry) / telemetry.maxCandela
    const r = frac * R
    const rad = (a * Math.PI) / 180
    const x = CX + r * Math.sin(rad)
    const y = CY + r * Math.cos(rad)
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return "M" + pts.map((p, i) => (i === 0 ? p : "L" + p)).join(" ")
}

const RINGS = [0.2, 0.4, 0.6, 0.8, 1]
const SPOKES = [-90, -60, -30, 0, 30, 60, 90]

export function SpatialIntensity({ telemetry }: { telemetry: DarkroomTelemetry }) {
  const curve = buildCurvePath(telemetry)

  return (
    <section className="bg-[#070c14]/40 backdrop-blur-3xl border border-white/[0.04] border-t border-cyan-400/20 shadow-2xl rounded-xl p-5 flex flex-col">
      <h3 className="text-[10px] text-slate-500 tracking-[0.2em] font-mono uppercase border-b border-white/5 pb-2 mb-4">
        {"// 空间光强分布 SPATIAL INTENSITY"}
      </h3>

      <div className="flex-1 flex items-center justify-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-[300px] h-auto"
          role="img"
          aria-label="Polar light intensity distribution curve"
        >
          {RINGS.map((f) => (
            <circle
              key={f}
              cx={CX}
              cy={CY}
              r={R * f}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          ))}

          {SPOKES.map((a) => {
            const rad = (a * Math.PI) / 180
            return (
              <line
                key={a}
                x1={CX}
                y1={CY}
                x2={CX + R * Math.sin(rad)}
                y2={CY + R * Math.cos(rad)}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
            )
          })}

          {SPOKES.map((a) => {
            const rad = (a * Math.PI) / 180
            const lr = R + 14
            return (
              <text
                key={`l-${a}`}
                x={CX + lr * Math.sin(rad)}
                y={CY + lr * Math.cos(rad)}
                fill="rgba(148,163,184,0.6)"
                fontSize={7}
                fontFamily="var(--font-mono)"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {a}°
              </text>
            )
          })}

          <circle cx={CX} cy={CY} r={2} fill="#00F3FF" />

          <path
            d={curve}
            fill="rgba(0,243,255,0.05)"
            stroke="#00F3FF"
            strokeWidth={1.5}
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 8px rgba(0,243,255,0.6))" }}
          />
        </svg>
      </div>

      <div className="mt-6 space-y-2 border-t border-white/5 pt-4">
        <p className="text-[10px] tracking-[0.15em] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>光束角 BEAM ANGLE</span>
          <span className="text-cyan-400 font-mono">
            H {telemetry.beamAngle.h}° / V {telemetry.beamAngle.v}°
          </span>
        </p>
        <p className="text-[10px] tracking-[0.15em] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>最大光强 MAX CANDELA</span>
          <span className="text-cyan-400 font-mono">
            {telemetry.maxCandela.toFixed(2)} cd
          </span>
        </p>
        <p className="text-[10px] tracking-[0.15em] font-mono text-slate-500 uppercase flex items-center justify-between">
          <span>峰值角度 MAX @ ANGLE</span>
          <span className="text-cyan-400 font-mono">
            B {telemetry.maxCandelaAngle.b}° / β {telemetry.maxCandelaAngle.beta}°
          </span>
        </p>
      </div>
    </section>
  )
}
