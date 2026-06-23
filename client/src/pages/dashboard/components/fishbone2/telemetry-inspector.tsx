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
  type TargetData,
  type Validation,
} from "./ishikawa-data"

const V_ICON: Record<Validation, typeof HelpCircle> = {
  UNVERIFIED: HelpCircle,
  PROVEN: AlertTriangle,
  FALSE: CircleSlash,
  MITIGATED: ShieldCheck,
}

interface InspectorProps {
  matrix: MatrixData
  target: TargetData
  selected: { cause: Cause; category: CategoryMeta } | null
  activeDimension: string | null
  onToggleDimension: (catId: string) => void
  onSelectCause: (cause: Cause, catId: string) => void
  onAddNode: (catId: string, label: string) => void
  onUpdateNode: (catId: string, id: string, patch: Partial<Cause>) => void
  onSetStatus: (catId: string, id: string, validation: Validation) => void
  onDeleteNode: (catId: string, id: string) => void
  onUpdateTarget: (patch: Partial<TargetData>) => void
  onClearSelection: () => void
  onExitDimension: () => void
}

export function TelemetryInspector({
  matrix,
  target,
  selected,
  activeDimension,
  onToggleDimension,
  onSelectCause,
  onAddNode,
  onUpdateNode,
  onSetStatus,
  onDeleteNode,
  onUpdateTarget,
  onClearSelection,
  onExitDimension,
}: InspectorProps) {
  const activeCat =
    activeDimension != null
      ? CATEGORY_META.find((c) => c.id === activeDimension) ?? null
      : null

  return (
    <aside
      className="px-6 pt-[2px] pb-3 sm:px-8 sm:pt-[2px] sm:pb-4"
      style={{
        background:
          "linear-gradient(180deg, rgba(3,7,12,0.92) 0%, rgba(3,7,12,0.78) 100%)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
      }}
    >
      <div>
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
            target={target}
            activeDimension={activeDimension}
            onToggleDimension={onToggleDimension}
            onUpdateTarget={onUpdateTarget}
          />
        )}
      </div>
    </aside>
  )
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-white/6 bg-white/[0.02] ${className}`}
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(0,243,255,0.02)",
      }}
    >
      {children}
    </div>
  )
}

function GlobalView({
  matrix,
  target,
  activeDimension,
  onToggleDimension,
  onUpdateTarget,
}: {
  matrix: MatrixData
  target: TargetData
  activeDimension: string | null
  onToggleDimension: (catId: string) => void
  onUpdateTarget: (patch: Partial<TargetData>) => void
}) {
  return (
    <div className="space-y-3">
      <section>
        <div className="mb-1 flex items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.26em] text-cyan-200/35">
          <span>// 6M 裁决矩阵</span>
          <span className="text-cyan-200/25">点击任一维度进入下方编辑区</span>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
          {CATEGORY_META.map((cat) => {
            const causes = matrix[cat.id] ?? []
            const proven = causes.filter((c) => c.validation === "PROVEN").length
            const mitigated = causes.filter((c) => c.validation === "MITIGATED").length
            const isActive = activeDimension === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onToggleDimension(cat.id)}
                className="group flex h-[84px] flex-col gap-1.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-300"
                style={{
                  borderColor: isActive
                    ? "oklch(0.82 0.13 200 / 0.55)"
                    : "rgba(255,255,255,0.06)",
                  backgroundColor: isActive
                    ? "color-mix(in oklch, var(--cyan) 10%, rgba(255,255,255,0.02))"
                    : "rgba(255,255,255,0.02)",
                  boxShadow: isActive
                    ? "0 0 24px -8px oklch(0.82 0.13 200 / 0.65)"
                    : "none",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-[8px] uppercase tracking-[0.22em] ${
                      isActive ? "text-cyan-200" : "text-cyan-300/55"
                    }`}
                  >
                    {cat.code}
                  </span>
                  <span className="font-mono text-[8px] text-cyan-200/30">{causes.length}</span>
                </div>
                <div className="text-[18px] font-semibold tracking-wide text-cyan-50">{cat.label}</div>
                <div className="mt-auto flex items-center gap-2 font-mono text-[8px] tracking-[0.1em]">
                  <span className="text-red-400/80">{proven} 强相关</span>
                  <span className="text-cyan-300/70">{mitigated} 管控</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <Panel className="p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-200/40">
          // TARGET CARD TEXT
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-200/35">
              Code
            </div>
            <input
              type="text"
              value={target.code}
              onChange={(e) => onUpdateTarget({ code: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-[oklch(0.16_0.02_240)] px-3 py-2.5 font-mono text-sm text-cyan-100 placeholder:text-cyan-200/25 focus:border-cyan-300/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-200/35">
              Label
            </div>
            <input
              type="text"
              value={target.label}
              onChange={(e) => onUpdateTarget({ label: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-[oklch(0.16_0.02_240)] px-3 py-2.5 text-sm text-cyan-50 placeholder:text-cyan-200/25 focus:border-cyan-300/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-200/35">
              Metric
            </div>
            <input
              type="text"
              value={target.metric}
              onChange={(e) => onUpdateTarget({ metric: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-[oklch(0.16_0.02_240)] px-3 py-2.5 font-mono text-sm text-cyan-100 placeholder:text-cyan-200/25 focus:border-cyan-300/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-200/35">
              Delta
            </div>
            <input
              type="text"
              value={target.delta}
              onChange={(e) => onUpdateTarget({ delta: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-[oklch(0.16_0.02_240)] px-3 py-2.5 font-mono text-sm text-cyan-100 placeholder:text-cyan-200/25 focus:border-cyan-300/50 focus:outline-none"
            />
          </label>
        </div>
      </Panel>
    </div>
  )
}

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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-end gap-3">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/45 transition-colors hover:text-cyan-200"
          >
            <ChevronLeft className="size-3" />
            返回矩阵
          </button>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/60">
              {category.code}
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-wide text-cyan-50">
              {category.label}
            </h2>
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-200/35">
          {causes.length} 节点
        </div>
      </div>

      <Panel className="p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-200/40">
          // HYPOTHESIS INJECTION
        </div>
        <div className="flex flex-col gap-3 xl:flex-row">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") inject()
            }}
            placeholder="Input new root cause hypothesis..."
            className="w-full rounded-xl border border-white/10 bg-[oklch(0.16_0.02_240)] px-3 py-3 font-mono text-sm text-cyan-300 placeholder:text-cyan-200/25 focus:border-cyan-300/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={inject}
            disabled={!draft.trim()}
            className="flex min-w-[220px] items-center justify-center gap-2 rounded-xl border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.22em] transition-all duration-200 disabled:opacity-40"
            style={{
              borderColor: "color-mix(in oklch, var(--cyan) 30%, transparent)",
              backgroundColor: "color-mix(in oklch, var(--cyan) 8%, transparent)",
              color: "var(--cyan)",
            }}
          >
            <Plus className="size-3.5" />
            Inject Node
          </button>
        </div>
      </Panel>

      <div>
        <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-200/35">
          <span>// ACTIVE PAYLOAD</span>
          <span className="text-cyan-200/25">点击任一节点卡片进入审讯区</span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {causes.length === 0 && (
            <Panel className="min-w-full px-4 py-8 text-center font-mono text-[11px] tracking-[0.18em] text-cyan-200/30">
              暂无节点，先注入首个根因假设。
            </Panel>
          )}
          {causes.map((cause) => {
            const vMeta = VALIDATION_META[cause.validation]
            return (
              <Panel key={cause.id} className="min-w-[320px] max-w-[320px] p-4">
                <button
                  type="button"
                  onClick={() => onSelectCause(cause, category.id)}
                  className="w-full text-left"
                >
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: vMeta.color }}>
                    [{vMeta.sigil}] {vMeta.label}
                  </div>
                  <div
                    className={`mt-2 text-lg font-medium leading-snug text-cyan-50 ${
                      vMeta.strike ? "line-through decoration-1" : ""
                    }`}
                  >
                    {cause.label}
                  </div>
                  <div className="mt-2 text-sm text-cyan-100/50">{cause.note}</div>
                </button>

                <div className="mt-4 flex flex-wrap items-center gap-1.5">
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
                        className="grid size-8 place-items-center rounded-lg border transition-all duration-200"
                        style={{
                          borderColor: on
                            ? `color-mix(in oklch, ${m.color} 55%, transparent)`
                            : "rgba(255,255,255,0.06)",
                          backgroundColor: on
                            ? `color-mix(in oklch, ${m.color} 14%, transparent)`
                            : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <Icon
                          className="size-3.5"
                          style={{ color: on ? m.color : "oklch(0.7 0.02 220 / 0.45)" }}
                        />
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    title="删除节点"
                    onClick={() => onDeleteNode(category.id, cause.id)}
                    className="ml-auto grid size-8 place-items-center rounded-lg border border-transparent text-red-400/50 transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </Panel>
            )
          })}
        </div>
      </div>
    </div>
  )
}

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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/45 transition-colors hover:text-cyan-200"
          >
            <ChevronLeft className="size-3" />
            返回 6M 矩阵
          </button>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/40">
              {category.code} / {category.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-cyan-50">节点审讯面板</div>
          </div>
        </div>
        <button
          type="button"
          title="删除节点"
          onClick={() => onDeleteNode(category.id, cause.id)}
          className="flex items-center gap-1 self-start rounded-lg border border-transparent px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-red-400/55 transition-all hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 xl:self-auto"
        >
          <X className="size-3.5" />
          Purge
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr_1fr]">
        <Panel className="p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200/40">
            NODE LABEL
          </div>
          <input
            value={cause.label}
            onChange={(e) =>
              onUpdateNode(category.id, cause.id, { label: e.target.value })
            }
            className="mt-2 w-full rounded-xl border border-transparent bg-transparent px-0 py-0 text-2xl font-semibold tracking-wide text-cyan-50 transition-colors hover:border-white/10 focus:border-cyan-300/40 focus:bg-white/[0.02] focus:px-3 focus:py-2 focus:outline-none"
          />
          <div
            className="mt-4 flex items-center gap-3 rounded-xl border px-3 py-3"
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
            <div>
              <div className="text-sm font-medium" style={{ color: vMeta.color }}>
                {vMeta.label}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200/35">
                {vMeta.en}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-cyan-200/45">
              <span className="inline-block size-1 rounded-full" style={{ backgroundColor: meta.color }} />
              风险 {meta.label}
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/40">
              <span>归因置信度</span>
              <span style={{ color: vMeta.color }}>
                {Math.round(cause.contribution * 100)}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
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
        </Panel>

        <Panel className="p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-200/40">
            NOTE
          </div>
          <p className="mt-3 text-sm leading-relaxed text-cyan-100/55">{cause.note}</p>
        </Panel>

        <Panel className="p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-200/40">
            STATUS
          </div>
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
                  className="flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition-all duration-300"
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
                    className="text-[12px] tracking-wide"
                    style={{ color: on ? m.color : "oklch(0.8 0.02 220 / 0.6)" }}
                  >
                    {m.label}
                  </span>
                </button>
              )
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-4">
          <label className="font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-200/35">
            验证方案 / Validation Protocol
          </label>
          <div className="mt-3 flex items-center gap-2 border-b border-cyan-300/15 pb-2 transition-colors focus-within:border-cyan-300/50">
            <span className="font-mono text-xs text-cyan-300/40">{"⌗"}</span>
            <input
              type="text"
              value={cause.protocol}
              onChange={(e) =>
                onUpdateNode(category.id, cause.id, { protocol: e.target.value })
              }
              placeholder="例: 对夹具尺寸做 2-Way ANOVA..."
              className="w-full bg-transparent text-sm text-cyan-50 placeholder:text-cyan-200/25 focus:outline-none"
            />
          </div>
        </Panel>

        <Panel className="p-4">
          <label className="font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-200/35">
            责任人 / Owner
          </label>
          <div className="mt-3 flex items-center gap-2 border-b border-cyan-300/15 pb-2 transition-colors focus-within:border-cyan-300/50">
            <span className="font-mono text-xs text-cyan-300/40">{"@"}</span>
            <input
              type="text"
              value={cause.owner}
              onChange={(e) =>
                onUpdateNode(category.id, cause.id, { owner: e.target.value })
              }
              placeholder="例: Eng. John Doe"
              className="w-full bg-transparent text-sm text-cyan-50 placeholder:text-cyan-200/25 focus:outline-none"
            />
          </div>
        </Panel>
      </div>
    </div>
  )
}
