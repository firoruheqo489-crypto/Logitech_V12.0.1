'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog'
import { GlassPanel, PanelHeader } from './glass-panel'
import { cn } from '@/lib/utils'
import type { StudyConfig } from './gage-rnr'

interface Props {
  cfg: StudyConfig
  onChange: (operator: number, part: number, trial: number, value: number) => void
  onClearSelectedOperator: (operator: number) => void
  onImportExcel: (file: File) => void
  isImportingExcel?: boolean
  comparePair: string | null
  onComparePairChange: (pair: string | null) => void
  selectedOperator: number | null
  onSelectedOperatorChange: (operator: number | null) => void
  visibleOperators: number[]
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
const stddev = (xs: number[]) => {
  if (xs.length <= 1) return 0
  const avg = mean(xs)
  const variance = xs.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

export function DataMatrix({
  cfg,
  onChange,
  onClearSelectedOperator,
  onImportExcel,
  isImportingExcel = false,
  comparePair,
  onComparePairChange,
  selectedOperator,
  onSelectedOperatorChange,
  visibleOperators,
}: Props) {
  const [active, setActive] = useState(0)
  const [blind, setBlind] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  const operatorIndexes = cfg.operatorNames.map((_, index) => index)
  const comparePairs = operatorIndexes.length >= 2
    ? operatorIndexes.flatMap((left, leftIndex) =>
        operatorIndexes
          .slice(leftIndex + 1)
          .map((right) => ({ key: `${left}-${right}`, left, right })),
      )
    : []

  const safeActive = visibleOperators.includes(active)
    ? active
    : visibleOperators[0] ?? Math.min(active, cfg.operators - 1)

  const rows = cfg.measurements[safeActive]
  const lastTrial = cfg.trials - 1

  const trialMeans = Array.from({ length: cfg.trials }, (_, trialIndex) =>
    mean(rows.map((trialRows) => trialRows[trialIndex] ?? 0)),
  )
  const trialStddevs = Array.from({ length: cfg.trials }, (_, trialIndex) =>
    stddev(rows.map((trialRows) => trialRows[trialIndex] ?? 0)),
  )
  const xbarMean = mean(rows.map((trialRows) => mean(trialRows)))
  const rangeMean = mean(rows.map((trialRows) => range(trialRows)))
  const xbarStddev = stddev(rows.map((trialRows) => mean(trialRows)))
  const rangeStddev = stddev(rows.map((trialRows) => range(trialRows)))

  const canClearSelectedOperator = selectedOperator !== null && comparePair === null
  const activeOperatorLabel = cfg.operatorNames[selectedOperator ?? safeActive]?.replace('APPRAISER ', 'OP ') || '当前评价人'

  const comparisonGroup = comparePairs.length > 0 ? (
    <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
      <button
        type="button"
        onClick={() => {
          onComparePairChange(null)
          onSelectedOperatorChange(null)
        }}
        className={cn(
          'rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
          comparePair === null && selectedOperator === null
            ? 'bg-emerald-400/15 text-emerald-300'
            : 'text-zinc-400 hover:text-zinc-100',
        )}
      >
        全部
      </button>
      {comparePairs.map((pair) => (
        <button
          key={pair.key}
          type="button"
          onClick={() => {
            onComparePairChange(pair.key)
            onSelectedOperatorChange(null)
            setActive(pair.left)
          }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
            comparePair === pair.key ? 'bg-emerald-400/15 text-emerald-300' : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          {`OP ${String.fromCharCode(65 + pair.left)} vs ${String.fromCharCode(65 + pair.right)}`}
        </button>
      ))}
    </div>
  ) : null

  const singleOperatorGroup = (
    <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
      {operatorIndexes.map((operatorIndex) => (
        <button
          key={operatorIndex}
          onClick={() => {
            setActive(operatorIndex)
            onComparePairChange(null)
            onSelectedOperatorChange(operatorIndex)
          }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
            selectedOperator === operatorIndex
              ? 'bg-sky-400/15 text-sky-300'
              : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          {cfg.operatorNames[operatorIndex].replace('APPRAISER ', 'OP ')}
        </button>
      ))}
    </div>
  )

  return (
    <GlassPanel>
      <PanelHeader
        title="Data Acquisition Matrix"
        zh="数据采集矩阵"
        subtitle={`${cfg.operators} appraisers · ${cfg.parts} parts · ${cfg.trials} trials — edit any cell to recompute`}
        right={
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setConfirmClearOpen(true)}
                disabled={!canClearSelectedOperator}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                  canClearSelectedOperator
                    ? 'border-amber-400/25 bg-amber-400/10 text-amber-300 hover:border-amber-400/50 hover:bg-amber-400/16'
                    : 'cursor-not-allowed border-white/[0.08] bg-white/[0.03] text-zinc-500 opacity-50',
                )}
              >
                清除数据
              </button>

              <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300 transition-colors hover:border-sky-400/50 hover:bg-sky-400/16">
                {isImportingExcel ? '解析中...' : '解析Excel'}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      onImportExcel(file)
                    }
                    event.target.value = ''
                  }}
                />
              </label>

              <button
                onClick={() => setBlind((current) => !current)}
                aria-pressed={blind}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                  blind
                    ? 'border-rose-400/40 bg-rose-400/10 text-rose-300'
                    : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200',
                )}
              >
                {blind ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                Blind Mode
              </button>

              {comparisonGroup}
            </div>
            {singleOperatorGroup}
          </div>
        }
      />

      <div className="overflow-x-auto px-2 py-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-400">
              <th className="px-3 py-2 text-center font-semibold">Part</th>
              {Array.from({ length: cfg.trials }, (_, t) => (
                <th key={t} className="px-2 py-2 text-center font-semibold">
                  Trial {t + 1}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-emerald-400/70">X̄</th>
              <th className="px-3 py-2 text-center font-semibold text-amber-400/70">R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((trials, partIndex) => {
              const xbar = mean(trials)
              const r = range(trials)
              return (
                <tr key={partIndex} className="border-t border-white/[0.05]">
                  <td className="px-3 py-1.5 text-center font-mono text-xs text-zinc-300">{cfg.partNames[partIndex]}</td>
                  {trials.map((value, trialIndex) => {
                    const masked = blind && trialIndex < lastTrial
                    return (
                      <td key={trialIndex} className="px-1 py-1">
                        <input
                          type="number"
                          step="0.001"
                          value={value}
                          onChange={(event) => onChange(safeActive, partIndex, trialIndex, Number.parseFloat(event.target.value) || 0)}
                          className={cn(
                            'w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-center font-mono text-xs text-zinc-50 tabular-nums outline-none transition-all focus:border-sky-400/50 focus:bg-sky-400/[0.06] focus:blur-0',
                            masked && 'blur-[5px] focus:blur-0',
                          )}
                          aria-label={`${cfg.operatorNames[safeActive]} ${cfg.partNames[partIndex]} trial ${trialIndex + 1}`}
                        />
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-center font-mono text-xs font-semibold text-emerald-400 tabular-nums">
                    {xbar.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-center font-mono text-xs font-semibold text-amber-400 tabular-nums">
                    {r.toFixed(3)}
                  </td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-emerald-400/20 bg-emerald-400/[0.04]">
              <td className="px-3 py-2 text-center font-semibold text-emerald-300">均值</td>
              {trialMeans.map((value, index) => (
                <td key={index} className="px-3 py-2 text-center font-mono text-xs font-semibold text-emerald-300 tabular-nums">
                  {value.toFixed(3)}
                </td>
              ))}
              <td className="px-3 py-2 text-center font-mono text-xs font-semibold text-emerald-300 tabular-nums">
                {xbarMean.toFixed(3)}
              </td>
              <td className="px-3 py-2 text-center font-mono text-xs font-semibold text-amber-300 tabular-nums">
                {rangeMean.toFixed(3)}
              </td>
            </tr>
            <tr className="border-t border-cyan-400/15 bg-cyan-400/[0.04]">
              <td className="px-3 py-2 text-center font-semibold text-cyan-300">标准差</td>
              {trialStddevs.map((value, index) => (
                <td key={index} className="px-3 py-2 text-center font-mono text-xs font-semibold text-cyan-300 tabular-nums">
                  {value.toFixed(3)}
                </td>
              ))}
              <td className="px-3 py-2 text-center font-mono text-xs font-semibold text-cyan-300 tabular-nums">
                {xbarStddev.toFixed(3)}
              </td>
              <td className="px-3 py-2 text-center font-mono text-xs font-semibold text-cyan-300 tabular-nums">
                {rangeStddev.toFixed(3)}
              </td>
            </tr>
            
          </tbody>
        </table>
      </div>

      <CyberConfirmDialog
        open={confirmClearOpen}
        title="确认清除数据"
        message={`确定要清除 ${activeOperatorLabel} 的全部测量数据吗？\n仅会清除当前单评价人数据，不会影响其他评价人。`}
        confirmText="确认清除"
        cancelText="取消"
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={() => {
          if (selectedOperator !== null) {
            onClearSelectedOperator(selectedOperator)
          }
          setConfirmClearOpen(false)
        }}
      />
    </GlassPanel>
  )
}
