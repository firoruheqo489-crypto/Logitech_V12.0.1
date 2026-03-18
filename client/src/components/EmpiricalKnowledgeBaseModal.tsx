'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Check, Image as ImageIcon, Pencil, Plus, Trash2, X } from 'lucide-react';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import type { KnowledgeRecord } from './knowledge-base-types';

interface EmpiricalKnowledgeBaseModalProps {
  open: boolean;
  onClose: () => void;
  assetId: string;
  records: KnowledgeRecord[];
  onRecordsChange: (records: KnowledgeRecord[]) => void;
}

export default function EmpiricalKnowledgeBaseModal({
  open,
  onClose,
  assetId,
  records,
  onRecordsChange,
}: EmpiricalKnowledgeBaseModalProps) {
  const [entries, setEntries] = useState<KnowledgeRecord[]>(records);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newDefectIndex, setNewDefectIndex] = useState('');
  const [newCountermeasure, setNewCountermeasure] = useState('');
  const [newSubmittedBy, setNewSubmittedBy] = useState('');
  const [newDefectType, setNewDefectType] = useState<KnowledgeRecord['defectType']>('MOLD');
  const [newHasAttachment, setNewHasAttachment] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editDefectIndex, setEditDefectIndex] = useState('');
  const [editCountermeasure, setEditCountermeasure] = useState('');
  const [editSubmittedBy, setEditSubmittedBy] = useState('');
  const [editDefectType, setEditDefectType] = useState<KnowledgeRecord['defectType']>('MOLD');
  const [editHasAttachment, setEditHasAttachment] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: 'delete-entry' | 'close-modal' | null;
    id?: string;
  }>({
    open: false,
    title: '',
    message: '',
    action: null,
  });

  useEffect(() => {
    if (!open) return;
    setEntries(records);
    setNewDate(new Date().toISOString().slice(0, 10));
    setNewDefectIndex('');
    setNewCountermeasure('');
    setNewSubmittedBy('');
    setNewDefectType('MOLD');
    setNewHasAttachment(false);
    setEditingId(null);
    setConfirmDialog({
      open: false,
      title: '',
      message: '',
      action: null,
      id: undefined,
    });
  }, [open, records]);

  const handleAdd = () => {
    if (!newDefectIndex.trim() || !newCountermeasure.trim()) return;

    const nextEntries = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: newDate,
        defectIndex: newDefectIndex.trim(),
        defectType: newDefectType,
        countermeasure: newCountermeasure.trim(),
        hasAttachment: newHasAttachment,
        submittedBy: newSubmittedBy.trim() || '-',
      },
      ...entries,
    ].sort((a, b) => b.date.localeCompare(a.date));

    setEntries(nextEntries);
    onRecordsChange(nextEntries);
    setNewDate(new Date().toISOString().slice(0, 10));
    setNewDefectIndex('');
    setNewCountermeasure('');
    setNewSubmittedBy('');
    setNewDefectType('MOLD');
    setNewHasAttachment(false);
  };

  const handleDelete = (id: string) => {
    const nextEntries = entries.filter((entry) => entry.id !== id);
    setEntries(nextEntries);
    onRecordsChange(nextEntries);
  };

  const handleEditStart = (entry: KnowledgeRecord) => {
    setEditingId(entry.id);
    setEditDate(entry.date);
    setEditDefectIndex(entry.defectIndex);
    setEditCountermeasure(entry.countermeasure);
    setEditSubmittedBy(entry.submittedBy);
    setEditDefectType(entry.defectType);
    setEditHasAttachment(entry.hasAttachment);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const handleEditSave = () => {
    if (!editingId || !editDefectIndex.trim() || !editCountermeasure.trim()) return;

    const nextEntries = entries
      .map((entry) =>
        entry.id === editingId
          ? {
              ...entry,
              date: editDate,
              defectIndex: editDefectIndex.trim(),
              defectType: editDefectType,
              countermeasure: editCountermeasure.trim(),
              hasAttachment: editHasAttachment,
              submittedBy: editSubmittedBy.trim() || '-',
            }
          : entry,
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    setEntries(nextEntries);
    onRecordsChange(nextEntries);
    setEditingId(null);
  };

  const openConfirmDialog = (params: {
    title: string;
    message: string;
    action: 'delete-entry' | 'close-modal';
    id?: string;
  }) => {
    setConfirmDialog({
      open: true,
      title: params.title,
      message: params.message,
      action: params.action,
      id: params.id,
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      open: false,
      title: '',
      message: '',
      action: null,
      id: undefined,
    });
  };

  const handleConfirmAction = () => {
    const { action, id } = confirmDialog;
    closeConfirmDialog();

    if (action === 'delete-entry' && id) {
      handleDelete(id);
      return;
    }

    if (action === 'close-modal') {
      setEditingId(null);
      onClose();
    }
  };

  if (!open) return null;

  const todayDate = new Date().toISOString().slice(0, 10);
  const hasUnsavedInput =
    editingId !== null ||
    newDate !== todayDate ||
    newDefectIndex.trim() !== '' ||
    newCountermeasure.trim() !== '' ||
    newSubmittedBy.trim() !== '' ||
    newDefectType !== 'MOLD' ||
    newHasAttachment;

  const handleRequestClose = () => {
    if (!hasUnsavedInput) {
      onClose();
      return;
    }

    openConfirmDialog({
      title: '放弃当前录入',
      message: '当前未保存的知识库录入内容将被丢弃，是否继续关闭？',
      action: 'close-modal',
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleRequestClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[84vh] rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl"
        style={{ background: 'linear-gradient(180deg, #151B23 0%, #0D1117 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 12px rgba(34,211,238,0.3)' }} />
            <h3 className="text-base font-bold text-white/90">实战经验知识库</h3>
            <span className="text-xs text-white/30 font-mono">{assetId}</span>
          </div>
          <button onClick={handleRequestClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-colors" type="button">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-white/[0.06]">
          <div className="flex gap-3 items-start flex-wrap">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-[140px] shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 outline-none focus:border-cyan-400/30"
            />
            <input
              type="text"
              value={newDefectIndex}
              onChange={(e) => setNewDefectIndex(e.target.value)}
              placeholder="缺陷索引..."
              className="w-[220px] shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-400/30 font-mono"
            />
            <input
              type="text"
              value={newCountermeasure}
              onChange={(e) => setNewCountermeasure(e.target.value)}
              placeholder="输入验证有效的对策..."
              className="flex-1 min-w-[280px] px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-400/30"
            />
            <input
              type="text"
              value={newSubmittedBy}
              onChange={(e) => setNewSubmittedBy(e.target.value)}
              placeholder="知识提供者..."
              className="w-[180px] shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/80 placeholder:text-white/20 outline-none focus:border-cyan-400/30"
            />
          </div>

          <div className="flex gap-3 items-center mt-3 flex-wrap">
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] p-1">
              <button
                className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  newDefectType === 'MOLD'
                    ? 'bg-slate-700 text-slate-200 border border-slate-500/50 shadow-[0_0_10px_rgba(148,163,184,0.12)]'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
                onClick={() => setNewDefectType('MOLD')}
                type="button"
              >
                模具 MOLD
              </button>
              <button
                className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  newDefectType === 'PROCESS'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
                onClick={() => setNewDefectType('PROCESS')}
                type="button"
              >
                工艺 PROCESS
              </button>
              <button
                className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  newDefectType === 'MATERIAL'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
                onClick={() => setNewDefectType('MATERIAL')}
                type="button"
              >
                材料 MATERIAL
              </button>
            </div>

            <label className="shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 hover:bg-white/[0.08] cursor-pointer flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              上传证据图
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setNewHasAttachment(Boolean(e.target.files?.length))}
              />
            </label>
            <span className="text-[11px] text-white/35">
              {newHasAttachment ? '已选择附图证据' : '未选择附图证据'}
            </span>
            <button
              onClick={handleAdd}
              disabled={!newDefectIndex.trim() || !newCountermeasure.trim()}
              className="shrink-0 ml-auto px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400/20 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              type="button"
            >
              <Plus className="w-3.5 h-3.5" />
              添加
            </button>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(84vh - 180px)' }}>
          {entries.length === 0 ? (
            <div className="px-6 py-16 text-center text-white/20 text-sm">暂无知识沉淀，开始录入第一条经验</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="px-6 py-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                {editingId === entry.id ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3 items-start flex-wrap">
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-[140px] shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 outline-none focus:border-cyan-400/30"
                      />
                      <input
                        type="text"
                        value={editDefectIndex}
                        onChange={(e) => setEditDefectIndex(e.target.value)}
                        className="w-[220px] shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/80 outline-none focus:border-cyan-400/30 font-mono"
                      />
                      <input
                        type="text"
                        value={editCountermeasure}
                        onChange={(e) => setEditCountermeasure(e.target.value)}
                        className="flex-1 min-w-[280px] px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/80 outline-none focus:border-cyan-400/30"
                      />
                      <input
                        type="text"
                        value={editSubmittedBy}
                        onChange={(e) => setEditSubmittedBy(e.target.value)}
                        className="w-[180px] shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/80 outline-none focus:border-cyan-400/30"
                      />
                    </div>

                    <div className="flex gap-3 items-center flex-wrap">
                      <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] p-1">
                        <button
                          className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                            editDefectType === 'MOLD'
                              ? 'bg-slate-700 text-slate-200 border border-slate-500/50 shadow-[0_0_10px_rgba(148,163,184,0.12)]'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                          onClick={() => setEditDefectType('MOLD')}
                          type="button"
                        >
                          模具 MOLD
                        </button>
                        <button
                          className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                            editDefectType === 'PROCESS'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                          onClick={() => setEditDefectType('PROCESS')}
                          type="button"
                        >
                          工艺 PROCESS
                        </button>
                        <button
                          className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                            editDefectType === 'MATERIAL'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                          onClick={() => setEditDefectType('MATERIAL')}
                          type="button"
                        >
                          材料 MATERIAL
                        </button>
                      </div>

                      <label className="shrink-0 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/70 hover:bg-white/[0.08] cursor-pointer flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        更新证据图
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setEditHasAttachment(Boolean(e.target.files?.length))}
                        />
                      </label>
                      <span className="text-[11px] text-white/35">
                        {editHasAttachment ? '已选择附图证据' : '未选择附图证据'}
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={handleEditSave}
                          className="w-8 h-8 rounded flex items-center justify-center hover:bg-green-500/20 transition-colors"
                          type="button"
                        >
                          <Check className="w-4 h-4 text-green-400" />
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="w-8 h-8 rounded flex items-center justify-center hover:bg-white/[0.08] transition-colors"
                          type="button"
                        >
                          <X className="w-4 h-4 text-white/40" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <span className="text-[11px] text-white/30 font-mono shrink-0 pt-0.5 w-[90px]">{entry.date}</span>
                    <span className="shrink-0 rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-bold tracking-widest text-white/75 uppercase">
                      {entry.defectType}
                    </span>
                    <span className="text-[11px] text-cyan-300/80 font-mono shrink-0 pt-0.5 w-[180px]">{entry.defectIndex}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/75 leading-relaxed">{entry.countermeasure}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-[11px] text-white/35">提供者：{entry.submittedBy}</span>
                        <span className="text-[11px] text-amber-400/70 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {entry.hasAttachment ? '有附图' : '无附图'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditStart(entry)}
                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/[0.08] transition-colors"
                        type="button"
                      >
                        <Pencil className="w-3.5 h-3.5 text-white/50" />
                      </button>
                      <button
                        onClick={() =>
                          openConfirmDialog({
                            title: '确认删除记录',
                            message: '这条知识库记录将被永久删除，是否继续？',
                            action: 'delete-entry',
                            id: entry.id,
                          })
                        }
                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors"
                        type="button"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400/60" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <CyberConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onCancel={closeConfirmDialog}
          onConfirm={handleConfirmAction}
          confirmText={confirmDialog.action === 'close-modal' ? '确认关闭' : '确认删除'}
          cancelText="取消"
        />
      </div>
    </div>,
    document.body,
  );
}
