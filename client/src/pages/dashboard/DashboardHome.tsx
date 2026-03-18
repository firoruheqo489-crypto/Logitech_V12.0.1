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
import { ProductModuleAdminModal } from './components/ProductModuleAdminModal';
import MoldTrialDrawerWorkspace from './components/MoldTrialDrawerWorkspace';
import MacroStageGateDrawerWorkspace from './components/MacroStageGateDrawerWorkspace';
import ReliabilityDrawerWorkspace from './components/ReliabilityDrawerWorkspace';
import SpcRadarDrawerWorkspace from './components/SpcRadarDrawerWorkspace';
import SpcCalculatorDrawerWorkspace from './components/SpcCalculatorDrawerWorkspace';
import ProductDataDrawerWorkspace from './components/ProductDataDrawerWorkspace';
import ProcessDrawerWorkspace from './components/ProcessDrawerWorkspace';

import { transformDataToProject } from './lib/dataTransformer';
import { fetchDashboardProjectData, fetchDashboardProgressEntries, type DashboardProgressEntry } from './lib/dashboardApi';
import { toast } from 'sonner';
import { FileSpreadsheet, Sparkles, Image as ImageIcon, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEMO_PROJECTS } from './lib/demoData';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { apiFetch } from '@/lib/api';
import { getModuleTheme, getThemeGlowClass, orderModuleNamesForDisplay } from '@/lib/theme';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import ProjectLobby from '@/components/ProjectLobby';
import VDISurfaceGrid, { type MaterialType } from '@/components/VDISurfaceGrid';
import DefectLab from '@/components/DefectLab';
import FmeaIssueWorkspace from '@/components/FmeaIssueWorkspace';
import type { ProductModuleRecord } from './types/product-module';
import {
  buildProductModuleLookupKey,
  formatProductSequenceLabel,
  normalizeMoldLookupKey,
} from './lib/productModuleUtils';
import type { DashboardFilter } from '@/lib/dashboardProjectState';
import {
  normalizeDashboardFilter,
  normalizeProjectDataEnums,
  normalizeProjectStatus,
} from '@/lib/dashboardProjectState';

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
async function fetchProjects(): Promise<ProjectData[]> {
  return fetchDashboardProjectData();
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

function formatDateTimeLabel(timestamp?: string): string {
  if (!timestamp) return '-';
  const dt = new Date(timestamp);
  if (isNaN(dt.getTime())) return '-';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function normalizeDateOnlyLabel(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dt = new Date(trimmed);
  if (isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveProgressUpdateLabel(uploadedAt?: string, mappedDate?: string): string {
  const mappedDateOnly = normalizeDateOnlyLabel(mappedDate);
  const uploadedDateOnly = normalizeDateOnlyLabel(uploadedAt);

  if (uploadedAt && uploadedDateOnly && (!mappedDateOnly || uploadedDateOnly === mappedDateOnly)) {
    return formatDateTimeLabel(uploadedAt);
  }

  return mappedDate?.trim() || '-';
}

function formatBatchLabel(uploadBatch?: string): string {
  if (!uploadBatch) return '历史批次';
  const dt = new Date(uploadBatch);
  if (isNaN(dt.getTime())) return '历史批次';
  return formatDateTimeLabel(uploadBatch);
}

function parseMoldSetCount(value?: string): number {
  if (!value) return 0;
  const match = value.match(/\d+/);
  if (!match) return 0;
  const count = Number.parseInt(match[0], 10);
  return Number.isFinite(count) ? count : 0;
}

type ProgressEntry = DashboardProgressEntry;

async function fetchProgressEntriesForMold(mold: string): Promise<{ mold: string; entries: ProgressEntry[] }> {
  return {
    mold,
    entries: await fetchDashboardProgressEntries(mold),
  };
}

async function loadProgressEntriesByMoldLimited(
  moldNumbers: string[],
  concurrency = 3,
): Promise<Record<string, ProgressEntry[]>> {
  const next: Record<string, ProgressEntry[]> = {};
  let cursor = 0;

  const worker = async () => {
    while (cursor < moldNumbers.length) {
      const currentIndex = cursor;
      cursor += 1;
      const mold = moldNumbers[currentIndex];
      const result = await fetchProgressEntriesForMold(mold);
      next[result.mold] = result.entries;
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, moldNumbers.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return next;
}

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

export default function DashboardHome() {
  const isMobile = useIsMobile();
  const [activeModule, setActiveModule] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('dashboard_active_module') || null;
  });
  const [dbProjects, setDbProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [localProjects, setLocalProjects] = useState<ProjectData[]>([]);
  const [progressEntriesByMold, setProgressEntriesByMold] = useState<Record<string, ProgressEntry[]>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  const [defectMaterial, setDefectMaterial] = useState<MaterialType>('PC/ABS');
  const [defectVDI, setDefectVDI] = useState<number>(24);
  const [productModuleRows, setProductModuleRows] = useState<ProductModuleRecord[]>([]);

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
    return dbProjects;
  }, [dbProjects, localProjects]);

  const allProjects = useMemo(() => sourceProjects, [sourceProjects]);

  const uniqueModuleNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const p of allProjects) {
      const name = p.identity?.projectName?.trim() || '';
      if (name && !seen.has(name)) { seen.add(name); names.push(name); }
    }
    return orderModuleNamesForDisplay(names);
  }, [allProjects]);

  const moduleTheme = useMemo(
    () => activeModule ? getModuleTheme(activeModule, uniqueModuleNames) : getModuleTheme('default'),
    [activeModule, uniqueModuleNames],
  );
  const themeGlow = useMemo(() => getThemeGlowClass(moduleTheme.shadowGlow), [moduleTheme.shadowGlow]);

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

  const currentModuleMoldIds = useMemo(
    () =>
      Array.from(
        new Set(
          currentModuleData
            .map((project) => project.identity?.moldNumber?.trim() || '')
            .filter((mold) => mold && mold !== '-'),
        ),
      ),
    [currentModuleData],
  );

  const currentModuleMoldSetCount = useMemo(
    () =>
      currentModuleData.reduce((maxCount, project) => {
        const parsedCount = parseMoldSetCount(project.identity?.moldSets);
        return Math.max(maxCount, parsedCount);
      }, 0),
    [currentModuleData],
  );

  const currentModuleTrialPanels = useMemo(() => {
    const fallbackMoldId = currentModuleData[0]?.identity?.moldNumber?.trim() || currentModuleMoldIds[0] || 'LA26006';
    const panelCount = Math.max(currentModuleMoldIds.length, currentModuleMoldSetCount, 1);

    return Array.from({ length: panelCount }, (_, index) => ({
      moldId: currentModuleMoldIds[index] || fallbackMoldId,
      moldNo: `NO. ${index + 1}`,
    }));
  }, [currentModuleData, currentModuleMoldIds, currentModuleMoldSetCount]);

  const productModuleSequenceByMold = useMemo(() => {
    const sequenceMap: Record<string, string> = {};
    currentModuleTrialPanels.forEach((panel) => {
      const moldKey = normalizeMoldLookupKey(panel.moldId);
      if (!moldKey) return;
      sequenceMap[moldKey] = formatProductSequenceLabel(panel.moldNo);
    });
    return sequenceMap;
  }, [currentModuleTrialPanels]);

  useEffect(() => {
    if (activeTab !== 'logs') {
      setProgressEntriesByMold({});
      return;
    }

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
      const next = await loadProgressEntriesByMoldLimited(moldNumbers, 3);
      if (cancelled) return;
      setProgressEntriesByMold(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, currentModuleData]);

  const hasData = currentModuleData.length > 0;
  const isAdmin = () => new URLSearchParams(window.location.search).get('mode') === 'admin';

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isProductAdminModalOpen, setIsProductAdminModalOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [showDuplicateUploadConfirm, setShowDuplicateUploadConfirm] = useState(false);
  const [pendingUploadData, setPendingUploadData] = useState<ProjectData[] | null>(null);
  const [searchProjectName, setSearchProjectName] = useState('');
  const [searchMoldId, setSearchMoldId] = useState('');
  const [filterStatus, setFilterStatus] = useState<DashboardFilter>(() => {
    const saved = sessionStorage.getItem('dashboard_filter');
    if (saved) {
      sessionStorage.removeItem('dashboard_filter');
      return normalizeDashboardFilter(saved);
    }
    return 'ALL';
  });

  useEffect(() => {
    sessionStorage.setItem('dashboard_current_filter', filterStatus);
  }, [filterStatus]);

  const loadProductModuleRows = useCallback(async () => {
    try {
      const response = await apiFetch('/api/dashboard/product-data');
      if (!response.ok) return;
      const payload = (await response.json()) as { rows?: Array<Record<string, unknown>> };
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      const mappedRows: ProductModuleRecord[] = rows
        .map((row) => ({
          moldNumber: normalizeMoldLookupKey(String(row.mold_number || '')),
          serialNumber:
            typeof row.serial_number === 'string' ? formatProductSequenceLabel(row.serial_number) : undefined,
          productName: typeof row.product_name === 'string' ? row.product_name : undefined,
          netWeight: typeof row.net_weight === 'string' ? row.net_weight : undefined,
          runnerWeight: typeof row.runner_weight === 'string' ? row.runner_weight : undefined,
          productSize: typeof row.product_size === 'string' ? row.product_size : undefined,
          cavityNumber: typeof row.cavity_number === 'string' ? row.cavity_number : undefined,
          material: typeof row.material === 'string' ? row.material : undefined,
          materialErpName: typeof row.material_erp_name === 'string' ? row.material_erp_name : undefined,
          materialErpCode: typeof row.material_erp_code === 'string' ? row.material_erp_code : undefined,
          recycledMaterialErpCode:
            typeof row.recycled_material_erp_code === 'string' ? row.recycled_material_erp_code : undefined,
          recycledMaterialSpec:
            typeof row.recycled_material_spec === 'string' ? row.recycled_material_spec : undefined,
          rawMaterialName: typeof row.raw_material_name === 'string' ? row.raw_material_name : undefined,
          rawMaterialSpec: typeof row.raw_material_spec === 'string' ? row.raw_material_spec : undefined,
          finishedPartNumber: typeof row.finished_part_number === 'string' ? row.finished_part_number : undefined,
          semiFinishedPartNumber:
            typeof row.semi_finished_part_number === 'string' ? row.semi_finished_part_number : undefined,
          internalFinishedErpCode:
            typeof row.internal_finished_erp_code === 'string' ? row.internal_finished_erp_code : undefined,
          internalSemiFinishedErpCode:
            typeof row.internal_semi_finished_erp_code === 'string'
              ? row.internal_semi_finished_erp_code
              : undefined,
          internalProductName:
            typeof row.internal_product_name === 'string' ? row.internal_product_name : undefined,
          moldSize: typeof row.mold_size === 'string' ? row.mold_size : undefined,
          moldWeight: typeof row.mold_weight === 'string' ? row.mold_weight : undefined,
          machineTonnage: typeof row.machine_tonnage === 'string' ? row.machine_tonnage : undefined,
          moldMaterial: typeof row.mold_material === 'string' ? row.mold_material : undefined,
          openMoldDate: typeof row.open_mold_date === 'string' ? row.open_mold_date : undefined,
          t0Time: typeof row.t0_time === 'string' ? row.t0_time : undefined,
          assetNumber: typeof row.asset_number === 'string' ? row.asset_number : undefined,
          moldOwner: typeof row.mold_owner === 'string' ? row.mold_owner : undefined,
          serviceLife: typeof row.service_life === 'string' ? row.service_life : undefined,
          updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
        }))
        .filter((row) => row.moldNumber);
      setProductModuleRows(mappedRows);
    } catch {
      // Keep fallback display values if product module data is unavailable.
    }
  }, []);

  useEffect(() => {
    void loadProductModuleRows();
  }, [loadProductModuleRows]);

  const handleFileSelect = async (_file: File) => {
    setIsInitialLoading(true);
    try { toast.success('文件上传成功'); } finally { setIsInitialLoading(false); }
  };

  const handleDataUpdate = async (data: ProjectData[]) => {
    const normalizedData = data.map(normalizeProjectDataEnums);
    const incomingSignature = buildBatchSignature(normalizedData);
    const currentSignature = buildBatchSignature(sourceProjects);
    if (incomingSignature && incomingSignature === currentSignature) {
      setPendingUploadData(normalizedData);
      setShowDuplicateUploadConfirm(true);
      return;
    }
    await executeDataUpdate(normalizedData);
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
      setLocalProjects(DEMO_PROJECTS.map(normalizeProjectDataEnums));
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
      filtered = filtered.filter((p) => normalizeProjectStatus(p.milestones?.currentNode) === filterStatus);
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

  const handleFilterChange = useCallback((status: DashboardFilter) => {
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
  const productModuleDataByLookup = useMemo(() => {
    const map: Record<string, ProductModuleRecord> = {};
    productModuleRows.forEach((row) => {
      const key = buildProductModuleLookupKey(row.moldNumber, row.serialNumber);
      if (key) map[key] = row;
    });
    return map;
  }, [productModuleRows]);
  const productModuleLastUpdated = useMemo(() => {
    const latest = currentModuleMoldIds
      .map((moldId) => {
        const sequenceLabel = productModuleSequenceByMold[normalizeMoldLookupKey(moldId)];
        const key = buildProductModuleLookupKey(moldId, sequenceLabel);
        return productModuleDataByLookup[key]?.updatedAt || '';
      })
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))[0];
    return latest ? formatDateTimeLabel(latest) : '-';
  }, [currentModuleMoldIds, productModuleDataByLookup, productModuleSequenceByMold]);

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
          <span className="inline-block w-4 h-4 border-2 border-white/15 rounded-full animate-spin" style={{ borderTopColor: moduleTheme.hex }} />
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
            <div className={`inline-flex items-center justify-center w-16 h-16 border border-white/[0.06] rounded-2xl mb-4 ${moduleTheme.iconBg}`}>
              <FileSpreadsheet className={`w-8 h-8 ${moduleTheme.text}`} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}><span className={moduleTheme.text}>罗技</span>项目进度看板</h1>
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
      <div className="mx-auto w-full max-w-7xl px-4 md:px-8 pt-9 md:pt-11">
        <div className="mt-2 mb-8 flex w-full items-end justify-between px-1">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">{activeModule} 系列主看板</h1>
            <p className="text-sm font-medium text-slate-400">项目状态可视化管理系统</p>
          </div>
          <button
            onClick={() => { setActiveModule(null); setSearchProjectName(''); setSearchMoldId(''); setFilterStatus('ALL'); }}
            className="mb-1 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-300 shadow-sm transition-all hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            返回项目大厅
          </button>
        </div>
      </div>

      <div ref={statsPanelRef} className="mx-auto w-full max-w-7xl px-4 pt-6 pb-2 md:px-8 md:pb-4">
        <StatsPanel stats={stats} theme={moduleTheme} onFilterChange={handleFilterChange} activeFilter={filterStatus} />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
        <div className="mb-8 flex flex-nowrap items-center gap-4 overflow-x-auto border-b border-slate-800/40 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-8 md:overflow-visible">
          {(['overview', 'logs', 'mold-trial-database', 'process', 'fmea', 'product', 'spc-calculator', 'defect-library', 'injection-clinic', 'mold-reliability', 'mass-production-monitoring', 'macro-stage-gate'] as const).map((tab) => {
            const labels: Record<string, string> = {
              'spc-calculator': 'SPC计算器',
              'mass-production-monitoring': '量产监控',
              'macro-stage-gate': '宏观流程视图',
              overview: '项目总览',
              logs: '推进日志',
              process: '工艺模块',
              fmea: 'FMEA知识库',
              product: '产品模块',
              'defect-library': 'VDI 3400 对照库',
              'injection-clinic': '注塑诊所',
              'mold-reliability': '模具可靠性',
              'mold-trial-database': '试模数据库',
            };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative flex-shrink-0 whitespace-nowrap pb-4 text-[15px] font-medium transition-all ${isActive ? moduleTheme.text : 'text-slate-500 hover:text-slate-300'}`}
              >
                {labels[tab]}
                {isActive && (
                  <span
                    className={`absolute bottom-[-1px] left-0 h-[2px] w-full ${moduleTheme.bg} ${themeGlow}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <main ref={mainRef} className="mx-auto w-full max-w-7xl px-4 md:px-8 pb-8" style={{ overflowAnchor: 'none' }}>

        {activeTab === 'logs' && (
        <div className="w-full mb-8">
          <Accordion type="multiple" className="w-full space-y-4" value={openGroups} onValueChange={setOpenGroups}>
            {Object.entries(allGroupedProjects).map(([groupKey, group]) => {
              const isGroupVisible = visibleGroupNames.has(groupKey);
              const firstProject = group[0];
              const projectName = firstProject.identity.projectName || '-';
              const productName = firstProject.identity.productName || '-';
              const moldNo = firstProject.identity.moldNumber || '-';
              const noteEntries = (moldNo && moldNo !== '-') ? (progressEntriesByMold[moldNo] || []) : [];
              const detailRows = noteEntries.length > 0
                ? noteEntries.map((entry, idx) => ({
                    key: entry.id || `${moldNo}-${idx}`,
                    updateDate: entry.date || '-',
                    uploadedAt: entry.updatedAt || entry.createdAt || '',
                    detail: entry.content?.trim() || '暂无推进细节',
                    detailImageUrl: entry.imageUrl?.trim() || null,
                    estimated: entry.estimatedNodeCompletion || firstProject?.milestones?.estimatedCompletion || '-',
                    assignee: entry.assignee || '-',
                  }))
                : [{
                    key: `${moldNo}-fallback`,
                    updateDate: firstProject?.details?.detailDate || '-',
                    uploadedAt: '',
                    detail: firstProject?.details?.detailProgress || '暂无推进细节',
                    detailImageUrl: null,
                    estimated: firstProject?.milestones?.estimatedCompletion || '-',
                    assignee: '-',
                  }];
              return (
                <AccordionItem
                  value={groupKey}
                  key={groupKey}
                  className="project-group-card overflow-hidden"
                  style={{ display: isGroupVisible ? undefined : 'none' }}
                >
                  <AccordionTrigger className="p-0 hover:no-underline">
                    <div className="flex justify-between items-center w-full px-4 py-3 bg-slate-800/40 border-b border-slate-800/50 hover:bg-slate-800/60 transition-colors">
                      <div className="flex items-center gap-3 text-sm font-medium text-slate-200 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${moduleTheme.bg} ${themeGlow}`} />
                        <span className="truncate">{projectName}</span>
                        <span className="text-slate-600">·</span>
                        <span className="truncate">{productName}</span>
                        <span className="text-slate-600">·</span>
                        <span className="shrink-0">{moldNo}</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="group-card__body px-0 pb-0">
                    <div className="hidden md:grid md:grid-cols-[168px_136px_minmax(0,1fr)_156px_120px] gap-6 px-5 py-3 border-b border-slate-800/50 text-[11px] font-medium uppercase tracking-widest text-slate-500">
                      <div className="text-center">节点更新时间</div>
                      <div className="text-center">附图</div>
                      <div className="text-center">推进细节</div>
                      <div className="text-center">节点预估完成时间</div>
                      <div className="text-center">节点负责人</div>
                    </div>
                    <div className="divide-y divide-slate-800/50">
                      {(expandedNoteGroups.has(groupKey) ? detailRows : detailRows.slice(0, 6)).map((row) => {
                        const updateDate = resolveProgressUpdateLabel(row.uploadedAt, row.updateDate);
                        const detail = row.detail || '暂无推进细节';
                        const detailImageUrl = row.detailImageUrl;
                        const estimated = row.estimated || '-';
                        return (
                          <div key={row.key} className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[168px_136px_minmax(0,1fr)_156px_120px] md:gap-6 md:px-5 md:items-center">
                            <div className="pr-2 text-sm font-mono text-slate-400 tabular-nums">{updateDate}</div>
                            <div className="flex items-center md:justify-center">
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
                            <div className="min-w-0 px-2 text-left text-sm leading-7 whitespace-normal break-words [overflow-wrap:anywhere] text-slate-300">
                              {detail}
                            </div>
                            <div className="text-center text-sm font-mono tracking-tight text-slate-400 tabular-nums">{estimated}</div>
                            <div className="text-center text-sm font-medium text-slate-200">{row.assignee && row.assignee !== '-' ? row.assignee : '-'}</div>
                          </div>
                        );
                      })}
                    </div>
                    {detailRows.length > 6 && (
                      <div className="flex justify-end px-6 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleNoteExpand(groupKey)}
                          className="text-xs text-slate-500 transition-colors hover:text-slate-200"
                        >
                          {expandedNoteGroups.has(groupKey) ? '收起' : `更多 (${detailRows.length - 6} 条)`}
                        </button>
                      </div>
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
                <button onClick={handleShowAll} className={`px-3 md:px-4 py-1.5 md:py-2 bg-[#151B23] border border-white/[0.06] rounded-lg hover:bg-[#1B222C] text-xs md:text-sm font-medium text-[#8B949E] transition-all duration-200 ${moduleTheme.shadowGlow} flex items-center gap-2`}>
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
                <button onClick={handleShowAll} className={`px-3 py-1.5 bg-[#151B23] border border-white/[0.06] rounded-lg hover:bg-[#1B222C] text-xs font-medium text-[#8B949E] transition-all duration-200 ${moduleTheme.shadowGlow} flex items-center gap-1.5`}>
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
          <div className="project-list-scope relative z-0 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
            {filteredProjects.map((project, index) => {
              return (
                <div key={index} className="self-start">
                  <ProjectCard project={project} theme={moduleTheme} />
                </div>
              );
            })}
          </div>
        )}
        </>
        )}

        {activeTab === 'macro-stage-gate' && (
          <MacroStageGateDrawerWorkspace panels={currentModuleTrialPanels} />
        )}

        {activeTab === 'fmea' && (
          <FmeaIssueWorkspace
            projectName={activeModule || ''}
            projectIds={currentModuleMoldIds}
            defaultProductName={currentModuleData[0]?.identity?.productName?.trim() || ''}
          />
        )}

        {/* ── Tab: 占位模块 ── */}
        {activeTab === 'product' && (
          <ProductDataDrawerWorkspace
            panels={currentModuleTrialPanels}
            projects={currentModuleData}
            theme={moduleTheme}
            productDataByMold={productModuleDataByLookup}
            productSequenceByMold={productModuleSequenceByMold}
          />
        )}

        {activeTab === 'process' && (
          <ProcessDrawerWorkspace panels={currentModuleTrialPanels} />
        )}

        {activeTab === 'spc-calculator' && (
          <SpcCalculatorDrawerWorkspace panels={currentModuleTrialPanels} />
        )}

        {activeTab === 'mold-reliability' && <ReliabilityDrawerWorkspace panels={currentModuleTrialPanels} />}

        {activeTab === 'mass-production-monitoring' && <SpcRadarDrawerWorkspace panels={currentModuleTrialPanels} />}

        {activeTab === 'mold-trial-database' && (
          <MoldTrialDrawerWorkspace panels={currentModuleTrialPanels} />
        )}
      </main>

      {activeTab === 'defect-library' && (
        <VDISurfaceGrid
          onClose={() => setActiveTab('overview')}
          selectedMat={defectMaterial}
          onMatChange={setDefectMaterial}
          currentVDI={defectVDI}
          onVDIChange={setDefectVDI}
        />
      )}

      {activeTab === 'injection-clinic' && (
        <DefectLab
          onClose={() => setActiveTab('overview')}
          material={defectMaterial}
          vdi={defectVDI}
          assetId={currentModuleData[0]?.identity?.moldNumber?.trim() || currentModuleMoldIds[0] || 'LA26006'}
        />
      )}

      {isAdmin() && (
        <AdminButton
          onClick={() => {
            if (activeTab === 'product') {
              setIsProductAdminModalOpen(true);
              return;
            }
            setIsAdminModalOpen(true);
          }}
        />
      )}
      <AdminModal open={isAdminModalOpen} onOpenChange={setIsAdminModalOpen} onDataUpdate={handleDataUpdate} onDataClear={handleClearData} lastUpdated={new Date().toLocaleDateString('zh-CN')} />
      <ProductModuleAdminModal
        open={isProductAdminModalOpen}
        onOpenChange={setIsProductAdminModalOpen}
        lastUpdated={productModuleLastUpdated}
        onUploadSuccess={loadProductModuleRows}
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
