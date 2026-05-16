'use client'

import { Badge } from '@/components/ui/badge'
import { Activity, Shield } from 'lucide-react'
import type { ChartType } from '@/lib/spc/spc-types'

interface SPCHeaderProps {
  activeChart: ChartType
}

export function SPCHeader({ activeChart }: SPCHeaderProps) {
  return (
    <header className="spc-header-shell flex items-center justify-between border-b border-white/8 px-6 py-3.5">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="spc-icon-tile flex h-9 w-9 items-center justify-center rounded-xl">
            <Shield className="size-4 text-cyan-300" />
          </div>
          <h1 className="font-mono text-[11px] font-semibold tracking-[0.2em] text-slate-100">
            全局SPC分析终端
          </h1>
        </div>
        <div className="hidden h-4 w-px bg-white/10 md:block" />
        <span className="hidden font-mono text-[10px] text-slate-500 md:inline">
          v1.0.0
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className="spc-header-badge border-white/10 bg-transparent font-mono text-[10px] text-slate-400"
        >
          <Activity className="mr-1 size-3 text-cyan-300" />
          <span className="text-slate-500">当前图表:</span>
          <span className="ml-1 text-slate-100">{activeChart}</span>
        </Badge>
        <div className="flex items-center gap-1.5">
          <span className="spc-online-dot relative flex size-2 text-cyan-300">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-300 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-cyan-300" />
          </span>
          <span className="font-mono text-[10px] text-slate-500">在线</span>
        </div>
      </div>
    </header>
  )
}
