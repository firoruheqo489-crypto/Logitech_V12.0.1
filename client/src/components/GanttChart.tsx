/**
 * GanttChart V3.1 — Precision Industrial Dashboard
 * Ultra-narrow sidebar, floating task bars, hidden logic lines, lighthouse milestones
 * 
 * Design: Dark mode #1A1A1A, capsule task bars, breathing merge point, 1px silk curves
 */

import { type GanttTask, type Milestone, type ProjectInfo, type StreamId, getDateRange, STREAM_LABELS, PHASE_COLORS, isSunday } from '@/lib/data';
import TaskBar from './TaskBar';
import TaskDrawer from './TaskDrawer';
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Layers, GitMerge, Zap, Package } from 'lucide-react';

function daysDiff(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

interface GanttChartProps {
  tasks: GanttTask[];
  milestones: Milestone[];
  projectInfo: ProjectInfo;
}

const ROW_HEIGHT = 28; // Reduced by 30%
const DAY_WIDTH = 32;
const GROUP_HEADER_HEIGHT = 32;
const SIDEBAR_WIDTH = 200; // Readable width with full text

interface TaskGroup {
  id: string;
  label: string;
  labelCn: string;
  phase: string;
  icon: React.ReactNode;
  tasks: GanttTask[];
}

export default function GanttChart({ tasks, milestones, projectInfo }: GanttChartProps) {
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const ganttScrollRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  const { start: startDate, end: endDate } = useMemo(() => getDateRange(tasks), [tasks]);
  const totalDays = Math.ceil(daysDiff(startDate, endDate));

  const handleTaskClick = useCallback((task: GanttTask) => {
    setSelectedTask(task);
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // Sync vertical scroll
  const syncingRef = useRef(false);
  const handleGanttScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (ganttScrollRef.current && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = ganttScrollRef.current.scrollTop;
      setScrollLeft(ganttScrollRef.current.scrollLeft);
    }
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, []);

  const handleLeftScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (ganttScrollRef.current && leftPanelRef.current) {
      ganttScrollRef.current.scrollTop = leftPanelRef.current.scrollTop;
    }
    requestAnimationFrame(() => { syncingRef.current = false; });
  }, []);

  // Scroll to show current progress area on mount
  useEffect(() => {
    if (ganttScrollRef.current) {
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
      if (inProgressTasks.length > 0) {
        const latestStart = inProgressTasks.reduce((latest, t) => {
          return t.plannedStart > latest ? t.plannedStart : latest;
        }, '2000-01-01');
        const focusDate = new Date(latestStart);
        const focusOffset = daysDiff(startDate, focusDate) * DAY_WIDTH;
        ganttScrollRef.current.scrollLeft = Math.max(0, focusOffset - 300);
      } else {
        ganttScrollRef.current.scrollLeft = 0;
      }
    }
  }, [startDate, tasks]);

  // Build groups
  const groups = useMemo(() => buildGroups(tasks), [tasks]);

  // Build visible rows for gantt body
  const { rows, totalHeight } = useMemo(() => {
    const rows: { task: GanttTask; yOffset: number; groupId: string }[] = [];
    let y = 0;

    groups.forEach(group => {
      y += GROUP_HEADER_HEIGHT;
      if (!collapsedGroups.has(group.id)) {
        group.tasks.forEach(task => {
          rows.push({ task, yOffset: y, groupId: group.id });
          y += ROW_HEIGHT;
        });
      }
    });

    return { rows, totalHeight: y + 40 };
  }, [groups, collapsedGroups]);

  // Today line
  const today = new Date();
  const todayOffset = Math.max(0, daysDiff(startDate, today)) * DAY_WIDTH;

  // Dependency lines - HIDDEN BY DEFAULT, only show when task selected
  const dependencyLines = useMemo(() => {
    if (!selectedTask) return [];
    
    const lines: { x1: number; y1: number; x2: number; y2: number; isCritical: boolean; isMerge: boolean; isHighlight: boolean }[] = [];
    
    // Find all dependencies related to selected task
    const relatedTaskIds = new Set([
      selectedTask.id,
      ...selectedTask.dependencies,
      ...tasks.filter(t => t.dependencies.includes(selectedTask.id)).map(t => t.id),
    ]);

    rows.forEach(row => {
      if (!relatedTaskIds.has(row.task.id)) return;
      
      row.task.dependencies.forEach(depId => {
        const depRow = rows.find(r => r.task.id === depId);
        if (!depRow) return;

        const depEnd = new Date(depRow.task.plannedEnd);
        const taskStart = new Date(row.task.plannedStart);

        const x1 = daysDiff(startDate, depEnd) * DAY_WIDTH;
        const y1 = depRow.yOffset + ROW_HEIGHT / 2;
        const x2 = daysDiff(startDate, taskStart) * DAY_WIDTH;
        const y2 = row.yOffset + ROW_HEIGHT / 2;

        lines.push({
          x1, y1, x2, y2,
          isCritical: row.task.isCritical && depRow.task.isCritical,
          isMerge: row.task.isMergePoint === true,
          isHighlight: row.task.id === selectedTask.id || depRow.task.id === selectedTask.id,
        });
      });
    });

    return lines;
  }, [rows, startDate, selectedTask, tasks]);

  // Timeline data
  const days: Date[] = useMemo(() => {
    const d: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      d.push(date);
    }
    return d;
  }, [startDate, totalDays]);

  const months = useMemo(() => {
    const m: { label: string; startIdx: number; count: number }[] = [];
    let current = '';
    days.forEach((d, i) => {
      const label = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
      if (label !== current) {
        m.push({ label, startIdx: i, count: 1 });
        current = label;
      } else {
        m[m.length - 1].count++;
      }
    });
    return m;
  }, [days]);

  const weeks = useMemo(() => {
    const w: { label: string; startIdx: number; count: number }[] = [];
    let current = -1;
    days.forEach((d, i) => {
      const wn = getWeekNumber(d);
      if (wn !== current) {
        w.push({ label: `W${wn}`, startIdx: i, count: 1 });
        current = wn;
      } else {
        w[w.length - 1].count++;
      }
    });
    return w;
  }, [days]);

  // Group header positions for gantt body
  const groupHeaderPositions = useMemo(() => {
    const positions: { id: string; label: string; phase: string; yOffset: number }[] = [];
    let y = 0;
    groups.forEach(group => {
      positions.push({ id: group.id, label: group.labelCn, phase: group.phase, yOffset: y });
      y += GROUP_HEADER_HEIGHT;
      if (!collapsedGroups.has(group.id)) {
        y += group.tasks.length * ROW_HEIGHT;
      }
    });
    return positions;
  }, [groups, collapsedGroups]);

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden bg-[#1A1A1A]">
      {/* ─── Left Panel with Full Text ─── */}
      <div 
        className="shrink-0 flex flex-col border-r border-white/[0.08] bg-[#121212] z-20"
        style={{ width: SIDEBAR_WIDTH }}
      >
        {/* Left Timeline Header */}
        <div className="shrink-0 bg-[#1A1A1A] border-b border-white/[0.06]">
          <div className="h-[28px] flex items-center px-4 border-b border-white/[0.03]">
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.12em]" style={{ fontFamily: 'var(--font-display)' }}>
              工序 / 任务
            </span>
          </div>
          <div className="h-[24px] flex items-center px-4 border-b border-white/[0.03]">
            <span className="text-[8px] text-white/25" style={{ fontFamily: 'var(--font-mono)' }}>
              {tasks.length} tasks · {groups.length} groups
            </span>
          </div>
          <div className="h-[20px]" />
        </div>

        {/* Left Scrollable Content */}
        <div
          ref={leftPanelRef}
          className="flex-1 overflow-y-auto overflow-x-hidden gantt-scroll"
          onScroll={handleLeftScroll}
        >
          <div style={{ height: totalHeight }}>
            {groups.map((group, gi) => {
              const isCollapsed = collapsedGroups.has(group.id);
              const isHovered = hoveredGroup === group.id;
              const colors = PHASE_COLORS[group.phase as keyof typeof PHASE_COLORS] || PHASE_COLORS.physical;

              return (
                <div key={group.id}>
                  {/* Group Header - Two-level hierarchy */}
                  <div
                    className="flex items-center gap-2.5 px-3 cursor-pointer transition-all duration-200 border-b border-white/[0.04]"
                    style={{ 
                      height: GROUP_HEADER_HEIGHT,
                      background: `linear-gradient(90deg, ${colors.primary}12, transparent)`,
                    }}
                    onClick={() => toggleGroup(group.id)}
                  >
                    {/* Expand/Collapse arrow */}
                    <span className="text-white/30 transition-transform duration-200" style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>

                    {/* Icon */}
                    <span style={{ color: colors.primary }}>
                      {group.icon}
                    </span>
                    
                    {/* Group name */}
                    <span className="text-[11px] font-bold text-[#E0E0E0] flex-1" style={{ fontFamily: 'var(--font-display)' }}>
                      {group.labelCn}
                    </span>

                    {/* Task count badge */}
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full text-white/40" style={{ fontFamily: 'var(--font-mono)', backgroundColor: `${colors.primary}15` }}>
                      {group.tasks.length}
                    </span>
                  </div>

                  {/* Task Rows - Full text with indentation */}
                  {!isCollapsed && group.tasks.map((task, ti) => {
                    const isSelected = task.id === selectedTask?.id;
                    const statusColor = task.status === 'completed' ? '#00B894' :
                      task.status === 'in_progress' ? '#FDCB6E' :
                      task.status === 'delayed' ? '#D63031' :
                      task.status === 'blocked' ? '#D63031' : '#4A5568';

                    return (
                      <div
                        key={task.id}
                        className={`
                          flex items-center gap-2.5 pl-6 pr-3 cursor-pointer border-b border-white/[0.02]
                          transition-all duration-150 animate-fade-up
                          ${isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}
                        `}
                        style={{ 
                          height: ROW_HEIGHT,
                          borderLeft: isSelected ? `2px solid ${colors.primary}` : '2px solid transparent',
                          animationDelay: `${ti * 20}ms`,
                        }}
                        onClick={() => handleTaskClick(task)}
                      >
                        {/* Status indicator */}
                        <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ backgroundColor: statusColor }} />

                        {/* Task name */}
                        <span className="text-[10px] font-medium text-[#E0E0E0] truncate flex-1" style={{ fontFamily: 'var(--font-body)' }}>
                          {task.nameCn}
                        </span>

                        {/* Progress */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-[24px] h-[3px] rounded-full bg-white/[0.08] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${task.progress}%`, backgroundColor: statusColor }} />
                          </div>
                          <span className="text-[8px] w-[24px] text-right text-white/40" style={{ fontFamily: 'var(--font-mono)' }}>
                            {task.progress}%
                          </span>
                        </div>

                        {/* Critical dot */}
                        {task.isCritical && (
                          <div className="w-[4px] h-[4px] rounded-full bg-red-500 shrink-0 animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Gantt Chart ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Timeline Header */}
        <div className="shrink-0 bg-[#1A1A1A] border-b border-white/[0.06] overflow-hidden">
          <div style={{ transform: `translateX(-${scrollLeft}px)` }}>
            {/* Month Row */}
            <div className="flex h-[28px]" style={{ width: totalDays * DAY_WIDTH }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center border-r border-white/[0.03] px-3"
                  style={{ width: m.count * DAY_WIDTH }}
                >
                  <span className="text-[9px] font-bold text-white/40 truncate" style={{ fontFamily: 'var(--font-display)' }}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Week Row */}
            <div className="flex h-[24px]" style={{ width: totalDays * DAY_WIDTH }}>
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center border-r border-white/[0.03]"
                  style={{ width: w.count * DAY_WIDTH }}
                >
                  <span className="text-[8px] font-semibold text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>
                    {w.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Day Row */}
            <div className="flex h-[20px]" style={{ width: totalDays * DAY_WIDTH }}>
              {days.map((d, i) => {
                const sunday = isSunday(d);
                const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-center ${sunday ? 'bg-white/[0.01]' : ''} ${isToday ? 'bg-[#4A90E2]/10' : ''}`}
                    style={{ width: DAY_WIDTH }}
                  >
                    <span className={`text-[7px] ${sunday ? 'text-white/10' : isToday ? 'text-[#4A90E2] font-bold' : 'text-white/15'}`}
                      style={{ fontFamily: 'var(--font-mono)' }}>
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gantt Body */}
        <div
          ref={ganttScrollRef}
          className="flex-1 overflow-auto gantt-scroll"
          onScroll={handleGanttScroll}
        >
          <div className="relative" style={{ width: totalDays * DAY_WIDTH, height: totalHeight }}>
            {/* Grid SVG */}
            <svg className="absolute inset-0 pointer-events-none" width={totalDays * DAY_WIDTH} height={totalHeight}>
              {/* Vertical day lines + Sunday masking */}
              {days.map((d, i) => {
                const x = i * DAY_WIDTH;
                const sunday = isSunday(d);
                return (
                  <g key={`vl-${i}`}>
                    {sunday && (
                      <rect x={x} y={0} width={DAY_WIDTH} height={totalHeight} fill="rgba(255,255,255,0.01)" />
                    )}
                    <line x1={x} y1={0} x2={x} y2={totalHeight} stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
                  </g>
                );
              })}

              {/* Horizontal row guide lines - ultra-light for alignment */}
              {rows.map((row, i) => (
                <g key={`hl-${i}`}>
                  {/* Row separator */}
                  <line x1={0} y1={row.yOffset + ROW_HEIGHT} x2={totalDays * DAY_WIDTH} y2={row.yOffset + ROW_HEIGHT} stroke="rgba(255,255,255,0.02)" strokeWidth={0.5} />
                  {/* Center guide line for alignment */}
                  <line x1={0} y1={row.yOffset + ROW_HEIGHT / 2} x2={totalDays * DAY_WIDTH} y2={row.yOffset + ROW_HEIGHT / 2} stroke="rgba(255,255,255,0.01)" strokeWidth={0.5} strokeDasharray="2,4" />
                </g>
              ))}

              {/* Dependency lines - ONLY WHEN TASK SELECTED */}
              {dependencyLines.map((line, i) => {
                const dx = line.x2 - line.x1;
                const dy = line.y2 - line.y1;
                const cpOffset = Math.min(Math.abs(dx) * 0.3, 30);
                
                // Smooth sine curve
                const path = `M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`;

                return (
                  <g key={`dep-${i}`} className="animate-fade-in">
                    <path
                      d={path}
                      fill="none"
                      stroke={line.isHighlight ? '#4A90E2' : '#D1D5DB'}
                      strokeWidth={1}
                      opacity={line.isHighlight ? 0.6 : 0.3}
                    />
                    <circle cx={line.x2} cy={line.y2} r={2} fill={line.isHighlight ? '#4A90E2' : '#D1D5DB'} opacity={0.5} />
                  </g>
                );
              })}

              {/* Today line */}
              <line x1={todayOffset} y1={0} x2={todayOffset} y2={totalHeight} stroke="#4A90E2" strokeWidth={1} opacity={0.4} />
            </svg>

            {/* Today label */}
            <div className="absolute z-20 -translate-x-1/2" style={{ left: todayOffset, top: 0 }}>
              <div className="px-2 py-[2px] rounded-b-md text-[7px] font-bold text-white bg-[#4A90E2]/80" style={{ fontFamily: 'var(--font-mono)' }}>
                TODAY
              </div>
            </div>

            {/* Lighthouse Milestones - Vertical projection lines */}
            {milestones.map(ms => {
              const msDate = new Date(ms.date);
              const msOffset = daysDiff(startDate, msDate) * DAY_WIDTH;
              return (
                <div key={ms.id} className="absolute z-10" style={{ left: msOffset - 1, top: 0 }}>
                  <svg width={2} height={totalHeight}>
                    <line 
                      x1={1} y1={0} x2={1} y2={totalHeight} 
                      stroke="#DAA520" 
                      strokeWidth={1} 
                      strokeDasharray="4 6"
                      opacity={0.15}
                    />
                  </svg>
                </div>
              );
            })}

            {/* Group headers in gantt area */}
            {groupHeaderPositions.map(gh => {
              const colors = PHASE_COLORS[gh.phase as keyof typeof PHASE_COLORS] || PHASE_COLORS.physical;
              return (
                <div
                  key={gh.id}
                  className="absolute left-0 right-0 flex items-center px-4 pointer-events-none"
                  style={{
                    top: gh.yOffset,
                    height: GROUP_HEADER_HEIGHT,
                    background: `linear-gradient(90deg, ${colors.primary}08 0%, transparent 40%)`,
                  }}
                >
                  <span className="text-[8px] font-bold uppercase tracking-[0.18em] opacity-20" style={{ color: colors.primary, fontFamily: 'var(--font-display)' }}>
                    {gh.label}
                  </span>
                </div>
              );
            })}

            {/* Task Bars */}
            {rows.map((row, i) => (
              <div
                key={row.task.id}
                className="absolute left-0 right-0"
                style={{ top: row.yOffset, height: ROW_HEIGHT }}
              >
                <TaskBar
                  task={row.task}
                  startDate={startDate}
                  dayWidth={DAY_WIDTH}
                  onClick={handleTaskClick}
                  animationDelay={i * 15}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Drawer */}
      <TaskDrawer
        task={selectedTask}
        allTasks={tasks}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekNumber(d: Date): number {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
}

function buildGroups(tasks: GanttTask[]): TaskGroup[] {
  const groups: TaskGroup[] = [];
  const streams: StreamId[] = ['cavity_core', 'cavity_insert', 'lifter', 'slider'];

  streams.forEach(streamId => {
    const streamTasks = tasks.filter(t => t.stream === streamId);
    if (streamTasks.length > 0) {
      const info = STREAM_LABELS[streamId];
      groups.push({
        id: streamId,
        label: info.name,
        labelCn: info.nameCn,
        phase: 'physical',
        icon: <Layers className="w-3 h-3" />,
        tasks: streamTasks,
      });
    }
  });

  const mergeTasks = tasks.filter(t => t.phase === 'physical' && !t.stream);
  if (mergeTasks.length > 0) {
    groups.push({
      id: 'merge',
      label: 'Assembly & QC',
      labelCn: '合模 / QC',
      phase: 'physical',
      icon: <GitMerge className="w-3 h-3" />,
      tasks: mergeTasks,
    });
  }

  const dataTasks = tasks.filter(t => t.phase === 'data');
  if (dataTasks.length > 0) {
    groups.push({
      id: 'data',
      label: 'Data Validation',
      labelCn: '数据验证',
      phase: 'data',
      icon: <Package className="w-3 h-3" />,
      tasks: dataTasks,
    });
  }

  const prodTasks = tasks.filter(t => t.phase === 'production');
  if (prodTasks.length > 0) {
    groups.push({
      id: 'production',
      label: 'Production',
      labelCn: '量产移交',
      phase: 'production',
      icon: <Zap className="w-3 h-3" />,
      tasks: prodTasks,
    });
  }

  return groups;
}
