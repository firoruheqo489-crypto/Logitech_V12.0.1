'use client'

import { Activity, Download, FileJson, Radio, Layers, Maximize2 } from 'lucide-react'
import { RANGES, type RangeKey } from '@/lib/series-data'
import { cn } from '@/lib/utils'

type Props = {
  range: RangeKey
  onRangeChange: (r: RangeKey) => void
  clock: string
}

export function HeaderBar({ range, onRangeChange, clock }: Props) {
  return (
    <header className="glass glow-border relative z-20 flex flex-col gap-3 rounded-xl px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-md border border-cyan/40 bg-cyan/5">
          <Layers className="h-5 w-5 text-cyan text-glow-cyan" strokeWidth={1.5} />
          <div className="absolute inset-0 animate-flicker rounded-md" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-sm font-semibold tracking-[0.25em] text-cyan text-glow-cyan">
              AXIOM
            </h1>
            <span className="rounded-sm border border-purple/40 bg-purple/10 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-purple">
              v4.2.1
            </span>
          </div>
          <p className="font-cn text-[11px] font-medium leading-tight text-secondary-foreground">
            时序数据指挥中心
            <span className="ml-1.5 font-mono text-[9px] tracking-[0.18em] text-muted-foreground">
              TIME&middot;SERIES&middot;COMMAND
            </span>
          </p>
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-black/40 p-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            className={cn(
              'relative rounded-md px-3 py-1.5 font-mono text-xs tracking-widest transition-all',
              range === r
                ? 'bg-cyan/15 text-cyan text-glow-cyan shadow-[inset_0_0_0_1px_rgba(0,243,255,0.4)]'
                : 'text-muted-foreground hover:text-cyan/70',
            )}
          >
            {r}
            {range === r && (
              <span className="absolute -bottom-px left-1/2 h-px w-6 -translate-x-1/2 bg-cyan shadow-[0_0_8px_rgba(0,243,255,0.9)]" />
            )}
          </button>
        ))}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border border-positive/30 bg-positive/5 px-2.5 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse-dot absolute inline-flex h-2 w-2 rounded-full bg-positive" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-cn text-[11px] font-bold text-positive">实时数据流</span>
            <span className="font-mono text-[8px] tracking-[0.18em] text-positive/70">LIVE STREAMING</span>
          </span>
          <Radio className="h-3 w-3 text-positive" strokeWidth={1.5} />
        </div>

        <div className="hidden items-center gap-1.5 font-mono text-xs text-muted-foreground md:flex">
          <Activity className="h-3.5 w-3.5 text-cyan" strokeWidth={1.5} />
          <span className="tabular-nums text-foreground">{clock}</span>
          <span className="text-[10px] tracking-widest">UTC</span>
        </div>

        <div className="flex items-center gap-1">
          <IconButton label="导出 JSON / Export JSON">
            <FileJson className="h-4 w-4" strokeWidth={1.5} />
          </IconButton>
          <IconButton label="导出 CSV / Export CSV">
            <Download className="h-4 w-4" strokeWidth={1.5} />
          </IconButton>
          <IconButton label="全屏 / Fullscreen">
            <Maximize2 className="h-4 w-4" strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>
    </header>
  )
}

function IconButton({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-black/40 text-muted-foreground transition-all hover:border-cyan/50 hover:text-cyan hover:shadow-[0_0_12px_rgba(0,243,255,0.25)]"
    >
      {children}
    </button>
  )
}
