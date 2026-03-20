/**
 * GanttV3Milestones — Cyberpunk Kanban Header
 *
 * 顶部栏：项目身份、里程碑图例、导入。菱形+导向线由 MilestoneMarker 在 Chart 内统一渲染。
 * 坐标唯一源：MilestoneMarker.dateToPixel
 * 视觉风格：oklch 赛博朋克 + scanline + glitch + neon-pulse
 */

import { useState, useRef, useCallback } from 'react';
import { Upload, ArrowLeft, Trash2, Activity, Cpu, Zap } from 'lucide-react';
import type { MilestoneView, GanttData } from '@shared/ganttEngine';
import { formatDateCn } from '@shared/workdays';
import GanttV3ImportModal from './GanttV3ImportModal';

/** 统一坐标源：从 MilestoneMarker 再导出，供 Chart 与里程碑栏共用 */
export { dateToPixel } from './MilestoneMarker';

interface MilestoneHeaderProps {
  milestones: MilestoneView[];
  moldNumber: string;
  projectId?: string;
  projectName?: string;
  productName?: string;
  indexNo?: string;
  fitterGroup?: string;
  onImportSuccess?: (data: GanttData) => void;
  onClearData?: () => void;
  taskCount?: number;
  trackCount?: number;
  isMobile?: boolean;
  boundProjectId?: string;
}

export default function GanttV3Milestones({
  milestones,
  moldNumber,
  projectId,
  projectName,
  productName,
  indexNo,
  fitterGroup,
  onImportSuccess,
  onClearData,
  taskCount,
  trackCount,
  isMobile,
  boundProjectId,
}: MilestoneHeaderProps) {
  const [importOpen, setImportOpen] = useState(false);

  // ── Mobile layout ──
  if (isMobile) {
    return (
      <div className="shrink-0 py-2.5 px-4 bg-[#0A0A0A] border-b border-white/[0.06] flex items-center justify-between gap-3 sticky top-0 z-30">
        <a href="/" className="flex items-center gap-1.5 text-amber-400/80 hover:text-amber-400 transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[12px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>返回</span>
        </a>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] font-bold text-white truncate">{moldNumber}</span>
          {projectName && <span className="text-[12px] text-white/40 truncate hidden min-[400px]:inline">{projectName}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4A90E2] animate-pulse" />
          <span className="text-[10px] font-bold text-[#4A90E2]/70" style={{ fontFamily: 'var(--font-mono)' }}>
            {formatDateCn(new Date())}
          </span>
        </div>
      </div>
    );
  }

  // ── Desktop layout — Cyberpunk Kanban Header ──
  return (
    <>
      <div className="w-full select-none" style={{ background: 'oklch(0.08 0.01 240)' }}>

        {/* ═══ TOP ROW: Project Identity + System Status + Action Buttons ═══ */}
        <div className="relative overflow-hidden" style={{ borderBottom: '1px solid oklch(0.22 0.04 220)' }}>
          {/* Scanline overlay */}
          <div className="pointer-events-none absolute inset-0 z-0"
            style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0.82 0.18 195 / 0.018) 2px, oklch(0.82 0.18 195 / 0.018) 4px)' }} />
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, oklch(0.82 0.18 195 / 0.6) 30%, oklch(0.65 0.22 28 / 0.4) 70%, transparent)' }} />

          <div className="relative z-10 flex items-center justify-between px-4 h-10 gap-4">
            {/* Left: Project identity */}
            <div className="flex items-center gap-0 shrink-0">
              {/* Project ID chip */}
              <div className="relative flex items-center gap-2 pr-3" style={{ borderRight: '1px solid oklch(0.25 0.04 220)' }}>
                <div className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'oklch(0.72 0.2 145)', boxShadow: '0 0 6px oklch(0.72 0.2 145 / 0.9)', animation: 'neonPulse 2s ease-in-out infinite' }} />
                <span className="text-[13px] font-mono font-bold tracking-[0.2em] uppercase"
                  style={{ color: 'oklch(0.88 0.15 195)', textShadow: '0 0 10px oklch(0.82 0.18 195 / 0.6)' }}>
                  {moldNumber}
                </span>
              </div>
              {/* Project name */}
              {projectName && (
                <div className="flex items-center gap-1 px-3" style={{ borderRight: '1px solid oklch(0.25 0.04 220)' }}>
                  <span className="text-[10px] font-mono tracking-[0.15em]" style={{ color: 'oklch(0.5 0.04 195)' }}>FONT</span>
                  <span className="text-[11px] font-mono font-semibold tracking-wide ml-1" style={{ color: 'oklch(0.72 0.1 195)' }}>{projectName}</span>
                </div>
              )}
              {/* Product name */}
              {productName && (
                <div className="flex items-center gap-1 px-3">
                  <span className="text-[10px] font-mono tracking-[0.1em]" style={{ color: 'oklch(0.5 0.04 195)' }}>PROJECT</span>
                  <span className="text-[11px] font-mono font-medium tracking-wide ml-1" style={{ color: 'oklch(0.65 0.08 195)' }}>{productName}</span>
                </div>
              )}
            </div>

            {/* Center: System status indicators */}
            <div className="hidden md:flex items-center gap-4 flex-1 justify-center">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3 h-3" style={{ color: 'oklch(0.45 0.04 195)' }} />
                <span className="text-[9px] font-mono tracking-widest" style={{ color: 'oklch(0.35 0.04 195)' }}>SYS.ONLINE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3" style={{ color: 'oklch(0.72 0.2 145)' }} />
                <span className="text-[9px] font-mono tracking-widest" style={{ color: 'oklch(0.5 0.06 145)' }}>MONITORING</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3" style={{ color: 'oklch(0.65 0.22 28)' }} />
                <span className="text-[9px] font-mono tracking-widest" style={{ color: 'oklch(0.45 0.06 28)' }}>REALTIME</span>
              </div>
              <span className="text-[9px] font-mono tracking-widest tabular-nums" style={{ color: 'oklch(0.4 0.04 195)' }}>
                {formatDateCn(new Date())}
              </span>
            </div>

          </div>
        </div>

        {/* ═══ BOTTOM ROW: Action Buttons + Legend ═══ */}
        <div className="relative overflow-hidden">
          {/* Scanline overlay */}
          <div className="pointer-events-none absolute inset-0 z-0"
            style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0.82 0.18 195 / 0.018) 2px, oklch(0.82 0.18 195 / 0.018) 4px)' }} />

          <div className="relative z-10 flex items-center justify-between px-4 py-1.5 gap-3">
            <div className="flex items-center gap-2.5">
              {/* Action buttons — bigger sci-fi style */}
              <button onClick={() => setImportOpen(true)} title="导入项目计划"
                className="relative flex items-center gap-2.5 px-5 py-2.5 text-[15px] font-mono font-semibold tracking-widest uppercase cursor-pointer rounded-sm transition-all duration-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                style={{ border: '1px solid oklch(0.82 0.18 195 / 0.4)', color: 'oklch(0.82 0.18 195)', background: 'oklch(0.82 0.18 195 / 0.04)' }}>
                <svg className="absolute top-0 left-0 w-3.5 h-3.5 pointer-events-none" viewBox="0 0 12 12" fill="none"><path d="M0 0 H8 M0 0 V8" stroke="oklch(0.82 0.18 195)" strokeWidth="1.5" /></svg>
                <svg className="absolute bottom-0 right-0 w-3.5 h-3.5 pointer-events-none rotate-180" viewBox="0 0 12 12" fill="none"><path d="M0 0 H8 M0 0 V8" stroke="oklch(0.82 0.18 195)" strokeWidth="1.5" /></svg>
                <Upload className="w-5 h-5 shrink-0" /><span>导入</span>
              </button>
              <a href="/" title="返回项目看板"
                className="relative flex items-center gap-2.5 px-5 py-2.5 text-[15px] font-mono font-semibold tracking-widest uppercase rounded-sm transition-all duration-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                style={{ border: '1px solid oklch(0.82 0.18 195 / 0.4)', color: 'oklch(0.82 0.18 195)', background: 'oklch(0.82 0.18 195 / 0.04)' }}>
                <svg className="absolute top-0 left-0 w-3.5 h-3.5 pointer-events-none" viewBox="0 0 12 12" fill="none"><path d="M0 0 H8 M0 0 V8" stroke="oklch(0.82 0.18 195)" strokeWidth="1.5" /></svg>
                <svg className="absolute bottom-0 right-0 w-3.5 h-3.5 pointer-events-none rotate-180" viewBox="0 0 12 12" fill="none"><path d="M0 0 H8 M0 0 V8" stroke="oklch(0.82 0.18 195)" strokeWidth="1.5" /></svg>
                <ArrowLeft className="w-5 h-5 shrink-0" /><span>返回</span>
              </a>
              <button onClick={onClearData} title="清除数据"
                className="relative flex items-center gap-2.5 px-5 py-2.5 text-[15px] font-mono font-semibold tracking-widest uppercase cursor-pointer rounded-sm transition-all duration-300 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                style={{ border: '1px solid oklch(0.55 0.22 15 / 0.4)', color: 'oklch(0.65 0.22 15)', background: 'oklch(0.55 0.22 15 / 0.04)' }}>
                <svg className="absolute top-0 left-0 w-3.5 h-3.5 pointer-events-none" viewBox="0 0 12 12" fill="none"><path d="M0 0 H8 M0 0 V8" stroke="oklch(0.55 0.22 15)" strokeWidth="1.5" /></svg>
                <svg className="absolute bottom-0 right-0 w-3.5 h-3.5 pointer-events-none rotate-180" viewBox="0 0 12 12" fill="none"><path d="M0 0 H8 M0 0 V8" stroke="oklch(0.55 0.22 15)" strokeWidth="1.5" /></svg>
                <Trash2 className="w-5 h-5 shrink-0" /><span>清除</span>
              </button>
            </div>

            {/* Divider + Legend */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-px h-10" style={{ background: 'linear-gradient(to bottom, transparent, oklch(0.3 0.04 220), transparent)' }} />
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-mono tracking-widest uppercase" style={{ color: 'oklch(0.4 0.04 220)' }}>图例</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 rounded-full shrink-0" style={{ height: 8, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.10)' }} />
                  <span className="text-[12px] font-mono tracking-widest" style={{ color: 'oklch(0.45 0.04 195)' }}>计划</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-1 rounded-full" style={{ background: 'oklch(0.82 0.18 195)', boxShadow: '0 0 6px oklch(0.82 0.18 195)' }} />
                  <span className="text-[12px] font-mono tracking-widest" style={{ color: 'oklch(0.82 0.18 195)' }}>实际</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-1 rounded-full" style={{ background: 'oklch(0.65 0.22 28)', boxShadow: '0 0 6px oklch(0.65 0.22 28)' }} />
                  <span className="text-[12px] font-mono tracking-widest" style={{ color: 'oklch(0.65 0.22 28)' }}>延期</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, oklch(0.82 0.18 195 / 0.4), transparent 60%)' }} />
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes neonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
      `}</style>

      {/* Import Modal */}
      <GanttV3ImportModal open={importOpen} onOpenChange={setImportOpen} onImportSuccess={onImportSuccess} currentProjectId={boundProjectId || projectId || moldNumber} />
    </>
  );
}
