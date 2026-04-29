import type { CollisionState, ComponentGroup, Milestone, TaskNode } from "./types"

/* ===================== Phase 13 — ComponentGroup Aggregators ===================== */

/**
 * 计算部件组的包络起始时间（内部所有工序的最早开始时间）
 */
export function getComponentEnvelopeStart(group: ComponentGroup): string {
  if (group.tasks.length === 0) return todayIso()
  let earliest = group.tasks[0].startDate
  for (const t of group.tasks) {
    if (t.startDate < earliest) earliest = t.startDate
    // 也考虑延期子节点
    if (t.children) {
      for (const c of t.children) {
        if (c.startDate < earliest) earliest = c.startDate
      }
    }
  }
  return earliest
}

/**
 * 计算部件组的包络结束时间（内部所有工序的最晚结束时间）
 */
export function getComponentEnvelopeEnd(group: ComponentGroup): string {
  if (group.tasks.length === 0) return todayIso()
  let latest = group.tasks[0].endDate
  for (const t of group.tasks) {
    if (t.endDate > latest) latest = t.endDate
    // 也考虑延期子节点
    if (t.children) {
      for (const c of t.children) {
        if (c.endDate > latest) latest = c.endDate
      }
    }
  }
  return latest
}

/**
 * 计算部件组的聚合进度（加权平均）
 */
export function getComponentAggregateProgress(group: ComponentGroup): number {
  const topLevelTasks = group.tasks.filter((t) => !t.parentId)
  if (topLevelTasks.length === 0) return 0
  const total = topLevelTasks.reduce((sum, t) => sum + getScheduleProgress(t), 0)
  return Math.round(total / topLevelTasks.length)
}

/**
 * 木桶效应：检测部件组内是否有任何工序逾期
 */
export function isComponentOverdue(group: ComponentGroup): boolean {
  for (const t of group.tasks) {
    if (isOverdue(t)) return true
  }
  return false
}

/**
 * 木桶效应：检测部件组内是否有任何工序撞墙
 */
export function isComponentCollidingMilestone(group: ComponentGroup, milestones: Milestone[]): CollisionState | null {
  for (const t of group.tasks) {
    const collision = isTaskCollidingMilestone(t, milestones)
    if (collision) return collision
  }
  return null
}

/**
 * 检测部件组内是否所有工序都已完工
 */
export function isComponentCompleted(group: ComponentGroup): boolean {
  if (group.tasks.length === 0) return false
  for (const t of group.tasks) {
    if (!t.parentId && getScheduleProgress(t) < 100) return false
  }
  return true
}

/**
 * 将所有 ComponentGroup 的 tasks 扁平化为单一数组（用于全局操作）
 */
export function flattenAllTasks(components: ComponentGroup[]): TaskNode[] {
  const result: TaskNode[] = []
  for (const g of components) {
    result.push(...flatten(g.tasks))
  }
  return result
}

/**
 * 在所有 ComponentGroup 中查找节点
 */
export function findNodeInComponents(components: ComponentGroup[], id: string): TaskNode | null {
  for (const g of components) {
    const found = findNode(g.tasks, id)
    if (found) return found
  }
  return null
}

/**
 * 在所有 ComponentGroup 中查找路径
 */
export function findPathInComponents(components: ComponentGroup[], id: string): { group: ComponentGroup; path: TaskNode[] } | null {
  for (const g of components) {
    const path = findPath(g.tasks, id)
    if (path) return { group: g, path }
  }
  return null
}

/* ----------------------------- Date primitives ---------------------------- */

export function toUTC(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

export function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const d = toUTC(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUTC(d)
}

export function diffDays(fromIso: string, toIso: string): number {
  const a = toUTC(fromIso).getTime()
  const b = toUTC(toIso).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function maxIso(a: string, b: string): string {
  return a > b ? a : b
}

export function todayIso(): string {
  return fromUTC(new Date())
}

/**
 * Schedule-derived progress used for dashboard display.
 * 0% before start, 100% on/after end, linearly interpolated in between.
 */
export function getScheduleProgress(node: TaskNode, referenceDate = todayIso()): number {
  if (node.parentId) return 0
  if (referenceDate <= node.startDate) return 0
  if (referenceDate >= node.endDate) return 100

  const totalDays = Math.max(1, diffDays(node.startDate, node.endDate))
  const elapsedDays = Math.max(0, diffDays(node.startDate, referenceDate))
  return Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)))
}

/**
 * Phase 7 — 逾期熔断判定。
 * 任务已实质性逾期且未完成：endDate < Today && progress < 100
 * 仅对顶级父节点有意义；延期子节点无 progress 概念。
 */
export function isOverdue(node: TaskNode): boolean {
  if (node.parentId) return false // 子节点不参与逾期判定
  const today = todayIso()
  const progress = getScheduleProgress(node, today)
  return node.endDate < today && progress < 100
}

/**
 * 计算逾期天数。返回值 > 0 表示已逾期的天数。
 * 仅对顶级工序有意义。
 */
export function getOverdueDays(node: TaskNode): number {
  if (!isOverdue(node)) return 0
  return Math.max(0, diffDays(node.endDate, todayIso()))
}

/* ---------------------- Phase 10 — Completion Lock ----------------------- */

/**
 * Phase 10 — 100%完工绝对锁死判定。
 * 当 progress === 100 时，该工序进入物理封板状态。
 */
export function isCompleted(node: TaskNode): boolean {
  if (node.parentId) return false // 子节点不参与完工判定
  return getScheduleProgress(node) === 100
}

/**
 * Phase 10 — 延期负债计算。
 * 返回实际完工日期超出原始基线的天数。
 * delayDebtDays = diffDays(baseEndDate, endDate)
 * 如果 > 0，说明带病交接，产生时间负债。
 */
export function calculateDelayDebt(node: TaskNode): number {
  if (node.parentId) return 0
  const baseEnd = node.baseEndDate ?? node.endDate
  return Math.max(0, diffDays(baseEnd, node.endDate))
}

/* ---------------------- Phase 8 — Milestone Collision ---------------------- */

/**
 * 获取最近（最早）的里程碑截止日期。
 */
export function getNextMilestone(milestones: Milestone[]): Milestone | null {
  if (milestones.length === 0) return null
  return milestones.reduce((nearest, m) => (m.date < nearest.date ? m : nearest), milestones[0])
}

/**
 * 暗雷碰撞检测引擎。
 * 扫描所有顶级任务，检测其 endDate 是否超过任意里程碑 date。
 * 返回所有碰撞的详细信息。
 */
export function detectMilestoneCollisions(tasks: TaskNode[], milestones: Milestone[]): CollisionState[] {
  if (milestones.length === 0) return []

  const collisions: CollisionState[] = []
  const roots = tasks.filter((t) => !t.parentId)

  for (const task of roots) {
    // 检测每个里程碑
    for (const m of milestones) {
      if (task.endDate > m.date) {
        const overshootDays = diffDays(m.date, task.endDate)
        collisions.push({
          taskId: task.id,
          taskName: task.name,
          milestoneId: m.id,
          milestoneName: m.name,
          milestoneDate: m.date,
          overshootDays,
        })
      }
    }
  }

  return collisions
}

/**
 * 检测单个任务是否与任意里程碑碰撞。
 */
export function isTaskCollidingMilestone(task: TaskNode, milestones: Milestone[]): CollisionState | null {
  if (task.parentId) return null // 子节点不参与碰撞判定
  for (const m of milestones) {
    if (task.endDate > m.date) {
      return {
        taskId: task.id,
        taskName: task.name,
        milestoneId: m.id,
        milestoneName: m.name,
        milestoneDate: m.date,
        overshootDays: diffDays(m.date, task.endDate),
      }
    }
  }
  return null
}

/* ------------------------------ Tree walkers ------------------------------ */

export function findNode(nodes: TaskNode[], id: string): TaskNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children?.length) {
      const hit = findNode(n.children, id)
      if (hit) return hit
    }
  }
  return null
}

export function findPath(nodes: TaskNode[], id: string, trail: TaskNode[] = []): TaskNode[] | null {
  for (const n of nodes) {
    const next = [...trail, n]
    if (n.id === id) return next
    if (n.children?.length) {
      const hit = findPath(n.children, id, next)
      if (hit) return hit
    }
  }
  return null
}

export function flatten(nodes: TaskNode[], acc: TaskNode[] = []): TaskNode[] {
  for (const n of nodes) {
    acc.push(n)
    if (n.children?.length) flatten(n.children, acc)
  }
  return acc
}

export interface VisibleRow {
  node: TaskNode
  parent: TaskNode | null
  indexInParent: number
  depth: number
  isLastChild: boolean
}

/**
 * Flatten respecting isExpanded so right-hand tracks align with left-hand tree.
 * In MACRO mode we skip child rows entirely (only top-level roots visible).
 */
export function flattenVisible(
  nodes: TaskNode[],
  parent: TaskNode | null = null,
  depth = 0,
  acc: VisibleRow[] = [],
  macroMode = false,
): VisibleRow[] {
  nodes.forEach((node, i) => {
    acc.push({
      node,
      parent,
      indexInParent: i,
      depth,
      isLastChild: parent !== null && i === nodes.length - 1,
    })
    const hasChildren = node.children && node.children.length > 0
    const expanded = node.isExpanded !== false
    // In MACRO mode, never descend into children — the entire view flattens to roots only.
    if (hasChildren && expanded && !macroMode) {
      flattenVisible(node.children as TaskNode[], node, depth + 1, acc, macroMode)
    }
  })
  return acc
}

export function isLeaf(node: TaskNode): boolean {
  return !node.children || node.children.length === 0
}

/** Return only top-level nodes (those without a parent). */
export function getRoots(nodes: TaskNode[]): TaskNode[] {
  return nodes.filter((n) => !n.parentId)
}

/* ------------------------------ Base / Envelope --------------------------- */

export function getBaseEnd(node: TaskNode): string {
  return node.baseEndDate ?? node.endDate
}

export function getBaseStart(node: TaskNode): string {
  return node.baseStartDate ?? node.startDate
}

/**
 * envelopeEnd = max(baseEndDate, max(child.endDate))
 * Shrinks as well as grows.
 */
export function envelopeEnd(node: TaskNode): string {
  const base = getBaseEnd(node)
  if (!node.children?.length) return base
  let latest = base
  for (const c of node.children) {
    if (c.endDate > latest) latest = c.endDate
  }
  return latest
}

export function latestChildEnd(parent: TaskNode): string {
  return envelopeEnd(parent)
}

/* --------------------------- Structural mutations ------------------------- */

/**
 * Translates a node AND its entire subtree by `days`.
 * baseEndDate is shifted so base span remains invariant.
 * NOTE: baseStartDate is NOT shifted — it is the frozen "original commitment".
 */
export function shiftSubtree(node: TaskNode, days: number): void {
  if (days === 0) return
  node.startDate = addDays(node.startDate, days)
  node.endDate = addDays(node.endDate, days)
  if (node.baseEndDate) node.baseEndDate = addDays(node.baseEndDate, days)
  if (node.children?.length) {
    for (const c of node.children) shiftSubtree(c, days)
  }
}

/**
 * 法则 2 — bidirectional envelope.
 * Walks ancestors recomputing endDate = envelopeEnd(ancestor).
 */
export function envelopeUpward(path: TaskNode[]): TaskNode[] {
  const shifted: TaskNode[] = []
  for (let i = path.length - 2; i >= 0; i--) {
    const ancestor = path[i]
    const next = envelopeEnd(ancestor)
    if (ancestor.endDate !== next) {
      ancestor.endDate = next
      shifted.push(ancestor)
    } else {
      break
    }
  }
  return shifted
}

/* ------------------------ 法则 3 — Downstream cascade --------------------- */

/**
 * Increment-driven cascade. Shifts every transitive dependent of `sourceId`
 * by `days`. Whenever an ancestor's envelope changes, that ancestor is
 * enqueued so its downstream can receive the same shift.
 */
export function cascadeDownstream(
  roots: TaskNode[],
  sourceId: string,
  days: number,
  visited: Set<string> = new Set(),
): void {
  if (days === 0) return

  const queue: string[] = [sourceId]
  visited.add(sourceId)

  while (queue.length) {
    const currentId = queue.shift() as string
    const all = flatten(roots)
    for (const D of all) {
      if (D.id === currentId) continue
      if (visited.has(D.id)) continue
      if (!D.dependencies.includes(currentId)) continue

      shiftSubtree(D, days)
      visited.add(D.id)
      queue.push(D.id)

      const path = findPath(roots, D.id)
      if (path) {
        const shiftedAncestors = envelopeUpward(path)
        for (const a of shiftedAncestors) {
          if (!visited.has(a.id)) {
            visited.add(a.id)
            queue.push(a.id)
          }
        }
      }
    }
  }
}

/**
 * Hard Cascade Enforcer (Phase 3 硬防撞).
 * Fixed-point sweep: for any D whose startDate < max(依赖.endDate),
 * shift D rightward to close the gap.
 */
export function enforceDependencyConstraints(roots: TaskNode[]): void {
  const FUSE = 32
  for (let i = 0; i < FUSE; i++) {
    let changed = false
    const all = flatten(roots)

    for (const D of all) {
      if (!D.dependencies.length) continue

      let requiredStart = D.startDate
      for (const depId of D.dependencies) {
        const U = findNode(roots, depId)
        if (!U) continue
        if (U.endDate > requiredStart) requiredStart = U.endDate
      }

      const gap = diffDays(D.startDate, requiredStart)
      if (gap > 0) {
        shiftSubtree(D, gap)
        const path = findPath(roots, D.id)
        if (path) envelopeUpward(path)
        changed = true
      }
    }

    if (!changed) return
  }
  console.warn("[v0] enforceDependencyConstraints hit fuse limit — possible cyclic graph")
}

/* ------------------------- Phase 4 — Node Factory ------------------------ */

let idCounter = 0
export function generateId(prefix = "task"): string {
  return `${prefix}_${Date.now().toString(36)}_${(++idCounter).toString(36)}`
}

/**
 * Create a new top-level TaskNode with correct dependency-aware scheduling.
 * `durationDays` is the standard duration (标准耗时).
 * If `dependencyId` is provided, startDate is auto-locked to that dep's endDate.
 */
/* ---------------------- Phase 9 — Deletion Validators -------------------- */

export interface DeletionValidation {
  canDelete: boolean
  reason?: string
}

/**
 * 校验 A — 进度防篡改 (Progress Tampering Guard)。
 * 如果该工序的 progress > 0，或者已经挂载延期子节点，锁死删除权限。
 */
export function validateProgressTampering(node: TaskNode): DeletionValidation {
  const progress = node.progress ?? 0
  if (progress > 0) {
    return {
      canDelete: false,
      reason: `该工序已有物理产出（完成度 ${progress}%），历史事实不允许被抹除。`,
    }
  }
  if (node.children && node.children.length > 0) {
    return {
      canDelete: false,
      reason: `该工序下方已挂载 ${node.children.length} 次延期记录，历史账本不允许被销毁。`,
    }
  }
  return { canDelete: true }
}

/**
 * 校验 B — 级联承重墙检测 (Dependency Load-Bearing Wall)。
 * 遍历全局状态树，检查是否有任何其他工序依赖于当前工序。
 */
export function validateDependencyWall(taskId: string, allTasks: TaskNode[]): DeletionValidation {
  const dependents: string[] = []
  const all = flatten(allTasks)

  for (const t of all) {
    if (t.id !== taskId && t.dependencies.includes(taskId)) {
      dependents.push(t.name)
    }
  }

  if (dependents.length > 0) {
    return {
      canDelete: false,
      reason: `该工序是承重墙，被以下 ${dependents.length} 个下游工序依赖：${dependents.join("、")}。行政链条不可截断。`,
    }
  }
  return { canDelete: true }
}

/**
 * 双层物理校验 — 合并 A + B。
 */
export function validateDeletion(taskId: string, allTasks: TaskNode[]): DeletionValidation {
  const node = findNode(allTasks, taskId)
  if (!node) {
    return { canDelete: false, reason: "工序不存在。" }
  }
  if (node.parentId) {
    return { canDelete: false, reason: "延期记录不可独立删除，请使用 LIFO 撤销。" }
  }

  const progressCheck = validateProgressTampering(node)
  if (!progressCheck.canDelete) return progressCheck

  const depCheck = validateDependencyWall(taskId, allTasks)
  if (!depCheck.canDelete) return depCheck

  return { canDelete: true }
}

export function createTopLevelTask(
  name: string,
  startDate: string,
  endDate: string,
  dependencyId: string | null,
  roots: TaskNode[],
  iterationPhase = "T0",
  assignee = "",
  tag = "",
): TaskNode {
  let effectiveStartDate = startDate
  let effectiveEndDate = endDate
  if (dependencyId) {
    const dep = findNode(roots, dependencyId)
    if (dep) {
      if (effectiveStartDate < dep.endDate) {
        effectiveStartDate = dep.endDate
      }
      if (effectiveEndDate < effectiveStartDate) {
        effectiveEndDate = effectiveStartDate
      }
    } else {
      console.warn("[v0] createTopLevelTask: dependencyId not found, keep requested dates", dependencyId)
    }
    // No dependency — start today (or could be customized).
  }

  return {
    id: generateId("root"),
    parentId: null,
    name,
    assignee,
    tag: tag.trim() || undefined,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    baseStartDate: effectiveStartDate,
    baseEndDate: effectiveEndDate,
    status: "in-progress",
    dependencies: dependencyId ? [dependencyId] : [],
    children: [],
    isExpanded: true,
    iterationPhase, // Phase 10
  }
}
