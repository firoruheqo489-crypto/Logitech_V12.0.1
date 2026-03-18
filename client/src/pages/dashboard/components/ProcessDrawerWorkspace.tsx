'use client';

import { Cpu } from 'lucide-react';
import AssetDrawerWorkspace, { type AssetPanelItem } from './AssetDrawerWorkspace';

interface ProcessDrawerWorkspaceProps {
  panels: AssetPanelItem[];
}

function ProcessPanel({ moldId, moldNo }: AssetPanelItem) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-[#050816] p-6">
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-900/40 px-6 py-10 text-center">
        <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-cyan-500">
          Process Module
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <span className="text-2xl font-bold tracking-wide text-slate-100">{moldId}</span>
          <span className="rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs font-mono text-slate-400">
            {moldNo}
          </span>
        </div>

        <div className="mt-8 text-3xl font-bold tracking-wide text-amber-300">
          模块建设中
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          工艺模块内容暂时清空，后续将在这里逐步补充功能与数据。
        </p>
      </div>
    </div>
  );
}

export default function ProcessDrawerWorkspace({ panels }: ProcessDrawerWorkspaceProps) {
  return (
    <AssetDrawerWorkspace
      panels={panels}
      badgeLabel="Active Process Asset"
      drawerTitle="工艺模块抽屉"
      drawerDescription="通过模具编号 + NO 选择当前要查看的工艺模块。"
      emptyMessage="暂无工艺模块数据"
      icon={Cpu}
      renderPanel={(panel) => <ProcessPanel moldId={panel.moldId} moldNo={panel.moldNo} />}
    />
  );
}
