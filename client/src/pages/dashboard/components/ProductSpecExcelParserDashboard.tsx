import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import {
  AlertTriangle,
  Archive,
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Columns3,
  Copy,
  FileImage,
  FileSpreadsheet,
  Layers3,
  Rows3,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { sanitizeEngineeringSpecLedgerRecords } from '@/lib/engineering-spec-ledger-clean';
import { deleteAssetViaServer, uploadAssetViaServer } from '@/lib/ossUpload';
import {
  createEngineeringSpecArchive,
  getEngineeringSpecArchiveDocumentState,
  listEngineeringSpecArchives,
  type EngineeringSpecArchiveState,
  type EngineeringSpecLedgerRecord,
} from '@/lib/engineering-spec-ledger-api';
import type { ProductSpecPreviewCell, ProductSpecWorkbookPreview } from '@/lib/product-spec-excel-parser';
import { parseProductSpecWorkbook } from '@/lib/product-spec-excel-parser';
import {
  fetchEngineeringSpecWorkspaceState,
  saveEngineeringSpecWorkspaceState,
  type EngineeringSpecWorkspaceField,
  type EngineeringSpecWorkspaceSection,
  type EngineeringSpecWorkspaceState,
} from '@/pages/dashboard/lib/engineering-spec-workspace-state-api';
import { EngineeringSpecAnalyticsDashboard } from './EngineeringSpecAnalyticsDashboard';
import { EngineeringSpecLedger } from './EngineeringSpecLedger';

type ViewKey = 'workspace' | 'analytics' | 'ledger';
type WorkspaceSyncState = 'idle' | 'loading' | 'restored' | 'saving' | 'saved' | 'error';
type WorkspaceOriginState =
  | { mode: 'draft'; label: string; detail?: string }
  | { mode: 'archive'; label: string; detail?: string };
type CellTextMap = Record<string, string>;

type BoundField = {
  label: string;
  cellId: string;
  value: string;
  multiline?: boolean;
};

type RowStatus = 'pass' | 'fail' | 'untested';

type PackagingMetric = {
  label: string;
  field: BoundField;
};

type SpecDocRow = {
  item: string;
  cellId: string;
  label: string;
  value: string;
  pending: boolean;
  status: RowStatus;
};

type SpecDocGroup = {
  label: string;
  rows: SpecDocRow[];
};

type SpecDocSection = {
  label: string;
  groups: SpecDocGroup[];
};

type SpecDocModel = {
  sourceFileName: string;
  imageSrc?: string;
  qeConclusion: string;
  header: {
    title: string;
    productType: BoundField;
    sku: BoundField;
    spu: BoundField;
    description: BoundField;
  };
  packaging: PackagingMetric[];
  businessMeta: BoundField[];
  sections: SpecDocSection[];
};

type WorkspaceMeta = {
  rowCount: number;
  columnCount: number;
};

type StatItem = {
  icon: LucideIcon;
  label: string;
  value: string;
};

type EvidenceSlot = {
  id: string;
  label: string;
  imageUrl?: string;
};

type EvidenceGalleryItem = {
  id: string;
  label: string;
  imageUrl: string;
};

const glassPanelClass =
  'border border-white/[0.06] bg-white/[0.03] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)]';

const navItems: Array<{
  key: ViewKey;
  label: string;
  sub: string;
  icon: LucideIcon;
}> = [
  { key: 'workspace', label: '规格书工作区', sub: '解析、展示与归档', icon: FileSpreadsheet },
  { key: 'analytics', label: '统计看板', sub: '周报汇总与分布', icon: Layers3 },
  { key: 'ledger', label: '登记台账', sub: '点击恢复归档现场', icon: ClipboardList },
];

const EVIDENCE_SLOT_COUNT = 4;
const MAX_EVIDENCE_SIZE_BYTES = 500 * 1024;

function createEmptyEvidenceSlots(): EvidenceSlot[] {
  return Array.from({ length: EVIDENCE_SLOT_COUNT }, (_, index) => ({
    id: `engineering-spec-evidence-${index + 1}`,
    label: `证据 ${index + 1}`,
  }));
}

async function compressEvidenceImage(file: File): Promise<File> {
  if (file.size <= MAX_EVIDENCE_SIZE_BYTES) return file;

  const compressionSteps = [
    { maxWidthOrHeight: 1920, initialQuality: 0.82 },
    { maxWidthOrHeight: 1680, initialQuality: 0.74 },
    { maxWidthOrHeight: 1440, initialQuality: 0.66 },
    { maxWidthOrHeight: 1280, initialQuality: 0.58 },
    { maxWidthOrHeight: 1080, initialQuality: 0.5 },
    { maxWidthOrHeight: 920, initialQuality: 0.42 },
    { maxWidthOrHeight: 760, initialQuality: 0.34 },
    { maxWidthOrHeight: 640, initialQuality: 0.28 },
  ];

  let compressed = file;
  for (const step of compressionSteps) {
    compressed = await imageCompression(compressed, {
      maxSizeMB: 0.47,
      maxWidthOrHeight: step.maxWidthOrHeight,
      useWebWorker: true,
      initialQuality: step.initialQuality,
      maxIteration: 20,
      fileType: 'image/webp',
    });

    if (compressed.size <= MAX_EVIDENCE_SIZE_BYTES) {
      return compressed;
    }
  }

  throw new Error('图片压缩后仍超过 500KB，请更换更小的图片。');
}

export default function ProductSpecExcelParserDashboard({
  projectName = '',
}: {
  projectName?: string;
}) {
  const [view, setView] = useState<ViewKey>('workspace');
  const [workspaceModel, setWorkspaceModel] = useState<SpecDocModel | null>(null);
  const [workspaceMeta, setWorkspaceMeta] = useState<WorkspaceMeta>({ rowCount: 0, columnCount: 0 });
  const [isParsing, setIsParsing] = useState(false);
  const [ledgerRecords, setLedgerRecords] = useState<EngineeringSpecLedgerRecord[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);
  const [evidenceSlots, setEvidenceSlots] = useState<EvidenceSlot[]>(() => createEmptyEvidenceSlots());
  const [qeConclusion, setQeConclusion] = useState('');
  const [pendingUploadSlotId, setPendingUploadSlotId] = useState<string | null>(null);
  const [lightboxSlotId, setLightboxSlotId] = useState<string | null>(null);
  const [isEvidenceDropActive, setIsEvidenceDropActive] = useState(false);
  const evidenceDropDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workspaceSyncState, setWorkspaceSyncState] = useState<WorkspaceSyncState>('idle');
  const [workspaceSyncMessage, setWorkspaceSyncMessage] = useState('未恢复工作区草稿');
  const [workspaceOrigin, setWorkspaceOrigin] = useState<WorkspaceOriginState>({
    mode: 'draft',
    label: '当前草稿',
    detail: '尚未导入规格书',
  });

  const projectId = projectName.trim() || 'default-engineering-spec-workspace';

  useEffect(() => {
    let cancelled = false;

    const loadLedger = async () => {
      setIsLoadingLedger(true);
      try {
        const documents = await listEngineeringSpecArchives(projectId);
        if (!cancelled) {
          setLedgerRecords(documents);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error('登记台账读取失败', {
            description: error instanceof Error ? error.message : '请检查 OSS 配置',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLedger(false);
        }
      }
    };

    void loadLedger();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      setWorkspaceSyncState('loading');
      setWorkspaceSyncMessage('正在恢复工作区草稿...');
      try {
        const state = await fetchEngineeringSpecWorkspaceState(projectId);
        if (cancelled) return;

        if (!state) {
          setWorkspaceSyncState('idle');
          setWorkspaceSyncMessage('未找到可恢复的工作区草稿');
          setWorkspaceOrigin({
            mode: 'draft',
            label: '当前草稿',
            detail: '尚未导入规格书',
          });
          return;
        }

        setWorkspaceModel(buildSpecDocModelFromWorkspaceState(state));
        setWorkspaceMeta({
          rowCount: Number(state.metadata?.rowCount) || 0,
          columnCount: Number(state.metadata?.columnCount) || 0,
        });
        setEvidenceSlots(buildEvidenceSlotsFromWorkspaceState(state));
        setQeConclusion(state.qeConclusion || '');
        setWorkspaceSyncState('restored');
        setWorkspaceSyncMessage(`已恢复草稿：${state.sourceFileName || '未命名规格书'}`);
        setWorkspaceOrigin({
          mode: 'draft',
          label: '当前草稿',
          detail: state.sourceFileName || '未命名规格书',
        });
      } catch (error) {
        if (!cancelled) {
          setWorkspaceSyncState('error');
          setWorkspaceSyncMessage('工作区恢复失败');
          toast.error('工作区恢复失败', {
            description: error instanceof Error ? error.message : '请稍后重试',
          });
        }
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const docModel = workspaceModel;

  useEffect(() => {
    if (!workspaceModel) return;

    setWorkspaceSyncState('saving');
    setWorkspaceSyncMessage('正在保存工作区草稿...');
    const timer = window.setTimeout(() => {
      void saveEngineeringSpecWorkspaceState(
        buildWorkspaceStatePayload(projectId, workspaceModel, workspaceMeta, evidenceSlots, qeConclusion),
      )
        .then(() => {
          setWorkspaceSyncState('saved');
          setWorkspaceSyncMessage('工作区草稿已保存');
        })
        .catch(() => {
          setWorkspaceSyncState('error');
          setWorkspaceSyncMessage('工作区保存失败');
        });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [projectId, qeConclusion, workspaceMeta, workspaceModel, evidenceSlots]);

  const sanitizedLedgerRecords = useMemo(
    () => sanitizeEngineeringSpecLedgerRecords(ledgerRecords),
    [ledgerRecords],
  );

  const quickFacts = useMemo(() => {
    if (!docModel) return [];

    return [
      { label: 'SKU', value: docModel.header.sku.value },
      { label: 'SPU', value: docModel.header.spu.value },
      { label: '产品类型', value: docModel.header.productType.value },
      { label: '海关编码', value: findFieldValue(docModel.businessMeta, '海关编码') },
      { label: '报关中文品名', value: findFieldValue(docModel.businessMeta, '报关中文品名') },
    ].filter((item) => item.value);
  }, [docModel]);

  const stats = useMemo<StatItem[]>(() => {
    if (!docModel) return [];

    return [
      { icon: Rows3, label: '行数', value: String(workspaceMeta.rowCount) },
      { icon: Columns3, label: '列数', value: String(workspaceMeta.columnCount) },
      { icon: Layers3, label: '区块', value: String(docModel.sections.length) },
      { icon: FileImage, label: '图片', value: String(evidenceSlots.filter((slot) => slot.imageUrl).length) },
      { icon: FileSpreadsheet, label: '包装项', value: String(docModel.packaging.length) },
      { icon: AlertTriangle, label: '待填项', value: String(countPendingRows(docModel.sections)) },
    ];
  }, [docModel, evidenceSlots, workspaceMeta]);

  const evidenceGalleryItems = useMemo<EvidenceGalleryItem[]>(
    () =>
      evidenceSlots
        .filter((slot) => slot.imageUrl)
        .map((slot) => ({
          id: slot.id,
          label: slot.label,
          imageUrl: slot.imageUrl as string,
        })),
    [evidenceSlots],
  );

  const evidenceLightboxIndex = useMemo(
    () => evidenceGalleryItems.findIndex((item) => item.id === lightboxSlotId),
    [evidenceGalleryItems, lightboxSlotId],
  );

  const lightboxImage =
    evidenceLightboxIndex >= 0 ? evidenceGalleryItems[evidenceLightboxIndex] : null;

  useEffect(() => {
    if (!lightboxImage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxSlotId(null);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateEvidenceLightbox(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateEvidenceLightbox(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, evidenceLightboxIndex, evidenceGalleryItems]);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;

    setIsParsing(true);
    try {
      const workbook = await parseProductSpecWorkbook(file);
      const cellTexts = Object.fromEntries(workbook.cells.map((cell) => [cell.id, cell.text])) as CellTextMap;
      setWorkspaceModel(buildSpecDocModel(workbook, cellTexts));
      setWorkspaceMeta({
        rowCount: workbook.metadata.rowCount,
        columnCount: workbook.metadata.columnCount,
      });
      setEvidenceSlots(createEmptyEvidenceSlots());
      setQeConclusion('');
      setLightboxSlotId(null);
      setView('workspace');
      setWorkspaceOrigin({
        mode: 'draft',
        label: '当前草稿',
        detail: workbook.fileName,
      });
      toast.success('规格书解析完成', {
        description: `${file.name} 已转换为可编辑的电子规格书。`,
      });
    } catch (error) {
      toast.error('规格书解析失败', {
        description: error instanceof Error ? error.message : '请确认上传的是标准 .xlsx 规格书模板。',
      });
    } finally {
      setIsParsing(false);
    }
  }

  function updateRowStatus(cellId: string, status: RowStatus) {
    if (workspaceOrigin.mode === 'archive') {
      setWorkspaceOrigin((current) => ({
        mode: 'draft',
        label: '当前草稿',
        detail: current.detail || '基于归档快照修改中',
      }));
    }
    setWorkspaceModel((current) => (current ? updateSpecDocModelRowStatus(current, cellId, status) : current));
  }

  async function handleCopySummary() {
    if (quickFacts.length === 0) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(quickFacts, null, 2));
      toast.success('摘要字段已复制');
    } catch {
      toast.error('复制失败，请稍后重试');
    }
  }

  async function handleArchive() {
    if (!docModel) return;

    try {
      const document = await createEngineeringSpecArchive({
        projectId,
        state: buildArchiveStateFromModel(docModel, evidenceSlots, qeConclusion),
      });
      setLedgerRecords((current) => [document, ...current.filter((item) => item.id !== document.id)]);
      setView('ledger');
      toast.success('规格书已归档到 OSS', {
        description: `${document.sku} 已写入远端登记台账。`,
      });
    } catch (error) {
      toast.error('归档入库失败', {
        description: error instanceof Error ? error.message : '请检查 OSS 配置与网络状态',
      });
    }
  }

  async function uploadEvidenceFileToSlot(slotId: string, file?: File, showToast = true): Promise<boolean> {
    if (!file || !docModel) return false;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return false;
    }

    try {
      const processedFile = await compressEvidenceImage(file);
      const uploadResult = await uploadAssetViaServer({
        file: processedFile,
        category: 'engineering-spec-evidence',
        entityId: `${projectId}-${docModel.header.sku.value || 'draft'}`,
        slot: slotId,
      });

      let previousUrl = '';
      setEvidenceSlots((current) =>
        current.map((slot) => {
          if (slot.id !== slotId) return slot;
          previousUrl = slot.imageUrl || '';
          return { ...slot, imageUrl: uploadResult.url };
        }),
      );

      if (previousUrl && previousUrl !== uploadResult.url && !previousUrl.startsWith('blob:')) {
        void deleteAssetViaServer(previousUrl).catch(() => undefined);
      }

      if (showToast) {
        toast.success('图片已上传至 OSS');
      }
      return true;
    } catch (error) {
      toast.error('图片上传失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
      return false;
    }
  }

  async function handleEvidenceFilesUpload(files: File[] | FileList, startSlotId?: string) {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('请拖拽或选择图片文件');
      return;
    }

    const startIndex = startSlotId
      ? Math.max(0, evidenceSlots.findIndex((slot) => slot.id === startSlotId))
      : evidenceSlots.findIndex((slot) => !slot.imageUrl);
    const candidateSlots = startIndex >= 0 ? evidenceSlots.slice(startIndex) : evidenceSlots;
    const targetSlots = candidateSlots.filter((slot) => !slot.imageUrl);

    if (targetSlots.length === 0) {
      toast.warning('图片位已满', {
        description: '没有可用空位，请先删除一张图片。',
      });
      return;
    }

    const uploadPairs = imageFiles
      .slice(0, targetSlots.length)
      .map((file, index) => ({ file, slotId: targetSlots[index]?.id }))
      .filter((pair): pair is { file: File; slotId: string } => Boolean(pair.slotId));

    let successCount = 0;
    let failCount = 0;
    let lastUploadedSlotId: string | null = null;

    for (const pair of uploadPairs) {
      const ok = await uploadEvidenceFileToSlot(pair.slotId, pair.file, false);
      if (ok) {
        successCount += 1;
        lastUploadedSlotId = pair.slotId;
      } else {
        failCount += 1;
      }
    }

    if (lastUploadedSlotId) {
      setLightboxSlotId(lastUploadedSlotId);
    }

    if (successCount > 0) {
      toast.success(successCount === 1 ? '1 张图片已上传至 OSS' : `${successCount} 张图片已上传至 OSS`);
    }
    if (failCount > 0) {
      toast.error('部分图片上传失败', {
        description: `成功 ${successCount} 张，失败 ${failCount} 张。`,
      });
    }
  }

  async function handleEvidenceDelete(slotId: string) {
    let deletedUrl = '';
    let deletedLabel = '';

    setEvidenceSlots((current) =>
      current.map((slot) => {
        if (slot.id !== slotId) return slot;
        deletedUrl = slot.imageUrl || '';
        deletedLabel = slot.label;
        return { ...slot, imageUrl: undefined };
      }),
    );

    if (lightboxImage?.imageUrl === deletedUrl) {
      const remaining = evidenceGalleryItems.filter((item) => item.id !== slotId);
      setLightboxSlotId(remaining[0]?.id || null);
    }

    if (deletedUrl && !deletedUrl.startsWith('blob:')) {
      await deleteAssetViaServer(deletedUrl).catch(() => undefined);
    }

    if (deletedUrl) {
      toast.success(`${deletedLabel} 已删除`);
    }
  }

  function handleSlotPick(slotId: string) {
    setPendingUploadSlotId(slotId);
    fileInputRef.current?.click();
  }

  function navigateEvidenceLightbox(direction: -1 | 1) {
    if (evidenceGalleryItems.length <= 1 || evidenceLightboxIndex < 0) return;
    const nextIndex =
      (evidenceLightboxIndex + direction + evidenceGalleryItems.length) % evidenceGalleryItems.length;
    setLightboxSlotId(evidenceGalleryItems[nextIndex]?.id || null);
  }

  function handleEvidenceDragEnter(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    evidenceDropDepthRef.current += 1;
    setIsEvidenceDropActive(true);
  }

  function handleEvidenceDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleEvidenceDragLeave(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    evidenceDropDepthRef.current = Math.max(0, evidenceDropDepthRef.current - 1);
    if (evidenceDropDepthRef.current === 0) {
      setIsEvidenceDropActive(false);
    }
  }

  function handleEvidenceDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    evidenceDropDepthRef.current = 0;
    setIsEvidenceDropActive(false);
    const preferredSlotId = evidenceSlots.find((slot) => !slot.imageUrl)?.id;
    void handleEvidenceFilesUpload(event.dataTransfer.files, pendingUploadSlotId || preferredSlotId);
    setPendingUploadSlotId(null);
  }

  async function handleSelectArchiveRecord(record: EngineeringSpecLedgerRecord) {
    try {
      const snapshot = await getEngineeringSpecArchiveDocumentState({
        projectId,
        documentId: record.id,
      });
      setWorkspaceModel(buildSpecDocModelFromArchiveState(snapshot.state));
      setWorkspaceMeta(buildWorkspaceMetaFromArchiveState(snapshot.state));
      setEvidenceSlots(buildEvidenceSlotsFromArchiveState(snapshot.state));
      setQeConclusion(snapshot.state.qeConclusion || '');
      setLightboxSlotId(null);
      setView('workspace');
      setWorkspaceSyncState('restored');
      setWorkspaceSyncMessage(`已恢复归档：${snapshot.document.sku || '未命名规格书'}`);
      setWorkspaceOrigin({
        mode: 'archive',
        label: '归档快照',
        detail: `${snapshot.document.sku || '未命名规格书'} · ${formatWorkspaceOriginTime(snapshot.document.createdAt)}`,
      });
      toast.success('已恢复归档工作区', {
        description: `${snapshot.document.sku || '当前归档'} 已恢复到工作区。`,
      });
    } catch (error) {
      toast.error('归档恢复失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    }
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#050505] text-[#E2E8F0] shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.06),transparent_22%),linear-gradient(180deg,#050505,#0a0a0a)]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#94A3B8]">Enterprise Spec Workspace</p>
              <h1 className="mt-1 text-base font-semibold tracking-[0.02em] text-[#E2E8F0]">
                高密度电子化产品规格书
              </h1>
              <p className="mt-1 text-[13px] leading-6 text-[#94A3B8]">
                当前模块通过 OSS 归档规格书数据，刷新恢复当前草稿，点击台账可直接恢复到存档时的现场。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`inline-flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 transition ${
                  isParsing ? 'opacity-70' : 'hover:bg-white/[0.04]'
                } ${glassPanelClass}`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200">
                  <UploadCloud className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#E2E8F0]">
                    {isParsing ? '正在解析规格书...' : '上传规格书 Excel'}
                  </p>
                  <p className="text-[11px] text-[#94A3B8]">导入后自动转换为桌面电子规格版</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(event) => {
                    void handleFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => void handleArchive()}
                disabled={!docModel}
                className={`inline-flex items-center gap-3 rounded-xl px-4 py-2.5 transition ${
                  docModel ? 'hover:bg-white/[0.04]' : 'cursor-not-allowed opacity-40'
                } ${glassPanelClass}`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-200">
                  <Archive className="h-4.5 w-4.5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-[#E2E8F0]">归档入库</p>
                  <p className="text-[11px] text-[#94A3B8]">写入 OSS 台账</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-white/[0.06] px-5 py-2.5">
          <WorkspaceSyncBanner state={workspaceSyncState} message={workspaceSyncMessage} />
        </div>

        <div className="border-b border-white/[0.06] px-5 py-2.5">
          <WorkspaceOriginBanner origin={workspaceOrigin} />
        </div>

        <div className="space-y-4 p-4">
          <div className={`rounded-[18px] p-3 ${glassPanelClass}`}>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-[220px_220px_220px]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = view === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setView(item.key)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      isActive
                        ? 'border-cyan-400/30 bg-cyan-400/10 text-slate-100'
                        : 'border-white/[0.05] bg-black/15 text-slate-400 hover:border-white/[0.08] hover:text-slate-200'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        isActive ? 'bg-cyan-400/15 text-cyan-200' : 'bg-white/[0.04] text-slate-500'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="mt-0.5 text-[11px] text-[#94A3B8]">{item.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <main className="min-w-0">
            {view === 'analytics' ? (
              <EngineeringSpecAnalyticsDashboard archives={sanitizedLedgerRecords} />
            ) : view === 'ledger' ? (
              <EngineeringSpecLedger
                records={sanitizedLedgerRecords}
                isLoading={isLoadingLedger}
                onSelectRecord={(record) => void handleSelectArchiveRecord(record)}
              />
            ) : docModel ? (
              <ElectronicSpecDocument
                model={docModel}
                onStatusChange={updateRowStatus}
                quickFacts={quickFacts}
                onCopySummary={handleCopySummary}
                stats={stats}
                qeConclusion={qeConclusion}
                onQeConclusionChange={setQeConclusion}
                evidenceSlots={evidenceSlots}
                onSlotPick={handleSlotPick}
                onSlotDelete={handleEvidenceDelete}
                onSlotPreview={(slot) => slot.imageUrl && setLightboxSlotId(slot.id)}
                isEvidenceDropActive={isEvidenceDropActive}
                onEvidenceDragEnter={handleEvidenceDragEnter}
                onEvidenceDragOver={handleEvidenceDragOver}
                onEvidenceDragLeave={handleEvidenceDragLeave}
                onEvidenceDrop={handleEvidenceDrop}
              />
            ) : (
              <div className={`flex min-h-[760px] items-center justify-center rounded-[18px] px-6 text-center ${glassPanelClass}`}>
                <div className="max-w-xl">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-slate-300">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-[#E2E8F0]">等待规格书导入</h2>
                  <p className="mt-2 text-[13px] leading-6 text-[#94A3B8]">
                    导入后可在当前工作区编辑规格书、上传四宫格图片，并通过台账恢复归档现场。
                  </p>
                </div>
              </div>
            )}

            {view === 'ledger' && isLoadingLedger ? (
              <div className="mt-3 text-xs text-[#94A3B8]">正在读取 OSS 台账...</div>
            ) : null}
          </main>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 1) {
            void handleEvidenceFilesUpload(files, pendingUploadSlotId || evidenceSlots[0]?.id || '');
          } else {
            void uploadEvidenceFileToSlot(pendingUploadSlotId || evidenceSlots[0]?.id || '', files?.[0]);
          }
          event.target.value = '';
          setPendingUploadSlotId(null);
        }}
      />

      {lightboxImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 p-6 backdrop-blur-md"
          onClick={() => setLightboxSlotId(null)}
        >
          <div
            className="max-w-[90vw] rounded-2xl border border-white/[0.08] bg-slate-950/95 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium text-slate-200">{lightboxImage.label}</p>
                <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[11px] text-slate-400">
                  {evidenceLightboxIndex + 1}/{evidenceGalleryItems.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateEvidenceLightbox(-1)}
                  disabled={evidenceGalleryItems.length <= 1}
                  className="rounded-full border border-white/[0.08] p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateEvidenceLightbox(1)}
                  disabled={evidenceGalleryItems.length <= 1}
                  className="rounded-full border border-white/[0.08] p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxSlotId(null)}
                  className="rounded-full border border-white/[0.08] p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <img
              src={lightboxImage.imageUrl}
              alt={lightboxImage.label}
              className="max-h-[80vh] max-w-[86vw] rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ElectronicSpecDocument({
  model,
  onStatusChange,
  quickFacts,
  onCopySummary,
  stats,
  qeConclusion,
  onQeConclusionChange,
  evidenceSlots,
  onSlotPick,
  onSlotDelete,
  onSlotPreview,
  isEvidenceDropActive,
  onEvidenceDragEnter,
  onEvidenceDragOver,
  onEvidenceDragLeave,
  onEvidenceDrop,
}: {
  model: SpecDocModel;
  onStatusChange: (cellId: string, status: RowStatus) => void;
  quickFacts: Array<{ label: string; value: string }>;
  onCopySummary: () => void;
  stats: StatItem[];
  qeConclusion: string;
  onQeConclusionChange: (value: string) => void;
  evidenceSlots: EvidenceSlot[];
  onSlotPick: (slotId: string) => void;
  onSlotDelete: (slotId: string) => void;
  onSlotPreview: (slot: EvidenceSlot) => void;
  isEvidenceDropActive: boolean;
  onEvidenceDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  onEvidenceDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onEvidenceDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onEvidenceDrop: (event: React.DragEvent<HTMLElement>) => void;
}) {
  return (
    <div className="space-y-4">
      <HeaderCard
        model={model}
        quickFacts={quickFacts}
        onCopySummary={onCopySummary}
        stats={stats}
      />
      <MetaGridCard packaging={model.packaging} businessMeta={model.businessMeta} />
      <div className="space-y-4">
        {model.sections.map((section) => (
          <SpecSectionCard key={section.label} section={section} onStatusChange={onStatusChange} />
        ))}
      </div>
      <EvidenceGridCard
        slots={evidenceSlots}
        onSlotPick={onSlotPick}
        onSlotDelete={onSlotDelete}
        onSlotPreview={onSlotPreview}
        isEvidenceDropActive={isEvidenceDropActive}
        onEvidenceDragEnter={onEvidenceDragEnter}
        onEvidenceDragOver={onEvidenceDragOver}
        onEvidenceDragLeave={onEvidenceDragLeave}
        onEvidenceDrop={onEvidenceDrop}
      />
      <QeConclusionCard value={qeConclusion} onChange={onQeConclusionChange} />
    </div>
  );
}

function HeaderCard({
  model,
  quickFacts,
  onCopySummary,
  stats,
}: {
  model: SpecDocModel;
  quickFacts: Array<{ label: string; value: string }>;
  onCopySummary: () => void;
  stats: StatItem[];
}) {
  return (
    <section className={`rounded-[18px] px-4 py-4 ${glassPanelClass}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#94A3B8]">Header</p>
          <h2 className="mt-0.5 text-base font-semibold text-[#E2E8F0]">{model.header.title}</h2>
        </div>
        {quickFacts.length > 0 ? (
          <button
            type="button"
            onClick={() => void onCopySummary()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-[#94A3B8] transition hover:bg-white/[0.05]"
          >
            <Copy className="h-3.5 w-3.5" />
            复制摘要
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
          {model.imageSrc ? (
            <div className="relative aspect-[4/4.2] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_68%)]">
              <img src={model.imageSrc} alt="产品图片" className="h-full w-full object-contain p-5" />
            </div>
          ) : (
            <div className="flex aspect-[4/4.2] items-center justify-center text-[13px] text-[#94A3B8]">
              暂无产品图片
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid gap-x-3 gap-y-2 md:grid-cols-2 xl:grid-cols-4">
            <CompactField field={model.header.sku} />
            <CompactField field={model.header.spu} />
            <CompactField field={model.header.productType} className="xl:col-span-2" multiline />
            <CompactField field={model.header.description} className="md:col-span-2 xl:col-span-4" multiline />
          </div>

          {quickFacts.length > 0 || stats.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="border border-white/[0.05] bg-black/15 px-3 py-2.5">
                <div className="mb-2">
                  <p className="text-sm font-medium text-[#E2E8F0]">摘要字段</p>
                  <p className="text-[11px] text-[#94A3B8]">关键字段快速核对</p>
                </div>
                <div className="grid gap-x-4 gap-y-2 md:grid-cols-2">
                  {quickFacts.map((fact) => (
                    <div key={fact.label} className="border-b border-white/[0.05] py-1 last:border-b-0">
                      <p className="text-[11px] text-[#94A3B8]">{fact.label}</p>
                      <p className="mt-0.5 break-all text-[13px] leading-5 text-[#E2E8F0]">{fact.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-white/[0.05] bg-black/15 px-3 py-2.5">
                <div className="mb-2">
                  <p className="text-sm font-medium text-[#E2E8F0]">结构统计</p>
                  <p className="text-[11px] text-[#94A3B8]">模板解析结果</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {stats.map((stat) => (
                    <MetricCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MetaGridCard({
  packaging,
  businessMeta,
}: {
  packaging: PackagingMetric[];
  businessMeta: BoundField[];
}) {
  const cells: Array<{ label: string; field: BoundField }> = [
    ...packaging,
    ...businessMeta.map((field) => ({ label: field.label, field })),
  ];

  return (
    <section className={`rounded-[18px] px-4 py-4 ${glassPanelClass}`}>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-[#E2E8F0]">包装与业务信息</h2>
        <p className="text-[11px] text-[#94A3B8]">紧凑式元数据网格</p>
      </div>

      <div className="grid gap-x-3 gap-y-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        {cells.map((cell) => (
          <CompactField
            key={cell.field.cellId}
            field={{ ...cell.field, label: cell.label }}
            multiline={cell.field.multiline}
          />
        ))}
      </div>
    </section>
  );
}

function SpecSectionCard({
  section,
  onStatusChange,
}: {
  section: SpecDocSection;
  onStatusChange: (cellId: string, status: RowStatus) => void;
}) {
  return (
    <section className={`rounded-[18px] px-4 py-4 ${glassPanelClass}`}>
      <div className="mb-3 border-b border-white/[0.06] pb-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#E2E8F0]">{section.label}</h2>
          <span className="text-[11px] uppercase tracking-[0.22em] text-[#94A3B8]">
            {section.groups.reduce((sum, group) => sum + group.rows.length, 0)} Rows
          </span>
        </div>
        <div className="mt-2 h-px bg-gradient-to-r from-cyan-400/40 via-white/[0.08] to-transparent" />
      </div>

      <div className="space-y-1">
        {section.groups.map((group) => (
          <SpecGroupBlock key={`${section.label}-${group.label}`} group={group} onStatusChange={onStatusChange} />
        ))}
      </div>
    </section>
  );
}

function SpecGroupBlock({
  group,
  onStatusChange,
}: {
  group: SpecDocGroup;
  onStatusChange: (cellId: string, status: RowStatus) => void;
}) {
  const summary = summarizeGroupStatuses(group.rows);

  return (
    <div className="flex border-b border-white/[0.05] last:border-b-0">
      <div className="w-28 shrink-0 px-2 py-2 text-[13px] font-medium leading-6 text-[#94A3B8]">
        <div>{group.label}</div>
        <div className="mt-2 space-y-1 text-[11px] font-normal leading-4 text-[#64748B]">
          <div>{summary.pass} Pass</div>
          <div>{summary.fail} Fail</div>
          <div>{summary.untested} 未测试</div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {group.rows.map((row, index) => (
          <div
            key={row.cellId}
            className={`grid min-h-[36px] grid-cols-[40px_220px_minmax(0,1fr)_220px] items-start gap-3 px-2 py-1.5 text-[13px] leading-6 hover:bg-white/[0.03] ${
              index < group.rows.length - 1 ? 'border-b border-white/[0.05]' : ''
            }`}
          >
            <div className="pt-0.5 text-[#94A3B8]">{row.item}</div>
            <div className="pt-0.5 text-[#94A3B8]">{row.label || '确认项目'}</div>
            <div className={row.pending ? 'border-l-2 border-[#EAB308] pl-3' : ''}>
              <div
                className={`whitespace-pre-wrap break-words py-0 text-[13px] leading-6 ${
                  row.pending ? 'text-[#FDE047]' : 'text-[#E2E8F0]'
                }`}
              >
                {row.value || '—'}
              </div>
            </div>
            <div className="flex items-start justify-end">
              <RowStatusSelector
                value={row.status}
                onChange={(status) => onStatusChange(row.cellId, status)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceGridCard({
  slots,
  onSlotPick,
  onSlotDelete,
  onSlotPreview,
  isEvidenceDropActive,
  onEvidenceDragEnter,
  onEvidenceDragOver,
  onEvidenceDragLeave,
  onEvidenceDrop,
}: {
  slots: EvidenceSlot[];
  onSlotPick: (slotId: string) => void;
  onSlotDelete: (slotId: string) => void;
  onSlotPreview: (slot: EvidenceSlot) => void;
  isEvidenceDropActive: boolean;
  onEvidenceDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  onEvidenceDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onEvidenceDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onEvidenceDrop: (event: React.DragEvent<HTMLElement>) => void;
}) {
  return (
    <section
      className={`relative rounded-[18px] px-4 py-4 ${glassPanelClass} ${
        isEvidenceDropActive ? 'border-cyan-400/35 bg-cyan-400/[0.04]' : ''
      }`}
      onDragEnter={onEvidenceDragEnter}
      onDragOver={onEvidenceDragOver}
      onDragLeave={onEvidenceDragLeave}
      onDrop={onEvidenceDrop}
    >
      {isEvidenceDropActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[18px] border-2 border-dashed border-cyan-400/35 bg-slate-950/70">
          <div className="rounded-2xl border border-cyan-400/25 bg-slate-950/90 px-5 py-3 text-sm font-medium text-cyan-100">
            松开即可批量上传图片，最多自动填满四格
          </div>
        </div>
      ) : null}

      <div className="mb-3">
        <h2 className="text-base font-semibold text-[#E2E8F0]">规格书证据图片区</h2>
        <p className="text-[11px] text-[#94A3B8]">四宫格上传机制，直接沿用试模数据库的 OSS 图片处理方式</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {slots.map((slot) => (
          <div key={slot.id} className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
            <div
              className={`relative aspect-square ${slot.imageUrl ? 'cursor-pointer' : ''}`}
              onClick={() => slot.imageUrl && onSlotPreview(slot)}
            >
              {slot.imageUrl ? (
                <img src={slot.imageUrl} alt={slot.label} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#94A3B8]">
                  <Camera className="h-5 w-5" />
                  <span className="text-[11px] uppercase tracking-[0.18em]">空图片位</span>
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.05] px-3 py-2">
              <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-[#94A3B8]">{slot.label}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSlotPick(slot.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-slate-300 transition hover:bg-white/[0.05]"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  上传
                </button>
                <button
                  type="button"
                  onClick={() => void onSlotDelete(slot.id)}
                  disabled={!slot.imageUrl}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] transition ${
                    slot.imageUrl
                      ? 'border-white/[0.08] text-slate-300 hover:bg-white/[0.05]'
                      : 'cursor-not-allowed border-white/[0.04] text-slate-600 opacity-60'
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function QeConclusionCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className={`rounded-[18px] px-4 py-4 ${glassPanelClass}`}>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-[#E2E8F0]">QE测试结论</h2>
        <p className="text-[11px] text-[#94A3B8]">填写本次 QE 测试的结论说明，该内容会跟随草稿保存与归档恢复。</p>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[140px] w-full resize-y rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-[13px] leading-7 text-[#E2E8F0] outline-none transition focus:border-cyan-400/35 focus:bg-black/30"
        placeholder="请输入 QE 测试结论..."
      />
    </section>
  );
}

function CompactField({
  field,
  className = '',
  multiline,
}: {
  field: BoundField;
  className?: string;
  multiline?: boolean;
}) {
  return (
    <div className={`min-w-0 border-b border-white/[0.05] px-1 py-1.5 ${className}`}>
      <p className="truncate text-[11px] text-[#94A3B8]">{field.label}</p>
      {multiline ? (
        <div className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-6 text-[#E2E8F0]">
          {field.value || '—'}
        </div>
      ) : (
        <div className="mt-1 break-words text-[13px] leading-6 text-[#E2E8F0]">
          {field.value || '—'}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-white/[0.05] px-3 py-2">
      <div className="flex items-center gap-2 text-[#94A3B8]">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="mt-1 text-[13px] leading-5 text-[#E2E8F0]">{value}</p>
    </div>
  );
}

function RowStatusSelector({
  value,
  onChange,
}: {
  value: RowStatus;
  onChange: (status: RowStatus) => void;
}) {
  const options: Array<{
    key: RowStatus;
    label: string;
    activeClass: string;
  }> = [
    {
      key: 'pass',
      label: 'Pass',
      activeClass:
        'border-emerald-500/45 bg-[linear-gradient(180deg,rgba(4,120,87,0.42),rgba(3,84,63,0.72))] text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(6,95,70,0.35)]',
    },
    {
      key: 'fail',
      label: 'Fail',
      activeClass:
        'border-rose-500/45 bg-[linear-gradient(180deg,rgba(159,18,57,0.42),rgba(127,29,29,0.76))] text-rose-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(127,29,29,0.35)]',
    },
    {
      key: 'untested',
      label: '未测试',
      activeClass:
        'border-slate-300/18 bg-[linear-gradient(180deg,rgba(51,65,85,0.48),rgba(30,41,59,0.78))] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
    },
  ];

  return (
    <div className="inline-flex rounded-xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,23,42,0.68),rgba(2,6,23,0.86))] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
              active
                ? option.activeClass
                : 'border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function WorkspaceSyncBanner({
  state,
  message,
}: {
  state: WorkspaceSyncState;
  message: string;
}) {
  const tone =
    state === 'error'
      ? 'border-rose-500/20 bg-rose-500/[0.06] text-rose-200'
      : state === 'saving' || state === 'loading'
        ? 'border-amber-400/20 bg-amber-400/[0.06] text-amber-200'
        : state === 'saved' || state === 'restored'
          ? 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200'
          : 'border-white/[0.06] bg-white/[0.03] text-[#94A3B8]';

  const dotTone =
    state === 'error'
      ? 'bg-rose-300'
      : state === 'saving' || state === 'loading'
        ? 'bg-amber-300'
        : state === 'saved' || state === 'restored'
          ? 'bg-emerald-300'
          : 'bg-slate-500';

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-[12px] ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${dotTone}`} />
      <span>{message}</span>
    </div>
  );
}

function WorkspaceOriginBanner({
  origin,
}: {
  origin: WorkspaceOriginState;
}) {
  const tone =
    origin.mode === 'archive'
      ? 'border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-200'
      : 'border-white/[0.06] bg-white/[0.03] text-[#94A3B8]';

  const dotTone = origin.mode === 'archive' ? 'bg-cyan-300' : 'bg-slate-500';

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-[12px] ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${dotTone}`} />
      <span className="font-medium">{origin.label}</span>
      {origin.detail ? <span className="opacity-80">{origin.detail}</span> : null}
    </div>
  );
}

function buildSpecDocModelFromWorkspaceState(state: EngineeringSpecWorkspaceState): SpecDocModel {
  return {
    sourceFileName: state.sourceFileName || '未命名规格书.xlsx',
    imageSrc: state.imageSrc,
    qeConclusion: state.qeConclusion || '',
    header: {
      title: String(state.header?.title || '产品规格资料'),
      productType: {
        label: String(state.header?.productType?.label || '产品类型'),
        cellId: 'workspace-header-product-type',
        value: String(state.header?.productType?.value || ''),
        multiline: Boolean(state.header?.productType?.multiline),
      },
      sku: {
        label: String(state.header?.sku?.label || '产品编号 (SKU)'),
        cellId: 'workspace-header-sku',
        value: String(state.header?.sku?.value || ''),
      },
      spu: {
        label: String(state.header?.spu?.label || '产品编码 (SPU)'),
        cellId: 'workspace-header-spu',
        value: String(state.header?.spu?.value || ''),
      },
      description: {
        label: String(state.header?.description?.label || '规格描述'),
        cellId: 'workspace-header-description',
        value: String(state.header?.description?.value || ''),
        multiline: true,
      },
    },
    packaging: Array.isArray(state.packaging)
      ? state.packaging.map((item, index) => ({
          label: String(item?.label || `包装项 ${index + 1}`),
          field: {
            label: String(item?.label || `包装项 ${index + 1}`),
            cellId: `workspace-packaging-${index + 1}`,
            value: String(item?.value || ''),
          },
        }))
      : [],
    businessMeta: Array.isArray(state.businessMeta)
      ? state.businessMeta.map((item, index) => ({
          label: String(item?.label || `业务字段 ${index + 1}`),
          cellId: `workspace-meta-${index + 1}`,
          value: String(item?.value || ''),
          multiline: Boolean(item?.multiline),
        }))
      : [],
    sections: mapWorkspaceSectionsToSpecSections(state.sections),
  };
}

function buildSpecDocModelFromArchiveState(state: EngineeringSpecArchiveState): SpecDocModel {
  return {
    sourceFileName: state.fileName || '已归档规格书.xlsx',
    imageSrc: state.imageUrl,
    qeConclusion: state.qeConclusion || '',
    header: {
      title: '产品规格资料',
      productType: {
        label: '产品类型',
        cellId: 'archive-header-product-type',
        value: state.productInfo?.type || '',
        multiline: true,
      },
      sku: {
        label: '产品编号 (SKU)',
        cellId: 'archive-header-sku',
        value: state.productInfo?.sku || '',
      },
      spu: {
        label: '产品编码 (SPU)',
        cellId: 'archive-header-spu',
        value: state.productInfo?.spu || '',
      },
      description: {
        label: '规格描述',
        cellId: 'archive-header-description',
        value: state.productInfo?.description || '',
        multiline: true,
      },
    },
    packaging: Array.isArray(state.packaging)
      ? state.packaging.map((item, index) => ({
          label: String(item?.label || `包装项 ${index + 1}`),
          field: {
            label: String(item?.label || `包装项 ${index + 1}`),
            cellId: `archive-packaging-${index + 1}`,
            value: String(item?.value || ''),
          },
        }))
      : [],
    businessMeta: Array.isArray(state.businessMeta)
      ? state.businessMeta.map((item, index) => ({
          label: String(item?.label || `业务字段 ${index + 1}`),
          cellId: `archive-meta-${index + 1}`,
          value: String(item?.value || ''),
          multiline: false,
        }))
      : [],
    sections: mapArchiveSectionsToSpecSections(state.sections),
  };
}

function mapWorkspaceSectionsToSpecSections(
  sections: EngineeringSpecWorkspaceState['sections'],
): SpecDocSection[] {
  if (!Array.isArray(sections)) return [];
  return sections.map((section, sectionIndex) => ({
    label: String(section?.label || `区块 ${sectionIndex + 1}`),
    groups: Array.isArray(section?.groups)
      ? section.groups.map((group, groupIndex) => ({
          label: String(group?.label || `分组 ${groupIndex + 1}`),
          rows: Array.isArray(group?.rows)
            ? group.rows.map((row, rowIndex) => ({
                item: String(row?.item || rowIndex + 1),
                cellId: `workspace-section-${sectionIndex + 1}-${groupIndex + 1}-${rowIndex + 1}`,
                label: String(row?.label || ''),
                value: String(row?.value || ''),
                pending: Boolean(row?.pending),
                status: row?.status === 'pass' || row?.status === 'fail' ? row.status : 'untested',
              }))
            : [],
        }))
      : [],
  }));
}

function mapArchiveSectionsToSpecSections(
  sections: EngineeringSpecArchiveState['sections'],
): SpecDocSection[] {
  if (!Array.isArray(sections)) return [];
  return sections.map((section, sectionIndex) => ({
    label: String(section?.label || `区块 ${sectionIndex + 1}`),
    groups: Array.isArray(section?.groups)
      ? section.groups.map((group, groupIndex) => ({
          label: String(group?.label || `分组 ${groupIndex + 1}`),
          rows: Array.isArray(group?.rows)
            ? group.rows.map((row, rowIndex) => ({
                item: String(row?.item || rowIndex + 1),
                cellId: `archive-section-${sectionIndex + 1}-${groupIndex + 1}-${rowIndex + 1}`,
                label: String(row?.label || ''),
                value: String(row?.value || ''),
                pending: Boolean(row?.pending),
                status: row?.status === 'pass' || row?.status === 'fail' ? row.status : 'untested',
              }))
            : [],
        }))
      : [],
  }));
}

function buildEvidenceSlotsFromWorkspaceState(state: EngineeringSpecWorkspaceState): EvidenceSlot[] {
  if (!Array.isArray(state.evidenceSlots) || state.evidenceSlots.length === 0) {
    return createEmptyEvidenceSlots();
  }

  const normalized: EvidenceSlot[] = state.evidenceSlots.slice(0, EVIDENCE_SLOT_COUNT).map((slot, index) => ({
    id: slot.id || `engineering-spec-evidence-${index + 1}`,
    label: slot.label || `证据 ${index + 1}`,
    imageUrl: slot.imageUrl,
  }));
  while (normalized.length < EVIDENCE_SLOT_COUNT) {
    normalized.push({
      id: `engineering-spec-evidence-${normalized.length + 1}`,
      label: `证据 ${normalized.length + 1}`,
    });
  }
  return normalized;
}

function buildEvidenceSlotsFromArchiveState(state: EngineeringSpecArchiveState): EvidenceSlot[] {
  const slots = createEmptyEvidenceSlots();
  const images = Array.isArray(state.images) ? state.images.slice(0, EVIDENCE_SLOT_COUNT) : [];
  return slots.map((slot, index) => ({
    ...slot,
    label: images[index]?.label || slot.label,
    imageUrl: images[index]?.url,
  }));
}

function buildWorkspaceMetaFromArchiveState(state: EngineeringSpecArchiveState): WorkspaceMeta {
  const rowCount = (state.sections || []).reduce(
    (sectionTotal, section) =>
      sectionTotal +
      (section.groups || []).reduce((groupTotal, group) => groupTotal + (group.rows || []).length, 0),
    0,
  );
  return {
    rowCount,
    columnCount: 9,
  };
}

function updateSpecDocModelField(model: SpecDocModel, cellId: string, value: string): SpecDocModel {
  if (model.header.productType.cellId === cellId) {
    return { ...model, header: { ...model.header, productType: { ...model.header.productType, value } } };
  }
  if (model.header.sku.cellId === cellId) {
    return { ...model, header: { ...model.header, sku: { ...model.header.sku, value } } };
  }
  if (model.header.spu.cellId === cellId) {
    return { ...model, header: { ...model.header, spu: { ...model.header.spu, value } } };
  }
  if (model.header.description.cellId === cellId) {
    return { ...model, header: { ...model.header, description: { ...model.header.description, value } } };
  }

  return {
    ...model,
    packaging: model.packaging.map((item) =>
      item.field.cellId === cellId ? { ...item, field: { ...item.field, value } } : item,
    ),
    businessMeta: model.businessMeta.map((item) =>
      item.cellId === cellId ? { ...item, value } : item,
    ),
    sections: model.sections.map((section) => ({
      ...section,
      groups: section.groups.map((group) => ({
        ...group,
        rows: group.rows.map((row) => (row.cellId === cellId ? { ...row, value } : row)),
      })),
    })),
  };
}

function updateSpecDocModelRowStatus(
  model: SpecDocModel,
  cellId: string,
  status: RowStatus,
): SpecDocModel {
  return {
    ...model,
    sections: model.sections.map((section) => ({
      ...section,
      groups: section.groups.map((group) => ({
        ...group,
        rows: group.rows.map((row) => (row.cellId === cellId ? { ...row, status } : row)),
      })),
    })),
  };
}

function buildWorkspaceStatePayload(
  workspaceKey: string,
  model: SpecDocModel,
  meta: WorkspaceMeta,
  evidenceSlots: EvidenceSlot[],
  qeConclusion: string,
): EngineeringSpecWorkspaceState {
  return {
    workspaceKey,
    sourceFileName: model.sourceFileName,
    imageSrc: model.imageSrc,
    qeConclusion,
    metadata: {
      rowCount: meta.rowCount,
      columnCount: meta.columnCount,
      sectionCount: model.sections.length,
      packagingCount: model.packaging.length,
      pendingCount: countPendingRows(model.sections),
    },
    header: {
      title: model.header.title,
      productType: mapBoundFieldToWorkspaceField(model.header.productType),
      sku: mapBoundFieldToWorkspaceField(model.header.sku),
      spu: mapBoundFieldToWorkspaceField(model.header.spu),
      description: mapBoundFieldToWorkspaceField(model.header.description),
    },
    packaging: model.packaging.map((item) => ({
      label: item.label,
      value: item.field.value,
    })),
    businessMeta: model.businessMeta.map((field) => mapBoundFieldToWorkspaceField(field)),
    sections: model.sections.map((section) => ({
      label: section.label,
      groups: section.groups.map((group) => ({
        label: group.label,
        rows: group.rows.map((row) => ({
          item: row.item,
          label: row.label,
          value: row.value,
          pending: row.pending,
          status: row.status,
        })),
      })),
    })),
    evidenceSlots,
  };
}

function mapBoundFieldToWorkspaceField(field: BoundField): EngineeringSpecWorkspaceField {
  return {
    label: field.label,
    value: field.value,
    multiline: field.multiline,
  };
}

function buildSpecDocModel(preview: ProductSpecWorkbookPreview, cellTexts: CellTextMap): SpecDocModel {
  const locator = buildCellLocator(preview);
  const bound = (label: string, row: number, col: number, multiline = false): BoundField => {
    const cell = locator.get(`${row}:${col}`);
    return {
      label,
      cellId: cell?.id || `${row}:${col}`,
      value: cell ? cellTexts[cell.id] ?? '' : '',
      multiline,
    };
  };

  const packaging = [3, 4, 5, 6, 7, 8, 9].map((col) => ({
    label: getCellValue(locator, cellTexts, 5, col),
    field: bound(getCellValue(locator, cellTexts, 5, col), 7, col),
  }));

  const businessMeta: BoundField[] = [
    bound('产品来源', 8, 3),
    bound('开发类型', 8, 7),
    bound('事业部', 9, 3),
    bound('产品组', 9, 7),
    bound('海关编码', 9, 8),
    bound('报关中文品名', 9, 9, true),
  ];

  const sectionsByKey = new Map<string, SpecDocSection>();
  for (let row = 11; row <= preview.metadata.rowCount; row += 1) {
    const sectionLabel = getCellValue(locator, cellTexts, row, 1);
    const groupLabel = getCellValue(locator, cellTexts, row, 2);
    const item = getCellValue(locator, cellTexts, row, 3);
    const targetCell = locator.get(`${row}:4`);
    const fullText = targetCell ? cellTexts[targetCell.id] ?? '' : '';

    if (!sectionLabel || !groupLabel || !targetCell) continue;

    const { label, value } = splitSpecText(fullText);
    const pending = /项目期间填写/.test(fullText);

    if (!sectionsByKey.has(sectionLabel)) {
      sectionsByKey.set(sectionLabel, { label: sectionLabel, groups: [] });
    }

    const section = sectionsByKey.get(sectionLabel)!;
    let group = section.groups.find((entry) => entry.label === groupLabel);
    if (!group) {
      group = { label: groupLabel, rows: [] };
      section.groups.push(group);
    }

    group.rows.push({
      item,
      cellId: targetCell.id,
      label,
      value,
      pending,
      status: 'untested',
    });
  }

  return {
    sourceFileName: preview.fileName,
    imageSrc: preview.images[0]?.src,
    qeConclusion: '',
    header: {
      title: getCellValue(locator, cellTexts, 1, 1) || '产品规格资料',
      productType: bound('产品类型', 2, 7, true),
      sku: bound('产品编号 (SKU)', 3, 3),
      spu: bound('产品编码 (SPU)', 3, 7),
      description: bound('规格描述', 4, 3, true),
    },
    packaging,
    businessMeta,
    sections: Array.from(sectionsByKey.values()),
  };
}

function buildArchiveStateFromModel(
  model: SpecDocModel,
  evidenceSlots: EvidenceSlot[],
  qeConclusion: string,
): EngineeringSpecArchiveState {
  return {
    fileName: model.sourceFileName,
    imageUrl: model.imageSrc,
    qeConclusion,
    images: evidenceSlots
      .filter((slot) => slot.imageUrl)
      .map((slot) => ({
        id: slot.id,
        label: slot.label,
        url: slot.imageUrl as string,
      })),
    productInfo: {
      sku: model.header.sku.value.trim(),
      spu: model.header.spu.value.trim(),
      type: model.header.productType.value.trim(),
      description: model.header.description.value.trim(),
      department: findFieldValue(model.businessMeta, '事业部'),
      productGroup: findFieldValue(model.businessMeta, '产品组'),
      sampleQty: extractSampleQty(model.packaging),
      testDate: extractTestDate(model.sections),
    },
    packaging: model.packaging.map((item) => ({
      label: item.label,
      value: item.field.value.trim(),
    })),
    businessMeta: model.businessMeta.map((field) => ({
      label: field.label,
      value: field.value.trim(),
    })),
    sections: model.sections.map((section) => ({
      label: section.label,
      groups: section.groups.map((group) => ({
        label: group.label,
        rows: group.rows.map((row) => ({
          item: row.item,
          label: row.label,
          value: row.value.trim(),
          pending: row.pending,
          status: row.status,
        })),
      })),
    })),
  };
}

function extractSampleQty(packaging: PackagingMetric[]): string {
  const preferred =
    packaging.find((item) => /inner pc\/box/i.test(item.label)) ||
    packaging.find((item) => /sample/i.test(item.label)) ||
    packaging[1];
  return preferred?.field.value.trim() || '';
}

function extractTestDate(sections: SpecDocSection[]): string {
  for (const section of sections) {
    for (const group of section.groups) {
      for (const row of group.rows) {
        if (/测试日期|test date/i.test(row.label) && row.value.trim()) {
          return row.value.trim();
        }
      }
    }
  }
  return '';
}

function findFieldValue(fields: BoundField[], label: string): string {
  return fields.find((field) => field.label === label)?.value.trim() || '';
}

function buildCellLocator(preview: ProductSpecWorkbookPreview): Map<string, ProductSpecPreviewCell> {
  const map = new Map<string, ProductSpecPreviewCell>();
  for (const cell of preview.cells) {
    for (let row = cell.row; row < cell.row + cell.rowSpan; row += 1) {
      for (let col = cell.col; col < cell.col + cell.colSpan; col += 1) {
        map.set(`${row}:${col}`, cell);
      }
    }
  }
  return map;
}

function getCellValue(
  locator: Map<string, ProductSpecPreviewCell>,
  cellTexts: CellTextMap,
  row: number,
  col: number,
): string {
  const cell = locator.get(`${row}:${col}`);
  return cell ? cellTexts[cell.id] ?? '' : '';
}

function splitSpecText(text: string): { label: string; value: string } {
  const normalized = text.trim();
  const match = normalized.match(/^(.+?)([：:]\s*)(.*)$/);
  if (!match) {
    return { label: '', value: normalized };
  }

  return {
    label: match[1].trim(),
    value: match[3].trim(),
  };
}

function composeSpecText(label: string, value: string): string {
  const cleanValue = value.trim();
  if (!label) return cleanValue;
  return `${label}：${cleanValue}`;
}

function countPendingRows(sections: SpecDocSection[]): number {
  return sections.reduce(
    (total, section) =>
      total +
      section.groups.reduce(
        (groupTotal, group) =>
          groupTotal + group.rows.filter((row) => row.status === 'untested').length,
        0,
      ),
    0,
  );
}

function summarizeGroupStatuses(rows: SpecDocRow[]) {
  return rows.reduce(
    (acc, row) => {
      if (row.status === 'pass') {
        acc.pass += 1;
      } else if (row.status === 'fail') {
        acc.fail += 1;
      } else {
        acc.untested += 1;
      }
      return acc;
    },
    { pass: 0, fail: 0, untested: 0 },
  );
}

function formatWorkspaceOriginTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}
