/**
 * GanttV3TaskBar — V10: Cyber Capsule · Root-to-Tip
 *
 * 逻辑：共用根部 (baseline_start)，独立终点
 * 美学：赛博朋克工业风 — 厚实胶囊、霓虹辉光、溢出脉冲
 *
 * Shell  (20px) = 暗色凹槽，baseline_start → baseline_end
 * Capsule(16px) = 发光胶囊，baseline_start → actual_end
 * 延误时胶囊从凹槽右侧溢出，溢出段脉冲发光
 */

import type { TaskNode, PhaseType } from '@shared/ganttEngine';
import { PHASE_COLORS } from '@shared/ganttEngine';
import { formatDateOrEmpty, calcTaskPerformance } from '@shared/workdays';

interface TaskBarProps {
  task: TaskNode;
  startDate: Date;
  dayWidth: number;
  rowHeight: number;
  onClick: (task: TaskNode) => void;
  animationDelay?: number;
}

/** 安全解析 YYYY-MM-DD 为本地日期 */
function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 日期 → 画布绝对像素 X */
function dateToX(target: Date, chartStart: Date, dayWidth: number): number {
  const days = (target.getTime() - chartStart.getTime()) / (1000 * 60 * 60 * 24);
  return Math.round(days * dayWidth);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── 赛博朋克配色 ───────────────────────────────────────────────────────────

const PHASE_CAPSULE: Record<PhaseType, { gradient: string; glow: string; overflowGlow: string }> = {
  physical: {
    gradient: 'linear-gradient(90deg, #0c4a6e 0%, #22d3ee 40%, #3b82f6 100%)',
    glow: '0 0 12px rgba(34,211,238,0.4), 0 0 4px rgba(59,130,246,0.3)',
    overflowGlow: '0 0 16px rgba(34,211,238,0.6), 0 0 6px rgba(59,130,246,0.5)',
  },
  data: {
    gradient: 'linear-gradient(90deg, #4c1d95 0%, #a78bfa 40%, #d946ef 100%)',
    glow: '0 0 12px rgba(167,139,250,0.4), 0 0 4px rgba(217,70,239,0.3)',
    overflowGlow: '0 0 16px rgba(167,139,250,0.6), 0 0 6px rgba(217,70,239,0.5)',
  },
  production: {
    gradient: 'linear-gradient(90deg, #064e3b 0%, #34d399 40%, #14b8a6 100%)',
    glow: '0 0 12px rgba(52,211,153,0.4), 0 0 4px rgba(20,184,166,0.3)',
    overflowGlow: '0 0 16px rgba(52,211,153,0.6), 0 0 6px rgba(20,184,166,0.5)',
  },
};

// 超期专用：深红 → 亮红渐变
const OVERDUE_CAPSULE = {
  gradient: 'linear-gradient(90deg, #8B0000 0%, #FF3131 100%)',
  glow: '0 0 12px rgba(255,49,49,0.4), 0 0 4px rgba(139,0,0,0.3)',
  overflowGlow: '0 0 18px rgba(255,49,49,0.6), 0 0 8px rgba(255,49,49,0.4)',
};

const SHELL_H = 20;    // 凹槽高度
const CAPSULE_H = 16;  // 胶囊高度

// ─── 组件 ────────────────────────────────────────────────────────────────────

export default function GanttV3TaskBar({
  task,
  startDate,
  dayWidth,
  onClick,
}: TaskBarProps) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const blStart = parseLocalDate(task.baselineStart);
  const blEnd   = parseLocalDate(task.baselineEnd);
  const acEnd   = task.actualEnd ? parseLocalDate(task.actualEnd) : null;

  if (task.wbsId === '4' || task.nameCn?.includes('MTD')) {
    console.warn(
      `[V10] MTD: bl=${task.baselineStart}→${task.baselineEnd}, ` +
      `ac=${task.actualStart ?? '—'}→${task.actualEnd ?? '—'}, crit=${task.isCritical}, isOverdue=${task.isOverdue ?? false}`
    );
  }

  // 使用运行时计算的 isOverdue（actualEnd > baselineEnd），而不是导入时设置的 isCritical
  // 这样可以正确判断：实际完成日期 <= 计划结束日期 = 准时完成，不标记为超期
  const isOverdue    = !!(acEnd && blEnd && acEnd > blEnd);
  const hasActual    = !!acEnd;
  const isNotStarted = !hasActual && blStart > now;
  const isDelayed    = !hasActual && blStart <= now && task.progress < 100;

  // ═══════════════════════════════════════════════════════════════════════════
  // Root-to-Tip 坐标：共用根部 baseline_start
  // ═══════════════════════════════════════════════════════════════════════════

  const rootX  = dateToX(blStart, startDate, dayWidth);
  const shellDays = Math.max(1, daysBetween(blStart, blEnd) + 1);
  const shellW = Math.max(shellDays * dayWidth, dayWidth);

  let capsuleW = 0;
  let isOverflow = false;
  if (acEnd) {
    const capsuleDays = Math.max(1, daysBetween(blStart, acEnd) + 1);
    capsuleW = Math.max(capsuleDays * dayWidth, dayWidth);
    isOverflow = capsuleW > shellW;
  }

  const phase    = (task.phase as PhaseType) || 'physical';
  const colors   = PHASE_COLORS[phase];
  const capsuleStyle = isOverdue ? OVERDUE_CAPSULE : PHASE_CAPSULE[phase];
  const delayDays = acEnd ? daysBetween(blEnd, acEnd) : 0;

  // S曲线同步：绩效计算 + 胶囊辉光强度联动
  const perf = calcTaskPerformance(task.baselineStart, task.baselineEnd, task.actualEnd);
  const di = perf?.intensity ?? null;
  const shouldPulseRed = perf?.shouldPulseRed ?? false;

  // 辉光强度随绩效下降而增强
  const glowScale = di && di.value > 130 ? 1.6 : di && di.value > 100 ? 1.25 : 1;
  const scaledGlow = (base: string) =>
    base.replace(/(\d+)px/g, (_, n) => `${Math.round(Number(n) * glowScale)}px`);
  const capsuleGlowFinal = isOverflow
    ? scaledGlow(capsuleStyle.overflowGlow)
    : scaledGlow(capsuleStyle.glow);

  return (
    <div
      className="absolute inset-0 cursor-pointer group"
      onClick={() => onClick(task)}
    >
      {/* ═══ 层 1: Shell（凹槽）— 暗色工业凹槽 ═══ */}
      <div
        className="absolute top-1/2 -translate-y-1/2"
        style={{
          left: rootX,
          width: shellW,
          height: SHELL_H,
          borderRadius: 999,
          background: hasActual
            ? 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(0,0,0,0.15) 100%)'
            : `linear-gradient(180deg, ${colors.primary}10 0%, ${colors.primary}18 50%, ${colors.primary}08 100%)`,
          boxShadow: hasActual
            ? 'inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(255,255,255,0.05)'
            : `inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(255,255,255,0.05), 0 0 6px ${colors.primary}15`,
          border: hasActual
            ? '1px solid rgba(255,255,255,0.06)'
            : `1px solid ${colors.primary}25`,
          zIndex: 1,
        }}
      >
        {/* 凹槽内刻度纹理 */}
        <div
          className="absolute inset-0 rounded-full opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)',
          }}
        />

        {/* 悬停名称 */}
        <div className="absolute inset-0 flex items-center px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
          <span className="text-[11px] font-bold text-white/80 truncate drop-shadow-lg" style={{ fontFamily: 'var(--font-body)' }}>
            {task.nameCn}
          </span>
        </div>

        {/* Milestone energy node — Holographic Crystal */}
        {(task.isMergePoint || task.isMilestone) && (
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-10">
            <div
              style={{
                width: 10,
                height: 10,
                transform: 'rotate(45deg)',
                background: 'linear-gradient(135deg, rgba(0,255,255,0.15) 0%, rgba(0,255,255,0.35) 100%)',
                border: '1px solid #00ffff',
                borderRadius: 1,
                boxShadow: '0 0 4px #00ffff, 0 0 8px rgba(0,255,255,0.5), 0 0 16px rgba(0,255,255,0.15)',
              }}
            />
          </div>
        )}

        {/* 延期/超期描边 */}
        {(isDelayed || isOverdue) && (
          <div
            className="absolute -inset-[1px] rounded-full pointer-events-none"
            style={{
              border: '1px solid rgba(255, 49, 49, 0.25)',
              boxShadow: '0 0 8px rgba(255, 49, 49, 0.15)',
              animation: 'breathe 2.5s ease-in-out infinite',
              borderRadius: 999,
            }}
          />
        )}
      </div>

      {/* ═══ 层 2: Capsule（胶囊）— 霓虹发光实体 ═══ */}
      {hasActual && (
        <div
          className="absolute top-1/2 -translate-y-1/2 group-hover:brightness-110 transition-all duration-300"
          style={{
            left: rootX + 2,
            width: Math.max(capsuleW - 4, 6),
            height: CAPSULE_H,
            borderRadius: 999,
            background: capsuleStyle.gradient,
            boxShadow: capsuleGlowFinal,
            zIndex: 2,
            animation: (isOverflow || shouldPulseRed) ? 'capsule-pulse 2s ease-in-out infinite' : undefined,
          }}
        >
          {/* 胶囊高光条 */}
          <div
            className="absolute rounded-full"
            style={{
              top: 2,
              left: 4,
              right: 4,
              height: 3,
              borderRadius: 999,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 100%)',
            }}
          />

          {/* 溢出段分界线：在 shell 右边缘位置画一条细线 */}
          {isOverflow && (
            <div
              className="absolute top-0 bottom-0 w-[1px]"
              style={{
                left: shellW - 4,
                background: 'rgba(255,255,255,0.2)',
              }}
            />
          )}
        </div>
      )}

      {/* 未完成占位胶囊 */}
      {!hasActual && !isNotStarted && (
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: rootX + 2,
            width: Math.max(shellW - 4, 6),
            height: CAPSULE_H,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.04)',
            zIndex: 2,
          }}
        />
      )}

      {/* 超期红点 — 已移除 */}

      {/* ═══ Tooltip ═══ */}
      <div
        className="absolute -top-[72px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50"
        style={{ left: rootX }}
      >
        <div
          className="px-3 py-2.5 rounded-xl whitespace-nowrap backdrop-blur-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(15,15,20,0.95) 0%, rgba(25,25,35,0.95) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: isOverdue ? OVERDUE_CAPSULE.gradient : colors.gradient,
                boxShadow: isOverdue ? '0 0 4px rgba(255,49,49,0.5)' : undefined,
              }}
            />
            <span className="text-[12px] font-bold text-white/90" style={{ fontFamily: 'var(--font-display)' }}>
              {task.nameCn}
            </span>
            {isOverdue && delayDays > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold tracking-wide">
                超期 +{delayDays}天
              </span>
            )}
            {perf && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wide"
                style={{
                  backgroundColor: `${perf.intensity.color}20`,
                  color: perf.intensity.color,
                }}
              >
                {perf.delayDays > 0 ? `延误 +${perf.delayDays}天` : perf.delayDays === 0 ? '准时' : `提前 ${Math.abs(perf.delayDays)}天`}
              </span>
            )}
            {isDelayed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                逾期
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-white/40" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>计划 {formatDateOrEmpty(task.baselineStart)}→{formatDateOrEmpty(task.baselineEnd)}</span>
            {perf && perf.delayDays !== 0 && (
              <span style={{ color: perf.intensity.color, fontWeight: 600 }}>
                {perf.delayDays > 0 ? `+${perf.delayDays}d` : `${perf.delayDays}d`}
              </span>
            )}
          </div>
          <div
            className="text-[10px] mt-0.5"
            style={{ fontFamily: 'var(--font-mono)', color: isOverdue ? '#FF3131' : 'rgba(255,255,255,0.3)' }}
          >
            实际 {task.actualStart ? formatDateOrEmpty(task.actualStart) : '—'}→{task.actualEnd ? formatDateOrEmpty(task.actualEnd) : '未完成'}
          </div>
        </div>
      </div>
    </div>
  );
}
