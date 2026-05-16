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
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Database,
  Ruler,
  Settings2,
  Zap,
} from 'lucide-react'
import type { ChartType } from '@/lib/spc/spc-types'
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

const VARIABLES_CHARTS = new Set<ChartType>(['Xbar-R', 'Xbar-s', 'I-MR'])

const CHART_SECTIONS: Array<{
  label: string
  charts: Array<{ value: ChartType; name: string; description: string }>
}> = [
  {
    label: '计量型图表',
    charts: [
      {
        value: 'Xbar-R',
        name: 'Xbar-R',
        description: '子组均值与极差图',
      },
      {
        value: 'Xbar-s',
        name: 'Xbar-s',
        description: '子组均值与标准差图',
      },
      {
        value: 'I-MR',
        name: 'I-MR',
        description: '单值与移动极差图',
      },
    ],
  },
  {
    label: '计数型图表',
    charts: [
      { value: 'p', name: 'p', description: '不良率图' },
      { value: 'np', name: 'np', description: '不良数图' },
      { value: 'c', name: 'c', description: '缺陷数图' },
      { value: 'u', name: 'u', description: '单位缺陷数图' },
    ],
  },
]

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
  const isVariablesChart = VARIABLES_CHARTS.has(selectedChart)
  const fieldClassName =
    'spc-premium-input h-10 rounded-xl px-3 font-mono text-xs text-slate-100 placeholder:text-slate-500'

  const updateSpec = (key: keyof SpecInputs, value: string) => {
    onSpecInputsChange({ ...specInputs, [key]: value })
  }

  return (
    <aside className="spc-sidebar-shell flex h-full flex-col gap-5 border-r border-white/8 p-5 xl:p-6">
      <div className="flex items-center gap-3">
        <div className="spc-icon-tile flex size-10 items-center justify-center rounded-2xl">
          <Database className="size-4 text-cyan-300" />
        </div>
        <div>
          <p className="spc-section-kicker">数据入口</p>
          <p className="spc-section-note text-xs">
            用于录入数据与配置SPC图表参数
          </p>
        </div>
      </div>

      <section className="spc-card-shell rounded-[22px] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="spc-panel-title font-mono text-sm font-semibold tracking-[0.1em]">
              原始数据
            </h2>
            <p className="spc-section-note text-[11px]">
              粘贴逗号分隔或按行分隔的测量值
            </p>
          </div>
          <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-cyan-300">
            导入
          </span>
        </div>

        <label className="mb-2 block font-mono text-[10px] font-semibold tracking-[0.18em] text-slate-400">
          数据流
        </label>
        <Textarea
          placeholder="25.1, 25.3, 25.0, 24.9, 25.2&#10;25.4, 25.1, 25.3, 25.0, 25.2"
          className={`${fieldClassName} min-h-[170px] resize-none px-3 py-3 leading-6`}
          value={rawText}
          onChange={(event) => onRawTextChange(event.target.value)}
        />

        <div className="mt-3 rounded-2xl border border-white/6 bg-black/20 px-3 py-2.5">
          <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-cyan-300/75">
            格式要求
          </p>
          <p className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-5 text-slate-400">
            {formatHint}
          </p>
        </div>
      </section>

      <section className="spc-card-shell rounded-[22px] p-4">
        <div className="mb-4">
          <h2 className="spc-panel-title font-mono text-sm font-semibold tracking-[0.1em]">
            图表配置
          </h2>
          <p className="spc-section-note text-[11px]">
            选择图表类型并设置基线参数
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-slate-400">
              <Settings2 className="size-3 text-cyan-300/80" />
              图表类型
            </label>
            <Select
              value={selectedChart}
              onValueChange={(value) => onChartChange(value as ChartType)}
            >
              <SelectTrigger className={`${fieldClassName} w-full justify-between`}>
                <SelectValue placeholder="请选择图表类型" />
              </SelectTrigger>
              <SelectContent className="spc-select-panel rounded-2xl p-1">
                {CHART_SECTIONS.map((section, index) => (
                  <div key={section.label}>
                    {index > 0 && <SelectSeparator className="bg-white/8" />}
                    <SelectGroup>
                      <SelectLabel className="font-mono text-[10px] tracking-[0.18em] text-slate-500">
                        {section.label}
                      </SelectLabel>
                      {section.charts.map((chart) => (
                        <SelectItem
                          key={chart.value}
                          value={chart.value}
                          className="rounded-xl font-mono text-xs text-slate-300 focus:bg-cyan-400/10 focus:text-white"
                        >
                          <div className="flex flex-col py-0.5">
                            <span className="text-slate-100">{chart.name}</span>
                            <span className="text-[10px] text-slate-500">
                              {chart.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-slate-400">
              <Crosshair className="size-3 text-cyan-300/80" />
              子组大小
            </label>
            <Input
              type="number"
              min={1}
              max={50}
              value={subgroupSize}
              onChange={(event) => onSubgroupSizeChange(Number(event.target.value))}
              className={fieldClassName}
              disabled={selectedChart === 'I-MR'}
            />
            <p className="mt-2 font-mono text-[10px] text-slate-500">
              {selectedChart === 'I-MR'
                ? '单值图固定为 n=1'
                : '请填写实际抽样计划中的子组数量'}
            </p>
          </div>
        </div>
      </section>

      {isVariablesChart && (
        <section className="spc-card-shell rounded-[22px] p-4">
          <div className="mb-4">
            <h2 className="spc-panel-title font-mono text-sm font-semibold tracking-[0.1em]">
              规格界限
            </h2>
            <p className="spc-section-note text-[11px]">
              解析完成后用于能力指数计算
            </p>
          </div>

          <label className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-slate-400">
            <Ruler className="size-3 text-cyan-300/80" />
            能力窗口
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="mb-1 block font-mono text-[10px] tracking-[0.18em] text-slate-500">
                USL 上限
              </span>
              <Input
                type="number"
                step="any"
                placeholder="上限"
                value={specInputs.usl}
                onChange={(event) => updateSpec('usl', event.target.value)}
                className={fieldClassName}
              />
            </div>
            <div>
              <span className="mb-1 block font-mono text-[10px] tracking-[0.18em] text-slate-500">
                目标值
              </span>
              <Input
                type="number"
                step="any"
                placeholder="目标值"
                value={specInputs.target}
                onChange={(event) => updateSpec('target', event.target.value)}
                className={fieldClassName}
              />
            </div>
            <div>
              <span className="mb-1 block font-mono text-[10px] tracking-[0.18em] text-slate-500">
                LSL 下限
              </span>
              <Input
                type="number"
                step="any"
                placeholder="下限"
                value={specInputs.lsl}
                onChange={(event) => updateSpec('lsl', event.target.value)}
                className={fieldClassName}
              />
            </div>
          </div>
          <p className="mt-2 font-mono text-[10px] text-slate-500">
            如果只看控制界限，不做能力分析，这里可以留空
          </p>
        </section>
      )}

      <section className="spc-card-shell rounded-[22px] p-4">
        <div className="mb-4">
          <h2 className="spc-panel-title font-mono text-sm font-semibold tracking-[0.1em]">
            一期冻结
          </h2>
          <p className="spc-section-note text-[11px]">
            需要时将控制界限锁定在初始基线窗口
          </p>
        </div>

        <label className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-slate-400">
          <Zap className="size-3 text-cyan-300/80" />
          基线边界
        </label>
        <Input
          type="number"
          min={0}
          value={phaseOneLimit}
          onChange={(event) => onPhaseOneLimitChange(Number(event.target.value))}
          className={fieldClassName}
        />
        <p className="mt-2 font-mono text-[10px] text-slate-500">
          设为 <span className="text-slate-300">0</span> 表示基于全量数据计算
        </p>
      </section>

      {parseStatus.type === 'error' && parseStatus.message && (
        <div className="spc-message-shell spc-message-shell--error flex items-start gap-3 rounded-2xl p-3.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-red-300">
              解析失败
            </p>
            <p className="mt-1 font-mono text-xs leading-5 text-red-100/90">
              {parseStatus.message}
            </p>
          </div>
        </div>
      )}

      {parseStatus.type === 'success' && parseStatus.message && (
        <div className="spc-message-shell spc-message-shell--success flex items-start gap-3 rounded-2xl p-3.5">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan-300" />
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-cyan-200">
              数据已接收
            </p>
            <p className="mt-1 font-mono text-xs leading-5 text-slate-100">
              {parseStatus.message}
            </p>
          </div>
        </div>
      )}

      <div className="mt-auto pt-1">
        <Button
          onClick={onExecute}
          className="spc-execute-button h-12 w-full rounded-2xl font-mono text-sm font-bold tracking-[0.12em]"
          size="lg"
        >
          <Zap className="mr-2 size-4" />
          运行SPC计算
        </Button>
      </div>
    </aside>
  )
}
