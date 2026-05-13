/**
 * Drag-and-drop + file picker entrypoint for the image stitcher.
 *
 * Accepts image files (PNG, JPEG, WebP by default), loads each one
 * into an `HTMLImageElement` to read the natural dimensions, and
 * emits the full ordered list of {@link ImageEntry} once every image
 * has resolved.
 */

import { ImagePlus } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { ImageEntry } from './types';

interface ImageDropZoneProps {
  onImagesLoaded: (images: ImageEntry[]) => void;
  acceptedFormats?: string[];
}

const DEFAULT_ACCEPTED_FORMATS = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Load a single file into an `HTMLImageElement` and resolve with its
 * pixel dimensions. Rejects if the image fails to decode.
 */
function loadImageEntry(file: File): Promise<ImageEntry> {
  return new Promise((resolve, reject) => {
    const element = new Image();
    const objectUrl = URL.createObjectURL(file);

    element.onload = () => {
      resolve({
        id: nanoid(),
        name: file.name,
        element,
        width: element.naturalWidth,
        height: element.naturalHeight,
      });
    };
    element.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`图片加载失败：${file.name}`));
    };

    element.src = objectUrl;
  });
}

export default function ImageDropZone({
  onImagesLoaded,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
}: ImageDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const acceptedSet = acceptedFormats;
  const acceptAttr = acceptedFormats.join(',');

  /**
   * Validate MIME types and dispatch loading for the supported subset.
   * Preserves input order and emits a single batched `onImagesLoaded`
   * call after all images resolve.
   */
  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const supported: File[] = [];
      for (const file of files) {
        if (acceptedSet.includes(file.type)) {
          supported.push(file);
        } else {
          toast.error(`不支持的文件格式：${file.name}`);
        }
      }

      if (supported.length === 0) return;

      setIsLoading(true);
      try {
        const entries = await Promise.all(supported.map(loadImageEntry));
        onImagesLoaded(entries);
      } catch (error) {
        const message = error instanceof Error ? error.message : '图片加载失败';
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [acceptedSet, onImagesLoaded],
  );

  const handleClick = () => {
    if (isLoading) return;
    inputRef.current?.click();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    await processFiles(files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    await processFiles(files);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="上传图片"
      aria-busy={isLoading}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex h-48 w-full cursor-pointer flex-col items-center justify-center gap-3
        rounded-xl border-2 border-dashed bg-slate-950/40 px-6 text-center
        transition-all duration-300
        ${
          isDragOver
            ? 'border-cyan-500/80 bg-cyan-900/10 shadow-[0_0_30px_rgba(34,211,238,0.15)]'
            : 'border-slate-700/70 hover:border-cyan-500/50 hover:bg-slate-950/60'
        }
        ${isLoading ? 'pointer-events-none opacity-70' : ''}
      `}
    >
      <ImagePlus
        className={`h-8 w-8 ${isDragOver ? 'text-cyan-400' : 'text-slate-500'}`}
        strokeWidth={1.5}
      />
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-200">
          {isLoading ? '正在加载图片…' : '拖拽图片到此处或点击上传'}
        </p>
        <p className="text-xs text-slate-500">支持 PNG、JPG、JPEG、WebP 格式，可多选</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
