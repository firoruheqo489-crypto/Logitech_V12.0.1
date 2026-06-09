'use client'

import { useState } from 'react'
import { ChevronDown, SlidersHorizontal, Eye, Cpu, Filter, Waves } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BiLabel } from '@/components/bi-label'

export type ControlState = {
  showPrimary: boolean
  showBaseline: boolean
  showAnomalies: boolean
  smoothing: number
  threshold: number
  resolution: number
}

type Props = {
  state: ControlState
  onChange: (s: ControlState) => void
}

export function ControlPanel({ state, onChange }: Props) {
  const set = <K extends keyof ControlState>(k: K, v: ControlState[K]) =>
    onChange({ ...state, [k]: v })

  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex items-center gap-2 px-1">
        <SlidersHorizontal className="h-4 w-4 text-cyan" strokeWidth={1.5} />
        <h2 className="flex flex-col leading-none">
          <span className="font-cn text-sm font-bold text-cyan text-glow-cyan">控制台</span>
          <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">CONTROL&middot;DECK</span>
        </h2>
      </div>

      <Section titleZh="数据图层" titleEn="DATA LAYERS" icon={<Eye className="h-3.5 w-3.5" />} defaultOpen>
        <Toggle
          labelZh="主信号"
          labelEn="Primary Signal"
          color="#00f3ff"
          checked={state.showPrimary}
          onChange={(v) => set('showPrimary', v)}
        />
        <Toggle
          labelZh="基线对比"
          labelEn="Baseline Comparison"
          color="#bc13fe"
          checked={state.showBaseline}
          onChange={(v) => set('showBaseline', v)}
        />
        <Toggle
          labelZh="异常标记"
          labelEn="Anomaly Markers"
          color="#ffd60a"
          checked={state.showAnomalies}
          onChange={(v) => set('showAnomalies', v)}
        />
      </Section>

      <Section titleZh="信号处理" titleEn="SIGNAL PROCESSING" icon={<Waves className="h-3.5 w-3.5" />} defaultOpen>
        <Slider
          labelZh="平滑度"
          labelEn="Smoothing"
          value={state.smoothing}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => set('smoothing', v)}
        />
        <Slider
          labelZh="异常阈值"
          labelEn="Anomaly Threshold"
          value={state.threshold}
          min={0}
          max={100}
          unit="σ"
          accent="alert"
          onChange={(v) => set('threshold', v)}
        />
        <Slider
          labelZh="分辨率"
          labelEn="Resolution"
          value={state.resolution}
          min={10}
          max={100}
          unit="px"
          accent="purple"
          onChange={(v) => set('resolution', v)}
        />
      </Section>

      <Section titleZh="数据源筛选" titleEn="FILTERS" icon={<Filter className="h-3.5 w-3.5" />}>
        <div className="grid grid-cols-2 gap-2">
          {['NODE-01', 'NODE-02', 'EDGE-A', 'EDGE-B', 'CORE', 'RELAY'].map((n, i) => (
            <button
              key={n}
              className={cn(
                'rounded-md border px-2 py-1.5 font-mono text-[10px] tracking-wider transition-all',
                i < 3
                  ? 'border-cyan/40 bg-cyan/10 text-cyan'
                  : 'border-border bg-black/30 text-muted-foreground hover:border-cyan/30',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </Section>

      <Section titleZh="计算引擎" titleEn="COMPUTE ENGINE" icon={<Cpu className="h-3.5 w-3.5" />}>
        <div className="space-y-2">
          <Stat labelZh="模型" labelEn="MODEL" value="ARIMA-X / LSTM" />
          <Stat labelZh="延迟" labelEn="LATENCY" value="12ms" good />
          <Stat labelZh="置信度" labelEn="CONFIDENCE" value="98.4%" good />
          <Stat labelZh="数据节点" labelEn="DATA NODES" value="6 / 6" good />
        </div>
      </Section>
    </aside>
  )
}

function Section({
  titleZh,
  titleEn,
  icon,
  children,
  defaultOpen = false,
}: {
  titleZh: string
  titleEn: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass glow-border overflow-hidden rounded-xl">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-cyan/5"
      >
        <span className="flex items-center gap-2">
          <span className="text-cyan">{icon}</span>
          <BiLabel zh={titleZh} en={titleEn} size="sm" zhClassName="text-secondary-foreground" />
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180 text-cyan')}
        />
      </button>
      {open && <div className="space-y-3 border-t border-border px-3 py-3">{children}</div>}
    </div>
  )
}

function Toggle({
  labelZh,
  labelEn,
  checked,
  onChange,
  color,
}: {
  labelZh: string
  labelEn: string
  checked: boolean
  onChange: (v: boolean) => void
  color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full transition-shadow"
          style={{
            background: checked ? color : 'rgba(120,160,180,0.3)',
            boxShadow: checked ? `0 0 8px ${color}` : 'none',
          }}
        />
        <BiLabel zh={labelZh} en={labelEn} size="sm" zhClassName="text-secondary-foreground" />
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={`${labelZh} ${labelEn}`}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border transition-all',
          checked ? 'border-cyan/60 bg-cyan/20' : 'border-border bg-black/50',
        )}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all"
          style={{
            left: checked ? '18px' : '2px',
            background: checked ? color : '#5c7480',
            boxShadow: checked ? `0 0 8px ${color}` : 'none',
          }}
        />
      </button>
    </div>
  )
}

function Slider({
  labelZh,
  labelEn,
  value,
  min,
  max,
  unit,
  onChange,
  accent = 'cyan',
}: {
  labelZh: string
  labelEn: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (v: number) => void
  accent?: 'cyan' | 'purple' | 'alert'
}) {
  const colorMap = { cyan: '#00f3ff', purple: '#bc13fe', alert: '#ffd60a' }
  const c = colorMap[accent]
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between">
        <BiLabel zh={labelZh} en={labelEn} size="sm" zhClassName="text-secondary-foreground" />
        <span className="font-mono text-[11px] tabular-nums" style={{ color: c }}>
          {value}
          {unit}
        </span>
      </div>
      <div className="relative flex h-4 items-center">
        <div className="absolute h-1 w-full rounded-full bg-black/60" />
        <div
          className="absolute h-1 rounded-full"
          style={{ width: `${pct}%`, background: c, boxShadow: `0 0 8px ${c}` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${labelZh} ${labelEn}`}
          className="slider-input absolute h-4 w-full cursor-pointer appearance-none bg-transparent"
          style={{ ['--thumb' as string]: c }}
        />
      </div>
      <style jsx>{`
        .slider-input::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #050608;
          border: 2px solid var(--thumb);
          box-shadow: 0 0 8px var(--thumb);
          cursor: pointer;
        }
        .slider-input::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #050608;
          border: 2px solid var(--thumb);
          box-shadow: 0 0 8px var(--thumb);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

function Stat({ labelZh, labelEn, value, good }: { labelZh: string; labelEn: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-black/30 px-2.5 py-1.5">
      <BiLabel zh={labelZh} en={labelEn} size="xs" />
      <span className={cn('font-mono text-[11px] tabular-nums', good ? 'text-positive' : 'text-cyan')}>
        {value}
      </span>
    </div>
  )
}
