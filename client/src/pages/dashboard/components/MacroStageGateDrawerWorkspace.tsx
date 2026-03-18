'use client';

import { Milestone } from 'lucide-react';
import MacroStageGate from '@/components/MacroStageGate';
import AssetDrawerWorkspace, { type AssetPanelItem } from './AssetDrawerWorkspace';

interface MacroStageGateDrawerWorkspaceProps {
  panels: AssetPanelItem[];
}

export default function MacroStageGateDrawerWorkspace({
  panels,
}: MacroStageGateDrawerWorkspaceProps) {
  return (
    <AssetDrawerWorkspace
      panels={panels}
      badgeLabel="Active Macro Gate"
      drawerTitle="宏观流程视图抽屉"
      drawerDescription="通过模具编号 + NO 双认证选择当前要查看的宏观流程视图。"
      emptyMessage="暂无宏观流程视图数据"
      icon={Milestone}
      renderPanel={(panel) => (
        <MacroStageGate moldId={panel.moldId} moldNo={panel.moldNo} />
      )}
    />
  );
}
