import { useCallback, useEffect, useMemo, useState } from "react"
import { GANTT_ROW_H } from "@/lib/gantt/row-heights"
import { useRef } from "react"
import { createPortal } from "react-dom"
import type { CollisionState, Milestone, Role, TaskNode, ViewMode } from "@/lib/gantt/types"
import { diffDays, getRoots, getScheduleProgress, isCompleted, isOverdue, isTaskCollidingMilestone, todayIso } from "@/lib/gantt/utils"
import CyberPromptDialog from "@/components/ui/CyberPromptDialog"
import { DeletionModal } from "./deletion-modal"
import { RejectionToast } from "./rejection-toast"

/** Compress ISO date 'YYYY-MM-DD' 鈫?'MM/DD' for compact display */
function fmtDate(iso: string): string {
  const parts = iso.split("-")
  return `${parts[1]}/${parts[2]}`
}

function fmtDelayLabel(startDate: string, endDate: string): string {
  const delayDays = Math.max(1, diffDays(startDate, endDate) + 1)
  return delayDays === 1 ? "+1天" : `delay +${delayDays}天`
}

function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return
  const pickerInput = input as HTMLInputElement & { showPicker?: () => void }
  if (typeof pickerInput.showPicker === "function") {
    pickerInput.showPicker()
    return
  }
  input.focus()
  input.click()
}

interface TaskTreeListProps {
  /** Phase 13 鈥?鎵€灞為儴浠剁粍 ID锛堢敤浜庡伐搴忓綍鍏ユ椂鐨勪緷璧栭€夋嫨锛?*/
  componentId: string
  nodes: TaskNode[]
  allRoots: TaskNode[]
  depth?: number
  viewMode: ViewMode
  role: Role
  milestones: Milestone[]
  collisions: CollisionState[]
  /** Phase 15 鈥?鑹茶氨閬椾紶锛氱埗绾ч儴浠剁殑棰滆壊绱㈠紩 */
  colorIndex?: number
  onToggle: (id: string) => void
  onAddDelay: (parentId: string) => void
  onUpdateName: (id: string, name: string) => void
  onUpdateTag: (id: string, tag: string) => void
  onUpdateDate: (id: string, start: string, end: string) => void
  onUpdateReason: (id: string, reason: string) => void
  onUpdateProgress: (id: string, progress: number) => void
  onDeleteLastDelay: (childId: string) => void
  onAddTopLevelTask: (name: string, startDate: string, endDate: string, depId: string | null, tag?: string) => void
  onUpdateAssignee: (id: string, assignee: string) => void
  onDeleteTopLevelTask: (taskId: string) => void
  /** Phase 10 鈥?ADMIN 杩涘害閲嶇疆 */
  onResetTaskProgress: (taskId: string) => void
}

/**
 * Left-panel recursive tree.
 *
 * Protocols enforced:
 *   鈥?Lockdown    鈥?parents never expose editable date inputs.
 *   鈥?Anti-Matryoshka 鈥?"+寤舵湡" appears ONLY on top-level roots.
 *   鈥?LIFO Undo   鈥?[x] delete appears ONLY on parent's last child.
 *   鈥?MACRO闄嶅櫔  鈥?children are hidden + fold toggle disabled in MACRO mode.
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
    onUpdateName,
    onUpdateTag,
    onUpdateDate,
    onUpdateReason,
    onUpdateProgress,
    onDeleteLastDelay,
    onAddTopLevelTask,
    onUpdateAssignee,
    onDeleteTopLevelTask,
    onResetTaskProgress,
  } = props

  const isMacro = viewMode === "MACRO"

  // Phase 9 - 删除状态管理
  const [deletionTarget, setDeletionTarget] = useState<{ id: string; name: string } | null>(null)
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<TaskNode | null>(null)

  const handleDeleteClick = useCallback(
    (taskId: string, taskName: string) => {
      setDeletionTarget({ id: taskId, name: taskName })
    },
    [],
  )

  const handleConfirmDelete = useCallback(() => {
    if (!deletionTarget) return
    onDeleteTopLevelTask(deletionTarget.id)
    setDeletionTarget(null)
  }, [deletionTarget, onDeleteTopLevelTask])

  const handleCloseEdit = useCallback(() => {
    setEditTarget(null)
  }, [])

  const handleConfirmEdit = useCallback(
    (values: Record<string, string>) => {
      if (!editTarget) return

      const name = (values.name ?? "").trim()
      const tag = (values.tag ?? "").trim()
      if (!name) {
        setRejectionMessage("工序名称不能为空。")
        return
      }

      const hasDelayChildren = (editTarget.children?.length ?? 0) > 0
      if (!hasDelayChildren) {
        const startDate = values.startDate ?? ""
        const endDate = values.endDate ?? ""
        if (!startDate || !endDate) {
          setRejectionMessage("开始时间和截至时间不能为空。")
          return
        }
        if (startDate > endDate) {
          setRejectionMessage("截至时间不能早于开始时间。")
          return
        }
        onUpdateDate(editTarget.id, startDate, endDate)
      }

      onUpdateName(editTarget.id, name)
      onUpdateTag(editTarget.id, tag)
      setEditTarget(null)
    },
    [editTarget, onUpdateDate, onUpdateName, onUpdateTag],
  )

  const editTargetHasDelayChildren = (editTarget?.children?.length ?? 0) > 0
  const editFields = editTarget
    ? [
        {
          kind: "text" as const,
          name: "name",
          label: "工序名称",
          defaultValue: editTarget.name,
          required: true,
          maxLength: 80,
        },
        {
          kind: "text" as const,
          name: "tag",
          label: "标签",
          defaultValue: editTarget.tag ?? "",
          placeholder: "例如：待确认钢材 / 客供图纸 / 风险点",
          maxLength: 120,
        },
        ...(!editTargetHasDelayChildren
          ? [
              {
                kind: "date" as const,
                name: "startDate",
                label: "开始时间",
                defaultValue: editTarget.startDate,
                required: true,
              },
              {
                kind: "date" as const,
                name: "endDate",
                label: "截至时间",
                defaultValue: editTarget.endDate,
                required: true,
              },
            ]
          : []),
      ]
    : []

  return (
    <>
      <ul className="text-[13px]">
        {nodes.map((node, i) => {
          const isParent = !!(node.children && node.children.length > 0)
          const expanded = node.isExpanded !== false
          const isChildRow = !!node.parentId
          const isLastChildOfParent = isChildRow && i === nodes.length - 1

          if (isMacro && isChildRow) return null

          const overdue = isOverdue(node)
          const completed = isCompleted(node)
          const hasStarted = node.status === "in-progress" || getScheduleProgress(node) > 0
          const isTopLevelAmber = !isChildRow && !completed && !overdue
          const inProgress = isTopLevelAmber && hasStarted

          const dotCls = completed
            ? "bg-emerald-500"
            : overdue
              ? "bg-red-500"
              : isTopLevelAmber
                ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.45)]"
                : "bg-slate-600"

          const nameCls = completed
            ? "text-emerald-400"
            : overdue
              ? "text-red-400"
              : isTopLevelAmber
                ? "text-amber-200"
              : isChildRow
                ? "text-slate-400"
                : "text-slate-100"
          const dateCls = completed
            ? "text-emerald-300"
            : overdue
              ? "text-red-300"
              : isTopLevelAmber
                ? "text-amber-200"
                : "text-slate-500"
          const dateDividerCls = completed
            ? "text-emerald-500/80"
            : overdue
              ? "text-red-500/80"
              : isTopLevelAmber
                ? "text-amber-400/80"
                : "text-slate-700"

          return (
            <li key={node.id}>
              {/* 鈹佲攣 Row: 楂樺害浠?GANTT_ROW_H.TASK 鍙栧€硷紝涓庡彸渚?TaskTrack 鐗╃悊閿佹 鈹佲攣 */}
              <div
                className="group box-border flex flex-col justify-center gap-1 pr-3 border-b border-slate-800/30 transition-colors hover:bg-slate-800/40"
                style={{ height: GANTT_ROW_H.TASK, paddingLeft: `${8 + depth * 14}px` }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {!isChildRow && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`}
                      title={completed ? "已完工" : overdue ? "已逾期" : hasStarted ? "进行中" : "待开始"}
                    />
                  )}

                  <button
                    type="button"
                    aria-label={expanded ? "收起" : "展开"}
                    onClick={() => onToggle(node.id)}
                    disabled={!isParent || isMacro}
                    className="w-4 h-4 flex items-center justify-center text-slate-600 shrink-0 hover:text-cyan-400 disabled:opacity-20 disabled:cursor-default transition-colors text-[10px]"
                  >
                    {!isParent ? <span className="text-slate-700">·</span> : expanded ? "▼" : "▶"}
                  </button>

                  <span
                    className={`flex-1 min-w-0 text-[12px] leading-4 truncate ${nameCls}`}
                    title={node.tag?.trim() ? `${node.name} · 标签：${node.tag.trim()}` : node.name}
                  >
                    {node.name}
                  </span>
                </div>

                {isChildRow ? (
                  (() => {
                    const parentNode = allRoots.find((r) => r.id === node.parentId)
                    const parentCompleted = parentNode ? isCompleted(parentNode) : false
                    const delayLabel = fmtDelayLabel(node.startDate, node.endDate)
                    return (
                      <div className="flex flex-col gap-1 pl-7 min-w-0">
                        <input
                          type="text"
                          value={node.reason ?? ""}
                          onChange={(e) => onUpdateReason(node.id, e.target.value)}
                          placeholder="延期原因"
                          disabled={parentCompleted}
                          className={`w-full min-w-0 bg-transparent border-0 border-b text-[11px] font-mono px-1 py-0.5 leading-4 focus:outline-none transition-colors ${
                            parentCompleted
                              ? "border-emerald-900/30 text-emerald-600/60 cursor-not-allowed"
                              : "border-transparent hover:border-slate-700 focus:border-cyan-500 text-slate-400 placeholder:text-slate-700"
                          }`}
                          aria-label={`${node.name} 延期原因`}
                          title={parentCompleted ? "父工序已封板" : undefined}
                        />
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex min-w-0 items-center gap-2 text-[12px] tracking-tight">
                            <span className="shrink-0 rounded border border-rose-500/25 bg-rose-950/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200">
                              {delayLabel}
                            </span>
                            <span className="min-w-0 truncate tabular-nums text-slate-500">
                              {fmtDate(node.startDate)}–{fmtDate(node.endDate)}
                            </span>
                          </div>
                          {isLastChildOfParent ? (
                            <button
                              type="button"
                              onClick={() => onDeleteLastDelay(node.id)}
                              title="LIFO 鎾ら攢"
                              className="w-5 h-5 flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all shrink-0"
                              aria-label={`鎾ら攢 ${node.name}`}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          ) : (
                            <span className="w-5 shrink-0" aria-hidden />
                          )}
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <div className="flex items-center justify-between gap-2 pl-7 min-w-0">
                    <div className="flex items-center gap-0.5 shrink-0 min-w-0">
                      <span className={`tabular-nums text-[12px] tracking-tight cursor-default ${dateCls}`}>
                        {fmtDate(node.startDate)}
                      </span>
                      <span className={`text-[8px] ${dateDividerCls}`}>–</span>
                      <span className={`tabular-nums text-[12px] tracking-tight cursor-default ${dateCls}`}>
                        {fmtDate(node.endDate)}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditTarget(node)}
                        title="编辑工序"
                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-amber-300 hover:bg-amber-950/30 rounded transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487a2.1 2.1 0 113 2.97L9 18.32l-4 1 1-4 10.862-10.833z" />
                        </svg>
                      </button>
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
                  </div>
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
                  onUpdateName={onUpdateName}
                  onUpdateTag={onUpdateTag}
                  onUpdateDate={onUpdateDate}
                  onUpdateReason={onUpdateReason}
                  onUpdateProgress={onUpdateProgress}
                  onDeleteLastDelay={onDeleteLastDelay}
                  onAddTopLevelTask={onAddTopLevelTask}
                  onUpdateAssignee={onUpdateAssignee}
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

      {depth === 0 && editTarget && (
        <CyberPromptDialog
          open
          title="编辑工序"
          subtitle="工序信息修改"
          description={
            editTargetHasDelayChildren
              ? "当前工序已存在延期记录，日期由延期链路自动推算。\n本次仅支持修改工序名称。"
              : "可修改工序名称、开始时间和截至时间。"
          }
          fields={editFields}
          confirmText="保存修改"
          cancelText="取消"
          onConfirm={handleConfirmEdit}
          onCancel={handleCloseEdit}
        />
      )}

      {/* Phase 9 鈥?琛屾斂闃插憜妯℃€佹 */}
      {depth === 0 && deletionTarget && (
        <DeletionModal
          itemType="task"
          itemName={deletionTarget.name}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletionTarget(null)}
        />
      )}

      {/* Phase 9 鈥?鎷掔粷 Toast */}
      {depth === 0 && rejectionMessage && (
        <RejectionToast message={rejectionMessage} onClose={() => setRejectionMessage(null)} />
      )}
    </>
  )
}

/* -------------------------------- Spawner -------------------------------- */

interface BlackboardSpawnerProps {
  roots: TaskNode[]
  onAdd: (name: string, startDate: string, endDate: string, depId: string | null, tag?: string) => void
}

/**
 * Phase 5 鈥?寮轰緷璧栫害鏉熷綍鍏ユ矙鐩樸€? * 涓夊瓧娈电‖鎷︽埅锛氫换鍔″悕绉般€佹爣鍑嗗ぉ鏁般€佸墠缃伐搴?閮藉繀椤诲～鍐欐垨閫夋嫨鍚庢墠鑳芥彁浜ゃ€? */
function BlackboardSpawner({ roots, onAdd }: BlackboardSpawnerProps) {
  const today = todayIso()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [tag, setTag] = useState("")
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [depId, setDepId] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ name?: string; startDate?: string; endDate?: string }>({})
  const startDateInputRef = useRef<HTMLInputElement | null>(null)
  const endDateInputRef = useRef<HTMLInputElement | null>(null)

  const topLevelRoots = getRoots(roots)
  const selectedDependency = useMemo(
    () => topLevelRoots.find((root) => root.id === depId) ?? null,
    [depId, topLevelRoots],
  )

  useEffect(() => {
    if (!selectedDependency) return
    const dependencyEnd = selectedDependency.endDate
    if (startDate < dependencyEnd) setStartDate(dependencyEnd)
    if (endDate < dependencyEnd) setEndDate(dependencyEnd)
  }, [endDate, selectedDependency, startDate])

  const resetForm = useCallback(() => {
    setName("")
    setTag("")
    setStartDate(today)
    setEndDate(today)
    setDepId(null)
    setErrors({})
  }, [today])

  const handleClose = useCallback(() => {
    resetForm()
    setOpen(false)
  }, [resetForm])

  const validate = useCallback((): boolean => {
    const errs: { name?: string; startDate?: string; endDate?: string } = {}
    if (!name.trim()) errs.name = "必填"
    if (!startDate) errs.startDate = "必填"
    if (!endDate) errs.endDate = "必填"
    if (startDate && endDate && startDate > endDate) errs.endDate = "需晚于开始"
    if (selectedDependency && startDate < selectedDependency.endDate) errs.startDate = "不得早于前置截止"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [endDate, name, selectedDependency, startDate])

  const handleSubmit = useCallback(() => {
    if (!validate()) return
    onAdd(name.trim(), startDate, endDate, depId, tag.trim() || undefined)
    resetForm()
    setOpen(false)
  }, [depId, endDate, name, onAdd, resetForm, startDate, tag, validate])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        handleClose()
        return
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        handleSubmit()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleClose, handleSubmit, open])

  const addTaskDialog = open ? (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-400/25 shadow-[0_0_30px_rgba(34,211,238,0.25)]"
        style={{
          background:
            "linear-gradient(145deg, rgba(21,27,35,0.98) 0%, rgba(12,19,28,0.98) 60%, rgba(24,15,40,0.98) 100%)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/[0.08] bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(37,99,235,0.12))] px-5 py-4">
          <div className="text-sm font-bold tracking-wide text-white/95">新增工序</div>
          <div className="mt-1 text-xs text-cyan-200/70">弹窗录入工序信息，不再在甘特列表底部原地展开。</div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3 text-xs leading-relaxed text-white/60">
            可填写工序名称、开始时间、截至时间；选择前置条件后，时间不会早于前置工序截止日。
          </div>

          <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[11px] font-medium tracking-wide text-white/60">
                    工序名称
                    <span className="ml-1 text-red-400/80">*</span>
                  </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入工序名称"
                className={`w-full rounded-md border bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 outline-none transition-colors focus:bg-black/40 ${
                  errors.name
                    ? "border-red-400/60 focus:border-red-300"
                    : "border-white/[0.12] focus:border-cyan-400/60"
                }`}
                autoFocus
                  />
                  {errors.name ? <div className="mt-1 text-[10px] text-red-300/90">{errors.name}</div> : null}
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium tracking-wide text-white/60">标签</label>
                  <input
                    type="text"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder="例如：待客户确认 / 关键风险 / 外协加工"
                    className="w-full rounded-md border border-white/[0.12] bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 outline-none transition-colors focus:border-cyan-400/60 focus:bg-black/40"
                    maxLength={120}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium tracking-wide text-white/60">
                  开始时间
                  <span className="ml-1 text-red-400/80">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => openNativeDatePicker(startDateInputRef.current)}
                    aria-label="开始时间"
                    className={`flex w-full items-center justify-between rounded-md border bg-black/30 px-3 py-2 text-left text-sm text-white/90 outline-none transition-colors ${
                      errors.startDate
                        ? "border-red-400/60"
                        : "border-white/[0.12] hover:border-cyan-400/60"
                    }`}
                  >
                    <span className="tabular-nums">{startDate || "请选择开始时间"}</span>
                    <svg className="h-4 w-4 shrink-0 text-white/35" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 2v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
                    </svg>
                  </button>
                  <input
                    ref={startDateInputRef}
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="pointer-events-none absolute h-0 w-0 opacity-0"
                  />
                </div>
                {errors.startDate ? <div className="mt-1 text-[10px] text-red-300/90">{errors.startDate}</div> : null}
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium tracking-wide text-white/60">
                  截至时间
                  <span className="ml-1 text-red-400/80">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => openNativeDatePicker(endDateInputRef.current)}
                    aria-label="截至时间"
                    className={`flex w-full items-center justify-between rounded-md border bg-black/30 px-3 py-2 text-left text-sm text-white/90 outline-none transition-colors ${
                      errors.endDate
                        ? "border-red-400/60"
                        : "border-white/[0.12] hover:border-cyan-400/60"
                    }`}
                  >
                    <span className="tabular-nums">{endDate || "请选择截至时间"}</span>
                    <svg className="h-4 w-4 shrink-0 text-white/35" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 2v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
                    </svg>
                  </button>
                  <input
                    ref={endDateInputRef}
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="pointer-events-none absolute h-0 w-0 opacity-0"
                  />
                </div>
                {errors.endDate ? <div className="mt-1 text-[10px] text-red-300/90">{errors.endDate}</div> : null}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium tracking-wide text-white/60">前置条件</label>
              <select
                value={depId ?? ""}
                onChange={(e) => setDepId(e.target.value || null)}
                className="w-full rounded-md border border-white/[0.12] bg-black/30 px-3 py-2 text-sm text-white/90 outline-none transition-colors focus:border-cyan-400/60"
              >
                <option value="" className="bg-slate-900 text-white">
                  无 / 开端
                </option>
                {topLevelRoots.map((root) => (
                  <option key={root.id} value={root.id} className="bg-slate-900 text-white">
                    {root.name} ({root.endDate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-white/[0.12] px-4 py-2 text-xs text-white/70 transition-colors hover:bg-white/[0.08]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(37,99,235,0.22))] px-4 py-2 text-xs font-bold text-cyan-100 transition-colors hover:bg-[linear-gradient(135deg,rgba(34,211,238,0.32),rgba(37,99,235,0.32))]"
            >
              确认录入
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="sticky bottom-0 z-20" style={{ height: GANTT_ROW_H.SPAWNER }}>
      {addTaskDialog && typeof document !== "undefined" ? createPortal(addTaskDialog, document.body) : null}

      <div className="box-border flex h-full items-center border-b border-slate-800/20 bg-[#0f1729] px-3 transition-opacity opacity-20 hover:opacity-100">
        <button
          type="button"
          onClick={() => {
            resetForm()
            setOpen(true)
          }}
          className="w-full rounded border border-dashed border-slate-700/60 py-0.5 text-[9px] text-slate-500 transition-all hover:border-cyan-500/70 hover:bg-cyan-950/20 hover:text-cyan-400"
        >
          + 新增工序
        </button>
      </div>
    </div>
  )
}
