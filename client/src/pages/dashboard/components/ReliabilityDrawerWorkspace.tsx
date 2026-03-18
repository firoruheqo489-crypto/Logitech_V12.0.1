"use client";

import { ShieldAlert } from "lucide-react";
import AssetDrawerWorkspace, {
  type AssetPanelItem,
} from "./AssetDrawerWorkspace";
import ToolingLifecyclePrognostics from "./ToolingLifecyclePrognostics";

interface ReliabilityDrawerWorkspaceProps {
  panels: AssetPanelItem[];
}

export default function ReliabilityDrawerWorkspace({
  panels,
}: ReliabilityDrawerWorkspaceProps) {
  return (
    <AssetDrawerWorkspace
      panels={panels}
      badgeLabel="Active Reliability Asset"
      drawerTitle="模具可靠性抽屉"
      drawerDescription="通过模具编号与 NO 序号切换当前查看的可靠性与预测性维护控制台。"
      emptyMessage="暂无模具可靠性数据"
      icon={ShieldAlert}
      renderPanel={panel => (
        <ToolingLifecyclePrognostics
          moldId={panel.moldId}
          moldNo={panel.moldNo}
        />
      )}
    />
  );
}
