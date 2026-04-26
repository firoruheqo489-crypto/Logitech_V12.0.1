import { useState, useCallback } from "react"
import type { CollisionState, Milestone, Role, TaskNode, ViewMode } from "@/lib/gantt/types"
import { getRoots, isCompleted, isOverdue, isTaskCollidingMilestone, type DeletionValidation } from "@/lib/gantt/utils"
import { DeletionModal } from "./deletion-modal"
import { RejectionToast } from "./rejection-toast"

/** Compress ISO date 'YYYY-MM-DD' → 'MM/DD' for compact display */
function fmtDate(iso: string): string {
  const parts = iso.split("-")
  return `${parts[1]}/${parts[2]}`
}

interface TaskTreeListProps {
  /** Phase 13 — 所属部件组 ID（用于工序录入时的依赖选择） */
  componentId: string
  nodes: TaskNode[]
  allRoots: TaskNode[]
  depth?: number
  viewMode: ViewMode
  role: Role
  milestones: Milestone[]
  collisions: CollisionState[]
  /** Phase 15 — 色谱遗传：父级部件的颜色索引 */
  colorIndex?: number
  onToggle: (id: string) => void
  onAddDelay: (parentId: string) => void
  onUpdateDate: (id: string, start: string, end: string) => void
  onUpdateReason: (id: string, reason: string) => void
  onUpdateProgress: (id: string, progress: number) => void
  onDeleteLastDelay: (childId: string) => void
  onAddTopLevelTask: (name: string, duration: number, depId: string | null, iterationPhase: string) => void
  /** Phase 9 — 删除工序 */
  onValidateTaskDeletion: (taskId: string) => DeletionValidation
  onDeleteTopLevelTask: (taskId: string) => void
  /** Phase 10 — ADMIN 进度重置 */
  onResetTaskProgress: (taskId: string) => void
}

/**
 * Left-panel recursive tree.
 *
 * Protocols enforced:
 *   • Lockdown    — parents never expose editable date inputs.
 *   • Anti-Matryoshka — "+延期" appears ONLY on top-level roots.
 *   • LIFO Undo   — [x] delete appears ONLY on parent's last child.
 *   • MACRO降噪  — children are hidden + fold toggle disabled in MACRO mode.
 */
export function TaskTreeList(props: TaskTreeListProps) {
  const {
    componentId,
    nodes,
    allRoots,
    depth = 0,
    viewMode,
    role,
    milestones,
    collisions,
    colorIndex = 0,
    onToggle,
    onAddDelay,
    onUpdateDate,
    onUpdateReason,
    onUpdateProgress,
    onDeleteLastDelay,
    onAddTopLevelTask,
    onValidateTaskDeletion,
    onDeleteTopLevelTask,
    onResetTaskProgress,
  } = props

  const isMacro = viewMode === "MACRO"

  // Phase 9 — 删除状态管理
  const [deletionTarget, setDeletionTarget] = useState<{ id: string; name: string } | null>(null)
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null)

  const handleDeleteClick = useCallback(
    (taskId: string, taskName: string) => {
      const validation = onValidateTaskDeletion(taskId)
      if (!validation.canDelete) {
        setRejectionMessage(validation.reason ?? "拒绝执行。行政链条不可截断。")
        return
      }
      // 通过校验，显示行政防呆模态框
      setDeletionTarget({ id: taskId, name: taskName })
    },
    [onValidateTaskDeletion],
  )

  const handleConfirmDelete = useCallback(() => {
    if (!deletionTarget) return
    onDeleteTopLevelTask(deletionTarget.id)
    setDeletionTarget(null)
  }, [deletionTarget, onDeleteTopLevelTask])

  return (
    <>
      <ul className="font-mono text-[11px]">
        {nodes.map((node, i) => {
          const isParent = !!(node.children && node.children.length > 0)
          const expanded = node.isExpanded !== false
          const isChildRow = !!node.parentId
          const isLastChildOfParent = isChildRow && i === nodes.length - 1

          if (isMacro && isChildRow) return null

          const overdue = isOverdue(node)
          const completed = isCompleted(node)
          const inProgress = !isChildRow && !completed && !overdue && (node.progress ?? 0) > 0

          const dotCls = completed
            ? "bg-emerald-500"
            : overdue
              ? "bg-red-500"
              : inProgress
                ? "bg-blue-500"
                : "bg-slate-600"

          const nameCls = completed
            ? "text-emerald-400"
            : overdue
              ? "text-red-400"
              : isChildRow
                ? "text-slate-400"
                : "text-slate-100"

          return (
            <li key={node.id} className="border-b border-slate-800/30">
              {/* ━━ Row: group scope on inner div to avoid leaking into recursive children ━━ */}
              <div
                className="group h-10 flex items-center gap-1.5 pr-3 transition-colors hover:bg-slate-800/40"
                style={{ paddingLeft: `${8 + depth * 14}px` }}
              >
                {/* ── Left Zone: status + toggle + name ── */}
                {!isChildRow && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`}
                    title={completed ? "已完工" : overdue ? "已逾期" : inProgress ? "进行中" : "待开始"}
                  />
                )}

                <button
                  type="button"
                  aria-label={expanded ? "折叠" : "展开"}
                  onClick={() => onToggle(node.id)}
                  disabled={!isParent || isMacro}
                  className="w-4 h-4 flex items-center justify-center text-slate-600 shrink-0 hover:text-cyan-400 disabled:opacity-20 disabled:cursor-default transition-colors text-[10px]"
                >
                  {!isParent ? <span className="text-slate-700">·</span> : expanded ? "▾" : "▸"}
                </button>

                <span className={`flex-1 min-w-0 truncate ${nameCls}`} title={node.name}>
                  {node.name}
                </span>


                {/* ── Right Zone ── */}
                {isChildRow ? (
                  /* ── Child row (delay record): reason + compact date + LIFO ── */
                  (() => {
                    const parentNode = allRoots.find((r) => r.id === node.parentId)
                    const parentCompleted = parentNode ? isCompleted(parentNode) : false
                    return (
                      <>
                        <input
                          type="text"
                          value={node.reason ?? ""}
                          onChange={(e) => onUpdateReason(node.id, e.target.value)}
                          placeholder="原因…"
                          disabled={parentCompleted}
                          className={`w-16 min-w-0 shrink bg-transparent border-0 border-b text-[10px] font-mono px-1 py-0 focus:outline-none transition-colors ${
                            parentCompleted
                              ? "border-emerald-900/30 text-emerald-600/60 cursor-not-allowed"
                              : "border-transparent hover:border-slate-700 focus:border-cyan-500 text-slate-400 placeholder:text-slate-700"
                          }`}
                          aria-label={`${node.name} 延期原因`}
                          title={parentCompleted ? "父工序已封板" : undefined}
                        />
                        <span className="tabular-nums text-[10px] text-slate-600 shrink-0 tracking-tight">
                          {fmtDate(node.startDate)}–{fmtDate(node.endDate)}
                        </span>
                        {isLastChildOfParent ? (
                          <button
                            type="button"
                            onClick={() => onDeleteLastDelay(node.id)}
                            title="LIFO 撤销"
                            className="w-5 h-5 flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all shrink-0"
                            aria-label={`撤销 ${node.name}`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        ) : (
                          <span className="w-5 shrink-0" aria-hidden />
                        )}
                      </>
                    )
                  })()
                ) : (
                  /* ── Parent / Leaf row: dates (default) ↔ ghost actions (hover) ── */
                  <>
                    {/* Dates — visible by default, hidden on group-hover */}
                    <div className="flex items-center gap-0.5 shrink-0 group-hover:hidden">
                      <span className="relative tabular-nums text-[10px] text-slate-500 tracking-tight cursor-default">
                        {fmtDate(node.startDate)}
                        {!isParent && (
                          <input
                            type="date"
                            value={node.startDate}
                            onChange={(e) => onUpdateDate(node.id, e.target.value, node.endDate)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            tabIndex={-1}
                            aria-label={`${node.name} 开始日期`}
                          />
                        )}
                      </span>
                      <span className="text-slate-700 text-[8px]">–</span>
                      <span className="relative tabular-nums text-[10px] text-slate-500 tracking-tight cursor-default">
                        {fmtDate(node.endDate)}
                        {!isParent && (
                          <input
                            type="date"
                            value={node.endDate}
                            onChange={(e) => onUpdateDate(node.id, node.startDate, e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            tabIndex={-1}
                            aria-label={`${node.name} 结束日期`}
                          />
                        )}
                      </span>
                    </div>

                    {/* Ghost actions — hidden by default, visible on group-hover */}
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onAddDelay(node.id)}
                        title="延期报备"
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-cyan-400 hover:bg-cyan-950/30 rounded transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(node.id, node.name)}
                        title="删除工序"
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded transition-all"
                        aria-label={`删除 ${node.name}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Recursively render children unless MACRO mode */}
              {isParent && expanded && !isMacro && (
                <TaskTreeList
                  componentId={componentId}
                  nodes={node.children as TaskNode[]}
                  allRoots={allRoots}
                  depth={depth + 1}
                  viewMode={viewMode}
                  role={role}
                  milestones={milestones}
                  collisions={collisions}
                  colorIndex={colorIndex}
                  onToggle={onToggle}
                  onAddDelay={onAddDelay}
                  onUpdateDate={onUpdateDate}
                  onUpdateReason={onUpdateReason}
                  onUpdateProgress={onUpdateProgress}
                  onDeleteLastDelay={onDeleteLastDelay}
                  onAddTopLevelTask={onAddTopLevelTask}
                  onValidateTaskDeletion={onValidateTaskDeletion}
                  onDeleteTopLevelTask={onDeleteTopLevelTask}
                  onResetTaskProgress={onResetTaskProgress}
                />
              )}
            </li>
          )
        })}
      </ul>

      {/* -------------------- Blackboard Spawner (bottom) -------------------- */}
      {depth === 0 && <BlackboardSpawner roots={allRoots} onAdd={onAddTopLevelTask} />}

      {/* Phase 9 — 行政防呆模态框 */}
      {depth === 0 && deletionTarget && (
        <DeletionModal
          itemType="task"
          itemName={deletionTarget.name}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletionTarget(null)}
        />
      )}

      {/* Phase 9 — 拒绝 Toast */}
      {depth === 0 && rejectionMessage && (
        <RejectionToast message={rejectionMessage} onClose={() => setRejectionMessage(null)} />
      )}
    </>
  )
}

/* -------------------------------- Spawner -------------------------------- */

interface BlackboardSpawnerProps {
  roots: TaskNode[]
  onAdd: (name: string, duration: number, depId: string | null, iterationPhase: string) => void
}

/**
 * Phase 5 — 强依赖约束录入沙盘。
 * 三字段硬拦截：任务名称、标准天数、前置工序 都必须填写或选择后才能提交。
 */
function BlackboardSpawner({ roots, onAdd }: BlackboardSpawnerProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [duration, setDuration] = useState("")
  const [depId, setDepId] = useState<string | null>(null)
  const [iterationPhase, setIterationPhase] = useState("T0") // Phase 10
  const [errors, setErrors] = useState<{ name?: string; duration?: string }>({})

  const topLevelRoots = getRoots(roots)

  const validate = (): boolean => {
    const errs: { name?: string; duration?: string } = {}
    if (!name.trim()) errs.name = "必填"
    const dur = Number.parseInt(duration, 10)
    if (!duration || !Number.isFinite(dur) || dur <= 0) errs.duration = "需 > 0"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const dur = Number.parseInt(duration, 10)
    onAdd(name.trim(), dur, depId, iterationPhase)
    // Reset form
    setName("")
    setDuration("")
    setDepId(null)
    setIterationPhase("T0")
    setErrors({})
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="sticky bottom-0 border-t border-slate-800/40 bg-[#0f1729] px-3 h-7 flex items-center opacity-20 hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full py-0.5 border border-dashed border-slate-700/60 text-slate-500 hover:border-cyan-500/70 hover:text-cyan-400 hover:bg-cyan-950/20 text-[9px] rounded transition-all"
        >
          + 新增工序
        </button>
      </div>
    )
  }

  return (
    <div className="sticky bottom-0 border-t border-cyan-800/30 bg-[#111827] px-4 py-4 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.3)]">
      {/* 字段 1：任务名称 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="工序名称 *"
            className={`w-full bg-transparent border-0 border-b text-slate-200 px-1 py-1.5 text-[11px] focus:outline-none transition-colors ${
              errors.name ? "border-rose-500 focus:border-rose-400" : "border-slate-700 focus:border-cyan-500"
            }`}
            autoFocus
          />
          {errors.name && <span className="absolute right-1 top-1.5 text-[8px] text-rose-400">{errors.name}</span>}
        </div>
        {/* 字段 3：标准天数 */}
        <div className="w-24 relative">
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min={1}
            placeholder="标准工期(天) *"
            className={`w-full bg-transparent border-0 border-b text-slate-200 px-1 py-1.5 text-[11px] text-center focus:outline-none transition-colors ${
              errors.duration ? "border-rose-500 focus:border-rose-400" : "border-slate-700 focus:border-cyan-500"
            }`}
          />
          {errors.duration && <span className="absolute right-1 top-1.5 text-[8px] text-rose-400">{errors.duration}</span>}
        </div>
      </div>
      {/* 字段 2：前置工序 + 所属阶段 */}
      <div className="flex items-center gap-3">
        <label className="text-[9px] text-slate-600 whitespace-nowrap">前置依赖:</label>
        <select
          value={depId ?? ""}
          onChange={(e) => setDepId(e.target.value || null)}
          className="flex-1 bg-transparent border-0 border-b border-slate-700 text-slate-300 px-1 py-1 text-[10px] focus:outline-none focus:border-cyan-500 transition-colors"
        >
          <option value="">无 / 开端</option>
          {topLevelRoots.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.endDate})
            </option>
          ))}
        </select>
        {/* Phase 10 — 所属阶段选择器 */}
        <label className="text-[9px] text-slate-600 whitespace-nowrap">阶段:</label>
        <select
          value={iterationPhase}
          onChange={(e) => setIterationPhase(e.target.value)}
          className="w-16 bg-transparent border-0 border-b border-slate-700 text-slate-300 px-1 py-1 text-[10px] focus:outline-none focus:border-cyan-500 transition-colors"
          title="所属迭代阶段（T0/T1/T2...），为跨阶段基线重置预留"
        >
          <option value="T0">T0</option>
          <option value="T1">T1</option>
          <option value="T2">T2</option>
          <option value="T3">T3</option>
        </select>
      </div>
      {/* 操作按钮 */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[10px] font-medium rounded shadow-[0_0_12px_rgba(6,182,212,0.4)] hover:shadow-[0_0_18px_rgba(6,182,212,0.6)] transition-all"
        >
          确认录入
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setErrors({})
          }}
          className="px-4 py-2 border border-slate-700/60 text-slate-500 hover:text-slate-300 hover:border-slate-500 hover:bg-slate-800/30 text-[10px] rounded transition-all"
        >
          取消
        </button>
      </div>
    </div>
  )
}
