import { useState, useRef, useCallback } from "react";
import { Database, BarChart3, Target, Upload, Loader2, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataGrid } from "./DataGrid";
import { parseBoxplotCsv, readFileAsText } from "./csvParser";
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog";

type LabelDisplayMode = "median" | "mean" | "none";
type DataSourceTab = "upload" | "grid";

interface ControlConsoleProps {
  showMeanLine: boolean;
  setShowMeanLine: (value: boolean) => void;
  showConfidenceIntervals: boolean;
  setShowConfidenceIntervals: (value: boolean) => void;
  highlightOutliers: boolean;
  setHighlightOutliers: (value: boolean) => void;
  usl: number;
  setUsl: (value: number) => void;
  lsl: number;
  setLsl: (value: number) => void;
  dataBatch: string;
  setDataBatch: (value: string) => void;
  xAxisFactor: string;
  setXAxisFactor: (value: string) => void;
  labelDisplay: LabelDisplayMode;
  setLabelDisplay: (value: LabelDisplayMode) => void;
  onApplyLimits?: () => void;
  onDatasetChange?: (data: Record<string, number[]>) => void;
  currentDataset: Record<string, number[]>;
}

export function ControlConsole({
  showMeanLine, setShowMeanLine,
  showConfidenceIntervals, setShowConfidenceIntervals,
  highlightOutliers, setHighlightOutliers,
  usl, setUsl, lsl, setLsl,
  dataBatch, setDataBatch,
  xAxisFactor, setXAxisFactor,
  labelDisplay, setLabelDisplay,
  onApplyLimits,
  onDatasetChange,
  currentDataset,
}: ControlConsoleProps) {
  const [dataSourceTab, setDataSourceTab] = useState<DataSourceTab>("grid");
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvLoading(true);
    setCsvError(null);
    setCsvSuccess(null);

    try {
      const text = await readFileAsText(file);
      const result = parseBoxplotCsv(text);

      if (!result.success) {
        setCsvError(result.error || "解析失败");
      } else {
        onDatasetChange?.(result.data);
        setCsvSuccess(`已加载 ${result.rowCount} 条数据，${Object.keys(result.data).length} 个分组`);
      }
    } catch {
      setCsvError("文件读取失败");
    } finally {
      setCsvLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onDatasetChange]);

  const handleGridApply = useCallback((data: Record<string, number[]>) => {
    onDatasetChange?.(data);
  }, [onDatasetChange]);

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearData = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const handleConfirmClear = useCallback(() => {
    onDatasetChange?.({});
    setShowClearConfirm(false);
  }, [onDatasetChange]);

  return (
    <>
    <div className="space-y-3">
      {/* Data Source Area - Full Width */}
      <div className="rounded-lg border border-zinc-800 bg-[#0f1115]" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-zinc-200">数据源设定</span>
            <span className="text-[10px] text-zinc-500 font-mono">Data & Grouping</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Segmented Control + Clear - unified style */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDataSourceTab("upload")}
                className={`px-3 py-1.5 rounded-md border text-[13px] font-medium tracking-wide transition-all ${dataSourceTab === "upload" ? "text-zinc-100 bg-zinc-800 border-zinc-700 shadow-sm" : "text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:bg-zinc-800/40 hover:border-zinc-700"}`}
              >
                批量导入
              </button>
              <button
                onClick={() => setDataSourceTab("grid")}
                className={`px-3 py-1.5 rounded-md border text-[13px] font-medium tracking-wide transition-all ${dataSourceTab === "grid" ? "text-zinc-100 bg-zinc-800 border-zinc-700 shadow-sm" : "text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:bg-zinc-800/40 hover:border-zinc-700"}`}
              >
                工作表
              </button>
              <button
                onClick={handleClearData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-800 text-zinc-500 hover:text-red-300 hover:bg-red-950/30 hover:border-red-900/50 transition-all text-[13px] font-medium tracking-wide"
              >
                <Trash2 className="w-4 h-4" />清除数据
              </button>
            </div>
          </div>
        </div>

        <div className="p-4">
          {dataSourceTab === "upload" && (
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={csvLoading}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 border-zinc-700 bg-zinc-900/50 px-4 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {csvLoading ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Upload className="mr-1.5 h-3 w-3" />}
                {csvLoading ? "解析中..." : "上传 CSV"}
              </Button>
              {csvError && <p className="text-[10px] text-rose-400 font-mono">{csvError}</p>}
              {csvSuccess && <p className="text-[10px] text-emerald-400 font-mono">{csvSuccess}</p>}
            </div>
          )}

          {dataSourceTab === "grid" && (
            <DataGrid initialData={currentDataset} onApply={handleGridApply} />
          )}
        </div>
      </div>

      {/* Chart Parameters + Spec Limits - Below */}
      <div className="grid grid-cols-2 gap-3">
        {/* Chart Parameters */}
        <div className="rounded-lg border border-zinc-800 bg-[#0f1115] p-4" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)" }}>
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-zinc-200">图形参数</span>
            <span className="text-[10px] text-zinc-500 font-mono">Chart Parameters</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-300">显示均值连线</span>
                <span className="ml-1 text-[10px] text-zinc-600 font-mono">Mean Line</span>
              </div>
              <Switch checked={showMeanLine} onCheckedChange={setShowMeanLine} className="data-[state=checked]:bg-amber-500" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-300">显示置信区间</span>
                <span className="ml-1 text-[10px] text-zinc-600 font-mono">Show CI</span>
              </div>
              <Switch checked={showConfidenceIntervals} onCheckedChange={setShowConfidenceIntervals} className="data-[state=checked]:bg-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-300">高亮异常值</span>
                <span className="ml-1 text-[10px] text-zinc-600 font-mono">Outliers</span>
              </div>
              <Switch checked={highlightOutliers} onCheckedChange={setHighlightOutliers} className="data-[state=checked]:bg-rose-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-zinc-500 whitespace-nowrap">数值标签</label>
              <Select value={labelDisplay} onValueChange={(v) => setLabelDisplay(v as LabelDisplayMode)}>
                <SelectTrigger className="h-7 border-zinc-700 bg-zinc-900/50 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mean">均值 / Mean</SelectItem>
                  <SelectItem value="median">中位数 / Median</SelectItem>
                  <SelectItem value="none">不显示 / None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Spec Limits */}
        <div className="rounded-lg border border-zinc-800 bg-[#0f1115] p-4" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)" }}>
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-rose-500" />
            <span className="text-sm text-zinc-200">规格约束</span>
            <span className="text-[10px] text-zinc-500 font-mono">Spec Limits</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-zinc-500 whitespace-nowrap">上限 (USL)</label>
              <Input type="number" step="0.01" value={usl} onChange={(e) => setUsl(parseFloat(e.target.value) || 0)} className="h-8 w-24 border-zinc-700 bg-zinc-900/50 font-mono text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-zinc-500 whitespace-nowrap">下限 (LSL)</label>
              <Input type="number" step="0.01" value={lsl} onChange={(e) => setLsl(parseFloat(e.target.value) || 0)} className="h-8 w-24 border-zinc-700 bg-zinc-900/50 font-mono text-xs" />
            </div>
            <Button size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs px-4" onClick={onApplyLimits}>应用 / Apply</Button>
          </div>
        </div>
      </div>
    </div>

    <CyberConfirmDialog
      open={showClearConfirm}
      title="清除所有数据"
      message="确定要清除工作表中的所有数据吗？此操作不可撤销。"
      confirmText="确认清除"
      cancelText="取消"
      onConfirm={handleConfirmClear}
      onCancel={() => setShowClearConfirm(false)}
    />
    </>
  );
}
