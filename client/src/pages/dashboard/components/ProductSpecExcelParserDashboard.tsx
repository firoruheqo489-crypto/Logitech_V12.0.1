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

import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import {
  isInvalidEngineeringSpecSkuValue,
  normalizeEngineeringSpecComparable,
  sanitizeEngineeringSpecLedgerRecords,
} from '@/lib/engineering-spec-ledger-clean';
import { deleteAssetViaServer, uploadAssetViaServer } from '@/lib/ossUpload';
import {
  createEngineeringSpecArchive,
  deleteEngineeringSpecArchive,
  getEngineeringSpecArchiveDocumentState,
  listEngineeringSpecArchives,
  updateEngineeringSpecArchive,
  type EngineeringSpecArchiveState,
  type EngineeringSpecLedgerRecord,
} from '@/lib/engineering-spec-ledger-api';
import type { ProductSpecPreviewCell, ProductSpecWorkbookPreview } from '@/lib/product-spec-excel-parser';
import { parseProductSpecWorkbook } from '@/lib/product-spec-excel-parser';
import {
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
const PACKAGING_LABEL_TRANSLATIONS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^pk$/i, label: '包装方式' },
  { pattern: /^inner\s*pc\s*\/\s*box$/i, label: '内盒数量' },
  { pattern: /^outer\s*pc\s*\/\s*ctn$/i, label: '外箱数量' },
  { pattern: /^n\.?\s*w\.?\s*kg\s*\/\s*ctn$/i, label: '单箱净重(KG)' },
  { pattern: /^g\.?\s*w\.?\s*kg\s*\/\s*ctn$/i, label: '单箱毛重(KG)' },
  { pattern: /^measm'?t\s*cbm\s*\/\s*ctn$/i, label: '单箱体积(CBM)' },
];
const HEADER_BUSINESS_META_LABELS = [
  '产品来源',
  '开发类型',
  '产品组',
  '客户编号',
  '产品经理',
  '结构工程师',
  '电子工程师',
] as const;
const PACKAGING_EXTRA_LABELS = ['接收样品数'] as const;
const REMOVED_PACKAGING_LABELS = new Set(['产品尺寸', '产品配件']);

function createEmptyEvidenceSlots(): EvidenceSlot[] {
  return Array.from({ length: EVIDENCE_SLOT_COUNT }, (_, index) => ({
    id: `engineering-spec-evidence-${index + 1}`,
    label: `证据 ${index + 1}`,
  }));
}

function appendMissingBusinessMetaFields(fields: BoundField[], prefix: string): BoundField[] {
  const existingLabels = new Set(fields.map((field) => field.label.trim()));
  const extras = HEADER_BUSINESS_META_LABELS.filter((label) => !existingLabels.has(label)).map((label, index) => ({
    label,
    cellId: `${prefix}-${index + 1}`,
    value: '',
  }));
  return [...fields, ...extras];
}

function normalizePackagingMetricLabel(label: string): string {
  const normalized = label.trim();
  if (normalized === '产品净重') return '接收样品数';
  return normalized;
}

function shouldKeepPackagingMetric(label: string): boolean {
  return !REMOVED_PACKAGING_LABELS.has(label.trim());
}

function appendMissingPackagingFields(packaging: PackagingMetric[], prefix: string): PackagingMetric[] {
  const normalizedPackaging = packaging
    .map((item) => {
      const normalizedLabel = normalizePackagingMetricLabel(item.label);
      return {
        ...item,
        label: normalizedLabel,
        field: {
          ...item.field,
          label: normalizedLabel,
        },
      };
    })
    .filter((item) => shouldKeepPackagingMetric(item.label));
  const existingLabels = new Set(normalizedPackaging.map((item) => item.label.trim()));
  const extras = PACKAGING_EXTRA_LABELS.filter((label) => !existingLabels.has(label)).map((label, index) => ({
    label,
    field: {
      label,
      cellId: `${prefix}-${index + 1}`,
      value: '',
    },
  }));
  return [...normalizedPackaging, ...extras];
}

function findMetaField(fields: BoundField[], label: string): BoundField | null {
  return fields.find((field) => field.label.trim() === label) || null;
}

function getLocalizedPackagingLabel(label: string): string {
  const normalized = label.trim();
  for (const translation of PACKAGING_LABEL_TRANSLATIONS) {
    if (translation.pattern.test(normalized)) {
      return translation.label;
    }
  }
  return normalized;
}

function normalizeParsedFieldValue(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';
  if (/^[-—–/／\\]+$/u.test(normalized)) return '';
  if (/^(确认项目|item)$/iu.test(normalized)) return '';
  return normalized;
}

function looksLikePlaceholderValue(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  if (/^[-—–/／\\]+$/u.test(normalized)) return true;
  if (/^(确认项目|item|pk|包装信息|产品图片|产品来源|事业部|要求|类别)$/iu.test(normalized)) return true;
  return false;
}

function looksLikeSpecDescription(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  const descriptionSignals = [
    /ac|dc|hz|ra|lm|smd|rohs|emc/i,
    /[xX×*]\d/,
    /色温|灯头|材质|尺寸|高度|外径|功率|电压/u,
    /\s+/u,
  ];
  const score = descriptionSignals.reduce((sum, pattern) => (pattern.test(normalized) ? sum + 1 : sum), 0);
  return normalized.length >= 24 || score >= 2;
}

function looksLikeCompactCode(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.length > 32) return false;
  if (/\s/u.test(normalized)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(normalized);
}

function looksLikeProductCategory(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  if (/ac|dc|hz|ra|lm|smd|rohs|emc|pf|w\b/i.test(normalized)) return false;
  return /[\\\/]/u.test(normalized) || /照明|筒灯|面板灯|射灯|球泡|灯/u.test(normalized);
}

function validateSpecHeaderModel(model: SpecDocModel): string[] {
  const issues: string[] = [];
  const sku = model.header.sku.value.trim();
  const spu = model.header.spu.value.trim();
  const productType = model.header.productType.value.trim();
  const description = model.header.description.value.trim();

  const normalizedSku = normalizeEngineeringSpecComparable(sku);
  const normalizedSpu = normalizeEngineeringSpecComparable(spu);
  const normalizedType = normalizeEngineeringSpecComparable(productType);
  const normalizedDescription = normalizeEngineeringSpecComparable(description);

  if (isInvalidEngineeringSpecSkuValue(sku) || !looksLikeCompactCode(sku)) {
    issues.push('产品编号（SKU）未识别到有效编码。');
  }

  if (looksLikePlaceholderValue(spu) || looksLikeSpecDescription(spu)) {
    issues.push('产品编码（SPU）疑似串位到规格描述区域。');
  }

  if (
    looksLikePlaceholderValue(productType) ||
    (!looksLikeProductCategory(productType) && looksLikeSpecDescription(productType))
  ) {
    issues.push('产品类型疑似串位或解析为长描述文本。');
  }

  if (
    (description && looksLikePlaceholderValue(description)) ||
    (description && !looksLikeSpecDescription(description))
  ) {
    issues.push('规格描述未识别到有效长文本描述。');
  }

  if (normalizedDescription && (normalizedDescription === normalizedSku || normalizedDescription === normalizedSpu)) {
    issues.push('规格描述与 SKU/SPU 完全相同，疑似表头串位。');
  }

  if (normalizedSku && normalizedSku === normalizedSpu) {
    issues.push('SKU 与 SPU 完全相同，疑似表头串位。');
  }

  if (normalizedType && normalizedType === normalizedDescription) {
    issues.push('产品类型与规格描述完全相同，疑似表头串位。');
  }

  return issues;
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
  const [isArchiving, setIsArchiving] = useState(false);
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
  const [workspaceSyncMessage, setWorkspaceSyncMessage] = useState('本页不保留草稿，刷新后请从台账查看或恢复。');
  const [workspaceOrigin, setWorkspaceOrigin] = useState<WorkspaceOriginState>({
    mode: 'draft',
    label: '当前草稿',
    detail: '尚未导入规格书',
  });
  const [activeArchiveDocumentId, setActiveArchiveDocumentId] = useState<string | null>(null);
  const [currentFileFingerprint, setCurrentFileFingerprint] = useState<string | null>(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<EngineeringSpecLedgerRecord | null>(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const projectId = projectName.trim() || 'default-engineering-spec-workspace';

  useEffect(() => {
    let cancelled = false;

    const loadLedger = async () => {
      setIsLoadingLedger(true);
      try {
        const documents = await listEngineeringSpecArchives(projectId);
        const hydratedDocuments = await hydrateLedgerDisplayFieldsIfMissing(projectId, documents);
        if (!cancelled) {
          setLedgerRecords(hydratedDocuments);
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

  const docModel = workspaceModel;

  const sanitizedLedgerRecords = useMemo(
    () => sanitizeEngineeringSpecLedgerRecords(ledgerRecords),
    [ledgerRecords],
  );

  const quickFacts = useMemo(() => {
    if (!docModel) return [];

    return [
      { label: 'SKU', value: docModel.header.sku.value },
      { label: 'SPU', value: docModel.header.spu.value },
      { label: '产品系列', value: docModel.header.productType.value },
      { label: '海关编码', value: findFieldValue(docModel.businessMeta, '海关编码') },
      { label: '产品类别', value: findFieldValue(docModel.businessMeta, '报关中文品名') },
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

  const isEditingExistingArchive = Boolean(activeArchiveDocumentId);

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
    if (isLoadingLedger) {
      toast.warning('台账正在加载中', {
        description: '请等待登记台账加载完成后再上传规格书。',
      });
      return;
    }

    const duplicateByFileName = findDuplicateLedgerRecordByUploadFileName(file.name, sanitizedLedgerRecords);
    if (duplicateByFileName) {
      toast.warning('该产品编号已存在，已阻止上传', {
        description: `SKU：${duplicateByFileName.sku}`,
      });
      return;
    }

    setIsParsing(true);
    try {
      const fileFingerprint = await buildFileFingerprint(file);
      const duplicateRecord = ledgerRecords.find(
        (record) => record.fileFingerprint && record.fileFingerprint === fileFingerprint,
      );
      if (duplicateRecord) {
        toast.warning('该文件已上传过，已阻止重复导入', {
          description: duplicateRecord.sku
            ? `台账记录：${duplicateRecord.sku}`
            : '相同文件内容已存在于登记台账中。',
        });
        return;
      }
      if (currentFileFingerprint && currentFileFingerprint === fileFingerprint) {
        toast.warning('当前工作区已加载这份文件，无需重复上传。');
        return;
      }

      const workbook = await parseProductSpecWorkbook(file);
      const cellTexts = Object.fromEntries(workbook.cells.map((cell) => [cell.id, cell.text])) as CellTextMap;
      const nextModel = buildSpecDocModel(workbook, cellTexts);
      const headerIssues = validateSpecHeaderModel(nextModel);
      if (headerIssues.length > 0) {
        toast.error('规格书表头解析异常', {
          description: headerIssues.join(' '),
        });
        return;
      }
      const nextSku = nextModel.header.sku.value.trim();
      const normalizedNextSku = normalizeEngineeringSpecComparable(nextSku);
      if (isInvalidEngineeringSpecSkuValue(nextSku)) {
        toast.error('未识别到有效产品编号', {
          description: '当前上传的规格书未解析出有效 SKU，已阻止导入。请检查模板内容后重试。',
        });
        return;
      }
      const duplicateBySku = sanitizedLedgerRecords.find(
        (record) => normalizeEngineeringSpecComparable(record.sku || '') === normalizedNextSku,
      );
      if (duplicateBySku) {
        toast.warning('该产品编号已存在，禁止重复上传', {
          description: `SKU: ${duplicateBySku.sku}`,
        });
        return;
      }
      const previewState = await finalizeArchiveState(
        buildArchiveStateFromModel(nextModel, createEmptyEvidenceSlots(), '', fileFingerprint),
      );
      const duplicateByContent = ledgerRecords.find(
        (record) => record.contentFingerprint && record.contentFingerprint === previewState.contentFingerprint,
      );
      if (duplicateByContent) {
        toast.warning('该规格书内容已存在，已阻止重复导入', {
          description: duplicateByContent.sku
            ? `台账记录：${duplicateByContent.sku}`
            : '相同解析结果已存在于登记台账中。',
        });
        return;
      }

      setWorkspaceModel(nextModel);
      setWorkspaceMeta({
        rowCount: workbook.metadata.rowCount,
        columnCount: workbook.metadata.columnCount,
      });
      setEvidenceSlots(createEmptyEvidenceSlots());
      setQeConclusion('');
      setLightboxSlotId(null);
      setIsEditMode(false);
      setWorkspaceSyncState('idle');
      setWorkspaceSyncMessage('本页不保留草稿，刷新后请从台账查看或恢复。');
      setView('workspace');
      setActiveArchiveDocumentId(null);
      setCurrentFileFingerprint(fileFingerprint);
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

  async function handleCopySummary() {
    if (quickFacts.length === 0) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(quickFacts, null, 2));
      toast.success('摘要字段已复制');
    } catch {
      toast.error('复制失败，请稍后重试');
    }
  }

  async function handleArchive(mode: 'create' | 'update') {
    if (!docModel || isArchiving) return;

    setIsArchiving(true);

    try {
      const headerIssues = validateSpecHeaderModel(docModel);
      if (headerIssues.length > 0) {
        toast.error('规格书表头仍存在异常', {
          description: headerIssues.join(' '),
        });
        return;
      }
      const archiveState = await finalizeArchiveState(
        buildArchiveStateFromModel(docModel, evidenceSlots, qeConclusion, currentFileFingerprint),
      );
      const isUpdatingExistingArchive = mode === 'update' && Boolean(activeArchiveDocumentId);
      if (mode === 'update' && !activeArchiveDocumentId) {
        toast.warning('当前工作区不是已恢复归档', {
          description: '请先从登记台账打开一条归档记录，再使用覆盖更新。',
        });
        return;
      }

      const document = isUpdatingExistingArchive
        ? await updateEngineeringSpecArchive({
            projectId,
            documentId: activeArchiveDocumentId as string,
            state: archiveState,
          })
        : await createEngineeringSpecArchive({
            projectId,
            state: archiveState,
          });
      setLedgerRecords((current) => [document, ...current.filter((item) => item.id !== document.id)]);
      setActiveArchiveDocumentId(document.id);
      setWorkspaceSyncState('saved');
      setWorkspaceSyncMessage(
        isUpdatingExistingArchive
          ? `当前归档 ${document.sku || document.id} 已覆盖更新。`
          : `当前规格书 ${document.sku || document.id} 已归档入库。`,
      );
      setWorkspaceOrigin({
        mode: 'archive',
        label: '归档快照',
        detail: `${document.sku || '未命名规格书'} · ${formatWorkspaceOriginTime(document.createdAt)}`,
      });
      setView('ledger');
      toast.success(isUpdatingExistingArchive ? '规格书归档已更新' : '规格书已归档到 OSS', {
        description: isUpdatingExistingArchive
          ? `${document.sku} 已覆盖更新原归档记录。`
          : `${document.sku} 已写入远端登记台账。`,
      });
    } catch (error) {
      toast.error('归档入库失败', {
        description: error instanceof Error ? error.message : '请检查 OSS 配置与网络状态',
      });
    } finally {
      setIsArchiving(false);
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

  function markWorkspaceAsDraft() {
    setWorkspaceSyncState('idle');
    setWorkspaceSyncMessage('本页只保留本次打开会话内容，刷新后请从台账查看或恢复。');
    setWorkspaceOrigin((current) =>
      current.mode === 'archive'
        ? {
            mode: 'archive',
            label: '归档快照',
            detail: current.detail || '基于归档快照修改中',
          }
        : current,
    );
  }

  function handleFieldChange(cellId: string, value: string) {
    markWorkspaceAsDraft();
    setWorkspaceModel((current) => (current ? updateSpecDocModelField(current, cellId, value) : current));
  }

  function handleQeConclusionChange(value: string) {
    markWorkspaceAsDraft();
    setQeConclusion(value);
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
      setIsEditMode(false);
      setLightboxSlotId(null);
      setView('workspace');
      setActiveArchiveDocumentId(record.id);
      setCurrentFileFingerprint(snapshot.state.fileFingerprint || snapshot.document.fileFingerprint || null);
      setWorkspaceSyncState('restored');
      setWorkspaceSyncMessage(`当前内容来自台账归档：${snapshot.document.sku || '未命名规格书'}，刷新后不会保留。`);
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

  async function handleDeleteArchiveRecord() {
    if (!pendingDeleteRecord || isDeletingRecord) return;

    const targetRecord = pendingDeleteRecord;
    setIsDeletingRecord(true);

    try {
      await deleteEngineeringSpecArchive({
        projectId,
        documentId: targetRecord.id,
      });
      setLedgerRecords((current) => current.filter((item) => item.id !== targetRecord.id));
      if (activeArchiveDocumentId === targetRecord.id) {
        setActiveArchiveDocumentId(null);
        setCurrentFileFingerprint(null);
        setWorkspaceSyncState('idle');
        setWorkspaceSyncMessage('当前恢复的归档已删除，工作区内容仅保留在本次会话中。');
        setWorkspaceOrigin({
          mode: 'draft',
          label: '当前草稿',
          detail: `基于已删除归档 ${targetRecord.sku || targetRecord.id} 的当前会话`,
        });
      }
      toast.success(`${targetRecord.sku || '当前归档'} 已删除`);
      setPendingDeleteRecord(null);
    } catch (error) {
      toast.error('归档删除失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setIsDeletingRecord(false);
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
                产品规格书看板
              </h1>
            </div>

            <div className="flex flex-wrap items-stretch gap-3">
              <label
                className={`inline-flex min-h-[56px] w-[168px] cursor-pointer items-center gap-3 rounded-xl px-4 py-2 transition ${
                  isParsing ? 'opacity-70' : 'hover:bg-white/[0.04]'
                } ${glassPanelClass}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200">
                  <UploadCloud className="h-4.5 w-4.5" />
                </div>
                <div className="flex min-w-0 flex-1 items-center">
                  <p className="whitespace-nowrap text-sm font-medium text-[#E2E8F0]">
                    {isParsing ? '正在解析...' : '上传规格书'}
                  </p>
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
                onClick={() => void handleArchive('create')}
                disabled={!docModel || isArchiving}
                className={`inline-flex min-h-[56px] w-[168px] items-center gap-3 rounded-xl px-4 py-2 transition ${
                  docModel && !isArchiving ? 'hover:bg-white/[0.04]' : 'cursor-not-allowed opacity-40'
                } ${glassPanelClass}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-200">
                  <Archive className="h-4.5 w-4.5" />
                </div>
                <div className="flex min-w-0 flex-1 items-center text-left">
                  <p className="whitespace-nowrap text-sm font-medium text-[#E2E8F0]">归档入库</p>
                </div>
              </button>

              {isEditingExistingArchive ? (
                <button
                  type="button"
                  onClick={() => void handleArchive('update')}
                  disabled={!docModel || isArchiving}
                  className={`inline-flex min-h-[56px] w-[168px] items-center gap-3 rounded-xl px-4 py-2 transition ${
                    docModel && !isArchiving ? 'hover:bg-white/[0.04]' : 'cursor-not-allowed opacity-40'
                  } ${glassPanelClass}`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10 text-amber-200">
                    <Archive className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center text-left">
                    <p className="whitespace-nowrap text-sm font-medium text-[#E2E8F0]">覆盖更新归档</p>
                  </div>
                </button>
              ) : null}
            </div>
          </div>
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
                onDeleteRecord={setPendingDeleteRecord}
              />
            ) : docModel ? (
              <ElectronicSpecDocument
                model={docModel}
                isEditMode={isEditMode}
                onToggleEditMode={() => setIsEditMode((current) => !current)}
                onFieldChange={handleFieldChange}
                quickFacts={quickFacts}
                onCopySummary={handleCopySummary}
                stats={stats}
                qeConclusion={qeConclusion}
                onQeConclusionChange={handleQeConclusionChange}
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

      <CyberConfirmDialog
        open={Boolean(pendingDeleteRecord)}
        title="删除规格书归档"
        message={
          pendingDeleteRecord
            ? `确定要删除 ${pendingDeleteRecord.sku || '当前归档'} 吗？\n删除后会从登记台账中移除，且无法恢复。`
            : ''
        }
        confirmText={isDeletingRecord ? '删除中...' : '确认删除'}
        cancelText="取消"
        onConfirm={() => {
          void handleDeleteArchiveRecord();
        }}
        onCancel={() => {
          if (!isDeletingRecord) {
            setPendingDeleteRecord(null);
          }
        }}
      />
    </div>
  );
}

function ElectronicSpecDocument({
  model,
  isEditMode,
  onToggleEditMode,
  onFieldChange,
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
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onFieldChange: (cellId: string, value: string) => void;
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
        isEditMode={isEditMode}
        onToggleEditMode={onToggleEditMode}
        onFieldChange={onFieldChange}
        quickFacts={quickFacts}
        onCopySummary={onCopySummary}
        stats={stats}
      />
      <div className="space-y-4">
        {model.sections.map((section) => (
          <SpecSectionCard
            key={section.label}
            section={section}
            isEditMode={isEditMode}
            onFieldChange={onFieldChange}
          />
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
      <QeConclusionCard value={qeConclusion} onChange={onQeConclusionChange} isEditMode={isEditMode} />
    </div>
  );
}

function HeaderCard({
  model,
  isEditMode,
  onToggleEditMode,
  onFieldChange,
  quickFacts,
  onCopySummary,
  stats,
}: {
  model: SpecDocModel;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onFieldChange: (cellId: string, value: string) => void;
  quickFacts: Array<{ label: string; value: string }>;
  onCopySummary: () => void;
  stats: StatItem[];
}) {
  void stats;
  const hsCodeField = findMetaField(model.businessMeta, '海关编码');
  const customsNameField = findMetaField(model.businessMeta, '报关中文品名');
  const customerIdField = findMetaField(model.businessMeta, '客户编号');
  const businessSummaryFields = ['产品来源', '开发类型', '产品组']
    .map((label) => findMetaField(model.businessMeta, label))
    .filter((field): field is BoundField => Boolean(field));
  const roleFields = ['产品经理', '结构工程师', '电子工程师']
    .map((label) => findMetaField(model.businessMeta, label))
    .filter((field): field is BoundField => Boolean(field));

  return (
    <section className={`rounded-[18px] px-4 py-4 ${glassPanelClass}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#94A3B8]">Header</p>
          <h2 className="mt-0.5 text-base font-semibold text-[#E2E8F0]">{model.header.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleEditMode}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] transition ${
              isEditMode
                ? 'border-cyan-400/35 bg-cyan-400/10 text-cyan-100'
                : 'border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.05]'
            }`}
          >
            {isEditMode ? '完成编辑' : '编辑内容'}
          </button>
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
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
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

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CompactField field={model.header.sku} isEditing={isEditMode} onChange={onFieldChange} />
            <CompactField field={model.header.spu} isEditing={isEditMode} onChange={onFieldChange} />
            <CompactField
              field={{ ...model.header.productType, label: '产品系列' }}
              multiline
              isEditing={isEditMode}
              onChange={onFieldChange}
            />
            {hsCodeField ? <CompactField field={hsCodeField} isEditing={isEditMode} onChange={onFieldChange} /> : null}
            {customsNameField ? (
              <CompactField
                field={{ ...customsNameField, label: '产品类别' }}
                multiline
                isEditing={isEditMode}
                onChange={onFieldChange}
              />
            ) : null}
            {customerIdField ? (
              <CompactField field={customerIdField} isEditing={isEditMode} onChange={onFieldChange} />
            ) : null}
            <CompactField
              field={model.header.description}
              className="md:col-span-2 xl:col-span-3"
              multiline
              isEditing={isEditMode}
              onChange={onFieldChange}
            />
          </div>

          {businessSummaryFields.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {businessSummaryFields.map((field) => (
                <CompactField
                  key={field.cellId}
                  field={field}
                  multiline={field.multiline}
                  isEditing={isEditMode}
                  onChange={onFieldChange}
                />
              ))}
            </div>
          ) : null}

          {roleFields.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {roleFields.map((field) => (
                <CompactField
                  key={field.cellId}
                  field={field}
                  multiline={field.multiline}
                  isEditing={isEditMode}
                  onChange={onFieldChange}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex self-stretch flex-col xl:px-2">
          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/[0.14] to-transparent" />
          <div className="flex flex-1 items-center justify-center px-4 py-5">
            <p className="text-center text-sm font-semibold tracking-[0.02em] text-[#E2E8F0]">产品包装信息</p>
          </div>
        </div>

        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
          {model.packaging.map((item) => (
            <CompactField
              key={item.field.cellId}
              field={{ ...item.field, label: getLocalizedPackagingLabel(item.label) }}
              multiline={item.field.multiline}
              isEditing={isEditMode}
              onChange={onFieldChange}
            />
          ))}
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
  isEditMode,
  onFieldChange,
}: {
  section: SpecDocSection;
  isEditMode: boolean;
  onFieldChange: (cellId: string, value: string) => void;
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
          <SpecGroupBlock
            key={`${section.label}-${group.label}`}
            group={group}
            isEditMode={isEditMode}
            onFieldChange={onFieldChange}
          />
        ))}
      </div>
    </section>
  );
}

function SpecGroupBlock({
  group,
  isEditMode,
  onFieldChange,
}: {
  group: SpecDocGroup;
  isEditMode: boolean;
  onFieldChange: (cellId: string, value: string) => void;
}) {
  return (
    <div className="flex border-b border-white/[0.05] last:border-b-0">
      <div className="flex w-28 shrink-0 items-center justify-center px-2 py-2 text-center text-[13px] font-semibold leading-6 text-[#CBD5E1]">
        <div>{group.label}</div>
      </div>

      <div className="min-w-0 flex-1">
        {group.rows.map((row, index) => (
          <div
            key={row.cellId}
            className={`grid min-h-[36px] grid-cols-[40px_220px_minmax(0,1fr)] items-start gap-3 px-2 py-1.5 text-[13px] leading-6 hover:bg-white/[0.03] ${
              index < group.rows.length - 1 ? 'border-b border-white/[0.05]' : ''
            }`}
          >
            <div className="pt-0.5 text-[#94A3B8]">{row.item}</div>
            <div className="pt-0.5 text-[#94A3B8]">{row.label || '确认项目'}</div>
            <div className={row.pending ? 'border-l-2 border-[#EAB308] pl-3' : ''}>
              {isEditMode ? (
                <textarea
                  value={row.value}
                  onChange={(event) => onFieldChange(row.cellId, event.target.value)}
                  rows={Math.max(2, row.value.split('\n').length)}
                  className={`min-h-[56px] w-full resize-y rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[13px] leading-6 outline-none transition focus:border-cyan-400/35 focus:bg-black/30 ${
                    row.pending ? 'text-[#FDE047]' : 'text-[#E2E8F0]'
                  }`}
                  placeholder="请输入内容..."
                />
              ) : (
                <div
                  className={`whitespace-pre-wrap break-words py-0 text-[13px] leading-6 ${
                    row.pending ? 'text-[#FDE047]' : 'text-[#E2E8F0]'
                  }`}
                >
                  {row.value || '—'}
                </div>
              )}
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
  isEditMode,
}: {
  value: string;
  onChange: (value: string) => void;
  isEditMode: boolean;
}) {
  return (
    <section className={`rounded-[18px] px-4 py-4 ${glassPanelClass}`}>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-[#E2E8F0]">QE测试结论</h2>
        <p className="text-[11px] text-[#94A3B8]">填写本次 QE 测试的结论说明，该内容会跟随草稿保存与归档恢复。</p>
      </div>

      {isEditMode ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[140px] w-full resize-y rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-[13px] leading-7 text-[#E2E8F0] outline-none transition focus:border-cyan-400/35 focus:bg-black/30"
          placeholder="请输入 QE 测试结论..."
        />
      ) : (
        <div className="min-h-[140px] whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-[13px] leading-7 text-[#E2E8F0]">
          {value || '点击“编辑内容”后可填写 QE 测试结论。'}
        </div>
      )}
    </section>
  );
}

function CompactField({
  field,
  className = '',
  tight = false,
  isEditing = false,
  multiline,
  onChange,
}: {
  field: BoundField;
  className?: string;
  tight?: boolean;
  isEditing?: boolean;
  multiline?: boolean;
  onChange?: (cellId: string, value: string) => void;
}) {
  const resolvedMultiline = multiline ?? field.multiline;

  return (
    <div className={`min-w-0 border-b border-white/[0.05] px-1 ${tight ? 'py-0.5' : 'py-1.5'} ${className}`}>
      <p className="truncate text-[11px] text-[#94A3B8]">{field.label}</p>
      {isEditing ? (
        resolvedMultiline ? (
          <textarea
            value={field.value}
            onChange={(event) => onChange?.(field.cellId, event.target.value)}
            rows={Math.max(2, field.value.split('\n').length || 2)}
            className={`mt-1 w-full resize-y rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[13px] text-[#E2E8F0] outline-none transition focus:border-cyan-400/35 focus:bg-black/30 ${tight ? 'leading-5' : 'leading-6'}`}
            placeholder="请输入内容..."
          />
        ) : (
          <input
            value={field.value}
            onChange={(event) => onChange?.(field.cellId, event.target.value)}
            className={`mt-1 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-[13px] text-[#E2E8F0] outline-none transition focus:border-cyan-400/35 focus:bg-black/30 ${tight ? 'leading-5' : 'leading-6'}`}
            placeholder="请输入内容..."
          />
        )
      ) : resolvedMultiline ? (
        <div className={`mt-1 whitespace-pre-wrap break-words text-[13px] text-[#E2E8F0] ${tight ? 'leading-5' : 'leading-6'}`}>
          {field.value || ''}
        </div>
      ) : (
        <div className={`mt-1 break-words text-[13px] text-[#E2E8F0] ${tight ? 'leading-5' : 'leading-6'}`}>
          {field.value || ''}
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
        label: String(state.header?.productType?.label || '产品系列'),
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
    packaging: appendMissingPackagingFields(
      Array.isArray(state.packaging)
        ? state.packaging.map((item, index) => ({
          label: String(item?.label || `包装项 ${index + 1}`),
          field: {
            label: String(item?.label || `包装项 ${index + 1}`),
            cellId: `workspace-packaging-${index + 1}`,
            value: String(item?.value || ''),
          },
        }))
        : [],
      'workspace-packaging-extra',
    ),
    businessMeta: appendMissingBusinessMetaFields(
      Array.isArray(state.businessMeta)
        ? state.businessMeta.map((item, index) => ({
          label: String(item?.label || `业务字段 ${index + 1}`),
          cellId: `workspace-meta-${index + 1}`,
          value: String(item?.value || ''),
          multiline: Boolean(item?.multiline),
        }))
        : [],
      'workspace-meta-extra',
    ),
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
        label: '产品系列',
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
    packaging: appendMissingPackagingFields(
      Array.isArray(state.packaging)
        ? state.packaging.map((item, index) => ({
          label: String(item?.label || `包装项 ${index + 1}`),
          field: {
            label: String(item?.label || `包装项 ${index + 1}`),
            cellId: `archive-packaging-${index + 1}`,
            value: String(item?.value || ''),
          },
        }))
        : [],
      'archive-packaging-extra',
    ),
    businessMeta: appendMissingBusinessMetaFields(
      Array.isArray(state.businessMeta)
        ? state.businessMeta.map((item, index) => ({
          label: String(item?.label || `业务字段 ${index + 1}`),
          cellId: `archive-meta-${index + 1}`,
          value: String(item?.value || ''),
          multiline: false,
        }))
        : [],
      'archive-meta-extra',
    ),
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
  const textGrid = buildExpandedGridFromPreview(preview, cellTexts);
  const factMap = new Map(preview.facts.map((fact) => [fact.label, fact.value]));
  const bound = (label: string, row: number, col: number, multiline = false): BoundField => {
    const cell = locator.get(`${row}:${col}`);
    return {
      label,
      cellId: cell?.id || `${row}:${col}`,
      value: cell ? cellTexts[cell.id] ?? '' : '',
      multiline,
    };
  };

  const boundWithResolvedValue = (
    factLabel: string,
    displayLabel: string,
    row: number,
    col: number,
    mode: 'preferFact' | 'preferLong',
    multiline = false,
  ): BoundField => {
    const field = bound(displayLabel, row, col, multiline);
    const factValue =
      factMap.get(factLabel)?.trim() ||
      findValueByAnchorLocal(textGrid, factLabel)?.trim() ||
      '';
    if (!factValue) {
      return field;
    }

    const currentValue = field.value.trim();
    if (mode === 'preferFact') {
      if (!currentValue || currentValue.length > factValue.length) {
        return {
          ...field,
          value: factValue,
        };
      }
      return field;
    }

    if (!currentValue || factValue.length > currentValue.length) {
      return {
        ...field,
        value: factValue,
      };
    }

    return field;
  };

  const packagingFieldDefinitions: Array<{ label: string; anchor: string; fallbackCol?: number }> = [
    { label: '包装方式', anchor: '包装方式', fallbackCol: 3 },
    { label: '内盒数量', anchor: '内盒数量', fallbackCol: 4 },
    { label: '外箱数量', anchor: '外箱数量', fallbackCol: 5 },
    { label: '单箱净重(KG)', anchor: '单箱净重kg', fallbackCol: 6 },
    { label: '单箱毛重(KG)', anchor: '单箱毛重kg', fallbackCol: 7 },
    { label: '单箱体积(CBM)', anchor: '单箱体积cbm', fallbackCol: 8 },
    { label: '外箱尺寸(cm) 长*宽*高', anchor: '外箱尺寸cm长*宽*高', fallbackCol: 9 },
    { label: '接收样品数', anchor: '产品净重' },
  ];

  const businessFieldDefinitions: Array<{ label: string; anchor: string; row?: number; col?: number; multiline?: boolean }> = [
    { label: '产品来源', anchor: '产品来源', row: 8, col: 3 },
    { label: '开发类型', anchor: '开发类型', row: 8, col: 7 },
    { label: '事业部', anchor: '事业部', row: 9, col: 3 },
    { label: '产品组', anchor: '产品组', row: 9, col: 7 },
    { label: '海关编码', anchor: '海关编码', row: 9, col: 8 },
    { label: '报关中文品名', anchor: '报关中文品名', row: 9, col: 9, multiline: true },
    { label: '客户编号', anchor: '客户编号' },
    { label: '产品经理', anchor: '产品经理' },
    { label: '结构工程师', anchor: '结构工程师' },
    { label: '电子工程师', anchor: '电子工程师' },
  ];

  const packaging = appendMissingPackagingFields(
    packagingFieldDefinitions.map((definition, index) => {
      const fallbackLabel = definition.fallbackCol ? getLocalizedPackagingLabel(getCellValue(locator, cellTexts, 5, definition.fallbackCol)) : definition.label;
      const fallbackField =
        definition.fallbackCol
          ? bound(definition.label, 7, definition.fallbackCol)
          : {
              label: definition.label,
              cellId: `parsed-packaging-anchor-${index + 1}`,
              value: '',
            };
      const anchorValue = findValueByAnchorLocal(textGrid, definition.anchor) || '';
      return {
        label: fallbackLabel || definition.label,
        field: {
          ...fallbackField,
          label: definition.label,
          value: normalizeParsedFieldValue(anchorValue || fallbackField.value),
        },
      };
    }),
    'parsed-packaging-extra',
  );

  const businessMeta: BoundField[] = appendMissingBusinessMetaFields(
    businessFieldDefinitions.map((definition, index) => {
      const fallbackField =
        typeof definition.row === 'number' && typeof definition.col === 'number'
          ? bound(definition.label, definition.row, definition.col, definition.multiline)
          : {
              label: definition.label,
              cellId: `parsed-business-anchor-${index + 1}`,
              value: '',
              multiline: definition.multiline,
            };
      const anchorValue = findValueByAnchorLocal(textGrid, definition.anchor) || '';
      return {
        ...fallbackField,
        value: normalizeParsedFieldValue(anchorValue || fallbackField.value),
      };
    }),
    'parsed-meta-extra',
  );

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
      productType: boundWithResolvedValue('产品系列', '产品类型', 2, 7, 'preferFact', true),
      sku: boundWithResolvedValue('SKU', '产品编号 (SKU)', 3, 3, 'preferFact'),
      spu: boundWithResolvedValue('SPU', '产品编码 (SPU)', 3, 7, 'preferFact'),
      description: boundWithResolvedValue('规格描述', '规格描述', 4, 3, 'preferLong', true),
    },
    packaging,
    businessMeta,
    sections: Array.from(sectionsByKey.values()),
  };
}

function buildExpandedGridFromPreview(preview: ProductSpecWorkbookPreview, cellTexts: CellTextMap): string[][] {
  const grid = Array.from({ length: preview.metadata.rowCount }, () =>
    Array.from({ length: preview.metadata.columnCount }, () => ''),
  );

  for (const cell of preview.cells) {
    const text = (cellTexts[cell.id] ?? cell.text ?? '').trim();
    for (let row = cell.row; row < cell.row + cell.rowSpan; row += 1) {
      for (let col = cell.col; col < cell.col + cell.colSpan; col += 1) {
        if (!grid[row - 1] || typeof grid[row - 1][col - 1] === 'undefined') continue;
        grid[row - 1][col - 1] = text;
      }
    }
  }

  return grid;
}

function normalizeAnchorText(text: string): string {
  return text.replace(/\s+/g, '').replace(/[()（）:：*×xX]/g, '').toLowerCase();
}

function extractInlineAnchorValue(text: string): string {
  const parts = text.split(/[：:]/);
  if (parts.length <= 1) return '';
  return parts.slice(1).join(':').trim();
}

function findCandidateAnchorValue(row: string[], currentAnchor: string, startCol: number, endCol: number): string {
  for (let colIndex = startCol; colIndex < endCol; colIndex += 1) {
    const candidate = (row[colIndex] || '').trim();
    if (!candidate) continue;
    const normalizedCandidate = normalizeAnchorText(candidate);
    if (!normalizedCandidate) continue;
    if (normalizedCandidate.includes(currentAnchor)) continue;
    if (looksLikePlaceholderValue(candidate)) continue;
    return candidate;
  }
  return '';
}

function findValueByAnchorLocal(grid: string[][], anchorText: string): string {
  const normalizedAnchor = normalizeAnchorText(anchorText);
  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cellText = row[colIndex];
      if (!cellText) continue;
      if (!normalizeAnchorText(cellText).includes(normalizedAnchor)) continue;

      const inlineValue = extractInlineAnchorValue(cellText);
      if (inlineValue) return inlineValue;

      const sameRowValue = findCandidateAnchorValue(row, normalizedAnchor, colIndex + 1, row.length);
      if (sameRowValue) return sameRowValue;

      for (let nextRow = rowIndex + 1; nextRow < Math.min(grid.length, rowIndex + 3); nextRow += 1) {
        const downRowValue = findCandidateAnchorValue(
          grid[nextRow],
          normalizedAnchor,
          colIndex,
          Math.min(grid[nextRow].length, colIndex + 3),
        );
        if (downRowValue) return downRowValue;
      }
    }
  }
  return '';
}

async function buildFileFingerprint(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function extractUploadFileNameSkuCandidates(fileName: string): string[] {
  const baseName = fileName.replace(/\.[^.]+$/, '').trim();
  const candidates = new Set<string>();

  const pushCandidate = (value: string) => {
    const normalized = normalizeEngineeringSpecComparable(value.trim());
    if (!normalized || isInvalidEngineeringSpecSkuValue(value)) return;
    candidates.add(normalized);
  };

  if (!baseName) return [];

  pushCandidate(baseName);

  const withoutCommonSuffix = baseName
    .replace(/[-_\s]*(产品规格书|产品规格资料|产品规格|规格书|规格资料|specification|spec)$/i, '')
    .trim();
  pushCandidate(withoutCommonSuffix);

  const beforeChinese = baseName.split(/[\u4e00-\u9fff]/)[0]?.replace(/[-_\s]+$/, '').trim() || '';
  pushCandidate(beforeChinese);

  const leadingAscii = baseName.match(/^[A-Za-z0-9]+(?:[A-Za-z0-9._-]*[A-Za-z0-9])?/);
  if (leadingAscii) {
    pushCandidate(leadingAscii[0]);
  }

  return [...candidates];
}

function findDuplicateLedgerRecordByUploadFileName(
  fileName: string,
  records: EngineeringSpecLedgerRecord[],
): EngineeringSpecLedgerRecord | null {
  const candidates = extractUploadFileNameSkuCandidates(fileName);
  if (candidates.length === 0) return null;

  return (
    records.find((record) => {
      if (isInvalidEngineeringSpecSkuValue(record.sku || '')) return false;
      const normalizedSku = normalizeEngineeringSpecComparable(record.sku || '');
      return candidates.includes(normalizedSku);
    }) || null
  );
}

async function buildArchiveContentFingerprint(state: EngineeringSpecArchiveState): Promise<string> {
  const payload = {
    version: 1,
    productInfo: {
      sku: state.productInfo?.sku?.trim() || '',
      spu: state.productInfo?.spu?.trim() || '',
      type: state.productInfo?.type?.trim() || '',
      description: state.productInfo?.description?.trim() || '',
      department: state.productInfo?.department?.trim() || '',
      productGroup: state.productInfo?.productGroup?.trim() || '',
      sampleQty: state.productInfo?.sampleQty?.trim() || '',
      testDate: state.productInfo?.testDate?.trim() || '',
    },
    packaging: (state.packaging || []).map((item) => ({
      label: item.label.trim(),
      value: item.value.trim(),
    })),
    businessMeta: (state.businessMeta || []).map((item) => ({
      label: item.label.trim(),
      value: item.value.trim(),
    })),
    sections: (state.sections || []).map((section) => ({
      label: section.label.trim(),
      groups: (section.groups || []).map((group) => ({
        label: group.label.trim(),
        rows: (group.rows || []).map((row) => ({
          item: String(row.item || '').trim(),
          label: row.label.trim(),
          value: row.value.trim(),
          pending: Boolean(row.pending),
          status: row.status === 'pass' || row.status === 'fail' ? row.status : 'untested',
        })),
      })),
    })),
  };

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function finalizeArchiveState(
  state: EngineeringSpecArchiveState,
): Promise<EngineeringSpecArchiveState> {
  return {
    ...state,
    contentFingerprint: await buildArchiveContentFingerprint(state),
  };
}

function buildArchiveStateFromModel(
  model: SpecDocModel,
  evidenceSlots: EvidenceSlot[],
  qeConclusion: string,
  fileFingerprint: string | null,
): EngineeringSpecArchiveState {
  return {
    fileName: model.sourceFileName,
    fileFingerprint: fileFingerprint || undefined,
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
      productGroup: findFieldValue(model.businessMeta, '产品经理'),
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
    packaging.find((item) => item.label.trim() === '接收样品数') ||
    packaging.find((item) => item.label.trim() === '产品净重') ||
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

function findArchiveMetaValue(
  entries: Array<{ label: string; value: string }> | null | undefined,
  labels: string[],
): string {
  const normalizedLabels = new Set(labels.map((label) => label.trim()));
  for (const entry of entries ?? []) {
    const candidateLabel = String(entry?.label || '').trim();
    if (normalizedLabels.has(candidateLabel)) {
      return String(entry?.value || '').trim();
    }
  }

  return '';
}

function needsLedgerImageHydration(imageUrl: string | undefined): boolean {
  const value = (imageUrl || '').trim();
  if (!value) return true;
  if (value.startsWith('data:')) return true;
  return false;
}

function resolveArchivePreviewImageUrl(state: EngineeringSpecArchiveState): string {
  const primaryImage = String(state.imageUrl || '').trim();
  if (primaryImage) return primaryImage;

  const firstEvidenceImage = Array.isArray(state.images)
    ? state.images.find((item) => String(item?.url || '').trim())
    : null;
  return String(firstEvidenceImage?.url || '').trim();
}

async function hydrateLedgerDisplayFieldsIfMissing(
  projectId: string,
  records: EngineeringSpecLedgerRecord[],
): Promise<EngineeringSpecLedgerRecord[]> {
  const missingRecords = records.filter(
    (record) => !(record.category || '').trim() || needsLedgerImageHydration(record.imageUrl),
  );
  if (missingRecords.length === 0) return records;

  const resolvedFields = await Promise.all(
    missingRecords.map(async (record) => {
      try {
        const snapshot = await getEngineeringSpecArchiveDocumentState({
          projectId,
          documentId: record.id,
        });
        return [
          record.id,
          findArchiveMetaValue(snapshot.state.businessMeta, ['产品类别', '报关中文品名', '报关中文名']),
          resolveArchivePreviewImageUrl(snapshot.state),
        ] as const;
      } catch {
        return [record.id, '', ''] as const;
      }
    }),
  );

  const displayFieldById = new Map(
    resolvedFields
      .filter((entry) => Boolean(entry[1]) || Boolean(entry[2]))
      .map((entry) => [entry[0], { category: entry[1], imageUrl: entry[2] }] as const),
  );
  if (displayFieldById.size === 0) return records;

  return records.map((record) => {
    const resolved = displayFieldById.get(record.id);
    if (!resolved) return record;

    return {
      ...record,
      category: (record.category || '').trim() || resolved.category,
      imageUrl: needsLedgerImageHydration(record.imageUrl)
        ? resolved.imageUrl || undefined
        : (record.imageUrl || '').trim() || undefined,
    };
  });
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

function formatWorkspaceOriginTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}
