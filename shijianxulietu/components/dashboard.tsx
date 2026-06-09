'use client'

import { useEffect, useMemo, useState } from 'react'
import { HeaderBar } from '@/components/header-bar'
import { MetricsRow } from '@/components/metrics-row'
import { CoreChart } from '@/components/core-chart'
import { ControlPanel, type ControlState } from '@/components/control-panel'
import { BrushTimeline } from '@/components/brush-timeline'
import { DataTerminal } from '@/components/data-terminal'
import { generateSeries, getRangeLabel, type RangeKey } from '@/lib/series-data'
import { Maximize2, Crosshair } from 'lucide-react'

export function Dashboard() {
  const [range, setRange] = useState<RangeKey>('1W')
  const [brushRange, setBrushRange] = useState<[number, number]>([0, 100])
  const [clock, setClock] = useState('--:--:--')
  const [controls, setControls] = useState<ControlState>({
    showPrimary: true,
    showBaseline: true,
    showAnomalies: true,
    smoothing: 35,
    threshold: 60,
    resolution: 70,
  })

  const data = useMemo(() => generateSeries(range), [range])

  // live UTC clock
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setClock(d.toISOString().slice(11, 19))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // reset brush on range change
  useEffect(() => {
    setBrushRange([0, 100])
  }, [range])

  return (
    <div className="grid-bg min-h-screen">
      <div className="scanlines min-h-screen">
        <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-3 p-3 lg:p-4">
          <HeaderBar range={range} onRangeChange={setRange} clock={clock} />

          <MetricsRow data={data} />

          <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-[1fr_300px]">
            {/* Center column */}
            <div className="flex min-w-0 flex-col gap-3">
              <div className="glass glow-border relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-xl">
                {/* chart header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Crosshair className="h-4 w-4 text-cyan" strokeWidth={1.5} />
                    <div className="leading-tight">
                      <h3 className="font-cn text-sm font-bold text-foreground">
                        主遥测数据流
                        <span className="ml-1.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                          PRIMARY&middot;TELEMETRY&middot;STREAM
                        </span>
                      </h3>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        分辨率 {getRangeLabel(range)} &middot; 多线复合 Multi-line composite
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Legend color="#00f3ff" label="主信号 PRIMARY" />
                    <Legend color="#bc13fe" label="基线 BASELINE" dashed />
                    <Legend color="#ffd60a" label="异常 ANOMALY" />
                    <button
                      aria-label="Expand chart"
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-cyan/50 hover:text-cyan"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* corner ticks */}
                <CornerTicks />

                <div className="relative flex-1 px-1 py-2">
                  <CoreChart
                    data={data}
                    range={range}
                    showPrimary={controls.showPrimary}
                    showBaseline={controls.showBaseline}
                    showAnomalies={controls.showAnomalies}
                    brushRange={brushRange}
                  />
                </div>
              </div>

              <BrushTimeline
                data={data}
                range={range}
                brushRange={brushRange}
                onBrushChange={setBrushRange}
              />
            </div>

            {/* Right control panel */}
            <ControlPanel state={controls} onChange={setControls} />
          </div>

          {/* Raw Data Terminal workspace */}
          <DataTerminal />
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="hidden items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground sm:flex">
      <span
        className="inline-block h-2 w-4 rounded-sm"
        style={{
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color}, ${color} 3px, transparent 3px, transparent 5px)`
            : color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      {label}
    </span>
  )
}

function CornerTicks() {
  const base = 'absolute h-3 w-3 border-cyan/40 pointer-events-none'
  return (
    <>
      <span className={`${base} left-2 top-12 border-l border-t`} />
      <span className={`${base} right-2 top-12 border-r border-t`} />
      <span className={`${base} bottom-2 left-2 border-b border-l`} />
      <span className={`${base} bottom-2 right-2 border-b border-r`} />
    </>
  )
}
