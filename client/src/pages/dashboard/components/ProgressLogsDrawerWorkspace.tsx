'use client';

import { ClipboardList } from 'lucide-react';
import type { DashboardProgressEntry } from '../lib/dashboardApi';
import { formatProductSequenceLabel, normalizeMoldLookupKey } from '../lib/productModuleUtils';
import type { ProjectData } from '../types/project';
import AssetDrawerWorkspace, { type AssetPanelItem } from './AssetDrawerWorkspace';
import ProgressLogsWorkspace from './ProgressLogsWorkspace';

interface ProgressLogsDrawerWorkspaceProps {
  panels: AssetPanelItem[];
  projects: ProjectData[];
  progressEntriesByMold: Record<string, DashboardProgressEntry[]>;
}

function resolvePanelProductName(panel: AssetPanelItem, projects: ProjectData[]): string {
  const panelMoldKey = normalizeMoldLookupKey(panel.moldId);
  const panelSequence = formatProductSequenceLabel(panel.moldNo);

  const moldMatchedProjects = projects.filter((project) => {
    const moldNumber = project.identity?.moldNumber?.trim() || '';
    return normalizeMoldLookupKey(moldNumber) === panelMoldKey;
  });

  const exactSequenceProject = moldMatchedProjects.find((project) => {
    return formatProductSequenceLabel(project.no) === panelSequence;
  });

  return (
    exactSequenceProject?.identity?.productName?.trim() ||
    moldMatchedProjects[0]?.identity?.productName?.trim() ||
    ''
  );
}

export default function ProgressLogsDrawerWorkspace({
  panels,
  projects,
  progressEntriesByMold,
}: ProgressLogsDrawerWorkspaceProps) {
  return (
    <AssetDrawerWorkspace
      panels={panels}
      badgeLabel=""
      drawerTitle="推进日志抽屉"
      drawerDescription="通过模具编号和序号选择当前要查看的推进日志。"
      emptyMessage="暂无推进日志数据。"
      icon={ClipboardList}
      hideBadgeLabel
      renderActiveContent={(panel) => {
        const productName = resolvePanelProductName(panel, projects);
        return (
          <div className="flex flex-wrap items-center text-slate-100">
            <div className="flex items-center px-0 py-1 md:px-5">
              <span className="text-[18px] font-bold tracking-[0.02em] text-white md:text-[22px]">
                {panel.moldId}
              </span>
            </div>
            <div className="mx-1 hidden h-9 w-px shrink-0 bg-gradient-to-b from-transparent via-cyan-400/70 to-transparent md:block" />
            <div className="flex items-center px-0 py-1 md:px-5">
              <span className="text-[18px] font-semibold tracking-tight text-slate-100 md:text-[20px]">
                {productName || '-'}
              </span>
            </div>
            <div className="mx-1 hidden h-9 w-px shrink-0 bg-gradient-to-b from-transparent via-cyan-400/70 to-transparent md:block" />
            <div className="flex items-center px-0 py-1 md:px-5">
              <span className="text-[18px] font-semibold tracking-tight text-slate-100 md:text-[20px]">
                {panel.moldNo}
              </span>
            </div>
          </div>
        );
      }}
      renderPanel={(panel) => (
        <ProgressLogsWorkspace
          key={`${panel.moldId}::${panel.moldNo}`}
          moldId={panel.moldId}
          moldNo={panel.moldNo}
          projects={projects}
          progressEntriesByMold={progressEntriesByMold}
        />
      )}
    />
  );
}
