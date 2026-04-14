'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type JSX } from 'react';
import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Info,
  LoaderCircle,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { deleteAssetViaServer, uploadAssetViaServer } from '@/lib/ossUpload';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';

import { normalizeMoldLookupKey } from '../lib/productModuleUtils';
import AssetDrawerWorkspace, { type AssetPanelItem } from './AssetDrawerWorkspace';
import PartFaiParserSection from './part-fai-parser';

type TrialStage = string;

type DimensionPanel = AssetPanelItem & {
  trialStage?: string;
};

type ProductDocRecord = {
  moldNumber: string;
  fileUrl: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  updatedAt?: string;
};

type ProductDocsByMold = Record<string, ProductDocRecord>;

type PendingDeleteState = {
  panelKey: string;
  stage: TrialStage;
} | null;

const defaultTrialStages: TrialStage[] = ['T0'];

function normalizeTrialStage(value: unknown): TrialStage {
  const normalized = String(value ?? '').trim().toUpperCase();
  return /^T\d+$/.test(normalized) ? normalized : 'T0';
}

function createTrialStageLabel(index: number): TrialStage {
  return `T${index}`;
}

function sanitizeTrialStages(value: unknown): TrialStage[] {
  if (!Array.isArray(value)) return [...defaultTrialStages];

  const uniqueStages = Array.from(
    new Set(
      value
        .map((stage) => normalizeTrialStage(stage))
        .filter((stage) => /^T\d+$/.test(stage)),
    ),
  ).sort((left, right) => Number.parseInt(left.slice(1), 10) - Number.parseInt(right.slice(1), 10));

  if (uniqueStages.length === 0) return [...defaultTrialStages];

  const maxStageIndex = uniqueStages.reduce((maxIndex, stage) => {
    const parsed = Number.parseInt(stage.slice(1), 10);
    return Number.isFinite(parsed) ? Math.max(maxIndex, parsed) : maxIndex;
  }, 0);

  return Array.from({ length: maxStageIndex + 1 }, (_, index) => createTrialStageLabel(index));
}

function buildPanelKey(panel: Pick<AssetPanelItem, 'moldId' | 'moldNo'>): string {
  return `${String(panel.moldId ?? '').trim()}::${String(panel.moldNo ?? '').trim()}`;
}

function readStoredTrialStages(panelKey: string): TrialStage[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(`dimension-data-trial-stages:${panelKey}`);
    return raw ? sanitizeTrialStages(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeStoredTrialStages(panelKey: string, stages: TrialStage[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(`dimension-data-trial-stages:${panelKey}`, JSON.stringify(stages));
  } catch {
    // ignore storage errors
  }
}

function readStoredActiveTrial(panelKey: string): TrialStage | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(`dimension-data-active-trial:${panelKey}`);
    return raw ? normalizeTrialStage(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredActiveTrial(panelKey: string, trialStage: TrialStage): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(`dimension-data-active-trial:${panelKey}`, normalizeTrialStage(trialStage));
  } catch {
    // ignore storage errors
  }
}

function readRouteErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

function formatDateTimeLabel(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function formatFileSize(value?: number | null): string {
  if (!value || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeMeasurementDocRecord(raw: unknown): ProductDocRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const row = raw as Record<string, unknown>;
  const slotType = String(row.slot_type ?? '').trim();
  if (slotType !== 'measurement-method') return null;

  const moldNumber = String(row.mold_number ?? '').trim();
  const fileUrl = String(row.file_url ?? '').trim();
  const fileName = String(row.file_name ?? '').trim();
  if (!moldNumber || !fileUrl || !fileName) return null;

  return {
    moldNumber: normalizeMoldLookupKey(moldNumber),
    fileUrl,
    fileName,
    mimeType: typeof row.mime_type === 'string' ? row.mime_type : null,
    fileSize: typeof row.file_size === 'number' ? row.file_size : Number(row.file_size ?? NaN),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
}

function buildMeasurementDocsByMold(rows: ProductDocRecord[]): ProductDocsByMold {
  return rows.reduce((acc, row) => {
    if (row.moldNumber) {
      acc[row.moldNumber] = row;
    }
    return acc;
  }, {} as ProductDocsByMold);
}

function isAllowedMeasurementFile(file: File): boolean {
  return /application\/(pdf|x-pdf|acrobat)/i.test(file.type) || /\.pdf$/i.test(file.name);
}

function MeasurementMethodCard({ moldId }: { moldId: string }): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [docsByMold, setDocsByMold] = useState<ProductDocsByMold>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const moldKey = useMemo(() => normalizeMoldLookupKey(moldId), [moldId]);
  const activeDoc = docsByMold[moldKey];

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/dashboard/product-docs');
      const payload = (await response.json().catch(() => null)) as { rows?: unknown[] } | null;
      if (!response.ok) {
        throw new Error(readRouteErrorMessage(payload, '加载测量方法文件失败'));
      }

      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      setDocsByMold(
        buildMeasurementDocsByMold(
          rows
            .map(normalizeMeasurementDocRecord)
            .filter((row): row is ProductDocRecord => row !== null),
        ),
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '加载测量方法文件失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!isAllowedMeasurementFile(file)) {
      setError('测量方法仅支持上传 PDF 文件。');
      return;
    }

    setBusy(true);
    setError('');

    let uploadedUrl = '';
    try {
      const uploadResult = await uploadAssetViaServer({
        file,
        category: 'dashboard-product-doc',
        entityId: moldId,
        slot: 'measurement-method',
      });
      uploadedUrl = uploadResult.url;

      const response = await apiFetch(`/api/dashboard/product-docs/${encodeURIComponent(moldId)}/measurement-method`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: uploadResult.url,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          fileSize: file.size,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(readRouteErrorMessage(payload, '保存测量方法文件失败'));
      }

      await loadDocs();
    } catch (nextError) {
      if (uploadedUrl) {
        await deleteAssetViaServer(uploadedUrl).catch(() => undefined);
      }
      setError(nextError instanceof Error ? nextError.message : '上传测量方法文件失败');
    } finally {
      setBusy(false);
    }
  }, [loadDocs, moldId]);

  const handleDelete = useCallback(async () => {
    setShowDeleteConfirm(false);
    if (!activeDoc) return;

    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`/api/dashboard/product-docs/${encodeURIComponent(moldId)}/measurement-method`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(readRouteErrorMessage(payload, '删除测量方法文件失败'));
      }
      await loadDocs();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '删除测量方法文件失败');
    } finally {
      setBusy(false);
    }
  }, [activeDoc, loadDocs, moldId]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
            <FileText className="h-4 w-4" />
            测量方法 / Measurement MTD
          </div>
          <p className="mt-2 text-sm text-slate-400">
            这里维护当前模号的测量方法 PDF，用于对照当前轮次的产品尺寸 FAI 数据。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf,application/x-pdf,application/acrobat"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-700/50 bg-cyan-950/35 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200 transition-colors hover:bg-cyan-900/45 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {activeDoc ? '替换 PDF' : '上传 PDF'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!activeDoc) return;
              window.open(activeDoc.fileUrl, '_blank', 'noopener,noreferrer');
            }}
            disabled={!activeDoc}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            打开
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={!activeDoc || busy}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-800/50 bg-rose-950/25 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-rose-200 transition-colors hover:bg-rose-900/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            删除
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0a0f1c] p-4">
        {loading ? (
          <div className="flex min-h-80 items-center justify-center text-slate-400">
            <div className="flex items-center gap-2">
              <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" />
              正在加载测量方法文件...
            </div>
          </div>
        ) : activeDoc ? (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-200">
                {activeDoc.fileName}
              </span>
              <span>更新时间 {formatDateTimeLabel(activeDoc.updatedAt)}</span>
              {formatFileSize(activeDoc.fileSize) ? <span>文件大小 {formatFileSize(activeDoc.fileSize)}</span> : null}
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-white">
              <iframe
                title={`${moldId} measurement method`}
                src={`${activeDoc.fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="h-[420px] w-full bg-white"
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              如果内嵌预览空白，可直接点击“打开”在新窗口查看原始 PDF。
            </p>
          </>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center">
            <FileText className="h-10 w-10 text-slate-600" />
            <div className="text-base font-semibold text-slate-200">暂无测量方法文件</div>
            <p className="max-w-xl text-sm text-slate-500">
              上传当前模号的测量方法 PDF 后，尺寸看板可直接对照方法书与本轮产品尺寸 FAI 数据。
            </p>
          </div>
        )}
      </div>

      <CyberConfirmDialog
        open={showDeleteConfirm}
        title="删除测量方法文件"
        message={activeDoc ? `确定要删除 ${activeDoc.fileName} 吗？删除后该文件和预览内容将无法恢复。` : ''}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDelete()}
        confirmText="确认删除"
        cancelText="取消"
      />
    </section>
  );
}

function DimensionDataWorkspace({
  moldId,
  moldNo,
  trialStage,
}: {
  moldId: string;
  moldNo?: string;
  trialStage: TrialStage;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <MeasurementMethodCard moldId={moldId} />
        <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
            <Info className="h-4 w-4" />
            看板说明
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-[#0a0f1c] px-4 py-3">
              <div className="text-[11px] font-mono tracking-[0.2em] text-slate-500">MOLD</div>
              <div className="mt-2 text-lg font-bold tracking-wide text-slate-100">{moldId}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0a0f1c] px-4 py-3">
              <div className="text-[11px] font-mono tracking-[0.2em] text-slate-500">NO.</div>
              <div className="mt-2 text-lg font-bold tracking-wide text-slate-100">{moldNo || 'NO. -'}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0a0f1c] px-4 py-3">
              <div className="text-[11px] font-mono tracking-[0.2em] text-slate-500">TRIAL</div>
              <div className="mt-2 text-lg font-bold tracking-wide text-cyan-300">{trialStage}</div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-cyan-900/30 bg-cyan-950/10 px-4 py-4 text-sm leading-6 text-slate-300">
            当前模块只恢复“尺寸数据看板”本身，不改动试模数据库里的其他分区。你可以在这里按轮次维护测量方法和产品尺寸 FAI，轮次切换、增加、删除会独立保存在本地浏览器里。
          </div>
        </section>
      </div>

      <PartFaiParserSection
        key={`${moldId}::${moldNo || 'default'}::${trialStage}`}
        moldId={moldId}
        moldNo={moldNo}
        trialStage={trialStage}
      />
    </div>
  );
}

export default function DimensionDataDrawerWorkspace({
  panels,
}: {
  panels: DimensionPanel[];
}): JSX.Element {
  const normalizedPanels = useMemo(() => {
    const seen = new Set<string>();
    const nextPanels: DimensionPanel[] = [];

    panels.forEach((panel) => {
      const moldId = String(panel.moldId ?? '').trim();
      const moldNo = String(panel.moldNo ?? '').trim();
      if (!moldId) return;

      const panelKey = buildPanelKey({ moldId, moldNo });
      if (seen.has(panelKey)) return;
      seen.add(panelKey);

      nextPanels.push({
        moldId,
        moldNo,
        trialStage: normalizeTrialStage(panel.trialStage),
      });
    });

    return nextPanels;
  }, [panels]);

  const observedTrialStagesByPanel = useMemo(() => {
    const nextStages: Record<string, TrialStage[]> = {};

    panels.forEach((panel) => {
      const moldId = String(panel.moldId ?? '').trim();
      const moldNo = String(panel.moldNo ?? '').trim();
      if (!moldId) return;

      const panelKey = buildPanelKey({ moldId, moldNo });
      const trialStage = normalizeTrialStage(panel.trialStage);

      nextStages[panelKey] = nextStages[panelKey] || [];
      nextStages[panelKey].push(trialStage);
    });

    Object.keys(nextStages).forEach((panelKey) => {
      nextStages[panelKey] = sanitizeTrialStages(nextStages[panelKey]);
    });

    return nextStages;
  }, [panels]);

  const [trialStagesByPanel, setTrialStagesByPanel] = useState<Record<string, TrialStage[]>>(() => {
    const next: Record<string, TrialStage[]> = {};

    Object.entries(observedTrialStagesByPanel).forEach(([panelKey, stages]) => {
      const storedStages = readStoredTrialStages(panelKey);
      next[panelKey] = sanitizeTrialStages([...(storedStages || []), ...stages]);
    });

    return next;
  });

  const [activeTrialByPanel, setActiveTrialByPanel] = useState<Record<string, TrialStage>>(() => {
    const next: Record<string, TrialStage> = {};

    Object.entries(observedTrialStagesByPanel).forEach(([panelKey, stages]) => {
      const storedStages = sanitizeTrialStages([...(readStoredTrialStages(panelKey) || []), ...stages]);
      const storedActiveTrial = readStoredActiveTrial(panelKey);
      next[panelKey] = storedStages.includes(storedActiveTrial || '')
        ? normalizeTrialStage(storedActiveTrial)
        : storedStages[0] || 'T0';
    });

    return next;
  });

  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState>(null);
  const [deleteLimitMessage, setDeleteLimitMessage] = useState<string | null>(null);

  useEffect(() => {
    setTrialStagesByPanel((prev) => {
      const next: Record<string, TrialStage[]> = {};

      Object.entries(observedTrialStagesByPanel).forEach(([panelKey, stages]) => {
        next[panelKey] = sanitizeTrialStages([...(prev[panelKey] || []), ...stages]);
        writeStoredTrialStages(panelKey, next[panelKey]);
      });

      return next;
    });
  }, [observedTrialStagesByPanel]);

  useEffect(() => {
    setActiveTrialByPanel((prev) => {
      const next: Record<string, TrialStage> = {};
      let changed = false;

      Object.entries(trialStagesByPanel).forEach(([panelKey, stages]) => {
        const candidate = prev[panelKey] || readStoredActiveTrial(panelKey) || stages[0];
        const nextActiveTrial = stages.includes(candidate) ? candidate : stages[0];
        next[panelKey] = nextActiveTrial;
        if (prev[panelKey] !== nextActiveTrial) {
          changed = true;
        }
        writeStoredActiveTrial(panelKey, nextActiveTrial);
      });

      if (Object.keys(prev).some((panelKey) => !(panelKey in next))) {
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [trialStagesByPanel]);

  const handleSelectTrialStage = useCallback((panelKey: string, trialStage: TrialStage) => {
    const normalizedTrialStage = normalizeTrialStage(trialStage);
    setActiveTrialByPanel((prev) => ({
      ...prev,
      [panelKey]: normalizedTrialStage,
    }));
    writeStoredActiveTrial(panelKey, normalizedTrialStage);
  }, []);

  const handleAddTrialStage = useCallback((panelKey: string) => {
    setTrialStagesByPanel((prev) => {
      const currentStages = prev[panelKey] || ['T0'];
      const nextStageIndex = currentStages.reduce((maxIndex, stage) => {
        return Math.max(maxIndex, Number.parseInt(stage.slice(1), 10) || 0);
      }, 0) + 1;

      const nextTrialStage = createTrialStageLabel(nextStageIndex);
      const nextStages = sanitizeTrialStages([...currentStages, nextTrialStage]);

      writeStoredTrialStages(panelKey, nextStages);
      setActiveTrialByPanel((activePrev) => {
        const nextActive = {
          ...activePrev,
          [panelKey]: nextTrialStage,
        };
        writeStoredActiveTrial(panelKey, nextTrialStage);
        return nextActive;
      });

      return {
        ...prev,
        [panelKey]: nextStages,
      };
    });
  }, []);

  const handleRequestDeleteTrialStage = useCallback((panelKey: string) => {
    const stages = trialStagesByPanel[panelKey] || observedTrialStagesByPanel[panelKey] || ['T0'];
    const activeTrial = activeTrialByPanel[panelKey] || stages[0] || 'T0';
    const lastTrialStage = stages[stages.length - 1] || 'T0';

    if (stages.length <= 1) {
      setDeleteLimitMessage('至少保留一个轮次（T0）。');
      return;
    }

    if (activeTrial !== lastTrialStage) {
      setDeleteLimitMessage(`当前只允许删除最后轮次，请先切换到 ${lastTrialStage}。`);
      return;
    }

    setPendingDelete({ panelKey, stage: activeTrial });
  }, [activeTrialByPanel, observedTrialStagesByPanel, trialStagesByPanel]);

  const handleConfirmDeleteTrialStage = useCallback(() => {
    if (!pendingDelete) return;

    const { panelKey, stage } = pendingDelete;
    setPendingDelete(null);

    setTrialStagesByPanel((prev) => {
      const currentStages = prev[panelKey] || ['T0'];
      if (currentStages.length <= 1 || !currentStages.includes(stage)) {
        return prev;
      }

      const lastTrialStage = currentStages[currentStages.length - 1];
      if (stage !== lastTrialStage) {
        return prev;
      }

      const nextStages = sanitizeTrialStages(currentStages.filter((item) => item !== stage));
      const nextActiveTrial = nextStages[nextStages.length - 1] || 'T0';

      writeStoredTrialStages(panelKey, nextStages);
      writeStoredActiveTrial(panelKey, nextActiveTrial);
      setActiveTrialByPanel((activePrev) => ({
        ...activePrev,
        [panelKey]: nextActiveTrial,
      }));

      return {
        ...prev,
        [panelKey]: nextStages,
      };
    });
  }, [pendingDelete]);

  return (
    <>
      <AssetDrawerWorkspace
        panels={normalizedPanels}
        badgeLabel="Active Dimension Asset"
        hideBadgeLabel
        drawerTitle="尺寸数据看板"
        drawerDescription="选择模号并切换 T 轮次查看对应尺寸数据。"
        emptyMessage="暂无尺寸数据看板"
        icon={FileSpreadsheet}
        renderActiveContent={(panel) => {
          const panelKey = buildPanelKey(panel);
          const stages = trialStagesByPanel[panelKey] || observedTrialStagesByPanel[panelKey] || ['T0'];
          const activeTrial = activeTrialByPanel[panelKey] || stages[0] || 'T0';
          const lastTrialStage = stages[stages.length - 1] || 'T0';
          const canDeleteActiveTrial = stages.length > 1 && activeTrial === lastTrialStage;

          return (
            <div className="flex min-w-0 flex-col gap-2">
              <div className="text-[11px] font-mono tracking-[0.24em] text-slate-500">Active Dimension Asset</div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-bold tracking-wide text-slate-100">{panel.moldId}</span>
                <span className="text-xs font-mono text-slate-500">{panel.moldNo}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {stages.map((stage) => (
                  <button
                    key={`${panelKey}:${stage}`}
                    type="button"
                    onClick={() => handleSelectTrialStage(panelKey, stage)}
                    className={`rounded-md border px-4 py-1.5 text-xs font-mono transition-colors ${
                      stage === activeTrial
                        ? 'border-cyan-500/70 bg-cyan-500/15 text-cyan-300'
                        : 'border-slate-700 bg-slate-900 text-slate-500 hover:border-cyan-500/50 hover:text-cyan-200'
                    }`}
                  >
                    {stage}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddTrialStage(panelKey)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-mono text-cyan-300 transition-colors hover:border-cyan-500/60 hover:bg-cyan-500/10"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleRequestDeleteTrialStage(panelKey)}
                  className={`rounded-md border px-3 py-1.5 transition-colors ${
                    canDeleteActiveTrial
                      ? 'border-rose-800/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                      : 'cursor-not-allowed border-slate-800 bg-slate-900/70 text-slate-600'
                  }`}
                  disabled={!canDeleteActiveTrial}
                  title={canDeleteActiveTrial ? `删除当前轮次 ${activeTrial}` : `仅支持删除最后轮次 ${lastTrialStage}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        }}
        renderPanel={(panel) => {
          const panelKey = buildPanelKey(panel);
          const activeTrial = activeTrialByPanel[panelKey] || 'T0';

          return (
            <DimensionDataWorkspace
              moldId={panel.moldId}
              moldNo={panel.moldNo}
              trialStage={activeTrial}
            />
          );
        }}
      />

      <CyberConfirmDialog
        open={!!pendingDelete}
        title="删除轮次确认"
        message={pendingDelete ? `确定要删除当前 ${pendingDelete.stage} 轮次吗？删除后该轮次数据将被移除，此操作不可撤销。` : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDeleteTrialStage}
        confirmText="确认删除"
        cancelText="取消"
      />

      <CyberConfirmDialog
        open={!!deleteLimitMessage}
        title="删除受限"
        message={deleteLimitMessage || ''}
        onCancel={() => setDeleteLimitMessage(null)}
        onConfirm={() => setDeleteLimitMessage(null)}
        confirmText="我知道了"
        cancelText="关闭"
      />
    </>
  );
}
