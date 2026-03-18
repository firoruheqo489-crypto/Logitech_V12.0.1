'use client'

import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Crosshair, Database, Ruler, Settings2, Zap } from 'lucide-react'
import type { ChartType } from '@/lib/spc/spc-types'
import { CHART_GROUPS } from '@/lib/spc/spc-types'
import { getExpectedFormatHint } from '@/lib/spc/spc-parser'
import type { ParseStatus, SpecInputs } from './spc-terminal'

interface SPCSidebarProps {
  selectedChart: ChartType
  onChartChange: (chart: ChartType) => void
  subgroupSize: number
  onSubgroupSizeChange: (size: number) => void
  phaseOneLimit: number
  onPhaseOneLimitChange: (limit: number) => void
  rawText: string
  onRawTextChange: (text: string) => void
  specInputs: SpecInputs
  onSpecInputsChange: (specs: SpecInputs) => void
  onExecute: () => void
  parseStatus: ParseStatus
}

export function SPCSidebar({
  selectedChart,
  onChartChange,
  subgroupSize,
  onSubgroupSizeChange,
  phaseOneLimit,
  onPhaseOneLimitChange,
  rawText,
  onRawTextChange,
  specInputs,
  onSpecInputsChange,
  onExecute,
  parseStatus,
}: SPCSidebarProps) {
  const formatHint = getExpectedFormatHint(selectedChart, subgroupSize)
  const isVariablesChart = ['Xbar-R', 'Xbar-s', 'I-MR'].includes(selectedChart)

  // Helper to update spec inputs
  const updateSpec = (key: keyof SpecInputs, value: string) => {
    onSpecInputsChange({ ...specInputs, [key]: value })
  }

  return (
    <aside className="flex flex-col gap-6 border-r border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Database className="size-3 text-blue-400/70" />
        <h2 className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          THE FUNNEL
        </h2>
        <span className="font-mono text-[9px] text-slate-600">
          // 数据导入
        </span>
      </div>

      {/* Data Input Textarea */}
      <div className="flex flex-col gap-2">
        <label className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          原始工厂数据
        </label>
        <Textarea
          placeholder={"粘贴原始数据...\n示例:\n25.1, 25.3, 25.0, 24.9, 25.2\n25.4, 25.1, 25.3, 25.0, 25.2"}
          className="h-36 resize-none border border-slate-800 bg-slate-900/80 font-mono text-sm text-slate-100 ring-0 transition-all placeholder:text-slate-600 focus-visible:border-blue-500/50 focus-visible:outline-none"
          value={rawText}
          onChange={(e) => onRawTextChange(e.target.value)}
        />
        {/* Dynamic Format Hint */}
        <p className="font-mono text-[10px] text-slate-600">
          {formatHint}
        </p>
      </div>

      {/* Chart Router Select */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          <Settings2 className="size-3 text-slate-500" />
          控制图路由
        </label>
        <Select
          value={selectedChart}
          onValueChange={(val) => onChartChange(val as ChartType)}
        >
          <SelectTrigger className="w-full border border-slate-800 bg-slate-900/80 font-mono text-xs text-slate-100 transition-all focus:border-blue-500/50 focus:outline-none">
            <SelectValue placeholder="选择控制图类型" />
          </SelectTrigger>
          <SelectContent className="border border-slate-800 bg-slate-900/95 backdrop-blur-xl">
            {CHART_GROUPS.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <SelectSeparator />}
                <SelectGroup>
                  <SelectLabel className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-600">
                    {group.label}
                  </SelectLabel>
                  {group.charts.map((chart) => (
                    <SelectItem
                      key={chart.value}
                      value={chart.value}
                      className="font-mono text-xs text-slate-300 focus:bg-slate-800/50 focus:text-white"
                    >
                      <span className="font-medium text-slate-100">{chart.name}</span>
                      <span className="ml-2 text-slate-500">
                        {chart.description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subgroup Size */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          <Crosshair className="size-3 text-slate-500" />
          子组大小 (n)
        </label>
        <Input
          type="number"
          min={1}
          max={50}
          value={subgroupSize}
          onChange={(e) => onSubgroupSizeChange(Number(e.target.value))}
          className="border border-slate-800 bg-slate-900/80 font-mono text-xs text-slate-100 transition-all focus-visible:border-blue-500/50 focus-visible:outline-none"
          disabled={selectedChart === 'I-MR'}
        />
        {selectedChart === 'I-MR' && (
          <p className="font-mono text-[10px] text-slate-600">
            I-MR 控制图固定 n=1
          </p>
        )}
      </div>

      {/* Specification Limits (Variables charts only) */}
      {isVariablesChart && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
            <Ruler className="size-3 text-slate-500" />
            规格限 (Cp/Cpk 计算)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[8px] text-slate-500">USL</span>
              <Input
                type="number"
                step="any"
                placeholder="上限"
                value={specInputs.usl}
                onChange={(e) => updateSpec('usl', e.target.value)}
                className="border border-slate-800 bg-slate-900/80 font-mono text-xs text-slate-100 transition-all focus-visible:border-blue-500/50 focus-visible:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[8px] text-slate-500">Target</span>
              <Input
                type="number"
                step="any"
                placeholder="目标"
                value={specInputs.target}
                onChange={(e) => updateSpec('target', e.target.value)}
                className="border border-slate-800 bg-slate-900/80 font-mono text-xs text-slate-100 transition-all focus-visible:border-blue-500/50 focus-visible:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[8px] text-slate-500">LSL</span>
              <Input
                type="number"
                step="any"
                placeholder="下限"
                value={specInputs.lsl}
                onChange={(e) => updateSpec('lsl', e.target.value)}
                className="border border-slate-800 bg-slate-900/80 font-mono text-xs text-slate-100 transition-all focus-visible:border-blue-500/50 focus-visible:outline-none"
              />
            </div>
          </div>
          <p className="font-mono text-[10px] text-slate-600">
            留空 = 不计算过程能力指数
          </p>
        </div>
      )}

      {/* Phase I Baseline Limit */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          <Zap className="size-3 text-slate-500" />
          Phase I 基线限值
        </label>
        <Input
          type="number"
          min={0}
          value={phaseOneLimit}
          onChange={(e) => onPhaseOneLimitChange(Number(e.target.value))}
          className="border border-slate-800 bg-slate-900/80 font-mono text-xs text-slate-100 transition-all focus-visible:border-blue-500/50 focus-visible:outline-none"
        />
        <p className="font-mono text-[10px] text-slate-600">
          冻结控制限的样本数 (0 = 全部)
        </p>
      </div>

      {/* Error Message Block */}
      {parseStatus.type === 'error' && parseStatus.message && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <p className="font-mono text-xs font-semibold text-red-400">
            {parseStatus.message}
          </p>
        </div>
      )}

      {/* Success Message Block */}
      {parseStatus.type === 'success' && parseStatus.message && (
        <div className="flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
          <Zap className="mt-0.5 size-4 shrink-0 text-blue-400" />
          <p className="font-mono text-xs font-semibold text-blue-400">
            {parseStatus.message}
          </p>
        </div>
      )}

      {/* Execute Button — Enterprise Blue */}
      <div className="mt-auto">
        <Button
          onClick={onExecute}
          className="w-full border-none bg-blue-600 font-mono text-sm font-bold tracking-wide text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
          size="lg"
        >
          <Zap className="mr-2 size-4" />
          PARSE & EXECUTE AUDIT
        </Button>
      </div>
    </aside>
  )
}
