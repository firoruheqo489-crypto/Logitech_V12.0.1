/**
 * TaskBar V3.1 — Flat Capsule Design
 * No borders, pure color fill, reduced height, increased vertical spacing
 */

import { type GanttTask, PHASE_COLORS } from '@/lib/data';

interface TaskBarProps {
  task: GanttTask;
  startDate: Date;
  dayWidth: number;
  onClick: (task: GanttTask) => void;
  animationDelay?: number;
}

function daysDiff(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

export default function TaskBar({ task, startDate, dayWidth, onClick, animationDelay = 0 }: TaskBarProps) {
  const plannedStart = new Date(task.plannedStart);
  const plannedEnd = new Date(task.plannedEnd);
  const actualStart = task.actualStart ? new Date(task.actualStart) : null;
  const actualEnd = task.actualEnd ? new Date(task.actualEnd) : null;

  const plannedX = daysDiff(startDate, plannedStart) * dayWidth;
  const plannedWidth = daysDiff(plannedStart, plannedEnd) * dayWidth;

  const colors = PHASE_COLORS[task.phase as keyof typeof PHASE_COLORS] || PHASE_COLORS.physical;

  // Capsule bar height - 70% of row height (28px * 0.7 = ~20px)
  const barHeight = 16;
  const barGap = 3; // Vertical gap between planned and actual

  return (
    <div
      className="absolute top-0 bottom-0 flex items-center cursor-pointer group"
      style={{
        left: plannedX,
        width: plannedWidth,
        animationDelay: `${animationDelay}ms`,
      }}
      onClick={() => onClick(task)}
    >
      <div className="relative w-full flex flex-col justify-center gap-[3px]">
        {/* Planned bar - Upper track */}
        <div
          className="relative rounded-full transition-all duration-200 group-hover:brightness-110"
          style={{
            height: barHeight,
            backgroundColor: colors.primary,
            opacity: 0.85,
          }}
        >
          {/* Progress fill */}
          {task.progress > 0 && (
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full"
              style={{
                width: `${task.progress}%`,
                backgroundColor: colors.primary,
                filter: 'brightness(1.15)',
              }}
            />
          )}

          {/* Task label - only show on hover or if critical */}
          <div className="absolute inset-0 flex items-center px-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] font-semibold text-white truncate" style={{ fontFamily: 'var(--font-body)' }}>
              {task.nameCn}
            </span>
          </div>

          {/* Critical path indicator */}
          {task.isCritical && (
            <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-[#D63031] animate-pulse" />
          )}
        </div>

        {/* Actual bar - Lower track (if exists) */}
        {actualStart && (
          <div
            className="absolute rounded-full"
            style={{
              left: daysDiff(plannedStart, actualStart) * dayWidth,
              width: actualEnd 
                ? daysDiff(actualStart, actualEnd) * dayWidth 
                : daysDiff(actualStart, new Date()) * dayWidth,
              height: barHeight * 0.6,
              backgroundColor: colors.primary,
              opacity: 0.25,
              top: barHeight + barGap,
            }}
          />
        )}

        {/* Merge point indicator - Magnetic attraction effect */}
        {task.isMergePoint && (
          <div className="absolute -right-3 top-1/2 -translate-y-1/2">
            {/* Outer glow ring */}
            <div className="absolute inset-0 w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4A90E2]/20 animate-breathe-slow" />
            {/* Core beacon */}
            <div className="relative w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#4A90E2] to-[#2D6CB5] shadow-xl animate-pulse" />
          </div>
        )}

        {/* Delayed indicator */}
        {task.status === 'delayed' && (
          <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#D63031] text-white text-[7px] font-bold animate-pulse" style={{ fontFamily: 'var(--font-mono)' }}>
            DELAYED
          </div>
        )}
      </div>

      {/* Hover tooltip */}
      <div className="absolute left-0 -top-12 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
        <div className="px-3 py-2 rounded-lg bg-[#2A2A2A] border border-white/[0.15] shadow-2xl whitespace-nowrap">
          <div className="text-[10px] font-bold text-white/90 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            {task.nameCn}
          </div>
          <div className="flex items-center gap-3 text-[8px] text-white/60" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>计划 {task.plannedStart} → {task.plannedEnd}</span>
            {task.progress > 0 && <span className="text-[#FDCB6E]">{task.progress}%</span>}
          </div>
          {task.actualStart && (
            <div className="text-[8px] text-white/40 mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
              实际 {task.actualStart} → {task.actualEnd || '进行中...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
