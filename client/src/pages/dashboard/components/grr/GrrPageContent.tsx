'use client'

import { forwardRef, useMemo } from 'react'
import { Activity, RotateCcw, Crosshair, Printer, Download } from 'lucide-react'
import { computeGrr, resizeStudy, type StudyConfig } from './gage-rnr'
import { GlassPanel, PanelHeader } from './glass-panel'
import { MetadataHeader, type StudyMeta } from './metadata-header'
import { ControlPanel } from './control-panel'
import { getVerdictCopy, KpiDeck } from './kpi-deck'
import { SummaryTable } from './summary-table'
import { VariationPanel } from './variation-panel'
import { AnovaTable } from './anova-table'
import { RunChart } from './run-chart'
import { InteractionPlot } from './interaction-plot'
import { ControlChartView } from './control-chart'
import { AppraiserSpread } from './appraiser-spread'
import { DataMatrix } from './data-matrix'

const verdictPill: Record<string, { text: string; cls: string }> = {
  acceptable: { text: 'OPERATIONAL', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  marginal: { text: 'CONDITIONAL', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  unacceptable: { text: 'OUT OF SPEC', cls: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
}

function ZoneLabel({ index, title, zh }: { index: number; title: string; zh: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] font-mono text-[11px] font-semibold text-sky-400">
        {index}
      </span>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-100">{title}</h2>
      <span className="text-[11px] font-medium tracking-wide text-zinc-400">{zh}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </div>
  )
}

function buildChineseConclusion(results: ReturnType<typeof computeGrr>) {
  const ev = results.components.find((item) => item.key === 'EV')
  const av = results.components.find((item) => item.key === 'AV')
  const pv = results.components.find((item) => item.key === 'PV')
  const dominant = [
    { key: 'EV', label: '设备变差', value: ev?.pctStudyVar ?? 0 },
    { key: 'AV', label: '评价人变差', value: av?.pctStudyVar ?? 0 },
    { key: 'PV', label: '零件变差', value: pv?.pctStudyVar ?? 0 },
  ].sort((left, right) => right.value - left.value)[0]

  if (results.diagnosis.code === 'OPTIMAL') {
    return {
      headline: '测量系统合格，可用于生产数据采集',
      detail: `当前测量系统可直接用于现场量测与过程监控，GRR 总变差为 ${results.pctGrrStudyVar.toFixed(1)}%，公差占比为 ${results.pctGrrTolerance.toFixed(1)}%，NDC 为 ${results.ndc}，且${dominant.label}占主导，说明系统分辨能力充足。`,
    }
  }

  if (results.diagnosis.code === 'AV_DOMINANT') {
    return {
      headline: '测量系统暂不建议直接放行使用',
      detail: `当前测量系统需先整改后再复评，GRR 总变差为 ${results.pctGrrStudyVar.toFixed(1)}%，公差占比为 ${results.pctGrrTolerance.toFixed(1)}%，NDC 为 ${results.ndc}，其中评价人变差占比约 ${(av?.pctStudyVar ?? 0).toFixed(1)}%，说明不同评价人之间一致性不足。`,
    }
  }

  return {
    headline: '测量系统暂不建议直接放行使用',
    detail: `当前测量系统需先整改后再复评，GRR 总变差为 ${results.pctGrrStudyVar.toFixed(1)}%，公差占比为 ${results.pctGrrTolerance.toFixed(1)}%，NDC 为 ${results.ndc}，其中设备变差占比约 ${(ev?.pctStudyVar ?? 0).toFixed(1)}%，说明重复性不足，应优先检查量具与测量稳定性。`,
  }
}

function getVerdictLabelZh(verdict: ReturnType<typeof computeGrr>['verdict']) {
  if (verdict === 'acceptable') return '测量系统可接受'
  if (verdict === 'marginal') return '测量系统有条件接受'
  return '测量系统不可接受'
}

type GrrPageContentProps = {
  cfg: StudyConfig
  meta: StudyMeta
  onMetaChange: (patch: Partial<StudyMeta>) => void
  onCfgChange: (updater: (prev: StudyConfig) => StudyConfig) => void
  onReset: () => void
  onPrint: () => void
  onExportPdf: () => void
  isPrinting?: boolean
  isExportingPdf?: boolean
}

const GrrPageContent = forwardRef<HTMLElement, GrrPageContentProps>(function GrrPageContent({
  cfg,
  meta,
  onMetaChange,
  onCfgChange,
  onReset,
  onPrint,
  onExportPdf,
  isPrinting = false,
  isExportingPdf = false,
}, ref) {
  const results = useMemo(() => computeGrr(cfg), [cfg])

  const updateCell = (operator: number, part: number, trial: number, value: number) => {
    onCfgChange((prev) => {
      const measurements = prev.measurements.map((op, o) =>
        o === operator
          ? op.map((pt, p) => (p === part ? pt.map((v, t) => (t === trial ? value : v)) : pt))
          : op,
      )
      return { ...prev, measurements }
    })
  }

  const setDims = (dims: { operators?: number; parts?: number; trials?: number }) =>
    onCfgChange((prev) => resizeStudy(prev, dims))
  const setSpec = (spec: { usl?: number; lsl?: number; historicalSigma?: number; alpha?: number }) =>
    onCfgChange((prev) => ({ ...prev, ...spec }))

  const pill = verdictPill[results.verdict]
  const verdictCopy = getVerdictCopy(results.verdict)
  const verdictLabelZh = getVerdictLabelZh(results.verdict)
  const conclusion = buildChineseConclusion(results)
  const verdictToneClass =
    results.verdict === 'acceptable'
      ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300'
      : results.verdict === 'marginal'
        ? 'border-amber-400/25 bg-amber-400/[0.08] text-amber-300'
        : 'border-rose-400/25 bg-rose-400/[0.08] text-rose-300'

  return (
    <main
      ref={ref}
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-950 text-zinc-100"
    >
      <div aria-hidden className="no-print pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-[-10%] h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-[140px]" />
        <div className="absolute right-[-10%] top-1/3 h-[460px] w-[460px] rounded-full bg-indigo-500/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] left-1/3 h-[420px] w-[420px] rounded-full bg-emerald-500/[0.07] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8">
          <GlassPanel className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10">
                <Crosshair className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-mono text-sm font-semibold tracking-wider text-zinc-50">GRR_AERO</h1>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider ${pill.cls}`}>
                    {pill.text}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] uppercase tracking-widest text-zinc-400">
                  Measurement System Analysis · 测量系统分析
                </p>
              </div>
            </div>

            <div data-grr-report-toolbar className="no-print flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={onPrint}
                disabled={isPrinting || isExportingPdf}
                className="flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sky-300 transition-colors hover:border-sky-400/60 hover:bg-sky-400/20"
              >
                <Printer className="h-3.5 w-3.5" />
                {isPrinting ? '处理中...' : '打印预览'}
              </button>
              <button
                onClick={onExportPdf}
                disabled={isPrinting || isExportingPdf}
                className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-300 transition-colors hover:border-emerald-400/60 hover:bg-emerald-400/20"
              >
                <Download className="h-3.5 w-3.5" />
                {isExportingPdf ? '导出中...' : '导出 PDF'}
                <span className="font-medium normal-case tracking-normal text-emerald-200/70">A4 报告</span>
              </button>
              <button
                onClick={onReset}
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-300 transition-colors hover:border-sky-400/40 hover:text-sky-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Study
              </button>
            </div>
          </GlassPanel>
        </header>

        <section className="mb-10">
          <ZoneLabel index={1} title="Data Board" zh="数据中枢" />
          <div className="space-y-4">
            <MetadataHeader meta={meta} onChange={onMetaChange} />
            <ControlPanel cfg={cfg} onDims={setDims} onSpec={setSpec} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SummaryTable results={results} />
              </div>
              <div className="lg:col-span-1">
                <VariationPanel results={results} />
              </div>
            </div>
            <AnovaTable results={results} />
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-4">
            <GlassPanel className="overflow-hidden border-white/[0.08] bg-white/[0.03]">
              <PanelHeader
                title="Measurement System Verdict"
                zh="量测系统判定"
                right={
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.18em] ${verdictToneClass}`}>
                    {verdictCopy}
                  </span>
                }
              />
              <div className="grid gap-4 px-5 py-4 lg:h-[520px] lg:grid-rows-[35fr_65fr]">
                <div className="min-h-0 flex items-stretch">
                  <KpiDeck results={results} />
                </div>
                <div className="min-h-0 pt-20">
                  <GlassPanel className="flex h-full flex-col border-emerald-400/15 bg-emerald-400/[0.04] px-5 py-5">
                    <div className="text-[11px] font-semibold tracking-[0.16em] text-zinc-200">系统结论</div>
                    <div className="mt-4 text-[22px] font-bold leading-tight text-emerald-300">
                      {conclusion.headline}
                    </div>
                    <p className="mt-5 text-[15px] leading-8 text-zinc-200">
                      {conclusion.detail}
                    </p>
                  </GlassPanel>
                </div>
              </div>
            </GlassPanel>
          </div>
          <ZoneLabel index={2} title="Data Views" zh="数据视图" />
          <div className="space-y-4">
            <RunChart results={results} cfg={cfg} />
            <InteractionPlot results={results} cfg={cfg} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ControlChartView
                title="X̄ Chart"
                zh="零件均值图 (X-bar)"
                subtitle="Subgroup means by appraiser · points beyond limits = good resolution"
                chart={results.xbarChart}
                operatorNames={cfg.operatorNames}
                accent="#38bdf8"
              />
              <ControlChartView
                title="R Chart"
                zh="极差控制图 (Range)"
                subtitle="Within-trial ranges · all points should stay in control"
                chart={results.rChart}
                operatorNames={cfg.operatorNames}
                accent="#fbbf24"
              />
            </div>
            <AppraiserSpread results={results} cfg={cfg} />
          </div>
        </section>

        <section className="no-print">
          <ZoneLabel index={3} title="Data Acquisition Matrix" zh="数据采集矩阵" />
          <DataMatrix cfg={cfg} onChange={updateCell} />
        </section>

        <footer className="mt-8 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400">
          <Activity className="h-3 w-3" />
          Local compute · no telemetry · 本地计算 · 无数据上传
        </footer>
      </div>
    </main>
  )
})

export default GrrPageContent
