"use client"

import {
  CATEGORY_META,
  GEO,
  RISK_META,
  TARGET,
  VALIDATION_META,
  VIEW,
  px,
  py,
  ribGeometry,
  type Cause,
  type MatrixData,
} from "@/lib/ishikawa-data"

interface CanvasProps {
  matrix: MatrixData
  selectedId: string | null
  activeDimension: string | null
  onSelectCause: (cause: Cause, catId: string) => void
  onResetView: () => void
}

/** classify each category against the current optical lockdown */
function dimensionState(catId: string, activeDimension: string | null) {
  if (!activeDimension) return "idle" as const
  return activeDimension === catId ? ("active" as const) : ("muted" as const)
}

export function HolographicCanvas({
  matrix,
  selectedId,
  activeDimension,
  onSelectCause,
  onResetView,
}: CanvasProps) {
  return (
    <div
      className="relative h-full w-full"
      onClick={onResetView}
      role="presentation"
    >
      {/* radial core glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 62% 50%, oklch(0.72 0.13 200 / 0.10), transparent 70%)",
        }}
      />
      <div aria-hidden className="holo-grid pointer-events-none absolute inset-0" />

      {/* coordinate-locked stage: SVG + HTML overlay share the same aspect box */}
      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-6">
        <div
          className="relative w-full"
          style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}`, maxHeight: "100%" }}
        >
          <Wires
            matrix={matrix}
            selectedId={selectedId}
            activeDimension={activeDimension}
          />
          <Overlay
            matrix={matrix}
            selectedId={selectedId}
            activeDimension={activeDimension}
            onSelectCause={onSelectCause}
          />
        </div>
      </div>
    </div>
  )
}

/* ── SVG layer: spine, ribs, anchor dots, leader stubs ─────────── */
function Wires({
  matrix,
  selectedId,
  activeDimension,
}: {
  matrix: MatrixData
  selectedId: string | null
  activeDimension: string | null
}) {
  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="spine-glow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.72 0.13 200)" stopOpacity="0" />
          <stop offset="35%" stopColor="oklch(0.78 0.13 200)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="oklch(0.85 0.14 200)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="rib-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.13 200)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="oklch(0.72 0.13 200)" stopOpacity="0.15" />
        </linearGradient>
        <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="intense-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* central spine */}
      <line
        x1={GEO.SPINE_START}
        y1={GEO.SPINE_Y}
        x2={GEO.TARGET_X - 36}
        y2={GEO.SPINE_Y}
        stroke="url(#spine-glow)"
        strokeWidth={1.5}
        filter="url(#soft-glow)"
        style={{
          opacity: activeDimension ? 0.4 : 1,
          transition: "opacity 0.5s ease",
        }}
      />
      {/* flowing data pulses along the spine */}
      <line
        x1={GEO.SPINE_START}
        y1={GEO.SPINE_Y}
        x2={GEO.TARGET_X - 36}
        y2={GEO.SPINE_Y}
        stroke="oklch(0.92 0.06 200)"
        strokeWidth={1.5}
        strokeDasharray="2 18"
        strokeLinecap="round"
        opacity={activeDimension ? 0.3 : 0.8}
        style={{ animation: "flow-dash 1.6s linear infinite", transition: "opacity 0.5s ease" }}
      />

      {CATEGORY_META.map((cat) => {
        const causes = matrix[cat.id] ?? []
        const g = ribGeometry(cat, causes.length)
        const state = dimensionState(cat.id, activeDimension)
        const isActive = state === "active"
        const isMuted = state === "muted"
        return (
          <g
            key={cat.id}
            style={{
              opacity: isMuted ? 0.1 : 1,
              filter: isMuted ? "grayscale(1)" : undefined,
              transition: "opacity 0.5s ease, filter 0.5s ease",
            }}
          >
            {/* rib */}
            <path
              d={g.d}
              stroke={isActive ? "oklch(0.85 0.15 200)" : "url(#rib-glow)"}
              strokeWidth={isActive ? 2 : 1.25}
              filter={isActive ? "url(#intense-glow)" : "url(#soft-glow)"}
              style={{ transition: "stroke-width 0.5s ease" }}
            />
            {/* attach node where the rib meets the spine */}
            <circle
              cx={g.attach.x}
              cy={g.attach.y}
              r={isActive ? 4 : 3}
              fill="oklch(0.9 0.08 200)"
              filter={isActive ? "url(#intense-glow)" : "url(#soft-glow)"}
            />

            {causes.map((cause, i) => {
              const a = g.causeAnchors[i]
              const l = g.leaderEnds[i]
              if (!a || !l) return null
              const vMeta = VALIDATION_META[cause.validation]
              const isSel = selectedId === cause.id
              const dotColor = isActive ? "oklch(0.85 0.15 200)" : vMeta.color
              return (
                <g key={cause.id}>
                  {/* dashed leader stub */}
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={l.x}
                    y2={l.y}
                    stroke={dotColor}
                    strokeWidth={1}
                    strokeDasharray="1.5 2.5"
                    opacity={0.7}
                  />
                  {/* glowing micro-dot anchor */}
                  <circle
                    cx={a.x}
                    cy={a.y}
                    r={isSel ? 4.5 : 3}
                    fill={dotColor}
                    filter={isActive ? "url(#intense-glow)" : "url(#soft-glow)"}
                    style={
                      isSel || isActive
                        ? undefined
                        : {
                            transformOrigin: `${a.x}px ${a.y}px`,
                            animation: `pulse-node ${2 + i * 0.4}s ease-in-out infinite`,
                          }
                    }
                  />
                  {isSel && (
                    <circle
                      cx={a.x}
                      cy={a.y}
                      r={9}
                      fill="none"
                      stroke={dotColor}
                      strokeWidth={0.75}
                      opacity={0.6}
                    />
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

/* ── HTML overlay: weightless text nodes + headers + target ────── */
function Overlay({
  matrix,
  selectedId,
  activeDimension,
  onSelectCause,
}: {
  matrix: MatrixData
  selectedId: string | null
  activeDimension: string | null
  onSelectCause: (cause: Cause, catId: string) => void
}) {
  return (
    <div className="absolute inset-0">
      {CATEGORY_META.map((cat) => {
        const causes = matrix[cat.id] ?? []
        const g = ribGeometry(cat, causes.length)
        const state = dimensionState(cat.id, activeDimension)
        const isActive = state === "active"
        const isMuted = state === "muted"
        return (
          /*
           * Coordinate-locked wrapper. This div ALWAYS fills the stage
           * (absolute inset-0). Because applying a CSS `filter` turns an
           * element into the containing block for its absolutely-positioned
           * descendants, the wrapper must already span the exact same box as
           * the overlay — otherwise the child left/top values would collapse
           * to the wrapper's origin. Filling inset-0 guarantees ZERO layout
           * shift when grayscale is toggled. Only optical props change.
           */
          <div
            key={cat.id}
            className={`absolute inset-0 transition-all duration-500 ${
              isMuted
                ? "z-0 opacity-10 grayscale"
                : isActive
                  ? "z-20 opacity-100"
                  : "z-10 opacity-100"
            }`}
            style={{ pointerEvents: "none" }}
          >
            {/* category header at the rib tip */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 select-none text-center transition-all duration-500"
              style={{ left: px(g.end.x), top: py(g.end.y) }}
            >
              <div
                className={`font-mono text-[9px] uppercase tracking-[0.32em] transition-colors duration-500 ${
                  isActive ? "text-cyan-300" : "text-cyan-300/60"
                }`}
              >
                {cat.code}
              </div>
              <div
                className={`font-sans text-base font-medium tracking-wide transition-colors duration-500 ${
                  isActive ? "text-cyan-50" : "text-cyan-50/90"
                }`}
                style={
                  isActive
                    ? { textShadow: "0 0 15px rgba(0,243,255,0.8)" }
                    : undefined
                }
              >
                {cat.label}
              </div>
              <div className="mx-auto mt-1 h-px w-8 bg-cyan-300/30" />
            </div>

            {/* weightless cause nodes */}
            {causes.map((cause, i) => {
              const l = g.leaderEnds[i]
              if (!l) return null
              const meta = RISK_META[cause.risk]
              const vMeta = VALIDATION_META[cause.validation]
              const isSel = selectedId === cause.id
              const accent = isActive ? "oklch(0.85 0.15 200)" : vMeta.color
              return (
                <button
                  key={cause.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectCause(cause, cat.id)
                  }}
                  className="group absolute flex max-w-[190px] -translate-y-1/2 flex-col items-end gap-0.5 rounded-md py-1 pl-2 pr-2.5 text-right outline-none transition-all duration-300"
                  style={{
                    left: px(l.x),
                    top: py(l.y),
                    transform: "translate(-100%, -50%)",
                    /* re-enable hit-testing only on live branches */
                    pointerEvents: isMuted ? "none" : "auto",
                    backgroundColor: isSel
                      ? "color-mix(in oklch, var(--cyan) 8%, transparent)"
                      : "rgba(255,255,255,0.02)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    borderLeft: `2px solid ${accent}`,
                    boxShadow: isSel ? `0 0 18px -4px ${accent}` : "none",
                  }}
                >
                  {/* validation lifecycle indicator */}
                  <span
                    className="flex items-center gap-1.5 font-mono text-[8px] leading-none tracking-[0.18em]"
                    style={{
                      color: vMeta.color,
                      textShadow: vMeta.glow
                        ? `0 0 8px ${vMeta.color}`
                        : undefined,
                    }}
                  >
                    <span>
                      [{vMeta.sigil}] {vMeta.label}
                    </span>
                    <span
                      className="inline-block size-1 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                  </span>
                  {/* cause hypothesis label */}
                  <span
                    className={`font-sans text-[12px] leading-tight tracking-wide transition-colors ${
                      vMeta.strike ? "line-through decoration-1" : ""
                    } ${
                      isSel
                        ? "text-cyan-50"
                        : `${vMeta.text} group-hover:text-cyan-50`
                    }`}
                  >
                    {cause.label}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}

      {/* TARGET reticle */}
      <TargetReticle />
    </div>
  )
}

function TargetReticle() {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: px(GEO.TARGET_X), top: py(GEO.SPINE_Y) }}
    >
      <div className="relative flex items-center justify-center">
        {/* rotating outer ticks */}
        <div
          aria-hidden
          className="absolute size-[150px] rounded-full border border-dashed border-red-500/20"
          style={{ animation: "spin-slow 24s linear infinite" }}
        />
        <div
          aria-hidden
          className="absolute size-[120px] rounded-full border border-red-500/15"
          style={{ animation: "spin-slow 16s linear infinite reverse" }}
        />
        {/* reticle crosshair */}
        <div aria-hidden className="absolute h-px w-[170px] bg-red-500/20" />
        <div aria-hidden className="absolute h-[170px] w-px bg-red-500/20" />

        {/* core glass panel */}
        <div
          className="relative overflow-hidden rounded-lg border border-red-500/30 px-5 py-3.5 text-center"
          style={{
            backgroundColor: "rgba(20,4,6,0.45)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow:
              "0 0 50px -12px oklch(0.6 0.2 22 / 0.6), inset 0 0 24px -10px oklch(0.7 0.2 22 / 0.5)",
          }}
        >
          {/* internal scanning line */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-8"
            style={{
              background:
                "linear-gradient(to bottom, oklch(0.7 0.2 22 / 0.35), transparent)",
              animation: "reticle-scan 3.6s ease-in-out infinite",
            }}
          />
          <div className="flex items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-red-400/80">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-red-500" />
            {TARGET.code}
          </div>
          <div className="mt-1 whitespace-nowrap font-sans text-lg font-semibold tracking-wide text-red-50">
            {TARGET.label}
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-3 font-mono text-[10px]">
            <span className="text-red-200/50">{TARGET.metric}</span>
            <span className="text-red-400">{TARGET.delta}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
