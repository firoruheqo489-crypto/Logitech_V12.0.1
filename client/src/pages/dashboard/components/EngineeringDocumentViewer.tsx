'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Paperclip,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
  Maximize2,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleTheme } from '@/lib/theme';
import { apiFetch } from '@/lib/api';
import { deleteAssetViaServer, uploadAssetViaServer } from '@/lib/ossUpload';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import AssetDrawerWorkspace, { type AssetPanelItem } from './AssetDrawerWorkspace';
import { normalizeMoldLookupKey } from '../lib/productModuleUtils';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';

type ProductDocSlotType = 'drawing-2d' | 'measurement-method' | 'product-standard';
type DocumentLayoutType = 'landscape-a4' | 'standard';
type DocumentFileType = 'pdf' | 'image' | 'mixed';

type ProductDocRecord = {
  moldNumber: string;
  slotType: ProductDocSlotType;
  fileUrl: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

type ProductDocsByMold = Record<string, Partial<Record<ProductDocSlotType, ProductDocRecord>>>;

type ProductDocsDrawerWorkspaceProps = {
  panels: AssetPanelItem[];
  theme: ModuleTheme;
};

type SlotConfig = {
  slotType: ProductDocSlotType;
  label: string;
  description: string;
  icon: LucideIcon;
  accept: string;
  layoutType: DocumentLayoutType;
  fileType: DocumentFileType;
  supportsPagination?: boolean;
};

type PendingDeleteState = { slotType: ProductDocSlotType; fileName: string } | null;

const SLOT_CONFIGS: SlotConfig[] = [
  {
    slotType: 'drawing-2d',
    label: '2D 图纸',
    description: '横向 A4 预览，支持混合格式',
    icon: FileText,
    accept: '.pdf,application/pdf,application/x-pdf,application/acrobat,.xls,.xlsx,.png,.jpg,.jpeg,.webp',
    layoutType: 'landscape-a4',
    fileType: 'mixed',
  },
  {
    slotType: 'measurement-method',
    label: '测量方法 MTD',
    description: '横向 A4，仅支持多页 PDF',
    icon: FileSpreadsheet,
    accept: '.pdf,application/pdf,application/x-pdf,application/acrobat',
    layoutType: 'landscape-a4',
    fileType: 'pdf',
    supportsPagination: true,
  },
  {
    slotType: 'product-standard',
    label: '产品标准',
    description: '支持 PDF / Excel / 图片',
    icon: ImageIcon,
    accept: '.pdf,application/pdf,application/x-pdf,application/acrobat,.xls,.xlsx,.png,.jpg,.jpeg,.webp',
    layoutType: 'standard',
    fileType: 'mixed',
  },
];

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function readRouteErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

function readText(value: unknown): string {
  return String(value ?? '').trim();
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const parsed = Number(readText(value));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
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

function useFetchedObjectUrl(sourceUrl: string | undefined, enabled: boolean): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !sourceUrl) {
      setObjectUrl(null);
      return;
    }

    const controller = new AbortController();
    let nextObjectUrl = '';

    setObjectUrl(null);

    void (async () => {
      try {
        const response = await fetch(sourceUrl, { signal: controller.signal });
        if (!response.ok) return;
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        nextObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(nextObjectUrl);
      } catch {
        // Fall back to the original URL if the blob fetch fails.
      }
    })();

    return () => {
      controller.abort();
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [enabled, sourceUrl]);

  return objectUrl;
}

function isImageFile(record: ProductDocRecord): boolean {
  return /^image\//i.test(record.mimeType || '') || /\.(png|jpg|jpeg|webp|gif)$/i.test(record.fileName);
}

function isPdfFile(record: ProductDocRecord): boolean {
  return /application\/(pdf|x-pdf|acrobat)/i.test(record.mimeType || '') || /\.pdf$/i.test(record.fileName);
}

function isExcelFile(record: ProductDocRecord): boolean {
  return /spreadsheetml|ms-excel/i.test(record.mimeType || '') || /\.(xls|xlsx)$/i.test(record.fileName);
}

function isAllowedFile(file: File, slotConfig: SlotConfig): boolean {
  if (slotConfig.fileType === 'pdf') {
    return (
      /application\/(pdf|x-pdf|acrobat)/i.test(file.type) ||
      /\.pdf$/i.test(file.name)
    );
  }

  return (
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    /excel|spreadsheetml/i.test(file.type) ||
    /\.(pdf|xls|xlsx|png|jpe?g|webp|gif)$/i.test(file.name)
  );
}

function normalizeDocRecord(raw: unknown): ProductDocRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const moldNumber = readText(row.mold_number);
  const slotType = readText(row.slot_type) as ProductDocSlotType;
  const fileUrl = readText(row.file_url);
  const fileName = readText(row.file_name);
  if (!moldNumber || !slotType || !fileUrl || !fileName) return null;
  return {
    moldNumber: normalizeMoldLookupKey(moldNumber),
    slotType,
    fileUrl,
    fileName,
    mimeType: typeof row.mime_type === 'string' ? row.mime_type : null,
    fileSize: readNumber(row.file_size),
    createdAt: typeof row.created_at === 'string' ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
}

function buildDocsByMold(rows: ProductDocRecord[]): ProductDocsByMold {
  const next: ProductDocsByMold = {};
  for (const row of rows) {
    const key = normalizeMoldLookupKey(row.moldNumber);
    if (!key) continue;
    if (!next[key]) next[key] = {};
    next[key][row.slotType] = row;
  }
  return next;
}

function SlotIcon({ record }: { record?: ProductDocRecord }): ReactElement {
  if (!record) return <Paperclip className="h-5 w-5 text-slate-500" />;
  if (isImageFile(record)) return <ImageIcon className="h-5 w-5 text-cyan-300" />;
  if (isExcelFile(record)) return <FileSpreadsheet className="h-5 w-5 text-emerald-300" />;
  if (isPdfFile(record)) return <FileText className="h-5 w-5 text-amber-300" />;
  return <FileText className="h-5 w-5 text-slate-300" />;
}

function DocumentPreviewModal({ record, onClose }: { record: ProductDocRecord; onClose: () => void }): ReactElement {
  const previewUrl = useFetchedObjectUrl(record.fileUrl, isImageFile(record) || isPdfFile(record));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/85 p-4 md:p-8" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/60 p-2 text-white/80 transition-colors hover:bg-black/80 hover:text-white"
        aria-label="关闭预览"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex max-h-full max-w-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-slate-200">{record.fileName}</div>
        <img
          src={previewUrl || record.fileUrl}
          alt={record.fileName}
          className="max-h-[calc(100vh-140px)] max-w-[calc(100vw-48px)] rounded-2xl object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}

function PdfPageCanvas({
  pdfDocument,
  pageNumber,
  zoomed = false,
  zoomOrigin = { x: 50, y: 50 },
  onToggleZoom,
}: {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  zoomed?: boolean;
  zoomOrigin?: { x: number; y: number };
  onToggleZoom?: (origin: { x: number; y: number }) => void;
}): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any = null;

    const renderPage = async () => {
      const page = await pdfDocument.getPage(pageNumber);
      if (cancelled) return;

      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;

      const scale = 2;
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';

      renderTask = page.render({ canvasContext: context, canvas, viewport });
      await renderTask.promise;
    };

    void renderPage().catch(() => undefined);

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdfDocument]);

  return (
    <div
      className={[
        'w-full overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]',
        onToggleZoom ? (zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in') : '',
      ].join(' ')}
      onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
        if (!onToggleZoom) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * 100;
        const y = ((event.clientY - bounds.top) / bounds.height) * 100;
        onToggleZoom({
          x: Math.min(100, Math.max(0, x)),
          y: Math.min(100, Math.max(0, y)),
        });
      }}
      role={onToggleZoom ? 'button' : undefined}
      tabIndex={onToggleZoom ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onToggleZoom) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggleZoom({ x: 50, y: 50 });
        }
      }}
    >
      <div
        className="transition-transform duration-200"
        style={{
          transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
          transform: zoomed ? 'scale(1.45)' : 'scale(1)',
        }}
      >
        <canvas ref={canvasRef} className="block w-full" />
      </div>
    </div>
  );
}

function PdfFirstPagePreview({ fileUrl }: { fileUrl: string }): ReactElement | null {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setLoadError('');
    setPdfDocument(null);

    const loadingTask = getDocument({ url: fileUrl });

    void loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          void doc.destroy();
          return;
        }
        setPdfDocument(doc);
        setLoadState('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadState('error');
        setLoadError(error instanceof Error ? error.message : 'PDF preview failed');
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [fileUrl]);

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/60">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-cyan-300" />
          <div className="mt-3 text-sm font-semibold text-slate-100">Loading page 1</div>
          <div className="mt-1 text-xs text-slate-500">Rendering the first page preview...</div>
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-sm text-rose-100">
        {loadError || 'PDF preview failed'}
      </div>
    );
  }

  return pdfDocument ? <PdfPageCanvas pdfDocument={pdfDocument} pageNumber={1} /> : null;
}

function PdfReaderModal({
  record,
  onClose,
}: {
  record: ProductDocRecord;
  onClose: () => void;
}): ReactElement {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [magnified, setMagnified] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const canPrev = pageNumber > 1;
  const canNext = pdfDocument ? pageNumber < pdfDocument.numPages : false;

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setLoadError('');
    setPdfDocument(null);
    setPageNumber(1);
    setMagnified(false);
    setZoomOrigin({ x: 50, y: 50 });

    const loadingTask = getDocument({ url: record.fileUrl });

    void loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          void doc.destroy();
          return;
        }
        setPdfDocument(doc);
        setLoadState('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadState('error');
        setLoadError(error instanceof Error ? error.message : 'PDF preview failed');
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [record.fileUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (loadState !== 'ready' || !pdfDocument) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPageNumber((current) => Math.max(1, current - 1));
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPageNumber((current) => Math.min(pdfDocument.numPages, current + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [loadState, onClose, pdfDocument]);

  return (
    <div className="fixed inset-0 z-[9998] bg-black/92 p-3 md:p-6" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-[min(98vw,1600px)] flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">{record.fileName}</div>
            <div className="mt-0.5 text-[11px] tracking-[0.18em] text-slate-500">
              MULTI-PAGE PDF READER
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close PDF reader"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/80">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-xs text-slate-400">
            <span>
              {loadState === 'ready' && pdfDocument
                ? `Page ${pageNumber} of ${pdfDocument.numPages}`
                : 'Loading PDF...'}
            </span>
            <span className="hidden sm:inline">ESC closes the reader</span>
          </div>

          <div className="relative min-h-0 flex-1 overflow-auto p-4 md:p-6">
            <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
              {loadState === 'loading' ? (
                <div className="flex min-h-[50vh] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/60">
                  <div className="text-center">
                    <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
                    <div className="mt-3 text-sm font-semibold text-slate-100">Preparing PDF preview</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Loading the document for full-screen viewing...
                    </div>
                  </div>
                </div>
              ) : loadState === 'error' ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
                  {loadError || 'PDF preview failed'}
                </div>
              ) : pdfDocument ? (
                <PdfPageCanvas
                  pdfDocument={pdfDocument}
                  pageNumber={pageNumber}
                  zoomed={magnified}
                  zoomOrigin={zoomOrigin}
                  onToggleZoom={(origin) => {
                    setZoomOrigin(origin);
                    setMagnified((current) => !current);
                  }}
                />
              ) : null}
            </div>

            {loadState === 'ready' && pdfDocument ? (
              <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 sm:px-4">
                <button
                  type="button"
                  onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
                  disabled={!canPrev}
                  className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/15 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35 sm:h-16 sm:w-16"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" />
                </button>
                <button
                  type="button"
                  onClick={() => setPageNumber((current) => Math.min(pdfDocument.numPages, current + 1))}
                  disabled={!canNext}
                  className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/15 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35 sm:h-16 sm:w-16"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400">{record.fileName}</div>
              <div className="text-xs text-slate-500">
                {loadState === 'ready' && pdfDocument ? `Page ${pageNumber} of ${pdfDocument.numPages}` : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentCard({
  slotConfig,
  record,
  theme,
  busy,
  error,
  onUpload,
  onDelete,
  onOpenDocument,
  onExpandPdfReader,
}: {
  slotConfig: SlotConfig;
  record?: ProductDocRecord;
  theme: ModuleTheme;
  busy: boolean;
  error?: string;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => void;
  onOpenDocument: () => void;
  onExpandPdfReader: () => void;
}): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isImage = record ? isImageFile(record) : false;
  const isPdfShell = !!record && slotConfig.layoutType === 'landscape-a4' && isPdfFile(record);
  const showExpandReader = !!record && isPdfFile(record) && (slotConfig.slotType === 'measurement-method' || slotConfig.slotType === 'drawing-2d');
  const showOpenButton = !!record && !showExpandReader && !slotConfig.supportsPagination;
  const previewClass = slotConfig.layoutType === 'landscape-a4' ? 'aspect-[297/210]' : 'min-h-[280px] md:min-h-[320px]';

  return (
    <section className="flex min-h-[240px] flex-col rounded-3xl border border-white/[0.06] bg-[#0d1422] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] ${theme.iconBg}`}>
            <slotConfig.icon className={`h-5 w-5 ${theme.text}`} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-wide text-slate-100">{slotConfig.label}</div>
            <div className="mt-1 text-[11px] text-slate-500">{slotConfig.description}</div>
            {record ? (
              <div
                className="mt-2 truncate text-[11px] font-medium text-cyan-200/90"
                title={record.fileName}
              >
                {record.fileName}
              </div>
            ) : null}
          </div>
        </div>
        {record ? (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-mono tracking-[0.18em] text-emerald-200">
            Uploaded
          </span>
        ) : (
          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[10px] font-mono tracking-[0.18em] text-slate-500">
            Empty
          </span>
        )}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <div className={`relative flex min-h-[132px] flex-1 flex-col overflow-hidden rounded-[28px] border border-dashed border-white/[0.08] bg-white/[0.02] ${previewClass}`}>
          {record ? (
            <>
              {isPdfShell ? (
                <button
                  type="button"
                  onClick={onExpandPdfReader}
                  className="group relative flex h-full flex-1 flex-col overflow-hidden bg-slate-950/40"
                >
                  <div className="absolute left-4 top-4 z-10 rounded-full border border-cyan-500/20 bg-slate-950/80 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-cyan-100 shadow-lg">
                    PAGE 1
                  </div>
                  <div className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] tracking-[0.18em] text-slate-300 opacity-0 transition-opacity group-hover:opacity-100">
                    OPEN READER
                  </div>
                  <div className="flex h-full w-full items-center justify-center p-4 md:p-6">
                    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                      <PdfFirstPagePreview fileUrl={record.fileUrl} />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/55 via-black/0 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] text-white/80">
                      <Maximize2 className="h-3.5 w-3.5" />
                      Click to expand reader
                    </span>
                  </div>
                </button>
              ) : isImage ? (
                <button
                  type="button"
                  onClick={onOpenDocument}
                  className="group relative flex h-full flex-1 items-center justify-center overflow-hidden bg-slate-950/40"
                >
                  <img
                    src={record.fileUrl}
                    alt={record.fileName}
                    className={`h-full w-full object-contain p-4 md:p-6 ${previewClass}`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] text-white/80">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Click to Preview
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenDocument}
                  className="flex h-full flex-1 items-center justify-center bg-slate-950/30 px-5 py-6"
                >
                  <div className="max-w-2xl text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
                      <SlotIcon record={record} />
                    </div>
                    <div className="truncate text-sm font-medium text-slate-100">{record.fileName}</div>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      {formatFileSize(record.fileSize) ? <span>{formatFileSize(record.fileSize)}</span> : null}
                      <span>{formatDateTimeLabel(record.updatedAt)}</span>
                    </div>
                    <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-100">
                      <RefreshCw className="h-4 w-4" />
                      打开文档
                    </div>
                  </div>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-full min-h-[132px] flex-col items-center justify-center gap-2 rounded-[28px] border border-dashed border-white/[0.08] bg-white/[0.015] transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
            >
              {busy ? (
                <LoaderCircle className="h-6 w-6 animate-spin text-cyan-300" />
              ) : (
                <>
                  <UploadCloud className={`h-6 w-6 ${theme.text}`} />
                  <div className="text-sm text-slate-200">上传文件</div>
                  <div className="text-[11px] text-slate-500">{slotConfig.fileType === 'pdf' ? '仅支持 PDF' : '支持 PDF / Excel / 图片'}</div>
                </>
              )}
            </button>
          )}
        </div>

        {record ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                busy
                  ? 'border-slate-800 bg-slate-900 text-slate-600'
                  : 'border-white/[0.08] bg-white/[0.03] text-slate-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-100'
              }`}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              替换文件
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/15 bg-red-500/10 px-3 py-2 text-xs text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除文件
            </button>
            {showOpenButton ? (
              <button
                type="button"
                onClick={onOpenDocument}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-400 transition-colors hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                打开
              </button>
            ) : null}
            {showExpandReader ? (
              <button
                type="button"
                onClick={onExpandPdfReader}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                展开阅读器
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-xs leading-relaxed text-red-300">{error}</p> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={slotConfig.accept}
        className="hidden"
        disabled={busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) await onUpload(file);
        }}
      />
    </section>
  );
}

function ProductDocsPanel({
  panel,
  docsByMold,
  theme,
  onRefresh,
}: {
  panel: AssetPanelItem;
  docsByMold: ProductDocsByMold;
  theme: ModuleTheme;
  onRefresh: () => Promise<void>;
}): ReactElement {
  const [busySlot, setBusySlot] = useState<ProductDocSlotType | null>(null);
  const [slotErrors, setSlotErrors] = useState<Partial<Record<ProductDocSlotType, string>>>({});
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState>(null);
  const [imagePreviewRecord, setImagePreviewRecord] = useState<ProductDocRecord | null>(null);
  const [pdfReaderRecord, setPdfReaderRecord] = useState<ProductDocRecord | null>(null);
  const moldKey = normalizeMoldLookupKey(panel.moldId);
  const activeDocs = docsByMold[moldKey] || {};

  const uploadDoc = useCallback(
    async (slotType: ProductDocSlotType, file: File) => {
      const slotConfig = SLOT_CONFIGS.find((item) => item.slotType === slotType);
      if (!slotConfig) return;

      if (!isAllowedFile(file, slotConfig)) {
        setSlotErrors((prev) => ({
          ...prev,
          [slotType]: slotConfig.fileType === 'pdf'
            ? 'Measurement MTD accepts PDF files only.'
            : 'Only PDF, Excel, or image files are supported.',
        }));
        return;
      }

      setBusySlot(slotType);
      setSlotErrors((prev) => ({ ...prev, [slotType]: '' }));

      let uploadedUrl = '';
      try {
        const uploadResult = await uploadAssetViaServer({
          file,
          category: 'dashboard-product-doc',
          entityId: panel.moldId,
          slot: slotType,
        });
        uploadedUrl = uploadResult.url;
        const response = await apiFetch(`/api/dashboard/product-docs/${encodeURIComponent(panel.moldId)}/${slotType}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: uploadResult.url,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(readRouteErrorMessage(payload, 'Failed to save document'));
        }
        await onRefresh();
      } catch (error) {
        if (uploadedUrl) await deleteAssetViaServer(uploadedUrl).catch(() => undefined);
        setSlotErrors((prev) => ({
          ...prev,
          [slotType]: error instanceof Error ? error.message : `${slotConfig.label} upload failed`,
        }));
      } finally {
        setBusySlot(null);
      }
    },
    [onRefresh, panel.moldId],
  );

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const nextDelete = pendingDelete;
    const { slotType } = nextDelete;
    setPendingDelete(null);
    setBusySlot(slotType);
    setSlotErrors((prev) => ({ ...prev, [slotType]: '' }));

    try {
      const response = await apiFetch(`/api/dashboard/product-docs/${encodeURIComponent(panel.moldId)}/${slotType}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(readRouteErrorMessage(payload, 'Failed to delete document'));
      }
      await onRefresh();
    } catch (error) {
      setSlotErrors((prev) => ({
        ...prev,
        [slotType]: error instanceof Error ? error.message : 'Failed to delete document',
      }));
    } finally {
      setBusySlot(null);
    }
  }, [onRefresh, panel.moldId, pendingDelete]);

  const openDocument = useCallback((config: SlotConfig, record?: ProductDocRecord) => {
    if (!record) return;
    if (isPdfFile(record)) {
      setPdfReaderRecord(record);
      return;
    }
    if (isImageFile(record)) {
      setImagePreviewRecord(record);
      return;
    }
    window.open(record.fileUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const lastUpdated = useMemo(() => {
    return SLOT_CONFIGS.map((item) => activeDocs[item.slotType]?.updatedAt || '')
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left))[0];
  }, [activeDocs]);

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-[#09101c] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] md:p-5">
      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-mono tracking-[0.24em] text-slate-500">Engineering Documents</div>
          <div className="mt-1 text-sm text-slate-200">
            Current mold <span className="font-semibold text-cyan-300">{panel.moldId}</span>
            {panel.moldNo ? <span className="ml-2 text-xs text-slate-500">{panel.moldNo}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-200">PDF / Excel / Image</span>
          <span>Latest update {formatDateTimeLabel(lastUpdated)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {SLOT_CONFIGS.map((slot) => (
          <DocumentCard
            key={slot.slotType}
            slotConfig={slot}
            record={activeDocs[slot.slotType]}
            theme={theme}
            busy={busySlot === slot.slotType}
            error={slotErrors[slot.slotType]}
            onUpload={(file) => uploadDoc(slot.slotType, file)}
            onDelete={() => {
              const record = activeDocs[slot.slotType];
              if (!record) return;
              setPendingDelete({ slotType: slot.slotType, fileName: record.fileName });
            }}
            onOpenDocument={() => openDocument(slot, activeDocs[slot.slotType])}
            onExpandPdfReader={() => {
              const record = activeDocs[slot.slotType];
              if (!record) return;
              setPdfReaderRecord(record);
            }}
          />
        ))}
      </div>

      <CyberConfirmDialog
        open={pendingDelete !== null}
        title="删除文件确认"
        message={pendingDelete
          ? `确定要删除 ${SLOT_CONFIGS.find((item) => item.slotType === pendingDelete.slotType)?.label || '当前文件'} 中的 ${pendingDelete.fileName} 吗？\n删除后该文件和预览内容将无法恢复。`
          : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
        confirmText="确认删除"
        cancelText="取消"
        allowEnterConfirm={false}
      />

      {imagePreviewRecord ? <DocumentPreviewModal record={imagePreviewRecord} onClose={() => setImagePreviewRecord(null)} /> : null}
      {pdfReaderRecord ? (
        <PdfReaderModal
          record={pdfReaderRecord}
          onClose={() => setPdfReaderRecord(null)}
        />
      ) : null}
    </div>
  );
}

export default function EngineeringDocumentViewer({ panels, theme }: ProductDocsDrawerWorkspaceProps) {
  const [docsByMold, setDocsByMold] = useState<ProductDocsByMold>({});
  const [loading, setLoading] = useState(true);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/dashboard/product-docs');
      if (!response.ok) return;
      const payload = (await response.json().catch(() => null)) as { rows?: unknown[] } | null;
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      setDocsByMold(buildDocsByMold(rows.map(normalizeDocRecord).filter((row): row is ProductDocRecord => row !== null)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const drawerDescription = loading
    ? 'Loading engineering documents...'
    : 'Select a mold to upload or replace the drawing set, measurement PDF, or product standard package.';

  return (
    <AssetDrawerWorkspace
      panels={panels}
      badgeLabel="Engineering Documents"
      drawerTitle="Engineering Documents"
      drawerDescription={drawerDescription}
      emptyMessage="No molds available"
      icon={ImageIcon}
      renderPanel={(panel) => (
        <ProductDocsPanel
          key={`${panel.moldId}::${panel.moldNo}`}
          panel={panel}
          docsByMold={docsByMold}
          theme={theme}
          onRefresh={loadDocs}
        />
      )}
    />
  );
}
