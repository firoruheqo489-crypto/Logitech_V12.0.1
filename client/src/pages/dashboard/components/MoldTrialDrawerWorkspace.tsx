'use client';

import { Database } from 'lucide-react';
import AssetDrawerWorkspace, { type AssetPanelItem } from './AssetDrawerWorkspace';
import MoldTrialDatabase from './MoldTrialDatabase';

interface MoldTrialDrawerWorkspaceProps {
  panels: AssetPanelItem[];
}

export default function MoldTrialDrawerWorkspace({ panels }: MoldTrialDrawerWorkspaceProps) {
  return (
    <AssetDrawerWorkspace
      panels={panels}
      badgeLabel="Active Mold Trial"
      drawerTitle="试模档案抽屉"
      drawerDescription="选择一个模号，主视图区只显示当前选中的试模档案。"
      emptyMessage="暂无试模档案数据"
      icon={Database}
      renderPanel={(panel) => (
        <MoldTrialDatabase
          key={`${panel.moldId}::${panel.moldNo}`}
          moldId={panel.moldId}
          moldNo={panel.moldNo}
          embedded
        />
      )}
    />
  );
}
