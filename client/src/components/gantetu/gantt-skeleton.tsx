import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useGanttEngine } from "@/hooks/use-gantt-engine"
import type { CollisionState, ComponentGroup, Milestone, Role, TaskNode, ViewMode } from "@/lib/gantt/types"
import {
  calculateDelayDebt,
  diffDays,
  flattenVisible,
  getBaseEnd,
  getComponentAggregateProgress,
  getComponentEnvelopeEnd,
  getComponentEnvelopeStart,
  getRoots,
  isCompleted,
  isComponentCollidingMilestone,
  isComponentCompleted,
  isComponentOverdue,
  isOverdue,
  isTaskCollidingMilestone,
  todayIso,
  getOverdueDays,
  flatten,
  findNode,
} from "@/lib/gantt/utils"
import { TaskTreeList } from "./task-tree-list"
import { DeletionModal } from "./deletion-modal"
import { GANTT_ROW_H } from "@/lib/gantt/row-heights"
import CyberPromptDialog from "@/components/ui/CyberPromptDialog"

interface GanttSkeletonProps {
  initialComponents: ComponentGroup[]
  initialMilestones?: Milestone[]
  dayWidth?: number
}

/* --------------------------------- Color --------------------------------- */

/* Phase 15 — 并发色谱映射引擎 (Concurrent Color Palette) */
const COMPONENT_PALETTE = [
  { base: "text-cyan-400", bg: "bg-cyan-500", glow: "shadow-[0_0_12px_rgba(6,182,212,0.5)]", bar: "from-cyan-600 to-cyan-400", border: "border-cyan-400/40" },
  { base: "text-purple-400", bg: "bg-purple-500", glow: "shadow-[0_0_12px_rgba(168,85,247,0.5)]", bar: "from-purple-600 to-purple-400", border: "border-purple-400/40" },
  { base: "text-rose-400", bg: "bg-rose-500", glow: "shadow-[0_0_12px_rgba(244,63,94,0.5)]", bar: "from-rose-600 to-rose-400", border: "border-rose-400/40" },
  { base: "text-amber-400", bg: "bg-amber-500", glow: "shadow-[0_0_12px_rgba(245,158,11,0.5)]", bar: "from-amber-600 to-amber-400", border: "border-amber-400/40" },
  { base: "text-emerald-400", bg: "bg-emerald-500", glow: "shadow-[0_0_12px_rgba(16,185,129,0.5)]", bar: "from-emerald-600 to-emerald-400", border: "border-emerald-400/40" },
  { base: "text-indigo-400", bg: "bg-indigo-500", glow: "shadow-[0_0_12px_rgba(99,102,241,0.5)]", bar: "from-indigo-600 to-indigo-400", border: "border-indigo-400/40" },
] as const

/* ========================== Phase 20 — Entity Slider (GanttBar) ========================== */

type GanttBarStatus = "pending" | "active" | "delayed" | "completed" | "overdue"

interface GanttBarSegment {
  widthPx: number
  type: "base" | "delay"
  title?: string
}

interface GanttBarProps {
  leftPx: number
  widthPx: number
  progress: number
  status: GanttBarStatus
  label: string
  segments?: GanttBarSegment[]
  delayDebt?: number
}

const STATUS_FILL: Record<GanttBarStatus, string> = {
  pending:   "bg-gradient-to-r from-[#92400e] to-[#d97706]",
  active:    "bg-gradient-to-r from-[#b45309] to-[#f59e0b]",
  delayed:   "bg-gradient-to-r from-[#92400e] to-[#d97706]",
  completed: "bg-gradient-to-r from-[#047857] to-[#10b981]",
  overdue:   "bg-gradient-to-r from-[#991b1b] to-[#dc2626]",
}

const STATUS_TEXT: Record<GanttBarStatus, string> = {
  pending:   "text-amber-100",
  active:    "text-amber-50",
  delayed:   "text-amber-100",
  completed: "text-emerald-100",
  overdue:   "text-red-100",
}

function GanttBar({ leftPx, widthPx, progress, status, label, segments, delayDebt }: GanttBarProps) {
  const isNarrow = widthPx < 80
  const textCls = STATUS_TEXT[status]
  const pct = Math.max(0, Math.min(100, progress))

  const isOverdueBar = status === "overdue"
  const baseFill = status === "completed"
    ? "bg-gradient-to-r from-[#047857] to-[#10b981]"
    : status === "overdue"
      ? "bg-gradient-to-r from-[#991b1b] to-[#dc2626]"
      : "bg-gradient-to-r from-[#b45309] to-[#f59e0b]"

  return (
    <>
      {/* Track — planning slot with subtle inner shadow */}
      <div
        className="absolute h-6 rounded overflow-hidden"
        style={{
          left: `${leftPx}px`,
          width: `${widthPx}px`,
          top: "50%",
          transform: "translateY(-50%)",
          background: isOverdueBar ? "rgba(127,29,29,0.4)" : "var(--gantt-track-bg)",
          border: isOverdueBar ? "2px solid rgba(220,38,38,0.7)" : "1px solid var(--gantt-border)",
          boxShadow: isOverdueBar ? "0 0 12px rgba(239,68,68,0.4), inset 0 1px 4px rgba(0,0,0,0.4)" : "inset 0 1px 4px rgba(0,0,0,0.4)",
        }}
        title={label}
      >
        {segments ? (
          /* Segmented: base section + delay stripes */
          <div className="absolute inset-0 flex">
            {segments.map((seg, i) => {
              const isFirst = i === 0
              const isLast = i === segments.length - 1
              const r = `${isFirst ? "rounded-l" : ""} ${isLast ? "rounded-r" : ""}`
              if (seg.type === "base") {
                return (
                  <div key={i} className={`relative h-full overflow-hidden ${r}`} style={{ width: `${seg.widthPx}px` }} title={seg.title}>
                    <div className={`absolute inset-0 ${baseFill}`} />
                    {pct > 0 && (
                      <div className={`absolute inset-y-0 left-0 ${baseFill}`} style={{ width: `${pct}%` }} />
                    )}
                  </div>
                )
              }
              return (
                <div key={i} className={`h-full gantt-delay-stripe ${r}`} style={{ width: `${seg.widthPx}px` }} title={seg.title} />
              )
            })}
          </div>
        ) : (
          /* Simple mode: single fill at progress% */
          pct > 0 && (
            <div
              className={`absolute inset-y-0 left-0 ${STATUS_FILL[status]} ${pct >= 100 ? "rounded" : "rounded-l"}`}
              style={{ width: `${pct}%` }}
            >
              {pct < 100 && <div className="absolute right-0 inset-y-0 w-[2px] bg-white/80" />}
            </div>
          )
        )}

        {/* Data layer: text */}
        {!isNarrow && (
          <div className="absolute inset-0 z-10 flex items-center px-2 pointer-events-none overflow-hidden">
            <span className="text-[12px] font-medium truncate text-white/90">
              {label}
            </span>
          </div>
        )}
      </div>

      {/* Narrow fallback: text outside right */}
      {isNarrow && (
        <div className="absolute top-1/2 -translate-y-1/2 ml-2 pointer-events-none whitespace-nowrap" style={{ left: `${leftPx + widthPx}px` }}>
          <span className={`text-[12px] font-medium ${textCls}`}>{label}</span>
        </div>
      )}

      {/* Delay debt badge */}
      {delayDebt != null && delayDebt > 0 && (
        <span
          className="absolute top-1/2 -translate-y-1/2 px-1 py-0.5 bg-red-900/80 text-red-200 text-[7px] font-bold rounded whitespace-nowrap z-20 border border-red-700/50"
          style={{ left: `${leftPx + widthPx + (isNarrow ? 80 : 6)}px` }}
        >
          +{delayDebt}天
        </span>
      )}
    </>
  )
}

function deriveBarStatus(_overdue: boolean, completed: boolean, progress: number): GanttBarStatus {
  if (completed) return "completed"
  // 逾期任务不再强制红色 — 统一走橙色系，只有延期报备段才允许红
  if (progress > 0) return "active"
  return "pending"
}

/* ------------------------------ Component -------------------------------- */

export function GanttSkeleton({ initialComponents, initialMilestones = [], dayWidth: dayWidthFallback = 28 }: GanttSkeletonProps) {
  const engine = useGanttEngine(initialComponents, initialMilestones)
  const {
    components,
    allTasks,
    viewMode,
    setViewMode,
    addDelay,
    updateTaskDate,
    updateTaskReason,
    updateTaskProgress,
    updateTaskAssignee,
    deleteLastDelay,
    toggleExpanded,
    toggleComponentExpanded,
    addTaskToComponent,
    addComponentGroup,
    deleteComponentGroup,
    role,
    milestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    collisions,
    validateTaskDeletion,
    deleteTask,
    resetTaskProgress,
  } = engine

  const isMacro = viewMode === "MACRO"
  const [selectedMonth, setSelectedMonth] = useState(() => todayIso().slice(0, 7))
  const timeline = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number)
    const startD = new Date(Date.UTC(year, month - 1, 1))
    const endD = new Date(Date.UTC(year, month, 0))
    const start = startD.toISOString().slice(0, 10)
    const end = endD.toISOString().slice(0, 10)
    return {
      start,
      end,
      totalDays: diffDays(start, end) + 1,
    }
  }, [selectedMonth])

  // Phase 9 — Milestone deletion state
  const [milestoneDeletionTarget, setMilestoneDeletionTarget] = useState<Milestone | null>(null)
  // Phase 19 — 交付死线管理面板（增/改名/改日/改类/删 集中入口）
  const [showMilestonePanel, setShowMilestonePanel] = useState(false)
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ name: string; date: string; type: "commercial" | "technical" }>({ name: "", date: "", type: "commercial" })

  // Phase 21 — 部件管理面板（新增/删除集中入口）
  const [showComponentPanel, setShowComponentPanel] = useState(false)
  const [componentDeletionTarget, setComponentDeletionTarget] = useState<{ id: string; name: string } | null>(null)

  // 统一录入弹窗状态机（取代 window.prompt）
  type PromptKind =
    | { kind: "milestone" }
    | { kind: "component" }
    | { kind: "delay"; componentId: string; parentId: string }
  const [promptState, setPromptState] = useState<PromptKind | null>(null)

  // Phase 17 — 左右面板垂直滚动同步，保证行块始终水平对齐
  const leftScrollRef = useRef<HTMLDivElement | null>(null)
  const rightScrollRef = useRef<HTMLDivElement | null>(null)
  const monthInputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    const left = leftScrollRef.current
    const right = rightScrollRef.current
    if (!left || !right) return
    let syncing = false
    const onLeft = () => {
      if (syncing) return
      syncing = true
      right.scrollTop = left.scrollTop
      requestAnimationFrame(() => { syncing = false })
    }
    const onRight = () => {
      if (syncing) return
      syncing = true
      left.scrollTop = right.scrollTop
      requestAnimationFrame(() => { syncing = false })
    }
    left.addEventListener("scroll", onLeft, { passive: true })
    right.addEventListener("scroll", onRight, { passive: true })
    return () => {
      left.removeEventListener("scroll", onLeft)
      right.removeEventListener("scroll", onRight)
    }
  }, [])

  const handleMilestoneDeleteRequest = useCallback((m: Milestone) => {
    setMilestoneDeletionTarget(m)
  }, [])

  const handleConfirmMilestoneDeletion = useCallback(() => {
    if (!milestoneDeletionTarget) return
    deleteMilestone(milestoneDeletionTarget.id)
    setMilestoneDeletionTarget(null)
  }, [milestoneDeletionTarget, deleteMilestone])

  // Phase 8 — Milestone spawner (ADMIN only) — 打开统一弹窗
  const handleAddMilestone = useCallback(() => {
    if (role !== "ADMIN") return
    setPromptState({ kind: "milestone" })
  }, [role])

  // Phase 13 — Add component group — 打开统一弹窗
  const handleAddComponentGroup = useCallback(() => {
    setPromptState({ kind: "component" })
  }, [])

  // Phase 21 — Delete component group
  const handleConfirmComponentDeletion = useCallback(() => {
    if (!componentDeletionTarget) return
    deleteComponentGroup(componentDeletionTarget.id)
    setComponentDeletionTarget(null)
  }, [componentDeletionTarget, deleteComponentGroup])

  // Phase 23 — 右侧面板宽度跟踪（用于计算动态 dayWidth）
  const [containerWidth, setContainerWidth] = useState(0)
  useEffect(() => {
    const right = rightScrollRef.current
    if (!right) return
    const update = () => setContainerWidth(right.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(right)
    return () => ro.disconnect()
  }, [])

  // Phase 23.3 — 日期栏只显示所选月份 1 号到最后一天，并填满右侧可视宽度
  const dayWidth = containerWidth > 0 ? containerWidth / timeline.totalDays : dayWidthFallback

  // 依赖连线位置预计算 (MICRO 模式)
  const { taskPositionMap, tracksContentHeight } = useMemo(() => {
    const map = new Map<string, TaskPositionEntry>()
    if (isMacro) return { taskPositionMap: map, tracksContentHeight: 0 }
    let yAccum = 0
    for (const group of components) {
      yAccum += GANTT_ROW_H.GROUP
      if (group.isExpanded !== false) {
        const visible = flattenVisible(group.tasks, null, 0, [], false)
        for (const { node } of visible) {
          const yCenterPx = yAccum + GANTT_ROW_H.TASK / 2
          const offsetD = diffDays(timeline.start, node.startDate)
          const spanD = Math.max(1, diffDays(node.startDate, node.endDate))
          map.set(node.id, {
            yCenterPx,
            startPx: offsetD * dayWidth,
            endPx: (offsetD + spanD) * dayWidth,
            depIds: node.dependencies ?? [],
            overdueSource: isOverdue(node),
          })
          yAccum += GANTT_ROW_H.TASK
        }
        yAccum += GANTT_ROW_H.SPAWNER
      }
    }
    return { taskPositionMap: map, tracksContentHeight: yAccum }
  }, [components, isMacro, timeline.start, dayWidth])

  return (
    <div className="flex flex-col w-full h-screen bg-[#0B0F19] text-slate-100">
      {/* ========================== Top Header (title only after Phase 22 合并) ========================== */}
      <header className="h-12 flex-shrink-0 border-b border-slate-800/50 flex items-center justify-between px-4 bg-[#111827]">
        <h1 className="text-[20px] font-semibold tracking-wide text-slate-100">
          <span className="text-cyan-400">项目进度甘特图</span>
        </h1>
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg gantt-glass">
          <span className="text-[16px] text-slate-300 font-normal">月份</span>
          <button
            type="button"
            onClick={() => {
              const el = monthInputRef.current
              if (!el) return
              // 优先使用原生 showPicker（Chromium / Edge / 部分 FF）
              const anyEl = el as HTMLInputElement & { showPicker?: () => void }
              if (typeof anyEl.showPicker === "function") {
                anyEl.showPicker()
              } else {
                el.focus()
                el.click()
              }
            }}
            className="w-7 h-7 flex items-center justify-center rounded-md text-sky-400 hover:bg-sky-500/10 hover:text-sky-300 transition-all"
            aria-label="更换月份"
            title="点击更换月份"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>
          </button>
          <span className="text-[16px] font-normal text-sky-200 tabular-nums tracking-wide">
            {(() => {
              const [y, m] = selectedMonth.split("-")
              return `${y}年${m}月`
            })()}
          </span>
          {/* 隐藏的真实 input，由图标按钮触发 */}
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.5"/><path d="M16 2v4M8 2v4M3 10h18" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input
            ref={monthInputRef}
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </header>

      {/* ========================== Main Content ========================== */}
      <div className="flex flex-1 min-h-0 border-t border-slate-800/30 relative">
        {/* 宏观 / 微观 — 浮在里程碑行右侧空白区（不随时间轴横向滚动） */}
        <div className="absolute top-0 right-3 flex items-center z-30 text-[13px] font-medium" style={{ height: GANTT_ROW_H.CONTROL_BAR }}>
          <button
            type="button"
            onClick={() => setViewMode("MACRO")}
            className={`px-2.5 py-0.5 rounded-l border transition-all ${
              isMacro
                ? "bg-cyan-600/80 border-cyan-400 text-white"
                : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
            }`}
          >
            宏观大盘
          </button>
          <button
            type="button"
            onClick={() => setViewMode("MICRO")}
            className={`px-2.5 py-0.5 rounded-r border-t border-r border-b transition-all ${
              !isMacro
                ? "bg-cyan-600/80 border-cyan-400 text-white"
                : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
            }`}
          >
            微观审计
          </button>
        </div>

        {/* --------------------- Left — Component Tree (Phase 15: 物理空间解压) --------------------- */}
        <div className="flex-1 min-w-[210px] max-w-[300px] flex-shrink border-r border-slate-800/40 flex flex-col bg-[#111827]">
          {/* Phase 22 — 顶部控件表头：交付死线 / 部件管理 / 宏微观切换，等距排列 */}
          {/* 高度从 GANTT_ROW_H.CONTROL_BAR 取值，与右侧里程碑条物理锁死 */}
          <div
            className="sticky top-0 z-20 bg-[#0f1729] border-b border-slate-800/50 flex items-center justify-between gap-2 px-3 whitespace-nowrap"
            style={{ height: GANTT_ROW_H.CONTROL_BAR }}
          >
            {/* 交付死线 */}
            {role === "ADMIN" ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowMilestonePanel((v) => !v)
                    setEditingMilestoneId(null)
                  }}
                  className="px-2 py-0.5 border border-fuchsia-700/60 text-fuchsia-300 hover:bg-fuchsia-950/50 hover:border-fuchsia-500 text-[10.5px] rounded transition-all"
                >
                  ◆ 里程碑
                </button>
                {showMilestonePanel && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-[420px] bg-[#0f1729] border border-fuchsia-800/50 rounded shadow-[0_8px_24px_rgba(0,0,0,0.6)] p-2">
                    <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800/60 mb-1">
                      <span className="text-[10px] tracking-wider text-fuchsia-300">里程碑管理</span>
                      <button
                        type="button"
                        onClick={() => { setShowMilestonePanel(false); setEditingMilestoneId(null) }}
                        className="text-slate-500 hover:text-slate-200 text-[10px]"
                        aria-label="关闭"
                      >
                        ×
                      </button>
                    </div>
                    {milestones.length === 0 ? (
                      <div className="px-2 py-3 text-[10px] text-slate-500 text-center">尚未录入里程碑</div>
                    ) : (
                      <ul className="max-h-72 overflow-auto">
                        {milestones.map((m) => {
                          const dotCls = m.type === "commercial" ? "bg-fuchsia-500" : "bg-purple-500"
                          const isEditing = editingMilestoneId === m.id
                          if (isEditing) {
                            const handleSave = () => {
                              const name = editDraft.name.trim()
                              if (!name) return
                              if (!/^\d{4}-\d{2}-\d{2}$/.test(editDraft.date)) return
                              updateMilestone(m.id, { name, date: editDraft.date, type: editDraft.type })
                              setEditingMilestoneId(null)
                            }
                            return (
                              <li key={m.id} className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-800/40 last:border-0 bg-slate-800/40">
                                <input
                                  type="text"
                                  value={editDraft.name}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                                  placeholder="名称"
                                  className="flex-1 min-w-0 bg-transparent border-0 border-b border-slate-700 focus:border-cyan-500 focus:outline-none text-[10px] text-slate-100 px-1 py-0.5"
                                  autoFocus
                                />
                                <input
                                  type="date"
                                  value={editDraft.date}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))}
                                  className="bg-transparent border-0 border-b border-slate-700 focus:border-cyan-500 focus:outline-none text-[10px] text-slate-300 px-1 py-0.5 font-mono w-[110px]"
                                />
                                <select
                                  value={editDraft.type}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value === "technical" ? "technical" : "commercial" }))}
                                  className="bg-slate-900 border border-slate-700 text-slate-300 text-[9px] rounded px-1 py-0.5"
                                >
                                  <option value="commercial">商务</option>
                                  <option value="technical">技术</option>
                                </select>
                                <button type="button" onClick={handleSave} className="text-[9px] text-emerald-400 hover:text-emerald-300 px-1">保存</button>
                                <button type="button" onClick={() => setEditingMilestoneId(null)} className="text-[9px] text-slate-500 hover:text-slate-300 px-1">取消</button>
                              </li>
                            )
                          }
                          return (
                            <li key={m.id} className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30">
                              <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} aria-hidden />
                              <span className="flex-1 text-[10px] text-slate-200 truncate" title={m.name}>{m.name}</span>
                              <span className="text-[9px] text-slate-500 font-mono">{m.date}</span>
                              <span className="text-[8px] text-slate-600">{m.type === "commercial" ? "商务" : "技术"}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMilestoneId(m.id)
                                  setEditDraft({ name: m.name, date: m.date, type: m.type })
                                }}
                                className="text-[9px] text-slate-500 hover:text-cyan-400 px-1"
                              >
                                编辑
                              </button>
                              <button type="button" onClick={() => handleMilestoneDeleteRequest(m)} className="text-[9px] text-slate-500 hover:text-red-400 px-1">删除</button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={handleAddMilestone}
                      className="w-full mt-1 py-1.5 border border-dashed border-fuchsia-800/50 text-fuchsia-400 hover:bg-fuchsia-950/30 hover:border-fuchsia-500 text-[10px] rounded transition-all"
                    >
                      + 新增里程碑
                    </button>
                  </div>
                )}
              </div>
            ) : <span />}

            {/* 部件管理 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowComponentPanel((v) => !v)}
                className="px-2 py-0.5 border border-cyan-700/50 text-cyan-400 hover:bg-cyan-950/40 hover:border-cyan-500 text-[10.5px] rounded transition-all"
              >
                ⚙ 项目管理
              </button>
              {showComponentPanel && (
                <div className="absolute left-0 top-full mt-1 z-50 w-[300px] bg-[#0f1729] border border-cyan-800/50 rounded shadow-[0_8px_24px_rgba(0,0,0,0.6)] p-2">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800/60 mb-1">
                    <span className="text-[10px] tracking-wider text-cyan-300">项目管理</span>
                    <button
                      type="button"
                      onClick={() => setShowComponentPanel(false)}
                      className="text-slate-500 hover:text-slate-200 text-[10px]"
                      aria-label="关闭"
                    >
                      ×
                    </button>
                  </div>
                  {components.length === 0 ? (
                    <div className="px-2 py-3 text-[10px] text-slate-500 text-center">尚未录入部件</div>
                  ) : (
                    <ul className="max-h-60 overflow-auto">
                      {components.map((g) => (
                        <li key={g.id} className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30">
                          <span className="flex-1 text-[10px] text-slate-200 truncate" title={g.name}>{g.name}</span>
                          <span className="text-[9px] text-slate-500">{g.tasks.length} 工序</span>
                          <button
                            type="button"
                            onClick={() => {
                              setComponentDeletionTarget({ id: g.id, name: g.name })
                              setShowComponentPanel(false)
                            }}
                            className="text-[9px] text-slate-500 hover:text-red-400 px-1"
                          >
                            删除
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleAddComponentGroup()
                      setShowComponentPanel(false)
                    }}
                    className="w-full mt-1 py-1.5 border border-dashed border-cyan-800/50 text-cyan-400 hover:bg-cyan-950/30 hover:border-cyan-500 text-[10px] rounded transition-all"
                  >
                    + 新增项目
                  </button>
                </div>
              )}
            </div>

          </div>
          {/* Section header (仅文本描述，与右侧 ruler 对齐) */}
          {/* 高度从 GANTT_ROW_H.RULER 取值，top 偏移为 CONTROL_BAR 高度 */}
          <div
            className="border-b border-slate-800/50 sticky bg-[#0f1729] flex items-center px-4 text-[10px] tracking-wider text-slate-500 z-10"
            style={{ height: GANTT_ROW_H.RULER, top: GANTT_ROW_H.CONTROL_BAR }}
          >
            <span className="text-cyan-500/70 mr-2">///</span>
            {isMacro ? "部件总览（高管视图）" : "工序链路控制面板"}
          </div>
          <div ref={leftScrollRef} className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <ComponentTreeList
              components={components}
              viewMode={viewMode}
              role={role}
              milestones={milestones}
              collisions={collisions}
              onToggleComponent={toggleComponentExpanded}
              onToggleTask={toggleExpanded}
              onRequestAddDelay={(componentId, parentId) =>
                setPromptState({ kind: "delay", componentId, parentId })
              }
              onUpdateDate={updateTaskDate}
              onUpdateReason={updateTaskReason}
              onUpdateProgress={updateTaskProgress}
              onDeleteLastDelay={deleteLastDelay}
              onAddTaskToComponent={addTaskToComponent}
              onValidateTaskDeletion={validateTaskDeletion}
              onDeleteTask={deleteTask}
              onResetTaskProgress={resetTaskProgress}
              onUpdateAssignee={updateTaskAssignee}
            />
          </div>
        </div>

        {/* --------------------- Right — Timeline Tracks (Phase 23.2: dayWidth 动态填充使本月刚好铺满) --------------------- */}
        <div ref={rightScrollRef} className="flex-1 overflow-auto relative bg-[#0B0F19] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Phase 18 — Milestone Strip：独立一行、紧贴 top-0、位于 ruler 上方 */}
          {/* 高度从 GANTT_ROW_H.CONTROL_BAR 取值，与左侧控制栏物理锁死 */}
          <div
            className="sticky top-0 z-20 bg-[#0f1729] border-b border-fuchsia-900/30"
            style={{ height: GANTT_ROW_H.CONTROL_BAR, width: `${timeline.totalDays * dayWidth}px` }}
          >
            {role === "ADMIN" && milestones.map((m) => {
              const mOffset = diffDays(timeline.start, m.date)
              if (mOffset < 0 || mOffset >= timeline.totalDays) return null
              const labelBg = m.type === "commercial" ? "bg-fuchsia-950/95" : "bg-purple-950/95"
              const labelText = m.type === "commercial" ? "text-fuchsia-200" : "text-purple-200"
              const labelBorder = m.type === "commercial" ? "border-fuchsia-700/50" : "border-purple-700/50"
              const labelGlow = m.type === "commercial" ? "shadow-[0_0_8px_rgba(217,70,239,0.4)]" : "shadow-[0_0_8px_rgba(147,51,234,0.4)]"
              return (
                <div
                  key={m.id}
                  className={`absolute top-1.5 ${labelBg} ${labelText} text-[9px] px-2 py-1 rounded border ${labelBorder} whitespace-nowrap flex items-center gap-2 ${labelGlow}`}
                  style={{ left: `${mOffset * dayWidth + dayWidth / 2}px`, transform: "translateX(-50%)" }}
                  title={`${m.name} · ${m.date}`}
                >
                  <span className="font-medium">{m.name}</span>
                </div>
              )
            })}
          </div>
          {/* Ruler */}
          {/* 高度从 GANTT_ROW_H.RULER 取值，top 偏移为 CONTROL_BAR 高度 */}
          <div
            className="border-b border-slate-800/30 sticky bg-[#0f1729] flex z-10"
            style={{
              height: GANTT_ROW_H.RULER,
              top: GANTT_ROW_H.CONTROL_BAR,
              width: `${timeline.totalDays * dayWidth}px`,
            }}
          >
            {Array.from({ length: timeline.totalDays }).map((_, i) => {
              const d = new Date(`${timeline.start}T00:00:00Z`)
              d.setUTCDate(d.getUTCDate() + i)
              const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
              const isMonthStart = d.getUTCDate() === 1
              const cellIso = d.toISOString().slice(0, 10)
              const isToday = cellIso === todayIso()
              const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6
              // Phase 18 — 命中里程碑日期的格子：用同色实心矩形作为虚线墙的“顶帽”
              const matchingMilestone = role === "ADMIN" ? milestones.find((m) => m.date === cellIso) : undefined
              const milestoneCls = matchingMilestone
                ? matchingMilestone.type === "commercial"
                  ? "bg-fuchsia-700/70 border-fuchsia-400 text-fuchsia-50 font-bold shadow-[inset_0_0_12px_rgba(217,70,239,0.6)]"
                  : "bg-purple-700/70 border-purple-400 text-purple-50 font-bold shadow-[inset_0_0_12px_rgba(147,51,234,0.6)]"
                : null
              return (
                <div
                  key={i}
                  className={`flex-shrink-0 border-r text-[11px] tabular-nums flex items-center justify-center relative ${
                    milestoneCls
                      ? milestoneCls
                      : isMonthStart
                        ? "border-slate-600/60 text-slate-300 bg-slate-900/30"
                        : isToday
                          ? "border-red-500/80 text-red-400 font-bold bg-red-950/30 shadow-[inset_0_0_12px_rgba(239,68,68,0.3)]"
                          : isWeekend
                            ? "border-slate-800/30 text-slate-500 font-medium"
                            : "border-slate-800/30 text-slate-400 font-medium"
                  }`}
                  style={{ width: `${dayWidth}px` }}
                  title={matchingMilestone ? `${matchingMilestone.name} · ${matchingMilestone.date}` : undefined}
                >
                  {isToday ? "今日" : label}
                </div>
              )
            })}
          </div>

          {/* Tracks Container */}
          <div
            className="relative"
            style={{
              width: `${timeline.totalDays * dayWidth}px`,
              backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent ${dayWidth - 1}px, rgba(51,65,85,0.15) ${dayWidth - 1}px, rgba(51,65,85,0.15) ${dayWidth}px)`,
            }}
          >
            {/* Today Vertical Line */}
            <TodayCursor timelineStart={timeline.start} dayWidth={dayWidth} totalDays={timeline.totalDays} />

            {/* 依赖连线 SVG overlay (MICRO 模式) */}
            {!isMacro && taskPositionMap.size > 0 && (
              <DependencyConnectors
                positionMap={taskPositionMap}
                totalWidth={timeline.totalDays * dayWidth}
                totalHeight={tracksContentHeight}
              />
            )}

            {/* Milestone Lines (ADMIN only) */}
            {role === "ADMIN" &&
              milestones.map((m) => (
                <MilestoneLine
                  key={m.id}
                  milestone={m}
                  timelineStart={timeline.start}
                  dayWidth={dayWidth}
                  totalDays={timeline.totalDays}
                />
              ))}

            {/* Phase 13 — Component/Task Tracks (Phase 15: 动态色谱) */}
            {components.map((group, idx) => {
              const themeColor = COMPONENT_PALETTE[idx % COMPONENT_PALETTE.length]
              return isMacro ? (
                /* MACRO: 每个部件只渲染一根长条 */
                <ComponentTrack
                  key={group.id}
                  group={group}
                  timelineStart={timeline.start}
                  dayWidth={dayWidth}
                  role={role}
                  milestones={milestones}
                  colorIndex={idx}
                />
              ) : (
                /* MICRO: 展开显示内部工序 */
                <div key={group.id}>
                  {/* Component header row — 高度从 GANTT_ROW_H.GROUP 取值，与左侧物理锁死 */}
                  <div
                    className={`border-b border-slate-800/30 bg-slate-900/50 flex items-center px-3 ${themeColor.border}`}
                    style={{ height: GANTT_ROW_H.GROUP }}
                  >
                    <span className={`text-[14px] font-medium tracking-wide ${themeColor.base}`}>{group.name}</span>
                  </div>
                  {/* Task rows */}
                  {group.isExpanded !== false && (
                    <>
                      {flattenVisible(group.tasks, null, 0, [], false).map(({ node, indexInParent }) => (
                        <TaskTrack
                          key={node.id}
                          node={node}
                          indexInParent={indexInParent}
                          timelineStart={timeline.start}
                          dayWidth={dayWidth}
                          viewMode={viewMode}
                          role={role}
                          milestones={milestones}
                        />
                      ))}
                      {/* Placeholder row for "+新增基础工序" button alignment */}
                      {/* 高度从 GANTT_ROW_H.SPAWNER 取值，与左侧 BlackboardSpawner 折叠态物理锁死 */}
                      <div
                        className="border-b border-slate-800/20"
                        style={{ height: GANTT_ROW_H.SPAWNER }}
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Milestone Deletion Modal */}
      {milestoneDeletionTarget && (
        <DeletionModal
          itemType="milestone"
          itemName={milestoneDeletionTarget.name}
          onConfirm={handleConfirmMilestoneDeletion}
          onCancel={() => setMilestoneDeletionTarget(null)}
        />
      )}

      {/* Phase 21 — Component Deletion Modal */}
      {componentDeletionTarget && (
        <DeletionModal
          itemType="component"
          itemName={componentDeletionTarget.name}
          onConfirm={handleConfirmComponentDeletion}
          onCancel={() => setComponentDeletionTarget(null)}
        />
      )}

      {/* 统一录入弹窗（取代 window.prompt） */}
      {promptState?.kind === "milestone" && (
        <CyberPromptDialog
          open
          title="新增里程碑"
          subtitle="里程碑录入"
          description="为项目录入一个关键节点。商业里程碑红色标识，技术里程碑紫色标识。"
          fields={[
            { kind: "text", name: "name", label: "里程碑名称", defaultValue: "T0 试模", required: true, maxLength: 32 },
            { kind: "date", name: "date", label: "截止日期", defaultValue: todayIso(), required: true },
            {
              kind: "select",
              name: "type",
              label: "类型",
              defaultValue: "commercial",
              options: [
                { value: "commercial", label: "商业里程碑（commercial）" },
                { value: "technical", label: "技术里程碑（technical）" },
              ],
            },
          ]}
          confirmText="录入"
          tone="purple"
          onCancel={() => setPromptState(null)}
          onConfirm={(v) => {
            const type = v.type === "technical" ? "technical" : "commercial"
            addMilestone(v.name.trim(), v.date, type)
            setPromptState(null)
          }}
        />
      )}

      {promptState?.kind === "component" && (
        <CyberPromptDialog
          open
          title="新增项目"
          subtitle="项目录入"
          description="新增一个项目分组。可在右侧时间轴上独立排程。"
          fields={[
            { kind: "text", name: "name", label: "项目名称", defaultValue: "新项目", required: true, maxLength: 32 },
          ]}
          confirmText="新增"
          tone="cyan"
          onCancel={() => setPromptState(null)}
          onConfirm={(v) => {
            addComponentGroup(v.name.trim())
            setPromptState(null)
          }}
        />
      )}

      {promptState?.kind === "delay" && (
        <CyberPromptDialog
          open
          title="延期报备"
          subtitle="工序延期"
          description="录入本次延期天数及原因。延期记录将作为该工序的子条目展示。"
          fields={[
            { kind: "number", name: "days", label: "延期天数（正整数）", defaultValue: "3", required: true, min: 1, max: 365, step: 1 },
            { kind: "text", name: "reason", label: "延期原因（可选）", placeholder: "例：物料未到、设备故障…", maxLength: 64 },
          ]}
          confirmText="提交报备"
          tone="cyan"
          onCancel={() => setPromptState(null)}
          onConfirm={(v) => {
            const days = Number.parseInt(v.days, 10)
            if (!Number.isFinite(days) || days <= 0) {
              setPromptState(null)
              return
            }
            if (promptState.kind !== "delay") return
            addDelay(promptState.componentId, promptState.parentId, days, v.reason ?? "")
            setPromptState(null)
          }}
        />
      )}
    </div>
  )
}

/* ========================== ComponentTreeList ========================== */

interface ComponentTreeListProps {
  components: ComponentGroup[]
  viewMode: ViewMode
  role: Role
  milestones: Milestone[]
  collisions: CollisionState[]
  onToggleComponent: (componentId: string) => void
  onToggleTask: (componentId: string, taskId: string) => void
  /** 请求打开“延期天数”录入弹窗（取代 window.prompt）。实际写入在 GanttSkeleton 弹窗 onConfirm 中进行。 */
  onRequestAddDelay: (componentId: string, parentId: string) => void
  onUpdateDate: (componentId: string, taskId: string, start: string, end: string) => void
  onUpdateReason: (componentId: string, taskId: string, reason: string) => void
  onUpdateProgress: (componentId: string, taskId: string, progress: number) => void
  onDeleteLastDelay: (componentId: string, childId: string) => void
  onAddTaskToComponent: (componentId: string, name: string, duration: number, depId: string | null, phase?: string, assignee?: string) => void
  onValidateTaskDeletion: (componentId: string, taskId: string) => { canDelete: boolean; reason?: string }
  onDeleteTask: (componentId: string, taskId: string) => void
  onResetTaskProgress: (componentId: string, taskId: string) => void
  onUpdateAssignee: (componentId: string, taskId: string, assignee: string) => void
}

function ComponentTreeList(props: ComponentTreeListProps) {
  const {
    components,
    viewMode,
    role,
    milestones,
    collisions,
    onToggleComponent,
    onToggleTask,
    onRequestAddDelay,
    onUpdateDate,
    onUpdateReason,
    onUpdateProgress,
    onDeleteLastDelay,
    onAddTaskToComponent,
    onValidateTaskDeletion,
    onDeleteTask,
    onResetTaskProgress,
    onUpdateAssignee,
  } = props

  const isMacro = viewMode === "MACRO"

  return (
    <ul className="text-[11px]">
      {components.map((group, idx) => {
        const expanded = group.isExpanded !== false
        const groupOverdue = isComponentOverdue(group)
        const groupCompleted = isComponentCompleted(group)
        const groupProgress = getComponentAggregateProgress(group)
        const inProgress = groupProgress > 0 && !groupCompleted && !groupOverdue

        // Phase 15 — 色谱遗传法则：根据 index 分配专属主题色
        const themeColor = COMPONENT_PALETTE[idx % COMPONENT_PALETTE.length]

        return (
          <li key={group.id} className="border-b border-slate-800/30">
            {/* Component Group Header — 高度从 GANTT_ROW_H.GROUP 取值，与右侧面板物理锁死 */}
            <div
              style={{ height: GANTT_ROW_H.GROUP }}
              className={`flex items-center gap-3 py-2.5 px-4 hover:bg-slate-800/50 transition-all cursor-pointer border-l-3 whitespace-nowrap ${
                groupOverdue 
                  ? "bg-red-950/25 border-l-red-500" 
                  : groupCompleted 
                    ? "bg-emerald-950/25 border-l-emerald-500" 
                    : `${themeColor.border}`
              }`}
              onClick={() => onToggleComponent(group.id)}
            >
              {/* Expand/Collapse Toggle */}
              <button
                type="button"
                className={`w-5 h-5 flex items-center justify-center rounded transition-colors shrink-0 ${
                  isMacro 
                    ? "text-slate-700 cursor-default" 
                    : "text-slate-500 hover:text-cyan-400 hover:bg-slate-700/50"
                }`}
                disabled={isMacro}
              >
                {isMacro ? "▸" : expanded ? "▾" : "▸"}
              </button>

              {/* Status Indicator — Phase 15: 使用主题色渲染状态灯 */}
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  groupCompleted
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    : groupOverdue
                      ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] gantt-status-overdue"
                      : `${themeColor.bg} ${themeColor.glow}`
                }`}
                title={groupCompleted ? "全部完工" : groupOverdue ? "存在逾期" : inProgress ? "进行中" : "待开始"}
              />

              {/* Component Name — Phase 15: 使用主题色渲染名称 */}
              <span className={`text-[14px] font-medium tracking-wide shrink-0 ${groupOverdue ? "text-red-400" : groupCompleted ? "text-emerald-400" : themeColor.base}`}>
                {group.name}
              </span>

              {/* Aggregate Progress — 精密进度徽章 */}
              <span className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${
                groupCompleted 
                  ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700/50" 
                  : groupOverdue
                    ? "bg-red-900/50 text-red-300 border border-red-700/50"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700/50"
              }`}>
                {groupProgress}% · {group.tasks.length} 工序
              </span>

              {/* MACRO: Overdue Warning — 发光警报标签 */}
              {isMacro && groupOverdue && (
                <span className="px-2 py-0.5 bg-red-900/90 text-red-200 text-[8px] rounded border border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse shrink-0">
                  存在逾期
                </span>
              )}

              {/* MACRO: Completed Badge */}
              {isMacro && groupCompleted && (
                <span className="px-2 py-0.5 bg-emerald-900/80 text-emerald-200 text-[8px] rounded border border-emerald-500/40 shadow-[0_0_6px_rgba(52,211,153,0.3)] shrink-0">
                  已完工
                </span>
              )}
            </div>

            {/* MICRO: Expanded Task List */}
            {!isMacro && expanded && (
              <div className={`pl-6 border-l-2 ml-4 bg-slate-900/20 ${themeColor.border}`}>
                <TaskTreeList
                  componentId={group.id}
                  nodes={group.tasks}
                  allRoots={group.tasks}
                  viewMode={viewMode}
                  role={role}
                  milestones={milestones}
                  collisions={collisions}
                  colorIndex={idx}
                  onToggle={(taskId) => onToggleTask(group.id, taskId)}
                  onAddDelay={(parentId) => onRequestAddDelay(group.id, parentId)}
                  onUpdateDate={(taskId, start, end) => onUpdateDate(group.id, taskId, start, end)}
                  onUpdateReason={(taskId, reason) => onUpdateReason(group.id, taskId, reason)}
                  onUpdateProgress={(taskId, progress) => onUpdateProgress(group.id, taskId, progress)}
                  onDeleteLastDelay={(childId) => onDeleteLastDelay(group.id, childId)}
                  onAddTopLevelTask={(name, duration, depId, phase, assignee) => onAddTaskToComponent(group.id, name, duration, depId, phase, assignee)}
                  onUpdateAssignee={(taskId, assignee) => onUpdateAssignee(group.id, taskId, assignee)}
                  onValidateTaskDeletion={(taskId) => onValidateTaskDeletion(group.id, taskId)}
                  onDeleteTopLevelTask={(taskId) => onDeleteTask(group.id, taskId)}
                  onResetTaskProgress={(taskId) => onResetTaskProgress(group.id, taskId)}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ========================== ComponentTrack (MACRO) — Phase 20: Entity Slider ========================== */

interface ComponentTrackProps {
  group: ComponentGroup
  timelineStart: string
  dayWidth: number
  role: Role
  milestones: Milestone[]
  colorIndex: number
}

function ComponentTrack({ group, timelineStart, dayWidth, role, milestones, colorIndex }: ComponentTrackProps) {
  if (group.tasks.length === 0) {
    return <div className="border-b border-slate-800/20" style={{ height: GANTT_ROW_H.GROUP }} />
  }

  const envelopeStart = getComponentEnvelopeStart(group)
  const envelopeEnd = getComponentEnvelopeEnd(group)
  const offsetDays = diffDays(timelineStart, envelopeStart)
  const span = Math.max(1, diffDays(envelopeStart, envelopeEnd))
  const progress = getComponentAggregateProgress(group)
  const isOverdueGroup = isComponentOverdue(group)
  const isCompletedGroup = isComponentCompleted(group)

  const barWidthPx = span * dayWidth
  const barLeftPx = offsetDays * dayWidth
  const status = deriveBarStatus(isOverdueGroup, isCompletedGroup, progress)

  return (
    <div
      className="flex items-center border-b border-slate-800/20 relative hover:bg-slate-900/20 transition-colors"
      style={{ height: GANTT_ROW_H.GROUP }}
    >
      <GanttBar
        leftPx={barLeftPx}
        widthPx={barWidthPx}
        progress={progress}
        status={status}
        label={`${group.name} · ${progress}%`}
      />
    </div>
  )
}

/* ========================== MilestoneLine ========================== */

interface MilestoneLineProps {
  milestone: Milestone
  timelineStart: string
  dayWidth: number
  totalDays: number
}

// Phase 20 — MilestoneLine: thin dashed yellow, no glow
function MilestoneLine({ milestone, timelineStart, dayWidth, totalDays }: MilestoneLineProps) {
  const offset = diffDays(timelineStart, milestone.date)
  if (offset < 0 || offset >= totalDays) return null

  return (
    <div
      className="absolute top-0 bottom-0 border-l border-dashed border-yellow-500/40 pointer-events-none z-[8]"
      style={{ left: `${offset * dayWidth + dayWidth / 2}px` }}
      aria-label={`里程碑 ${milestone.name} 在 ${milestone.date}`}
    />
  )
}

/* ========================== TodayCursor ========================== */

interface TodayCursorProps {
  timelineStart: string
  dayWidth: number
  totalDays: number
}

function TodayCursor({ timelineStart, dayWidth, totalDays }: TodayCursorProps) {
  const today = todayIso()
  const offset = diffDays(timelineStart, today)
  if (offset < 0 || offset >= totalDays) return null

  return (
    <div
      className="absolute top-0 bottom-0 border-l-2 border-red-500/70 pointer-events-none z-[5]"
      style={{ left: `${offset * dayWidth + dayWidth / 2}px` }}
      aria-hidden="true"
    >
      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2">
        <span className="text-[7px] text-red-400 bg-red-950/80 px-1 py-0.5 rounded">NOW</span>
      </div>
    </div>
  )
}

/* ========================== DependencyConnectors (SVG overlay) ========================== */

interface TaskPositionEntry { yCenterPx: number; startPx: number; endPx: number; depIds: string[]; overdueSource: boolean }

function DependencyConnectors({
  positionMap,
  totalWidth,
  totalHeight,
}: {
  positionMap: Map<string, TaskPositionEntry>
  totalWidth: number
  totalHeight: number
}) {
  const paths: React.ReactNode[] = []
  positionMap.forEach((to, toId) => {
    for (const depId of to.depIds) {
      const from = positionMap.get(depId)
      if (!from) continue
      const x1 = from.endPx
      const y1 = from.yCenterPx
      const x2 = to.startPx
      const y2 = to.yCenterPx
      if (x2 <= x1 && Math.abs(y1 - y2) < 2) continue
      const midX = x1 + Math.min(12, Math.max(4, (x2 - x1) * 0.3))
      const isBlocked = from.overdueSource
      const color = isBlocked ? "rgba(239,68,68,0.7)" : "rgba(148,163,184,0.35)"
      const width = isBlocked ? 2 : 1.5
      const dashArray = isBlocked ? "6 3" : "4 3"
      paths.push(
        <g key={`${depId}->${toId}`}>
          <path
            d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeDasharray={dashArray}
          />
          {/* Arrowhead */}
          <polygon
            points={`${x2},${y2} ${x2 - 5},${y2 - 3} ${x2 - 5},${y2 + 3}`}
            fill={color}
          />
          {isBlocked && (
            <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 4} textAnchor="middle" fill="rgba(239,68,68,0.8)" fontSize="8" fontWeight="600">
              阻断
            </text>
          )}
        </g>,
      )
    }
  })
  if (paths.length === 0) return null
  return (
    <svg className="absolute inset-0 pointer-events-none z-[4]" width={totalWidth} height={totalHeight} style={{ overflow: "visible" }}>
      {paths}
    </svg>
  )
}

/* ========================== TaskTrack (MICRO) ========================== */

interface TaskTrackProps {
  node: TaskNode
  indexInParent: number
  timelineStart: string
  dayWidth: number
  viewMode: ViewMode
  role: Role
  milestones: Milestone[]
}

function TaskTrack({ node, indexInParent, timelineStart, dayWidth, viewMode, role, milestones }: TaskTrackProps) {
  const offsetDays = diffDays(timelineStart, node.startDate)
  const isMacro = viewMode === "MACRO"

  if (!node.parentId) {
    const children = (node.children ?? []) as TaskNode[]
    const hasChildren = children.length > 0
    const baseEndIso = hasChildren ? children[0].startDate : node.endDate
    const baseDays = Math.max(0, diffDays(node.startDate, baseEndIso))
    const overdue = isOverdue(node)
    const completed = isCompleted(node)
    const delayDebt = calculateDelayDebt(node)
    const hasDelayDebt = completed && delayDebt > 0
    const progress = node.progress ?? 0

    const childrenSpanDays = children.reduce((sum, c) => sum + Math.max(0, diffDays(c.startDate, c.endDate)), 0)
    const totalBarSpan = baseDays + childrenSpanDays
    const totalBarWidthPx = totalBarSpan * dayWidth
    const barLeftPx = offsetDays * dayWidth
    const status = deriveBarStatus(overdue, completed, progress)

    const segments: GanttBarSegment[] = []
    if (baseDays > 0) {
      segments.push({ widthPx: baseDays * dayWidth, type: "base", title: `${node.name} · 基准段` })
    }
    for (const c of children) {
      const segDays = Math.max(0, diffDays(c.startDate, c.endDate))
      if (segDays > 0) {
        segments.push({ widthPx: segDays * dayWidth, type: "delay", title: `${c.name}${c.reason ? ` · ${c.reason}` : ""}` })
      }
    }

    return (
      <div
        className="flex items-center border-b border-slate-800/20 relative hover:bg-slate-900/20 transition-colors"
        style={{ height: GANTT_ROW_H.TASK }}
        data-task-id={node.id}
      >
        <GanttBar
          leftPx={barLeftPx}
          widthPx={totalBarWidthPx}
          progress={progress}
          status={status}
          label={`${node.name} · ${progress}%`}
          segments={segments.length > 0 ? segments : undefined}
          delayDebt={hasDelayDebt ? delayDebt : undefined}
        />
        {/* 逾期暴力化：红色虚线直连“今日 NOW”轴 + 逾期天数徽章 */}
        {overdue && (() => {
          const overdueDays = getOverdueDays(node)
          const todayPx = diffDays(timelineStart, todayIso()) * dayWidth + dayWidth / 2
          const barRightPx = barLeftPx + totalBarWidthPx
          if (todayPx <= barRightPx || overdueDays <= 0) return null
          return (
            <>
              <div
                className="absolute pointer-events-none z-[3]"
                style={{
                  left: `${barRightPx}px`,
                  width: `${todayPx - barRightPx}px`,
                  top: "50%",
                  height: 0,
                  borderTop: "2px dashed rgba(239,68,68,0.6)",
                }}
              />
              <span
                className="absolute text-[10px] font-bold text-red-300 bg-red-950/95 px-1.5 py-0.5 rounded border border-red-500/60 pointer-events-none z-[6] whitespace-nowrap animate-pulse"
                style={{
                  left: `${todayPx + 4}px`,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              >
                已逾期 {overdueDays} 天
              </span>
            </>
          )
        })()}
      </div>
    )
  }

  // Child (delay record) row — striped entity slider
  const span = Math.max(1, diffDays(node.startDate, node.endDate))
  const childBarWidthPx = span * dayWidth
  const childIsNarrow = childBarWidthPx < 80
  const childBarLeftPx = offsetDays * dayWidth

  return (
    <div
      className="flex items-center border-b border-slate-800/15 relative hover:bg-slate-900/10 transition-colors"
      style={{ height: GANTT_ROW_H.TASK }}
      data-task-id={node.id}
    >
      <div
        className="absolute h-5 rounded overflow-hidden gantt-delay-stripe"
        style={{
          left: `${childBarLeftPx}px`,
          width: `${childBarWidthPx}px`,
          top: "50%",
          transform: "translateY(-50%)",
          border: "1px solid rgba(220,38,38,0.3)",
        }}
        title={`${node.name} · ${node.startDate} → ${node.endDate}${node.reason ? ` · ${node.reason}` : ""}`}
      >
        {!childIsNarrow && (
          <div className="absolute inset-0 z-10 flex items-center px-2 pointer-events-none overflow-hidden">
            <span className="text-[9px] font-medium truncate text-amber-100">
              {node.name}
            </span>
          </div>
        )}
      </div>
      {childIsNarrow && (
        <div className="absolute top-1/2 -translate-y-1/2 ml-2 pointer-events-none whitespace-nowrap" style={{ left: `${childBarLeftPx + childBarWidthPx}px` }}>
          <span className="text-[9px] font-medium text-amber-200/80">{node.name}</span>
        </div>
      )}
    </div>
  )
}
