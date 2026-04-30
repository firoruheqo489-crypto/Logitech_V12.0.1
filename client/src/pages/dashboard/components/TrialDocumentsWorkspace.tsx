"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import axios from 'axios';
import { AlertCircle, Eye, FileText, Loader2, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  createTrialPreviewUrl,
  createTrialUploadTicket,
  fetchTrialDocuments,
  insertTrialDocument,
  type TrialDocument,
} from '../lib/trial-documents-api';

const MAX_UPLOAD_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const PDF_CONTENT_TYPE = 'application/pdf';

type UploadStatus = 'signing' | 'uploading' | 'recording' | 'done' | 'error';

type UploadingFile = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: UploadStatus;
  error?: string;
};

type DayGroup = {
  date: string;
  label: string | null;
  files: TrialDocument[];
};

interface TrialDocumentsWorkspaceProps {
  projectName?: string;
}

function createLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDayLabel(date: string): string | null {
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';
  return null;
}

function groupDocumentsByDate(documents: TrialDocument[]): DayGroup[] {
  const groups = new Map<string, TrialDocument[]>();
  documents.forEach((document) => {
    const group = groups.get(document.uploadDate) ?? [];
    group.push(document);
    groups.set(document.uploadDate, group);
  });

  return Array.from(groups.entries()).map(([date, files]) => ({
    date,
    label: formatDayLabel(date),
    files,
  }));
}

function toErrorMessage(error: unknown, fallback = '网络中断或服务端拒绝请求'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function TrialDocumentsWorkspace({ projectName = '' }: TrialDocumentsWorkspaceProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [componentName, setComponentName] = useState('');
  const [documents, setDocuments] = useState<TrialDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dayGroups = useMemo(() => groupDocumentsByDate(documents), [documents]);
  const isLocked = !selectedDate.trim() || !componentName.trim();

  const refreshDocuments = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setIsLoading(true);
    try {
      const nextDocuments = await fetchTrialDocuments();
      setDocuments(nextDocuments);
      setLoadError('');
    } catch (error) {
      const message = toErrorMessage(error, '试验档账本加载失败');
      setLoadError(message);
      if (!silent) {
        toast.error('试验档账本加载失败', { description: message });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshDocuments({ silent: true });
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshDocuments]);

  const updateUploadingFile = useCallback((id: string, patch: Partial<UploadingFile>) => {
    setUploadingFiles((prev) => prev.map((file) => (file.id === id ? { ...file, ...patch } : file)));
  }, []);

  const validatePrerequisites = useCallback((): boolean => {
    if (!selectedDate.trim() || !componentName.trim()) {
      toast.error('请先完善实验前置参数', {
        description: '日期和部件/参数名称不能为空。',
      });
      return false;
    }
    return true;
  }, [componentName, selectedDate]);

  const validateFile = (file: File): boolean => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      toast.error('上传失败', { description: `${file.name} 不是 PDF 文件。` });
      return false;
    }
    if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      toast.error('上传失败', { description: `${file.name} 超过 100MB 限制。` });
      return false;
    }
    return true;
  };

  const uploadOneFile = useCallback(async (file: File) => {
    const uploadId = createLocalId();
    const uploadDate = selectedDate.trim();
    const normalizedComponentName = componentName.trim();
    const contentType = PDF_CONTENT_TYPE;

    setUploadingFiles((prev) => [
      ...prev,
      {
        id: uploadId,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'signing',
      },
    ]);

    try {
      const ticket = await createTrialUploadTicket({
        fileName: file.name,
        fileSize: file.size,
        uploadDate,
        componentName: normalizedComponentName,
        contentType,
      });

      updateUploadingFile(uploadId, { status: 'uploading', progress: 1 });

      await axios.put(ticket.uploadUrl, file, {
        headers: { 'Content-Type': PDF_CONTENT_TYPE },
        timeout: 0,
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          const progress = total > 0 ? Math.min(99, Math.round((progressEvent.loaded / total) * 100)) : 1;
          updateUploadingFile(uploadId, { progress });
        },
      });

      updateUploadingFile(uploadId, { progress: 100, status: 'recording' });

      await insertTrialDocument({
        uploadDate,
        componentName: normalizedComponentName,
        fileName: file.name,
        fileSize: file.size,
        storagePath: ticket.storagePath,
      });

      updateUploadingFile(uploadId, { progress: 100, status: 'done' });
      toast.success('上传完成', {
        description: `${file.name} 已写入每日试验档账本。`,
      });
      await refreshDocuments({ silent: true });
      window.setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((item) => item.id !== uploadId));
      }, 1800);
    } catch (error) {
      const message = toErrorMessage(error);
      updateUploadingFile(uploadId, { status: 'error', error: message });
      toast.error('上传失败', { description: message });
    }
  }, [componentName, refreshDocuments, selectedDate, updateUploadingFile]);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!validatePrerequisites()) return;
    const pdfFiles = files.filter(validateFile);
    if (pdfFiles.length === 0) return;

    for (const file of pdfFiles) {
      await uploadOneFile(file);
    }
  }, [uploadOneFile, validatePrerequisites]);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = isLocked ? 'none' : 'copy';
    setIsDragOver(!isLocked);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  };

  const handleClick = () => {
    if (!validatePrerequisites()) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void uploadFiles(files);
  };

  const handlePreview = async (document: TrialDocument) => {
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.write(
        '<body style="background:#0B0F19;color:#22d3ee;font-family:monospace;padding:2rem;">[ 物理链路连接中... 获取对象存储直连票据 ]</body>',
      );
    }

    try {
      const previewUrl = await createTrialPreviewUrl(document.storagePath);
      if (previewWindow) {
        previewWindow.location.href = new URL(previewUrl, window.location.origin).toString();
      } else {
        toast.error('行政拦截：无法打开阅览窗口', {
          description: '请允许当前站点弹出窗口后重试。',
        });
      }
    } catch (error) {
      previewWindow?.close();
      toast.error('行政拦截：无法获取阅览票据', {
        description: toErrorMessage(error, 'PDF 在线预览地址签发失败'),
      });
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0F141D] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-7">
      <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 font-mono text-xs tracking-[0.32em] text-cyan-400/70">TRIAL VAULT</p>
          <h2 className="text-2xl font-bold tracking-tight text-white">每日试验档案库</h2>
          <p className="mt-2 text-sm text-slate-500">
            {projectName ? `${projectName} / ` : ''}PDF 通过 OSS 预签名 URL 旁路直传，服务器不接触文件流。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshDocuments()}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-900/30 md:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新账本
        </button>
      </header>

      <section className="mb-10">
        <div className="mb-5 grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="border-b border-slate-700 bg-transparent px-2 py-2 font-mono text-sm text-cyan-400 outline-none transition-colors focus:border-cyan-500"
          />
          <input
            type="text"
            value={componentName}
            onChange={(event) => setComponentName(event.target.value)}
            placeholder="输入实验部件或参数名称"
            className="border-b border-slate-700 bg-transparent px-2 py-2 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500"
          />
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleClick();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            flex h-32 items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300
            ${
              isLocked
                ? 'cursor-not-allowed border-amber-700/50 bg-amber-950/10'
                : 'cursor-pointer border-slate-700/70 bg-slate-950/40 hover:border-cyan-500/50 hover:bg-slate-950/60'
            }
            ${isDragOver ? 'border-cyan-500/80 bg-cyan-900/10 shadow-[0_0_30px_rgba(34,211,238,0.12)]' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-3 px-4 text-center text-slate-500">
            {isLocked ? (
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
            ) : (
              <Upload className="h-5 w-5 flex-shrink-0" />
            )}
            <span className="text-sm">
              {isLocked ? '请先填写日期与部件/参数名称' : '拖拽 100MB 内 PDF 报告到这里'}
              <span className="ml-2 font-mono text-xs text-slate-600">OSS PUT Presigned URL</span>
            </span>
          </div>
        </div>

        {uploadingFiles.map((file) => (
          <div key={file.id} className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {file.status === 'error' ? (
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
                ) : file.status === 'signing' || file.status === 'recording' ? (
                  <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-cyan-500" />
                ) : (
                  <FileText className="h-4 w-4 flex-shrink-0 text-cyan-500" />
                )}
                <span className="truncate text-sm text-slate-300">{file.name}</span>
              </div>
              <div className="flex flex-shrink-0 items-center gap-4">
                <span className={file.status === 'error' ? 'font-mono text-sm text-red-300' : 'font-mono text-sm text-cyan-400'}>
                  {file.status === 'signing'
                    ? '签发中'
                    : file.status === 'recording'
                      ? '入库中'
                      : file.status === 'done'
                        ? '完成'
                        : file.status === 'error'
                          ? '失败'
                          : `${file.progress.toFixed(0)}%`}
                </span>
                <span className="font-mono text-sm text-slate-500">{formatFileSize(file.size)}</span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  file.status === 'error'
                    ? 'bg-gradient-to-r from-red-700 to-red-400'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-500'
                }`}
                style={{
                  width: `${file.status === 'error' ? Math.max(file.progress, 8) : file.progress}%`,
                  boxShadow:
                    file.status === 'error'
                      ? '0 0 10px rgba(248,113,113,0.55)'
                      : '0 0 10px rgba(6,182,212,0.6)',
                }}
              />
            </div>
            {file.error && <p className="mt-2 text-xs text-red-300">{file.error}</p>}
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-[0.24em] text-cyan-500">TIME LEDGER</h3>
          {isLoading && <span className="font-mono text-xs text-slate-500">loading...</span>}
        </div>

        {loadError && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
            账本加载失败：{loadError}
          </div>
        )}

        {!isLoading && !loadError && dayGroups.length === 0 && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-8 text-center text-sm text-slate-500">
            暂无试验档案。上传完成后会自动出现在这里。
          </div>
        )}

        {dayGroups.map((dayGroup) => (
          <div key={dayGroup.date} className="mb-8 last:mb-0">
            <div className="mb-4 flex items-center gap-4">
              <span className="flex-shrink-0 whitespace-nowrap font-mono text-sm tracking-widest text-cyan-600">
                [ {dayGroup.date} {dayGroup.label && `/ ${dayGroup.label}`} ]
              </span>
              <div className="flex-grow border-b border-slate-800" />
            </div>

            <div className="space-y-2">
              {dayGroup.files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/35 p-4 transition-colors hover:bg-slate-900/70 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-center">
                    <span className="truncate font-semibold text-slate-200">{file.componentName}</span>
                    <span className="ml-4 flex-shrink-0 text-xs text-slate-500">{file.fileName}</span>
                  </div>

                  <div className="flex flex-shrink-0 items-center justify-between gap-6 md:justify-end">
                    <span className="font-mono text-sm text-slate-400">{formatFileSize(file.fileSize)}</span>
                    <button
                      type="button"
                      onClick={() => void handlePreview(file)}
                      className="flex items-center gap-2 whitespace-nowrap rounded border border-cyan-700/50 bg-cyan-900/20 px-4 py-1.5 text-sm text-cyan-400 transition-all hover:bg-cyan-900/50 hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    >
                      <Eye className="h-4 w-4" />
                      在线阅览
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
