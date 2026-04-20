import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GanttData, PhaseType, TaskNode } from '@shared/ganttEngine';
import { PHASE_COLORS } from '@shared/ganttEngine';

import ProductImageUpload from '@/components/ProductImageUpload';

import GanttV3Drawer from './GanttV3Drawer';
import GanttMergeLines from './GanttMergeLines';
import GanttV3Sidebar, {
  calcSidebarHeight,
  getFlatRows,
  getGroupHeaderPositions,
} from './GanttV3Sidebar';
import GanttV3TaskBar, { buildTaskBarLayout, type TaskBarLayout } from './GanttV3TaskBar';
import MilestoneMarker, {
  computeMilestoneLabelRows,
  dateToPixel,
  MILESTONE_BOTTOM_ROW_HEIGHT,
  MILESTONE_TOP_ROW_HEIGHT as BASE_MILESTONE_TOP_ROW_HEIGHT,
} from './MilestoneMarker';

const ROW_HEIGHT = 48;
const GROUP_HEADER_HEIGHT = 48;
const SIDEBAR_WIDTH = 380;
const TIMELINE_HEADER_HEIGHT = 64;
const LEFT_HEADER_HEIGHT = TIMELINE_HEADER_HEIGHT;
const DEFAULT_ZOOM_LEVEL = 34;

type RenderedRow = {
  task: TaskNode;
  yOffset: number;
  groupId: string;
  phase: PhaseType;
  layout: TaskBarLayout;
};

interface GanttV3ChartProps {
  data: GanttData;
  projectId?: string;
  productImageUrl?: string;
  onProductImageUpload?: (url: string) => void;
  evidenceCounts?: Record<string, number>;
  isMobile?: boolean;
}

function parseChartDate(dateText: string): Date {
  const parts = dateText.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const date = new Date(dateText);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysDiff(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 86400000;
}

function isWeekendDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getWeekNumber(date: Date): number {
  const oneJan = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
}

export default function GanttV3Chart({
  data,
  projectId,
  productImageUrl,
  onProductImageUpload,
  evidenceCounts,
  isMobile,
}: GanttV3ChartProps) {
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoomLevel] = useState(DEFAULT_ZOOM_LEVEL);

  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightBodyRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const startDate = useMemo(() => parseChartDate(data.dateRange.start), [data.dateRange.start]);
  const endDate = useMemo(() => parseChartDate(data.dateRange.end), [data.dateRange.end]);
  const totalDays = useMemo(() => Math.max(1, Math.ceil(daysDiff(startDate, endDate))), [endDate, startDate]);
  const timelineWidth = totalDays * zoomLevel;

  const milestoneLabelRows = useMemo(
    () => computeMilestoneLabelRows(data.milestones, startDate, totalDays, timelineWidth),
    [data.milestones, startDate, timelineWidth, totalDays],
  );

  const milestoneTopHeight = useMemo(() => {
    let maxLabelRow = 0;
    milestoneLabelRows.forEach((row) => {
      if (row > maxLabelRow) {
        maxLabelRow = row;
      }
    });
    return BASE_MILESTONE_TOP_ROW_HEIGHT + maxLabelRow * 28;
  }, [milestoneLabelRows]);

  const rows = useMemo(
    () => getFlatRows(data.tracks, data.postMergeTasks, collapsedGroups, ROW_HEIGHT, GROUP_HEADER_HEIGHT),
    [collapsedGroups, data.postMergeTasks, data.tracks],
  );

  const totalHeight = useMemo(
    () => calcSidebarHeight(data.tracks, data.postMergeTasks, collapsedGroups, ROW_HEIGHT, GROUP_HEADER_HEIGHT),
    [collapsedGroups, data.postMergeTasks, data.tracks],
  );

  const groupPositions = useMemo(
    () => getGroupHeaderPositions(data.tracks, data.postMergeTasks, collapsedGroups, ROW_HEIGHT, GROUP_HEADER_HEIGHT),
    [collapsedGroups, data.postMergeTasks, data.tracks],
  );

  const renderedRows = useMemo<RenderedRow[]>(
    () =>
      rows.map((row) => ({
        ...row,
        layout: buildTaskBarLayout(row.task, startDate, zoomLevel),
      })),
    [rows, startDate, zoomLevel],
  );

  const rowLookup = useMemo(() => {
    const map = new Map<string, RenderedRow>();
    for (const row of renderedRows) {
      map.set(row.task.id, row);
    }
    return map;
  }, [renderedRows]);

  const today = useMemo(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }, []);
  const todayOffset = Math.max(0, daysDiff(startDate, today)) * zoomLevel;

  const days = useMemo(() => {
    const timelineDays: Date[] = [];
    for (let index = 0; index < totalDays; index += 1) {
      timelineDays.push(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + index));
    }
    return timelineDays;
  }, [startDate, totalDays]);

  const months = useMemo(() => {
    const items: { label: string; count: number }[] = [];
    let currentLabel = '';
    for (const day of days) {
      const label = day.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
      if (label !== currentLabel) {
        items.push({ label, count: 1 });
        currentLabel = label;
      } else {
        items[items.length - 1].count += 1;
      }
    }
    return items;
  }, [days]);

  const weeks = useMemo(() => {
    const items: { label: string; count: number }[] = [];
    let currentWeek = -1;
    for (const day of days) {
      const weekNumber = getWeekNumber(day);
      if (weekNumber !== currentWeek) {
        items.push({ label: `W${weekNumber}`, count: 1 });
        currentWeek = weekNumber;
      } else {
        items[items.length - 1].count += 1;
      }
    }
    return items;
  }, [days]);

  const dependencyLines = useMemo(() => {
    if (!selectedTask) return [];

    const relatedIds = new Set<string>([
      selectedTask.id,
      ...(selectedTask.predecessors ?? []),
      ...data.dependencies.filter((dependency) => dependency.predecessorId === selectedTask.id).map((dependency) => dependency.taskId),
    ]);

    const lines: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isHighlight: boolean;
      isMerge: boolean;
    }[] = [];

    for (const row of renderedRows) {
      if (!relatedIds.has(row.task.id)) continue;

      const deps = data.dependencies.filter((dependency) => dependency.taskId === row.task.id);
      for (const dependency of deps) {
        const predecessorRow = rowLookup.get(dependency.predecessorId);
        if (!predecessorRow) continue;

        lines.push({
          x1: predecessorRow.layout.anchorEnd,
          y1: predecessorRow.yOffset + ROW_HEIGHT / 2,
          x2: row.layout.anchorStart,
          y2: row.yOffset + ROW_HEIGHT / 2,
          isHighlight: row.task.id === selectedTask.id || predecessorRow.task.id === selectedTask.id,
          isMerge: row.task.isMergePoint,
        });
      }
    }

    return lines;
  }, [data.dependencies, renderedRows, rowLookup, selectedTask]);

  const contentHeight = milestoneTopHeight + totalHeight + MILESTONE_BOTTOM_ROW_HEIGHT;

  const handleTaskClick = useCallback((task: TaskNode) => {
    setSelectedTask(task);
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleRightBodyScroll = useCallback(() => {
    if (!rightBodyRef.current || !leftBodyRef.current || syncingRef.current) return;

    syncingRef.current = true;
    leftBodyRef.current.scrollTop = rightBodyRef.current.scrollTop;
    setScrollLeft(rightBodyRef.current.scrollLeft);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  const handleLeftBodyScroll = useCallback(() => {
    if (!rightBodyRef.current || !leftBodyRef.current || syncingRef.current) return;

    syncingRef.current = true;
    rightBodyRef.current.scrollTop = leftBodyRef.current.scrollTop;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (!rightBodyRef.current) return;

    const inProgressTasks = data.tasks.filter((task) => task.status === 'InProgress');
    if (inProgressTasks.length === 0) return;

    const latestStart = inProgressTasks.reduce((latest, task) => {
      return task.baselineStart > latest ? task.baselineStart : latest;
    }, '2000-01-01');

    const focusOffset = daysDiff(startDate, parseChartDate(latestStart)) * zoomLevel;
    rightBodyRef.current.scrollLeft = Math.max(0, focusOffset - 300);
    setScrollLeft(rightBodyRef.current.scrollLeft);
  }, [data.tasks, startDate, zoomLevel]);

  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)] overflow-hidden bg-[#0A0A0A]">
      <div
        className={`flex min-h-0 flex-col border-r border-white/[0.06] bg-[#0D0D0D] ${isMobile ? 'hidden' : ''}`}
        style={{ width: SIDEBAR_WIDTH }}
      >
        <div
          className="shrink-0 box-border flex items-center justify-between overflow-hidden border-b border-white/[0.06] bg-[#0A0A0A] pl-6 pr-3"
          style={{ height: LEFT_HEADER_HEIGHT }}
        >
          <span className="t-num text-[13px] font-semibold text-slate-300" style={{ fontFamily: 'var(--font-mono)' }}>
            {data.tasks.length} tasks · {data.tracks.length} tracks
          </span>
          {projectId && (
            <ProductImageUpload
              projectId={projectId}
              productImageUrl={productImageUrl}
              onUploadSuccess={onProductImageUpload}
              compact
            />
          )}
        </div>

        <div
          ref={leftBodyRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden gantt-scroll"
          onScroll={handleLeftBodyScroll}
          style={{ scrollbarGutter: 'stable' }}
        >
          <div style={{ height: contentHeight }}>
            <div
              className="sticky top-0 z-30 w-full border-b border-white/[0.04] bg-[#0A0A0A]"
              style={{ height: milestoneTopHeight }}
            />
            <div style={{ height: totalHeight }}>
              <GanttV3Sidebar
                tracks={data.tracks}
                postMergeTasks={data.postMergeTasks}
                selectedTaskId={selectedTask?.id ?? null}
                hoveredTaskId={hoveredTaskId}
                collapsedGroups={collapsedGroups}
                onTaskClick={handleTaskClick}
                onToggleGroup={toggleGroup}
                onHoverTask={setHoveredTaskId}
                rowHeight={ROW_HEIGHT}
                groupHeaderHeight={GROUP_HEADER_HEIGHT}
                evidenceCounts={evidenceCounts}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div
          className="shrink-0 box-border overflow-hidden border-b border-white/[0.06] bg-[#0A0A0A]"
          style={{ height: TIMELINE_HEADER_HEIGHT }}
        >
          <div style={{ transform: `translateX(-${scrollLeft}px)`, width: timelineWidth }}>
            <div className="flex" style={{ height: 22 }}>
              {months.map((month, index) => (
                <div key={`${month.label}-${index}`} className="flex items-center border-r border-white/[0.06] px-3" style={{ width: month.count * zoomLevel }}>
                  <span className="truncate text-sm font-semibold text-slate-100" style={{ fontFamily: 'var(--font-display)' }}>
                    {month.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex" style={{ height: 22 }}>
              {weeks.map((week, index) => (
                <div key={`${week.label}-${index}`} className="flex items-center justify-center border-r border-white/[0.06]" style={{ width: week.count * zoomLevel }}>
                  <span className="text-[12px] font-semibold text-slate-300" style={{ fontFamily: 'var(--font-mono)' }}>
                    {week.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex" style={{ height: 20 }}>
              {days.map((day, index) => {
                const weekend = isWeekendDay(day);
                const isToday =
                  day.getFullYear() === today.getFullYear() &&
                  day.getMonth() === today.getMonth() &&
                  day.getDate() === today.getDate();

                return (
                  <div key={`day-${index}`} className={`${weekend ? 'bg-white/[0.02]' : ''} ${isToday ? 'bg-[#4A90E2]/12' : ''} flex items-center justify-center`} style={{ width: zoomLevel }}>
                    <span className={`${weekend ? 'text-white/20' : isToday ? 'text-[#4A90E2] font-bold' : 'text-slate-400'} text-[11px] font-semibold`} style={{ fontFamily: 'var(--font-mono)' }}>
                      {day.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          ref={rightBodyRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-auto gantt-scroll"
          onScroll={handleRightBodyScroll}
          style={{ scrollbarGutter: 'stable both-edges', overscrollBehavior: 'contain' }}
        >
          <div className="relative" style={{ width: timelineWidth, height: contentHeight }}>
            <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0A0A0A]" style={{ width: timelineWidth, height: milestoneTopHeight }}>
              {data.milestones.map((milestone) => (
                <MilestoneMarker
                  key={`header-${milestone.id}`}
                  milestone={milestone}
                  leftPx={dateToPixel(new Date(milestone.date), startDate, totalDays, timelineWidth)}
                  gridHeight={0}
                  showTopDiamond
                  showLine={false}
                  showBottomDiamond={false}
                  labelRow={milestoneLabelRows.get(milestone.id) || 0}
                />
              ))}
            </div>

            {data.milestones.map((milestone) => (
              <MilestoneMarker
                key={`body-${milestone.id}`}
                milestone={milestone}
                leftPx={dateToPixel(new Date(milestone.date), startDate, totalDays, timelineWidth)}
                gridHeight={totalHeight}
                showTopDiamond={false}
                showLine
                showBottomDiamond
              />
            ))}

            <div className="absolute left-0 right-0" style={{ top: milestoneTopHeight, width: timelineWidth, height: totalHeight }}>
              <svg className="absolute inset-0 pointer-events-none" width={timelineWidth} height={totalHeight}>
                {days.map((day, index) => {
                  const x = index * zoomLevel;
                  const weekend = isWeekendDay(day);

                  return (
                    <g key={`grid-${index}`}>
                      {weekend && <rect x={x} y={0} width={zoomLevel} height={totalHeight} fill="rgba(71,85,105,0.18)" />}
                      <line x1={x} y1={0} x2={x} y2={totalHeight} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
                    </g>
                  );
                })}

                {renderedRows.map((row, index) => (
                  <rect
                    key={`zebra-${row.task.id}`}
                    x={0}
                    y={row.yOffset}
                    width={timelineWidth}
                    height={ROW_HEIGHT}
                    fill={index % 2 === 1 ? 'rgba(255,255,255,0.018)' : 'transparent'}
                  />
                ))}

                {renderedRows.map((row) => (
                  <line
                    key={`row-line-${row.task.id}`}
                    x1={0}
                    y1={row.yOffset + ROW_HEIGHT}
                    x2={timelineWidth}
                    y2={row.yOffset + ROW_HEIGHT}
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth={0.5}
                  />
                ))}

                {dependencyLines.map((line, index) => {
                  const cpOffset = Math.min(Math.abs(line.x2 - line.x1) * 0.3, 35);
                  const path = `M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`;

                  return (
                    <g key={`dep-${index}`}>
                      <path
                        d={path}
                        fill="none"
                        stroke={line.isHighlight ? '#4A90E2' : line.isMerge ? '#DAA520' : '#555'}
                        strokeWidth={line.isHighlight ? 1.5 : 1}
                        opacity={line.isHighlight ? 0.52 : 0.22}
                        strokeDasharray={line.isMerge ? '4 3' : 'none'}
                      />
                    </g>
                  );
                })}

                <line x1={todayOffset} y1={0} x2={todayOffset} y2={totalHeight} stroke="#4A90E2" strokeWidth={1} opacity={0.4} />
              </svg>

              <GanttMergeLines rows={renderedRows} startDate={startDate} dayWidth={zoomLevel} rowHeight={ROW_HEIGHT} />

              {groupPositions.map((group) => {
                const colors = PHASE_COLORS[group.phase as PhaseType] || PHASE_COLORS.physical;
                const paddingLeft = group.type === 'l2' ? 16 : group.type === 'l3' ? 28 : 40;
                return (
                  <div
                    key={group.id}
                    className="absolute left-0 right-0 flex items-center pointer-events-none"
                    style={{ top: group.yOffset, height: GROUP_HEADER_HEIGHT, paddingLeft }}
                  >
                    <span className="font-bold uppercase tracking-[0.2em]" style={{ color: colors.primary, fontFamily: 'var(--font-display)', fontSize: group.type === 'l2' ? 11 : 9, opacity: group.type === 'l2' ? 0.2 : 0.12 }}>
                      {group.label}
                    </span>
                  </div>
                );
              })}

              <div className="absolute z-20 -translate-x-1/2" style={{ left: todayOffset, top: 0 }}>
                <div className="rounded-b-md bg-[#4A90E2]/70 px-2 py-[2px] text-[9px] font-bold text-white" style={{ fontFamily: 'var(--font-mono)' }}>
                  TODAY
                </div>
              </div>

              {renderedRows.map((row) => {
                const isHovered = hoveredTaskId === row.task.id;
                return (
                  <div
                    key={row.task.id}
                    className="absolute left-0 right-0 transition-all duration-150"
                    style={{
                      top: row.yOffset,
                      height: ROW_HEIGHT,
                      background: isHovered ? 'rgba(34,211,238,0.04)' : 'transparent',
                      borderTop: isHovered ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
                      borderBottom: isHovered ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
                    }}
                    onMouseEnter={() => setHoveredTaskId(row.task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                  >
                    <GanttV3TaskBar task={row.task} layout={row.layout} onClick={handleTaskClick} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <GanttV3Drawer task={selectedTask} allTasks={data.tasks} dependencies={data.dependencies} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
