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
const tonePanel: Record<Tone, string> = {
  good: 'border-emerald-400/15 bg-emerald-400/[0.03]',
  warn: 'border-amber-400/15 bg-amber-400/[0.03]',
  fail: 'border-rose-400/15 bg-rose-400/[0.03]',
  brand: 'border-sky-400/15 bg-sky-400/[0.03]',
  neutral: 'border-white/[0.08] bg-white/[0.03]',
}
const toneBadge: Record<Tone, string> = {
  good: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  warn: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  fail: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  brand: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  neutral: 'border-white/[0.10] bg-white/[0.04] text-zinc-300',
}

function verdictTone(v: Verdict): Tone {
  return v === 'acceptable' ? 'good' : v === 'marginal' ? 'warn' : 'fail'
}

export function getVerdictCopy(verdict: Verdict) {
  if (verdict === 'acceptable') return 'SYSTEM ACCEPTABLE'
  if (verdict === 'marginal') return 'CONDITIONAL'
  return 'SYSTEM REJECTED'
}

function getContributionTone(value: number): Tone {
  if (value >= 30) return 'fail'
  if (value >= 10) return 'warn'
  return 'good'
}

function buildComponentConclusion(kind: 'EV' | 'AV' | 'PV', value: number) {
  if (kind === 'PV') {
    if (value >= 70) return '零件差异充分，系统分辨力良好'
    if (value >= 40) return '零件差异可见，建议继续验证'
    return '零件差异偏弱，系统分辨力不足'
  }

  if (kind === 'EV') {
    if (value < 10) return '重复性良好'
    if (value < 30) return '重复性可接受'
    return '重复性偏高，需检查量具'
  }

  if (value < 10) return '再现性良好'
  if (value < 30) return '再现性可接受'
  return '再现性偏高，需统一测量标准'
}

function KpiCard({
  code,
  label,
  labelZh,
  value,
  unit,
  tone = 'neutral',
  sub,
  basis,
}: {
  code: string
  label: string
  labelZh: string
  value: string
  unit?: string
  tone?: Tone
  sub?: string
  basis: string
}) {
  return (
    <GlassPanel className={cn('px-4 py-3', tonePanel[tone])}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-1.5 w-1.5 rounded-full', toneDot[tone])} />
          <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em]', toneBadge[tone])}>
            {code}
          </span>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className={cn('h-1.5 w-1.5 rounded-full', toneDot[tone])} />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-200">{label}</span>
      </div>
      <p className="mt-0.5 text-[11px] font-medium text-zinc-400">{labelZh}</p>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className={cn('font-mono text-[48px] font-semibold leading-none tabular-nums', toneText[tone])}>{value}</span>
        {unit ? <span className="font-mono text-sm text-zinc-400">{unit}</span> : null}
      </div>
      {sub ? <p className="mt-1 text-[11px] leading-5 text-zinc-300">{sub}</p> : null}
      <div className="mt-3 border-t border-white/[0.06] pt-2.5">
        <div className="text-[10px] font-semibold tracking-[0.12em] text-zinc-500">判定依据</div>
        <p className="mt-1 text-[10px] leading-5 text-zinc-400">{basis}</p>
      </div>
    </GlassPanel>
  )
}

export function KpiDeck({ results }: { results: GrrResults }) {
  const ev = results.components.find((item) => item.key === 'EV')
  const av = results.components.find((item) => item.key === 'AV')
  const pv = results.components.find((item) => item.key === 'PV')
  const isSingleAppraiser = results.interactionSeries.length === 1
  const ndcTone: Tone = results.ndc >= 5 ? 'good' : results.ndc >= 2 ? 'warn' : 'fail'
  const grrTone: Tone =
    results.pctGrrStudyVar > 30 ? 'fail' : results.pctGrrStudyVar >= 10 ? 'warn' : 'good'
  const evTone: Tone = getContributionTone(ev?.pctStudyVar ?? 0)
  const avTone: Tone = getContributionTone(av?.pctStudyVar ?? 0)
  const pvTone: Tone = (pv?.pctStudyVar ?? 0) >= 70 ? 'good' : (pv?.pctStudyVar ?? 0) >= 40 ? 'warn' : 'fail'

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        code="GRR"
        label="Measurement System"
        labelZh="量测系统总变差"
        value={results.pctGrrStudyVar.toFixed(2)}
        unit="%"
        tone={grrTone}
        sub={results.pctGrrStudyVar < 10 ? '总变差可接受' : results.pctGrrStudyVar < 30 ? '总变差有条件接受' : '总变差过高'}
        basis="%Study Var < 10% 为优，10%–30% 需结合场景判断，>30% 通常不可接受"
      />
      <KpiCard
        code="EV"
        label="Repeatability (EV)"
        labelZh="设备变差（重复性）"
        value={(ev?.pctStudyVar ?? 0).toFixed(2)}
        unit="%"
        tone={evTone}
        sub={buildComponentConclusion('EV', ev?.pctStudyVar ?? 0)}
        basis="重复性反映同一评价人对同一零件重复测量的波动，越低越好"
      />
      <KpiCard
        code="AV"
        label="Reproducibility (AV)"
        labelZh="评价人变差（再现性）"
        value={isSingleAppraiser ? '--' : (av?.pctStudyVar ?? 0).toFixed(2)}
        unit={isSingleAppraiser ? undefined : '%'}
        tone={isSingleAppraiser ? 'neutral' : avTone}
        sub={isSingleAppraiser ? '单评价人模式下不计算再现性' : buildComponentConclusion('AV', av?.pctStudyVar ?? 0)}
        basis={isSingleAppraiser ? '当前仅分析单个评价人的重复性，不比较不同评价人之间的一致性差异' : '再现性反映不同评价人之间的一致性差异，越低越好'}
      />
      <KpiCard
        code="PV"
        label="Part Variation (PV)"
        labelZh="零件变差"
        value={(pv?.pctStudyVar ?? 0).toFixed(2)}
        unit="%"
        tone={pvTone}
        sub={buildComponentConclusion('PV', pv?.pctStudyVar ?? 0)}
        basis="零件变差越充分，越能说明系统有能力把不同零件区分开"
      />
      <KpiCard
        code="NDC"
        label="NDC"
        labelZh="可区分的类别数"
        value={String(results.ndc)}
        tone={ndcTone}
        sub={isSingleAppraiser ? '单人模式下仅作参考' : results.ndc >= 5 ? '分辨力充足' : results.ndc >= 2 ? '分辨力偏弱' : '分辨力不足'}
        basis={isSingleAppraiser ? '当前以单评价人重复性分析为主，NDC 仅作为辅助参考，不作为再现性判断依据' : 'NDC ≥ 5 通常认为量测系统具备足够的分类分辨能力'}
      />
    </div>
  )
}
