/**
 * GanttV3Drawer — Frosted Glass Evidence Preview Panel
 *
 * Tesla Mission Control style:
 * - Backdrop-blur frosted glass
 * - Evidence document preview (photos, reports)
 * - Dependency analysis with delay contribution
 * - Status & progress visualization
 */

import type { ReactNode } from 'react';
import type { TaskNode, DependencyEdge, PhaseType } from '@shared/ganttEngine';
import { PHASE_COLORS } from '@shared/ganttEngine';
import { formatDateCn, formatDateOrEmpty, calcDelayIntensity } from '@shared/workdays';
import {
  getGanttTaskStatusLabel,
  getGanttTaskStatusTone,
  isGanttTaskDone,
  normalizeGanttTaskStatus,
  type NormalizedGanttTaskStatus,
} from '@/lib/ganttTaskStatus';
import EvidenceUpload from './EvidenceUpload';
import {
  X,
  Calendar,
  Clock,
  Link2,
  Image,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  GitBranch,
  Upload,
  ExternalLink,
  Shield,
} from 'lucide-react';

interface DrawerProps {
  task: TaskNode | null;
  allTasks: TaskNode[];
  dependencies: DependencyEdge[];
  onClose: () => void;
}

const STATUS_ICONS: Record<NormalizedGanttTaskStatus, ReactNode> = {
  completed: <CheckCircle2 className="w-3.5 h-3.5" />,
  in_progress: <Clock className="w-3.5 h-3.5" />,
  delayed: <AlertTriangle className="w-3.5 h-3.5" />,
  blocked: <AlertTriangle className="w-3.5 h-3.5" />,
  not_started: <Calendar className="w-3.5 h-3.5" />,
};

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string; border: string }
> = {
  Done: {
    label: '已完成',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    color: '#00B894',
    bg: 'rgba(0,184,148,0.08)',
    border: 'rgba(0,184,148,0.15)',
  },
  InProgress: {
    label: '进行中',
    icon: <Clock className="w-3.5 h-3.5" />,
    color: '#FDCB6E',
    bg: 'rgba(253,203,110,0.1)',
    border: 'rgba(253,203,110,0.2)',
  },
  Blocked: {
    label: '阻塞',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: '#D63031',
    bg: 'rgba(214,48,49,0.06)',
    border: 'rgba(214,48,49,0.12)',
  },
  NotStart: {
    label: '未开始',
    icon: <Calendar className="w-3.5 h-3.5" />,
    color: '#B2BEC3',
    bg: 'rgba(178,190,195,0.08)',
    border: 'rgba(178,190,195,0.15)',
  },
};

export default function GanttV3Drawer({ task, allTasks, dependencies, onClose }: DrawerProps) {
  if (!task) return null;

  const colors = PHASE_COLORS[task.phase as PhaseType] || PHASE_COLORS.physical;
  const normalizedStatus = normalizeGanttTaskStatus(task.status);
  const statusTone = getGanttTaskStatusTone(normalizedStatus);
  const sc = {
    ...statusTone,
    label: getGanttTaskStatusLabel(normalizedStatus),
    icon: STATUS_ICONS[normalizedStatus],
  };

  // Find predecessor tasks
  const predecessorDeps = dependencies.filter((d) => d.taskId === task.id);
  const predecessors = predecessorDeps
    .map((dep) => {
      const predTask = allTasks.find((t) => t.id === dep.predecessorId);
      return predTask ? { task: predTask, lagHours: dep.lagHours, lagType: dep.lagType } : null;
    })
    .filter(Boolean) as { task: TaskNode; lagHours: number; lagType: string }[];

  // Find successor tasks
  const successorDeps = dependencies.filter((d) => d.predecessorId === task.id);
  const successors = successorDeps
    .map((dep) => allTasks.find((t) => t.id === dep.taskId))
    .filter(Boolean) as TaskNode[];

  const isOverdue = !isGanttTaskDone(task.status) && new Date(task.baselineEnd) < new Date() && task.progress < 100;

  const getDelayDays = (t: TaskNode): number => {
    if (!t.actualEnd) return 0;
    const planned = new Date(t.baselineEnd);
    const actual = new Date(t.actualEnd);
    return Math.max(0, Math.ceil((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24)));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[4px] z-50 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[420px] z-50 animate-slide-in-right">
        <div
          className="h-full flex flex-col"
          style={{
            background: 'rgba(18,18,18,0.94)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* ── Header ── */}
          <div className="shrink-0 px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ background: colors.gradient }} />
                  <h2
                    className="text-[16px] font-extrabold text-white/90"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {task.nameCn}
                  </h2>
                </div>
                <p className="text-[12px] text-white/35 ml-[22px]" style={{ fontFamily: 'var(--font-mono)' }}>
                  {task.wbsId ? `#${task.wbsId}` : `#${task.stageOrder}`}{' · '}{task.name} · {task.id}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.08] transition-colors text-white/40"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto gantt-scroll px-5 py-4 space-y-5">
            {/* Status + Progress */}
            <div className="flex items-center gap-3">
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}
              >
                {sc.icon}
                <span className="text-[12px] font-bold">{sc.label}</span>
              </div>
              <div className="flex-1" />
              {(() => {
                const di = calcDelayIntensity(task.baselineStart, task.baselineEnd, task.actualEnd);
                if (!di) {
                  return (
                    <span
                      className="text-[22px] font-extrabold text-white/20"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      —
                    </span>
                  );
                }
                return (
                  <div className="flex items-center gap-1.5">
                    {di.isWarning && <span className="text-[14px] animate-pulse">⚠</span>}
                    <span
                      className="text-[22px] font-extrabold"
                      style={{ fontFamily: 'var(--font-mono)', color: di.color }}
                    >
                      {di.value}
                      <span className="text-[11px] font-medium" style={{ color: `${di.color}80` }}>%</span>
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Delay Intensity Bar */}
            {(() => {
              const di = calcDelayIntensity(task.baselineStart, task.baselineEnd, task.actualEnd);
              const fillPct = di ? Math.min(di.value, 200) : task.progress;
              const fillColor = di ? di.color : colors.gradient;
              return (
                <div className="h-[6px] rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min(fillPct, 100)}%`,
                      background: fillColor,
                      boxShadow: di && di.value > 130 ? `0 0 6px ${di.color}40` : undefined,
                    }}
                  />
                </div>
              );
            })()}

            {/* Time Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <TimeCard label="计划开始" value={formatDateOrEmpty(task.baselineStart)} variant="default" />
              <TimeCard label="计划结束" value={formatDateOrEmpty(task.baselineEnd)} variant="default" />
              <TimeCard label="实际开始" value={formatDateOrEmpty(task.actualStart)} variant="highlight" color={colors.primary} />
              {task.actualEnd ? (
                <TimeCard label="实际结束" value={formatDateOrEmpty(task.actualEnd)} variant="highlight" color={colors.primary} />
              ) : task.actualStart ? (
                <TimeCard label="实际结束" value="进行中..." variant="active" />
              ) : (
                <TimeCard label="实际结束" value={formatDateOrEmpty(undefined)} variant="default" />
              )}
            </div>

            {/* Overdue Alert */}
            {isOverdue && (
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl animate-breathe"
                style={{ background: 'rgba(214,48,49,0.06)', border: '1px solid rgba(214,48,49,0.12)' }}
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-red-500/10">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-red-400">任务已逾期</p>
                  <p className="text-[11px] text-red-400/60 mt-0.5">
                    计划结束 {formatDateOrEmpty(task.baselineEnd)}，已超期 {task.baselineEnd ? Math.ceil((new Date().getTime() - new Date(task.baselineEnd).getTime()) / (1000 * 60 * 60 * 24)) : 0} 天
                  </p>
                </div>
              </div>
            )}

            {/* Critical Path Alert */}
            {task.isCritical && !isOverdue && (
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(214,48,49,0.04)', border: '1px solid rgba(214,48,49,0.08)' }}
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-red-500/8">
                  <Shield className="w-3.5 h-3.5 text-red-500/80" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-red-500/80">关键路径任务</p>
                  <p className="text-[11px] text-red-400/50 mt-0.5">延期将直接影响项目整体交付时间</p>
                </div>
              </div>
            )}

            {/* Merge Point */}
            {task.isMergePoint && (
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(74,144,226,0.04)', border: '1px solid rgba(74,144,226,0.08)' }}
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-blue-500/10">
                  <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-blue-500/80">4合1 汇聚节点</p>
                  <p className="text-[11px] text-blue-400/50 mt-0.5">前模仁 / 后模仁 / 镶件 / 滑块 在此汇合</p>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-white/[0.04]" />

            {/* Evidence Documents */}
            <div>
              <SectionTitle icon={<Image className="w-3.5 h-3.5" />} title="证据文档" />
              {task.dbId ? (
                <EvidenceUpload taskId={task.dbId} />
              ) : (
                <p className="text-[11px] text-white/25 mt-2">暂无数据库记录，无法上传证据</p>
              )}
            </div>

            {/* FAI Link */}
            <div>
              <SectionTitle icon={<Link2 className="w-3.5 h-3.5" />} title="FAI 测量链接" />
              <div className="mt-2.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-2.5 hover:bg-blue-500/5 hover:border-blue-400/15 transition-all cursor-pointer group">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/8">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500/60" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-white/60 group-hover:text-blue-400 transition-colors">
                    FAI 报告
                  </p>
                  <p className="text-[11px] text-white/25" style={{ fontFamily: 'var(--font-mono)' }}>
                    {task.id}_fai_report.pdf
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/10 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>

            {/* Predecessor Dependencies */}
            {predecessors.length > 0 && (
              <div>
                <SectionTitle icon={<GitBranch className="w-3.5 h-3.5" />} title="前置依赖" />
                <div className="mt-2.5 space-y-1.5">
                  {predecessors.map((pred) => {
                    const delay = getDelayDays(pred.task);
                    const predColors = PHASE_COLORS[pred.task.phase as PhaseType];
                    return (
                      <div
                        key={pred.task.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                      >
                        <div
                          className="w-[5px] h-[5px] rounded-full shrink-0"
                          style={{ backgroundColor: predColors.primary }}
                        />
                        <span className="text-[12px] font-medium text-white/50 flex-1 truncate">
                          {pred.task.nameCn}
                        </span>
                        {pred.lagHours > 0 && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/15"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            +{pred.lagHours}h 延后
                          </span>
                        )}
                        {delay > 0 ? (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-500/8 text-red-400 border border-red-500/10"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            +{delay}d
                          </span>
                        ) : (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/8 text-emerald-400 border border-emerald-500/10"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            按时
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Successor Tasks */}
            {successors.length > 0 && (
              <div>
                <SectionTitle icon={<ArrowRight className="w-3.5 h-3.5" />} title="后续任务" />
                <div className="mt-2.5 space-y-1.5">
                  {successors.map((succ) => {
                    const succColors = PHASE_COLORS[succ.phase as PhaseType];
                    return (
                      <div
                        key={succ.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                      >
                        <div
                          className="w-[5px] h-[5px] rounded-full shrink-0"
                          style={{ backgroundColor: succColors.primary }}
                        />
                        <span className="text-[12px] font-medium text-white/50 flex-1 truncate">
                          {succ.nameCn}
                        </span>
                        <span className="text-[10px] text-white/20" style={{ fontFamily: 'var(--font-mono)' }}>
                          {getGanttTaskStatusLabel(succ.status)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/15">{icon}</span>
      <span
        className="text-[12px] font-bold text-white/30 uppercase tracking-[0.06em]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </span>
    </div>
  );
}

function TimeCard({
  label,
  value,
  variant,
  color,
}: {
  label: string;
  value: string;
  variant: 'default' | 'highlight' | 'active';
  color?: string;
}) {
  const styles = {
    default: {
      bg: 'rgba(255,255,255,0.02)',
      border: 'rgba(255,255,255,0.05)',
      dot: '#B2BEC3',
    },
    highlight: {
      bg: color ? `${color}08` : 'rgba(74,144,226,0.06)',
      border: color ? `${color}15` : 'rgba(74,144,226,0.12)',
      dot: color || '#4A90E2',
    },
    active: {
      bg: 'rgba(253,203,110,0.08)',
      border: 'rgba(253,203,110,0.15)',
      dot: '#FDCB6E',
    },
  };
  const s = styles[variant];

  return (
    <div className="px-3 py-2.5 rounded-xl" style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: s.dot }} />
        <span className="text-[11px] text-white/25 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
          {label}
        </span>
      </div>
      <span className="text-[13px] font-bold text-white/60" style={{ fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );
}
