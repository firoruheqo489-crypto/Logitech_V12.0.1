'use client';

import { Activity } from 'lucide-react';
import SpcRadarDashboard from '@/components/spc/SpcRadarDashboard';
import AssetDrawerWorkspace, { type AssetPanelItem } from './AssetDrawerWorkspace';

interface SpcRadarDrawerWorkspaceProps {
  panels: AssetPanelItem[];
}

export default function SpcRadarDrawerWorkspace({ panels }: SpcRadarDrawerWorkspaceProps) {
  return (
    <AssetDrawerWorkspace
      panels={panels}
      badgeLabel="Active SPC Asset"
      drawerTitle="量产监控抽屉"
      drawerDescription="通过模具编号 + NO 双认证选择当前要查看的量产 SPC 质控面板。"
      emptyMessage="暂无量产监控数据"
      icon={Activity}
      renderPanel={(panel) => (
        <SpcRadarDashboard moldId={panel.moldId} moldNo={panel.moldNo} />
      )}
    />
  );
}
