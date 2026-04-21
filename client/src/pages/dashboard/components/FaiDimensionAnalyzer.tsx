"use client";

import { useMemo } from "react";
import { FAIDashboard } from "@/components/fai/fai-dashboard";

interface FaiPanelItem {
  moldId: string;
  moldNo: string;
}

interface FaiDimensionAnalyzerProps {
  panels?: FaiPanelItem[];
}

export default function FaiDimensionAnalyzer({ panels }: FaiDimensionAnalyzerProps) {
  const normalizedPanels =
    Array.isArray(panels) && panels.length > 0
      ? panels
      : [{ moldId: "LA26006", moldNo: "NO. -" }];

  const primaryPanel = useMemo(() => normalizedPanels[0], [normalizedPanels]);
  const moldId = primaryPanel?.moldId?.trim() || "LA26006";
  const moldNo = primaryPanel?.moldNo?.trim() || "NO. -";

  return (
    <FAIDashboard key={`${moldId}:${moldNo}`} moldId={moldId} moldNo={moldNo} />
  );
}
