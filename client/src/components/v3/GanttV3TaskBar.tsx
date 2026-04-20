import type { PhaseType, TaskNode } from '@shared/ganttEngine';
import { PHASE_COLORS } from '@shared/ganttEngine';
import { calcTaskPerformance, formatDateOrEmpty } from '@shared/workdays';

export interface TaskBarLayout {
  plannedLeft: number;
  plannedWidth: number;
  actualLeft: number | null;
  actualWidth: number | null;
  overflowLeft: number | null;
  overflowWidth: number | null;
  anchorStart: number;
  anchorEnd: number;
  delayDays: number;
}

interface TaskBarProps {
  task: TaskNode;
  layout: TaskBarLayout;
  onClick: (task: TaskNode) => void;
}

const SHELL_HEIGHT = 20;
const ACTUAL_HEIGHT = 14;
const ANCHOR_SIZE = 8;

const PHASE_CAPSULE: Record<PhaseType, { gradient: string; glow: string; track: string }> = {
  physical: {
    gradient: 'linear-gradient(90deg, #0c4a6e 0%, #22d3ee 42%, #3b82f6 100%)',
    glow: '0 0 14px rgba(34,211,238,0.35), 0 0 6px rgba(59,130,246,0.25)',
    track: 'rgba(74,144,226,0.22)',
  },
  data: {
    gradient: 'linear-gradient(90deg, #4c1d95 0%, #a78bfa 42%, #d946ef 100%)',
    glow: '0 0 14px rgba(167,139,250,0.35), 0 0 6px rgba(217,70,239,0.25)',
    track: 'rgba(162,155,254,0.22)',
  },
  production: {
    gradient: 'linear-gradient(90deg, #064e3b 0%, #34d399 42%, #14b8a6 100%)',
    glow: '0 0 14px rgba(52,211,153,0.35), 0 0 6px rgba(20,184,166,0.25)',
    track: 'rgba(0,184,148,0.22)',
  },
};

function parseTaskDate(dateStr?: string | null): Date | null {
  if (!dateStr) {
    return null;
  }

  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffCalendarDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function mapDateRangeToPixels(
  timelineStart: Date,
  startDate: Date,
  endDate: Date,
  zoomLevel: number,
): { left: number; width: number } {
  const left = Math.round(diffCalendarDays(timelineStart, startDate) * zoomLevel);
  const width = Math.max(Math.round((diffCalendarDays(startDate, endDate) + 1) * zoomLevel), Math.max(zoomLevel * 0.65, 10));
  return { left, width };
}

export function buildTaskBarLayout(task: TaskNode, timelineStart: Date, zoomLevel: number): TaskBarLayout {
  const plannedStart = parseTaskDate(task.baselineStart) ?? timelineStart;
  const plannedEnd = parseTaskDate(task.baselineEnd) ?? plannedStart;
  const actualStart = parseTaskDate(task.actualStart) ?? (task.progress > 0 ? plannedStart : null);
  const actualEnd = parseTaskDate(task.actualEnd);

  const plannedRange = mapDateRangeToPixels(timelineStart, plannedStart, plannedEnd, zoomLevel);
  let actualLeft: number | null = null;
  let actualWidth: number | null = null;
  let overflowLeft: number | null = null;
  let overflowWidth: number | null = null;
  let delayDays = 0;

  if (actualStart && actualEnd) {
    const actualVisibleEnd = actualEnd > plannedEnd ? plannedEnd : actualEnd;
    const actualRange = mapDateRangeToPixels(
      timelineStart,
      actualStart,
      actualVisibleEnd < actualStart ? actualStart : actualVisibleEnd,
      zoomLevel,
    );
    actualLeft = actualRange.left;
    actualWidth = actualRange.width;

    if (actualEnd > plannedEnd) {
      delayDays = Math.max(diffCalendarDays(plannedEnd, actualEnd), 0);
      const delayStart = addDays(plannedEnd, 1);
      const overflowRange = mapDateRangeToPixels(timelineStart, delayStart, actualEnd, zoomLevel);
      overflowLeft = overflowRange.left;
      overflowWidth = overflowRange.width;
    }
  } else if (actualStart && task.progress > 0) {
    actualLeft = mapDateRangeToPixels(timelineStart, actualStart, actualStart, zoomLevel).left;
    actualWidth = Math.max(Math.round(plannedRange.width * (task.progress / 100)), Math.max(zoomLevel * 0.55, 8));
  }

  return {
    plannedLeft: plannedRange.left,
    plannedWidth: plannedRange.width,
    actualLeft,
    actualWidth,
    overflowLeft,
    overflowWidth,
    anchorStart: plannedRange.left,
    anchorEnd:
      overflowLeft != null && overflowWidth != null
        ? overflowLeft + overflowWidth
        : actualLeft != null && actualWidth != null
          ? actualLeft + actualWidth
          : plannedRange.left + plannedRange.width,
    delayDays,
  };
}

export default function GanttV3TaskBar({ task, layout, onClick }: TaskBarProps) {
  const phase = (task.phase as PhaseType) || 'physical';
  const colors = PHASE_COLORS[phase] || PHASE_COLORS.physical;
  const capsule = PHASE_CAPSULE[phase];
  const performance = calcTaskPerformance(task.baselineStart, task.baselineEnd, task.actualEnd);
  const predecessorCount = task.predecessors?.length ?? 0;
  const isMilestone = task.isMilestone || task.isMergePoint;

  return (
    <div className="absolute inset-0 cursor-pointer group" onClick={() => onClick(task)}>
      <div
        className="absolute top-1/2 -translate-y-1/2 rounded-full border border-white/[0.08]"
        style={{
          left: layout.plannedLeft,
          width: layout.plannedWidth,
          height: SHELL_HEIGHT,
          background: `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, ${capsule.track} 55%, rgba(0,0,0,0.18) 100%)`,
          boxShadow: `inset 0 2px 4px rgba(0,0,0,0.45), inset 0 -1px 2px rgba(255,255,255,0.04), 0 0 0 1px ${colors.primary}20`,
        }}
      >
        <div
          className="absolute inset-0 rounded-full opacity-[0.05]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.55) 4px, rgba(255,255,255,0.55) 5px)',
          }}
        />
      </div>

      {layout.actualLeft != null && layout.actualWidth != null && (
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200 group-hover:brightness-110"
          style={{
            left: layout.actualLeft,
            width: layout.actualWidth,
            height: ACTUAL_HEIGHT,
            background: capsule.gradient,
            boxShadow: capsule.glow,
          }}
        >
          <div
            className="absolute left-1 right-1 top-[2px] rounded-full"
            style={{
              height: 2,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.07) 100%)',
            }}
          />
        </div>
      )}

      {layout.overflowLeft != null && layout.overflowWidth != null && (
        <>
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: layout.overflowLeft,
              width: layout.overflowWidth,
              height: ACTUAL_HEIGHT,
              background: 'linear-gradient(90deg, rgba(139,0,0,0.95) 0%, rgba(255,49,49,0.95) 100%)',
              boxShadow: '0 0 16px rgba(255,49,49,0.45), 0 0 6px rgba(255,49,49,0.28)',
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 rounded-full border border-red-400/30 bg-red-500/12 px-1.5 py-[1px] text-[10px] font-bold text-red-300"
            style={{
              left: layout.overflowLeft + layout.overflowWidth + 6,
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            +{layout.delayDays}d
          </div>
        </>
      )}

      <div
        className="absolute top-1/2 -translate-y-1/2 rounded-full border border-white/[0.14] bg-[#05070b]"
        style={{
          left: layout.anchorStart - ANCHOR_SIZE / 2,
          width: ANCHOR_SIZE,
          height: ANCHOR_SIZE,
          boxShadow: predecessorCount > 0 ? `0 0 8px ${colors.primary}55` : 'none',
        }}
        data-anchor="start"
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 rounded-full border border-white/[0.14] bg-[#05070b]"
        style={{
          left: layout.anchorEnd - ANCHOR_SIZE / 2,
          width: ANCHOR_SIZE,
          height: ANCHOR_SIZE,
          boxShadow: predecessorCount > 0 ? `0 0 8px ${colors.primary}55` : 'none',
        }}
        data-anchor="end"
      />

      {isMilestone && (
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: layout.anchorEnd - 6,
            width: 12,
            height: 12,
            transform: 'translateY(-50%) rotate(45deg)',
            background: 'linear-gradient(135deg, rgba(0,255,255,0.18) 0%, rgba(0,255,255,0.42) 100%)',
            border: '1px solid rgba(0,255,255,0.75)',
            boxShadow: '0 0 8px rgba(0,255,255,0.35)',
          }}
        />
      )}

      <div
        className="pointer-events-none absolute -top-[76px] z-50 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ left: layout.plannedLeft }}
      >
        <div
          className="whitespace-nowrap rounded-xl border border-white/[0.08] px-3 py-2.5 backdrop-blur-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(15,15,20,0.95) 0%, rgba(25,25,35,0.95) 100%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                background: capsule.gradient,
                boxShadow: capsule.glow,
              }}
            />
            <span className="text-[12px] font-bold text-white/90" style={{ fontFamily: 'var(--font-display)' }}>
              {task.nameCn}
            </span>
            {layout.delayDays > 0 && (
              <span className="rounded bg-red-500/18 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                Delayed +{layout.delayDays}d
              </span>
            )}
            {predecessorCount > 0 && (
              <span className="rounded bg-cyan-500/18 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                Pred {predecessorCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-white/40" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>
              Plan {formatDateOrEmpty(task.baselineStart)} -&gt; {formatDateOrEmpty(task.baselineEnd)}
            </span>
            {performance && performance.delayDays !== 0 && (
              <span style={{ color: performance.intensity.color, fontWeight: 700 }}>
                {performance.delayDays > 0 ? `+${performance.delayDays}d` : `${performance.delayDays}d`}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>
            Actual {task.actualStart ? formatDateOrEmpty(task.actualStart) : '--'} -&gt;{' '}
            {task.actualEnd ? formatDateOrEmpty(task.actualEnd) : 'In Progress'}
          </div>
        </div>
      </div>
    </div>
  );
}
