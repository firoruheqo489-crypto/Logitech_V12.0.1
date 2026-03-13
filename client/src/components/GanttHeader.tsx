/**
 * GanttHeader V3.1 — Dark Mode Precision Dashboard
 * Lighthouse milestones with vertical projection
 */

import { type Milestone, type ProjectInfo } from '@/lib/data';
import { Diamond, Settings, Bell } from 'lucide-react';

const PRODUCT_IMAGE = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663350426711/NLTCAxvqqOfiADva.png';

interface GanttHeaderProps {
  projectInfo: ProjectInfo;
  milestones: Milestone[];
}

export default function GanttHeader({ projectInfo, milestones }: GanttHeaderProps) {
  return (
    <div className="border-b border-white/[0.08] sticky top-0 z-50 bg-[#1A1A1A]">
      <div className="flex items-center gap-5 px-5 h-[73px]">
        {/* Product Image */}
        <div className="shrink-0 w-[48px] h-[48px] rounded-xl overflow-hidden bg-gradient-to-br from-white/5 to-white/[0.02] shadow-lg border border-white/[0.08] p-1">
          <img 
            src={PRODUCT_IMAGE} 
            alt={projectInfo.productName}
            className="w-full h-full object-contain rounded-lg"
          />
        </div>

        {/* Project Info */}
        <div className="flex flex-col gap-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[17px] font-extrabold tracking-tight text-white/90" style={{ fontFamily: 'var(--font-display)' }}>
              {projectInfo.moldNumber}
            </h1>
            <div className="flex items-center gap-1">
              <PhaseTag label="PHYSICAL" color="#4A90E2" active />
              <PhaseTag label="DATA" color="#A29BFE" />
              <PhaseTag label="PRODUCTION" color="#00B894" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] text-white/50" style={{ fontFamily: 'var(--font-body)' }}>
              {projectInfo.brand}
            </span>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[12px] text-white/50" style={{ fontFamily: 'var(--font-body)' }}>
              {projectInfo.productName}
            </span>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[11px] text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>
              {projectInfo.startDate} → {projectInfo.endDate}
            </span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Lighthouse Milestones */}
        <div className="flex items-center gap-2">
          {milestones.map((ms, i) => (
            <div key={ms.id} className="flex items-center">
              <LighthouseMilestone milestone={ms} />
              {i < milestones.length - 1 && (
                <div className="w-4 h-px mx-1" style={{ background: 'linear-gradient(90deg, rgba(218,165,32,0.2), rgba(218,165,32,0.05))' }} />
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-2">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.05] transition-colors text-white/30 hover:text-white/60">
            <Bell className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.05] transition-colors text-white/30 hover:text-white/60">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Phase Tag ───────────────────────────────────────────────────────────────

function PhaseTag({ label, color, active }: { label: string; color: string; active?: boolean }) {
  return (
    <div
      className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-[0.08em] transition-all"
      style={{
        fontFamily: 'var(--font-mono)',
        backgroundColor: active ? `${color}20` : 'transparent',
        color: active ? color : 'rgba(255,255,255,0.25)',
        border: `1px solid ${active ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {label}
    </div>
  );
}

// ─── Lighthouse Milestone ────────────────────────────────────────────────────

function LighthouseMilestone({ milestone }: { milestone: Milestone }) {
  const icons = {
    T0_trial: Diamond,
    T0_closure: Diamond,
    trial_to_mass: Diamond,
    SOP: Diamond,
  };

  const Icon = icons[milestone.type as keyof typeof icons] || Diamond;

  return (
    <div className="group relative">
      {/* Lighthouse beacon */}
      <div className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-b from-[#DAA520]/10 to-transparent border border-[#DAA520]/20 hover:border-[#DAA520]/40 transition-all cursor-pointer">
        {/* Icon */}
        <div className="w-5 h-5 rounded-full bg-[#DAA520]/20 flex items-center justify-center animate-milestone-glow">
          <Icon className="w-3 h-3 text-[#DAA520]" />
        </div>

        {/* Label */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-bold text-[#DAA520] uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
            {milestone.nameCn}
          </span>
          <span className="text-[7px] text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>
            {milestone.date.slice(5).replace('-', '/')}
          </span>
        </div>

        {/* Status indicator */}
        <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
          milestone.status === 'active' ? 'bg-green-400' :
          'bg-gray-500'
        }`} />
      </div>

      {/* Hover tooltip */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        <div className="px-3 py-2 rounded-lg bg-[#2A2A2A] border border-white/[0.15] shadow-2xl whitespace-nowrap">
          <div className="text-[10px] font-bold text-white/90 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            {milestone.nameCn}
          </div>
          <div className="text-[8px] text-white/60" style={{ fontFamily: 'var(--font-body)' }}>
            {milestone.description}
          </div>
        </div>
      </div>
    </div>
  );
}
