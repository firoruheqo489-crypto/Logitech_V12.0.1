/**
 * DashboardHome
 */

import React, { lazy, Suspense, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { ProjectData } from './types/project';
import { calculateStats } from './lib/projectUtils';
import FileUpload from './components/FileUpload';
import StatsPanel from './components/StatsPanel';
import ProjectCard from './components/ProjectCard';
import MobileProjectCard from './components/MobileProjectCard';
import SearchBar from './components/SearchBar';
import { AdminButton } from './components/AdminButton';

import { transformDataToProject } from './lib/dataTransformer';
import {
  DashboardApiError,
  fetchDashboardProjectData,
  fetchDashboardProgressEntries,
  getDashboardApiErrorDisplayMessage,
  normalizeDashboardApiError,
  type DashboardProgressEntry,
} from './lib/dashboardApi';
import { toast } from 'sonner';
import { FileSpreadsheet, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEMO_PROJECTS } from './lib/demoData';
import { apiFetch } from '@/lib/api';
import { getModuleTheme, getThemeGlowClass, orderModuleNamesForDisplay } from '@/lib/theme';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import ProjectLobby from '@/components/ProjectLobby';
import type { MaterialType } from '@/components/VDISurfaceGrid';
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

const MoldTrialDrawerWorkspace = lazy(() => import('./components/MoldTrialDrawerWorkspace'));
const ProjectGanttWorkspace = lazy(() => import('./components/ProjectGanttWorkspace'));
const DoeWorkspace = lazy(() => import('./components/DoeWorkspace'));
const TrialDocumentsWorkspace = lazy(() => import('./components/TrialDocumentsWorkspace'));
const MacroStageGateDrawerWorkspace = lazy(() => import('./components/MacroStageGateDrawerWorkspace'));
const ReliabilityDrawerWorkspace = lazy(() => import('./components/ReliabilityDrawerWorkspace'));
const SpcRadarDrawerWorkspace = lazy(() => import('./components/SpcRadarDrawerWorkspace'));
const SpcCalculatorDrawerWorkspace = lazy(() => import('./components/SpcCalculatorDrawerWorkspace'));
const FmeaAnalysisWorkspace = lazy(() => import('./components/FmeaAnalysisWorkspace'));
const PfmeaWorkspace = lazy(() => import('./components/PfmeaWorkspace'));
const Report8DWorkspace = lazy(() => import('./components/Report8DWorkspace'));
const SipWorkspace = lazy(() => import('./components/SipWorkspace'));
const ProcessVarianceWorkspace = lazy(() => import('./components/ProcessVarianceWorkspace'));
const MeasurementIntakeWorkspace = lazy(() => import('./components/MeasurementIntakeWorkspace'));
const CaqAuditWorkspace = lazy(() => import('./components/CaqAuditWorkspace'));
const ProductDataDrawerWorkspace = lazy(() => import('./components/ProductDataDrawerWorkspace'));
const ProgressLogsDrawerWorkspace = lazy(() => import('./components/ProgressLogsDrawerWorkspace'));
const ParetoQualityDashboard = lazy(() => import('./components/ParetoQualityDashboard'));
const FishboneDiagramDashboard = lazy(() => import('./components/FishboneDiagramDashboard'));
const ComplaintInsightDashboard = lazy(() => import('./components/ComplaintInsightDashboard'));
const ImageStitcherWorkspace = lazy(() => import('./components/ImageStitcherWorkspace'));
const FaiDimensionAnalyzer = lazy(() => import('./components/FaiDimensionAnalyzer'));
const DocxConvertModule = lazy(() => import('./components/DocxConvertModule'));
const VDISurfaceGrid = lazy(() => import('@/components/VDISurfaceGrid'));
const DefectLab = lazy(() => import('@/components/DefectLab'));
const AdminModal = lazy(() =>
  import('./components/AdminModal').then((module) => ({ default: module.AdminModal })),
);
const ProductModuleAdminModal = lazy(() =>
  import('./components/ProductModuleAdminModal').then((module) => ({
    default: module.ProductModuleAdminModal,
  })),
);

function LazyWorkspace({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="py-8 text-center text-sm text-white/40">加载中...</div>}>
      {children}
    </Suspense>
  );
}

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
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw normalizeDashboardApiError(payload, res.status, 'UNKNOWN_ERROR');
  }
}

async function clearAllProjects(): Promise<void> {
  const res = await apiFetch('/api/dashboard/projects', { method: 'DELETE' });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw normalizeDashboardApiError(payload, res.status, 'UNKNOWN_ERROR');
  }
}

function shouldFallbackToLocalPreview(error: unknown): boolean {
  if (error instanceof DashboardApiError) {
    return error.code === 'INTERNAL_ERROR' || error.code === 'UNKNOWN_ERROR';
  }

  return !(error instanceof Error) || error instanceof TypeError;
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

const DASHBOARD_TABS = [
  'overview',
  'logs',
  'complaint-insight',
  'product',
  'mold-trial-database',
  'dimension-analysis',
  'docx-converter',
  'trial-documents',
  'project-gantt',
  'doe',
  'fmea-analysis',
  'pfmea',
  'report-8d',
  'sip',
  'image-stitcher',
  'boxplot',
  'pareto-analysis',
  'fishbone-diagram',
  'caq-audit',
  'measurement-intake',
  'mold-reliability',
  'spc-calculator',
  'defect-library',
  'injection-clinic',
  'mass-production-monitoring',
  'macro-stage-gate',
] as const;

type DashboardTab = typeof DASHBOARD_TABS[number];
const CAQ_UNSAVED_FLAG_KEY = "caq-audit:unsaved";

const PUBLIC_DASHBOARD_TAB_LIMIT =
  DASHBOARD_TABS.indexOf('measurement-intake') + 1;
const PUBLIC_DASHBOARD_TABS: DashboardTab[] = [
  ...DASHBOARD_TABS.slice(0, PUBLIC_DASHBOARD_TAB_LIMIT),
];
const ADMIN_ONLY_DASHBOARD_TABS: DashboardTab[] = [
  ...DASHBOARD_TABS.slice(PUBLIC_DASHBOARD_TAB_LIMIT),
];

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
  const [activeTab, setActiveTab] = useState('overview');
  const [defectMaterial, setDefectMaterial] = useState<MaterialType>('PC/ABS');
  const [defectVDI, setDefectVDI] = useState<number>(24);
  const [productModuleRows, setProductModuleRows] = useState<ProductModuleRecord[]>([]);
  const [isProductAdminModalOpen, setIsProductAdminModalOpen] = useState(false);
  const isAdminMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'admin';
  const visibleTabs = isAdminMode ? DASHBOARD_TABS : PUBLIC_DASHBOARD_TABS;
  const selectedTab = useMemo<DashboardTab>(() => {
    const currentTab = DASHBOARD_TABS.includes(activeTab as DashboardTab)
      ? (activeTab as DashboardTab)
      : 'overview';
    if (!isAdminMode && ADMIN_ONLY_DASHBOARD_TABS.includes(currentTab)) {
      return 'mold-trial-database';
    }
    return currentTab;
  }, [activeTab, isAdminMode]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchProjects();
      setDbProjects(rows);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('dashboard_active_module');
  }, []);

  useEffect(() => {
    if (selectedTab !== activeTab) {
      setActiveTab(selectedTab);
    }
  }, [activeTab, selectedTab]);

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
    const seen = new Set<string>();
    const panels = currentModuleData.flatMap((project) => {
      const moldId = project.identity?.moldNumber?.trim() || '';
      const moldNo = formatProductSequenceLabel(project.no) || '';
      if (!moldId || !moldNo) return [];

      const panelKey = `${normalizeMoldLookupKey(moldId)}::${moldNo}`;
      if (seen.has(panelKey)) return [];
      seen.add(panelKey);

      return [{ moldId, moldNo }];
    });

    if (panels.length > 0) {
      return panels;
    }

    const fallbackMoldId = currentModuleData[0]?.identity?.moldNumber?.trim() || currentModuleMoldIds[0] || 'LA26006';
    return [{ moldId: fallbackMoldId, moldNo: 'NO. -' }];
  }, [currentModuleData, currentModuleMoldIds]);

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

  const hasAnyProjects = allProjects.length > 0;
  const hasCurrentModuleData = currentModuleData.length > 0;

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
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

  const handleFileSelect = (_file: File) => {
    void _file;
  };

  const handleDataUpdate = async (data: ProjectData[]) => {
    const normalizedData = data.map(normalizeProjectDataEnums);
    if (normalizedData.length === 0) {
      toast.error('未从 Excel 解析到项目数据，请检查表头模板');
      return;
    }
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
    setIsInitialLoading(true);
    try {
      const transformed = data.map(transformDataToProject);
      await batchReplaceProjects(transformed);
      toast.success(`成功加载 ${data.length} 个项目`);
      setIsAdminModalOpen(false);
      await loadProjects();
    } catch (error) {
      const message = getDashboardApiErrorDisplayMessage(error, '上传失败');

      if (shouldFallbackToLocalPreview(error)) {
        setLocalProjects(data);
        toast.warning(`${message}，已切换到本地预览模式`);
        return;
      }

      toast.error(message);
    } finally {
      setIsInitialLoading(false);
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
      await loadProjects();
    } catch (error) {
      toast.error(getDashboardApiErrorDisplayMessage(error, '清除数据失败'));
    }
  };

  const handleLoadDemo = async () => {
    try {
      setIsInitialLoading(true);
      const transformed = DEMO_PROJECTS.map(transformDataToProject);
      await batchReplaceProjects(transformed);
      toast.success(`已加载 ${DEMO_PROJECTS.length} 个演示项目`);
      await loadProjects();
    } catch (error) {
      if (shouldFallbackToLocalPreview(error)) {
        setLocalProjects(DEMO_PROJECTS.map(normalizeProjectDataEnums));
        toast.warning(`${getDashboardApiErrorDisplayMessage(error, '服务不可用')}，已加载本地演示数据`);
      } else {
        toast.error(getDashboardApiErrorDisplayMessage(error, '加载演示数据失败'));
      }
    } finally { setIsInitialLoading(false); }
  };

  const filteredProjects = useMemo(() => {
    if (!hasCurrentModuleData) return [];
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
  }, [currentModuleData, hasCurrentModuleData, searchProjectName, searchMoldId, filterStatus]);

  const hasActiveFilters = searchProjectName.trim() !== '' || searchMoldId.trim() !== '';

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

  const confirmLeaveCaq = useCallback(() => {
    if (typeof window === 'undefined') return true;
    if (selectedTab !== 'caq-audit') return true;
    return window.sessionStorage.getItem(CAQ_UNSAVED_FLAG_KEY) !== '1'
      || window.confirm('CAQ 工作区还有未保存内容，确认离开吗？');
  }, [selectedTab]);

  const handleTabSelect = useCallback((tab: DashboardTab) => {
    if (tab !== selectedTab && !confirmLeaveCaq()) {
      return;
    }
    setActiveTab(tab);
  }, [confirmLeaveCaq, selectedTab]);

  const handleOpenAdmin = useCallback(() => {
    if (selectedTab === 'product') {
      setIsProductAdminModalOpen(true);
      return;
    }
    setIsAdminModalOpen(true);
  }, [selectedTab]);

  const tabStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeTabButton = document.querySelector(
      `[data-dashboard-tab="${selectedTab}"]`,
    ) as HTMLElement | null;
    activeTabButton?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedTab]);

  // Scope stats to the current search conditions only and avoid filter loops.
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
  const visibleGroupCount = useMemo(
    () =>
      new Set(
        filteredProjects
          .map((project) => project.identity?.moldNumber?.trim() || '')
          .filter(Boolean),
      ).size,
    [filteredProjects],
  );
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

  const adminControls = isAdminMode ? (
    <>
      <AdminButton onClick={handleOpenAdmin} />
      <Suspense fallback={null}>
        <AdminModal
          open={isAdminModalOpen}
          onOpenChange={setIsAdminModalOpen}
          onDataUpdate={handleDataUpdate}
          onDataClear={handleClearData}
          lastUpdated={new Date().toLocaleDateString('zh-CN')}
        />
        <ProductModuleAdminModal
          open={isProductAdminModalOpen}
          onOpenChange={setIsProductAdminModalOpen}
          lastUpdated={productModuleLastUpdated}
          onUploadSuccess={loadProductModuleRows}
        />
      </Suspense>
    </>
  ) : null;

  const emptyDashboardView = (
    <>
      <div className="min-h-screen bg-[#000000] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-16 h-16 border border-white/[0.06] rounded-2xl mb-4 ${moduleTheme.iconBg}`}>
              <FileSpreadsheet className={`w-8 h-8 ${moduleTheme.text}`} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              <span className={moduleTheme.text}>Logitech</span> 项目进度看板
            </h1>
            <p className="text-sm text-white/30">项目状态可视化管理系统</p>
          </div>
          <div className="bg-[#080808] rounded-2xl border border-white/[0.06] p-8">
            <p className="text-center text-white/30 mb-6">
              上传项目进度 Excel 文件后，系统将自动解析并生成可视化看板。
            </p>
            <FileUpload onFileSelect={handleFileSelect} onDataParsed={handleDataUpdate} />
            <div className="mt-6 pt-6 border-t border-white/[0.04]">
              <Button variant="outline" onClick={handleLoadDemo} className="w-full h-12 text-base" disabled={isInitialLoading}>
                <Sparkles className="w-5 h-5 mr-2" />加载演示数据
              </Button>
            </div>
          </div>
        </div>
      </div>
      {adminControls}
    </>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center gap-5">
        <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="text-white/60">请稍后...</span>
        </h1>
        <div className="flex items-center gap-2.5 text-white/35 text-sm">
          <span className="inline-block w-4 h-4 border-2 border-white/15 rounded-full animate-spin" style={{ borderTopColor: moduleTheme.hex }} />
          正在加载项目数据...
        </div>
      </div>
    );
  }

  // Lobby gate: show the lobby when no module is selected.
  if (!activeModule) {
    if (!hasAnyProjects) {
      return emptyDashboardView;
    }

    return (
      <>
        <ProjectLobby onSelect={(name) => {
          setActiveModule(name);
          setSearchProjectName('');
          setSearchMoldId('');
          setFilterStatus('ALL');
        }} />
        {adminControls}
      </>
    );
  }

  if (!hasCurrentModuleData) {
    return emptyDashboardView;
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
            onClick={() => {
              if (!confirmLeaveCaq()) return;
              setActiveModule(null);
              setSearchProjectName('');
              setSearchMoldId('');
              setFilterStatus('ALL');
            }}
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
        <div ref={tabStripRef} className="mb-8 flex flex-nowrap items-center gap-4 overflow-x-auto scrollbar-soft border-b border-slate-800/40 px-2 pb-2 md:gap-8">
          {visibleTabs.map((tab) => {
            const labels: Record<string, string> = {
              'overview': '项目总览',
              'pareto-analysis': '柏拉图分析',
              'image-stitcher': '图片拼接',
              'fishbone-diagram': '鱼骨图',
              'caq-audit': 'CAQ审计台',
              'complaint-insight': '宜胜客诉台账看板',
              'logs': '推进日志',
              'product': '产品模块',
              'mold-trial-database': '试模数据库',
              'dimension-analysis': '尺寸分析',
              'docx-converter': '问题解析',
              'trial-documents': '每日试验档',
              'project-gantt': '项目甘特图',
              'doe': 'DOE实验设计',
              'fmea-analysis': 'DFMEA',
              'pfmea': 'PFMEA',
              'report-8d': '8D报告',
              'boxplot': '箱线图',
              'mold-reliability': '模具可靠性',
              'measurement-intake': '测量检入表',
              'spc-calculator': 'SPC计算器',
              'defect-library': 'VDI 3400 对照库',
              'injection-clinic': '注塑诊所',
              'mass-production-monitoring': '量产监控',
              'macro-stage-gate': '宏观流程视图',
            };
            const isActive = selectedTab === tab;
              return (
                <button
                  key={tab}
                  data-dashboard-tab={tab}
                  onClick={() => handleTabSelect(tab)}
                  className={`relative flex-shrink-0 whitespace-nowrap pb-4 text-[15px] font-medium transition-all ${isActive ? moduleTheme.text : 'text-slate-500 hover:text-slate-300'}`}
                >
                {labels[tab] ?? tab.toUpperCase()}
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

      <main
        ref={mainRef}
        className="mx-auto w-full max-w-7xl px-4 md:px-8 pb-8"
        style={{ overflowAnchor: 'none' }}
      >

        {selectedTab === 'logs' && (
          <LazyWorkspace>
            <ProgressLogsDrawerWorkspace
              panels={currentModuleTrialPanels}
              projects={currentModuleData}
              progressEntriesByMold={progressEntriesByMold}
            />
          </LazyWorkspace>
        )}

        {selectedTab === 'pareto-analysis' && (
          <LazyWorkspace>
            <ParetoQualityDashboard />
          </LazyWorkspace>
        )}

        {selectedTab === 'image-stitcher' && (
          <LazyWorkspace>
            <ImageStitcherWorkspace />
          </LazyWorkspace>
        )}

        {selectedTab === 'fishbone-diagram' && (
          <LazyWorkspace>
            <FishboneDiagramDashboard />
          </LazyWorkspace>
        )}

        {selectedTab === 'caq-audit' && (
          <LazyWorkspace>
            <CaqAuditWorkspace projectName={activeModule || ''} />
          </LazyWorkspace>
        )}

        {selectedTab === 'complaint-insight' && (
          <LazyWorkspace>
            <ComplaintInsightDashboard />
          </LazyWorkspace>
        )}

        {selectedTab === 'measurement-intake' && (
          <LazyWorkspace>
            <MeasurementIntakeWorkspace />
          </LazyWorkspace>
        )}

        {selectedTab === 'overview' && (
        <>
        <SearchBar projectName={searchProjectName} moldId={searchMoldId} onProjectNameChange={handleProjectNameChange} onMoldIdChange={handleMoldIdChange} onClear={handleClearSearch} hasActiveFilters={hasActiveFilters} />
        <div className="mb-6">
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl md:text-2xl font-bold text-[#E6EDF3]">项目列表</h2>
              <span className="text-xs md:text-sm text-[#6E7681]">
                当前更新节点时间：{formatBatchLabel(latestBatch || undefined)}
              </span>
              {filterStatus !== 'ALL' && (
                <button onClick={handleShowAll} className={`px-3 md:px-4 py-1.5 md:py-2 bg-[#151B23] border border-white/[0.06] rounded-lg hover:bg-[#1B222C] text-xs md:text-sm font-medium text-[#8B949E] transition-all duration-200 ${moduleTheme.shadowGlow} flex items-center gap-2`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  显示所有项目
                </button>
              )}
            </div>
            <span className="text-xs md:text-sm text-[#6E7681]">共 {visibleGroupCount} 套模具</span>
          </div>

          <div className="md:hidden space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl font-bold leading-[1.1] text-[#E6EDF3]">项目列表</h2>
              <span className="text-xs text-[#6E7681] whitespace-nowrap pt-1">共 {visibleGroupCount} 套模具</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#6E7681]">
                当前更新节点时间：{formatBatchLabel(latestBatch || undefined)}
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
            <p className="text-sm md:text-lg text-[#8B949E]">
              {hasActiveFilters
                ? '未找到匹配的项目，请尝试其他搜索条件。'
                : '暂无项目数据。'}
            </p>
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

        {isAdminMode && selectedTab === 'macro-stage-gate' && (
          <LazyWorkspace>
            <MacroStageGateDrawerWorkspace panels={currentModuleTrialPanels} />
          </LazyWorkspace>
        )}

        {/* Product module drawer workspace */}
        {selectedTab === 'product' && (
          <LazyWorkspace>
            <ProductDataDrawerWorkspace
              panels={currentModuleTrialPanels}
              projects={currentModuleData}
              theme={moduleTheme}
              productDataByMold={productModuleDataByLookup}
              productSequenceByMold={productModuleSequenceByMold}
            />
          </LazyWorkspace>
        )}

        {selectedTab === 'spc-calculator' && (
          <LazyWorkspace>
            <SpcCalculatorDrawerWorkspace panels={currentModuleTrialPanels} />
          </LazyWorkspace>
        )}

        {selectedTab === 'dimension-analysis' && (
          <LazyWorkspace>
            <FaiDimensionAnalyzer panels={currentModuleTrialPanels} />
          </LazyWorkspace>
        )}

        {selectedTab === 'docx-converter' && (
          <LazyWorkspace>
            <DocxConvertModule panels={currentModuleTrialPanels} />
          </LazyWorkspace>
        )}

        {selectedTab === 'project-gantt' && (
          <LazyWorkspace>
            <ProjectGanttWorkspace />
          </LazyWorkspace>
        )}

        {selectedTab === 'doe' && (
          <LazyWorkspace>
            <DoeWorkspace />
          </LazyWorkspace>
        )}

        {selectedTab === 'fmea-analysis' && (
          <LazyWorkspace>
            <FmeaAnalysisWorkspace />
          </LazyWorkspace>
        )}

        {selectedTab === 'pfmea' && (
          <LazyWorkspace>
            <PfmeaWorkspace />
          </LazyWorkspace>
        )}

        {selectedTab === 'report-8d' && (
          <LazyWorkspace>
            <Report8DWorkspace
              projectName={activeModule || ''}
              productName={currentModuleData[0]?.identity?.productName?.trim() || ''}
              moldNumbers={currentModuleMoldIds}
            />
          </LazyWorkspace>
        )}

        {selectedTab === 'sip' && (
          <LazyWorkspace>
            <SipWorkspace />
          </LazyWorkspace>
        )}

        {selectedTab === 'boxplot' && (
          <LazyWorkspace>
            <ProcessVarianceWorkspace />
          </LazyWorkspace>
        )}

        {selectedTab === 'trial-documents' && (
          <LazyWorkspace>
            <TrialDocumentsWorkspace
              projectName={activeModule || ''}
              panels={currentModuleTrialPanels}
            />
          </LazyWorkspace>
        )}

        {selectedTab === 'mold-reliability' && (
          <LazyWorkspace>
            <ReliabilityDrawerWorkspace panels={currentModuleTrialPanels} />
          </LazyWorkspace>
        )}

        {isAdminMode && selectedTab === 'mass-production-monitoring' && (
          <LazyWorkspace>
            <SpcRadarDrawerWorkspace panels={currentModuleTrialPanels} />
          </LazyWorkspace>
        )}

        {selectedTab === 'mold-trial-database' && (
          <LazyWorkspace>
            <MoldTrialDrawerWorkspace panels={currentModuleTrialPanels} />
          </LazyWorkspace>
        )}

      </main>

      {isAdminMode && selectedTab === 'defect-library' && (
        <LazyWorkspace>
          <VDISurfaceGrid
            onClose={() => setActiveTab('overview')}
            selectedMat={defectMaterial}
            onMatChange={setDefectMaterial}
            currentVDI={defectVDI}
            onVDIChange={setDefectVDI}
          />
        </LazyWorkspace>
      )}

      {isAdminMode && selectedTab === 'injection-clinic' && (
        <LazyWorkspace>
          <DefectLab
            onClose={() => setActiveTab('overview')}
            material={defectMaterial}
            vdi={defectVDI}
            assetId={currentModuleData[0]?.identity?.moldNumber?.trim() || currentModuleMoldIds[0] || 'LA26006'}
          />
        </LazyWorkspace>
      )}

      {adminControls}

      <CyberConfirmDialog
        open={showDuplicateUploadConfirm}
        title="检测到重复批次"
        message="当前上传内容与现有项目数据一致，是否仍要继续上传并覆盖？"
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
