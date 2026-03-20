import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import ReportView from '@/pages/ReportView';
import {
  createIssue,
  deleteImage,
  deleteIssue,
  fetchIssues,
  type ImageItem,
  type IssueRecord,
  type ModuleData,
  updateIssue,
  uploadImage,
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

const MODULE_CONFIG = [
  { key: 'evidence' as const, label: '证据展示', icon: Eye, num: 4, maxImages: 6, desc: '上传异常现场照片、检测报告等证据材料' },
  { key: 'description' as const, label: '问题描述', icon: MessageSquare, num: 5, maxImages: 3, desc: '详细描述问题现象、发生范围、影响范围' },
  { key: 'rootCause' as const, label: '原因分析', icon: Lightbulb, num: 6, maxImages: 3, desc: '分析问题根本原因，可使用 5Why 或鱼骨图方法' },
  { key: 'solution' as const, label: '处理对策', icon: Wrench, num: 7, maxImages: 3, desc: '制定纠正措施和预防措施' },
  { key: 'verification' as const, label: '效果验证', icon: CheckCircle2, num: 8, maxImages: 3, desc: '验证对策实施效果，确认问题是否闭环' },
];

const WORKSPACE_SHELL_STYLE = {
  background: 'linear-gradient(180deg, rgba(21,27,35,0.96) 0%, rgba(14,19,26,0.98) 100%)',
  boxShadow: '0 18px 48px rgba(2,6,23,0.18), inset 0 1px 0 rgba(255,255,255,0.03)',
} as React.CSSProperties;

const WORKSPACE_SIDEBAR_STYLE = {
  background: 'linear-gradient(180deg, rgba(23,30,39,0.72) 0%, rgba(18,24,32,0.58) 100%)',
} as React.CSSProperties;

const WORKSPACE_MAIN_STYLE = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0) 42%)',
} as React.CSSProperties;

const WORKSPACE_CARD_STYLE = {
  '--accent': '#3b82f6',
  '--accent-rgb': '59,130,246',
  background: 'linear-gradient(180deg, rgba(24,31,40,0.8) 0%, rgba(16,21,28,0.76) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
} as React.CSSProperties;

let issueCounter = 0;

function getNextId(existing: IssueRecord[]): string {
  if (issueCounter === 0 && existing.length > 0) {
    const nums = existing.map((r) => {
      const match = r.id.match(/ISS-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    issueCounter = Math.max(...nums, 0);
  }
  issueCounter += 1;
  return `ISS-${String(issueCounter).padStart(3, '0')}`;
}

function createEmptyRecord(existing: IssueRecord[] = [], projectId = '', projectName = '', productName = ''): IssueRecord {
  const now = new Date().toISOString();
  return {
    id: getNextId(existing),
    projectId,
    projectName,
    productName,
    types: [],
    date: new Date().toISOString().split('T')[0] || '',
    process: '',
    quantity: '',
    technician: '',
    machine: '',
    cavity: '',
    modules: {
      evidence: { text: '', images: [] },
      description: { text: '', images: [] },
      rootCause: { text: '', images: [] },
      solution: { text: '', images: [] },
      verification: { text: '', images: [] },
    },
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

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
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);

      let lo = 0.1;
      let hi = 0.92;
      let mid = 0.7;

      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            if (blob.size <= maxSizeKB * 1024 || hi - lo < 0.05) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              return;
            }

            hi = mid;
            mid = (lo + hi) / 2;
            tryCompress();
          },
          'image/jpeg',
          mid,
        );
      };

      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败，无法压缩上传'));
    };

    img.src = url;
  });
}

function normalizeText(value?: string) {
  return (value || '').trim().toLowerCase();
}

function belongsToScope(record: IssueRecord, projectName: string, projectIds: Set<string>) {
  if (projectIds.size > 0 && projectIds.has(record.projectId || '')) return true;
  if (projectName && normalizeText(record.projectName) === projectName) return true;
  if (!projectName && projectIds.size === 0) return true;
  return false;
}

function TypeTagSelector({ selected, onChange }: { selected: IssueTypeId[]; onChange: (v: IssueTypeId[]) => void }) {
  const toggle = (typeId: IssueTypeId) =>
    onChange(selected.includes(typeId) ? selected.filter((item) => item !== typeId) : [...selected, typeId]);

  return (
    <div className="flex flex-wrap gap-2">
      {ISSUE_TYPE_OPTIONS.map((option) => {
        const active = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => toggle(option.id)}
            className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              active
                ? 'border-[#3b82f6]/50 bg-[#3b82f6]/20 text-[#60a5fa] shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                : 'border-white/[0.08] bg-white/[0.04] text-[#8B949E] hover:border-white/[0.15] hover:bg-white/[0.06]'
            }`}
          >
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
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {PROCESS_STEP_OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`cursor-pointer rounded-lg border px-4 py-3 text-sm font-semibold transition-all duration-200 ${
              active
                ? 'border-[#3b82f6]/40 bg-[#3b82f6]/15 text-[#60a5fa] shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                : 'border-white/[0.08] bg-white/[0.04] text-[#8B949E] hover:bg-white/[0.06]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.max(120, ref.current.scrollHeight)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-h-[120px] w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-[#E6EDF3] placeholder:text-[#6E7681] transition-all focus:border-[#3b82f6]/40 focus:outline-none focus:shadow-[0_0_0_2px_rgba(59,130,246,0.1)]"
    />
  );
}

function LightBox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-8" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 transition-all hover:bg-white/20"
      >
        <X className="h-5 w-5 text-white" />
      </button>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
    </div>
  );
}

function ImageUploadZone({
  images,
  maxImages,
  onAdd,
  onRemove,
}: {
  images: ImageItem[];
  maxImages: number;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<ImageItem | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = maxImages - images.length;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
      if (files.length > 0) onAdd(files);
    },
    [onAdd],
  );

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) onAdd(files);
      e.target.value = '';
    },
    [onAdd],
  );

  return (
    <>
      {lightboxImg && <LightBox src={lightboxImg.preview} alt={lightboxImg.name} onClose={() => setLightboxImg(null)} />}
      <div className="space-y-3">
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-video cursor-pointer overflow-hidden rounded-lg border border-white/[0.08] bg-black/30"
                onClick={() => setLightboxImg(img)}
              >
                <img src={img.preview} alt={img.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingRemoveId(img.id);
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/70 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
                {img.compressed && (
                  <span className="absolute bottom-1 left-1 rounded bg-emerald-500/80 px-1.5 py-0.5 text-[9px] text-white">已压缩</span>
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/70">
                  {(img.size / 1024).toFixed(0)}KB
                </span>
              </div>
            ))}
          </div>
        )}

        {remaining > 0 && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all ${
              dragOver ? 'border-[#3b82f6]/50 bg-[#3b82f6]/5' : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.04]'
            }`}
          >
            <Upload className="mx-auto mb-2 h-6 w-6 text-[#6E7681]" />
            <p className="text-xs text-[#6E7681]">拖拽图片到此处或点击上传</p>
            <p className="mt-1 text-[10px] text-[#6E7681]/60">还可上传 {remaining} 张，超过 500KB 自动压缩</p>
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

function ClosedLoopModule({
  issueId,
  config,
  data,
  onChange,
}: {
  issueId: string;
  config: (typeof MODULE_CONFIG)[number];
  data: ModuleData;
  onChange: (d: ModuleData) => void;
}) {
  const Icon = config.icon;

  const handleAddImages = useCallback(
    async (files: File[]) => {
      const remaining = config.maxImages - data.images.length;
      const toProcess = files.slice(0, remaining);

      for (const file of toProcess) {
        const compressed = await compressImage(file);
        const result = await uploadImage(issueId, config.key, compressed);
        const preview = result ? result.publicUrl : URL.createObjectURL(compressed);
        const newImg: ImageItem = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          file: compressed,
          preview,
          name: file.name,
          size: compressed.size,
          compressed: compressed.size < file.size,
        };

        onChange({ ...data, images: [...data.images, newImg] });

        if (compressed.size < file.size) {
          toast.success(`${file.name} 已压缩 ${(file.size / 1024).toFixed(0)}KB -> ${(compressed.size / 1024).toFixed(0)}KB`);
        }
      }
    },
    [config.key, config.maxImages, data, issueId, onChange],
  );

  const handleRemoveImage = useCallback(
    async (id: string) => {
      const img = data.images.find((item) => item.id === id);
      if (img?.preview.startsWith('blob:')) {
        URL.revokeObjectURL(img.preview);
      } else if (img?.preview) {
        await deleteImage(img.preview);
      }
      onChange({ ...data, images: data.images.filter((item) => item.id !== id) });
    },
    [data, onChange],
  );

  return (
    <div
      className="project-card theme-info overflow-hidden rounded-lg border border-white/[0.06] !transform-none [&::after]:!hidden [&::before]:!hidden"
      style={WORKSPACE_CARD_STYLE}
    >
      <div className="pc-section px-6 py-5">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}
          >
            {config.num}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[#60a5fa]" />
              <h4 className="text-base font-bold text-[#E6EDF3]">{config.label}</h4>
            </div>
            <p className="mt-0.5 text-xs text-[#6E7681]">{config.desc}</p>
          </div>
          <span className="text-xs text-[#6E7681]">
            {data.images.length}/{config.maxImages} 图
          </span>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6E7681]">描述内容</label>
          <AutoTextarea value={data.text} onChange={(text) => onChange({ ...data, text })} placeholder={`请输入${config.label}内容...`} />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6E7681]">
            <ImageIcon className="mr-1 inline h-3 w-3" />
            图片附件（最多 {config.maxImages} 张）
          </label>
          <ImageUploadZone images={data.images} maxImages={config.maxImages} onAdd={handleAddImages} onRemove={handleRemoveImage} />
        </div>
      </div>
    </div>
  );
}

function IssueListItem({
  record,
  isActive,
  onClick,
}: {
  record: IssueRecord;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusMap = {
    draft: { label: '草稿', cls: 'border-[#FACC15]/40 text-[#FACC15] bg-[#FACC15]/10' },
    submitted: { label: '已提交', cls: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' },
  } as const;
  const status = statusMap[record.status];
  const typeLabel = getIssueTypeLabels(record.types).join(' · ') || '未分类';
  const processLabel = record.process ? getIssueProcessStepLabel(record.process) : '—';

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer border-b border-white/[0.04] border-l-2 px-4 py-3.5 transition-all duration-200 ${
        isActive ? 'border-l-[#3b82f6] bg-[#3b82f6]/8' : 'border-l-transparent hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="pl-5 text-[15px] font-bold tracking-wide text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}
          >
            {record.projectId || '—'}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
            <FileText className="h-3 w-3 shrink-0 text-slate-500 opacity-70" />
            <span className="bg-clip-text font-bold text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}>
              {record.id}
            </span>
            <span className="text-slate-600">·</span>
            <span className="bg-clip-text font-bold text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}>
              {typeLabel}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
            <Clock className="h-3 w-3 shrink-0 text-slate-500 opacity-70" />
            <span className="bg-clip-text font-bold text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}>
              {record.date}
            </span>
            <span className="text-slate-700">·</span>
            <span className="bg-clip-text font-bold text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}>
              {processLabel}
            </span>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
      </div>
    </div>
  );
}

function IssueForm({
  record,
  onUpdate,
  onDelete,
  onSubmit,
}: {
  record: IssueRecord;
  onUpdate: (r: IssueRecord) => void;
  onDelete: (id: string) => void;
  onSubmit: (id: string) => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const update = (partial: Partial<IssueRecord>) => onUpdate({ ...record, ...partial });
  const updateModule = (key: keyof IssueRecord['modules'], data: ModuleData) =>
    onUpdate({ ...record, modules: { ...record.modules, [key]: data } });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#E6EDF3]">{record.id}</h2>
          <p className="mt-0.5 text-xs text-[#6E7681]">
            创建于 {new Date(record.createdAt).toLocaleString('zh-CN')}
            {record.status === 'draft' ? ' · 草稿自动保存中' : ''}
          </p>
        </div>
      </div>

      <div
        className="project-card theme-info overflow-hidden rounded-lg border border-white/[0.06] !transform-none [&::after]:!hidden [&::before]:!hidden"
        style={WORKSPACE_CARD_STYLE}
      >
        <div className="pc-header border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="pc-accent-bar h-5 w-1 rounded-full" />
            <h3 className="text-lg font-bold text-[#E6EDF3]">基本信息</h3>
          </div>
        </div>
        <div className="pc-section space-y-5 px-6 py-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6E7681]">问题类型（多选）</label>
            <TypeTagSelector selected={record.types} onChange={(types) => update({ types })} />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6E7681]">
              <CalendarIcon className="mr-1 inline h-3 w-3" />
              发生时间
            </label>
            <input
              type="date"
              value={record.date}
              onChange={(e) => update({ date: e.target.value })}
              className="h-10 cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#E6EDF3] transition-all focus:border-[#3b82f6]/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6E7681]">发现环节（单选）</label>
            <ProcessSelector value={record.process} onChange={(process) => update({ process })} />
          </div>

          <div className="grid grid-cols-1 gap-3 pt-1 lg:grid-cols-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6E7681]">模具编号</label>
              <input
                type="text"
                value={record.projectId || ''}
                onChange={(e) => update({ projectId: e.target.value })}
                placeholder="如：LA25463"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#E6EDF3] placeholder:text-[#6E7681] transition-all focus:border-[#3b82f6]/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6E7681]">关联数量</label>
              <input
                type="text"
                value={record.quantity || ''}
                onChange={(e) => update({ quantity: e.target.value })}
                placeholder="如：5pcs"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#E6EDF3] placeholder:text-[#6E7681] transition-all focus:border-[#3b82f6]/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6E7681]">技术员</label>
              <input
                type="text"
                value={record.technician || ''}
                onChange={(e) => update({ technician: e.target.value })}
                placeholder="姓名"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#E6EDF3] placeholder:text-[#6E7681] transition-all focus:border-[#3b82f6]/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6E7681]">机台</label>
              <input
                type="text"
                value={record.machine || ''}
                onChange={(e) => update({ machine: e.target.value })}
                placeholder="机台编号"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#E6EDF3] placeholder:text-[#6E7681] transition-all focus:border-[#3b82f6]/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6E7681]">模具穴号</label>
              <input
                type="text"
                value={record.cavity || ''}
                onChange={(e) => update({ cavity: e.target.value })}
                placeholder="如：#3"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[#E6EDF3] placeholder:text-[#6E7681] transition-all focus:border-[#3b82f6]/40 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="h-5 w-1 rounded-full bg-[#3b82f6]" style={{ boxShadow: '0 0 8px rgba(59,130,246,0.5)' }} />
          <h3 className="text-lg font-bold text-[#E6EDF3]">闭环五大模块</h3>
          <span className="ml-2 text-xs text-[#6E7681]">按工序严格填写</span>
        </div>
        {MODULE_CONFIG.map((config) => (
          <ClosedLoopModule
            key={config.key}
            issueId={record.id}
            config={config}
            data={record.modules[config.key]}
            onChange={(data) => updateModule(config.key, data)}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          className="cursor-pointer border-[#FF3B3B]/20 text-[#FF3B3B] hover:bg-[#FF3B3B]/10 active:scale-[0.97]"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          删除
        </Button>
        {record.status === 'draft' && (
          <Button
            size="sm"
            onClick={() => onSubmit(record.id)}
            className="cursor-pointer border border-[#00FFA3]/30 bg-[#00FFA3]/15 text-[#00FFA3] hover:bg-[#00FFA3]/25 active:scale-[0.97]"
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            提交
          </Button>
        )}
      </div>

      <CyberConfirmDialog
        open={showDeleteConfirm}
        title="删除确认"
        message={`确定要删除记录 ${record.id} 吗？删除后所有数据和图片将无法恢复。`}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete(record.id);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="确认删除"
        cancelText="取消"
      />

    </div>
  );
}

interface FmeaIssueWorkspaceProps {
  projectName?: string;
  projectIds?: string[];
  defaultProductName?: string;
}

export default function FmeaIssueWorkspace({
  projectName = '',
  projectIds = [],
  defaultProductName = '',
}: FmeaIssueWorkspaceProps) {
  const [records, setRecords] = useState<IssueRecord[]>([]);
  const [seedRecords, setSeedRecords] = useState<IssueRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const normalizedProjectName = useMemo(() => normalizeText(projectName), [projectName]);
  const projectIdSet = useMemo(() => new Set(projectIds.filter(Boolean)), [projectIds]);

  const activeRecord = records.find((record) => record.id === activeId) || null;

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const query = searchQuery.toLowerCase();
    return records.filter((record) => {
      return (
        record.id.toLowerCase().includes(query) ||
        record.projectId.toLowerCase().includes(query) ||
        record.types.some((type) => matchesIssueTypeQuery(type, query)) ||
        matchesIssueProcessStepQuery(record.process, query)
      );
    });
  }, [records, searchQuery]);

  const loadScopedIssues = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchIssues();
      setSeedRecords(all);
      const scoped = all.filter((record) => belongsToScope(record, normalizedProjectName, projectIdSet));
      setRecords(scoped);
      setActiveId((current) => (current && scoped.some((record) => record.id === current) ? current : scoped[0]?.id || null));
    } finally {
      setLoading(false);
    }
  }, [normalizedProjectName, projectIdSet]);

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

  useEffect(() => {
    loadScopedIssues();
  }, [loadScopedIssues]);

  /*
  const initialRef = useRef(true);
  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    let cancelled = false;
    saveTimer.current = setTimeout(() => {
      return void (async () => {
        const results = await Promise.all(records.map((record) => persistIssueQuietly(record)));
        if (!cancelled && results.some((saved) => !saved)) {
          toast.error('自动保存失败，请稍后重试');
        }
        clearQueuedIssueSave(id);
        toast.success('问题已提交');
      })();
    }, 1500);

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [persistIssueQuietly, records]);
  */

  const handleCreate = useCallback(async () => {
    const nextProjectId = projectIds.length === 1 ? projectIds[0] || '' : '';
    const next = createEmptyRecord(seedRecords, nextProjectId, projectName, defaultProductName);
    setSeedRecords((prev) => [next, ...prev]);
    setRecords((prev) => [next, ...prev]);
    setActiveId(next.id);
    const created = await createIssue(next);
    if (!created) {
      setSeedRecords((prev) => prev.filter((record) => record.id !== next.id));
      setRecords((prev) => prev.filter((record) => record.id !== next.id));
      setActiveId((current) => (current === next.id ? null : current));
      toast.error('问题创建失败，请检查服务连接');
      return;
    }
    toast.success('新问题已创建');
  }, [defaultProductName, projectIds, projectName, seedRecords]);

  const handleUpdate = useCallback((updated: IssueRecord) => {
    const withTime = { ...updated, updatedAt: new Date().toISOString() };
    queueIssueSave(withTime);
    setRecords((prev) => prev.map((record) => (record.id === updated.id ? withTime : record)));
    setSeedRecords((prev) => prev.map((record) => (record.id === updated.id ? withTime : record)));
  }, [queueIssueSave]);

  const handleDelete = useCallback(
    async (id: string) => {
      const target = records.find((record) => record.id === id) || seedRecords.find((record) => record.id === id);
      if (target) {
        const deleted = await deleteIssue(id, target.modules);
        if (!deleted) {
          toast.error('记录删除失败，请稍后重试');
          return;
        }
      }
      clearQueuedIssueSave(id);
      setRecords((prev) => prev.filter((record) => record.id !== id));
      setSeedRecords((prev) => prev.filter((record) => record.id !== id));
      if (activeId === id) setActiveId(null);
      toast.success('记录已删除');
    },
    [activeId, clearQueuedIssueSave, records, seedRecords],
  );

  const handleSubmit = useCallback(
    (id: string) => {
      const updated = records.find((record) => record.id === id);
      if (!updated) return;
      const submitted = { ...updated, status: 'submitted' as const, updatedAt: new Date().toISOString() };
      setRecords((prev) => prev.map((record) => (record.id === id ? submitted : record)));
      setSeedRecords((prev) => prev.map((record) => (record.id === id ? submitted : record)));
      return void (async () => {
        const saved = await persistIssueQuietly(submitted);
        if (!saved) {
          queueIssueSave(updated);
          setRecords((prev) => prev.map((record) => (record.id === id ? updated : record)));
          setSeedRecords((prev) => prev.map((record) => (record.id === id ? updated : record)));
          toast.error('问题提交失败，请稍后重试');
          return;
        }
        clearQueuedIssueSave(id);
        toast.success('问题已提交');
      })();
      toast.success('问题已提交');
    },
    [clearQueuedIssueSave, persistIssueQuietly, queueIssueSave, records],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06]" style={WORKSPACE_SHELL_STYLE}>
      <div className="flex min-h-[820px]">
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-white/[0.06]" style={WORKSPACE_SIDEBAR_STYLE}>
          <div className="space-y-2 border-b border-white/[0.06] p-3">
            <Button
              onClick={handleCreate}
              className="h-10 w-full cursor-pointer bg-[#3b82f6] text-sm font-semibold text-white transition-all hover:bg-[#2563eb] active:scale-[0.97]"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              新建问题
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6E7681]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索问题编号、类型..."
                className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-9 pr-3 text-xs text-[#E6EDF3] placeholder:text-[#6E7681] transition-all focus:border-[#3b82f6]/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <div>
                  <Activity className="mx-auto mb-2 h-8 w-8 text-[#6E7681]/30" />
                  <p className="text-xs text-[#6E7681]">正在加载 FMEA 问题库...</p>
                </div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-[#6E7681]/30" />
                <p className="text-xs text-[#6E7681]">暂无问题记录</p>
                <p className="mt-1 text-[10px] text-[#6E7681]/60">点击上方按钮新建</p>
              </div>
            ) : (
              filteredRecords.map((record) => (
                <IssueListItem key={record.id} record={record} isActive={activeId === record.id} onClick={() => setActiveId(record.id)} />
              ))
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto" style={WORKSPACE_MAIN_STYLE}>
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.04]">
                  <Activity className="h-8 w-8 text-[#6E7681]/30" />
                </div>
                <p className="text-sm text-[#6E7681]">正在同步问题数据</p>
              </div>
            </div>
          ) : !activeRecord ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.04]">
                  <Activity className="h-8 w-8 text-[#6E7681]/30" />
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
                setRecords((prev) => prev.map((record) => (record.id === activeRecord.id ? edited : record)));
                setSeedRecords((prev) => prev.map((record) => (record.id === activeRecord.id ? edited : record)));
                return void (async () => {
                  const saved = await persistIssueQuietly(edited);
                  if (!saved) {
                    setRecords((prev) => prev.map((record) => (record.id === activeRecord.id ? activeRecord : record)));
                    setSeedRecords((prev) => prev.map((record) => (record.id === activeRecord.id ? activeRecord : record)));
                    toast.error('切换草稿失败');
                    return;
                  }
                  clearQueuedIssueSave(edited.id);
                  toast.success('已切换为草稿');
                })();
                toast.success('已切换为编辑模式');
              }}
              onDelete={() => handleDelete(activeRecord.id)}
            />
          ) : (
            <IssueForm record={activeRecord} onUpdate={handleUpdate} onDelete={handleDelete} onSubmit={handleSubmit} />
          )}
        </main>
      </div>
    </div>
  );
}
