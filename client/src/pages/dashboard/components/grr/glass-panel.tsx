import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface GlassPanelProps {
  children: ReactNode
  className?: string
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface PanelHeaderProps {
  title: string
  /** Chinese translation rendered smaller, directly below the English title. */
  zh?: string
  subtitle?: string
  right?: ReactNode
}

export function PanelHeader({ title, zh, subtitle, right }: PanelHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-100">{title}</h2>
        {zh ? <p className="mt-0.5 text-[11px] font-medium tracking-wide text-zinc-400">{zh}</p> : null}
        {subtitle ? <p className="mt-1 text-[11px] text-zinc-400">{subtitle}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}
