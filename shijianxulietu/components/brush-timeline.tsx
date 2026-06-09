'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { GripVertical } from 'lucide-react'
import { formatTimestamp, type RangeKey, type SeriesPoint } from '@/lib/series-data'

type Props = {
  data: SeriesPoint[]
  range: RangeKey
  brushRange: [number, number]
  onBrushChange: (r: [number, number]) => void
}

export function BrushTimeline({ data, range, brushRange, onBrushChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<'left' | 'right' | 'middle' | null>(null)
  const [a, b] = brushRange

  const startLabel = useMemo(() => {
    const i = Math.floor((a / 100) * (data.length - 1))
    return data[i] ? formatTimestamp(data[i].t, range) : ''
  }, [a, data, range])
  const endLabel = useMemo(() => {
    const i = Math.min(data.length - 1, Math.ceil((b / 100) * (data.length - 1)))
    return data[i] ? formatTimestamp(data[i].t, range) : ''
  }, [b, data, range])

  const pointerToPct = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return
      const pct = pointerToPct(e.clientX)
      if (drag === 'left') {
        onBrushChange([Math.min(pct, b - 4), b])
      } else if (drag === 'right') {
        onBrushChange([a, Math.max(pct, a + 4)])
      } else {
        const width = b - a
        let nl = pct - width / 2
        nl = Math.max(0, Math.min(100 - width, nl))
        onBrushChange([nl, nl + width])
      }
    },
    [drag, a, b, onBrushChange, pointerToPct],
  )

  return (
    <div className="glass glow-border rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex flex-col leading-none">
          <span className="font-cn text-[11px] font-bold text-secondary-foreground">历元导航器</span>
          <span className="font-mono text-[8px] tracking-[0.2em] text-muted-foreground">EPOCH&middot;NAVIGATOR</span>
        </span>
        <div className="flex items-center gap-3 font-mono text-[10px] tabular-nums text-cyan">
          <span>{startLabel}</span>
          <span className="text-muted-foreground">&rarr;</span>
          <span>{endLabel}</span>
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative h-16 w-full touch-none select-none overflow-hidden rounded-lg border border-border bg-black/40"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        {/* mini chart */}
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="miniFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f3ff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00f3ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="primary"
                stroke="#00f3ff"
                strokeWidth={1}
                fill="url(#miniFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* dimmed regions */}
        <div className="absolute inset-y-0 left-0 bg-black/65" style={{ width: `${a}%` }} />
        <div className="absolute inset-y-0 right-0 bg-black/65" style={{ width: `${100 - b}%` }} />

        {/* selection window */}
        <div
          className="absolute inset-y-0 border-x border-cyan/60 bg-cyan/5"
          style={{ left: `${a}%`, width: `${b - a}%` }}
          onPointerDown={() => setDrag('middle')}
        >
          <div className="absolute inset-0 cursor-grab active:cursor-grabbing" />
        </div>

        {/* handles */}
        <Handle pct={a} onDown={() => setDrag('left')} />
        <Handle pct={b} onDown={() => setDrag('right')} />
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[9px] tracking-widest text-muted-foreground">
        <span>{data.length} 采样 SAMPLES</span>
        <span className="text-cyan/70">
          窗口 WINDOW {Math.round(b - a)}% &middot; 拖拽导航 DRAG TO NAVIGATE
        </span>
        <span>分辨率 RES {range}</span>
      </div>
    </div>
  )
}

function Handle({ pct, onDown }: { pct: number; onDown: () => void }) {
  return (
    <div
      className="absolute inset-y-0 z-10 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center"
      style={{ left: `${pct}%` }}
      onPointerDown={onDown}
    >
      <div className="flex h-8 w-3.5 items-center justify-center rounded-sm border border-cyan/70 bg-cyan/15 shadow-[0_0_10px_rgba(0,243,255,0.4)]">
        <GripVertical className="h-3 w-3 text-cyan" />
      </div>
    </div>
  )
}
