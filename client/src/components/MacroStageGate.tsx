'use client';

import { useState } from 'react';
import { Activity, BarChart3, Clock, Milestone, type LucideIcon } from 'lucide-react';
import { AuditMatrix } from './macro-stage-gate/AuditMatrix';
import { SubwayLine } from './macro-stage-gate/SubwayLine';

interface AlertState {
  label: string;
  style: string;
}

interface Kpi {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  color: string;
}

interface MacroStageGateProps {
  moldId?: string;
  moldNo?: string;
}

const phaseAlerts: Record<number, AlertState> = {
  1: {
    label: 'PHASE 1: ALL GATES PASSED',
    style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  },
  2: {
    label: 'PHASE 2: MINOR VARIANCE +3D',
    style: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  },
  3: {
    label: 'PHASE 3: CRITICAL PATH DELAY',
    style: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  },
  4: {
    label: 'PHASE 4: AWAITING GATE ENTRY',
    style: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  },
  5: {
    label: 'PHASE 5: AWAITING GATE ENTRY',
    style: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  },
};

const kpis: Kpi[] = [
  {
    label: '总进度',
    value: '48%',
    sub: 'OVERALL',
    icon: BarChart3,
    color: 'text-cyan-400',
  },
  {
    label: '逾期任务',
    value: '2',
    sub: 'OVERDUE',
    icon: Activity,
    color: 'text-rose-400',
  },
  {
    label: '累计偏差',
    value: '+13d',
    sub: 'DRIFT',
    icon: Clock,
    color: 'text-amber-400',
  },
];

export default function MacroStageGate({
  moldId = 'LA26006',
  moldNo = 'NO. 1',
}: MacroStageGateProps) {
  const [activePhase, setActivePhase] = useState(3);
  const alert = phaseAlerts[activePhase];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-[#030712] w-full min-h-screen border border-slate-800/60 rounded-xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Milestone className="w-5 h-5 text-cyan-500" />
          <h1 className="text-base md:text-lg font-bold tracking-widest text-slate-100 uppercase font-mono">
            项目全景查账矩阵
            <span className="text-slate-500 ml-2 text-xs md:text-sm tracking-wider">
              / MASTER STAGE-GATE LEDGER
            </span>
          </h1>
        </div>
        <span
          className={`${alert.style} px-3 py-1 rounded text-xs font-mono animate-pulse`}
        >
          {alert.label} | {moldId} | {moldNo}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.sub}
            className="bg-[#0a0f1c] border border-slate-800 rounded-lg px-4 py-3 flex items-center gap-3"
          >
            <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            <div>
              <p
                className={`text-lg font-bold font-mono tabular-nums ${kpi.color}`}
              >
                {kpi.value}
              </p>
              <p className="text-[10px] font-mono text-slate-500 tracking-wider">
                {kpi.label} / {kpi.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#0a0f1c] border border-slate-800 rounded-xl py-2">
        <SubwayLine activePhase={activePhase} setActivePhase={setActivePhase} />
      </div>

      <AuditMatrix activePhase={activePhase} />

      <div className="flex justify-between items-center pt-2 border-t border-slate-800/50 text-[10px] font-mono text-slate-600">
        <span>SYS: STAGE-GATE LEDGER v2.4.1 | ASSET: {moldId} | {moldNo}</span>
        <span>LAST SYNC: 2025-03-16 08:42:17 CST</span>
      </div>
    </div>
  );
}
