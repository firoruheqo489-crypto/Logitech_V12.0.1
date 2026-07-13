'use client'

import { useMemo, useState } from 'react'
import type { BatteryDataset } from '@/lib/battery-data'
import { KpiRow } from './kpi-row'
import { MicroChart } from './micro-chart'
import { MacroChart } from './macro-chart'
import { StatsGrid } from './stats-grid'

const glassCard = 'glass-panel p-6'

export function BatteryDashboard({ dataset }: { dataset: BatteryDataset }) {
  const cycles = useMemo(
    () => [...new Set(dataset.timeSeries.map((p) => p.cycle))].sort((a, b) => a - b),
    [dataset.timeSeries],
  )
  const [selectedCycle, setSelectedCycle] = useState(cycles[0] ?? 1)

  const cycleData = useMemo(
    () => dataset.timeSeries.filter((p) => p.cycle === selectedCycle),
    [dataset.timeSeries, selectedCycle],
  )

  return (
    <main className="app-bg min-h-screen px-4 py-6 text-foreground lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        {/* 顶栏 */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] pb-4">
          <h1 className="font-mono text-sm font-medium tracking-[0.2em] text-[#E8B84B] lg:text-base">
            {'[ '}{dataset.meta.deviceLabel}{' // PARSING ENGINE ACTIVE ]'}
          </h1>
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-slate-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#E8B84B] shadow-[0_0_8px_rgba(232,184,75,0.8)]" aria-hidden="true" />
            {'XLSX INGESTED · '}{dataset.meta.sampleCount.toLocaleString()}{' SAMPLES · '}
            {dataset.meta.cycleCount}{' CYCLES'}
          </div>
        </header>

        {/* Alpha KPI 行 */}
        <KpiRow meta={dataset.meta} />

        {/* 非对称图表矩阵 */}
        <div className="grid w-full grid-cols-12 gap-6">
          <section className={`col-span-12 lg:col-span-8 ${glassCard}`} aria-label="单循环电压电流曲线">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-mono text-xs tracking-[0.2em] text-slate-400">
                {'// MICRO-TELEMETRY: V/I CURVE (SINGLE CYCLE)'}
              </h2>
              <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="选择循环">
                {cycles.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={c === selectedCycle}
                    onClick={() => setSelectedCycle(c)}
                    className={`rounded-md px-2 py-1 font-mono text-[10px] transition-colors ${
                      c === selectedCycle
                        ? 'bg-[#E8B84B]/12 text-[#E8B84B] shadow-[0_0_12px_rgba(232,184,75,0.25)]'
                        : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {String(c).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
            <MicroChart data={cycleData} />
            <div className="mt-3 flex gap-6 font-mono text-[10px] text-slate-500">
              <span className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-5 bg-[#E8B84B]" aria-hidden="true" />
                {'电压 VOLTAGE (V)'}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-0.5 w-5"
                  style={{ backgroundImage: 'linear-gradient(90deg, #475569 60%, transparent 60%)', backgroundSize: '6px 100%' }}
                  aria-hidden="true"
                />
                {'电流 CURRENT (A)'}
              </span>
            </div>
          </section>

          <section className={`col-span-12 lg:col-span-4 ${glassCard}`} aria-label="容量衰减趋势">
            <h2 className="mb-4 font-mono text-xs tracking-[0.2em] text-slate-400">
              {'// MACRO-DEGRADATION: CAPACITY FADE (SOH)'}
            </h2>
            <MacroChart data={dataset.cycleStats} initialCap={dataset.meta.initialCap} />
          </section>
        </div>

        {/* 循环统计矩阵 */}
        <section className={glassCard} aria-label="循环统计矩阵">
          <h2 className="mb-4 font-mono text-xs tracking-[0.2em] text-slate-400">
            {'// CYCLE STATISTICS MATRIX'}
          </h2>
          <StatsGrid data={dataset.cycleStats} />
        </section>
      </div>
    </main>
  )
}
