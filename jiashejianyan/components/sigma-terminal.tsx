"use client"

import { useEffect, useMemo, useState } from "react"
import { ModuleSelector } from "@/components/module-selector"
import { ParameterPanel } from "@/components/parameter-panel"
import { VerdictHud } from "@/components/verdict-hud"
import { DistributionCurve } from "@/components/distribution-curve"
import { DensityOverlay } from "@/components/density-overlay"
import { VarianceBoxplot } from "@/components/variance-boxplot"
import { QQPlot } from "@/components/qq-plot"
import { RunChart } from "@/components/run-chart"
import { ExecutiveSummary } from "@/components/executive-summary"
import { parseSamples, tCritical, twoSampleT } from "@/lib/stats"
import type { TwoSampleResult } from "@/lib/stats"
import { Activity, Lock, ShieldCheck, AlertTriangle } from "lucide-react"

const DEFAULT_A = "25.02, 25.05, 24.99, 25.07, 25.04, 25.08, 25.03, 25.06, 25.01, 25.05"
const DEFAULT_B = "24.92, 24.95, 24.90, 24.97, 24.93, 24.89, 24.96, 24.91, 24.94, 24.88"

// Heavily-overlapping "twin" datasets used purely to PREVIEW the safe / fail-to-reject state.
const SAFE_A = "25.01, 25.04, 24.98, 25.06, 25.02, 25.05, 25.00, 25.03, 24.99, 25.04"
const SAFE_B = "25.00, 25.05, 24.97, 25.04, 25.03, 24.99, 25.06, 25.01, 24.98, 25.02"

export function SigmaTerminal() {
  const [module, setModule] = useState("2samp")
  const [alpha, setAlpha] = useState(0.05)
  const [sampleA, setSampleA] = useState(DEFAULT_A)
  const [sampleB, setSampleB] = useState(DEFAULT_B)
  const [flash, setFlash] = useState(false)
  const [previewSafe, setPreviewSafe] = useState(false)

  // when previewing the safe state, route twin datasets through the real engine
  const effectiveA = previewSafe ? SAFE_A : sampleA
  const effectiveB = previewSafe ? SAFE_B : sampleB

  const dataA = useMemo(() => parseSamples(effectiveA), [effectiveA])
  const dataB = useMemo(() => parseSamples(effectiveB), [effectiveB])

  const valid = dataA.length >= 2 && dataB.length >= 2

  const result = useMemo(() => {
    if (!valid) return null
    return twoSampleT(dataA, dataB, alpha)
  }, [dataA, dataB, alpha, valid])

  const critical = useMemo(
    () => (result ? tCritical(alpha, result.df) : 1.96),
    [result, alpha],
  )

  const h0 = "μ₁ = μ₂  ·  两模腔均值无差异"
  const h1 = "μ₁ ≠ μ₂  ·  两模腔均值存在差异"

  function handleGenerate() {
    setFlash(true)
    setTimeout(() => setFlash(false), 1400)
  }

  return (
    <div className="hud-screen hud-hex relative mx-auto flex min-h-screen max-w-[1560px] flex-col gap-4 p-3 sm:p-4 lg:p-5">
      {/* Header */}
      <header className="metal-panel flex flex-col gap-3 rounded-xl p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary glow-cyan">
            <Activity className="h-5 w-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <h1 className="text-lg font-bold tracking-wide text-foreground sm:text-xl">
              AXIOM SIGMA{" "}
              <span className="text-primary text-glow-cyan">统计推断引擎</span>
            </h1>
            <p className="font-num text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
              Statistical Inference Engine · 假设检验指挥舱
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center">
          <StatePreviewToggle safe={previewSafe} onToggle={setPreviewSafe} />
          <ForensicBadge seed={sampleA + sampleB + alpha} />
          <ModuleSelector active={module} onChange={setModule} />
        </div>
      </header>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        {/* Left */}
        <ParameterPanel
          h0={h0}
          h1={h1}
          alpha={alpha}
          sampleA={sampleA}
          sampleB={sampleB}
          nA={dataA.length}
          nB={dataB.length}
          reject={result?.reject ?? false}
          onAlpha={setAlpha}
          onSampleA={setSampleA}
          onSampleB={setSampleB}
        />

        {/* Center */}
        <div className="flex flex-col gap-4">
          {result ? (
            <>
              <VerdictHud
                pValue={result.pValue}
                alpha={alpha}
                reject={result.reject}
              />
              <TelemetryReadout result={result} critical={critical} />
            </>
          ) : (
            <div className="metal-panel flex flex-1 items-center justify-center rounded-2xl p-10 text-center">
              <p className="font-num text-sm text-muted-foreground">
                每个样本至少需要 2 个有效数据点
                <br />
                <span className="text-[11px] uppercase tracking-widest">
                  Awaiting valid data injection
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Right */}
        {result && (
          <ExecutiveSummary
            result={result}
            critical={critical}
            alpha={alpha}
            onGenerate={handleGenerate}
          />
        )}
      </div>

      {/* ===== EVIDENCE TELEMETRY MATRIX — BENTO BOX ===== */}
      <section className="relative flex flex-col gap-3">
          {/* animated PCB pipeline linking console to matrix */}
          <svg
            className="pointer-events-none absolute -top-4 left-0 h-4 w-full"
            viewBox="0 0 1000 24"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path className="pcb-trace" d="M120 0 L120 12 L500 12 L500 24" />
            <path className="pcb-trace" d="M500 0 L500 12 L500 24" />
            <path className="pcb-trace" d="M880 0 L880 12 L500 12 L500 24" />
            <circle className="pcb-node" cx="500" cy="20" r="3" />
          </svg>

          <header className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary glow-cyan" />
              <div className="flex flex-col leading-tight">
                <h2 className="text-base font-bold tracking-wide text-foreground">
                  审计证据矩阵
                </h2>
                <span className="font-num text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
                  Evidence Telemetry Matrix · 5-Dimensional Audit
                </span>
              </div>
            </div>
            <span className="font-num rounded bg-primary/10 px-2.5 py-1 text-[9px] uppercase tracking-widest text-primary">
              5 Visualizers Online
            </span>
          </header>

          {/* 60 / 40 asymmetrical bento grid */}
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.5fr_1fr]">
            {/* LEFT — Primary Core: split-pane probability stack */}
            <div className="evidence-slab flex flex-col rounded-xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-num text-primary/80">[</span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-bold tracking-wide text-foreground">
                      概率核心
                    </span>
                    <span className="font-num text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                      Probability Core · Split-Pane
                    </span>
                  </div>
                  <span className="font-num text-primary/80">]</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="h-2 w-2 rounded-full bg-[#FF6B81]" />
                </div>
              </div>

              {/* Top pane — T-Stat distribution */}
              <div className="flex flex-col gap-1">
                <span className="font-num text-[10px] font-bold uppercase tracking-tighter text-primary/90">
                  [ T-STAT DISTRIBUTION ]
                </span>
                <div className="recessed rounded-lg p-2">
                  {result ? (
                    <DistributionCurve
                      tStat={result.tStat}
                      df={result.df}
                      critical={critical}
                      reject={result.reject}
                      bare
                    />
                  ) : (
                    <EmptyChart variant="flatline" />
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="my-3 flex items-center gap-2">
                <span className="h-px flex-1 bg-white/5" />
                <span className="font-num text-[8px] uppercase tracking-[0.3em] text-muted-foreground/60">
                  Cross-Validation
                </span>
                <span className="h-px flex-1 bg-white/5" />
              </div>

              {/* Bottom pane — Real-World density overlay */}
              <div className="flex flex-col gap-1">
                <span className="font-num text-[10px] font-bold uppercase tracking-tighter text-primary/90">
                  [ REAL-WORLD DENSITY OVERLAY ]
                </span>
                <div className="recessed rounded-lg p-2">
                  {valid ? (
                    <DensityOverlay dataA={dataA} dataB={dataB} />
                  ) : (
                    <EmptyChart />
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT — Assumption Stack: server-rack of 3 readouts */}
            <div className="evidence-slab flex flex-col rounded-xl p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="font-num text-[10px] font-bold uppercase tracking-tighter text-foreground">
                  假设验证栈 · Assumption Stack
                </span>
                <span className="font-num text-[8px] uppercase tracking-widest text-primary">
                  RACK-03
                </span>
              </div>
              <div className="flex flex-1 flex-col divide-y divide-white/5">
                <RackUnit zh="方差齐性" en="Variance Homogeneity (Boxplot)">
                  {valid ? (
                    <VarianceBoxplot dataA={dataA} dataB={dataB} />
                  ) : (
                    <EmptyChart />
                  )}
                </RackUnit>
                <RackUnit zh="正态概率" en="Normality Probability (Q-Q)">
                  {valid ? <QQPlot dataA={dataA} dataB={dataB} /> : <EmptyChart />}
                </RackUnit>
                <RackUnit zh="过程稳定性" en="Process Stability (Run Chart)">
                  {valid ? (
                    <RunChart dataA={dataA} dataB={dataB} />
                  ) : (
                    <EmptyChart variant="flatline" />
                  )}
                </RackUnit>
              </div>
            </div>
          </div>
        </section>

      {flash && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/60 backdrop-blur-sm">
          <div className="glass glow-cyan flex items-center gap-3 rounded-xl px-6 py-4">
            <Activity className="h-5 w-5 animate-pulse text-primary" />
            <span className="font-num text-sm font-semibold text-primary">
              审计报告已生成 · AUDIT REPORT SEALED
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function StatePreviewToggle({
  safe,
  onToggle,
}: {
  safe: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!safe)}
      title="预览安全状态 / Preview SAFE state"
      className={`glow-cyan-hover recessed font-num flex items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
        safe
          ? "text-primary"
          : "text-[var(--warning)]"
      }`}
      style={
        safe
          ? {
              boxShadow:
                "0 0 0 1px oklch(0.82 0.14 200 / 0.6), 0 0 16px oklch(0.82 0.14 200 / 0.4)",
            }
          : undefined
      }
    >
      {safe ? (
        <ShieldCheck className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      )}
      {safe ? "SAFE PREVIEW" : "PREVIEW SAFE"}
    </button>
  )
}

function EmptyChart({ variant = "grid" }: { variant?: "grid" | "flatline" }) {
  return (
    <div className="relative flex min-h-[120px] w-full items-center justify-center overflow-hidden rounded-lg">
      <svg
        viewBox="0 0 240 120"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden
      >
        {/* faint pulsing grid */}
        <g className="animate-telemetry-breathe">
          {[24, 48, 72, 96].map((y) => (
            <line
              key={`h${y}`}
              x1="0"
              y1={y}
              x2="240"
              y2={y}
              stroke="oklch(0.82 0.14 200 / 0.18)"
              strokeWidth="0.5"
              strokeDasharray="2 6"
            />
          ))}
          {[40, 80, 120, 160, 200].map((x) => (
            <line
              key={`v${x}`}
              x1={x}
              y1="0"
              x2={x}
              y2="120"
              stroke="oklch(0.82 0.14 200 / 0.18)"
              strokeWidth="0.5"
              strokeDasharray="2 6"
            />
          ))}
        </g>
        {/* sweeping flatline */}
        <line
          x1="0"
          y1="60"
          x2="240"
          y2="60"
          stroke="oklch(0.82 0.14 200 / 0.5)"
          strokeWidth="1.25"
          className="animate-flatline"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/70" />
        <span className="font-num text-[9px] uppercase tracking-[0.25em] text-primary/60">
          Awaiting Telemetry
        </span>
        <span className="font-num text-[9px] tracking-wide text-muted-foreground/60">
          等待数据注入
        </span>
      </div>
    </div>
  )
}

function TelemetryReadout({
  result,
  critical,
}: {
  result: TwoSampleResult
  critical: number
}) {
  // Cohen's d (pooled) effect size
  const pooledSd =
    Math.sqrt((result.sdA ** 2 + result.sdB ** 2) / 2) || 1e-9
  const cohensD = Math.abs(result.diff) / pooledSd
  const effectLabel =
    cohensD >= 0.8 ? "LARGE" : cohensD >= 0.5 ? "MEDIUM" : "SMALL"
  const exceed = Math.abs(result.tStat) / critical

  const cells = [
    {
      zh: "效应量 Cohen's d",
      en: "Effect Size",
      value: cohensD.toFixed(2),
      tag: effectLabel,
    },
    {
      zh: "临界超越倍数",
      en: "Critical Exceedance",
      value: `${exceed.toFixed(1)}×`,
      tag: exceed >= 1 ? "BEYOND" : "WITHIN",
    },
    {
      zh: "标准误差",
      en: "Std. Error",
      value: (result.marginOfError / critical).toFixed(4),
      tag: "SE",
    },
    {
      zh: "Welch 自由度",
      en: "Welch df",
      value: result.df.toFixed(2),
      tag: "ν",
    },
  ]

  return (
    <div className="evidence-slab flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-wide text-foreground">
            实时遥测读数
          </span>
          <span className="font-num text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Live Telemetry Readout
          </span>
        </div>
        <span className="font-num flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Streaming
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cells.map((c) => (
          <div key={c.en} className="recessed flex flex-col gap-1 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-num text-[9px] uppercase tracking-wider text-muted-foreground">
                {c.en}
              </span>
              <span className="font-num rounded bg-primary/10 px-1.5 text-[8px] uppercase tracking-wider text-primary">
                {c.tag}
              </span>
            </div>
            <span className="font-num text-2xl font-bold tabular-nums text-foreground">
              {c.value}
            </span>
            <span className="text-[10px] text-muted-foreground">{c.zh}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RackUnit({
  zh,
  en,
  children,
}: {
  zh: string
  en: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 py-2.5 first:pt-1 last:pb-1">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          <span className="font-num text-[10px] font-bold uppercase tracking-tighter text-foreground">
            {zh}
          </span>
          <span className="font-num text-[8px] uppercase tracking-tighter text-muted-foreground">
            {en}
          </span>
        </div>
        <span className="font-num text-[8px] text-primary/70">●</span>
      </div>
      <div className="recessed flex flex-1 items-stretch rounded-lg p-2 [&>*]:w-full">
        {children}
      </div>
    </div>
  )
}

function ForensicBadge({ seed }: { seed: string }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hash = useMemo(() => {
    let h = 0x811c9dc5
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return (h >>> 0).toString(16).toUpperCase().padStart(8, "0")
  }, [seed])

  const stamp = now
    ? `${now.toISOString().slice(0, 10)} // ${now
        .toISOString()
        .slice(11, 19)} UTC`
    : "—— // ——:——:—— UTC"

  return (
    <div
      className="recessed flex items-center gap-3 rounded-md px-3 py-1.5"
      title="Forensic audit trail"
    >
      <div className="flex items-center gap-1.5">
        <Lock className="h-3 w-3 text-primary" />
        <span className="font-num text-[10px] tracking-wider text-primary">
          0x{hash.slice(0, 4)}…{hash.slice(-2)}
        </span>
      </div>
      <span className="h-3 w-px bg-border/60" />
      <span className="font-num text-[10px] tracking-wider text-muted-foreground tabular-nums">
        {stamp}
      </span>
    </div>
  )
}
