"use client";

import { Database, BarChart3, Target } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LabelDisplayMode = "median" | "mean" | "none";

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
}

export function ControlConsole({
  showMeanLine,
  setShowMeanLine,
  showConfidenceIntervals,
  setShowConfidenceIntervals,
  highlightOutliers,
  setHighlightOutliers,
  usl,
  setUsl,
  lsl,
  setLsl,
  dataBatch,
  setDataBatch,
  xAxisFactor,
  setXAxisFactor,
  labelDisplay,
  setLabelDisplay,
}: ControlConsoleProps) {
  return (
    <div
      className="h-48 rounded-lg border border-zinc-800 bg-[#0f1115]"
      style={{
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)",
      }}
    >
      {/* Console Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <div className="h-2 w-2 rounded-full bg-emerald-500" style={{ boxShadow: "0 0 6px rgba(16, 185, 129, 0.5)" }} />
        <span className="text-xs text-zinc-400 font-mono">CONTROL CONSOLE</span>
        <span className="text-[10px] text-zinc-600 font-mono">/ 控制台</span>
      </div>

      {/* Console Content */}
      <div className="grid h-[calc(100%-36px)] grid-cols-3 divide-x divide-zinc-800">
        {/* Column A: Data & Grouping */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-zinc-200">数据源设定</span>
            <span className="text-[10px] text-zinc-500 font-mono">Data & Grouping</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">
                数据批次 / Data Batch
              </label>
              <Select value={dataBatch} onValueChange={setDataBatch}>
                <SelectTrigger className="h-8 border-zinc-700 bg-zinc-900/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="batch-2024-w48">Batch-2024-W48</SelectItem>
                  <SelectItem value="batch-2024-w47">Batch-2024-W47</SelectItem>
                  <SelectItem value="batch-2024-w46">Batch-2024-W46</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">
                X轴因子 / X-Axis Factor
              </label>
              <Select value={xAxisFactor} onValueChange={setXAxisFactor}>
                <SelectTrigger className="h-8 border-zinc-700 bg-zinc-900/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="station">工作站 / Station</SelectItem>
                  <SelectItem value="dimension">尺寸 / Dimension</SelectItem>
                  <SelectItem value="shift">班次 / Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Column B: Chart Parameters */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-zinc-200">图形参数</span>
            <span className="text-[10px] text-zinc-500 font-mono">Chart Parameters</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-300">显示均值连线</span>
                <span className="ml-1 text-[10px] text-zinc-600 font-mono">Show Mean Line</span>
              </div>
              <Switch
                checked={showMeanLine}
                onCheckedChange={setShowMeanLine}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-300">显示置信区间</span>
                <span className="ml-1 text-[10px] text-zinc-600 font-mono">Show CI</span>
              </div>
              <Switch
                checked={showConfidenceIntervals}
                onCheckedChange={setShowConfidenceIntervals}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-300">高亮异常值</span>
                <span className="ml-1 text-[10px] text-zinc-600 font-mono">Highlight Outliers</span>
              </div>
              <Switch
                checked={highlightOutliers}
                onCheckedChange={setHighlightOutliers}
                className="data-[state=checked]:bg-rose-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">
                数值标签 / Value Label
              </label>
              <Select value={labelDisplay} onValueChange={(v) => setLabelDisplay(v as LabelDisplayMode)}>
                <SelectTrigger className="h-7 border-zinc-700 bg-zinc-900/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mean">均值 / Mean</SelectItem>
                  <SelectItem value="median">中位数 / Median</SelectItem>
                  <SelectItem value="none">不显示 / None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Column C: Spec Limits */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-rose-500" />
            <span className="text-sm text-zinc-200">规格约束</span>
            <span className="text-[10px] text-zinc-500 font-mono">Spec Limits</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="w-20 text-[10px] text-zinc-500">
                上限 (USL)
              </label>
              <Input
                type="number"
                step="0.01"
                value={usl}
                onChange={(e) => setUsl(parseFloat(e.target.value) || 0)}
                className="h-8 flex-1 border-zinc-700 bg-zinc-900/50 font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-20 text-[10px] text-zinc-500">
                下限 (LSL)
              </label>
              <Input
                type="number"
                step="0.01"
                value={lsl}
                onChange={(e) => setLsl(parseFloat(e.target.value) || 0)}
                className="h-8 flex-1 border-zinc-700 bg-zinc-900/50 font-mono text-xs"
              />
            </div>
            <Button
              size="sm"
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs"
            >
              应用 / Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
