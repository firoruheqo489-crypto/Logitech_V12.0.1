export type TaskStatus = "pending" | "in-progress" | "completed" | "delayed"

export type ViewMode = "MACRO" | "MICRO"

/** Phase 8 — RBAC 权限角色 */
export type Role = "ADMIN" | "USER"

/** Phase 8 — 里程碑（商业死墙） */
export interface Milestone {
  id: string
  name: string
  /** ISO YYYY-MM-DD — the hard deadline */
  date: string
  type: "commercial" | "technical"
}

/* ===================== Phase 13 — ComponentGroup (部件组) ===================== */

/**
 * 最顶层数据结构：部件组。
 * 每个部件组代表一个独立的物理部件（如上盖、底壳、侧键等），
 * 其内部包含多个 TaskNode（工序）。
 *
 * 宏观视角下：部件组折叠为单一长条。
 * 微观视角下：展开显示全量工序树。
 */
export interface ComponentGroup {
  id: string
  name: string
  /** 内部工序列表 */
  tasks: TaskNode[]
  /** 是否展开（MICRO 模式下有效） */
  isExpanded?: boolean
  /**
   * 聚合计算字段（由引擎实时计算）：
   * - envelopeStart: 内部所有工序的最早开始时间
   * - envelopeEnd: 内部所有工序的最晚结束时间
   * - aggregateProgress: 内部工序进度的加权平均值
   * - hasOverdue: 内部是否有任何逾期工序（木桶效应）
   */
}

/**
 * Phase 8 — 暗雷碰撞状态。
 * 当任务 endDate 超过最近里程碑 date 时触发。
 */
export interface CollisionState {
  taskId: string
  taskName: string
  milestoneId: string
  milestoneName: string
  milestoneDate: string
  overshootDays: number
}

export interface TaskNode {
  id: string
  parentId: string | null
  name: string
  /** ISO YYYY-MM-DD — current (possibly shifted) start. */
  startDate: string
  /**
   * Rendered endDate. For a node that has children this is the *envelope*:
   *   endDate = max(baseEndDate, latestChildEnd)
   * For a leaf (no children) endDate === baseEndDate.
   */
  endDate: string

  /* ---------------------- Phase 4 — Baseline Ghost ---------------------- */
  /**
   * Original (pre-any-delay) startDate, frozen at task creation.
   * Used by MACRO mode to render the baseline ghost.
   */
  baseStartDate: string
  /**
   * Original (pre-any-delay) endDate, frozen at task creation.
   * For deterministic LIFO-undo AND for baseline ghost rendering.
   *
   * Shifted together with startDate by `shiftSubtree`.
   */
  baseEndDate: string

  status: TaskStatus
  dependencies: string[]
  children?: TaskNode[]
  isExpanded?: boolean
  /** Optional audit metadata — Phase 3 追责证据字段 */
  reason?: string

  /**
   * Physical completion percentage (0-100).
   * Only meaningful for top-level parent nodes (基础工序).
   * Delay children don't need progress — they're pure time fragments.
   */
  progress?: number

  /**
   * Phase 10 — 所属迭代阶段 (e.g., 'T0', 'T1', 'T2')。
   * 为跨阶段基线重置预留接口。
   */
  iterationPhase?: string
}
