/**
 * GanttV3Chart — Main Orchestrator
 *
 * Tesla Dashboard × VS Code Fusion
 * - Deep space gray (#121212) background
 * - Left: VS Code file tree sidebar
 * - Right: Industrial Gantt timeline
 * - Milestone vertical projection lines
 * - Dependency curves on selection
 * - Scroll sync between panels
 */

import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import type { GanttData, TaskNode, PhaseType } from '@shared/ganttEngine';
import { PHASE_COLORS } from '@shared/ganttEngine';
import { isSunday } from '@shared/workdays';
import GanttV3Sidebar, {
  getFlatRows,
  calcSidebarHeight,
  getGroupHeaderPositions,
} from './GanttV3Sidebar';
import GanttV3TaskBar from './GanttV3TaskBar';
import GanttV3Drawer from './GanttV3Drawer';
import GanttMergeLines from './GanttMergeLines';
import ProductImageUpload from '@/components/ProductImageUpload';
import MilestoneMarker, {
  dateToPixel,
  MILESTONE_TOP_ROW_HEIGHT as BASE_MILESTONE_TOP_ROW_HEIGHT,
  MILESTONE_BOTTOM_ROW_HEIGHT,
  computeMilestoneLabelRows,
} from './MilestoneMarker';

// ─── Layout Constants（像素级对齐：左右 Header 64px，工序行 48px）────────────────

const ROW_HEIGHT = 48;
const DAY_WIDTH = 34;
const GROUP_HEADER_HEIGHT = 48;
/** 侧边栏宽度 — Header 与 Body 共用 */
const SIDEBAR_WIDTH = 380;
/** 右侧时间轴 Header 与左侧 Sidebar Header 严格 64px */
const TIMELINE_HEADER_HEIGHT = 64;
/** 左侧 Header 高度 = 时间轴高度 */
const LEFT_HEADER_HEIGHT = TIMELINE_HEADER_HEIGHT;
const MILESTONE_BAR_HEIGHT = BASE_MILESTONE_TOP_ROW_HEIGHT;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysDiff(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function getWeekNumber(d: Date): number {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface GanttV3ChartProps {
  data: GanttData;
  projectId?: string;
  productImageUrl?: string;
  onProductImageUpload?: (url: string) => void;
  evidenceCounts?: Record<string, number>;
  isMobile?: boolean;
}

export default function GanttV3Chart({ data, projectId, productImageUrl, onProductImageUpload, evidenceCounts, isMobile }: GanttV3ChartProps) {
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const ganttScrollRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  // ── Derived data ──
  const startDate = useMemo(() => {
    const p = data.dateRange.start.split('-');
    return p.length === 3
      ? new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
      : new Date(data.dateRange.start);
  }, [data.dateRange.start]);
  const endDate = useMemo(() => {
    const p = data.dateRange.end.split('-');
    return p.length === 3
      ? new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
      : new Date(data.dateRange.end);
  }, [data.dateRange.end]);
  const totalDays = Math.ceil(daysDiff(startDate, endDate));

  // ── 里程碑标签碰撞检测 — 计算每个标签的行号 ──
  const milestoneLabelRows = useMemo(() => {
    return computeMilestoneLabelRows(
      data.milestones,
      startDate,
      totalDays,
      totalDays * DAY_WIDTH,
    );
  }, [data.milestones, startDate, totalDays]);

  // 动态里程碑顶部区域高度：根据最大行数扩展
  const maxLabelRow = useMemo(() => {
    let max = 0;
    milestoneLabelRows.forEach(r => { if (r > max) max = r; });
    return max;
  }, [milestoneLabelRows]);

  const MILESTONE_TOP_ROW_HEIGHT = BASE_MILESTONE_TOP_ROW_HEIGHT + maxLabelRow * 28;

  const handleTaskClick = useCallback((task: TaskNode) => {
    setSelectedTask(task);
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // ── Scroll sync ──
  const syncingRef = useRef(false);

  const handleGanttScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (ganttScrollRef.current && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = ganttScrollRef.current.scrollTop;
      setScrollLeft(ganttScrollRef.current.scrollLeft);
    }
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  const handleLeftScroll = useCallback(() => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (ganttScrollRef.current && leftPanelRef.current) {
      ganttScrollRef.current.scrollTop = leftPanelRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  // ── Auto-scroll to current progress ──
  useEffect(() => {
    if (ganttScrollRef.current) {
      const inProgressTasks = data.tasks.filter((t) => t.status === 'InProgress');
      if (inProgressTasks.length > 0) {
        const latestStart = inProgressTasks.reduce(
          (latest, t) => (t.baselineStart > latest ? t.baselineStart : latest),
          '2000-01-01',
        );
        const focusDate = new Date(latestStart);
        const focusOffset = daysDiff(startDate, focusDate) * DAY_WIDTH;
        ganttScrollRef.current.scrollLeft = Math.max(0, focusOffset - 300);
      }
    }
  }, [startDate, data.tasks]);

  // ── Computed rows ──
  const rows = useMemo(
    () => getFlatRows(data.tracks, data.postMergeTasks, collapsedGroups, ROW_HEIGHT, GROUP_HEADER_HEIGHT),
    [data.tracks, data.postMergeTasks, collapsedGroups],
  );

  const totalHeight = useMemo(
    () => calcSidebarHeight(data.tracks, data.postMergeTasks, collapsedGroups, ROW_HEIGHT, GROUP_HEADER_HEIGHT),
    [data.tracks, data.postMergeTasks, collapsedGroups],
  );

  const groupPositions = useMemo(
    () => getGroupHeaderPositions(data.tracks, data.postMergeTasks, collapsedGroups, ROW_HEIGHT, GROUP_HEADER_HEIGHT),
    [data.tracks, data.postMergeTasks, collapsedGroups],
  );

  // ── Today line ──
  const today = new Date();
  const todayOffset = Math.max(0, daysDiff(startDate, today)) * DAY_WIDTH;

  // ── Dependency lines (only when task selected) ──
  const dependencyLines = useMemo(() => {
    if (!selectedTask) return [];

    const lines: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isHighlight: boolean;
      isMerge: boolean;
    }[] = [];

    const relatedIds = new Set([
      selectedTask.id,
      ...data.dependencies.filter((d) => d.taskId === selectedTask.id).map((d) => d.predecessorId),
      ...data.dependencies.filter((d) => d.predecessorId === selectedTask.id).map((d) => d.taskId),
    ]);

    for (const row of rows) {
      if (!relatedIds.has(row.task.id)) continue;

      const rowDeps = data.dependencies.filter((d) => d.taskId === row.task.id);
      for (const dep of rowDeps) {
        const depRow = rows.find((r) => r.task.id === dep.predecessorId);
        if (!depRow) continue;

        const depEnd = new Date(depRow.task.baselineEnd);
        const taskStart = new Date(row.task.baselineStart);

        // x1: right edge of predecessor bar (inclusive end → +1 day offset)
        const x1 = (daysDiff(startDate, depEnd) + 1) * DAY_WIDTH;
        const y1 = depRow.yOffset + ROW_HEIGHT / 2;
        // x2: left edge of successor bar
        const x2 = daysDiff(startDate, taskStart) * DAY_WIDTH;
        const y2 = row.yOffset + ROW_HEIGHT / 2;

        lines.push({
          x1,
          y1,
          x2,
          y2,
          isHighlight: row.task.id === selectedTask.id || depRow.task.id === selectedTask.id,
          isMerge: row.task.isMergePoint,
        });
      }
    }

    return lines;
  }, [rows, startDate, selectedTask, data.dependencies]);

  // ── Timeline data ──
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

  return (
    <div className="flex flex-1 overflow-hidden bg-[#0A0A0A] min-w-0">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LEFT PANEL — VS Code File Tree */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div
        className={`shrink-0 flex flex-col border-r border-white/[0.06] bg-[#0D0D0D] z-20 ${isMobile ? 'hidden' : ''}`}
        style={{ width: SIDEBAR_WIDTH }}
      >
        {/* 左侧 Header：与右侧时间轴同高 64px，pl-6 与 LA26006 像素级对齐 */}
        <div
          className="shrink-0 box-border flex items-center justify-between pl-6 pr-3 border-b border-white/[0.06] bg-[#0A0A0A] overflow-hidden"
          style={{ height: LEFT_HEADER_HEIGHT }}
        >

          <span className="t-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, background: 'linear-gradient(135deg, #e2e8f0, #94a3b8, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 4px rgba(148,163,184,0.15))' }}>
            {data.tasks.length} tasks · 4 phases · {data.tracks.length} tracks
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

        {/* Sidebar Content — 顶部里程碑行与右侧对齐，实现 1:1 滚动同步 */}
        <div
          ref={leftPanelRef}
          className="flex-1 overflow-y-auto overflow-x-hidden gantt-scroll box-border"
          onScroll={handleLeftScroll}
        >
          <div style={{ height: MILESTONE_TOP_ROW_HEIGHT + totalHeight + MILESTONE_BOTTOM_ROW_HEIGHT }}>
            <div
              className="meta-row sticky top-0 z-30 w-full box-border border-b border-white/[0.04] bg-[#0A0A0A]"
              style={{ height: MILESTONE_TOP_ROW_HEIGHT }}
            >
              <span className="meta-item meta-milestone"><span className="meta-diamond">◆</span>里程碑 ×{data.milestones.length}</span>
              <span className="meta-sep" />
              {data.projectInfo.fitter_group ? (
                <span className="meta-capsule">
                  {/* Bracket corners — L-shaped accents */}
                  <span className="meta-capsule-bracket meta-capsule-bracket--tl" />
                  <span className="meta-capsule-bracket meta-capsule-bracket--br" />
                  {/* Scanline overlay */}
                  <span className="meta-capsule-scanlines" />
                  {/* Content */}
                  <span className="meta-capsule-label">钳工组</span>
                  <span className="meta-capsule-sep" />
                  <span className="meta-capsule-value">{data.projectInfo.fitter_group}</span>
                  {/* Heartbeat dot */}
                  <span className="meta-capsule-heartbeat" />
                </span>
              ) : null}
              <span className="meta-item meta-index">
                {data.projectInfo.index_no ? `No.${data.projectInfo.index_no}` : ''}
              </span>
            </div>
            <div style={{ height: totalHeight }}>
            <GanttV3Sidebar
              tracks={data.tracks}
              postMergeTasks={data.postMergeTasks}
              selectedTaskId={selectedTask?.id || null}
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* RIGHT PANEL — Gantt Timeline */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Timeline Header — 高度与左侧 Header 首段一致，box-border 防止边框导致错位 */}
        <div
          className="shrink-0 box-border bg-[#0A0A0A] border-b border-white/[0.06] overflow-hidden"
          style={{ height: TIMELINE_HEADER_HEIGHT }}
        >
          <div style={{ transform: `translateX(-${scrollLeft}px)` }} className="box-border">
            {/* Month Row (22) + Week (22) + Day (20) = 64px */}
            <div className="flex box-border" style={{ height: 22, width: totalDays * DAY_WIDTH }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center border-r border-white/[0.06] px-3"
                  style={{ width: m.count * DAY_WIDTH }}
                >
                  <span
                    className="text-sm font-semibold text-slate-100 truncate"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {m.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Week Row */}
            <div className="flex box-border" style={{ height: 22, width: totalDays * DAY_WIDTH }}>
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center border-r border-white/[0.06]"
                  style={{ width: w.count * DAY_WIDTH }}
                >
                  <span
                    className="text-[12px] font-semibold text-slate-300"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {w.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Day Row */}
            <div className="flex box-border" style={{ height: 20, width: totalDays * DAY_WIDTH }}>
              {days.map((d, i) => {
                const sun = isSunday(d);
                const isToday =
                  d.getFullYear() === today.getFullYear() &&
                  d.getMonth() === today.getMonth() &&
                  d.getDate() === today.getDate();
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-center ${sun ? 'bg-white/[0.02]' : ''} ${isToday ? 'bg-[#4A90E2]/12' : ''}`}
                    style={{ width: DAY_WIDTH }}
                  >
                    <span
                      className={`text-[11px] font-semibold ${
                        sun
                          ? 'text-white/20'
                          : isToday
                            ? 'text-[#4A90E2] font-bold'
                            : 'text-slate-400'
                      }`}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gantt Body + Milestone 同一 Overflow 容器，横向滚动同步 */}
        <div
          ref={ganttScrollRef}
          className="flex-1 overflow-auto gantt-scroll"
          onScroll={handleGanttScroll}
        >
          <div
            className="relative"
            style={{
              width: totalDays * DAY_WIDTH,
              height: MILESTONE_TOP_ROW_HEIGHT + totalHeight + MILESTONE_BOTTOM_ROW_HEIGHT,
            }}
          >
            {/* 1. Sticky Header Track: 仅渲染 Top Diamond，背景不透明，吸顶 z-30 */}
            <div
              className="sticky top-0 z-30 bg-[#0A0A0A] border-b border-white/[0.06]"
              style={{ width: '100%', height: MILESTONE_TOP_ROW_HEIGHT }}
            >
              {data.milestones.map((ms) => (
                <MilestoneMarker
                  key={`header-${ms.id}`}
                milestone={ms}
                leftPx={dateToPixel(new Date(ms.date), startDate, totalDays, totalDays * DAY_WIDTH)}
                gridHeight={0}
                showTopDiamond={true}
                showLine={false}
                showBottomDiamond={false}
                labelRow={milestoneLabelRows.get(ms.id) || 0}
              />
            ))}
          </div>

          {/* 2. Scrollable Body Lines: 仅渲染 Line + Bottom Diamond，随内容滚动 */}
          {data.milestones.map((ms) => (
            <MilestoneMarker
              key={`body-${ms.id}`}
              milestone={ms}
                leftPx={dateToPixel(new Date(ms.date), startDate, totalDays, totalDays * DAY_WIDTH)}
                gridHeight={totalHeight}
                showTopDiamond={false}
                showLine={true}
                showBottomDiamond={true}
              />
            ))}

            {/* 甘特网格与任务行 — 从里程碑行下方开始，覆盖所有任务行 */}
            <div
              className="absolute left-0 right-0"
              style={{ top: MILESTONE_TOP_ROW_HEIGHT, width: totalDays * DAY_WIDTH, height: totalHeight }}
            >
              {/* ── Grid SVG ── */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={totalDays * DAY_WIDTH}
                height={totalHeight}
              >
                {/* Vertical grid + Sunday mask */}
                {days.map((d, i) => {
                  const x = i * DAY_WIDTH;
                  const sun = isSunday(d);
                  return (
                    <g key={`vl-${i}`}>
                      {sun && (
                        <rect
                          x={x}
                          y={0}
                          width={DAY_WIDTH}
                          height={totalHeight}
                          fill="rgba(255,255,255,0.008)"
                        />
                      )}
                      <line
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={totalHeight}
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth={0.5}
                      />
                    </g>
                  );
                })}

                {/* Zebra-stripe row backgrounds */}
                {rows.map((row, i) => (
                  <rect
                    key={`zb-${i}`}
                    x={0}
                    y={row.yOffset}
                    width={totalDays * DAY_WIDTH}
                    height={ROW_HEIGHT}
                    fill={i % 2 === 1 ? 'rgba(255,255,255,0.018)' : 'transparent'}
                  />
                ))}

                {/* Horizontal row guides */}
                {rows.map((row, i) => (
                  <line
                    key={`hl-${i}`}
                    x1={0}
                    y1={row.yOffset + ROW_HEIGHT}
                    x2={totalDays * DAY_WIDTH}
                    y2={row.yOffset + ROW_HEIGHT}
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth={0.5}
                  />
                ))}

                {/* Dependency curves (only when selected) */}
                {dependencyLines.map((line, i) => {
                  const cpOffset = Math.min(Math.abs(line.x2 - line.x1) * 0.3, 35);
                  const path = `M ${line.x1} ${line.y1} C ${line.x1 + cpOffset} ${line.y1}, ${line.x2 - cpOffset} ${line.y2}, ${line.x2} ${line.y2}`;

                  return (
                    <g key={`dep-${i}`} className="animate-fade-in">
                      <path
                        d={path}
                        fill="none"
                        stroke={line.isHighlight ? '#4A90E2' : line.isMerge ? '#DAA520' : '#555'}
                        strokeWidth={line.isHighlight ? 1.5 : 1}
                        opacity={line.isHighlight ? 0.5 : 0.2}
                        strokeDasharray={line.isMerge ? '4 3' : 'none'}
                      />
                      <circle
                        cx={line.x2}
                        cy={line.y2}
                        r={2}
                        fill={line.isHighlight ? '#4A90E2' : '#555'}
                        opacity={0.4}
                      />
                    </g>
                  );
                })}

                {/* Today line */}
                <line
                  x1={todayOffset}
                  y1={0}
                  x2={todayOffset}
                  y2={totalHeight}
                  stroke="#4A90E2"
                  strokeWidth={1}
                  opacity={0.35}
                />
              </svg>

              {/* 3. Merge Lines: Logic Convergence Visualization (Inside Grid Container for correct Y coords) */}
              <GanttMergeLines
                rows={rows}
                startDate={startDate}
                dayWidth={DAY_WIDTH}
                rowHeight={ROW_HEIGHT}
              />

            {/* Today label */}
            <div
              className="absolute z-20 -translate-x-1/2"
              style={{ left: todayOffset, top: 0 }}
            >
              <div
                className="px-2 py-[2px] rounded-b-md text-[9px] font-bold text-white bg-[#4A90E2]/70"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                TODAY
              </div>
            </div>

            {/* Group header overlays in gantt area */}
            {groupPositions.map((gh) => {
              const colors = PHASE_COLORS[gh.phase as PhaseType] || PHASE_COLORS.physical;
              const isL2 = gh.type === 'l2';
              const isL3 = gh.type === 'l3';
              const pl = isL2 ? 16 : isL3 ? 28 : 40;
              const bgGrad = isL2
                ? `linear-gradient(90deg, ${colors.primary}08 0%, transparent 40%)`
                : isL3
                  ? `linear-gradient(90deg, ${colors.primary}04 0%, transparent 30%)`
                  : 'transparent';
              return (
                <div
                  key={gh.id}
                  className="absolute left-0 right-0 box-border flex items-center pointer-events-none"
                  style={{
                    top: gh.yOffset,
                    height: GROUP_HEADER_HEIGHT,
                    paddingLeft: pl,
                    background: bgGrad,
                  }}
                >
                  <span
                    className="font-bold uppercase tracking-[0.2em]"
                    style={{
                      color: colors.primary,
                      fontFamily: 'var(--font-display)',
                      fontSize: isL2 ? '11px' : '9px',
                      opacity: isL2 ? 0.20 : 0.12,
                    }}
                  >
                    {gh.label}
                  </span>
                </div>
              );
            })}

            {/* Task Bars — 行高与侧边栏 ROW_HEIGHT 严格一致，box-border 防边框累加 */}
            {rows.map((row, i) => {
              const isHovered = hoveredTaskId === row.task.id;
              return (
                <div
                  key={row.task.id}
                  className="absolute left-0 right-0 box-border transition-all duration-150"
                  style={{
                    top: row.yOffset,
                    height: ROW_HEIGHT,
                    background: isHovered ? 'rgba(34, 211, 238, 0.04)' : 'transparent',
                    borderTop: isHovered ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
                    borderBottom: isHovered ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
                  }}
                  onMouseEnter={() => setHoveredTaskId(row.task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                >
                  <GanttV3TaskBar
                    task={row.task}
                    startDate={startDate}
                    dayWidth={DAY_WIDTH}
                    rowHeight={ROW_HEIGHT}
                    onClick={handleTaskClick}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DRAWER — Evidence Preview */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <GanttV3Drawer
        task={selectedTask}
        allTasks={data.tasks}
        dependencies={data.dependencies}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
