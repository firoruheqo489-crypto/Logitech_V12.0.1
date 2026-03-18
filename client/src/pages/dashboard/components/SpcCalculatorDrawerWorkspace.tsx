'use client';

import { Calculator } from 'lucide-react';
import SPCTerminal from '@/components/spc-calculator/spc-terminal';
import AssetDrawerWorkspace, { type AssetPanelItem } from './AssetDrawerWorkspace';

interface SpcCalculatorDrawerWorkspaceProps {
  panels: AssetPanelItem[];
}

export default function SpcCalculatorDrawerWorkspace({
  panels,
}: SpcCalculatorDrawerWorkspaceProps) {
  return (
    <AssetDrawerWorkspace
      panels={panels}
      badgeLabel="Active SPC Calculator"
      drawerTitle="SPC计算器"
      drawerDescription="通过模具编号 + NO 选择当前要查看的 SPC 计算器资产。"
      emptyMessage="暂无 SPC 计算器数据"
      icon={Calculator}
      renderPanel={(panel) => <SPCTerminal key={`${panel.moldId}::${panel.moldNo}`} />}
    />
  );
}
