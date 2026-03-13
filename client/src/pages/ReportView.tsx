/**
 * ReportView - 赛博朋克诊断报告（统一整体布局）
 * 单张 project-card 包裹全部内容 | 内部分区用细线分隔
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Layers, Tag, ChevronRight, X,
  Download, Pencil, Trash2, Eye, MessageSquare,
  Lightbulb, Wrench, CheckCircle2, Shield,
  Boxes, User, Monitor, Grid3X3, ScanLine,
} from 'lucide-react';
import { generateDiagnosticPDF } from './generateDiagnosticPDF';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';

interface ImageItem { id: string; preview: string; name: string; size: number; compressed: boolean; }
interface ModuleData { text: string; images: ImageItem[]; }
interface IssueRecord {
  id: string; projectId?: string; projectName?: string; productName?: string;
  types: string[]; date: string; process: string;
  quantity?: string; technician?: string; machine?: string; cavity?: string;
  modules: { evidence: ModuleData; description: ModuleData; rootCause: ModuleData; solution: ModuleData; verification: ModuleData; };
  status: 'draft' | 'submitted'; createdAt: string; updatedAt: string;
}

const MODULES = [
  { key: 'evidence' as const,     icon: Eye,          label: '现场证据', en: 'Evidence',        accent: '#00B4FF', rgb: '0,180,255' },
  { key: 'description' as const,  icon: MessageSquare, label: '问题描述', en: 'Description',     accent: '#A855F7', rgb: '168,85,247' },
  { key: 'rootCause' as const,    icon: Lightbulb,    label: '原因分析', en: 'Root Cause',      accent: '#F59E0B', rgb: '245,158,11' },
  { key: 'solution' as const,     icon: Wrench,       label: '处理对策', en: 'Countermeasure',  accent: '#10B981', rgb: '16,185,129' },
  { key: 'verification' as const, icon: CheckCircle2, label: '效果验证', en: 'Verification',    accent: '#06B6D4', rgb: '6,182,212' },
] as const;

/* ── LightBox ── */
function LightBox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-8 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.button onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 bg-white/5 hover:bg-white/10 border border-slate-700 rounded-full flex items-center justify-center transition-colors cursor-pointer"
        whileHover={{ scale: 1.1 }}>
        <X className="w-5 h-5 text-slate-300" />
      </motion.button>
      <motion.img src={src} alt={alt} onClick={e => e.stopPropagation()}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} />
    </motion.div>
  );
}


/* ── Image thumbnails ── */
function ImageGrid({ images, onOpen }: { images: ImageItem[]; onOpen: (s: string, a: string) => void }) {
  if (!images.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2.5 mt-3">
      {images.map(img => (
        <motion.div key={img.id}
          className="relative aspect-video rounded-lg overflow-hidden border border-white/[0.08] cursor-pointer group"
          whileHover={{ scale: 1.02 }} onClick={() => onOpen(img.preview, img.name)}>
          <img src={img.preview} alt={img.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.div>
      ))}
    </div>
  );
}

/* ── Single module section (rendered inside the unified card) ── */
function ModuleSection({ moduleKey, data, onOpen, isLast }: {
  moduleKey: typeof MODULES[number]['key']; data: ModuleData;
  onOpen: (s: string, a: string) => void; isLast?: boolean;
}) {
  const meta = MODULES.find(m => m.key === moduleKey)!;
  const Icon = meta.icon;
  if (!data.text && !data.images.length) return null;

  return (
    <div className={!isLast ? 'border-b border-white/[0.04]' : ''}>
      <div className="px-6 py-5">
        {/* Section label */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ background: meta.accent, boxShadow: `0 0 8px ${meta.accent}60` }} />
          <Icon className="w-4 h-4" style={{ color: meta.accent }} />
          <span className="text-[15px] font-bold uppercase tracking-wider" style={{ color: meta.accent }}>{meta.label}</span>
          <span className="text-[13px] font-medium uppercase tracking-wider ml-1"
            style={{ background: `linear-gradient(90deg, rgba(${meta.rgb},0.45), rgba(${meta.rgb},0.1))`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {meta.en}
          </span>
          {meta.key === 'verification' && (
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: `rgba(${meta.rgb},0.12)`, border: `1px solid rgba(${meta.rgb},0.3)`, color: meta.accent }}>
              VERIFIED
            </span>
          )}
          {data.images.length > 0 && meta.key !== 'verification' && (
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: `rgba(${meta.rgb},0.08)`, color: `rgba(${meta.rgb},0.7)` }}>
              {data.images.length} 图
            </span>
          )}
        </div>
        {/* Text */}
        {data.text && (
          <p className="text-[15px] font-bold text-[#8B949E] leading-relaxed whitespace-pre-wrap pl-[22px]">{data.text}</p>
        )}
        {/* Images */}
        <div className="pl-[22px]">
          <ImageGrid images={data.images} onOpen={onOpen} />
        </div>
      </div>
    </div>
  );
}


/* ── Main Component ── */
interface ReportViewProps {
  record: IssueRecord;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ReportView({ record, onBack, onEdit, onDelete }: ReportViewProps) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const openLightbox = useCallback((src: string, alt: string) => setLightbox({ src, alt }), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  const handleExportPDF = useCallback(async () => {
    const filename = window.prompt('请输入PDF文件名：', `${record.id}-诊断报告`);
    if (!filename) return;
    setExporting(true);
    try { await generateDiagnosticPDF(record, filename); }
    catch (err) { console.error('PDF export failed:', err); }
    finally { setExporting(false); }
  }, [record]);

  // Filter out empty modules
  const activeModules = MODULES.filter(m => {
    const d = record.modules[m.key];
    return d.text || d.images.length > 0;
  });

  return (
    <div className="h-full overflow-y-auto bg-[#0B0F14]">
      <AnimatePresence>
        {lightbox && <LightBox src={lightbox.src} alt={lightbox.alt} onClose={closeLightbox} />}
      </AnimatePresence>

      {/* Top nav */}
      <div className="sticky top-0 z-50 bg-[#0B0F14]/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center">
          <motion.button onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors cursor-pointer"
            whileHover={{ x: -2 }}>
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />返回列表
          </motion.button>
          <span className="text-white/[0.1] mx-3">|</span>
          <span className="text-sm text-[#6E7681] font-mono">{record.id}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* ═══ Single unified project-card ═══ */}
        <motion.div
          className="project-card rounded-xl overflow-hidden"
          style={{ '--accent': '#00B4FF', '--accent-rgb': '0,180,255' } as React.CSSProperties}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}>

          {/* ── Card Header: title + metadata ── */}
          <div className="pc-header px-6 py-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-[#E6EDF3] mb-0.5"
                  style={{ textShadow: '0 0 24px rgba(0,180,255,0.2)' }}>
                  异常诊断报告
                </h1>
                <p className="text-[13px] text-[#6E7681]">Diagnostic Report · {record.id}</p>
              </div>
              <div className="pc-badge text-xs px-3 py-1 rounded-full font-bold" style={{ color: '#00FFA3' }}>
                已提交
              </div>
            </div>
            {/* Project info bar */}
            {record.projectId && (
              <div className="flex items-center gap-3 mb-4 px-1">
                {[
                  { label: '模具号', value: record.projectId },
                  { label: '项目名称', value: record.projectName },
                  { label: '产品名称', value: record.productName },
                ].filter(s => s.value).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="w-px h-4 bg-white/[0.08]" />}
                    <span className="text-[11px] text-[#6E7681] uppercase tracking-wider">{s.label}</span>
                    <span className="text-[13px] font-semibold text-[#C9D1D9]">{s.value}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Metadata row */}
            {/* Row 1: required fields */}
            <div className="grid grid-cols-4 rounded-t-lg overflow-hidden border border-white/[0.06]">
              {[
                { icon: Tag, label: '编号', value: record.id },
                { icon: Layers, label: '问题类型', value: record.types.join(' · ') || '—' },
                { icon: Calendar, label: '发生日期', value: record.date },
                { icon: ScanLine, label: '发现环节', value: record.process || '—' },
              ].map((s, i) => (
                <div key={i} className={`bg-white/[0.02] px-4 py-3 text-center ${i > 0 ? 'border-l border-white/[0.06]' : ''}`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1.5">
                    <s.icon className="w-3.5 h-3.5 text-[#6E7681]" />
                    <span className="text-[11px] text-[#6E7681] uppercase tracking-wider">{s.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#E6EDF3] truncate">{s.value}</p>
                </div>
              ))}
            </div>
            {/* Row 2: optional fields */}
            {(record.quantity || record.technician || record.machine || record.cavity) && (
              <div className="grid grid-cols-4 rounded-b-lg overflow-hidden border border-t-0 border-white/[0.06]">
                {[
                  { icon: Boxes, label: '关联数量', value: record.quantity },
                  { icon: User, label: '技术员', value: record.technician },
                  { icon: Monitor, label: '机台', value: record.machine },
                  { icon: Grid3X3, label: '模具穴号', value: record.cavity },
                ].map((s, i) => (
                  <div key={i} className={`bg-white/[0.015] px-4 py-3 text-center ${i > 0 ? 'border-l border-white/[0.06]' : ''}`}>
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <s.icon className="w-3.5 h-3.5 text-[#6E7681]" />
                      <span className="text-[11px] text-[#6E7681] uppercase tracking-wider">{s.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#E6EDF3] truncate">{s.value || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Module sections ── */}
          {activeModules.map((m, i) => (
            <ModuleSection
              key={m.key}
              moduleKey={m.key}
              data={record.modules[m.key]}
              onOpen={openLightbox}
              isLast={i === activeModules.length - 1}
            />
          ))}

          {/* ── Card Footer ── */}
          <div className="px-6 py-4 bg-white/[0.01] border-t border-white/[0.04]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[#6E7681]">
                <Shield className="w-3 h-3" />
                <span>{record.id} · 数字化质量存证 · {new Date().toLocaleString('zh-CN')}</span>
              </div>
              <div className="flex items-center gap-2">
                <motion.button onClick={handleExportPDF} disabled={exporting}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                  style={{ background: 'rgba(0,180,255,0.1)', border: '1px solid rgba(0,180,255,0.3)', color: '#00B4FF' }}
                  whileHover={{ boxShadow: '0 0 16px rgba(0,180,255,0.25)' }} whileTap={{ scale: 0.97 }}>
                  <Download className="w-4 h-4" />{exporting ? '导出中...' : '导出PDF'}
                </motion.button>
                <motion.button onClick={onEdit}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[#8B949E] text-[13px] font-semibold hover:bg-white/[0.06] transition-all cursor-pointer"
                  whileTap={{ scale: 0.97 }}>
                  <Pencil className="w-4 h-4" />编辑
                </motion.button>
                <motion.button onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer"
                  style={{ background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.25)', color: '#FF3B3B' }}
                  whileHover={{ boxShadow: '0 0 12px rgba(255,59,59,0.2)' }} whileTap={{ scale: 0.97 }}>
                  <Trash2 className="w-3.5 h-3.5" />删除
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="h-8" />
      </div>

      <CyberConfirmDialog
        open={showDeleteConfirm}
        title="删除确认"
        message={`确定要删除记录 ${record.id} 吗？删除后所有数据和图片将无法恢复。`}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => { setShowDeleteConfirm(false); onDelete(); }}
        confirmText="确认删除"
        cancelText="取消"
      />
    </div>
  );
}