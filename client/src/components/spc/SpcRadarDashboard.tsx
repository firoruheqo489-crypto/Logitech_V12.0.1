'use client';

import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, Clock, Radio, Shield, TrendingUp } from 'lucide-react';
import CTQControlChart from './CTQControlChart';
import { ctq1Dataset, ctq2Dataset } from './spcMockData';

type StatusCard =
  | {
      key: string;
      kind: 'metric';
      title: string;
      subtitle: string;
      value: string;
      valueClassName: string;
      hint: string;
      hintClassName: string;
      icon: LucideIcon;
    }
  | {
      key: string;
      kind: 'action';
      title: string;
      subtitle: string;
      icon: LucideIcon;
    };

const dashboardDatasets = [ctq1Dataset, ctq2Dataset];

interface SpcRadarDashboardProps {
  moldId?: string;
  moldNo?: string;
}

export default function SpcRadarDashboard({
  moldId = 'LA26006',
  moldNo = 'NO. 1',
}: SpcRadarDashboardProps) {
  const activeOOCAlarms = dashboardDatasets.flatMap((dataset) => dataset.subgroups).filter((row) => row.isOOC).length;
  const dashboardState = {
    globalCpk: '1.45',
    currentShift: '03-22 夜班',
  };
  const statusCards: StatusCard[] = [
    {
      key: 'global-cpk',
      kind: 'metric',
      title: '全局制程能力 / GLOBAL CPK',
      subtitle: '',
      value: dashboardState.globalCpk,
      valueClassName: 'text-emerald-400 font-mono text-2xl tabular-nums',
      hint: '(STABLE)',
      hintClassName: 'text-xs text-emerald-500/70 font-mono',
      icon: TrendingUp,
    },
    {
      key: 'ooc-alarms',
      kind: 'metric',
      title: '实时失控拦截 / ACTIVE OOC ALARMS',
      subtitle: '',
      value: String(activeOOCAlarms),
      valueClassName: 'text-rose-500 font-mono text-2xl animate-pulse tabular-nums',
      hint: 'POINT DETECTED',
      hintClassName: 'text-xs text-rose-500/70 font-mono',
      icon: Radio,
    },
    {
      key: 'current-shift',
      kind: 'metric',
      title: '当前抽样班次 / CURRENT SHIFT',
      subtitle: '',
      value: dashboardState.currentShift,
      valueClassName: 'text-slate-200 font-mono text-xl tabular-nums',
      hint: '(NIGHT)',
      hintClassName: 'text-slate-500 text-xs ml-1',
      icon: Clock,
    },
    {
      key: 'issue-8d',
      kind: 'action',
      title: '下发 8D 停机纠正指令',
      subtitle: 'ISSUE 8D CORRECTIVE ACTION',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 min-h-screen w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-indigo-500" />
          <h1 className="text-lg font-bold tracking-widest text-slate-100 uppercase font-mono">
            量产 SPC 质控雷达
            <span className="text-slate-500 ml-2 text-xs font-normal tracking-wider">
              / MASS PRODUCTION SPC RADAR
            </span>
          </h1>
        </div>
        <div className="bg-indigo-950/30 text-indigo-400 border border-indigo-500/30 px-4 py-1.5 rounded text-xs font-mono shadow-[0_0_10px_rgba(99,102,241,0.2)] flex items-center gap-2">
          <Shield className="w-3 h-3" />
          ASSET BINDING: {moldId} | {moldNo}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statusCards.map((card) => {
          const Icon = card.icon;
          if (card.kind === 'action') {
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => window.alert('已生成 8D 异常纠正单，系统将抄送成型部经理！')}
                className="bg-rose-950/20 border border-rose-900/50 p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group hover:bg-rose-950/40 cursor-pointer transition-all"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.8)]" />
                <Icon className="w-6 h-6 text-rose-500 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-rose-500 tracking-widest uppercase font-mono text-center">
                  {card.title}
                </span>
                <span className="text-[9px] text-rose-700 font-mono mt-1">
                  {card.subtitle}
                </span>
              </button>
            );
          }

          return (
            <div key={card.key} className="bg-[#0a0f1c] border border-slate-800 p-4 rounded-xl flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">
                  {card.title}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={card.valueClassName}>{card.value}</span>
                <span className={card.hintClassName}>{card.hint}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-8 mt-4">
        {dashboardDatasets.map((dataset) => (
          <CTQControlChart
            key={dataset.title}
            title={dataset.title}
            metrics={dataset.metrics}
            subgroups={dataset.subgroups}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-800 pt-4 mt-2 gap-2">
        <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">
          SPC RADAR v3.1 — 全局质控仪表盘 / GLOBAL QUALITY CONTROL DASHBOARD
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-slate-600">
            SYSTEM: OPERATIONAL
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[9px] font-mono text-indigo-500">
              LIVE FEED
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
