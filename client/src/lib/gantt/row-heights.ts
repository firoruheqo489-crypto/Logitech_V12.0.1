/**
 * Gantt 行高契约（Row Height Contract）
 * ════════════════════════════════════════════════════════════════
 *  本文件是甘特图所有"参与左右对齐"行的【唯一】高度事实源。
 *
 *  强制规则：
 *    1. 任何在左面板 / 右面板可能并排出现的行（含表头、工序、占位、沙盘），
 *       禁止在 JSX 中裸写 `h-10` / `h-7` 等 Tailwind 高度类，
 *       必须 `style={{ height: GANTT_ROW_H.X }}` 从此处取值。
 *    2. 修改高度 = 修改本文件常量；左右两侧物理同步，不存在"只改一边"的可能。
 *    3. 新增行类型 = 在 `GanttRowKind` 中新增枚举 + 在 `GANTT_ROW_H` 给出像素值，
 *       两侧渲染统一从此引用。
 *
 *  历史教训：曾因左侧 BlackboardSpawner 折叠态写死 `h-7` (28px)、
 *  而右侧占位写死 `h-10` (40px)，每个部件组累积 +12px 偏差，
 *  从第二组开始可见错位。本文件即为该类问题的根除方案。
 * ════════════════════════════════════════════════════════════════
 */

export type GanttRowKind =
  /** 左：控制栏（交付死线 / 部件管理）；右：里程碑条 */
  | "CONTROL_BAR"
  /** 左：section 文字描述；右：日期刻度尺 */
  | "RULER"
  /** 部件组标题行（MICRO 模式下左右各一；MACRO 模式右侧整组合一） */
  | "GROUP"
  | "MACRO_GROUP"
  /** 工序行 / 延期记录行 */
  | "TASK"
  /** 「+ 新增基础工序」沙盘折叠态 与 右侧对应占位 */
  | "SPAWNER"

/** 行高（像素）。这是唯一可信的数值来源。 */
export const GANTT_ROW_H: Readonly<Record<GanttRowKind, number>> = {
  CONTROL_BAR: 40,
  RULER: 40,
  GROUP: 40,
  MACRO_GROUP: 60,
  TASK: 72,
  SPAWNER: 28,
} as const

/** 便捷访问器：返回 px 字符串，配合 inline style 使用。 */
export function rowHeightPx(kind: GanttRowKind): string {
  return `${GANTT_ROW_H[kind]}px`
}
