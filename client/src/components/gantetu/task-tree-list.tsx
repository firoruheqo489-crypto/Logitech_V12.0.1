import { useState, useCallback } from "react"
import type { CollisionState, Milestone, Role, TaskNode, ViewMode } from "@/lib/gantt/types"
import { getRoots, isCompleted, isOverdue, isTaskCollidingMilestone, type DeletionValidation } from "@/lib/gantt/utils"
import { DeletionModal } from "./deletion-modal"
import { RejectionToast } from "./rejection-toast"

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

          // In MACRO mode, only show top-level roots (skip child rows entirely)
          if (isMacro && isChildRow) return null

          // Phase 11 — Stealth Inputs: transparent bg, only border-b on focus
          const dateCls = isParent
            ? "bg-transparent border-0 border-b border-slate-800/30 text-slate-600 opacity-50 cursor-not-allowed px-1 py-0.5 text-[10px] font-mono"
            : "bg-transparent border-0 border-b border-transparent text-slate-300 px-1 py-0.5 text-[10px] font-mono focus:outline-none focus:border-b focus:border-cyan-500 transition-colors"

          // Phase 11 — Status indicator logic
          const overdue = isOverdue(node)
          const completed = isCompleted(node)
          const inProgress = !isChildRow && !completed && !overdue && (node.progress ?? 0) > 0

          return (
            <li key={node.id} className="border-b border-slate-800/30">
              <div
                className="min-h-[72px] flex flex-wrap items-center gap-x-2 gap-y-1.5 py-2 pr-3 hover:bg-slate-800/40 transition-colors whitespace-nowrap"
                style={{ paddingLeft: `${12 + depth * 18}px` }}
              >
                {/* Phase 11 — Status Indicator Light */}
                {!isChildRow && (
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      completed
                        ? "bg-emerald-600/80"
                        : overdue
                          ? "bg-red-500 gantt-status-overdue"
                          : inProgress
                            ? "bg-blue-400 gantt-status-active"
                            : "bg-slate-700"
                    }`}
                    title={completed ? "已完工" : overdue ? "已逾期" : inProgress ? "进行中" : "待开始"}
                  />
                )}

                {/* Fold toggle — disabled in MACRO mode */}
                <button
                  type="button"
                  aria-label={expanded ? "折叠" : "展开"}
                  onClick={() => onToggle(node.id)}
                  disabled={!isParent || isMacro}
                  className="w-4 h-4 flex items-center justify-center text-slate-600 hover:text-cyan-400 disabled:opacity-20 disabled:cursor-default transition-colors"
                >
                  {!isParent ? <span className="text-slate-700">·</span> : isMacro ? "▸" : expanded ? "▾" : "▸"}
                </button>

                {/* Name — Phase 15: 扩展宽度，防止折叠 */}
                <span
                  className={`w-36 truncate shrink-0 ${
                    completed
                      ? "text-emerald-500/80"
                      : overdue
                        ? "text-red-400"
                        : isChildRow
                          ? "text-slate-400"
                          : "text-slate-200"
                  }`}
                  title={node.name}
                >
                  {node.name}
                </span>

                {/* 强制换行：上行 = 状态+名称，下行 = 日期+进度+动作 */}
                <div className="basis-full h-0" aria-hidden />

                {/* Dates */}
                <input
                  type="date"
                  value={node.startDate}
                  disabled={isParent}
                  onChange={(e) => onUpdateDate(node.id, e.target.value, node.endDate)}
                  className={dateCls}
                />
                <input
                  type="date"
                  value={node.endDate}
                  disabled={isParent}
                  onChange={(e) => onUpdateDate(node.id, node.startDate, e.target.value)}
                  className={dateCls}
                />

                {/* 追责输入框 — 仅在子节点（延期记录）行内显示 */}
                {isChildRow ? (
                  (() => {
                    // Phase 10: 查找父节点判断是否已封板
                    const parentNode = allRoots.find((r) => r.id === node.parentId)
                    const parentCompleted = parentNode ? isCompleted(parentNode) : false
                    return (
                      <input
                        type="text"
                        value={node.reason ?? ""}
                        onChange={(e) => onUpdateReason(node.id, e.target.value)}
                        placeholder="输入延期原因..."
                        disabled={parentCompleted}
                        className={`flex-1 min-w-0 border-0 border-b focus:outline-none text-[10px] px-1.5 py-0.5 font-mono transition-colors ${
                          parentCompleted
                            ? "bg-transparent border-emerald-900/30 text-emerald-600/60 cursor-not-allowed"
                            : "bg-transparent border-transparent hover:border-slate-700 focus:border-cyan-500 text-slate-400 placeholder:text-slate-700"
                        }`}
                        aria-label={`${node.name} 延期原因`}
                        title={parentCompleted ? "父工序已100%完工封板，延期原因不可篡改" : undefined}
                      />
                    )
                  })()
                ) : (
                  /* 物理完成度输入 — Phase 7/8/10: 时间真空锁死 + 暗雷碰撞锁定 + 100%完工封板 */
                  (() => {
                    const progressOverdue = isOverdue(node)
                    const progressCompleted = isCompleted(node)
                    const collision = isTaskCollidingMilestone(node, milestones)
                    const isColliding = collision !== null
                    // USER 视角下，碰撞触发行政锁定
                    const isAdminLockedByCollision = isColliding && role === "USER"
                    // Phase 10: 100%完工绝对锁死（不允许将100%改回90%）
                    const isCompletionLocked = progressCompleted
                    const isLocked = progressOverdue || isAdminLockedByCollision || isCompletionLocked
                    return (
                      <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                        {/* Phase 15: 极简锁死状态 — 使用图标代替文字标签 */}
                        {isCompletionLocked && (
                          <span
                            className="text-emerald-500/80"
                            title="100%完工封板 — 历史事实已固化，不允许篡改"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                        {(progressOverdue || isAdminLockedByCollision) && !isCompletionLocked && (
                          <span
                            className="text-red-500/80"
                            title={isAdminLockedByCollision ? "触碰隐蔽底线 — 已触发全局交付风险，请向项目经理申请排期解锁" : "时间真空锁死 — 必须先延期才能更新进度"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </span>
                        )}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={node.progress ?? 0}
                          onChange={(e) => onUpdateProgress(node.id, Number.parseInt(e.target.value, 10) || 0)}
                          disabled={isLocked}
                          className={`w-12 border-0 border-b text-center text-[10px] px-1 py-0.5 font-mono focus:outline-none transition-colors ${
                            isCompletionLocked
                              ? "bg-transparent border-emerald-700/50 text-emerald-400/80 cursor-not-allowed"
                              : isLocked
                                ? "bg-transparent border-red-800/50 text-slate-600 cursor-not-allowed"
                                : "bg-transparent border-transparent hover:border-slate-700 focus:border-cyan-500 text-slate-200"
                          }`}
                          aria-label={`${node.name} 完成度`}
                          title={
                            isCompletionLocked
                              ? "100%完工封板：历史事实已固化，不允许篡改"
                              : isAdminLockedByCollision
                                ? "触碰隐蔽底线：已触发全局交付风险，请向项目经理申请排期解锁"
                                : progressOverdue
                                  ? "时间真空锁死：任务已逾期且未完成，必须先点击 [+延期] 将 endDate 推至 Today 之后才能更新进度"
                                  : undefined
                          }
                        />
                        <span className="text-[9px] text-slate-600 font-mono">%</span>
                        {/* Phase 10: ADMIN专用解锁按钮 */}
                        {isCompletionLocked && role === "ADMIN" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`确定要解除 "${node.name}" 的100%完工封板吗？此操作将被记录。`)) {
                                onResetTaskProgress(node.id)
                              }
                            }}
                            className="w-4 h-4 flex items-center justify-center text-fuchsia-500/70 hover:text-fuchsia-300 transition-colors"
                            title="ADMIN专用：强制解除100%封板"
                            aria-label={`解锁 ${node.name}`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })()
                )}

                {/* 右侧���作区 */}
                {!isChildRow ? (
                  (() => {
                    const actionCompleted = isCompleted(node)
                    return (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Phase 10: 100%完工后剥夺 [+延期] 按钮 */}
                        {!actionCompleted ? (
                          <button
                            type="button"
                            onClick={() => onAddDelay(node.id)}
                            className="px-2.5 py-1 border border-slate-700/60 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/70 hover:bg-cyan-950/30 text-[9px] rounded transition-all shadow-[0_0_0_rgba(6,182,212,0)] hover:shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                          >
                            + 延期报备
                          </button>
                        ) : (
                          <span
                            className="px-2.5 py-1 text-[8px] text-emerald-500/80 bg-emerald-950/30 border border-emerald-700/40 rounded select-none"
                            title="100%完工��板：不允许再延期"
                          >
                            已封板
                          </span>
                        )}
                        {/* Phase 9 — 删除按钮 */}
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(node.id, node.name)}
                          title="物理销毁该工序"
                          className="w-6 h-6 flex items-center justify-center text-slate-700 hover:text-red-500 hover:bg-red-950/30 rounded transition-all"
                          aria-label={`删除 ${node.name}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )
                  })()
                ) : isLastChildOfParent ? (
                  (() => {
                    // Phase 10: 父节点100%完工���禁用LIFO删除
                    const parentNode = allRoots.find((r) => r.id === node.parentId)
                    const parentCompleted = parentNode ? isCompleted(parentNode) : false
                    if (parentCompleted) {
                      return (
                        <span
                          className="w-5 h-5 flex items-center justify-center text-emerald-800/50 select-none flex-shrink-0"
                          title="父工序已100%完工封板，延期记录不可删除"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </span>
                      )
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => onDeleteLastDelay(node.id)}
                        title="LIFO 撤销本次延期"
                        className="w-5 h-5 flex items-center justify-center text-slate-700 hover:text-rose-400 transition-colors flex-shrink-0"
                        aria-label={`撤销 ${node.name}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )
                  })()
                ) : (
                  <span
                    className="w-5 h-5 flex items-center justify-center text-slate-800 select-none flex-shrink-0"
                    title="LIFO 保护：仅允许从最后一次延期开始撤销"
                    aria-hidden
                  >
                    ·
                  </span>
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
      <div className="sticky bottom-0 border-t border-slate-800/40 bg-[#0f1729] px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full py-2.5 border border-dashed border-slate-700/60 text-slate-500 hover:border-cyan-500/70 hover:text-cyan-400 hover:bg-cyan-950/20 text-[10px] rounded transition-all shadow-[0_0_0_rgba(6,182,212,0)] hover:shadow-[0_0_12px_rgba(6,182,212,0.2)]"
        >
          + 新增基础工序
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
