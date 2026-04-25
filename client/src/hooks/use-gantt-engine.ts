"use client"

import { useCallback, useMemo, useState } from "react"
import { produce } from "immer"
import type { CollisionState, ComponentGroup, Milestone, Role, TaskNode, ViewMode } from "@/lib/gantt/types"
import {
  addDays,
  cascadeDownstream,
  createTopLevelTask,
  detectMilestoneCollisions,
  diffDays,
  enforceDependencyConstraints,
  envelopeEnd,
  envelopeUpward,
  findNode,
  findPath,
  flatten,
  flattenAllTasks,
  generateId,
  getBaseEnd,
  getComponentEnvelopeEnd,
  getComponentEnvelopeStart,
  isLeaf,
  latestChildEnd,
  shiftSubtree,
  todayIso,
  validateDeletion,
  type DeletionValidation,
} from "@/lib/gantt/utils"

export interface GanttTimeline {
  start: string
  end: string
  totalDays: number
}

export interface UseGanttEngineReturn {
  /** Phase 13 — 顶层数据结构：部件组列表 */
  components: ComponentGroup[]
  /** 兼容层：扁平化的所有任务（用于里程碑检测等） */
  allTasks: TaskNode[]
  timeline: GanttTimeline
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  addDelay: (componentId: string, parentId: string, delayDays: number, reason: string) => void
  updateTaskDate: (componentId: string, taskId: string, newStart: string, newEnd: string) => void
  updateTaskReason: (componentId: string, taskId: string, reason: string) => void
  updateTaskProgress: (componentId: string, taskId: string, progress: number) => void
  deleteLastDelay: (componentId: string, childId: string) => void
  toggleExpanded: (componentId: string, taskId: string) => void
  toggleComponentExpanded: (componentId: string) => void
  /** Phase 13 — 在指定部件内添加工序 */
  addTaskToComponent: (componentId: string, name: string, durationDays: number, dependencyId: string | null, iterationPhase?: string) => void
  /** Phase 13 — 新增部件组 */
  addComponentGroup: (name: string) => void

  /* Phase 8 — RBAC & Milestones */
  role: Role
  setRole: (role: Role) => void
  milestones: Milestone[]
  addMilestone: (name: string, date: string, type: "commercial" | "technical") => void
  updateMilestone: (id: string, patch: Partial<Pick<Milestone, "name" | "date" | "type">>) => void
  deleteMilestone: (id: string) => void
  collisions: CollisionState[]

  /* Phase 9 — Task Deletion */
  validateTaskDeletion: (componentId: string, taskId: string) => DeletionValidation
  deleteTask: (componentId: string, taskId: string) => void

  /* Phase 10 — ADMIN Progress Reset */
  resetTaskProgress: (componentId: string, taskId: string) => void
}

/* ------------------------ Base-end backfill on ingest --------------------- */

function backfillBaseDates(nodes: TaskNode[]): TaskNode[] {
  return nodes.map((n) => ({
    ...n,
    baseStartDate: n.baseStartDate ?? n.startDate,
    baseEndDate: n.baseEndDate ?? n.endDate,
    children: n.children ? backfillBaseDates(n.children) : n.children,
  }))
}

function backfillComponents(components: ComponentGroup[]): ComponentGroup[] {
  return components.map((c) => ({
    ...c,
    tasks: backfillBaseDates(c.tasks),
  }))
}

/* -------------------------------------------------------------------------- */
/*  useGanttEngine (Phase 13 — ComponentGroup 版本)                           */
/* -------------------------------------------------------------------------- */

export function useGanttEngine(initialComponents: ComponentGroup[], initialMilestones: Milestone[] = []): UseGanttEngineReturn {
  const [components, setComponents] = useState<ComponentGroup[]>(() => backfillComponents(initialComponents))
  const [viewMode, setViewMode] = useState<ViewMode>("MICRO")
  const [role, setRole] = useState<Role>("ADMIN")
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)

  /* ---------------------------- allTasks (兼容层) ------------------------- */
  const allTasks = useMemo(() => flattenAllTasks(components), [components])

  /* ---------------------------- addDelay ---------------------------------- */

  const addDelay = useCallback((componentId: string, parentId: string, delayDays: number, reason: string) => {
    if (delayDays <= 0) {
      console.warn("[v0] addDelay ignored — delayDays must be > 0:", delayDays)
      return
    }

    setComponents((prev) =>
      produce(prev, (draft) => {
        const group = draft.find((g) => g.id === componentId)
        if (!group) return

        const path = findPath(group.tasks, parentId)
        if (!path) return
        const parent = path[0]

        const anchor = latestChildEnd(parent)
        const childStart = anchor
        const childEnd = addDays(anchor, delayDays)

        const childIndex = (parent.children?.length ?? 0) + 1
        const newChild: TaskNode = {
          id: `${parent.id}__delay_${Date.now().toString(36)}_${childIndex}`,
          parentId: parent.id,
          name: `第${childIndex}次延期`,
          startDate: childStart,
          endDate: childEnd,
          baseStartDate: childStart,
          baseEndDate: childEnd,
          status: "delayed",
          dependencies: [],
          children: [],
          isExpanded: true,
          reason,
        }

        if (!parent.children) parent.children = []
        parent.children.push(newChild)
        parent.isExpanded = true
        if (parent.status !== "completed") parent.status = "delayed"

        const shiftedAncestors = envelopeUpward([parent, newChild])

        const visited = new Set<string>()
        cascadeDownstream(group.tasks, parent.id, delayDays, visited)
        for (const a of shiftedAncestors) {
          cascadeDownstream(group.tasks, a.id, delayDays, visited)
        }

        enforceDependencyConstraints(group.tasks)
      }),
    )
  }, [])

  /* -------------------------- updateTaskDate ------------------------------ */

  const updateTaskDate = useCallback((componentId: string, taskId: string, newStart: string, newEnd: string) => {
    if (newStart > newEnd) {
      console.warn("[v0] updateTaskDate: newStart must be <= newEnd", { newStart, newEnd })
      return
    }

    setComponents((prev) =>
      produce(prev, (draft) => {
        const group = draft.find((g) => g.id === componentId)
        if (!group) return

        const path = findPath(group.tasks, taskId)
        if (!path) return
        const target = path[path.length - 1]

        if (!isLeaf(target)) {
          console.warn("[v0] updateTaskDate rejected — target is not a leaf:", taskId)
          return
        }

        const endDelta = diffDays(target.endDate, newEnd)
        target.startDate = newStart
        target.endDate = newEnd
        target.baseEndDate = newEnd

        const shiftedAncestors = envelopeUpward(path)

        if (endDelta !== 0) {
          const visited = new Set<string>()
          cascadeDownstream(group.tasks, target.id, endDelta, visited)
          for (const a of shiftedAncestors) {
            cascadeDownstream(group.tasks, a.id, endDelta, visited)
          }
        }

        if (endDelta > 0) enforceDependencyConstraints(group.tasks)
      }),
    )
  }, [])

  /* ------------------------ updateTaskReason ------------------------------ */

  const updateTaskReason = useCallback((componentId: string, taskId: string, reason: string) => {
    setComponents((prev) =>
      produce(prev, (draft) => {
        const group = draft.find((g) => g.id === componentId)
        if (!group) return
        const node = findNode(group.tasks, taskId)
        if (node) node.reason = reason
      }),
    )
  }, [])

  /* ----------------------- updateTaskProgress ----------------------------- */

  const updateTaskProgress = useCallback((componentId: string, taskId: string, progress: number) => {
    const clamped = Math.max(0, Math.min(100, progress))
    setComponents((prev) =>
      produce(prev, (draft) => {
        const group = draft.find((g) => g.id === componentId)
        if (!group) return
        const node = findNode(group.tasks, taskId)
        if (node && !node.parentId) {
          node.progress = clamped
        }
      }),
    )
  }, [])

  /* -------------------------- deleteLastDelay ----------------------------- */

  const deleteLastDelay = useCallback((componentId: string, childId: string) => {
    setComponents((prev) =>
      produce(prev, (draft) => {
        const group = draft.find((g) => g.id === componentId)
        if (!group) return

        const path = findPath(group.tasks, childId)
        if (!path || path.length < 2) {
          console.warn("[v0] deleteLastDelay: not a child node", childId)
          return
        }
        const parent = path[path.length - 2]
        const children = parent.children ?? []

        if (children.length === 0 || children[children.length - 1].id !== childId) {
          console.warn("[v0] deleteLastDelay REJECTED — LIFO only")
          return
        }

        const parentEndBefore = parent.endDate
        children.pop()
        parent.endDate = envelopeEnd(parent)

        const ancestorsAbove = path.slice(0, -2)
        if (ancestorsAbove.length > 0) {
          envelopeUpward([...ancestorsAbove, parent])
        }

        if ((parent.children?.length ?? 0) === 0 && parent.status === "delayed") {
          parent.status = "pending"
        }

        const delta = diffDays(parent.endDate, parentEndBefore)
        if (delta > 0) {
          const visited = new Set<string>()
          cascadeDownstream(group.tasks, parent.id, -delta, visited)
        }
      }),
    )
  }, [])

  /* --------------------------- toggleExpanded ----------------------------- */

  const toggleExpanded = useCallback((componentId: string, taskId: string) => {
    setComponents((prev) =>
      produce(prev, (draft) => {
        const group = draft.find((g) => g.id === componentId)
        if (!group) return
        const node = findNode(group.tasks, taskId)
        if (!node) return
        node.isExpanded = !node.isExpanded
      }),
    )
  }, [])

  /* ----------------------- toggleComponentExpanded ------------------------ */

  const toggleComponentExpanded = useCallback((componentId: string) => {
    setComponents((prev) =>
      produce(prev, (draft) => {
        const group = draft.find((g) => g.id === componentId)
        if (!group) return
        group.isExpanded = !group.isExpanded
      }),
    )
  }, [])

  /* ----------------------- addTaskToComponent ----------------------------- */

  const addTaskToComponent = useCallback(
    (componentId: string, name: string, durationDays: number, dependencyId: string | null, iterationPhase = "T0") => {
      if (!name.trim()) {
        console.warn("[v0] addTaskToComponent: name is empty")
        return
      }
      if (durationDays <= 0) {
        console.warn("[v0] addTaskToComponent: durationDays must be > 0", durationDays)
        return
      }

      setComponents((prev) =>
        produce(prev, (draft) => {
          const group = draft.find((g) => g.id === componentId)
          if (!group) return

          const newTask = createTopLevelTask(name.trim(), durationDays, dependencyId, group.tasks, iterationPhase)
          group.tasks.push(newTask)
          enforceDependencyConstraints(group.tasks)
        }),
      )
    },
    [],
  )

  /* ------------------------- addComponentGroup ---------------------------- */

  const addComponentGroup = useCallback((name: string) => {
    if (!name.trim()) {
      console.warn("[v0] addComponentGroup: name is empty")
      return
    }

    setComponents((prev) =>
      produce(prev, (draft) => {
        draft.push({
          id: generateId("comp"),
          name: name.trim(),
          tasks: [],
          isExpanded: true,
        })
      }),
    )
  }, [])

  /* -------------------------- Phase 8 — Milestones ------------------------ */

  const addMilestone = useCallback((name: string, date: string, type: "commercial" | "technical") => {
    setMilestones((prev) => [
      ...prev,
      { id: generateId("milestone"), name, date, type },
    ])
  }, [])

  const updateMilestone = useCallback(
    (id: string, patch: Partial<Pick<Milestone, "name" | "date" | "type">>) => {
      setMilestones((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      )
    },
    [],
  )

  const deleteMilestone = useCallback((id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id))
  }, [])

  /* ----------------------- Phase 9 — Task Deletion ------------------------ */

  const validateTaskDeletion = useCallback(
    (componentId: string, taskId: string): DeletionValidation => {
      const group = components.find((g) => g.id === componentId)
      if (!group) return { canDelete: false, reason: "部件组不存在。" }
      return validateDeletion(taskId, group.tasks)
    },
    [components],
  )

  const deleteTask = useCallback((componentId: string, taskId: string) => {
    setComponents((prev) =>
      produce(prev, (draft) => {
        const group = draft.find((g) => g.id === componentId)
        if (!group) return

        const validation = validateDeletion(taskId, group.tasks)
        if (!validation.canDelete) {
          console.warn("[v0] deleteTask REJECTED:", validation.reason)
          return
        }

        const idx = group.tasks.findIndex((t) => t.id === taskId)
        if (idx >= 0) {
          group.tasks.splice(idx, 1)
        }
      }),
    )
  }, [])

  /* ---------------------- Phase 10 — ADMIN Progress Reset ----------------- */

  const resetTaskProgress = useCallback((componentId: string, taskId: string) => {
    setComponents((prev) =>
      produce(prev, (draft) => {
        const group = draft.find((g) => g.id === componentId)
        if (!group) return
        const node = findNode(group.tasks, taskId)
        if (node && !node.parentId) {
          console.warn("[v0] ADMIN resetTaskProgress:", { taskId, previousProgress: node.progress })
          node.progress = 0
        }
      }),
    )
  }, [])

  /* ------------------------------ timeline -------------------------------- */

  const timeline = useMemo<GanttTimeline>(() => {
    const today = todayIso()

    if (components.length === 0) {
      const padded = 5
      return {
        start: addDays(today, -padded),
        end: addDays(today, padded),
        totalDays: padded * 2 + 1,
      }
    }

    let earliestTask = today
    let latestTask = today

    for (const g of components) {
      if (g.tasks.length === 0) continue
      const gStart = getComponentEnvelopeStart(g)
      const gEnd = getComponentEnvelopeEnd(g)
      if (gStart < earliestTask) earliestTask = gStart
      if (gEnd > latestTask) latestTask = gEnd

      // 也考虑基线
      for (const t of g.tasks) {
        if (t.baseStartDate && t.baseStartDate < earliestTask) earliestTask = t.baseStartDate
        if (t.baseEndDate && t.baseEndDate > latestTask) latestTask = t.baseEndDate
      }
    }

    const absoluteStart = earliestTask < today ? earliestTask : today
    const absoluteEnd = latestTask > today ? latestTask : today

    const PADDING = 5
    const renderStart = addDays(absoluteStart, -PADDING)
    const renderEnd = addDays(absoluteEnd, PADDING)

    return {
      start: renderStart,
      end: renderEnd,
      totalDays: diffDays(renderStart, renderEnd) + 1,
    }
  }, [components])

  /* ---------------------- Phase 8 — Collision Detection ------------------- */

  const collisions = useMemo<CollisionState[]>(() => {
    return detectMilestoneCollisions(allTasks, milestones)
  }, [allTasks, milestones])

  return {
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
    // Phase 8
    role,
    setRole,
    milestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    collisions,
    // Phase 9
    validateTaskDeletion,
    deleteTask,
    // Phase 10
    resetTaskProgress,
  }
}

export { diffDays, addDays, shiftSubtree, isLeaf, getBaseEnd }
