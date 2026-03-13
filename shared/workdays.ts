/**
 * Work Day Calculator V3 — Sunday Skip Logic
 *
 * Core Formula:
 *   T_end = T_start + D_duration + N_sundays
 *
 * All date calculations skip Sundays (day 0) as non-working days.
 * This module is isomorphic — works on both client and server.
 */

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Add work days to a start date, automatically skipping every Sunday.
 *
 * Formula: T_end = T_start + D_duration + N_sundays
 *
 * @param start - Start date (Date object or YYYY-MM-DD string)
 * @param workDays - Number of working days to add
 * @returns The end date after adding workDays (skipping Sundays)
 */
export function addWorkDays(start: Date | string, workDays: number): Date {
  const d = typeof start === 'string' ? new Date(start) : new Date(start);
  let added = 0;
  while (added < workDays) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) {
      // Skip Sunday (day === 0)
      added++;
    }
  }
  return d;
}

/**
 * Get the number of net working days between two dates.
 * Both start and end are INCLUSIVE (start_date === end_date → 1 day).
 * Excludes Sundays from the count.
 *
 * @param start - Start date (inclusive)
 * @param end - End date (inclusive)
 * @returns Number of working days (Sundays excluded)
 */
export function getNetWorkDays(start: Date | string, end: Date | string): number {
  const s = typeof start === 'string' ? new Date(start) : new Date(start);
  const e = typeof end === 'string' ? new Date(end) : new Date(end);

  // Normalize to midnight to avoid time-of-day issues
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);

  if (e < s) return 0;

  // Count start day itself (if working day)
  let workDays = s.getDay() !== 0 ? 1 : 0;

  // Same day → just the start day count
  if (s.getTime() === e.getTime()) return workDays;

  // Count days after start, up to and including end
  const d = new Date(s);
  while (d < e) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) {
      workDays++;
    }
  }
  return workDays;
}

/**
 * Count the number of Sundays in a date range.
 *
 * @param start - Start date (exclusive)
 * @param end - End date (inclusive)
 * @returns Number of Sundays encountered
 */
export function countSundays(start: Date | string, end: Date | string): number {
  const s = typeof start === 'string' ? new Date(start) : new Date(start);
  const e = typeof end === 'string' ? new Date(end) : new Date(end);

  let count = 0;
  const d = new Date(s);
  d.setDate(d.getDate() + 1);
  while (d <= e) {
    if (d.getDay() === 0) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Add hours to a date, converting to work days and skipping Sundays.
 * Used for PreLag injection (e.g., 24h lag = 1 work day push).
 *
 * @param start - Start date
 * @param hours - Number of hours to add (converted to work days: ceil(hours/24))
 * @returns Adjusted date with Sunday skipping
 */
export function addWorkHours(start: Date | string, hours: number): Date {
  if (hours <= 0) {
    return typeof start === 'string' ? new Date(start) : new Date(start);
  }
  const days = Math.ceil(hours / 24);
  return addWorkDays(start, days);
}

/**
 * Get the next working day (skips Sunday).
 * If the given date is already a working day, returns itself.
 *
 * @param date - The date to check
 * @returns The same date or the next Monday if it's a Sunday
 */
export function nextWorkDay(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  while (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Format a Date to YYYY-MM-DD string.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if a date falls on a Sunday.
 */
export function isSunday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getDay() === 0;
}

/**
 * Simple calendar day addition (no Sunday skip).
 */
export function addCalendarDays(start: Date | string, days: number): Date {
  const d = typeof start === 'string' ? new Date(start) : new Date(start);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Get total calendar days between two dates (inclusive on both ends).
 * start === end → 1 day.
 */
export function calendarDaysBetween(start: Date | string, end: Date | string): number {
  const s = typeof start === 'string' ? new Date(start) : new Date(start);
  const e = typeof end === 'string' ? new Date(end) : new Date(end);
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Format date to localized display string.
 */
export function formatDateCn(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * 计划/实际日期展示：空值不显示，用 "—" 占位（对应 Excel 项目工序预估时间/项目工序实际完成时间为空）
 */
export function formatDateOrEmpty(date: Date | string | undefined | null): string {
  if (date === undefined || date === null || date === '') return '—';
  let d: Date;
  if (typeof date === 'string') {
    // 手动解析 YYYY-MM-DD 避免 UTC 偏移
    const parts = date.split('-');
    if (parts.length === 3) {
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * Format date to compact display (M/D).
 */
export function formatDateCompact(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── 延误强度 (Delay Intensity) ──────────────────────────────────────────────

export interface DelayIntensity {
  /** 强度百分比：(actual_days / planned_days) * 100 */
  value: number;
  /** 动态颜色：cyan / yellow / red */
  color: string;
  /** 是否严重超期 (>150%) */
  isWarning: boolean;
  /** 显示文本 */
  label: string;
}

/**
 * 计算延误强度 — Root-to-Tip 逻辑
 *
 * planned_days = baseline_end - baseline_start + 1
 * actual_days  = actual_end - baseline_start + 1
 * intensity    = (actual_days / planned_days) * 100
 *
 * ≤100%  → #00ffff (Cyan)  正常
 * ≤130%  → #ffcc00 (Yellow) 轻度延误
 * >130%  → #ff3131 (Red)    严重延误
 * >150%  → 附加 ⚠ 警告
 */
export function calcDelayIntensity(
  baselineStart?: string | null,
  baselineEnd?: string | null,
  actualEnd?: string | null,
): DelayIntensity | null {
  if (!baselineStart || !baselineEnd || !actualEnd) return null;

  const blS = new Date(baselineStart);
  const blE = new Date(baselineEnd);
  const acE = new Date(actualEnd);

  const plannedDays = Math.max(1, Math.round((blE.getTime() - blS.getTime()) / 86400000) + 1);
  const actualDays  = Math.max(1, Math.round((acE.getTime() - blS.getTime()) / 86400000) + 1);
  const intensity   = Math.round((actualDays / plannedDays) * 100);

  let color: string;
  if (intensity <= 100) {
    color = '#00ffff';
  } else if (intensity <= 130) {
    color = '#ffcc00';
  } else {
    color = '#ff3131';
  }

  return {
    value: intensity,
    color,
    isWarning: intensity > 150,
    label: `${intensity}%`,
  };
}

// ─── 任务绩效 (Task Performance) — S曲线同步 ────────────────────────────────

export interface TaskPerformance {
  /** 绩效百分比：(planned_days / actual_days) * 100 — S曲线同源 */
  efficiency: number;
  /** 延误天数：actual_end - baseline_end（正数=延误，负数=提前） */
  delayDays: number;
  /** 延误强度（复用 DelayIntensity） */
  intensity: DelayIntensity;
  /** 是否需要红色脉冲（绩效 < 80% 且延误） */
  shouldPulseRed: boolean;
}

/**
 * 计算任务绩效 — 与 S 曲线 ΔT 同源
 *
 * efficiency = (planned_days / actual_days) * 100
 *   100% = 按时完成
 *   80% = 实际用了计划的 125% 时间
 *   50% = 实际用了计划的 200% 时间
 *
 * 当 efficiency < 80% 时触发红色脉冲，与 S 曲线 "Delayed" 状态联动
 */
export function calcTaskPerformance(
  baselineStart?: string | null,
  baselineEnd?: string | null,
  actualEnd?: string | null,
): TaskPerformance | null {
  const di = calcDelayIntensity(baselineStart, baselineEnd, actualEnd);
  if (!di || !baselineStart || !baselineEnd || !actualEnd) return null;

  const blS = new Date(baselineStart);
  const blE = new Date(baselineEnd);
  const acE = new Date(actualEnd);

  const plannedDays = Math.max(1, Math.round((blE.getTime() - blS.getTime()) / 86400000) + 1);
  const actualDays  = Math.max(1, Math.round((acE.getTime() - blS.getTime()) / 86400000) + 1);

  const efficiency = Math.round((plannedDays / actualDays) * 100);
  const delayDays  = Math.round((acE.getTime() - blE.getTime()) / 86400000);

  return {
    efficiency,
    delayDays,
    intensity: di,
    shouldPulseRed: efficiency < 80 && delayDays > 0,
  };
}
