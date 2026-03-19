import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import imageCompression from 'browser-image-compression';
import { FileText, Loader2, Upload, X, ZoomIn } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { deleteAssetViaServer, uploadAssetViaServer } from '@/lib/ossUpload';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';

interface EvidenceItem {
  id: string;
  taskId: string;
  type: string;
  url: string;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  description?: string | null;
  createdAt?: string;
}

interface EvidenceUploadProps {
  taskId: string;
}

const MAX_SIZE_BYTES = 500 * 1024;

async function compressIfImage(file: File): Promise<File> {
  if (!/^image\//.test(file.type)) return file;
  if (file.size <= MAX_SIZE_BYTES) return file;

  return imageCompression(file, {
    maxSizeMB: 0.48,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    initialQuality: 0.8,
  });
}

function buildEvidenceUrl(taskId: string): string {
  return '/api/gantt/task/' + encodeURIComponent(taskId) + '/evidence';
}

function buildDeleteUrl(evidenceId: string): string {
  return '/api/gantt/evidence/' + encodeURIComponent(evidenceId);
}

export default function EvidenceUpload({ taskId }: EvidenceUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<EvidenceItem | null>(null);

  useEffect(() => {
    if (!taskId) return;

    apiFetch(buildEvidenceUrl(taskId))
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(data);
        }
      })
      .catch(() => undefined);
  }, [taskId]);

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      let uploadedUrl = '';

      try {
        const compressed = await compressIfImage(file);
        const uploadResult = await uploadAssetViaServer({
          file: compressed,
          category: 'task-evidence',
          entityId: taskId,
          slot: /^image\//.test(compressed.type || file.type) ? 'image' : 'document',
        });
        uploadedUrl = uploadResult.url;

        const evidenceType = /^image\//.test(compressed.type || file.type) ? 'photo' : 'document';
        const response = await apiFetch(buildEvidenceUrl(taskId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: evidenceType,
            url: uploadResult.url,
            fileName: file.name,
            fileSize: compressed.size,
            mimeType: compressed.type || file.type,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || '保存证据记录失败');
        }

        const newItem = (await response.json()) as EvidenceItem;
        setItems((prev) => [...prev, newItem]);
      } catch (uploadError) {
        if (uploadedUrl) {
          await deleteAssetViaServer(uploadedUrl).catch(() => undefined);
        }
        setError('证据上传失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    },
    [taskId],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) handleUpload(file);
      event.target.value = '';
    },
    [handleUpload],
  );

  const handleDelete = useCallback(async (item: EvidenceItem) => {
    try {
      const response = await apiFetch(buildDeleteUrl(item.id), { method: 'DELETE' });
      if (response.ok) {
        setItems((prev) => prev.filter((current) => current.id !== item.id));
      }
    } catch {
      return;
    }
  }, []);

  const isImage = (item: EvidenceItem) =>
    item.type === 'photo' || /^image\//.test(item.mimeType ?? '');

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="aspect-square rounded-xl bg-white/[0.02] border border-white/[0.06] relative overflow-hidden group cursor-pointer"
            onClick={() => (isImage(item) ? setPreviewUrl(item.url) : window.open(item.url, '_blank'))}
          >
            {isImage(item) ? (
              <img src={item.url} alt={item.fileName ?? ''} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                <FileText className="w-5 h-5 text-white/20" />
                <span className="text-[7px] text-white/30 px-1 truncate w-full text-center">{item.fileName}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {isImage(item) && <ZoomIn className="w-3.5 h-3.5 text-white/80" />}
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setPendingDeleteItem(item);
                }}
                className="w-5 h-5 rounded-full bg-red-500/30 flex items-center justify-center hover:bg-red-500/60 transition-colors"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        ))}

        {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, index) => (
          <div
            key={'slot-' + index}
            className="aspect-square rounded-xl bg-white/[0.02] border border-dashed border-white/[0.06] flex flex-col items-center justify-center gap-1 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all cursor-pointer group"
            onClick={() => inputRef.current?.click()}
          >
            {loading && index === 0 ? (
              <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
            ) : (
              <>
                <Upload className="w-4 h-4 text-white/10 group-hover:text-white/25 transition-colors" />
                <span className="text-[8px] text-white/15 group-hover:text-white/30">上传</span>
              </>
            )}
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={handleFileChange}
        disabled={loading}
      />

      {error && <p className="text-[10px] text-red-400 mt-1.5">{error}</p>}

      {previewUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setPreviewUrl(null)}
          >
            <div className="relative max-w-[80vw] max-h-[80vh]">
              <img
                src={previewUrl}
                alt="证据预览"
                className="max-w-full max-h-[80vh] object-contain rounded-xl"
              />
              <button
                className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                onClick={() => setPreviewUrl(null)}
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>,
          document.body,
        )}

      <CyberConfirmDialog
        open={!!pendingDeleteItem}
        title="删除证据确认"
        message="确定要删除该证据吗？删除后不可恢复。"
        onCancel={() => setPendingDeleteItem(null)}
        onConfirm={async () => {
          if (pendingDeleteItem) {
            await handleDelete(pendingDeleteItem);
          }
          setPendingDeleteItem(null);
        }}
        confirmText="确认删除"
        cancelText="取消"
      />
    </div>
  );
}
