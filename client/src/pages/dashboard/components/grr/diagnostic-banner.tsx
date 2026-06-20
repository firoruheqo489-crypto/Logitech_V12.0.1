import { GlassPanel } from './glass-panel'
import { cn } from '@/lib/utils'
import type { Diagnosis } from './gage-rnr'

const tone = {
  good: {
    bar: 'bg-emerald-400 shadow-[0_0_16px] shadow-emerald-400/50',
    title: 'text-emerald-400',
    ring: 'border-emerald-400/20 bg-emerald-400/[0.04]',
  },
  warn: {
    bar: 'bg-amber-400 shadow-[0_0_16px] shadow-amber-400/50',
    title: 'text-amber-400',
    ring: 'border-amber-400/20 bg-amber-400/[0.04]',
  },
  fail: {
    bar: 'bg-rose-400 shadow-[0_0_16px] shadow-rose-400/50',
    title: 'text-rose-400',
    ring: 'border-rose-400/20 bg-rose-400/[0.04]',
  },
}

export function DiagnosticBanner({ diagnosis }: { diagnosis: Diagnosis }) {
  const t = tone[diagnosis.tone]
  return (
    <GlassPanel className={cn('flex items-stretch gap-4 px-5 py-4', t.ring)}>
      <span className={cn('w-1 shrink-0 rounded-full', t.bar)} aria-hidden />
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
            Root-Cause Diagnostic // 根因诊断
          </span>
        </div>
        <h3 className={cn('mt-1 font-mono text-sm font-semibold tracking-wide', t.title)}>{diagnosis.title}</h3>
        <p className="mt-1.5 max-w-3xl text-[12px] leading-relaxed text-zinc-300">{diagnosis.detail}</p>
      </div>
    </GlassPanel>
  )
}
