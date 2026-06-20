import { GlassPanel } from './glass-panel'
import { cn } from '@/lib/utils'
import type { GrrResults, Verdict } from './gage-rnr'

type Tone = 'good' | 'warn' | 'fail' | 'brand' | 'neutral'

const toneText: Record<Tone, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  fail: 'text-rose-400',
  brand: 'text-sky-400',
  neutral: 'text-zinc-50',
}
const toneDot: Record<Tone, string> = {
  good: 'bg-emerald-400 shadow-[0_0_12px] shadow-emerald-400/60',
  warn: 'bg-amber-400 shadow-[0_0_12px] shadow-amber-400/60',
  fail: 'bg-rose-400 shadow-[0_0_12px] shadow-rose-400/60',
  brand: 'bg-sky-400 shadow-[0_0_12px] shadow-sky-400/60',
  neutral: 'bg-zinc-400',
}

function verdictTone(v: Verdict): Tone {
  return v === 'acceptable' ? 'good' : v === 'marginal' ? 'warn' : 'fail'
}

function KpiCard({
  label,
  labelZh,
  value,
  unit,
  tone = 'neutral',
  sub,
}: {
  label: string
  labelZh: string
  value: string
  unit?: string
  tone?: Tone
  sub?: string
}) {
  return (
    <GlassPanel className="px-5 py-4">
      <div className="flex items-center gap-2">
        <span className={cn('h-1.5 w-1.5 rounded-full', toneDot[tone])} />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-200">{label}</span>
      </div>
      <p className="mt-0.5 text-[11px] font-medium text-zinc-400">{labelZh}</p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={cn('font-mono text-3xl font-semibold tabular-nums', toneText[tone])}>{value}</span>
        {unit ? <span className="font-mono text-sm text-zinc-400">{unit}</span> : null}
      </div>
      {sub ? <p className="mt-1.5 text-[11px] text-zinc-400">{sub}</p> : null}
    </GlassPanel>
  )
}

const verdictCopy: Record<Verdict, string> = {
  acceptable: 'SYSTEM ACCEPTABLE',
  marginal: 'CONDITIONAL',
  unacceptable: 'SYSTEM REJECTED',
}

export function KpiDeck({ results }: { results: GrrResults }) {
  const vTone = verdictTone(results.verdict)
  const ndcTone: Tone = results.ndc >= 5 ? 'good' : results.ndc >= 2 ? 'warn' : 'fail'
  const tolTone: Tone =
    results.pctGrrTolerance > 30 ? 'fail' : results.pctGrrTolerance >= 10 ? 'warn' : 'good'

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        label="System Verdict"
        labelZh="系统判定"
        value={verdictCopy[results.verdict]}
        tone={vTone}
        sub="AIAG MSA-4 criteria"
      />
      <KpiCard
        label="% Gage R&R (Study Var)"
        labelZh="% 研究变差"
        value={results.pctGrrStudyVar.toFixed(2)}
        unit="%"
        tone={vTone}
        sub="Target < 10% · Reject > 30%"
      />
      <KpiCard
        label="% Gage R&R (Tolerance)"
        labelZh="% 公差"
        value={results.pctGrrTolerance.toFixed(2)}
        unit="%"
        tone={tolTone}
        sub="6σ GRR vs. tolerance band"
      />
      <KpiCard
        label="NDC"
        labelZh="可区分的类别数"
        value={String(results.ndc)}
        tone={ndcTone}
        sub="Target ≥ 5 resolvable groups"
      />
    </div>
  )
}
