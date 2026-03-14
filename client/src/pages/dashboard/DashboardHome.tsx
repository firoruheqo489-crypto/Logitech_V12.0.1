/**
 * DashboardHome
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectData } from './types/project';
import { calculateStats } from './lib/projectUtils';
import FileUpload from './components/FileUpload';
import StatsPanel from './components/StatsPanel';
import ProjectCard from './components/ProjectCard';
import MobileProjectCard from './components/MobileProjectCard';
import SearchBar from './components/SearchBar';
import { AdminButton } from './components/AdminButton';
import { AdminModal } from './components/AdminModal';

import { transformProjectToData, transformDataToProject } from './lib/dataTransformer';
import { toast } from 'sonner';
import { FileSpreadsheet, Sparkles, Clock, Calendar, FileText, Image as ImageIcon, X, User, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEMO_PROJECTS } from './lib/demoData';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { apiFetch } from '@/lib/api';
import { getModuleTheme } from '@/lib/theme';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import ProjectLobby from '@/components/ProjectLobby';

function useIsMobile(breakpoint = 767) {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}
async function fetchProjects(): Promise<any[]> {
  const res = await apiFetch('/api/dashboard/projects');
  if (!res.ok) return [];
  return res.json();
}

async function batchReplaceProjects(data: Record<string, string | undefined>[]): Promise<void> {
  const res = await apiFetch('/api/dashboard/projects/batch-replace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('保存失败');
}

async function clearAllProjects(): Promise<void> {
  const res = await apiFetch('/api/dashboard/projects', { method: 'DELETE' });
  if (!res.ok) throw new Error('清除失败');
}

function formatBatchLabel(uploadBatch?: string): string {
  if (!uploadBatch) return '历史批次';
  const dt = new Date(uploadBatch);
  if (isNaN(dt.getTime())) return '历史批次';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

type ProgressEntry = { id: string; date: string; content: string; imageUrl?: string; assignee?: string; estimatedNodeCompletion?: string };

function normalizeText(value?: string): string {
  return (value || '').trim();
}

function projectSignature(project: ProjectData): string {
  const mold = normalizeText(project.identity?.moldNumber);
  const projectName = normalizeText(project.identity?.projectName);
  const productName = normalizeText(project.identity?.productName);
  const currentNode = normalizeText(project.milestones?.currentNode);
  const estimated = normalizeText(project.milestones?.estimatedCompletion);
  const detailDate = normalizeText(project.details?.detailDate);
  const detail = normalizeText(project.details?.detailProgress);
  return [mold, projectName, productName, currentNode, estimated, detailDate, detail].join('|');
}

function buildBatchSignature(projects: ProjectData[]): string {
  return projects
    .map(projectSignature)
    .sort()
    .join('||');
}

function parseDateToDayStart(value?: string): number | null {
  const raw = (value || '').trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashMatch) {
    const m = Number(slashMatch[1]);
    const d = Number(slashMatch[2]);
    const yearRaw = Number(slashMatch[3]);
    const y = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).setHours(0, 0, 0, 0);
}

function resolveDetailNodeByDate(updateDate?: string, fallbackNode?: string): string {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).setHours(0, 0, 0, 0);
  const rowDay = parseDateToDayStart(updateDate);
  if (rowDay !== null) {
    if (rowDay < todayStart) return '已完成';
    if (rowDay === todayStart) return '进行中';
  }
  return (fallbackNode || '-').trim() || '-';
}

export default function DashboardHome() {
  const isMobile = useIsMobile();
  const [activeModule, setActiveModule] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('dashboard_active_module') || null;
  });
  const [dbProjects, setDbProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [localProjects, setLocalProjects] = useState<ProjectData[]>([]);
  const [progressEntriesByMold, setProgressEntriesByMold] = useState<Record<string, ProgressEntry[]>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');

  const loadProjects = useCallback(async () => {
    const startedAt = Date.now();
    setLoading(true);
    try {
      const rows = await fetchProjects();
      setDbProjects(rows);
    } catch { /* ignore */ }
    const elapsed = Date.now() - startedAt;
    const holdMs = Math.max(0, 5000 - elapsed);
    window.setTimeout(() => setLoading(false), holdMs);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('dashboard_active_module');
  }, []);

  // Scroll restoration - use mobile-scroll on mobile, #root on PC
  useEffect(() => {
    if (loading) return;
    const savedY = sessionStorage.getItem('dashboard_scroll_y');
    if (!savedY) return;
    sessionStorage.removeItem('dashboard_scroll_y');
    const targetY = parseInt(savedY, 10);
    if (isNaN(targetY) || targetY <= 0) return;
    setTimeout(() => {
      const root = document.getElementById('root');
      if (root) root.scrollTop = targetY;
    }, 100);
  }, [loading]);

  const sourceProjects = useMemo(() => {
    if (localProjects.length > 0) return localProjects;
    return dbProjects.map((p: any, i: number) => transformProjectToData(p, i));
  }, [dbProjects, localProjects]);

  const allProjects = useMemo(() => sourceProjects, [sourceProjects]);

  const uniqueModuleNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const p of allProjects) {
      const name = p.identity?.projectName?.trim() || '';
      if (name && !seen.has(name)) { seen.add(name); names.push(name); }
    }
    return names;
  }, [allProjects]);

  const moduleTheme = useMemo(
    () => activeModule ? getModuleTheme(activeModule, uniqueModuleNames) : { key: 'cyan' as const, hex: '#06b6d4', rgb: '6,182,212' },
    [activeModule, uniqueModuleNames],
  );

  // Absolute data interception: every detail-page data source must derive from active module.
  const currentModuleData = useMemo(() => {
    if (!activeModule) return [];
    return allProjects.filter(
      (project) => (project.identity?.projectName?.trim() || '') === activeModule
    );
  }, [allProjects, activeModule]);

  const latestBatch = useMemo(() => {
    let latestTs = -1;
    let latestIso: string | null = null;
    for (const p of currentModuleData) {
      const iso = p.uploadBatch;
      if (!iso) continue;
      const ts = new Date(iso).getTime();
      if (!isNaN(ts) && ts > latestTs) {
        latestTs = ts;
        latestIso = iso;
      }
    }
    return latestIso;
  }, [currentModuleData]);

  useEffect(() => {
    const moldNumbers = Array.from(new Set(
      currentModuleData
        .map((p) => p?.identity?.moldNumber?.trim())
        .filter((mold): mold is string => !!mold && mold !== '-')
    ));

    if (moldNumbers.length === 0) {
      setProgressEntriesByMold({});
      return;
    }

    let cancelled = false;

    (async () => {
      const settled = await Promise.allSettled(
        moldNumbers.map(async (mold) => {
          try {
            const res = await apiFetch(`/api/dashboard/progress-notes/${encodeURIComponent(mold)}`);
            if (!res.ok) return { mold, entries: [] as ProgressEntry[] };
            const rows = await res.json();
            const entries: ProgressEntry[] = (Array.isArray(rows) ? rows : [])
              .map((r: any) => ({
                id: String(r?.id || ''),
                date: String(r?.date || ''),
                content: String(r?.content || ''),
                imageUrl: typeof r?.imageUrl === 'string' ? r.imageUrl : undefined,
                assignee: typeof r?.assignee === 'string' ? r.assignee : undefined,
                estimatedNodeCompletion: typeof r?.estimatedNodeCompletion === 'string' ? r.estimatedNodeCompletion : undefined,
              }))
              .sort((a, b) => b.date.localeCompare(a.date));
            return { mold, entries };
          } catch {
            return { mold, entries: [] as ProgressEntry[] };
          }
        })
      );

      if (cancelled) return;

      const next: Record<string, ProgressEntry[]> = {};
      for (const item of settled) {
        if (item.status !== 'fulfilled') continue;
        next[item.value.mold] = item.value.entries;
      }

      setProgressEntriesByMold(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentModuleData]);

  const hasData = currentModuleData.length > 0;
  const isAdmin = () => new URLSearchParams(window.location.search).get('mode') === 'admin';

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [showDuplicateUploadConfirm, setShowDuplicateUploadConfirm] = useState(false);
  const [pendingUploadData, setPendingUploadData] = useState<ProjectData[] | null>(null);
  const [searchProjectName, setSearchProjectName] = useState('');
  const [searchMoldId, setSearchMoldId] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    const saved = sessionStorage.getItem('dashboard_filter');
    if (saved) { sessionStorage.removeItem('dashboard_filter'); return saved; }
    return 'ALL';
  });

  useEffect(() => {
    sessionStorage.setItem('dashboard_current_filter', filterStatus);
  }, [filterStatus]);

  const handleFileSelect = async (_file: File) => {
    setIsInitialLoading(true);
    try { toast.success('文件上传成功'); } finally { setIsInitialLoading(false); }
  };

  const handleDataUpdate = async (data: ProjectData[]) => {
    const incomingSignature = buildBatchSignature(data);
    const currentSignature = buildBatchSignature(sourceProjects);
    if (incomingSignature && incomingSignature === currentSignature) {
      setPendingUploadData(data);
      setShowDuplicateUploadConfirm(true);
      return;
    }
    await executeDataUpdate(data);
  };

  const executeDataUpdate = async (data: ProjectData[]) => {
    try {
      const transformed = data.map(transformDataToProject);
      await batchReplaceProjects(transformed);
      toast.success(`成功加载 ${data.length} 个项目`);
      setIsAdminModalOpen(false);
      loadProjects();
    } catch {
      setLocalProjects(data);
      toast.warning('未登录或服务不可用,已进入本地预览模式');
    }
  };

  const handleConfirmDuplicateUpload = async () => {
    if (!pendingUploadData) {
      setShowDuplicateUploadConfirm(false);
      return;
    }
    const nextData = pendingUploadData;
    setPendingUploadData(null);
    setShowDuplicateUploadConfirm(false);
    await executeDataUpdate(nextData);
  };

  const handleClearData = async () => {
    try {
      await clearAllProjects();
      toast.success('数据已清除');
      setIsAdminModalOpen(false);
      loadProjects();
    } catch { toast.error('清除数据失败'); }
  };

  const handleLoadDemo = async () => {
    try {
      setIsInitialLoading(true);
      const transformed = DEMO_PROJECTS.map(transformDataToProject);
      await batchReplaceProjects(transformed);
      toast.success(`已加载 ${DEMO_PROJECTS.length} 个演示项目`);
      loadProjects();
    } catch {
      setLocalProjects(DEMO_PROJECTS);
      toast.warning('服务不可用,已加载本地演示数据');
    } finally { setIsInitialLoading(false); }
  };

  const filteredProjects = useMemo(() => {
    if (!hasData) return [];
    let filtered = currentModuleData;
    if (searchProjectName.trim()) {
      const s = searchProjectName.toLowerCase().trim();
      filtered = filtered.filter(p => p.identity.projectName?.toLowerCase().includes(s));
    }
    if (searchMoldId.trim()) {
      const s = searchMoldId.toLowerCase().trim();
      filtered = filtered.filter(p => p.identity.moldNumber?.toLowerCase().includes(s));
    }
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(p => (p.milestones?.currentNode?.trim() || '') === filterStatus);
    }
    return filtered;
  }, [currentModuleData, hasData, searchProjectName, searchMoldId, filterStatus]);

  // ALL groups (unfiltered) — always rendered in DOM to prevent unmount/remount scroll jumps
  const groupKeyOf = useCallback((p: ProjectData) => {
    const mold = p.identity.moldNumber || '未知模具';
    return mold;
  }, []);

  const allGroupedProjects = useMemo(() => {
    const groups: Record<string, ProjectData[]> = {};
    currentModuleData.forEach(p => {
      const key = groupKeyOf(p);
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        const aTs = a.uploadBatch ? new Date(a.uploadBatch).getTime() : -1;
        const bTs = b.uploadBatch ? new Date(b.uploadBatch).getTime() : -1;
        return bTs - aTs;
      });
    });
    return groups;
  }, [currentModuleData, groupKeyOf]);

  // Set of group names that have at least one visible project
  const visibleGroupNames = useMemo(() => {
    const names = new Set<string>();
    filteredProjects.forEach(p => {
      names.add(groupKeyOf(p));
    });
    return names;
  }, [filteredProjects, groupKeyOf]);

  const hasActiveFilters = searchProjectName.trim() !== '' || searchMoldId.trim() !== '';

  // Controlled accordion state — keeps all groups open
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  // 进度记录展开状态: 默认只显示最新6条，点击"更多"后展开全部
  const [expandedNoteGroups, setExpandedNoteGroups] = useState<Set<string>>(new Set());
  const toggleNoteExpand = (key: string) =>
    setExpandedNoteGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Sync openGroups whenever allGroupedProjects keys change (open all by default)
  const allGroupKeys = useMemo(() => Object.keys(allGroupedProjects), [allGroupedProjects]);
  useEffect(() => {
    setOpenGroups(allGroupKeys);
  }, [allGroupKeys]);

  const handleClearSearch = () => { setSearchProjectName(''); setSearchMoldId(''); setFilterStatus('ALL'); };

  const mainRef = useRef<HTMLDivElement>(null);
  const statsPanelRef = useRef<HTMLDivElement>(null);

  const scrollToTopIfMobile = useCallback(() => {
    if (!isMobile) return;
    document.getElementById('root')?.scrollTo({ top: 0 });
  }, [isMobile]);

  const handleFilterChange = useCallback((status: string) => {
    setFilterStatus(status);
    scrollToTopIfMobile();
  }, [scrollToTopIfMobile]);

  const handleProjectNameChange = useCallback((value: string) => {
    setSearchProjectName(value);
    scrollToTopIfMobile();
  }, [scrollToTopIfMobile]);

  const handleMoldIdChange = useCallback((value: string) => {
    setSearchMoldId(value);
    scrollToTopIfMobile();
  }, [scrollToTopIfMobile]);

  const handleShowAll = () => handleFilterChange('ALL');

  // 作用域限定：stats 只统计当前搜索条件下的项目（不含 filterStatus，避免循环）
  const scopedProjects = useMemo(() => {
    let scoped = currentModuleData;
    if (searchProjectName.trim()) {
      const s = searchProjectName.toLowerCase().trim();
      scoped = scoped.filter(p => p.identity.projectName?.toLowerCase().includes(s));
    }
    if (searchMoldId.trim()) {
      const s = searchMoldId.toLowerCase().trim();
      scoped = scoped.filter(p => p.identity.moldNumber?.toLowerCase().includes(s));
    }
    return scoped;
  }, [currentModuleData, searchProjectName, searchMoldId]);

  const stats = useMemo(() => calculateStats(scopedProjects), [scopedProjects]);
  const visibleGroupCount = useMemo(() => visibleGroupNames.size, [visibleGroupNames]);

  // ── 大厅拦截：未选中项目时显示大厅 ──
  if (!activeModule) {
    return <ProjectLobby onSelect={(name) => {
      setActiveModule(name);
      setSearchProjectName('');
      setSearchMoldId('');
      setFilterStatus('ALL');
    }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center gap-5">
        <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="text-white/60">请稍后...</span>
        </h1>
        <div className="flex items-center gap-2.5 text-white/35 text-sm">
          <span className="inline-block w-4 h-4 border-2 border-white/15 border-t-cyan-400 rounded-full animate-spin" />
          正在加载项目数据…
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl mb-4">
              <FileSpreadsheet className="w-8 h-8 text-amber-400/80" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}><span className="text-amber-400">罗技</span>项目进度看板</h1>
            <p className="text-sm text-white/30">项目状态可视化管理系统</p>
          </div>
          <div className="bg-[#080808] rounded-2xl border border-white/[0.06] p-8">
            <p className="text-center text-white/30 mb-6">上传项目进度表 Excel 文件，系统将自动解析并生成可视化看板</p>
            <FileUpload onFileSelect={handleFileSelect} onDataParsed={handleDataUpdate} />
            <div className="mt-6 pt-6 border-t border-white/[0.04]">
              <Button variant="outline" onClick={handleLoadDemo} className="w-full h-12 text-base" disabled={isInitialLoading}>
                <Sparkles className="w-5 h-5 mr-2" />加载演示数据
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen h-auto bg-slate-950 pb-40"
      style={{ '--accent': moduleTheme.hex, '--accent-rgb': moduleTheme.rgb } as React.CSSProperties}
    >
      {/* ── 区块一：全局头部 ── */}
      <div className="bg-slate-900/60 border-b border-slate-800/60">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8 pt-9 pb-6 md:pt-11 md:pb-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => { setActiveModule(null); setSearchProjectName(''); setSearchMoldId(''); setFilterStatus('ALL'); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 hover:border-slate-500 transition-all text-sm font-medium text-slate-200 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              返回项目大厅
            </button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">{activeModule} 系列主看板</h1>
              <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mt-0.5">项目状态可视化管理系统</p>
            </div>
            <span className="ml-auto text-xs text-slate-600 font-mono tracking-tight whitespace-nowrap hidden md:block">
              当前更新节点时间: {formatBatchLabel(latestBatch || undefined)}
            </span>
          </div>
        </div>
      </div>

      {/* ── 区块二：统计卡片区 ── */}
      <div ref={statsPanelRef} className="mx-auto w-full max-w-7xl px-4 md:px-8 pt-6 pb-2 md:pb-4">
        <StatsPanel stats={stats} onFilterChange={handleFilterChange} activeFilter={filterStatus} />
      </div>

      {/* ── 区块三：Tab 导航栏 ── */}
      <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-px mb-6">
          {(['overview', 'logs', 'process', 'fmea', 'product'] as const).map((tab) => {
            const labels: Record<string, string> = { overview: '项目总览', logs: '推进日志', process: '工艺模块', fmea: 'FMEA', product: '产品模块' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab ? 'text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                style={activeTab === tab ? { borderColor: moduleTheme.hex } : undefined}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 区块四：动态内容装载区 ── */}
      <main ref={mainRef} className="mx-auto w-full max-w-7xl px-4 md:px-8 pb-8" style={{ overflowAnchor: 'none' }}>

        {/* ── Tab: 推进日志 ── */}
        {activeTab === 'logs' && (
        <div className="w-full mb-8">
          <Accordion type="multiple" className="w-full space-y-4" value={openGroups} onValueChange={setOpenGroups}>
            {Object.entries(allGroupedProjects).map(([groupKey, group]) => {
              const isGroupVisible = visibleGroupNames.has(groupKey);
              const firstProject = group[0];
              const projectName = firstProject.identity.projectName || '未命名项目';
              const productName = firstProject.identity.productName || '-';
              const moldNo = firstProject.identity.moldNumber || '-';
              const batchLabel = formatBatchLabel(firstProject.uploadBatch);
              const baseMoldNo = firstProject.identity.moldNumber || '-';
              const noteEntries = (baseMoldNo && baseMoldNo !== '-') ? (progressEntriesByMold[baseMoldNo] || []) : [];
              const detailRows = noteEntries.length > 0
                ? noteEntries.map((entry, idx) => ({
                    key: entry.id || `${baseMoldNo}-${idx}`,
                    moldNo: baseMoldNo,
                    updateDate: entry.date || '-',
                    detail: entry.content?.trim() || '暂无推进细节',
                    detailImageUrl: entry.imageUrl?.trim() || null,
                    estimated: entry.estimatedNodeCompletion || firstProject?.milestones?.estimatedCompletion || '-',
                    assignee: entry.assignee || '-',
                    currentNode: (firstProject?.milestones?.currentNode || '').trim() || '-',
                  }))
                : [{
                    key: `${baseMoldNo}-fallback`,
                    moldNo: baseMoldNo,
                    updateDate: firstProject?.details?.detailDate || '-',
                    detail: firstProject?.details?.detailProgress || '暂无推进细节',
                    detailImageUrl: null,
                    estimated: firstProject?.milestones?.estimatedCompletion || '-',
                    assignee: '-',
                    currentNode: (firstProject?.milestones?.currentNode || '').trim() || '-',
                  }];
              // Filter the visible items within this group
              const visibleGroup = isGroupVisible
                ? group.filter(p => {
                    if (searchProjectName.trim()) {
                      const s = searchProjectName.toLowerCase().trim();
                      if (!p.identity.projectName?.toLowerCase().includes(s)) return false;
                    }
                    if (searchMoldId.trim()) {
                      const s = searchMoldId.toLowerCase().trim();
                      if (!p.identity.moldNumber?.toLowerCase().includes(s)) return false;
                    }
                    if (filterStatus !== 'ALL') {
                      if ((p.milestones?.currentNode?.trim() || '') !== filterStatus) return false;
                    }
                    return true;
                  })
                : [];
              return (
                <AccordionItem
                  value={groupKey}
                  key={groupKey}
                  className="project-group-card overflow-hidden"
                  style={{ display: isGroupVisible ? undefined : 'none' }}
                >
                  <AccordionTrigger className="group-card__header px-6 py-3.5 hover:no-underline">
                    <div className="flex items-center w-full pr-4 gap-3">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: moduleTheme.hex }} />
                      <span className="text-base font-bold text-slate-200">{projectName}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-sm text-slate-400">{productName}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-sm font-mono text-slate-500">{moldNo}</span>
                      <span className="ml-auto text-xs text-slate-600 font-mono">{batchLabel}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="group-card__body px-0 pb-0">
                    {isMobile ? (
                      <div className="divide-y divide-slate-800/50">
                        {(expandedNoteGroups.has(groupKey) ? detailRows : detailRows.slice(0, 6)).map((row) => {
                          const node = resolveDetailNodeByDate(row.updateDate, row.currentNode);
                          const moldNo = row.moldNo || '-';
                          const updateDate = row.updateDate || '-';
                          const detail = row.detail || '';
                          const detailImageUrl = row.detailImageUrl;
                          const estimated = row.estimated || '-';
                          const hasDetail = detail.trim() && detail !== '暂无推进细节';
                          return (
                            <div key={row.key} className="px-4 py-3 bg-slate-950/50">
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <div className="font-bold text-[15px] text-slate-200 truncate">{moldNo}</div>
                                <div className="flex-none flex items-center gap-1.5 text-[12px] font-semibold text-slate-400">
                                  <span className="w-2 h-2 rounded-full" style={{ background: moduleTheme.hex, boxShadow: `0 0 6px ${moduleTheme.hex}` }} />
                                  {(node || '-')}
                                </div>
                              </div>
                              {hasDetail && (
                                <div className="mt-1.5 flex items-start gap-3">
                                  {detailImageUrl && (
                                    <button
                                      type="button"
                                      className="w-12 h-8 rounded-lg overflow-hidden ring-1 ring-slate-700/50 shadow-md shrink-0 cursor-zoom-in"
                                      title="查看推进图片"
                                      onClick={() => setPreviewImageUrl(detailImageUrl)}
                                    >
                                      <img src={detailImageUrl} alt="推进缩略图" className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" />
                                    </button>
                                  )}
                                  {!detailImageUrl && (
                                    <div className="w-12 h-8 rounded-lg shrink-0 flex items-center justify-center bg-slate-800/60 ring-1 ring-slate-700/50 shadow-md" title="暂无图片">
                                      <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                                    </div>
                                  )}
                                  <p className="text-[13px] leading-[1.45] text-slate-400 break-words whitespace-normal line-clamp-2 min-w-0">{detail}</p>
                                </div>
                              )}
                              <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-600">
                                <span className="inline-flex items-center gap-1 font-mono tracking-tight"><Clock size={12} />{updateDate}</span>
                                <span className="inline-flex items-center gap-1 font-mono tracking-tight"><Calendar size={12} />{estimated}</span>
                              </div>
                            </div>
                          );
                        })}
                        {detailRows.length > 6 && (
                          <div className="flex justify-end px-4 py-2">
                            <button
                              type="button"
                              onClick={() => toggleNoteExpand(groupKey)}
                              className="text-xs text-slate-500 transition-colors flex items-center gap-1"
                              onMouseEnter={(e) => (e.currentTarget.style.color = moduleTheme.hex)}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                            >
                              {expandedNoteGroups.has(groupKey) ? '收起' : `更多 (${detailRows.length - 6}条)`}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                    <div className="group-card-header text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      <div className="flex items-center gap-1.5"><Clock size={12} className="text-slate-600" /><span>日期</span></div>
                      <div className="text-center">附图</div>
                      <div className="flex items-center gap-1.5"><FileText size={12} className="text-slate-600" /><span>推进细节</span></div>
                      <div className="flex items-center gap-1.5"><Calendar size={12} className="text-slate-600" /><span>预估完成</span></div>
                      <div className="flex items-center gap-1.5"><User size={12} className="text-slate-600" /><span>负责人</span></div>
                    </div>
                    <div className="flex flex-col">
                      {(expandedNoteGroups.has(groupKey) ? detailRows : detailRows.slice(0, 6)).map((row) => {
                        const updateDate = row.updateDate || '-';
                        const detail = row.detail || '暂无推进细节';
                        const detailImageUrl = row.detailImageUrl;
                        const estimated = row.estimated || '-';
                        return (
                          <div key={row.key} className="group-card-row last:border-0 font-sans">
                            <div className="flex items-center text-sm font-mono text-slate-400 tabular-nums">{updateDate}</div>
                            <div className="row-cell-image flex justify-center items-center">
                              {detailImageUrl ? (
                                <button
                                  type="button"
                                  className="w-20 h-12 rounded-lg overflow-hidden ring-1 ring-slate-700/50 shadow-md shrink-0 cursor-zoom-in"
                                  title="查看推进图片"
                                  onClick={() => setPreviewImageUrl(detailImageUrl)}
                                >
                                  <img src={detailImageUrl} alt="推进缩略图" className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" />
                                </button>
                              ) : (
                                <div className="w-20 h-12 rounded-lg shrink-0 flex items-center justify-center bg-slate-800/60 ring-1 ring-slate-700/50 shadow-md" title="暂无图片">
                                  <ImageIcon className="w-4 h-4 text-slate-600" />
                                </div>
                              )}
                            </div>
                            <div className="row-cell-detail">
                              <div className="text-left project-detail-cell min-w-0 !max-w-none text-slate-300 text-sm leading-relaxed">{detail}</div>
                            </div>
                            <div className="flex items-center text-sm font-mono tracking-tight text-slate-400 tabular-nums">{estimated}</div>
                            <div className="flex items-center text-sm text-slate-200 font-medium">{row.assignee && row.assignee !== '-' ? row.assignee : '-'}</div>
                          </div>
                        );
                      })}
                    </div>
                    {detailRows.length > 6 && (
                      <div className="flex justify-end px-6 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleNoteExpand(groupKey)}
                          className="text-xs text-slate-500 transition-colors flex items-center gap-1.5"
                          style={{ '--hover-color': moduleTheme.hex } as React.CSSProperties}
                          onMouseEnter={(e) => (e.currentTarget.style.color = moduleTheme.hex)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                        >
                          {expandedNoteGroups.has(groupKey)
                            ? '收起'
                            : `更多 (${detailRows.length - 6} 条)`}
                        </button>
                      </div>
                    )}
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
        )}

        {/* ── Tab: 项目总览 ── */}
        {activeTab === 'overview' && (
        <>
        <SearchBar projectName={searchProjectName} moldId={searchMoldId} onProjectNameChange={handleProjectNameChange} onMoldIdChange={handleMoldIdChange} onClear={handleClearSearch} hasActiveFilters={hasActiveFilters} />
        <div className="mb-6">
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl md:text-2xl font-bold text-[#E6EDF3]">项目列表</h2>
              <span className="text-xs md:text-sm text-[#6E7681]">
                当前更新节点时间: {formatBatchLabel(latestBatch || undefined)}
              </span>
              {filterStatus !== 'ALL' && (
                <button onClick={handleShowAll} className="px-3 md:px-4 py-1.5 md:py-2 bg-[#151B23] border border-white/[0.06] rounded-lg hover:bg-[#1B222C] text-xs md:text-sm font-medium text-[#8B949E] transition-all duration-200 hover:shadow-[0_0_8px_rgba(0,180,255,0.15)] flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  显示所有项目
                </button>
              )}
            </div>
            <span className="text-xs md:text-sm text-[#6E7681]">共 {visibleGroupCount} 个项目</span>
          </div>

          <div className="md:hidden space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl font-bold leading-[1.1] text-[#E6EDF3]">项目列表</h2>
              <span className="text-xs text-[#6E7681] whitespace-nowrap pt-1">共 {visibleGroupCount} 个项目</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#6E7681]">
                当前更新节点时间: {formatBatchLabel(latestBatch || undefined)}
              </span>
              {filterStatus !== 'ALL' && (
                <button onClick={handleShowAll} className="px-3 py-1.5 bg-[#151B23] border border-white/[0.06] rounded-lg hover:bg-[#1B222C] text-xs font-medium text-[#8B949E] transition-all duration-200 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  显示所有项目
                </button>
              )}
            </div>
          </div>
        </div>
        {filteredProjects.length === 0 ? (
          <div className="bg-[#151B23] rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04)] p-8 md:p-12 text-center min-h-[200px]">
            <p className="text-sm md:text-lg text-[#8B949E]">{hasActiveFilters ? '未找到匹配的项目，请尝试其他搜索条件' : '暂无项目数据'}</p>
          </div>
        ) : (
          <div className="project-list-scope relative z-0 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filteredProjects.map((project, index) => {
              return (
                <div key={index}>
                  <ProjectCard project={project} />
                </div>
              );
            })}
          </div>
        )}
        </>
        )}

        {/* ── Tab: 占位模块 ── */}
        {['process', 'fmea', 'product'].includes(activeTab) && (
          <div className="flex items-center justify-center py-20 text-lg text-slate-500">模块建设中...</div>
        )}
      </main>

      {isAdmin() && <AdminButton onClick={() => setIsAdminModalOpen(true)} />}
      <AdminModal open={isAdminModalOpen} onOpenChange={setIsAdminModalOpen} onDataUpdate={handleDataUpdate} onDataClear={handleClearData} lastUpdated={new Date().toLocaleDateString('zh-CN')} />

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
            alt="推进图片预览"
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      <CyberConfirmDialog
        open={showDuplicateUploadConfirm}
        title="检测到重复批次"
        message="当前上传内容与现有项目数据一致。是否仍要继续上传覆盖？"
        onCancel={() => {
          setShowDuplicateUploadConfirm(false);
          setPendingUploadData(null);
        }}
        onConfirm={handleConfirmDuplicateUpload}
        confirmText="继续上传"
        cancelText="取消"
      />
    </div>
  );
}
