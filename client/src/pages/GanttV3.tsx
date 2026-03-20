/**
 * GanttV3 Page — Full-Screen Immersive Industrial Dashboard
 *
 * Pure black / deep space gray background.
 * Tesla Mission Control × VS Code hybrid.
 *
 * Supports:
 * - Server-loaded data (GET /api/gantt/data?projectId=LA26006)
 * - Demo data (fallback when no server data)
 * - Imported Excel data (via upload modal, persisted then shown)
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearch } from 'wouter';
import { buildDemoData } from '@shared/ganttEngine';
import type { GanttData } from '@shared/ganttEngine';
import GanttV3Milestones from '@/components/v3/GanttV3Milestones';
import GanttV3Chart from '@/components/v3/GanttV3Chart';
import GanttV3ImportModal from '@/components/v3/GanttV3ImportModal';
import { LogitechSCurve } from '@/components/logitech-s-curve';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Activity, ChevronDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';

function useIsMobile(bp = 767) {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth <= bp : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth <= bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return m;
}

const DEFAULT_PROJECT_ID = 'LA26006';
const CONNECTION_RETRY_DELAY_MS = 3000;

type ConnectionStatus = 'ok' | 'missing' | 'error' | null;

export default function GanttV3() {
  const isMobile = useIsMobile();
  const [zoomLevel, setZoomLevel] = useState(Math.round(window.devicePixelRatio * 100));

  useEffect(() => {
    const update = () => setZoomLevel(Math.round(window.devicePixelRatio * 100));
    // matchMedia 监听 devicePixelRatio 变化（浏览器缩放时触发）
    const mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const handler = () => { update(); };
    mql.addEventListener('change', handler);
    window.addEventListener('resize', update);
    return () => {
      mql.removeEventListener('change', handler);
      window.removeEventListener('resize', update);
    };
  }, [zoomLevel]);
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const projectIdFromUrl = urlParams.get('id')?.trim() || DEFAULT_PROJECT_ID;

  const demoData = useMemo(() => buildDemoData(), []);
  const [loading, setLoading] = useState(true);
  const [serverData, setServerData] = useState<GanttData | null>(null);
  const [importedData, setImportedData] = useState<GanttData | null>(null);
  const [uploadKey, setUploadKey] = useState(Date.now());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;

    const clearRetry = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const scheduleRetry = () => {
      if (cancelled || retryTimer !== null) {
        return;
      }

      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void loadProjectData(false);
      }, CONNECTION_RETRY_DELAY_MS);
    };

    const loadProjectData = async (showLoading: boolean) => {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const [health, projectResponse] = await Promise.all([
          apiFetch(`/api/health`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          apiFetch(`/api/gantt/data?projectId=${encodeURIComponent(projectIdFromUrl)}`)
            .then(async (res) => {
              if (!res.ok) {
                return { ok: false, data: null as GanttData | null };
              }

              return { ok: true, data: (await res.json()) as GanttData };
            })
            .catch(() => ({ ok: false, data: null as GanttData | null })),
        ]);

        if (cancelled) return;

        if (health?.ok && health.db === 'ok') {
          if (projectResponse.ok) {
            setConnectionStatus('ok');
            if (projectResponse.data && Array.isArray(projectResponse.data.tasks) && projectResponse.data.tasks.length > 0) {
              setServerData(projectResponse.data);
            } else {
              setServerData(null);
            }
            clearRetry();
          } else {
            setConnectionStatus('error');
            setServerData(null);
            scheduleRetry();
          }
        } else if (health?.db === 'missing') {
          setConnectionStatus('missing');
          setServerData(null);
          scheduleRetry();
        } else {
          setConnectionStatus('error');
          setServerData(null);
          scheduleRetry();
        }
      } catch {
        if (!cancelled) {
          setConnectionStatus('error');
          setServerData(null);
          scheduleRetry();
        }
      } finally {
        if (!cancelled && showLoading) {
          setLoading(false);
        }
      }
    };

    const retryOnFocus = () => {
      clearRetry();
      void loadProjectData(false);
    };

    void loadProjectData(true);
    window.addEventListener('focus', retryOnFocus);
    window.addEventListener('online', retryOnFocus);
    return () => {
      cancelled = true;
      clearRetry();
      window.removeEventListener('focus', retryOnFocus);
      window.removeEventListener('online', retryOnFocus);
    };
  }, [projectIdFromUrl]);

  // Fetch evidence counts for the project
  useEffect(() => {
    const pid = importedData?.projectInfo?.id || serverData?.projectInfo?.id || projectIdFromUrl;
    apiFetch('/api/gantt/project/' + encodeURIComponent(pid) + '/evidence-counts')
      .then(r => r.ok ? r.json() : {})
      .then(data => { if (data && typeof data === 'object') setEvidenceCounts(data as Record<string, number>); })
      .catch(() => {});
  }, [importedData, serverData, projectIdFromUrl]);

  const hasServerData = !!serverData;
  const hasImportedData = !!importedData;
  const data = importedData || serverData || demoData;
  // 当数据库连接正常但该项目无数据时，显示空状态（不 fallback 到 demo）
  const isEmptyProject = connectionStatus === 'ok' && !hasServerData && !hasImportedData;

  const handleImportSuccess = useCallback((newData: GanttData) => {
    // 步骤 2: 全新数组引用 — 彻底阻断旧数据污染
    const freshData: GanttData = {
      ...newData,
      tasks: newData.tasks.map(t => ({ ...t })),
      postMergeTasks: newData.postMergeTasks.map(t => ({ ...t })),
      tracks: newData.tracks.map(tr => ({ ...tr, tasks: tr.tasks.map(t => ({ ...t })) })),
    };
    setImportedData(freshData);
    // 步骤 3: 核武器级重绘 — 强制 React 销毁旧图表并重建
    setUploadKey(Date.now());
  }, []);

  const [projectImageOverride, setProjectImageOverride] = useState<string | null>(null);
  const [evidenceCounts, setEvidenceCounts] = useState<Record<string, number>>({});
  const handleProductImageUpload = useCallback((url: string) => {
    setProjectImageOverride(url);
    setImportedData((prev) =>
      prev ? { ...prev, projectInfo: { ...prev.projectInfo, product_image_url: url } } : prev
    );
    setServerData((prev) =>
      prev ? { ...prev, projectInfo: { ...prev.projectInfo, product_image_url: url } } : prev
    );
  }, []);

  const handleClearData = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const executeClearData = useCallback(async () => {
    const projectId = data?.projectInfo?.id || projectIdFromUrl;
    try {
      const res = await apiFetch(`/api/gantt/project/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
      if (res.ok) {
        setServerData(null);
        setImportedData(null);
        toast.success('数据已清除');
      } else {
        toast.error('Clear failed, please retry');
        return;
      }
    } catch {
      toast.error('Clear failed, please retry');
      return;
    }
  }, [data, projectIdFromUrl]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-[#000000] overflow-hidden">
        <div className="flex items-center justify-center flex-1 text-white/40 text-sm gap-2">
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-cyan-400 rounded-full animate-spin" />
          加载甘特数据…
        </div>
      </div>
    );
  }

  const showConnectionBanner =
    connectionStatus && connectionStatus !== 'ok' && (data === demoData || !serverData);

  // 空项目状态：数据库连接正常但该项目无甘特数据
  if (isEmptyProject) {
    return (
      <div className="h-screen flex flex-col bg-[#000000] overflow-hidden">
        <div className="shrink-0 py-4 bg-[#0A0A0A] border-b border-white/[0.06] flex items-center pl-6 pr-6 gap-4">
          <a
            href="/"
            className="flex items-center gap-2 text-white/60 hover:text-amber-400 transition-colors"
            title="返回宏观看板"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-[13px] font-medium">返回看板</span>
          </a>
          <div className="w-px h-6 bg-white/[0.06]" />
          <span className="text-[15px] font-bold text-white">{projectIdFromUrl}</span>
        </div>
        <EmptyProjectState projectId={projectIdFromUrl} onImportSuccess={handleImportSuccess} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#000000] overflow-hidden" style={{ minWidth: 1280 }}>
      {/* 缩放百分比指示器 */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border backdrop-blur-md"
        style={{
          background: zoomLevel === 100 ? 'rgba(0,255,255,0.08)' : 'rgba(251,191,36,0.12)',
          borderColor: zoomLevel === 100 ? 'rgba(0,255,255,0.25)' : 'rgba(251,191,36,0.3)',
        }}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={zoomLevel === 100 ? '#22d3ee' : '#fbbf24'} strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          {zoomLevel > 100 && <path d="M11 8v6M8 11h6" />}
          {zoomLevel < 100 && <path d="M8 11h6" />}
        </svg>
        <span className="text-[12px] font-bold tabular-nums" style={{
          fontFamily: 'var(--font-mono)',
          color: zoomLevel === 100 ? '#22d3ee' : '#fbbf24',
        }}>
          {zoomLevel}%
        </span>
      </div>
      {showConnectionBanner && (
        <div className="shrink-0 px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-400 text-sm text-center">
          当前为演示数据，未连接到本地服务。请在项目根目录运行 <code className="px-1 rounded bg-white/10">pnpm dev</code>，
          该命令会自动清理 3000/3001 端口残留并同时启动前后端。若仍无法连接，请检查项目根目录
          <code className="px-1 rounded bg-white/10">.env</code> 中的 <code className="px-1 rounded bg-white/10">DATABASE_URL</code> 配置，
          详见 <code className="px-1 rounded bg-white/10">CONNECTION.md</code>
        </div>
      )}
      {/* 唯一表头 — 项目名片 + 里程碑图例 + 导入 */}
      <GanttV3Milestones
        milestones={data.milestones}
        moldNumber={data.projectInfo.moldNumber}
        projectId={data.projectInfo.id}
        projectName={data.projectInfo.project_name}
        productName={data.projectInfo.productName}
        indexNo={data.projectInfo.index_no}
        fitterGroup={data.projectInfo.fitter_group}
        onImportSuccess={handleImportSuccess}
        onClearData={handleClearData}
        taskCount={data.tasks.length}
        trackCount={data.tracks.length}
        isMobile={isMobile}
        boundProjectId={projectIdFromUrl}
      />

      {/* ═══ S 曲线 — 可折叠面板，挂载于甘特图上方 ═══ */}
      <SCurveCollapsible
        projectId={data.projectInfo.id}
        moldNumber={data.projectInfo.moldNumber}
        hasData={!isEmptyProject}
      />

      {/* Main Chart — key={uploadKey} 强制重挂载，消灭旧 DOM 残留 */}
      <GanttV3Chart
        key={uploadKey}
        data={data}
        projectId={data.projectInfo.id}
        productImageUrl={projectImageOverride ?? data.projectInfo.product_image_url}
        onProductImageUpload={handleProductImageUpload}
        evidenceCounts={evidenceCounts}
        isMobile={isMobile}
      />

      <CyberConfirmDialog
        open={showClearConfirm}
        title="清除甘特数据确认"
        message={`确认清除项目 ${(data?.projectInfo?.id || projectIdFromUrl)} 的所有甘特数据吗？此操作不可撤销。`}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={async () => {
          setShowClearConfirm(false);
          await executeClearData();
        }}
        confirmText="确认清除"
        cancelText="取消"
      />
    </div>
  );
}


/** S 曲线可折叠容器 — 赛博发光风格 */
function SCurveCollapsible({ projectId, moldNumber, hasData }: { projectId: string; moldNumber: string; hasData: boolean }) {
  const [open, setOpen] = useState(true);

  if (!hasData) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="shrink-0 border-b border-white/[0.06] bg-[#0A0A0A]">
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center gap-3 px-6 py-2 hover:bg-white/[0.02] transition-colors group cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-cyan-500/15 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span
              className="text-[12px] font-bold uppercase tracking-[0.15em] bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #22d3ee, #06b6d4, #67e8f9)', fontFamily: 'var(--font-display)' }}
            >
              S 曲线进度总览
            </span>
            <div className="flex-1" />
            <span className="text-[12px] text-white/25 font-medium mr-2">
              {open ? '收起' : '展开'}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-white/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-2">
            <LogitechSCurve
              projectId={projectId}
              moldNumber={moldNumber}
              className="border-0 rounded-xl"
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/** 空项目占位 — 数据库已连接但该 projectId 无甘特数据 */
function EmptyProjectState({ projectId, onImportSuccess }: { projectId: string; onImportSuccess?: (data: GanttData) => void }) {
  const [importOpen, setImportOpen] = useState(false);
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
        <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-white/50 text-sm font-medium">项目 <span className="text-cyan-400 font-bold">{projectId}</span> 暂无甘特图数据</p>
        <p className="text-white/25 text-xs mt-2">请导入该项目的 Excel 计划表以生成甘特图</p>
      </div>
      <button
        onClick={() => setImportOpen(true)}
        className="px-5 py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-400/25 hover:bg-cyan-500/25 hover:border-cyan-400/40 transition-all text-cyan-400 text-sm font-bold flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        导入项目计划
      </button>
      <GanttV3ImportModal open={importOpen} onOpenChange={setImportOpen} onImportSuccess={onImportSuccess} currentProjectId={projectId} />
    </div>
  );
}
