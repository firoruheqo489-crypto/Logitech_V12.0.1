/**
 * ProjectCard - Enterprise SaaS Style (Linear/Notion inspired)
 * 
 * Visual Design:
 * - Modern typography with Microsoft YaHei optimization
 * - Soft shadows and generous spacing
 * - Clean section headers with decorative accents
 * - Traffic light system for FAI values
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ProjectData } from '../types/project';
import { 
  formatDate, 
  getDisplayValue,
  parseFAIValue,
  getFAIColorClass,
  getCardVisualState
} from '../lib/projectUtils';
import { Target, FlaskConical, CheckCircle2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import ProgressDetailModal from './ProgressDetailModal';

interface ProjectCardProps {
  project: ProjectData;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const { no, identity, milestones, details } = project;
  
  const visualState = getCardVisualState(milestones.currentNode);
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [localEntries, setLocalEntries] = useState<Array<{id:string;date:string;content:string;imageUrl?:string}>>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [latestBackupAt, setLatestBackupAt] = useState<string>('');
  const [nowTs, setNowTs] = useState<number>(Date.now());
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth <= 767);

  // Fetch entries from API
  const fetchEntries = useCallback(() => {
    const mold = identity.moldNumber || '';
    if (!mold) return;
    apiFetch(`/api/dashboard/progress-notes/${encodeURIComponent(mold)}`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => setLocalEntries(
        rows.map((r: any) => ({ id: r.id, date: r.date, content: r.content, imageUrl: r.imageUrl }))
          .sort((a: any, b: any) => b.date.localeCompare(a.date))
      ))
      .catch(() => {});
  }, [identity.moldNumber]);

  const fetchLatestBackupTime = useCallback(() => {
    const mold = identity.moldNumber || '';
    if (!mold) return;
    apiFetch(`/api/dashboard/progress-notes/${encodeURIComponent(mold)}/latest-backup`)
      .then(r => r.ok ? r.json() : { backupAt: null })
      .then((data) => setLatestBackupAt(data?.backupAt ? String(data.backupAt) : ''))
      .catch(() => setLatestBackupAt(''));
  }, [identity.moldNumber]);

  // Load on mount
  useEffect(() => {
    fetchEntries();
    fetchLatestBackupTime();
  }, [fetchEntries, fetchLatestBackupTime]);

  // Refresh when modal closes
  useEffect(() => {
    if (!detailModalOpen) {
      fetchEntries();
      fetchLatestBackupTime();
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data?.error || '恢复失败，请稍后重试');
        return;
      }
      fetchEntries();
      fetchLatestBackupTime();
      window.alert(`恢复成功，共恢复 ${data?.restoredCount ?? 0} 条`);
    } catch {
      window.alert('恢复失败，请稍后重试');
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data?.error || '备份失败，请稍后重试');
        return;
      }
      fetchLatestBackupTime();
      window.alert(data?.created ? '备份成功' : '内容未变化，已沿用最近备份');
    } catch {
      window.alert('备份失败，请稍后重试');
    } finally {
      setCreatingBackup(false);
    }
  };

  // Navigate to V3 Gantt view for this project
  const handleDrillDown = () => {
    if (detailModalOpen) return;
    if (window.innerWidth <= 767) return;
    const projectId = identity.moldNumber && identity.moldNumber !== '-' ? identity.moldNumber : '';
    if (projectId) {
      // 记住当前滚动位置，返回时恢复
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

  return (
    <div className="project-card group/card">
      {/* Card Header */}
      <div className="pc-header px-8 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-extrabold tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
              {getDisplayValue(identity.projectName, 'N/A')}
            </h3>
            <p className="text-sm text-slate-500 mt-1.5 font-medium">
              {getDisplayValue(identity.productName, 'N/A')} <span className="text-slate-700 mx-2">·</span> <span className="font-mono tracking-tight">NO. {getDisplayValue(no, 'N/A')}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Status Badge - Only show if valid currentNode */}
            {visualState.showBadge && (
              <span className={`pc-badge px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${visualState.badgeClass}`}>
                {visualState.badgeLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Section 1: 项目基本信息 — 三层分区 */}
      <div className="pc-section px-8 py-6">
        {/* 核心参数区 */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          <InfoField label="客户" value={identity.customerName} tier="primary" />
          <InfoField label="料号" value={identity.partNumber} tier="primary" />
          <InfoField label="模具编号" value={identity.moldNumber} tier="primary" />
          <InfoField label="穴号" value={identity.cavityNumber} tier="primary" />
        </div>

        {/* 干系人暗盒 */}
        <div className="bg-slate-950/80 rounded-xl p-4 shadow-inner ring-1 ring-inset ring-slate-800/50 grid grid-cols-4 gap-4 mb-5">
          <PersonField label="项目经理" value={identity.projectManager} />
          <PersonField label="项目工程师" value={identity.projectEngineer} />
          <PersonField label="项目QE" value={identity.qe} />
          <PersonField label="钳工组" value={identity.fitterGroup} />
        </div>

        {/* 补充信息区 */}
        <div className="grid grid-cols-5 gap-4">
          <InfoField label="客户基地" value={identity.customerBase} tier="secondary" />
          <InfoField label="落地工厂" value={identity.factory} tier="secondary" />
          <InfoField label="模具套数" value={identity.moldSets} tier="secondary" />
          <InfoField label="设计工程" value={identity.designEngineer} tier="secondary" />
          <InfoField label="风险等级" value={identity.riskLevel} tier="secondary" />
        </div>
      </div>

      {/* Section 2: 内部节点 */}
      <div className="pc-section px-8 py-6">
        <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-5 -mt-1">
          内部节点
        </h4>
        
        {/* Timeline Visual - CSS Grid for Perfect Alignment */}
        <div className="mb-6">
          <div className="relative w-full -ml-2">
            {/* The Grey Line - Perfectly centered start-to-end */}
            <div className="absolute top-4 sm:top-5 left-[10%] right-[12%] h-[2px] pc-timeline-line -z-10" />
            
            {/* The Nodes - Grid System (5 equal columns) */}
            <div className="grid grid-cols-5 w-full">
              <TimelineNode label="KICK OFF" date={formatDate(milestones.projectStart)} />
              <TimelineNode label="G/L" date={formatDate(milestones.glTime)} />
              <TimelineNode label="VMP" date={formatDate(milestones.vmp)} />
              <TimelineNode label="MP" date={formatDate(milestones.mp)} />
              <TimelineNode label="T1" date={formatDate(milestones.t1)} />
            </div>
          </div>
        </div>

        {/* Status Indicators Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <StatusField 
            icon={<Target className="w-4 h-4" />}
            label="当前阶段" 
            value={milestones.currentStage} 
          />
          <StatusField 
            icon={<FlaskConical className="w-4 h-4" />}
            label="试模次数" 
            value={milestones.trialCount} 
          />
          <StatusField 
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="T1尺寸达标" 
            value={milestones.t1SizeQualified} 
          />
          
          {/* FAI Fields with Traffic Light Logic */}
          <FAIField 
            label="Tooling FAI" 
            value={milestones.toolingFAI} 
          />
          <FAIField 
            label="Part FAI" 
            value={milestones.partFAI} 
          />
          <div
            className="pc-capsule flex items-center p-3 rounded-lg cursor-pointer bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 hover:bg-slate-700/50 transition-all duration-200 active:scale-95"
            onClick={(e) => { e.stopPropagation(); handleDrillDown(); }}
          >
            <div className="grid grid-cols-[0.9rem_minmax(0,1fr)] sm:grid-cols-[1rem_minmax(0,1fr)] items-center justify-center gap-0.5 sm:gap-1 w-full">
              <span className="flex items-center justify-center w-4 h-4 text-[#8B949E]">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="7" y1="4" x2="7" y2="9" />
                  <rect x="6" y="12" width="4" height="3" rx="0.5" fill="currentColor" stroke="none" />
                  <rect x="11" y="12" width="6" height="2" rx="0.5" fill="currentColor" stroke="none" />
                  <rect x="11" y="15" width="4" height="1.5" rx="0.5" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <div className="min-w-0 text-center">
                <div className="gantt-text-breathe text-sm sm:text-base font-bold whitespace-nowrap tracking-wide text-center">项目甘特图</div>
              </div>
            </div>
          </div>
          
          {/* Status is now shown in header badge */}
        </div>
      </div>

      {/* Section 3: 项目推进细节 */}
      <div className="pc-section pc-section-last px-8 py-6" onClick={(e) => { e.stopPropagation(); if (window.innerWidth <= 767) return; setDetailModalOpen(true); }} style={{ cursor: 'pointer' }}>
        <div className="detail-section detail-section-clickable">
          <div className="detail-header">
            <span className="detail-title">项目推进细节</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleCreateBackup}
                  disabled={creatingBackup}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,0.35)',
                    color: 'rgba(230,237,243,0.88)',
                    background: 'rgba(15,23,42,0.35)',
                    whiteSpace: 'nowrap',
                    cursor: creatingBackup ? 'not-allowed' : 'pointer',
                    opacity: creatingBackup ? 0.6 : 1,
                  }}
                >
                  {creatingBackup ? '备份中...' : '立即备份'}
                </button>
                <button
                  type="button"
                  onClick={handleRestoreLatestBackup}
                  disabled={restoringBackup}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,0.35)',
                    color: 'rgba(230,237,243,0.88)',
                    background: 'rgba(15,23,42,0.35)',
                    whiteSpace: 'nowrap',
                    cursor: restoringBackup ? 'not-allowed' : 'pointer',
                    opacity: restoringBackup ? 0.6 : 1,
                  }}
                >
                  {restoringBackup ? '恢复中...' : '恢复最近备份'}
                </button>
              </div>
              <span
                className="detail-updated"
                title={`最近备份: ${latestBackupFull}`}
                style={{
                  color: 'var(--accent)',
                  maxWidth: isMobile ? 160 : 280,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'right',
                }}
              >
                最近备份: {latestBackupDisplay}
              </span>
              <span className="detail-updated">更新时间: {localEntries.length > 0 ? localEntries.reduce((max, e) => e.date > max ? e.date : max, localEntries[0].date) : formatDate(details.detailDate)}</span>
            </div>
          </div>
          <div className="detail-content detail-scroll-area">
            {/* All entries: local (newest first) + Excel imported (oldest) */}
            {localEntries.length === 0 ? (
              <p style={{ color: 'rgba(148,163,184,0.25)', fontSize: 12, textAlign: 'center', padding: '4px 0' }}>点击添加推进细节</p>
            ) : localEntries.map((entry) => (
              <div key={entry.id} style={{ marginBottom: 8 }}>
                <p>
                  <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', marginRight: 8, fontFamily: 'monospace' }}>{entry.date}</span>
                  {entry.content}
                </p>
                {entry.imageUrl && (
                  <div
                    style={{ marginTop: 6, width: 140, height: 84, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.2)', cursor: 'zoom-in' }}
                    onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(entry.imageUrl || ''); }}
                  >
                    <img src={entry.imageUrl} alt="推进图片" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Progress Detail Modal */}
      <ProgressDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        moldNumber={identity.moldNumber || ''}
        currentDetail={details.detailProgress}
        currentDate={formatDate(details.detailDate)}
      />
      {previewImageUrl && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4" onClick={() => setPreviewImageUrl('')}>
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(''); }}
          >
            <X className="w-4 h-4 text-white/80" />
          </button>
          <img
            src={previewImageUrl}
            alt="图片预览"
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

function InfoField({
  label,
  value,
  tier = 'primary',
}: {
  label: string;
  value: string;
  tier?: 'primary' | 'secondary';
}) {
  const isDanger = value?.trim() === '危险';
  const valueColor = isDanger
    ? 'text-[#FF3B3B]'
    : tier === 'primary' ? 'text-slate-200' : 'text-slate-500';
  return (
    <div>
      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold block mb-1">{label}</span>
      <span className={`text-sm font-bold font-mono tracking-tight truncate block ${valueColor}`}>
        {getDisplayValue(value, '-')}
      </span>
    </div>
  );
}

function PersonField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0 w-5 h-5 rounded-full bg-slate-800 ring-1 ring-slate-700/50 flex items-center justify-center text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.7 14c.1 0 .2-.1.3-.2.2-.5.3-1.1.3-1.8 0-2.2-2.4-4-5.3-4S2.7 9.8 2.7 12c0 .7.1 1.3.3 1.8.1.1.2.2.3.2h9.4Z"/>
        </svg>
      </span>
      <div className="min-w-0">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold block leading-tight">{label}</span>
        <span className="text-sm text-slate-300 font-medium truncate block">{getDisplayValue(value, '-')}</span>
      </div>
    </div>
  );
}

// Helper component for timeline nodes in Section 2
function TimelineNode({ label, date }: { label: string; date: string }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="pc-timeline-node w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1.5 sm:mb-2">
        <div className="pc-timeline-dot w-3 h-3 sm:w-4 sm:h-4 rounded-full" />
      </div>
      <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5 whitespace-nowrap text-center">{label}</div>
      <div className="text-[9px] sm:text-[10px] text-slate-600 font-mono tracking-tight whitespace-nowrap text-center">{date}</div>
    </div>
  );
}

// Helper component for status fields in Section 2
function StatusField({ 
  icon, 
  label, 
  value,
  valueClassName,
  iconClassName
}: { 
  icon?: React.ReactNode;
  label: string; 
  value: string;
  valueClassName?: string;
  iconClassName?: string;
}) {
  const labelLines = label.split('\n');
  const isLongLabel = labelLines.length > 1;
  return (
    <div className="pc-capsule flex items-center p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
      <div className="grid grid-cols-[0.9rem_minmax(0,1fr)] sm:grid-cols-[1rem_minmax(0,1fr)] items-center justify-center gap-0.5 sm:gap-1 w-full">
        {icon && <span className={`flex items-center justify-center w-4 h-4 ${iconClassName || 'text-slate-500'}`}>{icon}</span>}
        <div className="min-w-0 text-center">
          <div className={`text-[9px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1 text-center ${isLongLabel ? 'whitespace-normal leading-[1.15]' : 'whitespace-nowrap'}`}>
            {isLongLabel
              ? labelLines.map((line, idx) => (
                  <span key={`${line}-${idx}`} className="block">{line}</span>
                ))
              : label}
          </div>
          <div className={`pc-metric-value text-[10px] sm:text-sm font-bold font-mono tracking-tight whitespace-nowrap text-center ${valueClassName || 'text-slate-200'}`}>
            {getDisplayValue(value, '-')}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for FAI fields with traffic light logic
function FAIField({ 
  label, 
  value 
}: { 
  label: string; 
  value: string;
}) {
  const displayValue = parseFAIValue(value);
  const colorClass = getFAIColorClass(value);
  const numericMatch = displayValue.match(/\d+/);
  const numericValue = numericMatch ? parseInt(numericMatch[0], 10) : NaN;
  const isQualified = numericValue === 100;
  
  return (
    <div className="pc-capsule flex items-center p-3 rounded-lg bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 hover:bg-slate-700/50 transition-colors">
      <div className="grid grid-cols-[0.9rem_minmax(0,1fr)] sm:grid-cols-[1rem_minmax(0,1fr)] items-center justify-center gap-0.5 sm:gap-1 w-full">
        <span className="flex items-center justify-center w-4 h-4 shrink-0 text-slate-500">
          {isQualified ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </span>
        <div className="min-w-0 text-center">
          <div className="text-[9px] sm:text-[10px] font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap mb-1 text-center">{label}</div>
          <div className={`pc-metric-value text-sm font-bold font-mono tracking-tight truncate text-center w-full ${colorClass}`}>
            {displayValue}
          </div>
        </div>
      </div>
    </div>
  );
}
