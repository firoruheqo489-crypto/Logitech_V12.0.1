/**
 * ProgressDetailModal — 项目推进细节弹窗
 * 支持增加、编辑、删除推进细节条目
 * 数据持久化到 Supabase（以 moldNumber 为 key）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import imageCompression from 'browser-image-compression';
import { Plus, Trash2, Pencil, Check, X, Image as ImageIcon, History } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { deleteAssetViaServer, uploadAssetViaServer } from '@/lib/ossUpload';
import {
  fetchDashboardProgressEntries,
  getDashboardApiErrorDisplayMessage,
  normalizeDashboardApiError,
  normalizeDashboardProgressSaveResult,
  type DashboardProgressEntry,
} from '../lib/dashboardApi';
import { toast } from 'sonner';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';

type ProgressEntry = DashboardProgressEntry;

interface ProgressAuditLog {
  id: number;
  note_id?: string;
  action: string;
  operator?: string;
  ip_address?: string;
  created_at: string;
}

interface ProgressDetailModalProps {
  open: boolean;
  onClose: () => void;
  moldNumber: string;
  /** Excel 导入的当前推进细节（只读参考） */
  currentDetail?: string;
  currentDate?: string;
}

const API_BASE = '/api/dashboard/progress-notes';
const MAX_PROGRESS_IMAGE_SIZE_BYTES = 500 * 1024;
const TARGET_PROGRESS_IMAGE_FORMAT: 'image/webp' | 'image/jpeg' = 'image/webp';

async function loadEntries(moldNumber: string): Promise<ProgressEntry[]> {
  return fetchDashboardProgressEntries(moldNumber);
}

async function upsertEntry(moldNumber: string, entry: ProgressEntry) {
  const res = await apiFetch(`${API_BASE}/${encodeURIComponent(moldNumber)}/entry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw normalizeDashboardApiError(payload, res.status, 'INTERNAL_ERROR');
  }
  return normalizeDashboardProgressSaveResult(await res.json().catch(() => null));
}

async function deleteEntry(moldNumber: string, entryId: string) {
  const res = await apiFetch(`${API_BASE}/${encodeURIComponent(moldNumber)}/${encodeURIComponent(entryId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw normalizeDashboardApiError(payload, res.status, 'INTERNAL_ERROR');
  }
  return normalizeDashboardProgressSaveResult(await res.json().catch(() => null));
}

async function loadAuditLogs(moldNumber: string): Promise<ProgressAuditLog[]> {
  try {
    const res = await apiFetch(`${API_BASE}/${encodeURIComponent(moldNumber)}/audit?limit=50`);
    if (!res.ok) throw new Error('fetch audit failed');
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function formatAuditAction(action: string): string {
  switch (action) {
    case 'create-entry': return '新增记录';
    case 'update-entry': return '修改记录';
    case 'delete-entry': return '删除记录';
    case 'delete-image': return '删除图片';
    case 'restore-backup': return '恢复备份';
    default: return action;
  }
}

function estimateBlobSizeKB(blob: Pick<Blob, 'size'>): number {
  return Math.round(blob.size / 1024);
}

function isBlobUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('blob:');
}

function isDataUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function revokePreviewUrl(value: string | null | undefined): void {
  if (isBlobUrl(value)) {
    URL.revokeObjectURL(value);
  }
}

function inferImageExtension(mimeType: string): string {
  switch (mimeType.trim().toLowerCase()) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/jpeg':
    case 'image/jpg':
    default:
      return '.jpg';
  }
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  if (file.size <= MAX_PROGRESS_IMAGE_SIZE_BYTES) {
    return file;
  }

  return imageCompression(file, {
    maxSizeMB: 0.48,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: TARGET_PROGRESS_IMAGE_FORMAT as 'image/webp',
    initialQuality: 0.8,
    maxIteration: 10,
  });
}

async function dataUrlToFile(dataUrl: string, filenameBase: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';
  return new File([blob], `${filenameBase}${inferImageExtension(mimeType)}`, {
    type: mimeType,
  });
}

async function resolvePersistedProgressImage(params: {
  moldNumber: string;
  noteId: string;
  previewUrl: string;
  file: File | null;
}): Promise<{ imageUrl?: string; uploadedUrl?: string }> {
  let sourceFile = params.file;

  if (!sourceFile && isDataUrl(params.previewUrl)) {
    sourceFile = await dataUrlToFile(params.previewUrl, `progress-note-${params.noteId}`);
  }

  if (!sourceFile) {
    return {
      imageUrl: isBlobUrl(params.previewUrl) ? undefined : (params.previewUrl || undefined),
    };
  }

  const processedFile = await compressImage(sourceFile);
  const uploadResult = await uploadAssetViaServer({
    file: processedFile,
    category: 'progress-note-image',
    entityId: params.moldNumber,
    slot: params.noteId,
  });

  return {
    imageUrl: uploadResult.url,
    uploadedUrl: uploadResult.url,
  };
}

export default function ProgressDetailModal({
  open, onClose, moldNumber, currentDetail, currentDate,
}: ProgressDetailModalProps) {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageSizeKB, setNewImageSizeKB] = useState<number | null>(null);
  const [newAssignee, setNewAssignee] = useState<string>('');
  const [newEstimatedNodeCompletion, setNewEstimatedNodeCompletion] = useState<string>('');
  const [editImageUrl, setEditImageUrl] = useState<string>('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImageSizeKB, setEditImageSizeKB] = useState<number | null>(null);
  const [editAssignee, setEditAssignee] = useState<string>('');
  const [editEstimatedNodeCompletion, setEditEstimatedNodeCompletion] = useState<string>('');
  const [isNewImageProcessing, setIsNewImageProcessing] = useState(false);
  const [isEditImageProcessing, setIsEditImageProcessing] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<ProgressAuditLog[]>([]);
  const newImageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const hasLocalEntryMutationRef = useRef(false);
  const newImageJobRef = useRef(0);
  const editImageJobRef = useRef(0);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: 'delete-entry' | 'delete-image' | 'clear-edit-image' | null;
    id?: string;
  }>({
    open: false,
    title: '',
    message: '',
    action: null,
  });

  const estimateDataUrlSizeKB = (dataUrl: string): number => {
    const base64 = (dataUrl.split(',')[1] || '');
    const bytes = Math.floor((base64.length * 3) / 4);
    return Math.round(bytes / 1024);
  };

  const replaceNewImageSelection = useCallback((nextUrl: string, nextFile: File | null, nextSizeKB: number | null) => {
    setNewImageUrl((currentUrl) => {
      revokePreviewUrl(currentUrl);
      return nextUrl;
    });
    setNewImageFile(nextFile);
    setNewImageSizeKB(nextSizeKB);
  }, []);

  const clearNewImageSelection = useCallback(() => {
    replaceNewImageSelection('', null, null);
  }, [replaceNewImageSelection]);

  const replaceEditImageSelection = useCallback((nextUrl: string, nextFile: File | null, nextSizeKB: number | null) => {
    setEditImageUrl((currentUrl) => {
      revokePreviewUrl(currentUrl);
      return nextUrl;
    });
    setEditImageFile(nextFile);
    setEditImageSizeKB(nextSizeKB);
  }, []);

  const clearEditImageSelection = useCallback(() => {
    replaceEditImageSelection('', null, null);
  }, [replaceEditImageSelection]);

  const handleNewImageChange = useCallback(async (file?: File) => {
    if (!file) return;
    const jobId = ++newImageJobRef.current;
    setIsNewImageProcessing(true);
    try {
      const processedFile = await compressImage(file);
      if (jobId !== newImageJobRef.current) return;
      replaceNewImageSelection(
        URL.createObjectURL(processedFile),
        processedFile,
        estimateBlobSizeKB(processedFile),
      );
    } catch {
      if (jobId !== newImageJobRef.current) return;
      replaceNewImageSelection(
        URL.createObjectURL(file),
        file,
        estimateBlobSizeKB(file),
      );
    } finally {
      if (jobId === newImageJobRef.current) {
        setIsNewImageProcessing(false);
      }
    }
  }, [replaceNewImageSelection]);

  const handleEditImageChange = useCallback(async (file?: File) => {
    if (!file) return;
    const jobId = ++editImageJobRef.current;
    setIsEditImageProcessing(true);
    try {
      const processedFile = await compressImage(file);
      if (jobId !== editImageJobRef.current) return;
      replaceEditImageSelection(
        URL.createObjectURL(processedFile),
        processedFile,
        estimateBlobSizeKB(processedFile),
      );
    } catch {
      if (jobId !== editImageJobRef.current) return;
      replaceEditImageSelection(
        URL.createObjectURL(file),
        file,
        estimateBlobSizeKB(file),
      );
    } finally {
      if (jobId === editImageJobRef.current) {
        setIsEditImageProcessing(false);
      }
    }
  }, [replaceEditImageSelection]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    hasLocalEntryMutationRef.current = false;
    setEditingId(null);
    setNewContent('');
    setNewDate(new Date().toISOString().slice(0, 10));
    clearNewImageSelection();
    setNewAssignee('');
    setNewEstimatedNodeCompletion('');
    clearEditImageSelection();
    setIsNewImageProcessing(false);
    setIsEditImageProcessing(false);
    newImageJobRef.current += 1;
    editImageJobRef.current += 1;
    setPreviewImageUrl('');
    setShowAuditPanel(false);
    setAuditLogs([]);
    setLoading(true);

    void (async () => {
      const data = await loadEntries(moldNumber);
      if (cancelled) return;
      if (hasLocalEntryMutationRef.current) return;
      setEntries(data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, moldNumber, clearEditImageSelection, clearNewImageSelection]);

  useEffect(() => () => {
    revokePreviewUrl(newImageUrl);
    revokePreviewUrl(editImageUrl);
  }, [newImageUrl, editImageUrl]);

  const refreshAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    const logs = await loadAuditLogs(moldNumber);
    setAuditLogs(logs);
    setAuditLoading(false);
  }, [moldNumber]);

  const handleAdd = useCallback(async () => {
    if (!newContent.trim()) return;
    if (isNewImageProcessing) {
      toast.warning('图片处理中，请稍候', {
        description: '请等待预览生成后再点击添加。',
        position: 'bottom-right',
      });
      return;
    }
    const previousEntries = entries;
    const entryId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let uploadedUrl = '';
    setIsNewImageProcessing(true);
    try {
      const persistedImage = await resolvePersistedProgressImage({
        moldNumber,
        noteId: entryId,
        previewUrl: newImageUrl,
        file: newImageFile,
      });
      uploadedUrl = persistedImage.uploadedUrl || '';
      const entry: ProgressEntry = {
        id: entryId,
        date: newDate,
        content: newContent.trim(),
        imageUrl: persistedImage.imageUrl,
        assignee: newAssignee.trim() || undefined,
        estimatedNodeCompletion: newEstimatedNodeCompletion || undefined,
      };
      const updated = [entry, ...previousEntries].sort((a, b) => b.date.localeCompare(a.date));
      hasLocalEntryMutationRef.current = true;
      setLoading(false);
      setEntries(updated);
      const result = await upsertEntry(moldNumber, entry);
      setNewContent('');
      setNewDate(new Date().toISOString().slice(0, 10));
      clearNewImageSelection();
      setNewAssignee('');
      setNewEstimatedNodeCompletion('');
      newImageJobRef.current += 1;
      toast.success(result.backupCreated ? '保存成功（已自动创建回滚快照）' : '保存成功（已复用最近快照）');
      if (showAuditPanel) await refreshAuditLogs();
    } catch (err) {
      if (uploadedUrl) {
        await deleteAssetViaServer(uploadedUrl).catch(() => undefined);
      }
      setEntries(previousEntries);
      toast.error(getDashboardApiErrorDisplayMessage(err, '保存失败'));
    } finally {
      setIsNewImageProcessing(false);
    }
  }, [
    clearNewImageSelection,
    entries,
    moldNumber,
    newAssignee,
    newContent,
    newDate,
    newEstimatedNodeCompletion,
    newImageFile,
    newImageUrl,
    isNewImageProcessing,
    showAuditPanel,
    refreshAuditLogs,
  ]);

  const handleDelete = useCallback(async (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    hasLocalEntryMutationRef.current = true;
    setLoading(false);
    setEntries(updated);
    try {
      const result = await deleteEntry(moldNumber, id);
      // Keep remote assets referenced by historical backups so restore still works.
      toast.success(result.backupCreated ? '删除成功（已自动创建回滚快照）' : '删除成功（已复用最近快照）');
      if (showAuditPanel) await refreshAuditLogs();
    } catch (err) {
      setEntries(entries);
      toast.error(getDashboardApiErrorDisplayMessage(err, '删除失败'));
    }
  }, [entries, moldNumber, showAuditPanel, refreshAuditLogs]);

  const handleRemoveImage = useCallback(async (id: string) => {
    const targetEntry = entries.find((entry) => entry.id === id);
    if (!targetEntry) return;
    const updatedEntry = { ...targetEntry, imageUrl: undefined };
    const updated = entries.map(e => (e.id === id ? updatedEntry : e));
    hasLocalEntryMutationRef.current = true;
    setLoading(false);
    setEntries(updated);
    try {
      const result = await upsertEntry(moldNumber, updatedEntry);
      // Keep remote assets referenced by historical backups so restore still works.
      toast.success(result.backupCreated ? '删除图片成功（已自动创建回滚快照）' : '删除图片成功（已复用最近快照）');
      if (showAuditPanel) await refreshAuditLogs();
    } catch (err) {
      setEntries(entries);
      toast.error(getDashboardApiErrorDisplayMessage(err, '删除图片失败'));
    }
  }, [entries, moldNumber, showAuditPanel, refreshAuditLogs]);

  const handleEditStart = useCallback((entry: ProgressEntry) => {
    editImageJobRef.current += 1;
    setIsEditImageProcessing(false);
    setEditingId(entry.id);
    setEditContent(entry.content);
    setEditDate(entry.date);
    replaceEditImageSelection(
      entry.imageUrl || '',
      null,
      entry.imageUrl && isDataUrl(entry.imageUrl) ? estimateDataUrlSizeKB(entry.imageUrl) : null,
    );
    setEditAssignee(entry.assignee || '');
    setEditEstimatedNodeCompletion(entry.estimatedNodeCompletion || '');
  }, [replaceEditImageSelection]);

  const handleEditSave = useCallback(async () => {
    if (!editingId || !editContent.trim()) return;
    if (isEditImageProcessing) {
      toast.warning('图片处理中，请稍候', {
        description: '请等待预览生成后再保存修改。',
        position: 'bottom-right',
      });
      return;
    }
    const existingEntry = entries.find((entry) => entry.id === editingId);
    if (!existingEntry) return;
    let uploadedUrl = '';
    setIsEditImageProcessing(true);
    try {
      const persistedImage = await resolvePersistedProgressImage({
        moldNumber,
        noteId: editingId,
        previewUrl: editImageUrl,
        file: editImageFile,
      });
      uploadedUrl = persistedImage.uploadedUrl || '';
      const updatedEntry: ProgressEntry = {
        ...existingEntry,
        content: editContent.trim(),
        date: editDate,
        imageUrl: persistedImage.imageUrl,
        assignee: editAssignee.trim() || undefined,
        estimatedNodeCompletion: editEstimatedNodeCompletion || undefined,
      };
      const updated = entries.map(e =>
        e.id === editingId ? updatedEntry : e
      ).sort((a, b) => b.date.localeCompare(a.date));
      hasLocalEntryMutationRef.current = true;
      setLoading(false);
      setEntries(updated);
      const result = await upsertEntry(moldNumber, updatedEntry);
      clearEditImageSelection();
      setEditingId(null);
      toast.success(result.backupCreated ? '更新成功（已自动创建回滚快照）' : '更新成功（已复用最近快照）');
      if (showAuditPanel) await refreshAuditLogs();
    } catch (err) {
      if (uploadedUrl) {
        await deleteAssetViaServer(uploadedUrl).catch(() => undefined);
      }
      setEntries(entries);
      toast.error(getDashboardApiErrorDisplayMessage(err, '更新失败'));
    } finally {
      setIsEditImageProcessing(false);
    }
  }, [
    clearEditImageSelection,
    entries,
    moldNumber,
    editingId,
    editAssignee,
    editContent,
    editDate,
    editEstimatedNodeCompletion,
    editImageFile,
    editImageUrl,
    isEditImageProcessing,
    showAuditPanel,
    refreshAuditLogs,
  ]);

  const handleEditCancel = useCallback(() => {
    editImageJobRef.current += 1;
    setIsEditImageProcessing(false);
    clearEditImageSelection();
    setEditingId(null);
  }, [clearEditImageSelection]);

  const openConfirmDialog = useCallback((params: {
    title: string;
    message: string;
    action: 'delete-entry' | 'delete-image' | 'clear-edit-image';
    id?: string;
  }) => {
    setConfirmDialog({
      open: true,
      title: params.title,
      message: params.message,
      action: params.action,
      id: params.id,
    });
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog({
      open: false,
      title: '',
      message: '',
      action: null,
      id: undefined,
    });
  }, []);

  const handleConfirmAction = useCallback(async () => {
    const { action, id } = confirmDialog;
    if (!action) return;
    closeConfirmDialog();
    if (action === 'delete-entry' && id) {
      await handleDelete(id);
      return;
    }
    if (action === 'delete-image' && id) {
      await handleRemoveImage(id);
      return;
    }
    if (action === 'clear-edit-image') {
      editImageJobRef.current += 1;
      setIsEditImageProcessing(false);
      clearEditImageSelection();
    }
  }, [confirmDialog, clearEditImageSelection, closeConfirmDialog, handleDelete, handleRemoveImage]);

  if (!open) return null;

  // 有未保存内容或正在编辑时，锁定弹窗——点击外部无效
  const hasUnsavedInput = newContent.trim() !== '' || editingId !== null;
  const handleBackdropClick = hasUnsavedInput ? undefined : onClose;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      style={{ cursor: hasUnsavedInput ? 'default' : undefined }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl"
        style={{ background: 'linear-gradient(180deg, #151B23 0%, #0D1117 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 12px rgba(34,211,238,0.3)' }} />
            <h3 className="text-base font-bold text-white/90">项目推进细节</h3>
            <span className="text-xs text-white/30 font-mono">{moldNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const next = !showAuditPanel;
                setShowAuditPanel(next);
                if (next) await refreshAuditLogs();
              }}
              className="px-2.5 h-8 rounded-md flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors text-[11px] text-white/75"
            >
              <History className="w-3.5 h-3.5" />
              审计日志
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors">
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </div>

        {/* Add new entry */}
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex gap-3 items-start">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-[130px] shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 outline-none focus:border-cyan-400/30"
            />
            <input
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="输入新的推进细节..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-400/30"
            />
            <button
              type="button"
              onClick={() => newImageInputRef.current?.click()}
              disabled={isNewImageProcessing}
              className="shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              上传图片
            </button>
            <input
              ref={newImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isNewImageProcessing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void handleNewImageChange(file);
              }}
            />
            <button
              onClick={handleAdd}
              disabled={!newContent.trim() || isNewImageProcessing}
              className="shrink-0 px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400/20 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              添加
            </button>
          </div>
          <div className="flex gap-3 items-center mt-2">
            <input
              type="text"
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              placeholder="当前节点负责人..."
              className="w-[180px] shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-400/30"
            />
            <input
              type="date"
              value={newEstimatedNodeCompletion}
              onChange={(e) => setNewEstimatedNodeCompletion(e.target.value)}
              className="w-[160px] shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 outline-none focus:border-cyan-400/30"
              title="节点预估完成时间"
            />
            {newEstimatedNodeCompletion && (
              <span className="text-[11px] text-white/35">节点预估完成时间</span>
            )}
            {!newEstimatedNodeCompletion && (
              <span className="text-[11px] text-white/25">节点预估完成时间（选填）</span>
            )}
          </div>
          {newImageUrl && (
            <div className="mt-3">
              <div className="rounded-lg overflow-hidden border border-white/[0.08] w-[180px] h-[110px]">
                <img src={newImageUrl} alt="预览" className="w-full h-full object-cover" />
              </div>
              {newImageSizeKB !== null && (
                <div className="mt-1 text-[11px] text-white/45">压缩后大小：{newImageSizeKB} KB（目标 ≤ 500 KB）</div>
              )}
            </div>
          )}
          {isNewImageProcessing && !newImageUrl && (
            <div className="mt-3 text-[11px] text-cyan-300/70">
              正在处理图片，请稍候...
            </div>
          )}
        </div>

        {/* Entries list */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 220px)' }}>
          {loading ? (
            <div className="px-6 py-12 text-center text-white/30 text-sm">加载中...</div>
          ) : entries.length === 0 ? (
            <div className="px-6 py-12 text-center text-white/20 text-sm">暂无手动添加的推进记录</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="px-6 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                {editingId === entry.id ? (
                  <div className="flex gap-2 items-start flex-wrap">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-[130px] shrink-0 px-2 py-1.5 rounded bg-white/[0.06] border border-white/[0.1] text-xs text-white/70 outline-none"
                    />
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') handleEditCancel(); }}
                      className="flex-1 px-2 py-1.5 rounded bg-white/[0.06] border border-white/[0.1] text-xs text-white/80 outline-none"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editAssignee}
                      onChange={(e) => setEditAssignee(e.target.value)}
                      placeholder="节点负责人"
                      className="w-[130px] shrink-0 px-2 py-1.5 rounded bg-white/[0.06] border border-white/[0.1] text-xs text-white/70 placeholder:text-white/20 outline-none"
                    />
                    <input
                      type="date"
                      value={editEstimatedNodeCompletion}
                      onChange={(e) => setEditEstimatedNodeCompletion(e.target.value)}
                      title="节点预估完成时间"
                      className="w-[140px] shrink-0 px-2 py-1.5 rounded bg-white/[0.06] border border-white/[0.1] text-xs text-white/70 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => editImageInputRef.current?.click()}
                      disabled={isEditImageProcessing}
                      className="px-2 py-1.5 rounded bg-white/[0.06] border border-white/[0.1] text-xs text-white/70 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1"
                    >
                      <ImageIcon className="w-3 h-3" />
                      换图
                    </button>
                    <input
                      ref={editImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isEditImageProcessing}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void handleEditImageChange(file);
                      }}
                    />
                    <button
                      onClick={handleEditSave}
                      disabled={isEditImageProcessing}
                      className="w-7 h-7 rounded flex items-center justify-center hover:bg-green-500/20 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    </button>
                    <button onClick={handleEditCancel} className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/[0.08] transition-colors">
                      <X className="w-3.5 h-3.5 text-white/40" />
                    </button>
                    {editImageUrl && (
                      <div className="flex items-start gap-2">
                        <div className="w-[140px] h-[88px] rounded overflow-hidden border border-white/[0.08]">
                          <img src={editImageUrl} alt="编辑预览" className="w-full h-full object-cover" />
                        </div>
                        <button
                          onClick={() => openConfirmDialog({
                            title: '确认删除图片',
                            message: '删除后无法恢复，是否继续？',
                            action: 'clear-edit-image',
                          })}
                          className="px-2 py-1.5 rounded bg-red-500/15 border border-red-400/25 text-xs text-red-300 hover:bg-red-500/25"
                        >
                          删除图片
                        </button>
                        {editImageSizeKB !== null && (
                          <span className="text-[11px] text-white/45 self-end">{editImageSizeKB} KB</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="text-[11px] text-white/30 font-mono shrink-0 pt-0.5 w-[80px]">{entry.date}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/70 leading-relaxed">{entry.content}</p>
                      {(entry.assignee || entry.estimatedNodeCompletion) && (
                        <div className="flex items-center gap-3 mt-1">
                          {entry.assignee && (
                            <span className="text-[11px] text-cyan-400/60">负责人：{entry.assignee}</span>
                          )}
                          {entry.estimatedNodeCompletion && (
                            <span className="text-[11px] text-amber-400/60">节点预估完成：{entry.estimatedNodeCompletion}</span>
                          )}
                        </div>
                      )}
                      {entry.imageUrl && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-white/[0.08] w-[180px] h-[110px] cursor-zoom-in" onClick={() => setPreviewImageUrl(entry.imageUrl || '')}>
                          <img src={entry.imageUrl} alt="推进图片" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => handleEditStart(entry)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/[0.08] transition-colors">
                        <Pencil className="w-3 h-3 text-white/30" />
                      </button>
                      {entry.imageUrl && (
                        <button
                          onClick={() => openConfirmDialog({
                            title: '确认删除图片',
                            message: '删除后无法恢复，是否继续？',
                            action: 'delete-image',
                            id: entry.id,
                          })}
                          className="px-2 h-6 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors text-[10px] text-red-300"
                        >
                          删除图片
                        </button>
                      )}
                      <button
                        onClick={() => openConfirmDialog({
                          title: '确认删除记录',
                          message: '这条推进细节将被永久删除，是否继续？',
                          action: 'delete-entry',
                          id: entry.id,
                        })}
                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-3 h-3 text-red-400/50" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {showAuditPanel && (
          <div className="border-t border-white/[0.06] px-6 py-3 bg-black/15">
            <div className="text-[11px] text-white/45 mb-2">最近操作记录（最多 50 条）</div>
            {auditLoading ? (
              <div className="text-xs text-white/35 py-3">审计日志加载中...</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-xs text-white/30 py-3">暂无审计日志</div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {auditLogs.map((log) => (
                  <div key={log.id} className="text-[11px] text-white/70 flex items-center gap-2 border border-white/[0.06] rounded px-2 py-1.5 bg-white/[0.02]">
                    <span className="text-cyan-300/90 shrink-0">{formatAuditAction(log.action)}</span>
                    <span className="text-white/35 shrink-0">{new Date(log.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
                    <span className="text-white/45 truncate">操作者: {log.operator || 'anonymous'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {previewImageUrl && (
          <div className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4" onClick={() => setPreviewImageUrl('')}>
            <button
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              onClick={() => setPreviewImageUrl('')}
            >
              <X className="w-4 h-4 text-white/80" />
            </button>
            <img
              src={previewImageUrl}
              alt="图片预览"
              className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <CyberConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onCancel={closeConfirmDialog}
          onConfirm={handleConfirmAction}
          confirmText="确认删除"
          cancelText="取消"
        />
      </div>
    </div>,
    document.body
  );
}
