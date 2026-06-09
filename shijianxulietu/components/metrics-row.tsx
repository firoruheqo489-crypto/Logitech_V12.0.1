'use client'

import { TrendingUp, TrendingDown, Activity, AlertTriangle, Gauge, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BiLabel } from '@/components/bi-label'
import type { SeriesPoint } from '@/lib/series-data'

type Kpi = {
  id: string
  labelZh: string
  labelEn: string
  value: string
  unit?: string
  delta: number
  icon: React.ReactNode
  accent: 'cyan' | 'purple' | 'alert'
}

function computeKpis(data: SeriesPoint[]): Kpi[] {
  if (data.length === 0) return []
  const values = data.map((d) => d.primary)
  const max = Math.max(...values)
  const last = values[values.length - 1]
  const prev = values[values.length - 2] ?? last
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  const anomalyScore = Math.max(...data.map((d) => d.anomaly))
  const throughput = data.reduce((a, b) => a + b.volume, 0) / data.length

  return [
    {
      id: 'current',
      labelZh: '当前值',
      labelEn: 'CURRENT VALUE',
      value: last.toLocaleString(),
      delta: ((last - prev) / prev) * 100,
      icon: <Activity className="h-4 w-4" strokeWidth={1.5} />,
      accent: 'cyan',
    },
    {
      id: 'max',
      labelZh: '峰值上限',
      labelEn: 'PEAK MAX',
      value: max.toLocaleString(),
      delta: ((max - mean) / mean) * 100,
      icon: <TrendingUp className="h-4 w-4" strokeWidth={1.5} />,
      accent: 'cyan',
    },
    {
      id: 'variance',
      labelZh: '标准差',
      labelEn: 'STD DEVIATION',
      value: Math.round(std).toLocaleString(),
      unit: 'σ',
      delta: -2.4,
      icon: <Gauge className="h-4 w-4" strokeWidth={1.5} />,
      accent: 'purple',
    },
    {
      id: 'anomaly',
      labelZh: '异常评分',
      labelEn: 'ANOMALY SCORE',
      value: (anomalyScore * 100).toFixed(1),
      unit: '%',
      delta: anomalyScore > 0.6 ? 18.2 : -5.1,
      icon: <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />,
      accent: 'alert',
    },
    {
      id: 'throughput',
      labelZh: '平均吞吐量',
      labelEn: 'AVG THROUGHPUT',
      value: (throughput / 1000).toFixed(2),
      unit: 'K/s',
      delta: 6.7,
      icon: <Zap className="h-4 w-4" strokeWidth={1.5} />,
      accent: 'cyan',
    },
  ]
}

const accentMap = {
  cyan: { text: 'text-cyan', glow: 'text-glow-cyan', border: 'border-cyan/30', bg: 'bg-cyan/5' },
  purple: { text: 'text-purple', glow: 'text-glow-purple', border: 'border-purple/30', bg: 'bg-purple/5' },
  alert: { text: 'text-alert', glow: '', border: 'border-alert/30', bg: 'bg-alert/5' },
}

export function MetricsRow({ data }: { data: SeriesPoint[] }) {
  const kpis = computeKpis(data)
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const a = accentMap[kpi.accent]
        const up = kpi.delta >= 0
        return (
          <div
            key={kpi.id}
            className="glass glow-border group relative overflow-hidden rounded-xl p-4"
          >
            {/* sweep */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-scan absolute -inset-y-4 left-0 w-12 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
            </div>

            <div className="flex items-start justify-between">
              <BiLabel zh={kpi.labelZh} en={kpi.labelEn} size="sm" />
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', a.border, a.bg, a.text)}>
                {kpi.icon}
              </span>
            </div>

            <div className="mt-3 flex items-end gap-1.5">
              <span className={cn('font-mono text-2xl font-semibold tabular-nums tracking-tight', a.text, a.glow)}>
                {kpi.value}
              </span>
              {kpi.unit && (
                <span className="mb-0.5 font-mono text-xs text-muted-foreground">{kpi.unit}</span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={cn(
                  'flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums',
                  up ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative',
                )}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? '+' : ''}
                {kpi.delta.toFixed(1)}%
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">较前值 vs prior</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
