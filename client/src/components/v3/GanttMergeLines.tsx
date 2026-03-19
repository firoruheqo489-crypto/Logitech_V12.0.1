/**
 * GanttMergeLines — Logic Convergence Visualization
 *
 * Renders SVG lines connecting the end of 4 parallel tracks (Physical Phase)
 * to the "T0 Trial" milestone task.
 *
 * Logic:
 * 1. Find the last task of each of the 4 tracks (Cavity Core, Cavity Insert, Lifter, Slider).
 * 2. Find the target "T0 Trial" task.
 * 3. Draw 90-degree elbow lines from track ends to the target start.
 */

import { useMemo } from 'react';
import type { TaskNode, PhaseType } from '@shared/ganttEngine';
import { PHASE_COLORS } from '@shared/ganttEngine';

interface GanttMergeLinesProps {
  /** All visible rows with calculated yOffset */
  rows: { task: TaskNode; yOffset: number; groupId: string; phase: PhaseType }[];
  startDate: Date;
  dayWidth: number;
  rowHeight: number;
}

export default function GanttMergeLines({
  rows,
  startDate,
  dayWidth,
  rowHeight,
}: GanttMergeLinesProps) {
  const { mergeLines, mergeTargetPoint, divergeLines, divergeSourcePoint } = useMemo(() => {
    const result = {
      mergeLines: [] as string[],
      mergeTargetPoint: null as { x: number; y: number } | null,
      divergeLines: [] as string[],
      divergeSourcePoint: null as { x: number; y: number } | null,
    };

    // ═════════════════════════════════════════════════════════════════════════
    // 1. Merge Lines: Tracks -> Mold FAI/CPK (T0 Trial)
    // ═════════════════════════════════════════════════════════════════════════
    
    // Identify Target: "模具FaiCpk报告"
    const targetRow = rows.find((r) => r.task.id === 'mold_fai_cpk');

    if (targetRow) {
      // Target coordinates (Left edge of Mold FAI/CPK capsule)
      const targetDate = parseLocalDate(targetRow.task.baselineStart);
      const targetX = getX(targetDate, startDate, dayWidth);
      const targetY = targetRow.yOffset + rowHeight / 2;
      
      result.mergeTargetPoint = { x: targetX, y: targetY };

      // Identify Sources: Last task of specific tracks
      const trackIds = ['cavity_core', 'cavity_insert', 'lifter', 'slider'];

      trackIds.forEach((tid) => {
        // Find all rows belonging to this track
        const trackRows = rows.filter(
          (r) => r.task.track === tid || r.groupId.includes(tid)
        );

        if (trackRows.length === 0) return;

        // Find the task with the max baselineEnd (latest task in this track)
        const lastTaskRow = trackRows.reduce((prev, curr) => {
          const prevEnd = parseLocalDate(prev.task.baselineEnd).getTime();
          const currEnd = parseLocalDate(curr.task.baselineEnd).getTime();
          return currEnd > prevEnd ? curr : prev;
        }, trackRows[0]);

        // Source coordinates (Right edge of actual capsule)
        // If task has actual_end, use it (capsule extends to actual_end)
        // Otherwise use baseline_end (shell right edge)
        const actualEnd = lastTaskRow.task.actualEnd
          ? parseLocalDate(lastTaskRow.task.actualEnd)
          : null;
        const endDate = actualEnd || parseLocalDate(lastTaskRow.task.baselineEnd);
        const sourceX = getX(endDate, startDate, dayWidth) + dayWidth;
        const sourceY = lastTaskRow.yOffset + rowHeight / 2;

        // Cubic Bezier Curve
        const cpOffset = (targetX - sourceX) * 0.5;
        const c1x = sourceX + cpOffset;
        const c1y = sourceY;
        const c2x = targetX - cpOffset;
        const c2y = targetY;
        
        const path = `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}`;
        result.mergeLines.push(path);
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 2. Diverge Lines: MTD -> 4 Milling Tasks
    // ═════════════════════════════════════════════════════════════════════════

    // Identify Source: "MTD" (stage='mtd')
    const mtdRow = rows.find((r) => r.task.stage === 'mtd');

    if (mtdRow) {
      // Source coordinates (Right edge of MTD capsule)
      // Use actual_end if available (capsule extends to actual_end)
      const mtdActualEnd = mtdRow.task.actualEnd
        ? parseLocalDate(mtdRow.task.actualEnd)
        : null;
      const mtdEnd = mtdActualEnd || parseLocalDate(mtdRow.task.baselineEnd);
      const sourceX = getX(mtdEnd, startDate, dayWidth) + dayWidth;
      const sourceY = mtdRow.yOffset + rowHeight / 2;
      
      result.divergeSourcePoint = { x: sourceX, y: sourceY };

      // Identify Targets: First task ("Milling") of each track
      const trackIds = ['cavity_core', 'cavity_insert', 'lifter', 'slider'];
      
      trackIds.forEach((tid) => {
        // Find rows belonging to track
        const trackRows = rows.filter(
          (r) => r.task.track === tid || r.groupId.includes(tid)
        );
        
        if (trackRows.length === 0) return;

        // Find the canonical milling stage or fall back to the earliest task.
        const millingRow = trackRows.find((r) => r.task.stage === 'milling');
        
        // Fallback to earliest task if milling specifically not found
        const targetTaskRow = millingRow || trackRows.reduce((prev, curr) => {
           const prevStart = parseLocalDate(prev.task.baselineStart).getTime();
           const currStart = parseLocalDate(curr.task.baselineStart).getTime();
           return currStart < prevStart ? curr : prev;
        }, trackRows[0]);

        if (!targetTaskRow) return;

        // Target coordinates (Left edge of Milling capsule)
        const targetDate = parseLocalDate(targetTaskRow.task.baselineStart);
        const targetX = getX(targetDate, startDate, dayWidth);
        const targetY = targetTaskRow.yOffset + rowHeight / 2;

        // Cubic Bezier Curve (Diverging)
        const cpOffset = (targetX - sourceX) * 0.5;
        const c1x = sourceX + cpOffset;
        const c1y = sourceY;
        const c2x = targetX - cpOffset;
        const c2y = targetY;
        
        const path = `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}`;
        result.divergeLines.push(path);
      });
    }

    return result;
  }, [rows, startDate, dayWidth, rowHeight]);

  // Colors
  const mergeColor = 'rgba(34, 211, 238, 0.4)'; // Cyan
  const mergeGlow = 'drop-shadow(0 0 2px rgba(34, 211, 238, 0.3))';
  
  // MTD is 'data' phase -> Purple/Violet usually. 
  const divergeColor = `${PHASE_COLORS.data.primary}66`; // #A29BFE with ~40% opacity (hex 66)
  const divergeGlow = `drop-shadow(0 0 2px ${PHASE_COLORS.data.primary}4D)`; // ~30% opacity

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-20 overflow-visible"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        {/* Cyan Glow Filter */}
        <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* ── Merge Lines (Cyan) ── */}
      {mergeLines.map((pathD, i) => (
        <path
          key={`merge-${i}`}
          d={pathD}
          fill="none"
          stroke={mergeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: mergeGlow,
            vectorEffect: 'non-scaling-stroke'
          }}
        />
      ))}

      {/* Merge Target Dot */}
      {mergeTargetPoint && (
        <circle
          cx={mergeTargetPoint.x}
          cy={mergeTargetPoint.y}
          r={3}
          className="fill-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]"
        />
      )}

      {/* ── Diverge Lines (Purple/MTD) ── */}
      {divergeLines.map((pathD, i) => (
        <path
          key={`diverge-${i}`}
          d={pathD}
          fill="none"
          stroke={divergeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: divergeGlow,
            vectorEffect: 'non-scaling-stroke'
          }}
        />
      ))}

      {/* Diverge Source Dot (at MTD Right) */}
      {divergeSourcePoint && (
        <circle
          cx={divergeSourcePoint.x}
          cy={divergeSourcePoint.y}
          r={3}
          fill={PHASE_COLORS.data.primary}
          className="drop-shadow-[0_0_4px_rgba(162,155,254,0.8)]"
        />
      )}
    </svg>
  );
}

/** Parse date string to local Date (same as GanttV3TaskBar.parseLocalDate) */
function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getX(date: Date, startDate: Date, dayWidth: number) {
  const diffTime = date.getTime() - startDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays * dayWidth;
}
