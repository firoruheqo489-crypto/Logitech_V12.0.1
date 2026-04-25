import { useCallback, useEffect, useRef, useState } from "react"
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
} from "@/lib/gantt/utils"
import { TaskTreeList } from "./task-tree-list"
import { DeletionModal } from "./deletion-modal"

interface GanttSkeletonProps {
  initialComponents: ComponentGroup[]
  initialMilestones?: Milestone[]
  dayWidth?: number
}

/* --------------------------------- Color --------------------------------- */

const DELAY_COLORS = [
  "bg-amber-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-red-600",
  "bg-pink-600",
  "bg-fuchsia-600",
  "bg-purple-600",
] as const

/* Phase 15 — 并发色谱映射引擎 (Concurrent Color Palette) */
const COMPONENT_PALETTE = [
  { base: "text-cyan-400", bg: "bg-cyan-500", glow: "shadow-[0_0_12px_rgba(6,182,212,0.5)]", bar: "from-cyan-600 to-cyan-400", border: "border-cyan-400/40" },
  { base: "text-purple-400", bg: "bg-purple-500", glow: "shadow-[0_0_12px_rgba(168,85,247,0.5)]", bar: "from-purple-600 to-purple-400", border: "border-purple-400/40" },
  { base: "text-rose-400", bg: "bg-rose-500", glow: "shadow-[0_0_12px_rgba(244,63,94,0.5)]", bar: "from-rose-600 to-rose-400", border: "border-rose-400/40" },
  { base: "text-amber-400", bg: "bg-amber-500", glow: "shadow-[0_0_12px_rgba(245,158,11,0.5)]", bar: "from-amber-600 to-amber-400", border: "border-amber-400/40" },
  { base: "text-emerald-400", bg: "bg-emerald-500", glow: "shadow-[0_0_12px_rgba(16,185,129,0.5)]", bar: "from-emerald-600 to-emerald-400", border: "border-emerald-400/40" },
  { base: "text-indigo-400", bg: "bg-indigo-500", glow: "shadow-[0_0_12px_rgba(99,102,241,0.5)]", bar: "from-indigo-600 to-indigo-400", border: "border-indigo-400/40" },
] as const

/* ------------------------------ Component -------------------------------- */

export function GanttSkeleton({ initialComponents, initialMilestones = [], dayWidth = 28 }: GanttSkeletonProps) {
  const engine = useGanttEngine(initialComponents, initialMilestones)
  const {
    components,
    allTasks,
    timeline,
    viewMode,
    setViewMode,
    addDelay,
    updateTaskDate,
    updateTaskReason,
    updateTaskProgress,
    deleteLastDelay,
    toggleExpanded,
    toggleComponentExpanded,
    addTaskToComponent,
    addComponentGroup,
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

  // Phase 9 — Milestone deletion state
  const [milestoneDeletionTarget, setMilestoneDeletionTarget] = useState<Milestone | null>(null)
  // Phase 19 — 交付死线管理面板（增/改名/改日/改类/删 集中入口）
  const [showMilestonePanel, setShowMilestonePanel] = useState(false)
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ name: string; date: string; type: "commercial" | "technical" }>({ name: "", date: "", type: "commercial" })

  // Phase 17 — 左右面板垂直滚动同步，保证行块始终水平对齐
  const leftScrollRef = useRef<HTMLDivElement | null>(null)
  const rightScrollRef = useRef<HTMLDivElement | null>(null)
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

  // Phase 8 — Milestone spawner (ADMIN only)
  const handleAddMilestone = useCallback(() => {
    if (role !== "ADMIN") return
    const name = window.prompt("里程碑名称：", "T0 试模")
    if (!name) return
    const date = window.prompt("截止日期 (YYYY-MM-DD)：", todayIso())
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    const typeRaw = window.prompt("类型 (commercial / technical)：", "commercial")
    const type = typeRaw === "technical" ? "technical" : "commercial"
    addMilestone(name, date, type)
  }, [role, addMilestone])

  // Phase 13 — Add component group
  const handleAddComponentGroup = useCallback(() => {
    const name = window.prompt("新部件名称：", "新模具")
    if (!name) return
    addComponentGroup(name)
  }, [addComponentGroup])

  return (
    <div className="flex flex-col w-full h-screen bg-[#0B0F19] text-slate-100">
      {/* ========================== Top Header ========================== */}
      <header className="h-12 flex-shrink-0 border-b border-slate-800/50 flex items-center justify-between px-4 bg-[#111827]">
        <div className="flex items-center gap-6">
          <h1 className="text-sm font-semibold tracking-wider text-slate-200">
            <span className="text-cyan-400">工业级动态甘特图</span>
            <span className="text-slate-500 mx-2">/</span>
            <span className="text-slate-400 font-normal text-xs">并发部件集群</span>
          </h1>


          {/* Phase 19 — 交付死线管理面板（新增 / 改名 / 改日期 / 改类型 / 删除） */}
          {role === "ADMIN" && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowMilestonePanel((v) => !v)
                  setEditingMilestoneId(null)
                }}
                className="px-3 py-1 border border-fuchsia-700/60 text-fuchsia-300 hover:bg-fuchsia-950/50 hover:border-fuchsia-500 text-[10px] rounded transition-all"
              >
                ◆ 交付死线 ({milestones.length})
              </button>
              {showMilestonePanel && (
                <div className="absolute left-0 top-full mt-1 z-50 w-[420px] bg-[#0f1729] border border-fuchsia-800/50 rounded shadow-[0_8px_24px_rgba(0,0,0,0.6)] p-2">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800/60 mb-1">
                    <span className="text-[10px] tracking-wider text-fuchsia-300">交付死线管理</span>
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
                    <div className="px-2 py-3 text-[10px] text-slate-500 text-center">尚未录入交付死线</div>
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
                              <button
                                type="button"
                                onClick={handleSave}
                                className="text-[9px] text-emerald-400 hover:text-emerald-300 px-1"
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingMilestoneId(null)}
                                className="text-[9px] text-slate-500 hover:text-slate-300 px-1"
                              >
                                取消
                              </button>
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
                            <button
                              type="button"
                              onClick={() => handleMilestoneDeleteRequest(m)}
                              className="text-[9px] text-slate-500 hover:text-red-400 px-1"
                            >
                              删除
                            </button>
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
                    + 新增交付死线
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Phase 13 — Add Component Group */}
          <button
            type="button"
            onClick={handleAddComponentGroup}
            className="px-3 py-1 border border-cyan-700/60 text-cyan-300 hover:bg-cyan-950/50 hover:border-cyan-500 text-[10px] rounded transition-all"
          >
            + 新增部件
          </button>
        </div>

        {/* Macro/Micro Toggle */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-slate-600 mr-2">沙盘模式：</span>
          <button
            type="button"
            onClick={() => setViewMode("MACRO")}
            className={`px-3 py-1 rounded-l border transition-all ${
              isMacro
                ? "bg-cyan-600/80 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600"
            }`}
          >
            宏观大盘
          </button>
          <button
            type="button"
            onClick={() => setViewMode("MICRO")}
            className={`px-3 py-1 rounded-r border-t border-r border-b transition-all ${
              !isMacro
                ? "bg-cyan-600/80 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600"
            }`}
          >
            微观审计
          </button>
        </div>
      </header>

      {/* ========================== Main Content ========================== */}
      <div className="flex flex-1 min-h-0 border-t border-slate-800/30">
        {/* --------------------- Left — Component Tree (Phase 15: 物理空间解压) --------------------- */}
        <div className="min-w-[520px] w-[520px] flex-shrink-0 border-r border-slate-800/40 flex flex-col bg-[#111827]">
          {/* Phase 18 — 交付里程碑带（左侧 placeholder、与右侧 sticky strip 高度严格对齐） */}
          <div className="h-10 sticky top-0 z-20 bg-[#0f1729] border-b border-fuchsia-900/30 flex items-center px-4 text-[10px] tracking-wider text-fuchsia-400/70">
            <span className="text-fuchsia-500/70 mr-2">◆</span>
            交付里程碑
          </div>
          <div className="h-10 border-b border-slate-800/50 sticky top-10 bg-[#0f1729] flex items-center px-4 text-[10px] tracking-wider text-slate-500 z-10">
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
              onAddDelay={addDelay}
              onUpdateDate={updateTaskDate}
              onUpdateReason={updateTaskReason}
              onUpdateProgress={updateTaskProgress}
              onDeleteLastDelay={deleteLastDelay}
              onAddTaskToComponent={addTaskToComponent}
              onValidateTaskDeletion={validateTaskDeletion}
              onDeleteTask={deleteTask}
              onResetTaskProgress={resetTaskProgress}
            />
          </div>
        </div>

        {/* --------------------- Right — Timeline Tracks --------------------- */}
        <div ref={rightScrollRef} className="flex-1 overflow-auto relative bg-[#0B0F19] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Phase 18 — Milestone Strip：独立一行、紧贴 top-0、位于 ruler 上方 */}
          <div
            className="h-10 sticky top-0 z-20 bg-[#0f1729] border-b border-fuchsia-900/30"
            style={{ width: `${timeline.totalDays * dayWidth}px` }}
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
          <div
            className="h-10 border-b border-slate-800/30 sticky top-10 bg-[#0f1729] flex z-10"
            style={{ width: `${timeline.totalDays * dayWidth}px` }}
          >
            {Array.from({ length: timeline.totalDays }).map((_, i) => {
              const d = new Date(`${timeline.start}T00:00:00Z`)
              d.setUTCDate(d.getUTCDate() + i)
              const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
              const isMonthStart = d.getUTCDate() === 1
              const cellIso = d.toISOString().slice(0, 10)
              const isToday = cellIso === todayIso()
              // Phase 18 — 命中里程碑日期的格子：用同色实心矩形作为虚线墙的"顶帽"
              const matchingMilestone = role === "ADMIN" ? milestones.find((m) => m.date === cellIso) : undefined
              const milestoneCls = matchingMilestone
                ? matchingMilestone.type === "commercial"
                  ? "bg-fuchsia-700/70 border-fuchsia-400 text-fuchsia-50 font-bold shadow-[inset_0_0_12px_rgba(217,70,239,0.6)]"
                  : "bg-purple-700/70 border-purple-400 text-purple-50 font-bold shadow-[inset_0_0_12px_rgba(147,51,234,0.6)]"
                : null
              return (
                <div
                  key={i}
                  className={`flex-shrink-0 border-r text-[9px] flex items-center justify-center font-mono relative ${
                    milestoneCls
                      ? milestoneCls
                      : isMonthStart
                        ? "border-slate-600/60 text-slate-300 bg-slate-900/30"
                        : isToday
                          ? "border-red-500/80 text-red-400 font-bold bg-red-950/30 shadow-[inset_0_0_12px_rgba(239,68,68,0.3)]"
                          : "border-slate-800/30 text-slate-600"
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
                  {/* Component header row — 与左侧 group header 高度严格对齐（均 72px） */}
                  <div className={`min-h-[72px] border-b border-slate-800/30 bg-slate-900/50 flex items-center px-3 ${themeColor.border}`}>
                    <span className={`text-xs font-medium tracking-wide ${themeColor.base}`}>{group.name}</span>
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
                      {/* Placeholder row for "+新增基础工序" button alignment — 与左侧 BlackboardSpawner sticky 区实测 64px 对齐 */}
                      <div className="min-h-[64px] border-b border-slate-800/20" />
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
  onAddDelay: (componentId: string, parentId: string, delayDays: number, reason: string) => void
  onUpdateDate: (componentId: string, taskId: string, start: string, end: string) => void
  onUpdateReason: (componentId: string, taskId: string, reason: string) => void
  onUpdateProgress: (componentId: string, taskId: string, progress: number) => void
  onDeleteLastDelay: (componentId: string, childId: string) => void
  onAddTaskToComponent: (componentId: string, name: string, duration: number, depId: string | null, phase?: string) => void
  onValidateTaskDeletion: (componentId: string, taskId: string) => { canDelete: boolean; reason?: string }
  onDeleteTask: (componentId: string, taskId: string) => void
  onResetTaskProgress: (componentId: string, taskId: string) => void
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
    onAddDelay,
    onUpdateDate,
    onUpdateReason,
    onUpdateProgress,
    onDeleteLastDelay,
    onAddTaskToComponent,
    onValidateTaskDeletion,
    onDeleteTask,
    onResetTaskProgress,
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
            {/* Component Group Header — Y 轴空间释放：min-h-[72px] 强制 72px，items-center 垂直居中 */}
            <div
              className={`min-h-[72px] flex items-center gap-3 py-2.5 px-4 hover:bg-slate-800/50 transition-all cursor-pointer border-l-3 whitespace-nowrap ${
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
              <span className={`font-semibold tracking-wide shrink-0 ${groupOverdue ? "text-red-400" : groupCompleted ? "text-emerald-400" : themeColor.base}`}>
                {group.name}
              </span>

              {/* Aggregate Progress — 精密进度徽章 */}
              <span className={`text-[10px] ml-auto px-2 py-0.5 rounded shrink-0 ${
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
                  onAddDelay={(parentId) => {
                    const raw = window.prompt("延期天数（正整数）：", "3")
                    if (raw == null) return
                    const days = Number.parseInt(raw, 10)
                    if (!Number.isFinite(days) || days <= 0) return
                    onAddDelay(group.id, parentId, days, "")
                  }}
                  onUpdateDate={(taskId, start, end) => onUpdateDate(group.id, taskId, start, end)}
                  onUpdateReason={(taskId, reason) => onUpdateReason(group.id, taskId, reason)}
                  onUpdateProgress={(taskId, progress) => onUpdateProgress(group.id, taskId, progress)}
                  onDeleteLastDelay={(childId) => onDeleteLastDelay(group.id, childId)}
                  onAddTopLevelTask={(name, duration, depId, phase) => onAddTaskToComponent(group.id, name, duration, depId, phase)}
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

/* ========================== ComponentTrack (MACRO) — Phase 16: 柱体解剖学重构 ========================== */

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
    return <div className="min-h-[72px] border-b border-slate-800/20" />
  }

  const envelopeStart = getComponentEnvelopeStart(group)
  const envelopeEnd = getComponentEnvelopeEnd(group)
  const offsetDays = diffDays(timelineStart, envelopeStart)
  const span = Math.max(1, diffDays(envelopeStart, envelopeEnd))
  const progress = getComponentAggregateProgress(group)
  const isOverdueGroup = isComponentOverdue(group)
  const isCompletedGroup = isComponentCompleted(group)
  const collision = isComponentCollidingMilestone(group, milestones)
  const isColliding = collision !== null

  // Phase 15 — 色谱遗传：健康状态使用主题色，逾期强制覆盖为红黑条纹
  const themeColor = COMPONENT_PALETTE[colorIndex % COMPONENT_PALETTE.length]

  // Phase 16 — Overflow Protocol: 极限短工序时文字外挂
  const barWidthPx = span * dayWidth
  const isNarrow = barWidthPx < 100
  const barLeftPx = offsetDays * dayWidth
  const barRightPx = barLeftPx + barWidthPx

  // Phase 16 — 状态标签与色调（仅负责行 1，名称+进度为行 2）
  const groupStatusLabel =
    isOverdueGroup ? "[逾期]"
      : isColliding && role === "ADMIN" ? `超界${collision?.overshootDays ?? 0}天`
        : isCompletedGroup ? "[完工]"
          : progress > 0 ? "[进行中]"
            : "[待开始]"
  const groupStatusClass =
    isOverdueGroup ? "text-red-200"
      : isColliding && role === "ADMIN" ? "text-fuchsia-200"
        : isCompletedGroup ? "text-emerald-200"
          : progress > 0 ? "text-cyan-100"
            : "text-slate-100"

  const barColor =
    isOverdueGroup || (isColliding && role === "USER")
      ? "shadow-[0_0_18px_rgba(220,38,38,0.9)] border-2 border-red-500 gantt-overdue-stripe"
      : isColliding && role === "ADMIN"
        ? "bg-gradient-to-r from-red-600 via-orange-500 to-fuchsia-600 shadow-[0_0_18px_rgba(239,68,68,0.6)] border border-fuchsia-400/50"
        : isCompletedGroup
          ? "bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_0_14px_rgba(52,211,153,0.5)] border border-emerald-400/30"
          : `bg-gradient-to-r ${themeColor.bar} ${themeColor.glow} ${themeColor.border} group-hover:shadow-[0_0_20px_rgba(6,182,212,0.9)]`

  return (
    <div className="min-h-[72px] flex items-center border-b border-slate-800/20 relative hover:bg-slate-900/30 transition-colors group">
      <div
        className={`absolute h-10 rounded-md overflow-hidden whitespace-nowrap transition-all ${barColor}`}
        style={{
          left: `${barLeftPx}px`,
          width: `${barWidthPx}px`,
          top: "50%",
          transform: "translateY(-50%)",
        }}
        title={`${group.name} · ${envelopeStart} → ${envelopeEnd} · 聚合进度：${progress}%${isOverdueGroup ? " · [存在逾期工序]" : ""}${isColliding ? ` · 撞墙里程碑：${collision?.milestoneName}` : ""}`}
      >
        {/* Progress overlay — 白色锐边进度条 */}
        <div
          className="absolute inset-y-0 left-0 bg-white/30 pointer-events-none border-r-2 border-white/90"
          style={{ width: `${progress}%` }}
        />
        {/* Two-line label — bar 内：行 1 状态 (span)、行 2 名称·进度 (span) */}
        {!isNarrow && (
          <div className="relative z-10 h-full flex flex-col justify-center items-start px-2 overflow-hidden whitespace-nowrap pointer-events-none">
            <span className={`text-[10px] leading-tight font-bold truncate w-full text-left drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] ${groupStatusClass}`}>
              {groupStatusLabel}
            </span>
            <span className="text-xs leading-tight truncate w-full text-left text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
              {group.name} · {progress}%
            </span>
          </div>
        )}
      </div>
      {/* Narrow-bar fallback：文字外挂在方块右侧 */}
      {isNarrow && (
        <div
          className="absolute top-1/2 -translate-y-1/2 ml-2 flex flex-col items-start gap-0.5 pointer-events-none whitespace-nowrap"
          style={{ left: `${barRightPx}px` }}
        >
          <span className={`text-[10px] leading-tight font-bold truncate text-left ${groupStatusClass}`}>
            {groupStatusLabel}
          </span>
          <span className="text-xs leading-tight truncate text-left text-slate-300">
            {group.name} · {progress}%
          </span>
        </div>
      )}
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

// Phase 18 — MilestoneLine 只保留垂直虚线墙；标签与编辑/删除控件已迁移至顶部 sticky strip
function MilestoneLine({ milestone, timelineStart, dayWidth, totalDays }: MilestoneLineProps) {
  const offset = diffDays(timelineStart, milestone.date)
  if (offset < 0 || offset >= totalDays) return null

  const lineColor = milestone.type === "commercial" ? "border-fuchsia-500" : "border-purple-500"
  const lineGlow = milestone.type === "commercial" ? "shadow-[0_0_12px_rgba(217,70,239,0.5)]" : "shadow-[0_0_12px_rgba(147,51,234,0.5)]"

  return (
    <div
      className={`absolute top-0 bottom-0 border-l-2 border-dashed ${lineColor} ${lineGlow} pointer-events-none z-[8] gantt-milestone-wall`}
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
      className="absolute top-0 bottom-0 border-l-2 border-red-500 pointer-events-none z-[5] gantt-today-cursor shadow-[0_0_15px_rgba(239,68,68,0.8)]"
      style={{ left: `${offset * dayWidth + dayWidth / 2}px` }}
      aria-hidden="true"
    >
      {/* 发光红色倒三角 TODAY 标签 */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <span className="text-red-500 text-[10px] font-bold drop-shadow-[0_0_6px_rgba(239,68,68,0.9)]">▼</span>
        <span className="text-[7px] text-red-400 bg-red-950/90 px-1 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.5)]">NOW</span>
      </div>
    </div>
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
    const collision = isTaskCollidingMilestone(node, milestones)
    const isColliding = collision !== null
    const completed = isCompleted(node)
    const delayDebt = calculateDelayDebt(node)
    const hasDelayDebt = completed && delayDebt > 0

    // Phase 16 — 总跨度（baseDays + 所有延期段）决定整条 bar 宽度
    const childrenSpanDays = children.reduce((sum, c) => sum + Math.max(0, diffDays(c.startDate, c.endDate)), 0)
    const totalBarSpan = baseDays + childrenSpanDays
    const totalBarWidthPx = totalBarSpan * dayWidth
    const isNarrow = totalBarWidthPx < 100
    const barLeftPx = offsetDays * dayWidth
    const barRightPx = barLeftPx + totalBarWidthPx
    const statusLabel = overdue
      ? "[逾期]"
      : isColliding
        ? `超界${collision?.overshootDays ?? 0}天`
        : completed
          ? "[完工]"
          : (node.progress ?? 0) > 0
            ? "[进行中]"
            : "[待开始]"
    const statusClass = overdue
      ? "text-red-300"
      : isColliding
        ? "text-fuchsia-200"
        : completed
          ? "text-emerald-200"
          : (node.progress ?? 0) > 0
            ? "text-cyan-200"
            : "text-slate-300"

    return (
      <div className="min-h-[72px] flex items-center border-b border-slate-800/20 relative hover:bg-slate-900/20 transition-colors" data-task-id={node.id}>
        <div
          className="absolute h-10 overflow-hidden whitespace-nowrap rounded-sm"
          style={{
            left: `${barLeftPx}px`,
            width: `${totalBarWidthPx}px`,
            top: "50%",
            transform: "translateY(-50%)",
          }}
          title={`${node.name} · ${node.startDate} → ${node.endDate} · 完成度：${node.progress ?? 0}%`}
        >
          {/* Segment row — 原始 baseDays + 延期子段，铺满 bar 高度 */}
          <div className="absolute inset-0 flex flex-row">
            {baseDays > 0 && (
              <div
                className={`${
                  isColliding || overdue
                    ? "shadow-[0_0_10px_rgba(220,38,38,0.6)] border border-red-500"
                    : completed
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-500"
                      : "bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)] border border-cyan-300/30"
                } relative overflow-hidden rounded-l-sm border-r border-[#0B0F19]`}
                style={
                  isColliding || overdue
                    ? {
                        width: `${baseDays * dayWidth}px`,
                        backgroundImage: "repeating-linear-gradient(45deg, #b91c1c, #b91c1c 8px, #7f1d1d 8px, #7f1d1d 16px)",
                      }
                    : { width: `${baseDays * dayWidth}px` }
                }
              >
                <div className="absolute inset-y-0 left-0 bg-white/30 rounded-l-sm border-r-2 border-white pointer-events-none" style={{ width: `${node.progress ?? 0}%` }} />
              </div>
            )}
            {children.map((c, i) => {
              const segmentSpan = Math.max(0, diffDays(c.startDate, c.endDate))
              if (segmentSpan <= 0) return null
              const isLast = i === children.length - 1
              const useStripe = isColliding || overdue
              return (
                <div
                  key={c.id}
                  className={`${useStripe ? "shadow-[0_0_8px_rgba(220,38,38,0.5)] border border-red-500/50" : DELAY_COLORS[i % DELAY_COLORS.length]} ${isLast ? "rounded-r-sm" : ""} border-r border-[#0B0F19]`}
                  style={
                    useStripe
                      ? { width: `${segmentSpan * dayWidth}px`, backgroundImage: "repeating-linear-gradient(45deg, #b91c1c, #b91c1c 6px, #7f1d1d 6px, #7f1d1d 12px)" }
                      : { width: `${segmentSpan * dayWidth}px` }
                  }
                  title={`${c.name} · ${c.startDate} → ${c.endDate}${c.reason ? ` · ${c.reason}` : ""}`}
                />
              )
            })}
          </div>
          {/* Two-line label overlay — 行 1 状态 (span)、行 2 名称·进度 (span) */}
          {!isNarrow && (
            <div className="absolute inset-0 z-10 flex flex-col justify-center items-start px-2 overflow-hidden whitespace-nowrap pointer-events-none">
              <span className={`text-[10px] leading-tight font-bold truncate w-full text-left ${statusClass} drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]`}>
                {statusLabel}
              </span>
              <span className="text-xs leading-tight truncate w-full text-left text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                {node.name} · {node.progress ?? 0}%
              </span>
            </div>
          )}
        </div>
        {/* Narrow-bar fallback：文字外挂在方块右侧 */}
        {isNarrow && (
          <div
            className="absolute top-1/2 -translate-y-1/2 ml-2 flex flex-col items-start gap-0.5 pointer-events-none whitespace-nowrap"
            style={{ left: `${barRightPx}px` }}
          >
            <span className={`text-[10px] leading-tight font-bold truncate text-left ${statusClass}`}>
              {statusLabel}
            </span>
            <span className="text-xs leading-tight truncate text-left text-slate-300">
              {node.name} · {node.progress ?? 0}%
            </span>
          </div>
        )}
        {hasDelayDebt && (
          <span
            className="absolute top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-red-900/90 text-red-200 text-[8px] font-bold rounded whitespace-nowrap z-20"
            style={{ left: `${barRightPx + (isNarrow ? 160 : 8)}px` }}
          >
            +{delayDebt}天
          </span>
        )}
      </div>
    )
  }

  const span = Math.max(1, diffDays(node.startDate, node.endDate))
  const color = DELAY_COLORS[indexInParent % DELAY_COLORS.length]
  const childBarWidthPx = span * dayWidth
  const childIsNarrow = childBarWidthPx < 100
  const childBarLeftPx = offsetDays * dayWidth
  const childBarRightPx = childBarLeftPx + childBarWidthPx

  return (
    <div className="min-h-[72px] flex items-center border-b border-slate-800/15 relative hover:bg-slate-900/10 transition-colors" data-task-id={node.id}>
      <div
        className={`absolute h-9 rounded-sm overflow-hidden whitespace-nowrap ${color}`}
        style={{
          left: `${childBarLeftPx}px`,
          width: `${childBarWidthPx}px`,
          top: "50%",
          transform: "translateY(-50%)",
        }}
        title={`${node.name} · ${node.startDate} → ${node.endDate}${node.reason ? ` · ${node.reason}` : ""}`}
      >
        {!childIsNarrow && (
          <div className="relative z-10 h-full flex flex-col justify-center items-start px-2 overflow-hidden whitespace-nowrap pointer-events-none">
            <span className="text-[10px] leading-tight font-bold truncate w-full text-left text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              [延期]
            </span>
            <span className="text-xs leading-tight truncate w-full text-left text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {node.name}
            </span>
          </div>
        )}
      </div>
      {childIsNarrow && (
        <div
          className="absolute top-1/2 -translate-y-1/2 ml-2 flex flex-col items-start gap-0.5 pointer-events-none whitespace-nowrap"
          style={{ left: `${childBarRightPx}px` }}
        >
          <span className="text-[10px] leading-tight font-bold truncate text-left text-amber-300/80">[延期]</span>
          <span className="text-xs leading-tight truncate text-left text-slate-300">{node.name}</span>
        </div>
      )}
    </div>
  )
}
