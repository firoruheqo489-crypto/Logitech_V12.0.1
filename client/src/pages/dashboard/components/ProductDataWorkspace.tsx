import { useCallback, useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import imageCompression from 'browser-image-compression';
import {
  AlertTriangle,
  Aperture,
  Box,
  Camera,
  Cuboid,
  FileText,
  LoaderCircle,
  RotateCcw,
  RotateCw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { deleteAssetViaServer, uploadAssetViaServer } from '@/lib/ossUpload';
import type { ModuleTheme } from '@/lib/theme';
import {
  getDashboardApiErrorDisplayMessage,
  normalizeDashboardApiError,
} from '../lib/dashboardApi';
import type { ProjectData } from '../types/project';
import type { ProductModuleRecord } from '../types/product-module';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import {
  buildProductModuleLookupKey,
  formatProductSequenceLabel,
  normalizeMoldLookupKey,
} from '../lib/productModuleUtils';

type ProductDataWorkspaceProps = {
  projects: ProjectData[];
  theme: ModuleTheme;
  productDataByMold: Record<string, ProductModuleRecord>;
  productSequenceByMold: Record<string, string>;
};

type SlotId = 'product3d' | 'product2d' | 'productPhoto' | 'mold3d' | 'moldPhoto';

type UploadSlot = {
  id: SlotId;
  label: string;
  icon: typeof Box;
};

type SlotStateMap<T> = Record<string, T>;

const LABEL_CLASS = 'text-[10px] uppercase text-slate-500';
const VALUE_CLASS = 'font-sans tabular-nums font-semibold tracking-tight text-slate-100';
const DATA_MATRIX_LABEL_CLASS = 'text-[10px] font-bold text-slate-500 uppercase tracking-widest';
const DATA_MATRIX_VALUE_CLASS =
  'font-mono tabular-nums font-semibold tracking-tight text-slate-100 whitespace-normal break-all leading-tight';
const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2000;

const UPLOAD_SLOTS: UploadSlot[] = [
  { id: 'product3d', label: '产品3D图', icon: Box },
  { id: 'product2d', label: '产品2D图', icon: FileText },
  { id: 'productPhoto', label: '产品实物图', icon: Camera },
  { id: 'mold3d', label: '模具3D图', icon: Cuboid },
  { id: 'moldPhoto', label: '模具实物图', icon: Aperture },
];

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed && trimmed !== '-' ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function readAnchor(project: ProjectData, paths: string[]): string {
  for (const path of paths) {
    const value = normalizeValue(readPath(project, path));
    if (value) return value;
  }
  return '-';
}

function buildSlotKey(projectKey: string, slotId: SlotId): string {
  return `${projectKey}::${slotId}`;
}

function normalizeT0DisplayValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') return '-';

  if (/[月日]/.test(trimmed)) {
    return trimmed;
  }

  const questionMarkDate = trimmed.match(/^(\d{1,2})\?(\d{1,2})\?$/);
  if (questionMarkDate) {
    return `${Number(questionMarkDate[1])}月${Number(questionMarkDate[2])}日`;
  }

  const slashDate = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})$/);
  if (slashDate) {
    return `${Number(slashDate[1])}月${Number(slashDate[2])}日`;
  }

  return trimmed;
}

function resolveDataMatrixValueClass(value: string): string {
  const length = value.trim().length;

  if (length >= 28) {
    return `${DATA_MATRIX_VALUE_CLASS} text-sm`;
  }

  if (length >= 18) {
    return `${DATA_MATRIX_VALUE_CLASS} text-base`;
  }

  return `${DATA_MATRIX_VALUE_CLASS} text-lg`;
}

function isImageSizeValid(file: File): boolean {
  return file.size <= MAX_UPLOAD_SIZE_BYTES;
}

async function compressImage(file: File): Promise<File> {
  const qualitySteps = isImageSizeValid(file) ? [0.85] : [0.8, 0.7, 0.6, 0.5, 0.4];
  let compressed = file;

  for (const quality of qualitySteps) {
    compressed = await imageCompression(compressed, {
      maxSizeMB: 1.95,
      maxWidthOrHeight: MAX_IMAGE_DIMENSION,
      useWebWorker: true,
      initialQuality: quality,
      maxIteration: 12,
      fileType: 'image/webp',
    });

    if (compressed.size <= MAX_UPLOAD_SIZE_BYTES) {
      return compressed;
    }
  }

  compressed = await imageCompression(compressed, {
    maxSizeMB: 1.95,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    initialQuality: 0.35,
    maxIteration: 16,
    fileType: 'image/webp',
  });

  if (compressed.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error('压缩后仍超过 2MB，请更换图片');
  }

  return compressed;
}

function ProductDataItem({
  label,
  value,
  className = 'flex flex-col gap-1.5',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className={DATA_MATRIX_LABEL_CLASS}>{label}</span>
      <span className={resolveDataMatrixValueClass(value)}>{value}</span>
    </div>
  );
}

export default function ProductDataWorkspace({
  projects,
  theme,
  productDataByMold,
  productSequenceByMold,
}: ProductDataWorkspaceProps) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const previewUrlsRef = useRef<SlotStateMap<string>>({});
  const [previewUrls, setPreviewUrls] = useState<SlotStateMap<string>>({});
  const [selectedSlots, setSelectedSlots] = useState<Record<string, SlotId>>({});
  const [uploadingSlots, setUploadingSlots] = useState<SlotStateMap<boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<SlotStateMap<number>>({});
  const [slotErrors, setSlotErrors] = useState<SlotStateMap<string>>({});
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState('');
  const [lightboxRotation, setLightboxRotation] = useState(0);
  const [pendingDeleteSlot, setPendingDeleteSlot] = useState<{
    projectKey: string;
    moldNumber: string;
    type: SlotId;
  } | null>(null);

  const resolveProductSequenceLabel = useCallback(
    (moldNumber: string, fallbackValue: unknown) => {
      const moldKey = normalizeMoldLookupKey(moldNumber);
      return productSequenceByMold[moldKey] || formatProductSequenceLabel(fallbackValue) || '';
    },
    [productSequenceByMold],
  );

  const resolveProductRecord = useCallback(
    (moldNumber: string, lookupKey: string) => {
      const exactRecord = productDataByMold[lookupKey];
      if (exactRecord) return exactRecord;

      const moldKey = normalizeMoldLookupKey(moldNumber);
      if (!moldKey) return null;

      return (
        Object.values(productDataByMold).find(
          (record) => normalizeMoldLookupKey(record.moldNumber) === moldKey,
        ) || null
      );
    },
    [productDataByMold],
  );

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStoredAssets() {
      try {
        const response = await apiFetch('/api/dashboard/project-assets');
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          assetsByMold?: Record<string, Partial<Record<SlotId, string>>>;
        };

        if (cancelled) return;

        const nextPreviewUrls: SlotStateMap<string> = {};
        const nextSelectedSlots: Record<string, SlotId> = {};

        for (const project of projects) {
          const moldNumber = String(project.identity?.moldNumber || '').trim();
          const sequenceLabel = resolveProductSequenceLabel(moldNumber, project.no);
          const projectKey = `${moldNumber || 'product'}-${sequenceLabel || project.no || ''}`;
          const moldAssets = moldNumber ? data.assetsByMold?.[moldNumber] : undefined;
          if (!moldAssets) continue;

          for (const { id } of UPLOAD_SLOTS) {
            const imageUrl = moldAssets[id];
            if (typeof imageUrl === 'string' && imageUrl.trim()) {
              nextPreviewUrls[buildSlotKey(projectKey, id)] = imageUrl.trim();
              if (!nextSelectedSlots[projectKey]) {
                nextSelectedSlots[projectKey] = id;
              }
            }
          }
        }

        setPreviewUrls((prev) => {
          const next = { ...prev };
          for (const project of projects) {
            const moldNumber = String(project.identity?.moldNumber || '').trim();
            const sequenceLabel = resolveProductSequenceLabel(moldNumber, project.no);
            const projectKey = `${moldNumber || 'product'}-${sequenceLabel || project.no || ''}`;
            for (const { id } of UPLOAD_SLOTS) {
              const slotKey = buildSlotKey(projectKey, id);
              const existing = next[slotKey];
              if (existing?.startsWith('blob:')) continue;
              if (nextPreviewUrls[slotKey]) {
                next[slotKey] = nextPreviewUrls[slotKey];
              } else {
                delete next[slotKey];
              }
            }
          }
          return next;
        });

        setSelectedSlots((prev) => ({ ...prev, ...nextSelectedSlots }));
      } catch {
        if (cancelled) return;
      }
    }

    void loadStoredAssets();

    return () => {
      cancelled = true;
    };
  }, [projects, resolveProductSequenceLabel]);

  const setPreviewUrlForSlot = useCallback((url: string, slotKey: string) => {
    setPreviewUrls((prev) => {
      const previousUrl = prev[slotKey];
      if (previousUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previousUrl);
      }
      return { ...prev, [slotKey]: url };
    });
  }, []);

  const selectSlotForViewport = useCallback((projectKey: string, type: SlotId) => {
    setSelectedSlots((prev) => ({ ...prev, [projectKey]: type }));
  }, []);

  const openLightbox = useCallback((url: string) => {
    setLightboxImageUrl(url);
    setLightboxRotation(0);
    setIsLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setIsLightboxOpen(false);
    setLightboxImageUrl('');
    setLightboxRotation(0);
  }, []);

  const uploadToServer = useCallback(
    async (moldNumber: string, compressedFile: File, type: SlotId): Promise<string> => {
      let uploadedUrl = '';

      try {
        const uploadResult = await uploadAssetViaServer({
          file: compressedFile,
          category: 'dashboard-product-asset',
          entityId: moldNumber,
          slot: type,
        });
        uploadedUrl = uploadResult.url;

        const response = await apiFetch(`/api/dashboard/project-assets/${encodeURIComponent(moldNumber)}/${type}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: uploadResult.url }),
        });
        if (!response.ok) {
          const normalizedPayload = await response.json().catch(() => null);
          throw normalizeDashboardApiError(normalizedPayload, response.status, 'PROJECT_ASSET_SAVE_FAILED');
        }

        return uploadResult.url;
      } catch (error) {
        if (uploadedUrl) {
          await deleteAssetViaServer(uploadedUrl).catch(() => undefined);
        }
        throw error;
      }
    },
    [],
  );

  const deleteFromServer = useCallback(async (moldNumber: string, type: SlotId): Promise<void> => {
    const response = await apiFetch(`/api/dashboard/project-assets/${encodeURIComponent(moldNumber)}/${type}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const normalizedPayload = await response.json().catch(() => null);
      throw normalizeDashboardApiError(normalizedPayload, response.status, 'PROJECT_ASSET_DELETE_FAILED');
    }
  }, []);

  const handleImageUpload = useCallback((projectKey: string, type: SlotId) => {
    const slotKey = buildSlotKey(projectKey, type);
    setSlotErrors((prev) => ({ ...prev, [slotKey]: '' }));
    inputRefs.current[slotKey]?.click();
  }, []);

  const handleImageDelete = useCallback(
    async (projectKey: string, moldNumber: string, type: SlotId) => {
      const slotKey = buildSlotKey(projectKey, type);
      const deletedUrl = previewUrlsRef.current[slotKey];

      setUploadingSlots((prev) => ({ ...prev, [slotKey]: true }));
      setSlotErrors((prev) => ({ ...prev, [slotKey]: '' }));

      try {
        if (!moldNumber) {
          throw new Error('缺少模具编号，无法删除图片');
        }

        await deleteFromServer(moldNumber, type);

        setPreviewUrls((prev) => {
          const previousUrl = prev[slotKey];
          if (previousUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(previousUrl);
          }
          const next = { ...prev };
          delete next[slotKey];
          return next;
        });

        setSelectedSlots((prev) => {
          if (prev[projectKey] !== type) return prev;
          const nextSlot = UPLOAD_SLOTS.find(
            ({ id }) => id !== type && !!previewUrlsRef.current[buildSlotKey(projectKey, id)],
          )?.id;
          if (!nextSlot) {
            const next = { ...prev };
            delete next[projectKey];
            return next;
          }
          return { ...prev, [projectKey]: nextSlot };
        });

        if (lightboxImageUrl && deletedUrl && lightboxImageUrl === deletedUrl) {
          closeLightbox();
        }
      } catch (error) {
        setSlotErrors((prev) => ({
          ...prev,
          [slotKey]: getDashboardApiErrorDisplayMessage(error, 'Delete failed'),
        }));
      } finally {
        setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }));
        setUploadProgress((prev) => ({ ...prev, [slotKey]: 0 }));
      }
    },
    [closeLightbox, deleteFromServer, lightboxImageUrl],
  );

  const handleFileChange = useCallback(
    async (projectKey: string, moldNumber: string, type: SlotId, event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const slotKey = buildSlotKey(projectKey, type);
      event.target.value = '';
      if (!file) return;

      if (!moldNumber) {
        setSlotErrors((prev) => ({ ...prev, [slotKey]: '缺少模具编号，无法保存图片' }));
        return;
      }

      if (!file.type.startsWith('image/')) {
        setSlotErrors((prev) => ({ ...prev, [slotKey]: '仅支持图片文件' }));
        return;
      }

      setUploadingSlots((prev) => ({ ...prev, [slotKey]: true }));
      setUploadProgress((prev) => ({ ...prev, [slotKey]: 8 }));
      setSlotErrors((prev) => ({ ...prev, [slotKey]: '' }));

      try {
        const processedFile = await compressImage(file);
        setUploadProgress((prev) => ({ ...prev, [slotKey]: 68 }));
        const persistedUrl = await uploadToServer(moldNumber, processedFile, type);
        setUploadProgress((prev) => ({ ...prev, [slotKey]: 100 }));
        setPreviewUrlForSlot(persistedUrl, slotKey);
        selectSlotForViewport(projectKey, type);
      } catch (error) {
        setSlotErrors((prev) => ({
          ...prev,
          [slotKey]: getDashboardApiErrorDisplayMessage(error, 'Upload failed'),
        }));
      } finally {
        setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }));
        window.setTimeout(() => {
          setUploadProgress((prev) => ({ ...prev, [slotKey]: 0 }));
        }, 240);
      }
    },
    [selectSlotForViewport, setPreviewUrlForSlot, uploadToServer],
  );

  if (projects.length === 0) {
    return <div className="flex items-center justify-center py-20 text-lg text-slate-500">产品模块暂无数据</div>;
  }

  const panelStyle = {
    '--product-theme-rgb': theme.rgb,
  } as CSSProperties;

  return (
    <>
      <div className="space-y-6">
        {projects.map((project, index) => {
          const moldNumber = String(project.identity?.moldNumber || '').trim();
          const sequenceLabel = resolveProductSequenceLabel(moldNumber, project.no);
          const productKey = `${moldNumber || 'product'}-${sequenceLabel || project.no || index}`;
          const productLookupKey = buildProductModuleLookupKey(moldNumber, sequenceLabel || project.no);
          const productRecord = resolveProductRecord(moldNumber, productLookupKey);
          const productName =
            productRecord?.productName ||
            readAnchor(project, ['identity.productName', 'identity.projectName']);
          const moldId = readAnchor(project, ['identity.moldNumber', 'moldId']);
          const serialNumber =
            productRecord?.serialNumber ||
            sequenceLabel ||
            formatProductSequenceLabel(project.no) ||
            `No. ${index + 1}`;
          const netWeight =
            productRecord?.netWeight ||
            readAnchor(project, ['product.netWeight', 'pdm.netWeight', 'metrics.netWeight', 'identity.netWeight']);
          const runnerWeight =
            productRecord?.runnerWeight ||
            readAnchor(project, [
              'product.runnerWeight',
              'pdm.runnerWeight',
              'metrics.runnerWeight',
              'identity.runnerWeight',
            ]);
          const productSize =
            productRecord?.productSize ||
            readAnchor(project, ['product.productSize', 'pdm.productSize', 'metrics.productSize', 'identity.productSize']);
          const cavityNumber =
            productRecord?.cavityNumber ||
            readAnchor(project, ['identity.cavityNumber', 'product.cavityNumber', 'pdm.cavityNumber']);
          const material =
            productRecord?.material ||
            readAnchor(project, ['product.material', 'pdm.material', 'identity.material', 'identity.customerBase']);
          const materialErpCode =
            productRecord?.materialErpCode ||
            readAnchor(project, [
              'product.materialErpCode',
              'pdm.materialErpCode',
              'identity.materialErpCode',
              'identity.partNumber',
            ]);
          const recycledMaterialErpCode =
            productRecord?.recycledMaterialErpCode ||
            readAnchor(project, ['product.recycledMaterialErpCode', 'pdm.recycledMaterialErpCode']);
          const recycledMaterialSpec =
            productRecord?.recycledMaterialSpec ||
            readAnchor(project, ['product.recycledMaterialSpec', 'pdm.recycledMaterialSpec']);
          const rawMaterialName =
            productRecord?.rawMaterialName ||
            readAnchor(project, ['product.rawMaterialName', 'pdm.rawMaterialName']);
          const rawMaterialSpec =
            productRecord?.rawMaterialSpec ||
            readAnchor(project, ['product.rawMaterialSpec', 'pdm.rawMaterialSpec']);
          const finishedPartNumber =
            productRecord?.finishedPartNumber ||
            readAnchor(project, ['product.finishedPartNumber', 'pdm.finishedPartNumber']);
          const semiFinishedPartNumber =
            productRecord?.semiFinishedPartNumber ||
            readAnchor(project, ['product.semiFinishedPartNumber', 'pdm.semiFinishedPartNumber']);
          const internalFinishedErpCode =
            productRecord?.internalFinishedErpCode ||
            readAnchor(project, [
              'product.internalFinishedErpCode',
              'pdm.internalFinishedErpCode',
              'identity.internalFinishedErpCode',
            ]);
          const internalSemiFinishedErpCode =
            productRecord?.internalSemiFinishedErpCode ||
            readAnchor(project, ['product.internalSemiFinishedErpCode', 'pdm.internalSemiFinishedErpCode']);
          const internalProductName =
            productRecord?.internalProductName ||
            readAnchor(project, ['product.internalProductName', 'pdm.internalProductName']);
          const moldSize =
            productRecord?.moldSize ||
            readAnchor(project, ['product.moldSize', 'pdm.moldSize', 'identity.moldSize']);
          const moldWeight =
            productRecord?.moldWeight ||
            readAnchor(project, ['product.moldWeight', 'pdm.moldWeight', 'identity.moldWeight']);
          const machineTonnage =
            productRecord?.machineTonnage ||
            readAnchor(project, ['product.machineTonnage', 'pdm.machineTonnage', 'identity.machineTonnage']);
          const moldMaterial =
            productRecord?.moldMaterial ||
            readAnchor(project, ['product.moldMaterial', 'pdm.moldMaterial', 'identity.moldMaterial']);
          const t0Time = normalizeT0DisplayValue(
            productRecord?.t0Time ||
              readAnchor(project, [
                'product.t0Time',
                'pdm.t0Time',
                'identity.t0Time',
                'milestones.projectStart',
              ]),
          );
          const assetNumber =
            productRecord?.assetNumber ||
            readAnchor(project, ['product.assetNumber', 'pdm.assetNumber', 'identity.assetNumber']);
          const moldOwner =
            productRecord?.moldOwner ||
            readAnchor(project, ['product.moldOwner', 'pdm.moldOwner', 'identity.moldOwner']);
          const serviceLife =
            productRecord?.serviceLife ||
            readAnchor(project, ['product.serviceLife', 'pdm.serviceLife', 'identity.serviceLife']);

          const activeSlotId =
            selectedSlots[productKey] && previewUrls[buildSlotKey(productKey, selectedSlots[productKey])]
              ? selectedSlots[productKey]
              : UPLOAD_SLOTS.find(({ id }) => !!previewUrls[buildSlotKey(productKey, id)])?.id;
          const activePreviewUrl = activeSlotId ? previewUrls[buildSlotKey(productKey, activeSlotId)] : '';
          const activeSlotLabel =
            UPLOAD_SLOTS.find(({ id }) => id === activeSlotId)?.label || '产品视窗';

          return (
            <div
              key={productKey}
              className="flex flex-col gap-6 rounded-xl border border-white/6 bg-slate-900/40 p-6 lg:flex-row"
              style={panelStyle}
            >
              <div className="lg:w-[40%]">
                <div
                  onClick={() => {
                    if (activePreviewUrl) {
                      openLightbox(activePreviewUrl);
                    }
                  }}
                  className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[#050812] ${
                    activePreviewUrl ? 'cursor-pointer hover:cursor-zoom-in' : ''
                  }`}
                >
                  {activePreviewUrl ? (
                    <>
                      <img
                        src={activePreviewUrl}
                        alt={`${activeSlotLabel}预览`}
                        className="absolute inset-4 h-[calc(100%-32px)] w-[calc(100%-32px)] rounded-xl object-contain"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#050812] via-[#050812]/88 to-transparent px-6 pb-6 pt-16">
                        <div className={LABEL_CLASS}>{activeSlotLabel}</div>
                        <div className={`mt-1 text-base ${VALUE_CLASS}`}>{productName}</div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5"
                        style={{ boxShadow: `0 0 0 1px rgba(${theme.rgb}, 0.08)` }}
                      >
                        <Box className="h-10 w-10 text-slate-600" />
                      </div>
                      <div className="space-y-1">
                        <div className={LABEL_CLASS}>产品视窗</div>
                        <div className={`text-base ${VALUE_CLASS}`}>{productName}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col lg:w-[60%]">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-100">{productName}</h2>
                </div>

                <div className="mt-4">
                  <div className="grid grid-cols-4 gap-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                    <ProductDataItem label={'\u6a21\u5177\u7f16\u53f7'} value={moldId || '-'} />
                    <ProductDataItem label={'\u6a21\u5177\u7a74\u53f7'} value={cavityNumber || '-'} />
                    <ProductDataItem label="NO." value={serialNumber || '-'} />
                    <ProductDataItem label={'T0\u65f6\u95f4'} value={t0Time || '-'} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="grid grid-cols-4 gap-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                    <ProductDataItem label={'\u6a21\u5177\u5c3a\u5bf8 (mm)'} value={moldSize || '-'} />
                    <ProductDataItem label={'\u6a21\u5177\u91cd\u91cf (kg)'} value={moldWeight || '-'} />
                    <ProductDataItem label={'\u6a21\u5177\u6750\u8d28'} value={moldMaterial || '-'} />
                    <ProductDataItem label={'\u6a21\u5177\u5bff\u547d'} value={serviceLife || '-'} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="grid grid-cols-4 gap-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                    <ProductDataItem label={'\u6210\u578b\u6750\u8d28'} value={material || '-'} />
                    <ProductDataItem label={'\u6210\u578b\u673a\u53f0\u5428\u4f4d'} value={machineTonnage || '-'} />
                    <ProductDataItem label={'\u8d44\u4ea7\u7f16\u53f7'} value={assetNumber || '-'} />
                    <ProductDataItem label={'\u6a21\u5177\u8d1f\u8d23\u4eba'} value={moldOwner || '-'} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="grid grid-cols-4 gap-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                    <ProductDataItem label={'\u4ea7\u54c1\u51c0\u91cd (g)'} value={netWeight || '-'} />
                    <ProductDataItem label={'\u6599\u5934\u51c0\u91cd (g)'} value={runnerWeight || '-'} />
                    <ProductDataItem label={'\u4ea7\u54c1\u5c3a\u5bf8 (mm)'} value={productSize || '-'} />
                    <ProductDataItem label={'\u56de\u6599\u54c1\u53f7'} value={recycledMaterialErpCode || '-'} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="grid grid-cols-4 gap-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                    <ProductDataItem label={'\u539f\u6599\u54c1\u53f7'} value={materialErpCode || '-'} />
                    <ProductDataItem label={'\u539f\u6599\u54c1\u540d'} value={rawMaterialName || '-'} />
                    <ProductDataItem label={'\u539f\u6599\u89c4\u683c'} value={rawMaterialSpec || '-'} />
                    <ProductDataItem label={'\u56de\u6599\u89c4\u683c'} value={recycledMaterialSpec || '-'} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="grid grid-cols-4 gap-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                    <ProductDataItem label={'\u6210\u54c1\u6599\u53f7'} value={finishedPartNumber || '-'} />
                    <ProductDataItem label={'\u534a\u54c1\u6599\u53f7'} value={semiFinishedPartNumber || '-'} />
                    <ProductDataItem label={'\u6210\u54c1\u54c1\u53f7'} value={internalFinishedErpCode || '-'} />
                    <ProductDataItem label={'\u534a\u54c1\u54c1\u53f7'} value={internalSemiFinishedErpCode || '-'} />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                  {UPLOAD_SLOTS.map(({ id, label, icon: Icon }) => {
                    const slotKey = buildSlotKey(productKey, id);
                    const previewUrl = previewUrls[slotKey];
                    const isUploading = !!uploadingSlots[slotKey];
                    const errorMessage = slotErrors[slotKey];
                    const progressValue = uploadProgress[slotKey] || 0;

                    return (
                      <div key={slotKey} className="flex flex-col">
                        <div className="group relative flex flex-col items-stretch overflow-hidden rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 transition-all">
                          <input
                            ref={(node) => {
                              inputRefs.current[slotKey] = node;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleFileChange(productKey, moldNumber, id, event)}
                            disabled={isUploading}
                          />

                          <div
                            onClick={() => {
                              if (previewUrl) {
                                selectSlotForViewport(productKey, id);
                              }
                            }}
                            className={
                              previewUrl
                                ? 'relative flex aspect-square cursor-pointer items-center justify-center p-3'
                                : 'relative flex aspect-square cursor-default items-center justify-center p-3'
                            }
                          >
                            {previewUrl && (
                              <img
                                src={previewUrl}
                                alt={`${label}预览`}
                                className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-t-lg object-cover transition-opacity"
                              />
                            )}

                            {!previewUrl && !isUploading && !errorMessage && (
                              <>
                                <Icon className="h-5 w-5 text-slate-600 group-hover:text-cyan-400" />
                                <span className="mt-2 text-center text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-cyan-400">
                                  {label}
                                </span>
                              </>
                            )}

                            {isUploading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-1.5">
                                  <LoaderCircle className="h-5 w-5 animate-spin text-cyan-400" />
                                  <span className="text-[10px] font-medium text-cyan-300">{progressValue}%</span>
                                </div>
                              </div>
                            )}

                            {errorMessage && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/70 p-2 text-center">
                                <AlertTriangle className="mb-1 h-4 w-4 text-rose-400" />
                                <span className="text-[9px] font-medium text-rose-300">{errorMessage}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-nowrap items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/50 p-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleImageUpload(productKey, id);
                            }}
                            className="group/btn flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors hover:bg-slate-700"
                          >
                            <UploadCloud className="h-3.5 w-3.5 text-slate-500 group-hover/btn:text-cyan-400" />
                            <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover/btn:text-cyan-100">
                              上传
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!previewUrl || isUploading) return;
                              setPendingDeleteSlot({ projectKey: productKey, moldNumber, type: id });
                            }}
                            disabled={!previewUrl || isUploading}
                            className={`group/btn flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                              previewUrl && !isUploading ? 'hover:bg-rose-950' : 'cursor-not-allowed opacity-45'
                            }`}
                          >
                            <Trash2
                              className={`h-3.5 w-3.5 ${
                                previewUrl && !isUploading
                                  ? 'text-slate-500 group-hover/btn:text-rose-400'
                                  : 'text-slate-600'
                              }`}
                            />
                            <span
                              className={`whitespace-nowrap text-[10px] font-bold uppercase tracking-widest ${
                                previewUrl && !isUploading
                                  ? 'text-slate-400 group-hover/btn:text-rose-100'
                                  : 'text-slate-600'
                              }`}
                            >
                              删除
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isLightboxOpen && (
        <div
          onClick={closeLightbox}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-slate-950/95 p-6 backdrop-blur-md"
        >
          <div
            className="flex max-w-[90vw] flex-col items-center"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-[85vh] w-[90vw] items-center justify-center overflow-hidden">
              <img
                src={lightboxImageUrl}
                alt="Original preview"
                className={`rounded-2xl border border-slate-700 object-contain shadow-2xl transition-transform duration-200 ${
                  Math.abs(lightboxRotation % 180) === 90
                    ? 'max-h-[90vw] max-w-[85vh]'
                    : 'max-h-full max-w-full'
                }`}
                style={{ transform: `rotate(${lightboxRotation}deg)` }}
              />
            </div>

            <div className="mt-1 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setLightboxRotation((prev) => prev - 90)}
                className="rounded-full border border-slate-700 bg-slate-800/90 p-2 transition-colors hover:bg-slate-700"
                aria-label="Rotate left"
                title="Rotate left"
              >
                <RotateCcw className="h-5 w-5 text-slate-300" />
              </button>

              <button
                type="button"
                onClick={() => setLightboxRotation((prev) => prev + 90)}
                className="rounded-full border border-slate-700 bg-slate-800/90 p-2 transition-colors hover:bg-slate-700"
                aria-label="Rotate right"
                title="Rotate right"
              >
                <RotateCw className="h-5 w-5 text-slate-300" />
              </button>

              <button
                type="button"
                onClick={closeLightbox}
                className="rounded-full border border-slate-700 bg-slate-800/90 p-2 transition-colors hover:bg-slate-700"
                aria-label="Close preview"
                title="Close preview"
              >
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>

            <span className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Original Preview ( click anywhere to close )
            </span>
          </div>
        </div>
      )}

      <CyberConfirmDialog
        open={!!pendingDeleteSlot}
        title="Delete confirmation"
        message="Delete this image? This action cannot be undone."
        onConfirm={() => {
          const target = pendingDeleteSlot;
          setPendingDeleteSlot(null);
          if (!target) return;
          void handleImageDelete(target.projectKey, target.moldNumber, target.type);
        }}
        onCancel={() => setPendingDeleteSlot(null)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}
