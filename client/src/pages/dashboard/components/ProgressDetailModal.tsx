/**
 * ProgressDetailModal — 项目推进细节弹窗
 * 支持增加、编辑、删除推进细节条目
 * 数据持久化到 Supabase（以 moldNumber 为 key）
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Pencil, Check, X, Image as ImageIcon, History } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';

interface ProgressEntry {
  id: string;
  date: string;
  content: string;
  imageUrl?: string;
  assignee?: string;
  estimatedNodeCompletion?: string;
}

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

async function loadEntries(moldNumber: string): Promise<ProgressEntry[]> {
  try {
    const res = await apiFetch(`${API_BASE}/${encodeURIComponent(moldNumber)}`);
    if (!res.ok) throw new Error('fetch failed');
    const rows = await res.json();
    return rows.map((r: any) => ({ id: r.id, date: r.date, content: r.content, imageUrl: r.imageUrl, assignee: r.assignee, estimatedNodeCompletion: r.estimatedNodeCompletion }));
  } catch {
    return [];
  }
}

async function saveEntries(moldNumber: string, entries: ProgressEntry[]) {
  const res = await apiFetch(`${API_BASE}/${encodeURIComponent(moldNumber)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `保存失败(${res.status})`);
  }
  const data = await res.json().catch(() => ({}));
  return {
    backupCreated: Boolean(data?.backupCreated),
    backupAt: typeof data?.backupAt === 'string' ? data.backupAt : '',
  };
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
  const [newImageSizeKB, setNewImageSizeKB] = useState<number | null>(null);
  const [newAssignee, setNewAssignee] = useState<string>('');
  const [newEstimatedNodeCompletion, setNewEstimatedNodeCompletion] = useState<string>('');
  const [editImageUrl, setEditImageUrl] = useState<string>('');
  const [editImageSizeKB, setEditImageSizeKB] = useState<number | null>(null);
  const [editAssignee, setEditAssignee] = useState<string>('');
  const [editEstimatedNodeCompletion, setEditEstimatedNodeCompletion] = useState<string>('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<ProgressAuditLog[]>([]);
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

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = async () => {
          const MAX_BYTES = 500 * 1024;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('图片处理失败')); return; }

          let width = img.width;
          let height = img.height;
          const maxSide = 1600;
          if (Math.max(width, height) > maxSide) {
            const ratio = maxSide / Math.max(width, height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const toBlob = (quality: number) => new Promise<Blob | null>((res) => {
            canvas.toBlob((b) => res(b), 'image/jpeg', quality);
          });

          const blobToDataUrl = (blob: Blob) => new Promise<string>((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result || ''));
            fr.onerror = () => rej(new Error('图片转换失败'));
            fr.readAsDataURL(blob);
          });

          for (let round = 0; round < 6; round++) {
            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            for (const quality of [0.85, 0.78, 0.7, 0.62, 0.55, 0.48, 0.4]) {
              const blob = await toBlob(quality);
              if (!blob) continue;
              if (blob.size <= MAX_BYTES) {
                resolve(await blobToDataUrl(blob));
                return;
              }
            }

            width = Math.max(320, Math.round(width * 0.85));
            height = Math.max(240, Math.round(height * 0.85));
          }

          const fallbackBlob = await toBlob(0.4);
          if (!fallbackBlob) { reject(new Error('图片压缩失败')); return; }
          resolve(await blobToDataUrl(fallbackBlob));
        };
        img.onerror = () => reject(new Error('图片解析失败'));
        img.src = String(reader.result || '');
      };
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  };

  const handleNewImageChange = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setNewImageUrl(dataUrl);
      setNewImageSizeKB(estimateDataUrlSizeKB(dataUrl));
    } catch {
      const dataUrl = await fileToDataUrl(file);
      setNewImageUrl(dataUrl);
      setNewImageSizeKB(estimateDataUrlSizeKB(dataUrl));
    }
  }, []);

  const handleEditImageChange = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setEditImageUrl(dataUrl);
      setEditImageSizeKB(estimateDataUrlSizeKB(dataUrl));
    } catch {
      const dataUrl = await fileToDataUrl(file);
      setEditImageUrl(dataUrl);
      setEditImageSizeKB(estimateDataUrlSizeKB(dataUrl));
    }
  }, []);

  useEffect(() => {
    if (open) {
      setEditingId(null);
      setNewContent('');
      setNewDate(new Date().toISOString().slice(0, 10));
      setNewImageUrl('');
      setNewImageSizeKB(null);
      setNewAssignee('');
      setNewEstimatedNodeCompletion('');
      setPreviewImageUrl('');
      setShowAuditPanel(false);
      setAuditLogs([]);
      setLoading(true);
      loadEntries(moldNumber).then(data => {
        setEntries(data.sort((a, b) => b.date.localeCompare(a.date)));
        setLoading(false);
      });
    }
  }, [open, moldNumber]);

  const refreshAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    const logs = await loadAuditLogs(moldNumber);
    setAuditLogs(logs);
    setAuditLoading(false);
  }, [moldNumber]);

  const handleAdd = useCallback(async () => {
    if (!newContent.trim()) return;
    const entry: ProgressEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: newDate,
      content: newContent.trim(),
      imageUrl: newImageUrl || undefined,
      assignee: newAssignee.trim() || undefined,
      estimatedNodeCompletion: newEstimatedNodeCompletion || undefined,
    };
    const updated = [entry, ...entries].sort((a, b) => b.date.localeCompare(a.date));
    setEntries(updated);
    setNewContent('');
    setNewDate(new Date().toISOString().slice(0, 10));
    setNewImageUrl('');
    setNewImageSizeKB(null);
    setNewAssignee('');
    setNewEstimatedNodeCompletion('');
    try {
      const result = await saveEntries(moldNumber, updated);
      toast.success(result.backupCreated ? '保存成功（已自动创建回滚快照）' : '保存成功（已复用最近快照）');
      if (showAuditPanel) await refreshAuditLogs();
    } catch (err) {
      setEntries(entries);
      toast.error(err instanceof Error ? err.message : '保存失败');
    }
  }, [entries, moldNumber, newContent, newDate, newImageUrl, newAssignee, newEstimatedNodeCompletion, showAuditPanel, refreshAuditLogs]);

  const handleDelete = useCallback(async (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    try {
      const result = await saveEntries(moldNumber, updated);
      toast.success(result.backupCreated ? '删除成功（已自动创建回滚快照）' : '删除成功（已复用最近快照）');
      if (showAuditPanel) await refreshAuditLogs();
    } catch (err) {
      setEntries(entries);
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  }, [entries, moldNumber, showAuditPanel, refreshAuditLogs]);

  const handleRemoveImage = useCallback(async (id: string) => {
    const updated = entries.map(e => (e.id === id ? { ...e, imageUrl: undefined } : e));
    setEntries(updated);
    try {
      const result = await saveEntries(moldNumber, updated);
      toast.success(result.backupCreated ? '删除图片成功（已自动创建回滚快照）' : '删除图片成功（已复用最近快照）');
      if (showAuditPanel) await refreshAuditLogs();
    } catch (err) {
      setEntries(entries);
      toast.error(err instanceof Error ? err.message : '删除图片失败');
    }
  }, [entries, moldNumber, showAuditPanel, refreshAuditLogs]);

  const handleEditStart = useCallback((entry: ProgressEntry) => {
    setEditingId(entry.id);
    setEditContent(entry.content);
    setEditDate(entry.date);
    setEditImageUrl(entry.imageUrl || '');
    setEditImageSizeKB(entry.imageUrl ? estimateDataUrlSizeKB(entry.imageUrl) : null);
    setEditAssignee(entry.assignee || '');
    setEditEstimatedNodeCompletion(entry.estimatedNodeCompletion || '');
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingId || !editContent.trim()) return;
    const updated = entries.map(e =>
      e.id === editingId ? { ...e, content: editContent.trim(), date: editDate, imageUrl: editImageUrl || undefined, assignee: editAssignee.trim() || undefined, estimatedNodeCompletion: editEstimatedNodeCompletion || undefined } : e
    ).sort((a, b) => b.date.localeCompare(a.date));
    setEntries(updated);
    setEditingId(null);
    try {
      const result = await saveEntries(moldNumber, updated);
      toast.success(result.backupCreated ? '更新成功（已自动创建回滚快照）' : '更新成功（已复用最近快照）');
      if (showAuditPanel) await refreshAuditLogs();
    } catch (err) {
      setEntries(entries);
      toast.error(err instanceof Error ? err.message : '更新失败');
    }
  }, [entries, moldNumber, editingId, editContent, editDate, editImageUrl, editAssignee, editEstimatedNodeCompletion, showAuditPanel, refreshAuditLogs]);

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
  }, []);

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
      setEditImageUrl('');
      setEditImageSizeKB(null);
    }
  }, [confirmDialog, closeConfirmDialog, handleDelete, handleRemoveImage]);

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
            <label className="shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 hover:bg-white/[0.08] cursor-pointer flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              上传图片
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleNewImageChange(e.target.files?.[0])} />
            </label>
            <button
              onClick={handleAdd}
              disabled={!newContent.trim()}
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
                    <label className="px-2 py-1.5 rounded bg-white/[0.06] border border-white/[0.1] text-xs text-white/70 hover:bg-white/[0.1] cursor-pointer flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      换图
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleEditImageChange(e.target.files?.[0])} />
                    </label>
                    <button onClick={handleEditSave} className="w-7 h-7 rounded flex items-center justify-center hover:bg-green-500/20 transition-colors">
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
