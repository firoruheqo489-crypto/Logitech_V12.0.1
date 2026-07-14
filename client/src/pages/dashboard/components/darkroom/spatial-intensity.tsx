import { formatDarkroomNumber, intensityAt, type DarkroomTelemetry } from "./photometric"

const SIZE = 360
const CX = SIZE / 2
const CY = SIZE / 2
const R = 146

function maxPlaneCandela(telemetry: DarkroomTelemetry): number {
  return Math.max(
    telemetry.maxCandela ?? 0,
    ...telemetry.candelaPlane.map((sample) => sample.cd),
    0,
  )
}

function buildCurvePath(telemetry: DarkroomTelemetry): string {
  const maxCandela = maxPlaneCandela(telemetry)
  if (maxCandela <= 0) return ""

  const pts: string[] = []
  for (let a = -90; a <= 90; a += 1.5) {
    const frac = intensityAt(a, telemetry) / maxCandela
    const r = Math.max(0, Math.min(1, frac)) * R
    const rad = (a * Math.PI) / 180
    const x = CX + r * Math.sin(rad)
    const y = CY + r * Math.cos(rad)
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return "M" + pts.map((p, i) => (i === 0 ? p : "L" + p)).join(" ")
}

function sourceLabel(source: DarkroomTelemetry["candelaSource"]) {
  if (source === "pdf") return "PDF Candela"
  if (source === "reconstructed") return "参考重建"
  return "缺失"
}

const RINGS = [0.2, 0.4, 0.6, 0.8, 1]
const SPOKES = [-90, -60, -30, 0, 30, 60, 90]

export function SpatialIntensity({ telemetry }: { telemetry: DarkroomTelemetry }) {
  const curve = buildCurvePath(telemetry)
  const maxCandela = maxPlaneCandela(telemetry)

  return (
    <section className="flex flex-col border-b border-white/[0.035] p-6 xl:border-b-0">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/[0.035] pb-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-100">空间光强分布</h3>
          <p className="mt-1 text-xs text-slate-500">Spatial intensity profile</p>
        </div>
        <span
          className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium ${
            telemetry.candelaSource === "pdf"
              ? "bg-cyan-400/[0.08] text-cyan-200"
              : "bg-amber-400/[0.08] text-amber-200"
          }`}
        >
          {sourceLabel(telemetry.candelaSource)}
        </span>
      </div>

      <div className="relative flex h-[360px] flex-none items-center justify-center">
        {curve ? (
          <svg
            viewBox={`0 112 ${SIZE} 248`}
            className="h-auto w-full max-w-[430px]"
            role="img"
            aria-label="Polar light intensity distribution curve"
          >
            <defs>
              <radialGradient id="darkroom-candela-fill" cx="50%" cy="62%" r="52%">
                <stop offset="0%" stopColor="rgba(103,232,249,0.34)" />
                <stop offset="65%" stopColor="rgba(34,211,238,0.14)" />
                <stop offset="100%" stopColor="rgba(34,211,238,0.03)" />
              </radialGradient>
            </defs>

            {RINGS.map((f) => (
              <circle
                key={f}
                cx={CX}
                cy={CY}
                r={R * f}
                fill="none"
                stroke="rgba(148,163,184,0.12)"
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
                  stroke="rgba(148,163,184,0.12)"
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
                  fill="rgba(148,163,184,0.72)"
                  fontSize={9}
                  fontFamily="ui-sans-serif, system-ui"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {a}°
                </text>
              )
            })}

            <line x1={CX} y1={CY} x2={CX} y2={CY + R + 8} stroke="rgba(103,232,249,0.4)" strokeWidth={1.5} />
            <circle cx={CX} cy={CY} r={3.5} fill="#67E8F9" />

            <path
              d={curve}
              fill="url(#darkroom-candela-fill)"
              stroke="#67E8F9"
              strokeWidth={2.4}
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 14px rgba(103,232,249,0.58))" }}
            />
            <text
              x={CX}
              y={CY + R + 34}
              fill="rgba(226,232,240,0.9)"
              fontSize={13}
              fontFamily="ui-sans-serif, system-ui"
              textAnchor="middle"
            >
              主峰 {formatDarkroomNumber(maxCandela, 2, "cd")}
            </text>
          </svg>
        ) : (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-white/10 px-6 text-center text-xs text-slate-500">
            未解析到 Candela Tabulation 或最大光强，暂不绘制配光曲线。
          </div>
        )}
      </div>

      <div className="mt-5 grid border-t border-white/[0.035] pt-2">
        <div className="flex min-h-[42px] items-center justify-between gap-4 border-b border-white/[0.03] px-1 py-2.5">
          <p className="shrink-0 text-xs font-medium text-slate-500">Beam angle</p>
          <p className="whitespace-nowrap text-right font-mono text-sm text-cyan-200">
            H {formatDarkroomNumber(telemetry.beamAngle.h, 1, "°")} / V {formatDarkroomNumber(telemetry.beamAngle.v, 1, "°")}
          </p>
        </div>
        <div className="flex min-h-[42px] items-center justify-between gap-4 border-b border-white/[0.03] px-1 py-2.5">
          <p className="shrink-0 text-xs font-medium text-slate-500">Max candela</p>
          <p className="whitespace-nowrap text-right font-mono text-sm text-cyan-200">
            {formatDarkroomNumber(telemetry.maxCandela, 2, "cd")}
          </p>
        </div>
        <div className="flex min-h-[42px] items-center justify-between gap-4 px-1 py-2.5">
          <p className="shrink-0 text-xs font-medium text-slate-500">Peak angle</p>
          <p className="whitespace-nowrap text-right font-mono text-sm text-cyan-200">
            C {formatDarkroomNumber(telemetry.maxCandelaAngle.b, 1, "°")} / γ {formatDarkroomNumber(telemetry.maxCandelaAngle.beta, 1, "°")}
          </p>
        </div>
      </div>
    </section>
  )
}
