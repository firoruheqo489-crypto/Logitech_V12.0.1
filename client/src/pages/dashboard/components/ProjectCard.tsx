/**
 * ProjectCard - V0 shell merged onto live dashboard logic.
 */

import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ProjectData } from '../types/project';
import {
  formatDate,
  getDisplayValue,
  parseFAIValue,
  getCardVisualState,
  getRiskColor,
} from '../lib/projectUtils';
import {
  getProjectQualifiedFlagLabel,
  normalizeProjectQualifiedFlag,
  getProjectRiskLevelLabel,
  getProjectStatusLabel,
} from '@/lib/dashboardProjectState';
import {
  Building2,
  Boxes,
  ChartGantt,
  Factory,
  FlaskConical,
  Gauge,
  Hash,
  Layers,
  MapPin,
  PenTool,
  RotateCcw,
  Ruler,
  Save,
  ShieldAlert,
  TableProperties,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import {
  fetchDashboardProgressEntries,
  getDashboardApiErrorDisplayMessage,
  normalizeDashboardApiError,
  normalizeDashboardLatestBackupAt,
  normalizeDashboardProgressBackupMutationResult,
  type DashboardProgressEntry,
} from '../lib/dashboardApi';
import ProgressDetailModal from './ProgressDetailModal';
import type { ModuleTheme } from '@/lib/theme';
import { getThemeBorderClass, getThemeGlowClass } from '@/lib/theme';

interface ProjectCardProps {
  project: ProjectData;
  theme: ModuleTheme;
}

const cardFontStyle: CSSProperties = {
  fontFamily: '"Geist", "Geist Fallback", "Plus Jakarta Sans", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
};

const cardMonoStyle: CSSProperties = {
  fontFamily: '"Geist Mono", "Geist Mono Fallback", "JetBrains Mono", ui-monospace, monospace',
};

function MoldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="3" width="20" height="18" rx="1.5" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M7 12 C7 9 9 7.5 12 7.5 C15 7.5 17 9 17 12" />
      <line x1="9" y1="12" x2="9" y2="17" />
      <line x1="12" y1="12" x2="12" y2="17" />
      <line x1="15" y1="12" x2="15" y2="17" />
      <line x1="7" y1="17" x2="17" y2="17" />
    </svg>
  );
}

export default function ProjectCard({ project, theme }: ProjectCardProps) {
  const { no, identity, milestones, details } = project;

  const visualState = getCardVisualState(milestones.currentNode);
  const themeBorder = getThemeBorderClass(theme.borderFocus);
  const themeGlow = getThemeGlowClass(theme.shadowGlow);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [localEntries, setLocalEntries] = useState<DashboardProgressEntry[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [latestBackupAt, setLatestBackupAt] = useState<string>('');
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth <= 767);
  const detailModalOpenedRef = useRef(false);
  const progressPrefetchedRef = useRef(false);

  const fetchEntries = useCallback(async () => {
    const mold = identity.moldNumber || '';
    if (!mold) return;
    try {
      setLocalEntries(await fetchDashboardProgressEntries(mold));
    } catch {
      // Ignore silent refresh failures on overview cards.
    }
  }, [identity.moldNumber]);

  const fetchLatestBackupTime = useCallback(async () => {
    const mold = identity.moldNumber || '';
    if (!mold) return;
    try {
      const response = await apiFetch(`/api/dashboard/progress-notes/${encodeURIComponent(mold)}/latest-backup`);
      setLatestBackupAt(
        response.ok ? normalizeDashboardLatestBackupAt(await response.json()) : '',
      );
    } catch {
      setLatestBackupAt('');
    }
  }, [identity.moldNumber]);

  const prefetchProgressCardData = useCallback(() => {
    if (progressPrefetchedRef.current) return;
    progressPrefetchedRef.current = true;
    void fetchEntries();
    void fetchLatestBackupTime();
  }, [fetchEntries, fetchLatestBackupTime]);

  useEffect(() => {
    if (detailModalOpen) {
      detailModalOpenedRef.current = true;
      return;
    }
    if (detailModalOpenedRef.current) {
      void fetchEntries();
      void fetchLatestBackupTime();
    }
  }, [detailModalOpen, fetchEntries, fetchLatestBackupTime]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 767);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleRestoreLatestBackup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (restoringBackup) return;
    const mold = identity.moldNumber || '';
    if (!mold) return;
    const ok = window.confirm('确定恢复到最近一次备份吗？当前推进细节会被覆盖。');
    if (!ok) return;
    try {
      setRestoringBackup(true);
      const response = await apiFetch(`/api/dashboard/progress-notes/${encodeURIComponent(mold)}/restore-latest`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = normalizeDashboardApiError(
          data,
          response.status,
          response.status === 404 ? 'BACKUP_NOT_FOUND' : 'UNKNOWN_ERROR',
        );
        window.alert(getDashboardApiErrorDisplayMessage(error, '恢复失败，请稍后重试'));
        return;
      }
      const result = normalizeDashboardProgressBackupMutationResult(data);
      fetchEntries();
      fetchLatestBackupTime();
      window.alert(`恢复成功，共恢复 ${result.restoredCount} 条`);
    } catch (error) {
      window.alert(getDashboardApiErrorDisplayMessage(error, '恢复失败，请稍后重试'));
    } finally {
      setRestoringBackup(false);
    }
  };

  const handleCreateBackup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (creatingBackup) return;
    const mold = identity.moldNumber || '';
    if (!mold) return;
    try {
      setCreatingBackup(true);
      const response = await apiFetch(`/api/dashboard/progress-notes/${encodeURIComponent(mold)}/create-backup`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = normalizeDashboardApiError(data, response.status, 'UNKNOWN_ERROR');
        window.alert(getDashboardApiErrorDisplayMessage(error, '备份失败，请稍后重试'));
        return;
      }
      const result = normalizeDashboardProgressBackupMutationResult(data);
      fetchLatestBackupTime();
      window.alert(result.created ? '备份成功' : '内容未变化，已复用最近备份');
    } catch (error) {
      window.alert(getDashboardApiErrorDisplayMessage(error, '备份失败，请稍后重试'));
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDrillDown = () => {
    if (detailModalOpen) return;
    if (window.innerWidth <= 767) return;
    const projectId = identity.moldNumber && identity.moldNumber !== '-' ? identity.moldNumber : '';
    if (projectId) {
      sessionStorage.setItem('dashboard_scroll_y', String(document.getElementById('root')?.scrollTop || window.scrollY));
      sessionStorage.setItem('dashboard_filter', sessionStorage.getItem('dashboard_current_filter') || 'ALL');
      sessionStorage.setItem('dashboard_active_module', identity.projectName || '');
      window.location.href = `/gantt?id=${encodeURIComponent(projectId)}`;
    }
  };

  const backupRelativeLabel = (() => {
    if (!latestBackupAt) return '暂无';
    const backupDate = new Date(latestBackupAt);
    if (Number.isNaN(backupDate.getTime())) return '暂无';
    const diff = Math.max(0, nowTs - backupDate.getTime());
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    let relative = '刚刚';
    if (diff >= day) {
      relative = `${Math.floor(diff / day)}天前`;
    } else if (diff >= hour) {
      relative = `${Math.floor(diff / hour)}小时前`;
    } else if (diff >= minute) {
      relative = `${Math.floor(diff / minute)}分钟前`;
    }
    return relative;
  })();

  const latestBackupDisplay = (() => {
    if (!latestBackupAt) return '暂无';
    const backupDate = new Date(latestBackupAt);
    if (Number.isNaN(backupDate.getTime())) return '暂无';
    if (isMobile) return backupRelativeLabel;
    const absolute = backupDate.toLocaleString('zh-CN', { hour12: false });
    const full = `${backupRelativeLabel} (${absolute})`;
    return full.length > 26 ? `${full.slice(0, 26)}...` : full;
  })();

  const latestBackupFull = (() => {
    if (!latestBackupAt) return '暂无';
    const backupDate = new Date(latestBackupAt);
    if (Number.isNaN(backupDate.getTime())) return '暂无';
    const absolute = backupDate.toLocaleString('zh-CN', { hour12: false });
    return `${backupRelativeLabel} (${absolute})`;
  })();

  const accentWash = { background: `linear-gradient(to bottom, rgba(${theme.rgb},0.18), transparent)` };
  const heroWash = {
    background: `linear-gradient(to right, rgba(${theme.rgb},0.14), rgba(${theme.rgb},0.05) 45%, transparent 100%)`,
    boxShadow: `0 0 30px rgba(${theme.rgb},0.14)`,
  };
  const iconPanel = { backgroundColor: `rgba(${theme.rgb},0.2)` };
  const cavityWash = { background: `linear-gradient(to right, rgba(${theme.rgb},0.10), rgba(${theme.rgb},0.03))` };
  const statusGlow = { backgroundColor: `rgba(${theme.rgb},0.08)` };
  const detailScrollStyle = {
    ['--detail-scroll-track' as string]: `rgba(${theme.rgb},0.08)`,
    ['--detail-scroll-thumb' as string]: `rgba(${theme.rgb},0.28)`,
    ['--detail-scroll-thumb-hover' as string]: `rgba(${theme.rgb},0.42)`,
    scrollbarColor: `rgba(${theme.rgb},0.28) rgba(${theme.rgb},0.08)`,
    scrollbarWidth: 'auto',
  } as CSSProperties;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-slate-900/40 shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:-translate-y-1 ${themeBorder} ${themeGlow}`}
      style={cardFontStyle}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32" style={accentWash} />

      <div className="relative p-4 md:p-8">
        <div className="mb-8 flex items-start justify-between gap-3 md:items-center md:gap-4">
          <div className="min-w-0 flex items-baseline gap-2 md:gap-3">
            <h1 className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-2xl font-black text-transparent">
              {getDisplayValue(identity.productName, 'N/A')}
            </h1>
            <span className="shrink-0 text-xs font-mono font-medium tracking-tight text-slate-500" style={cardMonoStyle}>
              NO. {getDisplayValue(no, 'N/A')}
            </span>
          </div>
          <span
            className={`relative flex flex-shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap ${themeBorder} ${theme.text}`}
            style={statusGlow}
          >
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${theme.bg} opacity-60`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${theme.bg}`} />
            </span>
            {visualState.showBadge ? visualState.badgeLabel : getProjectStatusLabel('ongoing')}
            <span className="pointer-events-none absolute inset-0 rounded-full animate-pulse" style={statusGlow} />
          </span>
        </div>

        <div className={`relative mb-0 rounded-xl border p-4 md:p-4 ${themeBorder}`} style={heroWash}>
          <div className="flex items-start gap-3 md:flex-row md:items-center md:gap-4">
            <div className={`ml-1.5 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl ring-1 md:ml-0 ${themeBorder}`} style={iconPanel}>
              <MoldIcon className={`h-7 w-7 ${theme.text}`} />
            </div>
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 md:block">
              <span className="mb-0 shrink-0 text-[10px] uppercase tracking-widest text-slate-400 md:mb-1 md:block">模具编号 / MOLD ID</span>
              <span className={`inline-block break-all text-xl font-mono font-black tracking-tight md:block md:text-2xl ${theme.text}`} style={cardMonoStyle}>
                {getDisplayValue(identity.moldNumber, '-')}
              </span>
            </div>
            <div className="flex w-full items-center justify-end gap-3 pr-0 md:ml-auto md:w-auto md:gap-6 md:pr-2">
              <div className="flex flex-col items-center justify-center gap-0.5 rounded-lg px-4 py-2" style={cavityWash}>
                <span className="text-[9px] uppercase tracking-widest text-slate-500">模具穴号</span>
                <span className={`text-base font-mono font-bold tracking-tight ${theme.text} opacity-80`} style={cardMonoStyle}>
                  {getDisplayValue(identity.cavityNumber, '-')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-800/40 to-transparent" />

        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-x-2 gap-y-4 border-b border-slate-800/50 py-5 md:grid-cols-4 md:gap-x-4 md:gap-y-6">
            <DetailInfoItem
              icon={<Building2 className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="客户"
              value={identity.customerName}
            />
            <DetailInfoItem
              icon={<Hash className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="料号"
              value={identity.partNumber}
              valueClassName="text-[13px] leading-tight font-mono font-semibold tracking-tight text-slate-200 md:whitespace-nowrap md:leading-none"
              valueStyle={cardMonoStyle}
            />
            <DetailInfoItem
              icon={<Layers className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="模具套数"
              value={identity.moldSets}
              valueClassName="text-[18px] leading-none font-mono font-bold text-slate-200"
              valueStyle={cardMonoStyle}
            />
            <DetailInfoItem
              icon={<ShieldAlert className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="风险等级"
              value={getProjectRiskLevelLabel(identity.riskLevel)}
              valueClassName="text-[15px] leading-none font-semibold"
              valueStyle={{ color: getRiskColor(identity.riskLevel) }}
            />
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-4 border-b border-slate-800/50 py-5 md:grid-cols-4 md:gap-x-4 md:gap-y-6">
            <DetailInfoItem
              icon={<User className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="项目经理"
              value={identity.projectManager}
              valueClassName="text-[15px] leading-none font-semibold text-slate-300"
            />
            <DetailInfoItem
              icon={<User className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="项目工程"
              value={identity.projectEngineer}
              valueClassName="text-[15px] leading-none font-semibold text-slate-300"
            />
            <DetailInfoItem
              icon={<User className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="项目QE"
              value={identity.qe}
              valueClassName="text-[15px] leading-none font-semibold text-slate-300"
            />
            <DetailInfoItem
              icon={<Wrench className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="钳工组"
              value={identity.fitterGroup}
              valueClassName="text-[15px] leading-none font-semibold text-slate-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-4 pb-3 pt-5 md:grid-cols-4 md:gap-x-4 md:gap-y-6">
            <DetailInfoItem
              icon={<MapPin className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="客户基地"
              value={identity.customerBase}
            />
            <DetailInfoItem
              icon={<Factory className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="落地工厂"
              value={identity.factory}
            />
            <DetailInfoItem
              icon={<PenTool className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="设计工程"
              value={identity.designEngineer}
            />
            <DetailInfoItem
              icon={<Boxes className={`h-3.5 w-3.5 flex-shrink-0 opacity-70 md:h-4 md:w-4 ${theme.text}`} />}
              label="模具工程"
              value={identity.moldProject}
            />
          </div>
        </div>

        <div className="mt-6 border-t border-slate-800/50 pt-6">
          <span className="mb-6 block text-[10px] font-bold uppercase tracking-widest text-slate-500">内部节点</span>
          <div className="relative">
            <div className="absolute left-0 right-0 top-2 h-0.5 rounded-full bg-slate-800" />
            <div className="relative flex w-full items-center justify-between px-1 md:px-0">
              <TimelineNode label="KICK OFF" date={formatDate(milestones.projectStart)} theme={theme} />
              <TimelineNode label="G/L" date={formatDate(milestones.glTime)} theme={theme} />
              <TimelineNode label="VMP" date={formatDate(milestones.vmp)} theme={theme} />
              <TimelineNode label="MP" date={formatDate(milestones.mp)} theme={theme} />
              <TimelineNode label="T1" date={formatDate(milestones.t1)} theme={theme} />
            </div>
          </div>
        </div>

        <div className="mt-14 grid w-full grid-cols-2 gap-3 md:block">
          <div className="contents md:grid md:grid-cols-3 md:gap-6">
          <MetricPanelCard
            icon={<Gauge className={`mb-2.5 h-5 w-5 opacity-70 transition-opacity group-hover:opacity-100 ${theme.text}`} />}
            label="当前阶段"
            value={milestones.currentStage}
          />
          <MetricPanelCard
            icon={<FlaskConical className={`mb-2.5 h-5 w-5 opacity-70 transition-opacity group-hover:opacity-100 ${theme.text}`} />}
            label="试模次数"
            value={milestones.trialCount}
          />
          <MetricPanelCard
            icon={<Ruler className={`mb-2.5 h-5 w-5 opacity-70 transition-opacity group-hover:opacity-100 ${theme.text}`} />}
            label="T1尺寸达标"
            value={getProjectQualifiedFlagLabel(milestones.t1SizeQualified)}
          />
        </div>

          <div className="contents md:mb-2 md:mt-4 md:grid md:grid-cols-3 md:gap-6">
          <MetricPanelCard
            icon={<TableProperties className={`mb-2.5 h-5 w-5 opacity-70 transition-opacity group-hover:opacity-100 ${theme.text}`} />}
            label="TOOLING FAI"
            value={parseFAIValue(milestones.toolingFAI)}
            valueClassName={buildFaiValueClass(milestones.toolingFAI)}
          />
          <MetricPanelCard
            icon={<TableProperties className={`mb-2.5 h-5 w-5 opacity-70 transition-opacity group-hover:opacity-100 ${theme.text}`} />}
            label="PART FAI"
            value={parseFAIValue(milestones.partFAI)}
            valueClassName={buildFaiValueClass(milestones.partFAI)}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDrillDown();
            }}
            className={`group relative col-span-2 flex min-h-[85px] cursor-pointer flex-col items-center justify-center rounded-xl border bg-slate-900/50 p-3 text-center backdrop-blur-md transition-all hover:bg-slate-800/50 md:col-span-1 md:min-h-[120px] md:p-6 ${themeBorder}`}
          >
            <div className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${theme.bg} opacity-60`} />
            <ChartGantt className={`mb-2.5 h-5 w-5 transition-transform group-hover:scale-110 ${theme.text}`} />
            <span className={`text-sm font-mono font-medium tracking-tight ${theme.text}`} style={cardMonoStyle}>项目甘特图</span>
            <span className="mt-1 text-[9px] uppercase tracking-wider text-slate-600">点击查看</span>
          </button>
          </div>
        </div>

        <div
          className="relative mt-8 border-t border-slate-800/50 pt-6"
          onMouseEnter={prefetchProgressCardData}
          onTouchStart={prefetchProgressCardData}
          onClick={(e) => {
            e.stopPropagation();
            if (window.innerWidth <= 767) return;
            setDetailModalOpen(true);
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-5 w-1 rounded-full ${theme.bg}`} />
              <span className="text-sm font-bold text-slate-300">项目推进细节</span>
            </div>
            <div className="flex min-w-0 flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateBackup}
                  disabled={creatingBackup}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-700/60 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-3 w-3" />
                  {creatingBackup ? '备份中...' : '立即备份'}
                </button>
                <button
                  type="button"
                  onClick={handleRestoreLatestBackup}
                  disabled={restoringBackup}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-700/60 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-3 w-3" />
                  {restoringBackup ? '恢复中...' : '恢复最近备份'}
                </button>
              </div>
              <div className="text-right text-[11px]">
                <span className="text-slate-500">最近备份 </span>
                <span className={theme.text} title={`最近备份 ${latestBackupFull}`}>
                  {latestBackupDisplay}
                </span>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                更新时间:{' '}
                <span className="font-mono">
                  {localEntries.length > 0
                    ? localEntries.reduce((max, entry) => (entry.date > max ? entry.date : max), localEntries[0].date)
                    : formatDate(details.detailDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-slate-700/50 transition-colors hover:border-slate-600">
            {localEntries.length === 0 ? (
              <div className="py-8 text-center">
                <span className="text-sm text-slate-600 transition-colors hover:text-slate-500">点击添加推进细节</span>
              </div>
            ) : (
              <div className="progress-log-scrollbar max-h-[220px] space-y-3 overflow-auto px-4 py-4" style={detailScrollStyle}>
                {localEntries.map((entry) => (
                  <div key={entry.id} className="space-y-2">
                    <p className="text-sm text-slate-300">
                      <span className="mr-2 font-mono text-xs text-slate-400">{entry.date}</span>
                      {entry.content}
                    </p>
                    {entry.imageUrl && (
                      <div
                        className="h-[84px] w-[140px] cursor-zoom-in overflow-hidden rounded-lg border border-slate-700/60"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImageUrl(entry.imageUrl || '');
                        }}
                      >
                        <img src={entry.imageUrl} alt="进度图片" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-2xl bg-gradient-to-t from-slate-900/60 to-transparent" />
        </div>
      </div>

      <ProgressDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        moldNumber={identity.moldNumber || ''}
        currentDetail={details.detailProgress}
        currentDate={formatDate(details.detailDate)}
      />

      {previewImageUrl &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4" onClick={() => setPreviewImageUrl('')}>
            <button
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImageUrl('');
              }}
            >
              <X className="h-4 w-4 text-white/80" />
            </button>
            <img
              src={previewImageUrl}
              alt="图片预览"
              className="max-h-[88vh] max-w-[92vw] rounded-lg border border-white/10 object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

function DetailInfoItem({
  icon,
  label,
  value,
  valueClassName,
  valueStyle,
  contentClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  valueStyle?: CSSProperties;
  contentClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 md:gap-3">
      <div>{icon}</div>
      <div className={`min-w-0 ${contentClassName || ''}`}>
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        <span className={`block break-words text-[15px] leading-snug font-semibold text-slate-200 md:truncate md:leading-none ${valueClassName || ''}`} style={valueStyle}>
          {getDisplayValue(value, '-')}
        </span>
      </div>
    </div>
  );
}

function TimelineNode({ label, date, theme }: { label: string; date: string; theme: ModuleTheme }) {
  const isActive = date !== '-';
  const displayDate = date === '-' ? '\u00A0' : date;

  return (
    <div className="flex min-w-0 flex-col items-center">
      <div
        className={`relative z-10 h-4 w-4 rounded-full ring-4 ring-slate-900 ${isActive ? theme.bg : 'bg-slate-700'}`}
        style={isActive ? { boxShadow: `0 0 12px rgba(${theme.rgb},0.65)` } : undefined}
      />
      <span className="mt-3 px-1 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500 md:text-[10px] md:tracking-widest">{label}</span>
      <span
        className={`mt-1 min-h-[14px] text-center text-[9px] font-mono font-medium tracking-tighter md:text-[10px] md:tracking-normal ${isActive ? 'text-slate-400' : 'text-slate-700'}`}
        style={cardMonoStyle}
      >
        {displayDate}
      </span>
    </div>
  );
}

function MetricPanelCard({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  const displayValue = getDisplayValue(value, '-');
  const typographyValueClassName = buildMetricTypographyClass(displayValue);
  const defaultToneClassName = displayValue === '-' ? 'text-slate-500' : 'text-slate-100';

  return (
    <div className="group flex min-h-[85px] flex-col items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/50 p-3 text-center backdrop-blur-md transition-colors hover:border-slate-600/50 hover:bg-slate-800/50 md:min-h-[120px] md:p-6">
      {icon}
      <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <span className={`${typographyValueClassName} ${valueClassName || defaultToneClassName}`}>
        {displayValue}
      </span>
    </div>
  );
}

function buildMetricTypographyClass(value: string): string {
  if (normalizeProjectQualifiedFlag(value) !== 'unknown') {
    return 'text-base md:text-lg font-sans font-medium tracking-widest mt-1';
  }

  if (value === '-') {
    return 'text-lg md:text-xl font-display tabular-nums font-semibold tracking-tight mt-1';
  }

  return 'text-lg md:text-xl font-display tabular-nums font-semibold tracking-tight mt-1';
}

function buildFaiValueClass(value: string | undefined | null): string {
  const parsed = parseFAIValue(value);
  if (parsed === '-') return '';
  return 'text-slate-100';
}
