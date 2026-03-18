'use client';

import { CheckCircle2, Lock, Wrench } from 'lucide-react';

interface Phase {
  id: number;
  label: string;
  sub: string;
}

const phases: Phase[] = [
  { id: 1, label: 'DFM 评审', sub: 'DESIGN REVIEW' },
  { id: 2, label: '模具加工', sub: 'TOOLING BUILD' },
  { id: 3, label: '试模纠偏', sub: 'TRIAL & DEBUG' },
  { id: 4, label: 'PPAP 提交', sub: 'PPAP SUBMIT' },
  { id: 5, label: '量产移交', sub: 'SOP HANDOFF' },
];

export function SubwayLine({
  activePhase,
  setActivePhase,
}: {
  activePhase: number;
  setActivePhase: (phase: number) => void;
}) {
  return (
    <div className="relative flex items-center justify-between w-full px-4 py-6">
      <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[2px] bg-slate-800 z-0" />
      <div
        className="absolute left-8 top-1/2 -translate-y-1/2 h-[2px] bg-cyan-800/60 z-0 transition-all duration-500"
        style={{
          width: `${((Math.min(activePhase, 5) - 1) / 4) * (100 - 10)}%`,
        }}
      />

      {phases.map((phase) => {
        const isPast = phase.id < activePhase;
        const isActive = phase.id === activePhase;
        const isFuture = phase.id > activePhase;

        return (
          <button
            key={phase.id}
            onClick={() => setActivePhase(phase.id)}
            className="relative z-10 flex flex-col items-center gap-2 group cursor-pointer"
            type="button"
          >
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${
                  isPast
                    ? 'bg-cyan-950/50 border-cyan-700/50 group-hover:border-cyan-500'
                    : isActive
                      ? 'bg-[#030712] border-orange-500 shadow-[0_0_16px_rgba(249,115,22,0.3)] group-hover:shadow-[0_0_24px_rgba(249,115,22,0.4)]'
                      : 'bg-slate-900/50 border-slate-700/40 group-hover:border-slate-600'
                }
              `}
            >
              {isPast && <CheckCircle2 className="w-5 h-5 text-cyan-500" />}
              {isActive && (
                <Wrench className="w-5 h-5 text-orange-500 animate-pulse" />
              )}
              {isFuture && <Lock className="w-4 h-4 text-slate-600" />}
            </div>

            <div className="flex flex-col items-center">
              <span
                className={`text-[10px] font-mono font-bold tracking-wider transition-colors
                  ${isPast ? 'text-cyan-600' : isActive ? 'text-orange-500' : 'text-slate-600'}
                `}
              >
                {'PHASE ' + phase.id}
              </span>
              <span
                className={`text-[11px] font-bold tracking-wide transition-colors
                  ${isPast ? 'text-cyan-500/80' : isActive ? 'text-orange-400' : 'text-slate-600'}
                `}
              >
                {phase.label}
              </span>
              <span
                className={`text-[8px] font-mono tracking-widest transition-colors
                  ${isPast ? 'text-cyan-700' : isActive ? 'text-orange-600' : 'text-slate-700'}
                `}
              >
                {phase.sub}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
