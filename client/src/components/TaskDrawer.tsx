/**
 * TaskDrawer - Frosted glass side drawer
 * Tesla Mission Control style: backdrop-blur, evidence preview, FAI links, dependency analysis
 */

import type { ReactNode } from 'react';

import { type GanttTask, PHASE_COLORS, formatDateFull } from '@/lib/data';
import {
  getGanttTaskStatusLabel,
  getGanttTaskStatusTone,
  normalizeGanttTaskStatus,
  type NormalizedGanttTaskStatus,
} from '@/lib/ganttTaskStatus';
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
} from 'lucide-react';

interface TaskDrawerProps {
  task: GanttTask | null;
  allTasks: GanttTask[];
  onClose: () => void;
}

const STATUS_ICONS: Record<NormalizedGanttTaskStatus, ReactNode> = {
  completed: <CheckCircle2 className="w-3.5 h-3.5" />,
  in_progress: <Clock className="w-3.5 h-3.5" />,
  delayed: <AlertTriangle className="w-3.5 h-3.5" />,
  blocked: <AlertTriangle className="w-3.5 h-3.5" />,
  not_started: <Calendar className="w-3.5 h-3.5" />,
};

export default function TaskDrawer({ task, allTasks, onClose }: TaskDrawerProps) {
  if (!task) return null;

  const colors = PHASE_COLORS[task.phase];
  const deps = task.dependencies
    .map((depId) => allTasks.find((candidate) => candidate.id === depId))
    .filter(Boolean) as GanttTask[];
  const normalizedStatus = normalizeGanttTaskStatus(task.status);
  const statusTone = getGanttTaskStatusTone(normalizedStatus);
  const sc = {
    ...statusTone,
    label: getGanttTaskStatusLabel(normalizedStatus),
    icon: STATUS_ICONS[normalizedStatus],
  };

  const getDelayDays = (candidate: GanttTask): number => {
    if (!candidate.actualEnd) return 0;
    const planned = new Date(candidate.plannedEnd);
    const actual = new Date(candidate.actualEnd);
    return Math.max(
      0,
      Math.ceil((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24)),
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-50 transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 bottom-0 w-[400px] z-50 animate-slide-in-right">
        <div
          className="h-full flex flex-col"
          style={{
            background: 'rgba(26,26,26,0.92)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="shrink-0 px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.primary }} />
                  <h2
                    className="text-[15px] font-extrabold text-white/90"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {task.nameCn}
                  </h2>
                </div>
                <p className="text-[11px] text-white/40 ml-5" style={{ fontFamily: 'var(--font-mono)' }}>
                  {task.name} / {task.id}
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

          <div className="flex-1 overflow-y-auto gantt-scroll px-5 py-4 space-y-5">
            <div className="flex items-center gap-3">
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}
              >
                {sc.icon}
                <span className="text-[11px] font-bold">{sc.label}</span>
              </div>
              <div className="flex-1" />
              <span
                className="text-[20px] font-extrabold"
                style={{ fontFamily: 'var(--font-mono)', color: colors.primary }}
              >
                {task.progress}
                <span className="text-[11px] font-medium text-white/30">%</span>
              </span>
            </div>

            <div className="h-[6px] rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${task.progress}%`,
                  background: `linear-gradient(90deg, ${colors.primary}, ${colors.primary}BB)`,
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <TimeCard label="计划开始" value={formatDateFull(task.plannedStart)} variant="default" />
              <TimeCard label="计划结束" value={formatDateFull(task.plannedEnd)} variant="default" />
              {task.actualStart && (
                <TimeCard label="实际开始" value={formatDateFull(task.actualStart)} variant="highlight" />
              )}
              {task.actualEnd ? (
                <TimeCard label="实际结束" value={formatDateFull(task.actualEnd)} variant="highlight" />
              ) : task.actualStart ? (
                <TimeCard
                  label="实际结束"
                  value={`${getGanttTaskStatusLabel('in_progress')}...`}
                  variant="active"
                />
              ) : null}
            </div>

            {task.isCritical && (
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(214,48,49,0.04)', border: '1px solid rgba(214,48,49,0.08)' }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(214,48,49,0.08)' }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-red-600">关键路径任务</p>
                  <p className="text-[9px] text-red-400 mt-0.5">延期将直接影响项目整体交付时间</p>
                </div>
              </div>
            )}

            {task.isMergePoint && (
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(74,144,226,0.04)', border: '1px solid rgba(74,144,226,0.08)' }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(74,144,226,0.08)' }}
                >
                  <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-blue-600">汇聚节点</p>
                  <p className="text-[9px] text-blue-400 mt-0.5">4 条支流在此汇合，需全部完成后才能继续</p>
                </div>
              </div>
            )}

            <div className="h-px bg-white/[0.06]" />

            <div>
              <SectionTitle icon={<Image className="w-3.5 h-3.5" />} title="证据文档" />
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                {[1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="aspect-square rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08] flex flex-col items-center justify-center gap-1 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all cursor-pointer group"
                  >
                    <Upload className="w-4 h-4 text-white/15 group-hover:text-white/30 transition-colors" />
                    <span className="text-[8px] text-white/20 group-hover:text-white/35">上传</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle icon={<Link2 className="w-3.5 h-3.5" />} title="FAI 测量链接" />
              <div className="mt-2.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2.5 hover:bg-blue-500/10 hover:border-blue-400/20 transition-all cursor-pointer group">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 group-hover:bg-blue-100 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-white/70 group-hover:text-blue-400 transition-colors">
                    FAI 报告
                  </p>
                  <p className="text-[9px] text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>
                    {task.id}_fai_report.pdf
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-white/15 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>

            {deps.length > 0 && (
              <div>
                <SectionTitle icon={<GitBranch className="w-3.5 h-3.5" />} title="前置依赖 / 延期贡献度" />
                <div className="mt-2.5 space-y-1.5">
                  {deps.map((dependency) => {
                    const delay = getDelayDays(dependency);
                    const dependencyColors = PHASE_COLORS[dependency.phase];
                    return (
                      <div
                        key={dependency.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors"
                      >
                        <div
                          className="w-[5px] h-[5px] rounded-full shrink-0"
                          style={{ backgroundColor: dependencyColors.primary }}
                        />
                        <span className="text-[11px] font-medium text-white/60 flex-1 truncate">
                          {dependency.nameCn}
                        </span>
                        {delay > 0 ? (
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              backgroundColor: 'rgba(214,48,49,0.06)',
                              color: '#D63031',
                              border: '1px solid rgba(214,48,49,0.1)',
                            }}
                          >
                            +{delay}d
                          </span>
                        ) : (
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              backgroundColor: 'rgba(0,184,148,0.06)',
                              color: '#00B894',
                              border: '1px solid rgba(0,184,148,0.1)',
                            }}
                          >
                            On Time
                          </span>
                        )}
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
      <span className="text-white/20">{icon}</span>
      <span
        className="text-[11px] font-bold text-white/40 uppercase tracking-[0.06em]"
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
}: {
  label: string;
  value: string;
  variant: 'default' | 'highlight' | 'active';
}) {
  const styles = {
    default: { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.06)', dot: '#B2BEC3' },
    highlight: { bg: 'rgba(74,144,226,0.08)', border: 'rgba(74,144,226,0.15)', dot: '#4A90E2' },
    active: { bg: 'rgba(253,203,110,0.1)', border: 'rgba(253,203,110,0.2)', dot: '#FDCB6E' },
  };
  const style = styles[variant];

  return (
    <div className="px-3 py-2.5 rounded-xl" style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: style.dot }} />
        <span className="text-[9px] text-white/30 uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
          {label}
        </span>
      </div>
      <span className="text-[12px] font-bold text-white/70" style={{ fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );
}
