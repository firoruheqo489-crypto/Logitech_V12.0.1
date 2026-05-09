"use client";

import { useState } from "react";
import { BoxplotChart } from "@/components/boxplot-chart";
import { KPICards } from "@/components/kpi-cards";
import { InsightPanel } from "@/components/insight-panel";
import { ControlConsole } from "@/components/control-console";
import { Settings2, RefreshCw, Download, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mock data for the boxplot chart
const mockBoxplotData = [
  {
    label: "工位-01",
    labelEn: "Station-01",
    min: 9.82,
    q1: 9.94,
    median: 10.02,
    q3: 10.08,
    max: 10.18,
    mean: 10.01,
    outliers: [9.72, 10.32],
  },
  {
    label: "工位-02",
    labelEn: "Station-02",
    min: 9.88,
    q1: 9.97,
    median: 10.05,
    q3: 10.12,
    max: 10.22,
    mean: 10.04,
    outliers: [10.38],
  },
  {
    label: "工位-03",
    labelEn: "Station-03",
    min: 9.78,
    q1: 9.91,
    median: 9.98,
    q3: 10.06,
    max: 10.15,
    mean: 9.97,
    outliers: [9.65, 10.28],
  },
  {
    label: "工位-04",
    labelEn: "Station-04",
    min: 9.85,
    q1: 9.96,
    median: 10.03,
    q3: 10.11,
    max: 10.20,
    mean: 10.02,
    outliers: [],
  },
  {
    label: "工位-05",
    labelEn: "Station-05",
    min: 9.80,
    q1: 9.93,
    median: 10.00,
    q3: 10.09,
    max: 10.17,
    mean: 10.00,
    outliers: [9.68],
  },
  {
    label: "工位-06",
    labelEn: "Station-06",
    min: 9.83,
    q1: 9.95,
    median: 10.04,
    q3: 10.13,
    max: 10.21,
    mean: 10.03,
    outliers: [10.35, 9.70],
  },
];

type LabelDisplayMode = "median" | "mean" | "none";

export default function ProcessVarianceWorkspace() {
  // Chart control states
  const [showMeanLine, setShowMeanLine] = useState(true);
  const [showConfidenceIntervals, setShowConfidenceIntervals] = useState(false);
  const [highlightOutliers, setHighlightOutliers] = useState(true);
  const [usl, setUsl] = useState(10.30);
  const [lsl, setLsl] = useState(9.70);
  const [dataBatch, setDataBatch] = useState("batch-2024-w48");
  const [xAxisFactor, setXAxisFactor] = useState("station");
  const [labelDisplay, setLabelDisplay] = useState<LabelDisplayMode>("mean");

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {/* Section 1: Header & Global KPIs */}
        <header className="space-y-4">
          {/* Header Bar */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">
                过程方差与能力监控工作台
              </h1>
              <p className="font-mono text-sm text-zinc-500">
                Process Variance & Capability Workspace
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Timestamp */}
              <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-[#0f1115] px-3 py-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                <span className="font-mono text-xs text-zinc-400">
                  2024-12-09 14:32:18 UTC+8
                </span>
              </div>
              {/* Action buttons */}
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                <span className="text-xs">刷新</span>
                <span className="ml-1 font-mono text-[10px] text-zinc-600">Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                <span className="text-xs">导出</span>
                <span className="ml-1 font-mono text-[10px] text-zinc-600">Export</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <KPICards />
        </header>

        {/* Section 2: Main Canvas & Insight Panel */}
        <div className="grid grid-cols-[1fr_320px] gap-4">
          {/* Left Canvas: Boxplot Chart - MAXIMIZED */}
          <div
            className="flex min-h-[480px] flex-col rounded-lg border border-zinc-800 bg-[#0f1115] p-2"
            style={{
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)",
            }}
          >
            {/* Compact Chart Header */}
            <div className="mb-1 flex items-center justify-between px-2 py-1">
              <div>
                <h2 className="text-sm font-medium text-zinc-200">
                  多维方差分析
                </h2>
                <p className="font-mono text-[10px] text-zinc-500">
                  Multi-Metric Variance Analysis / Minitab-Grade Boxplot
                </p>
              </div>
            </div>

            {/* SVG Boxplot - FULL WIDTH, FLEX-1 */}
            <div className="flex w-full flex-1">
              <BoxplotChart
                data={mockBoxplotData}
                usl={usl}
                lsl={lsl}
                showMeanLine={showMeanLine}
                showConfidenceIntervals={showConfidenceIntervals}
                highlightOutliers={highlightOutliers}
                labelDisplay={labelDisplay}
              />
            </div>
          </div>

          {/* Right Panel: Insight Suite */}
          <InsightPanel />
        </div>

        {/* Section 3: Control Console */}
        <ControlConsole
          showMeanLine={showMeanLine}
          setShowMeanLine={setShowMeanLine}
          showConfidenceIntervals={showConfidenceIntervals}
          setShowConfidenceIntervals={setShowConfidenceIntervals}
          highlightOutliers={highlightOutliers}
          setHighlightOutliers={setHighlightOutliers}
          usl={usl}
          setUsl={setUsl}
          lsl={lsl}
          setLsl={setLsl}
          dataBatch={dataBatch}
          setDataBatch={setDataBatch}
          xAxisFactor={xAxisFactor}
          setXAxisFactor={setXAxisFactor}
          labelDisplay={labelDisplay}
          setLabelDisplay={setLabelDisplay}
        />

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-zinc-800/50 pt-3 text-[10px] text-zinc-600">
          <div className="flex items-center gap-4">
            <span className="font-mono">SPC Module v2.4.1</span>
            <span>|</span>
            <span>质量工程分析平台 / Quality Engineering Platform</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono">System Online</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
