'use client'

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { useMemo } from 'react'
import {
  formatTimestamp,
  formatFullTimestamp,
  type RangeKey,
  type SeriesPoint,
} from '@/lib/series-data'

type Props = {
  data: SeriesPoint[]
  range: RangeKey
  showPrimary: boolean
  showBaseline: boolean
  showAnomalies: boolean
  brushRange: [number, number]
}

function HudTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null
  const p: SeriesPoint = payload[0].payload
  const primary = p.primary
  const baseline = p.baseline
  const diff = primary - baseline
  const diffPct = ((diff / baseline) * 100).toFixed(2)
  const isAnomaly = p.anomaly > 0.6

  return (
    <div className="glass min-w-[210px] rounded-lg border border-cyan/40 p-0 font-mono shadow-[0_0_30px_rgba(0,243,255,0.15)]">
      <div className="flex items-center justify-between border-b border-cyan/20 bg-cyan/5 px-3 py-1.5">
        <span className="text-[10px] tracking-[0.15em] text-cyan"><span className="font-cn font-bold">数据探针</span> <span className="opacity-60">PROBE</span></span>
        <span className="text-[10px] text-muted-foreground">{formatFullTimestamp(p.t)}</span>
      </div>
      <div className="space-y-2 p-3">
        <Row color="#00f3ff" label="主信号 PRIMARY" value={primary.toLocaleString()} />
        <Row color="#bc13fe" label="基线 BASELINE" value={baseline.toLocaleString()} dashed />
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-[10px] tracking-widest text-muted-foreground">偏差 DELTA</span>
          <span className={diff >= 0 ? 'text-positive' : 'text-negative'}>
            {diff >= 0 ? '+' : ''}
            {diff.toLocaleString()}{' '}
            <span className="text-[10px]">({diffPct}%)</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-widest text-muted-foreground">异常 ANOMALY</span>
          <span className={isAnomaly ? 'text-alert' : 'text-muted-foreground'}>
            {(p.anomaly * 100).toFixed(1)}%
            {isAnomaly && <span className="ml-1 animate-pulse text-alert">●</span>}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] tracking-widest text-muted-foreground">流量 VOLUME</span>
          <span className="text-secondary-foreground">{p.volume.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

function Row({ color, label, value, dashed }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
        <span
          className="inline-block h-2 w-3 rounded-sm"
          style={{
            background: dashed ? `repeating-linear-gradient(90deg, ${color}, ${color} 3px, transparent 3px, transparent 5px)` : color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  )
}

export function CoreChart({ data, range, showPrimary, showBaseline, showAnomalies, brushRange }: Props) {
  const sliced = useMemo(() => {
    const [a, b] = brushRange
    const start = Math.floor((a / 100) * data.length)
    const end = Math.ceil((b / 100) * data.length)
    return data.slice(start, Math.max(end, start + 2))
  }, [data, brushRange])

  const anomalyPoints = useMemo(
    () => sliced.filter((d) => d.anomaly > 0.6),
    [sliced],
  )

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={sliced} margin={{ top: 16, right: 16, bottom: 8, left: 4 }}>
        <defs>
          <linearGradient id="cyanFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00f3ff" stopOpacity={0.35} />
            <stop offset="55%" stopColor="#00f3ff" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#00f3ff" stopOpacity={0} />
          </linearGradient>
          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <CartesianGrid stroke="rgba(120,160,180,0.08)" strokeDasharray="2 6" vertical />

        <XAxis
          dataKey="t"
          tickFormatter={(t) => formatTimestamp(t, range)}
          stroke="rgba(120,160,180,0.25)"
          tick={{ fill: '#5c7480', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          tickLine={false}
          minTickGap={48}
          axisLine={{ stroke: 'rgba(0,243,255,0.15)' }}
        />
        <YAxis
          stroke="rgba(120,160,180,0.25)"
          tick={{ fill: '#5c7480', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v) => `${(v / 1000).toFixed(1)}K`}
          domain={['dataMin - 400', 'dataMax + 400']}
        />

        <Tooltip
          content={<HudTooltip />}
          cursor={{ stroke: '#00f3ff', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.6 }}
        />

        {showBaseline && (
          <Line
            type="monotone"
            dataKey="baseline"
            stroke="#bc13fe"
            strokeWidth={1.5}
            strokeDasharray="6 5"
            dot={false}
            strokeOpacity={0.75}
            isAnimationActive={false}
          />
        )}

        {showPrimary && (
          <Area
            type="monotone"
            dataKey="primary"
            stroke="none"
            fill="url(#cyanFill)"
            isAnimationActive={false}
          />
        )}
        {showPrimary && (
          <Line
            type="monotone"
            dataKey="primary"
            stroke="#00f3ff"
            strokeWidth={2.4}
            dot={false}
            filter="url(#cyanGlow)"
            activeDot={{
              r: 4,
              fill: '#050608',
              stroke: '#00f3ff',
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        )}

        {showAnomalies &&
          anomalyPoints.map((pt) => (
            <ReferenceLine
              key={pt.t}
              x={pt.t}
              stroke="#ffd60a"
              strokeWidth={1}
              strokeOpacity={0.5}
              strokeDasharray="2 3"
            />
          ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
