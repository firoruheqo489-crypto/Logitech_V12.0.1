/**
 * FaultDashboard - 问题汇总库（工业级录入与管理系统）
 * 深色工业仪表盘风格 | 闭环五大模块 | 图片智能压缩 | Supabase持久化
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle, Plus, Search, Clock, FileText, Activity,
  Send, Trash2, ArrowLeft, X,
  Upload, Image as ImageIcon,
  Calendar as CalendarIcon,
  Eye, MessageSquare, Lightbulb, Wrench, CheckCircle2, Layers, Grid3X3, Microscope,
  Cpu, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import ReportView from './ReportView';
import {
  type IssueRecord, type ImageItem, type ModuleData,
  fetchIssues, createIssue, updateIssue, deleteIssue,
  uploadImage, deleteImage,
} from '@/lib/issueService';
import {
  getIssueProcessStepLabel,
  getIssueTypeLabels,
  ISSUE_TYPE_OPTIONS,
  matchesIssueProcessStepQuery,
  matchesIssueTypeQuery,
  PROCESS_STEP_OPTIONS,
  type IssueProcessStepId,
  type IssueTypeId,
} from '@/lib/issueDomain';
import { useDebouncedDirtyIssueAutosave } from '@/hooks/useDebouncedDirtyIssueAutosave';
import VDISurfaceGrid from '@/components/VDISurfaceGrid';
import DefectLab from '@/components/DefectLab';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';

// ═══════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════

const MODULE_CONFIG = [
  { key: 'evidence' as const, label: '证据展示', icon: Eye, num: 4, maxImages: 6, desc: '上传异常现场照片、检测报告等证据材料' },
  { key: 'description' as const, label: '问题描述', icon: MessageSquare, num: 5, maxImages: 3, desc: '详细描述问题现象、发生频率、影响范围' },
  { key: 'rootCause' as const, label: '原因分析', icon: Lightbulb, num: 6, maxImages: 3, desc: '分析问题根本原因，使用5Why或鱼骨图方法' },
  { key: 'solution' as const, label: '处理对策', icon: Wrench, num: 7, maxImages: 3, desc: '制定纠正措施和预防措施' },
  { key: 'verification' as const, label: '效果验证', icon: CheckCircle2, num: 8, maxImages: 3, desc: '验证对策实施效果，确认问题是否闭环' },
];

let issueCounter = 0;
function getNextId(existing: IssueRecord[]): string {
  if (issueCounter === 0 && existing.length > 0) {
    const nums = existing.map(r => { const m = r.id.match(/ISS-(\d+)/); return m ? parseInt(m[1], 10) : 0; });
    issueCounter = Math.max(...nums);
  }
  issueCounter++;
  return `ISS-${String(issueCounter).padStart(3, '0')}`;
}

function createEmptyRecord(existing: IssueRecord[] = [], projectId = '', projectName = '', productName = ''): IssueRecord {
  const now = new Date().toISOString();
  return {
    id: getNextId(existing), projectId, projectName, productName,
    types: [], date: new Date().toISOString().split('T')[0], process: '',
    quantity: '', technician: '', machine: '', cavity: '',
    modules: {
      evidence: { text: '', images: [] }, description: { text: '', images: [] },
      rootCause: { text: '', images: [] }, solution: { text: '', images: [] },
      verification: { text: '', images: [] },
    },
    status: 'draft', createdAt: now, updatedAt: now,
  };
}

// ═══════════════════════════════════════════════
// Image Compression
// ═══════════════════════════════════════════════

async function compressImage(file: File, maxSizeKB = 500): Promise<File> {
  if (file.size <= maxSizeKB * 1024) return file;
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const maxDim = 1920;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio); height = Math.round(height * ratio);
      }
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(file);
        return;
      }
      context.drawImage(img, 0, 0, width, height);
      let lo = 0.1, hi = 0.92, mid = 0.7;
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= maxSizeKB * 1024 || hi - lo < 0.05) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else { hi = mid; mid = (lo + hi) / 2; tryCompress(); }
        }, 'image/jpeg', mid);
      };
      tryCompress();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image "${file.name}" for compression`));
    };
    img.src = url;
  });
}

// (compression function stays, localStorage removed - using Supabase now)

// ═══════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════

function TypeTagSelector({ selected, onChange }: { selected: IssueTypeId[]; onChange: (v: IssueTypeId[]) => void }) {
  const toggle = (typeId: IssueTypeId) =>
    onChange(selected.includes(typeId) ? selected.filter((item) => item !== typeId) : [...selected, typeId]);

  return (
    <div className="flex flex-wrap gap-2">
      {ISSUE_TYPE_OPTIONS.map((option) => {
        const active = selected.includes(option.id);
        return (
          <button key={option.id} type="button" onClick={() => toggle(option.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer border
              ${active ? 'bg-[#3b82f6]/20 border-[#3b82f6]/50 text-[#60a5fa] shadow-[0_0_12px_rgba(59,130,246,0.2)]' : 'bg-white/[0.03] border-white/[0.08] text-[#8B949E] hover:bg-white/[0.06] hover:border-white/[0.15]'}`}>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ProcessSelector({
  value,
  onChange,
}: {
  value: IssueProcessStepId | '';
  onChange: (v: IssueProcessStepId) => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {PROCESS_STEP_OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button key={option.id} type="button" onClick={() => onChange(option.id)}
            className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer border
              ${active ? 'bg-[#3b82f6]/15 border-[#3b82f6]/40 text-[#60a5fa] shadow-[0_0_10px_rgba(59,130,246,0.15)]' : 'bg-white/[0.03] border-white/[0.08] text-[#8B949E] hover:bg-white/[0.06]'}`}>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AutoTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = Math.max(120, ref.current.scrollHeight) + 'px'; } }, [value]);
  return (
    <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-white/[0.02] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-[#E6EDF3] placeholder:text-[#6E7681] resize-none focus:outline-none focus:border-[#3b82f6]/40 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.1)] transition-all min-h-[120px]" />
  );
}

/** LightBox viewer */
function LightBox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-8" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all cursor-pointer">
        <X className="w-5 h-5 text-white" />
      </button>
      <img src={src} alt={alt} onClick={e => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
    </div>
  );
}

/** Image upload zone with drag & drop + lightbox */
function ImageUploadZone({ images, maxImages, onAdd, onRemove }: {
  images: ImageItem[]; maxImages: number; onAdd: (files: File[]) => void; onRemove: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<ImageItem | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = maxImages - images.length;

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (f.length) onAdd(f); }, [onAdd]);
  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = Array.from(e.target.files || []); if (f.length) onAdd(f); e.target.value = ''; }, [onAdd]);

  return (
    <>
      {lightboxImg && <LightBox src={lightboxImg.preview} alt={lightboxImg.name} onClose={() => setLightboxImg(null)} />}
      <div className="space-y-3">
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map(img => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden border border-white/[0.08] aspect-video bg-black/30 cursor-pointer" onClick={() => setLightboxImg(img)}>
                <img src={img.preview} alt={img.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <button type="button" onClick={e => { e.stopPropagation(); setPendingRemoveId(img.id); }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <X className="w-3 h-3 text-white" />
                </button>
                {img.compressed && <span className="absolute bottom-1 left-1 text-[9px] bg-emerald-500/80 text-white px-1.5 py-0.5 rounded">已压缩</span>}
                <span className="absolute bottom-1 right-1 text-[9px] bg-black/60 text-white/70 px-1.5 py-0.5 rounded">{(img.size / 1024).toFixed(0)}KB</span>
              </div>
            ))}
          </div>
        )}
        {remaining > 0 && (
          <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
              ${dragOver ? 'border-[#3b82f6]/50 bg-[#3b82f6]/5' : 'border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]'}`}>
            <Upload className="w-6 h-6 text-[#6E7681] mx-auto mb-2" />
            <p className="text-xs text-[#6E7681]">拖拽图片到此处或点击上传</p>
            <p className="text-[10px] text-[#6E7681]/60 mt-1">还可上传 {remaining} 张 · 超过500KB自动压缩</p>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSelect} />
          </div>
        )}
      </div>

      <CyberConfirmDialog
        open={!!pendingRemoveId}
        title="Delete confirmation"
        message="Delete this image? This action cannot be undone."
        onConfirm={() => {
          const targetId = pendingRemoveId;
          setPendingRemoveId(null);
          if (!targetId) return;
          onRemove(targetId);
        }}
        onCancel={() => setPendingRemoveId(null)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}

/** Closed-loop module (4-8) */
function ClosedLoopModule({ issueId, config, data, onChange }: {
  issueId: string; config: typeof MODULE_CONFIG[0]; data: ModuleData; onChange: (d: ModuleData) => void;
}) {
  const Icon = config.icon;

  const handleAddImages = useCallback(async (files: File[]) => {
    const remaining = config.maxImages - data.images.length;
    const toProcess = files.slice(0, remaining);
    let nextImages = data.images;
    for (const file of toProcess) {
      try {
        const compressed = await compressImage(file);
        const result = await uploadImage(issueId, config.key, compressed);
        const preview = result ? result.publicUrl : URL.createObjectURL(compressed);
        const newImg: ImageItem = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          file: compressed, preview, name: file.name, size: compressed.size,
          compressed: compressed.size < file.size,
        };
        nextImages = [...nextImages, newImg];
        onChange({ ...data, images: nextImages });
        if (compressed.size < file.size) toast.success(`${file.name} 已压缩: ${(file.size/1024).toFixed(0)}KB → ${(compressed.size/1024).toFixed(0)}KB`);
      } catch (error) {
        console.error('Image processing failed:', error);
        toast.error(`${file.name} 处理失败，请重试`);
      }
    }
  }, [data, config.maxImages, config.key, issueId, onChange]);

  const handleRemoveImage = useCallback(async (id: string) => {
    const img = data.images.find(i => i.id === id);
    if (img) {
      if (img.preview.startsWith('blob:')) {
        URL.revokeObjectURL(img.preview);
      } else {
        await deleteImage(img.preview);
      }
    }
    onChange({ ...data, images: data.images.filter(i => i.id !== id) });
  }, [data, onChange]);

  return (
    <div className="project-card theme-info rounded-lg overflow-hidden border border-white/[0.06] !transform-none [&::before]:!hidden [&::after]:!hidden" style={{ '--accent': '#3b82f6', '--accent-rgb': '59,130,246' } as React.CSSProperties}>
      <div className="pc-section px-6 py-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}>
            {config.num}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-[#60a5fa]" />
              <h4 className="text-base font-bold text-[#E6EDF3]">{config.label}</h4>
            </div>
            <p className="text-xs text-[#6E7681] mt-0.5">{config.desc}</p>
          </div>
          <span className="text-xs text-[#6E7681]">{data.images.length}/{config.maxImages} 图</span>
        </div>
        <div className="mb-4">
          <label className="text-xs font-bold text-[#6E7681] uppercase tracking-wider mb-2 block">描述内容</label>
          <AutoTextarea value={data.text} onChange={text => onChange({ ...data, text })} placeholder={`请输入${config.label}内容...`} />
        </div>
        <div>
          <label className="text-xs font-bold text-[#6E7681] uppercase tracking-wider mb-2 block">
            <ImageIcon className="w-3 h-3 inline mr-1" />图片附件（最多{config.maxImages}张）
          </label>
          <ImageUploadZone images={data.images} maxImages={config.maxImages} onAdd={handleAddImages} onRemove={handleRemoveImage} />
        </div>
      </div>
    </div>
  );
}

/** Issue list item */
function IssueListItem({ record, isActive, onClick }: { record: IssueRecord; isActive: boolean; onClick: () => void }) {
  const statusMap = {
    draft: { label: '草稿', cls: 'border-[#FACC15]/40 text-[#FACC15] bg-[#FACC15]/10' },
    submitted: { label: '已提交', cls: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' },
  };
  const s = statusMap[record.status];
  const typeStr = getIssueTypeLabels(record.types).join(' · ') || '未分类';
  const processLabel = record.process ? getIssueProcessStepLabel(record.process) : '—';
  return (
    <div onClick={onClick}
      className={`px-4 py-3.5 border-b border-white/[0.04] cursor-pointer transition-all duration-200
        ${isActive ? 'bg-[#3b82f6]/8 border-l-2 border-l-[#3b82f6]' : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-bold tracking-wide bg-clip-text text-transparent -mt-0.5 pl-5"
            style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}>
            {record.projectId || '—'}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
            <FileText className="w-3 h-3 opacity-70 text-slate-500 shrink-0" />
            <span className="font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}>{record.id}</span>
            <span className="text-slate-600">·</span>
            <span className="font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}>{typeStr}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
            <Clock className="w-3 h-3 opacity-70 text-slate-500 shrink-0" />
            <span className="font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}>{record.date}</span>
            <span className="text-slate-700">·</span>
            <span className="font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}>{processLabel}</span>
          </div>
        </div>
        <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full border ${s.cls}`}>{s.label}</span>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════

export default function FaultDashboard() {
  // Read project info from URL: /fault?id=LA26006&project=Ziti&product=Bioko+M+END+CAP
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id') || '';
  const projectName = urlParams.get('project') || '';
  const productName = urlParams.get('product') || '';

  const [records, setRecords] = useState<IssueRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [globalCount, setGlobalCount] = useState<number | null>(null);
  const [showGlobal, setShowGlobal] = useState(false);
  const [localRecords, setLocalRecords] = useState<IssueRecord[]>([]);
  const [showVDI, setShowVDI] = useState(false);
  const [showDefectLab, setShowDefectLab] = useState(false);
  // ── 状态提升：材质 & VDI 全局共享给 VDISurfaceGrid + DefectLab ──
  const [selectedMat, setSelectedMat] = useState<'PC/ABS' | 'POM/PA' | 'PP/PE'>('PC/ABS');
  const [currentVDI, setCurrentVDI] = useState<number>(30);
  const isRecordInLocalScope = useCallback((record: IssueRecord) => (
    !projectId || record.projectId === projectId
  ), [projectId]);

  const upsertRecordCollections = useCallback((record: IssueRecord) => {
    setRecords(prev => prev.some(r => r.id === record.id)
      ? prev.map(r => r.id === record.id ? record : r)
      : [record, ...prev]);

    if (isRecordInLocalScope(record)) {
      setLocalRecords(prev => prev.some(r => r.id === record.id)
        ? prev.map(r => r.id === record.id ? record : r)
        : [record, ...prev]);
    }
  }, [isRecordInLocalScope]);

  const removeRecordCollections = useCallback((id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    setLocalRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  const persistIssueQuietly = useCallback(async (record: IssueRecord): Promise<boolean> => {
    try {
      return await updateIssue(record);
    } catch (error) {
      console.error('Issue persistence failed:', error);
      return false;
    }
  }, []);

  const { markDirty: queueIssueSave, clearDirty: clearQueuedIssueSave } = useDebouncedDirtyIssueAutosave({
    persistRecord: persistIssueQuietly,
    onPartialFailure: () => {
      toast.error('Issue auto-save failed');
    },
  });

  // Load from Supabase on mount, filtered by projectId
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const data = await fetchIssues(projectId || undefined);
        if (cancelled) return;
        setRecords(data);
        setLocalRecords(data);

        const all = await fetchIssues();
        if (!cancelled) setGlobalCount(all.length);
      } catch (error) {
        console.error('Failed to load issues:', error);
        if (!cancelled) toast.error('问题数据加载失败，请稍后重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const toggleGlobal = useCallback(async () => {
    if (showGlobal) {
      setRecords(localRecords);
      setShowGlobal(false);
      setActiveId(null);
      return;
    }

    try {
      const all = await fetchIssues();
      setRecords(all);
      setShowGlobal(true);
      setActiveId(null);
    } catch (error) {
      console.error('Failed to load global issues:', error);
      toast.error('全局问题数据加载失败，请稍后重试');
    }
  }, [showGlobal, localRecords]);

  /*
  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    let cancelled = false;
    saveTimer.current = setTimeout(() => {
      void (async () => {
        const results = await Promise.all(records.map(r => persistIssueQuietly(r)));
        if (!cancelled && results.some(saved => !saved)) {
          toast.error('自动保存失败，请稍后重试');
        }
      })();
    }, 1500);
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [persistIssueQuietly, records]);
  */

  const activeRecord = records.find(r => r.id === activeId) || null;
  const filteredRecords = records.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.types.some((type) => matchesIssueTypeQuery(type, q)) ||
      matchesIssueProcessStepQuery(r.process, q)
    );
  });

  const draftCount = records.filter(r => r.status === 'draft').length;
  const submittedCount = records.filter(r => r.status === 'submitted').length;

  const handleCreate = useCallback(async () => {
    const n = createEmptyRecord(records, projectId, projectName, productName);
    setRecords(prev => [n, ...prev]);
    setLocalRecords(prev => [n, ...prev]);
    setActiveId(n.id);
    let created = false;
    try {
      created = await createIssue(n);
    } catch (error) {
      console.error('Issue creation failed:', error);
    }
    if (!created) {
      removeRecordCollections(n.id);
      setActiveId(current => current === n.id ? null : current);
      toast.error('新问题创建失败，请检查服务连接');
      return;
    }
    toast.success('新问题已创建');
  }, [productName, projectId, projectName, records, removeRecordCollections]);

  const handleUpdate = useCallback((updated: IssueRecord) => {
    const withTime = { ...updated, updatedAt: new Date().toISOString() };
    queueIssueSave(withTime);
    upsertRecordCollections(withTime);
  }, [queueIssueSave, upsertRecordCollections]);

  const handleDelete = useCallback(async (id: string) => {
    const record = records.find(r => r.id === id) || localRecords.find(r => r.id === id);
    if (record) {
      let deleted = false;
      try {
        deleted = await deleteIssue(id, record.modules);
      } catch (error) {
        console.error('Issue deletion failed:', error);
      }
      if (!deleted) {
        toast.error('记录删除失败，请稍后重试');
        return;
      }
    }
    clearQueuedIssueSave(id);
    removeRecordCollections(id);
    if (activeId === id) setActiveId(null);
    toast.success('记录已删除');
  }, [activeId, clearQueuedIssueSave, localRecords, records, removeRecordCollections]);

  const handleSubmit = useCallback((id: string) => {
    const updated = records.find(r => r.id === id);
    if (!updated) return;
    const submitted = { ...updated, status: 'submitted' as const, updatedAt: new Date().toISOString() };
    upsertRecordCollections(submitted);
    void (async () => {
      const saved = await persistIssueQuietly(submitted);
      if (!saved) {
        queueIssueSave(updated);
        upsertRecordCollections(updated);
        toast.error('问题提交失败，请稍后重试');
        return;
      }
      toast.success('问题已提交');
      clearQueuedIssueSave(id);
    })();
  }, [clearQueuedIssueSave, persistIssueQuietly, queueIssueSave, records, upsertRecordCollections]);

  return (
    <div className="w-full h-screen bg-[#0B0F14] flex flex-col overflow-hidden">
      {/* ═══ Cyberpunk HUD Header ═══ */}
      <header className="shrink-0 bg-[#030712] border-b border-cyan-900/30 select-none">

        {/* ── TOP ROW: Project Identity + System Status + Action Buttons ── */}
        <div className="relative overflow-hidden" style={{ borderBottom: '1px solid oklch(0.22 0.04 220)' }}>
          {/* Scanline overlay */}
          <div className="pointer-events-none absolute inset-0 z-0"
            style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0.82 0.18 195 / 0.018) 2px, oklch(0.82 0.18 195 / 0.018) 4px)' }} />
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, oklch(0.82 0.18 195 / 0.6) 30%, oklch(0.65 0.22 28 / 0.4) 70%, transparent)' }} />

          <div className="relative z-10 flex items-center justify-between px-4 py-2.5 gap-4">
            {/* Left: Project identity */}
            <div className="flex items-center gap-0 shrink-0">
              {/* Status dot + Project ID */}
              <div className="relative flex items-center gap-2 pr-3" style={{ borderRight: '1px solid oklch(0.25 0.04 220)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                <span className="text-[16px] font-mono font-black tracking-[0.2em] uppercase text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                  {projectId || 'SYS'}
                </span>
              </div>
              {/* FONT tag */}
              {projectName && (
                <div className="flex items-center gap-1 px-3" style={{ borderRight: '1px solid oklch(0.25 0.04 220)' }}>
                  <span className="text-[11px] font-mono tracking-[0.15em] text-slate-500">FONT</span>
                  <span className="text-[13px] font-mono font-semibold tracking-wide ml-1" style={{ color: 'oklch(0.72 0.1 195)' }}>{projectName}</span>
                </div>
              )}
              {/* PROJECT tag */}
              {productName && (
                <div className="flex items-center gap-1 px-3">
                  <span className="text-[11px] font-mono tracking-[0.1em] text-slate-500">PROJECT</span>
                  <span className="text-[13px] font-mono font-medium tracking-wide ml-1" style={{ color: 'oklch(0.65 0.08 195)' }}>{productName}</span>
                </div>
              )}
            </div>

            {/* Center: System status indicators */}
<div className="hidden md:flex items-center gap-5 flex-1 justify-center">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" style={{ color: 'oklch(0.55 0.06 195)' }} />
                <span className="text-[11px] font-mono tracking-widest text-slate-400">SYS.ONLINE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" style={{ color: 'oklch(0.72 0.2 145)' }} />
                <span className="text-[11px] font-mono tracking-widest" style={{ color: 'oklch(0.6 0.08 145)' }}>MONITORING</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" style={{ color: 'oklch(0.65 0.22 28)' }} />
                <span className="text-[11px] font-mono tracking-widest" style={{ color: 'oklch(0.58 0.1 28)' }}>REALTIME</span>
              </div>
              <span className="text-[12px] font-mono tracking-widest tabular-nums text-slate-400">
                {new Date().toLocaleTimeString('zh-CN', { hour12: false })}
              </span>
            </div>

            {/* Right: Status chips + Action Buttons — all in one row */}
            <div className="flex items-center gap-2 shrink-0">
              {/* ── Status Chips (dual-layer, bigger) ── */}
              <div className="hidden md:flex items-center gap-2">
                {/* 草稿 */}
                <div className="flex flex-col items-start justify-between w-[180px] h-[84px] px-4 py-2 rounded-sm cursor-default border"
                  style={{ borderColor: 'oklch(0.65 0.22 28 / 0.55)', background: 'oklch(0.65 0.22 28 / 0.08)', boxShadow: 'inset 0 0 10px oklch(0.65 0.22 28 / 0.16), 0 0 12px oklch(0.65 0.22 28 / 0.2)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                    <span className="text-[26px] font-mono font-extrabold tracking-wide" style={{ color: 'oklch(0.75 0.2 28)' }}>草稿 {draftCount}</span>
                  </div>
                  <span className="text-[13px] font-mono font-semibold tracking-[0.2em] text-slate-500 pl-4">DFT.COUNT</span>
                </div>
                {/* 已提交 */}
                <div className="flex flex-col items-start justify-between w-[180px] h-[84px] px-4 py-2 rounded-sm cursor-default border"
                  style={{ borderColor: 'oklch(0.72 0.2 145 / 0.55)', background: 'oklch(0.72 0.2 145 / 0.08)', boxShadow: 'inset 0 0 10px oklch(0.72 0.2 145 / 0.14), 0 0 12px oklch(0.72 0.2 145 / 0.18)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                    <span className="text-[26px] font-mono font-extrabold tracking-wide" style={{ color: 'oklch(0.88 0.14 195)' }}>已提交 {submittedCount}</span>
                  </div>
                  <span className="text-[13px] font-mono font-semibold tracking-[0.2em] text-slate-500 pl-4">SUB.COUNT</span>
                </div>
                {/* 总计 */}
                <div className="flex flex-col items-start justify-between w-[180px] h-[84px] px-4 py-2 rounded-sm cursor-default border"
                  style={{ borderColor: 'oklch(0.82 0.18 195 / 0.55)', background: 'oklch(0.82 0.18 195 / 0.08)', boxShadow: 'inset 0 0 10px oklch(0.82 0.18 195 / 0.16), 0 0 12px oklch(0.82 0.18 195 / 0.22)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                    <span className="text-[26px] font-mono font-extrabold tracking-wide" style={{ color: 'oklch(0.88 0.14 195)' }}>总计 {records.length}</span>
                  </div>
                  <span className="text-[13px] font-mono font-semibold tracking-[0.2em] text-slate-500 pl-4">ALL.TOTAL</span>
                </div>
                {/* 全局 */}
                <div onClick={toggleGlobal}
                  className="flex flex-col items-start justify-between w-[180px] h-[84px] px-4 py-2 rounded-sm cursor-pointer transition-all duration-200 border"
                  style={{
                    borderColor: showGlobal ? 'oklch(0.82 0.18 195 / 0.55)' : 'oklch(0.48 0.03 220 / 0.45)',
                    background: showGlobal ? 'oklch(0.82 0.18 195 / 0.08)' : 'oklch(0.18 0.02 220 / 0.35)',
                    boxShadow: showGlobal
                      ? 'inset 0 0 10px oklch(0.82 0.18 195 / 0.16), 0 0 12px oklch(0.82 0.18 195 / 0.22)'
                      : 'inset 0 0 8px oklch(0.48 0.03 220 / 0.16), 0 0 8px oklch(0.48 0.03 220 / 0.12)',
                  }}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${showGlobal ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'} animate-pulse`} />
                    <span className="text-[26px] font-mono font-extrabold tracking-wide"
                      style={{ color: showGlobal ? 'oklch(0.88 0.14 195)' : 'oklch(0.55 0.04 195)' }}>全局 {globalCount ?? '—'}</span>
                  </div>
                  <span className="text-[13px] font-mono font-semibold tracking-[0.2em] text-slate-500 pl-4">GLB.SCOPE</span>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px self-stretch my-1" style={{ background: 'linear-gradient(to bottom, transparent, oklch(0.82 0.18 195 / 0.4), transparent)' }} />

              {/* ── Action Buttons ── */}
              <button onClick={() => setShowVDI(true)}
                className="relative flex items-center justify-center gap-2 w-[118px] h-[84px] text-[15px] font-mono font-extrabold tracking-[0.18em] uppercase rounded-sm border text-cyan-400 hover:text-cyan-200 hover:border-cyan-300 transition-all duration-300 cursor-pointer"
                style={{
                  borderColor: 'oklch(0.82 0.18 195 / 0.55)',
                  background: 'oklch(0.82 0.18 195 / 0.08)',
                  boxShadow: 'inset 0 0 10px oklch(0.82 0.18 195 / 0.14), 0 0 12px oklch(0.82 0.18 195 / 0.18)',
                }}>
                <Grid3X3 className="w-4.5 h-4.5 shrink-0" /><span>VDI</span>
              </button>
              <button onClick={() => setShowDefectLab(true)}
                className="relative flex items-center justify-center gap-2 w-[118px] h-[84px] text-[15px] font-mono font-extrabold tracking-[0.18em] uppercase rounded-sm border text-rose-400 hover:text-rose-200 hover:border-rose-300 transition-all duration-300 cursor-pointer"
                style={{
                  borderColor: 'oklch(0.65 0.22 28 / 0.55)',
                  background: 'oklch(0.65 0.22 28 / 0.08)',
                  boxShadow: 'inset 0 0 10px oklch(0.65 0.22 28 / 0.14), 0 0 12px oklch(0.65 0.22 28 / 0.18)',
                }}>
                <Microscope className="w-4.5 h-4.5 shrink-0" /><span>注塑诊所</span>
              </button>
              <a href={projectId ? `/gantt?id=${encodeURIComponent(projectId)}` : '/'}
                className="relative flex items-center justify-center gap-2 w-[118px] h-[84px] text-[15px] font-mono font-extrabold tracking-[0.18em] uppercase rounded-sm border text-cyan-400 hover:text-cyan-200 hover:border-cyan-300 transition-all duration-300 cursor-pointer"
                style={{
                  borderColor: 'oklch(0.82 0.18 195 / 0.55)',
                  background: 'oklch(0.82 0.18 195 / 0.08)',
                  boxShadow: 'inset 0 0 10px oklch(0.82 0.18 195 / 0.14), 0 0 12px oklch(0.82 0.18 195 / 0.18)',
                }}>
                <ArrowLeft className="w-4.5 h-4.5 shrink-0" /><span>{projectId ? '甘特' : '看板'}</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[320px] shrink-0 bg-[#11161D] border-r border-white/[0.06] flex flex-col">
          <div className="p-3 border-b border-white/[0.06] space-y-2">
            <Button onClick={handleCreate} className="w-full h-10 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-sm cursor-pointer active:scale-[0.97] transition-all">
              <Plus className="w-4 h-4 mr-1.5" />新建问题
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6E7681]" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索问题编号、类型..."
                className="w-full h-9 pl-9 pr-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-xs text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#3b82f6]/40 transition-all" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-[#6E7681]/30 mx-auto mb-2" />
                <p className="text-xs text-[#6E7681]">暂无问题记录</p>
                <p className="text-[10px] text-[#6E7681]/60 mt-1">点击上方按钮新建</p>
              </div>
            ) : filteredRecords.map(r => (
              <IssueListItem key={r.id} record={r} isActive={activeId === r.id} onClick={() => setActiveId(r.id)} />
            ))}
          </div>
        </aside>

        {/* Right: Detail Form or Report View */}
        <main className="flex-1 overflow-y-auto">
          {!activeRecord ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-[#6E7681]/30" />
                </div>
                <p className="text-sm text-[#6E7681]">选择左侧问题或新建一条记录</p>
              </div>
            </div>
          ) : activeRecord.status === 'submitted' ? (
            <ReportView
              record={activeRecord}
              onBack={() => setActiveId(null)}
              onEdit={() => {
                const edited = { ...activeRecord, status: 'draft' as const };
                upsertRecordCollections(edited);
                void (async () => {
                  const saved = await persistIssueQuietly(edited);
                  if (!saved) {
                    upsertRecordCollections(activeRecord);
                    toast.error('切换编辑模式失败，请稍后重试');
                    return;
                  }
                  toast.success('已切换为编辑模式');
                  clearQueuedIssueSave(edited.id);
                })();
              }}
              onDelete={() => handleDelete(activeRecord.id)}
            />
          ) : (
            <IssueForm record={activeRecord} onUpdate={handleUpdate} onDelete={handleDelete} onSubmit={handleSubmit} />
          )}
        </main>
      </div>
      {showVDI && <VDISurfaceGrid onClose={() => setShowVDI(false)} selectedMat={selectedMat} onMatChange={setSelectedMat} currentVDI={currentVDI} onVDIChange={setCurrentVDI} />}
      {showDefectLab && <DefectLab onClose={() => setShowDefectLab(false)} material={selectedMat} vdi={currentVDI} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Issue Form (right panel)
// ═══════════════════════════════════════════════

function IssueForm({ record, onUpdate, onDelete, onSubmit }: {
  record: IssueRecord; onUpdate: (r: IssueRecord) => void; onDelete: (id: string) => void; onSubmit: (id: string) => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const update = (partial: Partial<IssueRecord>) => onUpdate({ ...record, ...partial });
  const updateModule = (key: keyof IssueRecord['modules'], data: ModuleData) => onUpdate({ ...record, modules: { ...record.modules, [key]: data } });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Form Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#E6EDF3]">{record.id}</h2>
          <p className="text-xs text-[#6E7681] mt-0.5">
            创建于 {new Date(record.createdAt).toLocaleString('zh-CN')}
            {record.status === 'draft' && ' · 草稿自动保存中'}
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="project-card theme-info rounded-lg overflow-hidden border border-white/[0.06] !transform-none [&::before]:!hidden [&::after]:!hidden" style={{ '--accent': '#3b82f6', '--accent-rgb': '59,130,246' } as React.CSSProperties}>
        <div className="pc-header px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="pc-accent-bar w-1 h-5 rounded-full" />
            <h3 className="text-lg font-bold text-[#E6EDF3]">基本信息</h3>
          </div>
        </div>
        <div className="pc-section px-6 py-5 space-y-5">
          <div>
            <label className="text-xs font-bold text-[#6E7681] uppercase tracking-wider mb-2 block">问题类型（多选）</label>
            <TypeTagSelector selected={record.types} onChange={types => update({ types })} />
          </div>
          <div>
            <label className="text-xs font-bold text-[#6E7681] uppercase tracking-wider mb-2 block">
              <CalendarIcon className="w-3 h-3 inline mr-1" />发生时间
            </label>
            <input type="date" value={record.date} onChange={e => update({ date: e.target.value })}
              className="h-10 px-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-[#E6EDF3] focus:outline-none focus:border-[#3b82f6]/40 transition-all cursor-pointer" />
          </div>
          <div>
            <label className="text-xs font-bold text-[#6E7681] uppercase tracking-wider mb-2 block">发现环节（单选）</label>
            <ProcessSelector value={record.process} onChange={process => update({ process })} />
          </div>
          {/* Optional: moldId / quantity / technician / machine / cavity */}
          <div className="grid grid-cols-5 gap-3 pt-1">
            <div>
              <label className="text-xs font-bold text-[#6E7681] uppercase tracking-wider mb-2 block">模具编号</label>
              <input type="text" value={record.projectId || ''} onChange={e => update({ projectId: e.target.value })} placeholder="如：LA25463"
                className="w-full h-10 px-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#3b82f6]/40 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#6E7681] uppercase tracking-wider mb-2 block">关联数量（选填）</label>
              <input type="text" value={record.quantity || ''} onChange={e => update({ quantity: e.target.value })} placeholder="如：5pcs"
                className="w-full h-10 px-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#3b82f6]/40 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#6E7681] uppercase tracking-wider mb-2 block">技术员（选填）</label>
              <input type="text" value={record.technician || ''} onChange={e => update({ technician: e.target.value })} placeholder="姓名"
                className="w-full h-10 px-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#3b82f6]/40 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#6E7681] uppercase tracking-wider mb-2 block">机台（选填）</label>
              <input type="text" value={record.machine || ''} onChange={e => update({ machine: e.target.value })} placeholder="机台编号"
                className="w-full h-10 px-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#3b82f6]/40 transition-all" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#6E7681] uppercase tracking-wider mb-2 block">模具穴号（选填）</label>
              <input type="text" value={record.cavity || ''} onChange={e => update({ cavity: e.target.value })} placeholder="如：#3"
                className="w-full h-10 px-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#3b82f6]/40 transition-all" />
            </div>
          </div>
        </div>
      </div>

      {/* Closed-Loop Modules (4-8) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1 h-5 rounded-full bg-[#3b82f6]" style={{ boxShadow: '0 0 8px rgba(59,130,246,0.5)' }} />
          <h3 className="text-lg font-bold text-[#E6EDF3]">闭环五大模块</h3>
          <span className="text-xs text-[#6E7681] ml-2">按工序严格填写</span>
        </div>
        {MODULE_CONFIG.map(config => (
          <ClosedLoopModule key={config.key} issueId={record.id} config={config} data={record.modules[config.key]} onChange={data => updateModule(config.key, data)} />
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.06]">
        <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}
          className="text-[#FF3B3B] border-[#FF3B3B]/20 hover:bg-[#FF3B3B]/10 cursor-pointer active:scale-[0.97]">
          <Trash2 className="w-3.5 h-3.5 mr-1" />删除
        </Button>
        {record.status === 'draft' && (
          <Button size="sm" onClick={() => onSubmit(record.id)}
            className="bg-[#00FFA3]/15 text-[#00FFA3] border border-[#00FFA3]/30 hover:bg-[#00FFA3]/25 cursor-pointer active:scale-[0.97]">
            <Send className="w-3.5 h-3.5 mr-1" />提交
          </Button>
        )}
      </div>

      <CyberConfirmDialog
        open={showDeleteConfirm}
        title="删除确认"
        message={`确定要删除记录 ${record.id} 吗？删除后所有数据和图片将无法恢复。`}
        onConfirm={() => { setShowDeleteConfirm(false); onDelete(record.id); }}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="确认删除"
        cancelText="取消"
      />

      <div className="h-20" />
    </div>
  );
}
