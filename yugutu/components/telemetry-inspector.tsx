"use client"

import { useState } from "react"
import {
  AlertTriangle,
  ChevronLeft,
  CircleSlash,
  HelpCircle,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react"
import {
  CATEGORY_META,
  RISK_META,
  VALIDATION_META,
  VALIDATION_ORDER,
  type CategoryMeta,
  type Cause,
  type MatrixData,
  type Validation,
} from "@/lib/ishikawa-data"

const V_ICON: Record<Validation, typeof HelpCircle> = {
  UNVERIFIED: HelpCircle,
  PROVEN: AlertTriangle,
  FALSE: CircleSlash,
  MITIGATED: ShieldCheck,
}

interface InspectorProps {
  matrix: MatrixData
  selected: { cause: Cause; category: CategoryMeta } | null
  activeDimension: string | null
  onToggleDimension: (catId: string) => void
  onSelectCause: (cause: Cause, catId: string) => void
  onAddNode: (catId: string, label: string) => void
  onUpdateNode: (catId: string, id: string, patch: Partial<Cause>) => void
  onSetStatus: (catId: string, id: string, validation: Validation) => void
  onDeleteNode: (catId: string, id: string) => void
  onClearSelection: () => void
  onExitDimension: () => void
}

export function TelemetryInspector({
  matrix,
  selected,
  activeDimension,
  onToggleDimension,
  onSelectCause,
  onAddNode,
  onUpdateNode,
  onSetStatus,
  onDeleteNode,
  onClearSelection,
  onExitDimension,
}: InspectorProps) {
  const activeCat =
    activeDimension != null
      ? CATEGORY_META.find((c) => c.id === activeDimension) ?? null
      : null

  const heading = selected
    ? "节点审讯矩阵"
    : activeCat
      ? "假说注入舱"
      : "遥测检视器"

  return (
    <aside
      className="flex h-full flex-col border-l border-white/5 px-6 py-6"
      style={{
        backgroundColor: "rgba(3,7,12,0.55)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
      }}
    >
      {/* masthead */}
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/60">
            <span className="inline-block size-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_2px_oklch(0.8_0.13_200/0.6)]" />
            Axiom Sigma
          </div>
          <h1 className="mt-1 font-sans text-sm font-medium tracking-wide text-cyan-50">
            {heading}
          </h1>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200/30">
          v2.4.1
        </span>
      </header>

      <div className="mt-5 h-px w-full bg-gradient-to-r from-cyan-400/30 via-cyan-400/5 to-transparent" />

      {selected ? (
        <Interrogation
          cause={selected.cause}
          category={selected.category}
          onUpdateNode={onUpdateNode}
          onSetStatus={onSetStatus}
          onDeleteNode={onDeleteNode}
          onBack={onClearSelection}
        />
      ) : activeCat ? (
        <DimensionEditor
          category={activeCat}
          causes={matrix[activeCat.id] ?? []}
          onAddNode={onAddNode}
          onSetStatus={onSetStatus}
          onDeleteNode={onDeleteNode}
          onSelectCause={onSelectCause}
          onExit={onExitDimension}
        />
      ) : (
        <GlobalView
          matrix={matrix}
          activeDimension={activeDimension}
          onToggleDimension={onToggleDimension}
        />
      )}
    </aside>
  )
}

/* ════════════════════════════════════════════════════════════════
   DEFAULT VIEW — global stats + 6M adjudication matrix
   ════════════════════════════════════════════════════════════════ */
function GlobalView({
  matrix,
  activeDimension,
  onToggleDimension,
}: {
  matrix: MatrixData
  activeDimension: string | null
  onToggleDimension: (catId: string) => void
}) {
  return (
    <>
      <section className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-md">
        {[
          { k: "OEE", v: "71.4%" },
          { k: "YIELD", v: "94.2%" },
          { k: "SIGMA", v: "3.41σ" },
        ].map((s) => (
          <div
            key={s.k}
            className="px-3 py-2.5"
            style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
          >
            <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-cyan-200/40">
              {s.k}
            </div>
            <div className="mt-1 font-mono text-sm text-cyan-50/90">{s.v}</div>
          </div>
        ))}
      </section>

      <section className="mt-7 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-200/35">
          <span>// 6M 裁决矩阵</span>
          <span className="text-cyan-200/25">点击进入注入舱</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {CATEGORY_META.map((cat) => {
            const causes = matrix[cat.id] ?? []
            const proven = causes.filter((c) => c.validation === "PROVEN").length
            const mitigated = causes.filter(
              (c) => c.validation === "MITIGATED",
            ).length
            const isActive = activeDimension === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onToggleDimension(cat.id)}
                className="group flex flex-col gap-2 rounded-md border p-3 text-left transition-all duration-500"
                style={{
                  borderColor: isActive
                    ? "oklch(0.82 0.13 200 / 0.6)"
                    : "rgba(255,255,255,0.06)",
                  backgroundColor: isActive
                    ? "color-mix(in oklch, var(--cyan) 10%, transparent)"
                    : "rgba(255,255,255,0.02)",
                  boxShadow: isActive
                    ? "0 0 20px -6px oklch(0.82 0.13 200 / 0.7)"
                    : "none",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-[9px] uppercase tracking-[0.2em] transition-colors ${
                      isActive ? "text-cyan-200" : "text-cyan-300/55"
                    }`}
                  >
                    {cat.code}
                  </span>
                  <span className="font-mono text-[9px] text-cyan-200/30">
                    {causes.length}
                  </span>
                </div>
                <span
                  className={`font-sans text-sm tracking-wide transition-colors ${
                    isActive ? "text-cyan-50" : "text-cyan-100/75"
                  }`}
                >
                  {cat.label}
                </span>
                <div className="flex items-center gap-2 font-mono text-[9px] tracking-wide">
                  <span className="text-red-400/80">{proven} 强相关</span>
                  <span className="text-cyan-300/70">{mitigated} 管控</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="mt-5 border-t border-white/5 pt-4">
        <p className="font-mono text-[9px] leading-relaxed tracking-wide text-cyan-200/30">
          // 选择任一 6M 维度进入假说注入舱，可新增 / 裁决 / 删除根因节点，
          左侧光路网络将实时同步。
        </p>
      </section>
    </>
  )
}

/* ════════════════════════════════════════════════════════════════
   DIMENSION EDITOR — the CRUD interrogation room for one 6M dimension
   ════════════════════════════════════════════════════════════════ */
function DimensionEditor({
  category,
  causes,
  onAddNode,
  onSetStatus,
  onDeleteNode,
  onSelectCause,
  onExit,
}: {
  category: CategoryMeta
  causes: Cause[]
  onAddNode: (catId: string, label: string) => void
  onSetStatus: (catId: string, id: string, validation: Validation) => void
  onDeleteNode: (catId: string, id: string) => void
  onSelectCause: (cause: Cause, catId: string) => void
  onExit: () => void
}) {
  const [draft, setDraft] = useState("")

  const inject = () => {
    if (!draft.trim()) return
    onAddNode(category.id, draft)
    setDraft("")
  }

  return (
    <div className="mt-5 flex min-h-0 flex-1 flex-col">
      {/* exit */}
      <button
        type="button"
        onClick={onExit}
        className="flex items-center gap-1 self-start font-mono text-[9px] uppercase tracking-[0.25em] text-cyan-300/45 transition-colors hover:text-cyan-200"
      >
        <ChevronLeft className="size-3" />
        退出注入舱
      </button>

      {/* dimension identity */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/60">
          {category.code}
        </span>
        <h2 className="font-sans text-lg font-medium tracking-wide text-cyan-50">
          {category.label}
        </h2>
        <span className="ml-auto font-mono text-[9px] text-cyan-200/35">
          {causes.length} 节点
        </span>
      </div>

      {/* ── INJECTION FORM (Create) ─────────────────────────────── */}
      <div className="mt-4">
        <label className="font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-200/40">
          // HYPOTHESIS INJECTION: {category.code}
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") inject()
            }}
            placeholder="Input new root cause hypothesis…"
            className="w-full rounded-sm border border-white/10 bg-[oklch(0.16_0.02_240)] px-2.5 py-2 font-mono text-xs text-cyan-300 placeholder:text-cyan-200/25 transition-colors focus:border-cyan-300/50 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={inject}
          disabled={!draft.trim()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-sm border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-all duration-200 disabled:opacity-40"
          style={{
            borderColor: "color-mix(in oklch, var(--cyan) 30%, transparent)",
            backgroundColor: "color-mix(in oklch, var(--cyan) 8%, transparent)",
            color: "var(--cyan)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--cyan)"
            e.currentTarget.style.boxShadow = "0 0 16px -4px var(--cyan)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor =
              "color-mix(in oklch, var(--cyan) 30%, transparent)"
            e.currentTarget.style.boxShadow = "none"
          }}
        >
          <Plus className="size-3" />
          INJECT NODE
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-200/35">
        <span>// ACTIVE PAYLOAD</span>
        <span className="text-cyan-200/25">点击文本审讯</span>
      </div>

      {/* ── PAYLOAD LIST (Read / Update / Delete) ───────────────── */}
      <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {causes.length === 0 && (
          <div className="rounded-md border border-dashed border-white/10 px-3 py-6 text-center font-mono text-[10px] tracking-wide text-cyan-200/30">
            暂无节点 · 注入首个根因假设
          </div>
        )}
        {causes.map((cause) => {
          const vMeta = VALIDATION_META[cause.validation]
          return (
            <div
              key={cause.id}
              className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-white/[0.02] p-2"
            >
              {/* text — click to open full interrogation */}
              <button
                type="button"
                onClick={() => onSelectCause(cause, category.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span
                  className={`block truncate font-sans text-[12px] tracking-wide transition-colors hover:text-cyan-50 ${
                    vMeta.strike ? "line-through decoration-1" : ""
                  } ${vMeta.text}`}
                >
                  {cause.label}
                </span>
                <span
                  className="font-mono text-[8px] uppercase tracking-[0.18em]"
                  style={{ color: vMeta.color }}
                >
                  [{vMeta.sigil}] {vMeta.label}
                </span>
              </button>

              {/* status toggles */}
              <div className="flex shrink-0 items-center gap-0.5">
                {VALIDATION_ORDER.map((v) => {
                  const m = VALIDATION_META[v]
                  const Icon = V_ICON[v]
                  const on = cause.validation === v
                  return (
                    <button
                      key={v}
                      type="button"
                      title={m.label}
                      onClick={() => onSetStatus(category.id, cause.id, v)}
                      className="grid size-6 place-items-center rounded-sm border transition-all duration-200"
                      style={{
                        borderColor: on
                          ? `color-mix(in oklch, ${m.color} 55%, transparent)`
                          : "transparent",
                        backgroundColor: on
                          ? `color-mix(in oklch, ${m.color} 14%, transparent)`
                          : "rgba(255,255,255,0.02)",
                      }}
                    >
                      <Icon
                        className="size-3"
                        style={{
                          color: on
                            ? m.color
                            : "oklch(0.7 0.02 220 / 0.45)",
                        }}
                      />
                    </button>
                  )
                })}
                {/* purge */}
                <button
                  type="button"
                  title="删除节点"
                  onClick={() => onDeleteNode(category.id, cause.id)}
                  className="ml-0.5 grid size-6 place-items-center rounded-sm border border-transparent text-red-400/50 transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   NODE INTERROGATION MATRIX — adjudicate a single hypothesis node
   ════════════════════════════════════════════════════════════════ */
function Interrogation({
  cause,
  category,
  onUpdateNode,
  onSetStatus,
  onDeleteNode,
  onBack,
}: {
  cause: Cause
  category: CategoryMeta
  onUpdateNode: (catId: string, id: string, patch: Partial<Cause>) => void
  onSetStatus: (catId: string, id: string, validation: Validation) => void
  onDeleteNode: (catId: string, id: string) => void
  onBack: () => void
}) {
  const meta = RISK_META[cause.risk]
  const vMeta = VALIDATION_META[cause.validation]
  const VIcon = V_ICON[cause.validation]

  return (
    <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
      {/* back */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.25em] text-cyan-300/45 transition-colors hover:text-cyan-200"
        >
          <ChevronLeft className="size-3" />
          返回 6M 矩阵
        </button>
        <button
          type="button"
          title="删除节点"
          onClick={() => onDeleteNode(category.id, cause.id)}
          className="flex items-center gap-1 rounded-sm border border-transparent px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-red-400/55 transition-all hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
        >
          <X className="size-3" />
          PURGE
        </button>
      </div>

      {/* node identity */}
      <div className="mt-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200/40">
        <span>{category.code}</span>
        <span className="text-cyan-200/20">/</span>
        <span>{category.label}</span>
      </div>

      {/* editable label */}
      <input
        value={cause.label}
        onChange={(e) =>
          onUpdateNode(category.id, cause.id, { label: e.target.value })
        }
        className="mt-2 w-full rounded-sm border border-transparent bg-transparent font-sans text-xl font-medium tracking-wide text-cyan-50 transition-colors hover:border-white/10 focus:border-cyan-300/40 focus:bg-white/[0.02] focus:px-2 focus:py-1 focus:outline-none"
      />

      {/* current adjudication banner */}
      <div
        className="mt-3 flex items-center gap-2 rounded-md border px-3 py-2 transition-colors"
        style={{
          borderColor: `color-mix(in oklch, ${vMeta.color} 35%, transparent)`,
          backgroundColor: `color-mix(in oklch, ${vMeta.color} 8%, transparent)`,
        }}
      >
        <VIcon
          className="size-4 shrink-0"
          style={{
            color: vMeta.color,
            filter: vMeta.glow ? `drop-shadow(0 0 6px ${vMeta.color})` : undefined,
          }}
        />
        <div className="flex flex-col">
          <span
            className="font-sans text-xs font-medium"
            style={{ color: vMeta.color }}
          >
            {vMeta.label}
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-cyan-200/35">
            {vMeta.en}
          </span>
        </div>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-cyan-200/45">
          <span
            className="inline-block size-1 rounded-full"
            style={{ backgroundColor: meta.color }}
          />
          风险 {meta.label}
        </span>
      </div>

      {/* contribution meter */}
      <div className="mt-6">
        <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200/40">
          <span>归因置信度</span>
          <span style={{ color: vMeta.color }}>
            {Math.round(cause.contribution * 100)}%
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${cause.contribution * 100}%`,
              backgroundColor: vMeta.color,
              boxShadow: `0 0 10px ${vMeta.color}`,
            }}
          />
        </div>
      </div>

      <p className="mt-5 font-sans text-[13px] leading-relaxed text-cyan-100/55">
        {cause.note}
      </p>

      {/* ── adjudication controls ─────────────────────────────── */}
      <div className="mt-6 border-t border-white/5 pt-5">
        <label className="font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-200/35">
          // 裁决状态
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {VALIDATION_ORDER.map((v) => {
            const m = VALIDATION_META[v]
            const Icon = V_ICON[v]
            const on = cause.validation === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => onSetStatus(category.id, cause.id, v)}
                className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-all duration-300"
                style={{
                  borderColor: on
                    ? `color-mix(in oklch, ${m.color} 55%, transparent)`
                    : "rgba(255,255,255,0.06)",
                  backgroundColor: on
                    ? `color-mix(in oklch, ${m.color} 12%, transparent)`
                    : "rgba(255,255,255,0.02)",
                  boxShadow: on ? `0 0 14px -5px ${m.color}` : "none",
                }}
              >
                <Icon
                  className="size-3.5 shrink-0"
                  style={{ color: on ? m.color : "oklch(0.7 0.02 220 / 0.6)" }}
                />
                <span
                  className="font-sans text-[11px] tracking-wide"
                  style={{ color: on ? m.color : "oklch(0.8 0.02 220 / 0.6)" }}
                >
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* validation protocol */}
        <div className="mt-5">
          <label className="font-mono text-[9px] uppercase tracking-[0.25em] text-cyan-200/35">
            验证方案 / Validation Protocol
          </label>
          <div className="mt-2 flex items-center gap-2 border-b border-cyan-300/15 pb-1.5 transition-colors focus-within:border-cyan-300/50">
            <span className="font-mono text-xs text-cyan-300/40">{"⌗"}</span>
            <input
              type="text"
              value={cause.protocol}
              onChange={(e) =>
                onUpdateNode(category.id, cause.id, { protocol: e.target.value })
              }
              placeholder="例: 对夹具尺寸做 2-Way ANOVA…"
              className="w-full bg-transparent font-sans text-xs text-cyan-50 placeholder:text-cyan-200/25 focus:outline-none"
            />
          </div>
        </div>

        {/* owner */}
        <div className="mt-4">
          <label className="font-mono text-[9px] uppercase tracking-[0.25em] text-cyan-200/35">
            责任人 / Owner
          </label>
          <div className="mt-2 flex items-center gap-2 border-b border-cyan-300/15 pb-1.5 transition-colors focus-within:border-cyan-300/50">
            <span className="font-mono text-xs text-cyan-300/40">{"@"}</span>
            <input
              type="text"
              value={cause.owner}
              onChange={(e) =>
                onUpdateNode(category.id, cause.id, { owner: e.target.value })
              }
              placeholder="例: Eng. John Doe"
              className="w-full bg-transparent font-sans text-xs text-cyan-50 placeholder:text-cyan-200/25 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
