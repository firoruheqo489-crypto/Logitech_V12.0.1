'use client'

import { useMemo, useState } from 'react'
import { Activity, RotateCcw, Crosshair, Printer } from 'lucide-react'
import { buildDefaultStudy, computeGrr, resizeStudy, type StudyConfig } from '@/lib/gage-rnr'
import { GlassPanel } from '@/components/glass-panel'
import { MetadataHeader, type StudyMeta } from '@/components/metadata-header'
import { ControlPanel } from '@/components/control-panel'
import { KpiDeck } from '@/components/kpi-deck'
import { DiagnosticBanner } from '@/components/diagnostic-banner'
import { SummaryTable } from '@/components/summary-table'
import { VariationPanel } from '@/components/variation-panel'
import { AnovaTable } from '@/components/anova-table'
import { RunChart } from '@/components/run-chart'
import { InteractionPlot } from '@/components/interaction-plot'
import { ControlChartView } from '@/components/control-chart'
import { AppraiserSpread } from '@/components/appraiser-spread'
import { DataMatrix } from '@/components/data-matrix'

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

export default function Page() {
  const [cfg, setCfg] = useState<StudyConfig>(() => buildDefaultStudy())
  const results = useMemo(() => computeGrr(cfg), [cfg])

  const [meta, setMeta] = useState<StudyMeta>(() => ({
    partName: '',
    characteristic: '',
    gageId: '',
    date: new Date().toISOString().slice(0, 10),
  }))
  const updateMeta = (patch: Partial<StudyMeta>) => setMeta((prev) => ({ ...prev, ...patch }))

  const updateCell = (operator: number, part: number, trial: number, value: number) => {
    setCfg((prev) => {
      const measurements = prev.measurements.map((op, o) =>
        o === operator
          ? op.map((pt, p) => (p === part ? pt.map((v, t) => (t === trial ? value : v)) : pt))
          : op,
      )
      return { ...prev, measurements }
    })
  }

  const setDims = (dims: { operators?: number; parts?: number; trials?: number }) =>
    setCfg((prev) => resizeStudy(prev, dims))
  const setSpec = (spec: { usl?: number; lsl?: number; historicalSigma?: number; alpha?: number }) =>
    setCfg((prev) => ({ ...prev, ...spec }))
  const reset = () => setCfg(buildDefaultStudy())

  const pill = verdictPill[results.verdict]

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-950 text-zinc-100">
      {/* faint refraction surface behind the glass */}
      <div aria-hidden className="no-print pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-[-10%] h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-[140px]" />
        <div className="absolute right-[-10%] top-1/3 h-[460px] w-[460px] rounded-full bg-indigo-500/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] left-1/3 h-[420px] w-[420px] rounded-full bg-emerald-500/[0.07] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* Command bar */}
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
                  Measurement System Analysis · 测量系统分析指挥中心
                </p>
              </div>
            </div>

            <div className="no-print flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sky-300 transition-colors hover:border-sky-400/60 hover:bg-sky-400/20"
              >
                <Printer className="h-3.5 w-3.5" />
                Export Report
                <span className="font-medium normal-case tracking-normal text-sky-200/70">导出报告</span>
              </button>
              <button
                onClick={reset}
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-300 transition-colors hover:border-sky-400/40 hover:text-sky-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Study
              </button>
            </div>
          </GlassPanel>
        </header>

        {/* ============================ ZONE 0 ============================ */}
        {/* STUDY METADATA — traceability header for audit / export */}
        <section className="mb-8">
          <MetadataHeader meta={meta} onChange={updateMeta} />
        </section>

        {/* ============================ ZONE 1 ============================ */}
        {/* THE DATA BOARD — numbers & diagnostics only, no charts */}
        <section className="mb-10">
          <ZoneLabel index={1} title="Data Board" zh="数据中枢" />
          <div className="space-y-4">
            <ControlPanel cfg={cfg} onDims={setDims} onSpec={setSpec} />
            <KpiDeck results={results} />
            <DiagnosticBanner diagnosis={results.diagnosis} />
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

        {/* ============================ ZONE 2 ============================ */}
        {/* DIAGNOSTIC VISUALIZATIONS — all charts */}
        <section className="mb-10">
          <ZoneLabel index={2} title="Diagnostic Visualizations" zh="诊断视图" />
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

        {/* ============================ ZONE 3 ============================ */}
        {/* DATA ACQUISITION MATRIX — hidden during print to save report space */}
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
}
