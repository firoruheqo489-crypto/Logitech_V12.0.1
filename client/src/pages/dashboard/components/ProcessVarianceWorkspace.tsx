import { useState, useMemo, useCallback, useRef } from "react";
import { BoxplotChart } from "./boxplot/BoxplotChart";
import { KPICards } from "./boxplot/KPICards";
import { InsightPanel } from "./boxplot/InsightPanel";
import { ControlConsole } from "./boxplot/ControlConsole";
import { Settings2, RefreshCw, Download, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeBoxplotStats, computeGlobalStats } from "./boxplot/statsEngine";
import type { BoxplotStats, GlobalStats } from "./boxplot/statsEngine";
import html2canvas from "html2canvas";

// --- Phase 2: Raw measurement dataset (simulates DB fetch) ---
const mockRawData: Record<string, number[]> = {
  "工位-01": [10.02, 9.98, 10.05, 9.94, 10.08, 9.93, 10.01, 9.96, 10.12, 10.03, 9.99, 10.07, 9.95, 10.04, 9.97, 10.06, 9.92, 10.09, 10.00, 9.94, 10.11, 9.98, 10.03, 9.96, 10.01, 9.93, 10.08, 9.97, 10.05, 9.99, 10.02, 9.95, 10.07, 9.94, 10.10, 9.91, 10.04, 9.98, 10.06, 9.93, 9.72, 10.32],
  "工位-02": [10.05, 10.01, 10.08, 9.97, 10.12, 10.03, 9.99, 10.06, 9.95, 10.09, 10.02, 9.98, 10.07, 10.04, 9.96, 10.10, 10.01, 9.97, 10.05, 10.03, 9.99, 10.08, 9.96, 10.11, 10.00, 9.98, 10.06, 10.02, 9.97, 10.04, 10.01, 9.95, 10.09, 10.03, 9.98, 10.07, 10.00, 9.96, 10.05, 10.02, 10.38],
  "工位-03": [9.98, 9.94, 10.01, 9.91, 10.06, 9.96, 9.99, 9.93, 10.04, 9.97, 10.02, 9.90, 10.05, 9.95, 9.98, 10.03, 9.92, 10.00, 9.96, 10.01, 9.94, 9.99, 9.91, 10.06, 9.97, 10.02, 9.93, 10.04, 9.95, 9.98, 10.01, 9.90, 10.05, 9.96, 9.99, 9.92, 10.03, 9.94, 10.00, 9.97, 9.65, 10.28],
  "工位-04": [10.03, 9.99, 10.06, 9.96, 10.11, 10.01, 9.97, 10.04, 9.95, 10.08, 10.02, 9.98, 10.05, 10.00, 9.96, 10.09, 10.03, 9.97, 10.06, 10.01, 9.98, 10.04, 9.96, 10.10, 10.00, 9.97, 10.05, 10.02, 9.96, 10.03, 10.01, 9.95, 10.08, 10.02, 9.98, 10.06, 9.99, 9.96, 10.04, 10.01],
  "工位-05": [10.00, 9.96, 10.03, 9.93, 10.09, 9.98, 10.02, 9.95, 10.06, 9.99, 10.04, 9.94, 10.07, 9.97, 10.01, 9.93, 10.05, 9.98, 10.03, 9.96, 10.00, 9.94, 10.06, 9.97, 10.02, 9.95, 10.04, 9.99, 9.93, 10.01, 9.97, 10.05, 9.96, 10.03, 9.98, 10.00, 9.94, 10.07, 9.96, 10.02, 9.68],
  "工位-06": [10.04, 10.00, 10.07, 9.95, 10.13, 10.02, 9.98, 10.05, 9.96, 10.10, 10.03, 9.99, 10.06, 10.01, 9.97, 10.08, 10.04, 9.98, 10.05, 10.02, 9.99, 10.07, 9.95, 10.12, 10.01, 9.98, 10.06, 10.03, 9.97, 10.04, 10.02, 9.96, 10.09, 10.03, 9.99, 10.07, 10.00, 9.97, 10.05, 10.02, 10.35, 9.70],
};

type LabelDisplayMode = "median" | "mean" | "none";

export default function ProcessVarianceWorkspace() {
  // --- Phase 2: Global State Machine ---
  const [rawDataset, setRawDataset] = useState(mockRawData);
  const [showMeanLine, setShowMeanLine] = useState(true);
  const [showConfidenceIntervals, setShowConfidenceIntervals] = useState(false);
  const [highlightOutliers, setHighlightOutliers] = useState(true);
  const [usl, setUsl] = useState(10.30);
  const [lsl, setLsl] = useState(9.70);
  const [pendingUsl, setPendingUsl] = useState(10.30);
  const [pendingLsl, setPendingLsl] = useState(9.70);
  const [dataBatch, setDataBatch] = useState("batch-2024-w48");
  const [xAxisFactor, setXAxisFactor] = useState("station");
  const [labelDisplay, setLabelDisplay] = useState<LabelDisplayMode>("mean");
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleApplyLimits = useCallback(() => {
    setUsl(pendingUsl);
    setLsl(pendingLsl);
  }, [pendingUsl, pendingLsl]);

  const handleDatasetChange = useCallback((data: Record<string, number[]>) => {
    setRawDataset(data);
  }, []);

  const handleExport = useCallback(async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#050505',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.download = `Process_Variance_Report_${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // Silent fail - export not critical
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  // --- Phase 3: Data Nervous System (useMemo recomputes on rawDataset/usl/lsl change) ---
  const stationStats: BoxplotStats[] = useMemo(() => {
    const entries = Object.entries(rawDataset);
    return entries.map(([label], index) => {
      const labelEn = `Station-${String(index + 1).padStart(2, '0')}`;
      return computeBoxplotStats(label, labelEn, rawDataset[label]);
    });
  }, [rawDataset]);

  const globalStats: GlobalStats = useMemo(() => {
    return computeGlobalStats(stationStats, usl, lsl, rawDataset);
  }, [stationStats, usl, lsl, rawDataset]);

  // Transform stats into BoxplotChart data contract
  const chartData = useMemo(() => {
    return stationStats.map((s) => ({
      label: s.label,
      labelEn: s.labelEn,
      min: s.whiskerLow,
      q1: s.q1,
      median: s.median,
      q3: s.q3,
      max: s.whiskerHigh,
      mean: s.mean,
      outliers: s.outliers,
    }));
  }, [stationStats]);

  return (
    <div className="space-y-4">
      {/* Exportable report area */}
      <div ref={reportRef}>
      {/* Header & KPIs */}
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">过程方差与能力监控工作台</h1>
            <p className="font-mono text-sm text-zinc-500">Process Variance & Capability Workspace</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-[#0f1115] px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              <span className="font-mono text-xs text-zinc-400">2024-12-09 14:32:18 UTC+8</span>
            </div>
            <Button variant="outline" size="sm" className="border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              <span className="text-xs">刷新</span>
              <span className="ml-1 font-mono text-[10px] text-zinc-600">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" className="border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
              <span className="text-xs">导出</span>
              <span className="ml-1 font-mono text-[10px] text-zinc-600">Export</span>
            </Button>
            <Button variant="outline" size="sm" className="border-zinc-700 bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <KPICards globalStats={globalStats} />
      </header>

      {/* Main Canvas & Insight Panel */}
      <div className="grid grid-cols-[1fr_320px] gap-4">
        <div className="flex min-h-[480px] flex-col rounded-lg border border-zinc-800 bg-[#0f1115] p-2" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)" }}>
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <div>
              <h2 className="text-sm font-medium text-zinc-200">多维方差分析</h2>
              <p className="font-mono text-[10px] text-zinc-500">Multi-Metric Variance Analysis / Minitab-Grade Boxplot</p>
            </div>
          </div>
          <div className="flex w-full flex-1">
            <BoxplotChart
              data={chartData}
              usl={usl}
              lsl={lsl}
              showMeanLine={showMeanLine}
              showConfidenceIntervals={showConfidenceIntervals}
              highlightOutliers={highlightOutliers}
              labelDisplay={labelDisplay}
            />
          </div>
        </div>
        <InsightPanel globalStats={globalStats} />
      </div>
      </div>{/* end reportRef */}

      {/* Control Console */}
      <ControlConsole
        showMeanLine={showMeanLine} setShowMeanLine={setShowMeanLine}
        showConfidenceIntervals={showConfidenceIntervals} setShowConfidenceIntervals={setShowConfidenceIntervals}
        highlightOutliers={highlightOutliers} setHighlightOutliers={setHighlightOutliers}
        usl={pendingUsl} setUsl={setPendingUsl}
        lsl={pendingLsl} setLsl={setPendingLsl}
        dataBatch={dataBatch} setDataBatch={setDataBatch}
        xAxisFactor={xAxisFactor} setXAxisFactor={setXAxisFactor}
        labelDisplay={labelDisplay} setLabelDisplay={setLabelDisplay}
        onApplyLimits={handleApplyLimits}
        onDatasetChange={handleDatasetChange}
        currentDataset={rawDataset}
      />
    </div>
  );
}
