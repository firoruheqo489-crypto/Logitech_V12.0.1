'use client'

import { Badge } from '@/components/ui/badge'
import { Activity, Shield } from 'lucide-react'
import type { ChartType } from '@/lib/spc/spc-types'

interface SPCHeaderProps {
  activeChart: ChartType
}

export function SPCHeader({ activeChart }: SPCHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-3 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-blue-400/70" />
          <h1 className="font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-300">
            GLOBAL SPC INTERROGATION TERMINAL
          </h1>
        </div>
        <div className="hidden h-4 w-px bg-slate-700 md:block" />
        <span className="hidden font-mono text-[10px] text-slate-500 md:inline">
          v1.0.0
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className="border border-slate-800 bg-slate-900/60 font-mono text-[10px] text-slate-400"
        >
          <Activity className="mr-1 size-3 text-blue-400/70" />
          <span className="text-slate-500">ACTIVE:</span> <span className="ml-1 text-slate-100">{activeChart}</span>
        </Badge>
        <div className="flex items-center gap-1.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-blue-400" />
          </span>
          <span className="font-mono text-[10px] text-slate-500">ONLINE</span>
        </div>
      </div>
    </header>
  )
}
