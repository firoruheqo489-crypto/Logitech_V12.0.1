/**
 * ProductImageUpload — 智能压缩产品图上传框 (Image Upload Center)
 *
 * 空间标定: 120×80 固定宽高比，虚线边框，深灰背景
 * 智能压缩: ≤500KB 直接上传，>500KB 客户端压缩至 <500KB，统一 webp/jpeg
 * 持久化: Supabase Storage project-assets 桶 + projects.product_image_url
 */

import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import imageCompression from 'browser-image-compression';
import { Upload, Loader2, ZoomIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';

const MAX_SIZE_BYTES = 500 * 1024; // 500KB
const TARGET_FORMAT: 'image/webp' | 'image/jpeg' = 'image/webp';

interface ProductImageUploadProps {
  projectId: string;
  productImageUrl?: string;
  onUploadSuccess?: (url: string) => void;
  /** 紧凑模式：适配单行表头高度 */
  compact?: boolean;
}

async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_SIZE_BYTES) return file;

  const opts = {
    maxSizeMB: 0.48,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: TARGET_FORMAT as 'image/webp',
    initialQuality: 0.8,
    maxIteration: 10,
  };

  return imageCompression(file, opts);
}

export default function ProductImageUpload({
  projectId,
  productImageUrl,
  onUploadSuccess,
  compact = false,
}: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | undefined>(productImageUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayUrl = url ?? productImageUrl;

  const handleFile = useCallback(
    async (file: File) => {
      if (!/^image\//.test(file.type)) {
        setError('请上传图片文件');
        return;
      }
      setError(null);
      setLoading(true);

      try {
        const compressed = await compressImage(file);
        const ext = TARGET_FORMAT === 'image/webp' ? 'webp' : 'jpg';
        const path = `${projectId}/product_${Date.now()}.${ext}`;

        if (!supabase) {
          throw new Error('Supabase 未配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
        }

        const { error: uploadErr } = await supabase.storage
          .from('project-assets')
          .upload(path, compressed, {
            contentType: TARGET_FORMAT,
            upsert: true,
          });

        if (uploadErr) throw uploadErr;

        const {
          data: { publicUrl },
        } = supabase.storage.from('project-assets').getPublicUrl(path);

        const res = await apiFetch(`/api/gantt/project/${encodeURIComponent(projectId)}/image`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productImageUrl: publicUrl }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? '更新项目图片失败');
        }

        setUrl(publicUrl);
        onUploadSuccess?.(publicUrl);
      } catch (e) {
        setError(e instanceof Error ? e.message : '上传失败');
      } finally {
        setLoading(false);
      }
    },
    [projectId, onUploadSuccess]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = () => inputRef.current?.click();
  const [showPreview, setShowPreview] = useState(false);
  const [previewPos, setPreviewPos] = useState<{ top: number; left: number } | null>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (!displayUrl) return;
    setShowPreview(true);
    if (thumbRef.current) {
      const rect = thumbRef.current.getBoundingClientRect();
      setPreviewPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [displayUrl]);

  const sizeClass = compact ? 'w-[80px] h-[48px]' : 'w-[240px] h-[100px]';

  return (
    <div className="relative shrink-0">
      {/* 缩略图容器 */}
      <div
        ref={thumbRef}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowPreview(false)}
        className={`
          shrink-0 rounded-lg overflow-hidden cursor-pointer
          transition-all duration-200
          flex items-center justify-center relative
          ${sizeClass}
          ${displayUrl
            ? 'bg-transparent'
            : 'border border-dashed border-white/[0.12] bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]'}
        `}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
          disabled={loading}
        />

        {loading ? (
          <Loader2 className={`text-white/40 animate-spin ${compact ? 'w-4 h-4' : 'w-6 h-6'}`} />
        ) : displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt="产品图"
              className="absolute inset-0 w-full h-full object-contain p-1"
            />
            {/* hover 遮罩：左半更换、右半放大 */}
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <ZoomIn className={compact ? 'w-3 h-3 text-white/80' : 'w-4 h-4 text-white/80'} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className={compact ? 'w-4 h-4 text-white/30' : 'w-5 h-5 text-white/30'} />
            <span className={compact ? 'text-[10px] text-white/40' : 'text-[12px] text-white/40'} style={{ fontFamily: 'var(--font-body)' }}>
              上传产品图
            </span>
          </div>
        )}

        {error && (
          <div className="absolute bottom-1 left-1 right-1 text-[10px] text-red-400 truncate">
            {error}
          </div>
        )}
      </div>

      {/* Hover 放大预览浮层 — Portal 到 body，彻底脱离父容器 stacking context */}
      {showPreview && displayUrl && previewPos && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{ top: previewPos.top, left: previewPos.left, transformOrigin: 'top left' }}
        >
          <div className="rounded-xl bg-[#111] border border-white/[0.08] shadow-2xl p-2">
            <img
              src={displayUrl}
              alt="产品图预览"
              className="block max-w-[320px] max-h-[240px] w-auto h-auto object-contain rounded-lg"
            />
            <div className="mt-1.5 text-center text-[9px] text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>
              点击可更换图片
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
