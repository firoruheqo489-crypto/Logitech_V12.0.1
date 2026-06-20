"use client"

import { cn } from "@/lib/utils"
import { StackedLabel } from "@/components/stacked-label"
import type { TwoSampleResult } from "@/lib/stats"
import { FileCheck2, Gavel, Sigma } from "lucide-react"

function DescriptiveRow({
  tone,
  tag,
  mean,
  sd,
}: {
  tone: "cyan" | "rose"
  tag: string
  mean: number
  sd: number
  n: number
}) {
  const accent = tone === "cyan" ? "text-primary" : "text-[var(--rose-gold)]"
  const tagBg =
    tone === "cyan"
      ? "bg-primary/15 text-primary"
      : "bg-[var(--rose-gold)]/15 text-[var(--rose-gold)]"
  const varc = sd * sd
  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5">
      <span
        className={cn(
          "font-num grid h-6 min-w-9 place-items-center rounded px-1 text-[11px] font-bold",
          tagBg,
        )}
      >
        {tag}
      </span>
      <span
        className={cn(
          "font-num text-right text-sm font-bold tabular-nums",
          accent,
        )}
      >
        {mean.toFixed(3)}
      </span>
      <span className="font-num text-right text-sm font-bold tabular-nums text-foreground/85">
        {sd.toFixed(3)}
      </span>
      <span className="font-num text-right text-sm font-bold tabular-nums text-foreground/70">
        {varc.toFixed(4)}
      </span>
    </div>
  )
}

export function ExecutiveSummary({
  result,
  critical,
  alpha,
  onGenerate,
}: {
  result: TwoSampleResult
  critical: number
  alpha: number
  onGenerate: () => void
}) {
  const reject = result.reject

  const metrics = [
    {
      zh: "T 检验统计量",
      en: "T-Value",
      value: result.tStat.toFixed(4),
    },
    {
      zh: "自由度",
      en: "Degrees of Freedom",
      value: result.df.toFixed(2),
    },
    {
      zh: "临界值",
      en: "Critical Value ±",
      value: `±${critical.toFixed(3)}`,
    },
    {
      zh: "均值差",
      en: "Mean Difference",
      value: result.diff.toFixed(4),
    },
    {
      zh: `${((1 - alpha) * 100).toFixed(0)}% 置信区间`,
      en: "Confidence Interval",
      value: `[${result.ciLow.toFixed(3)}, ${result.ciHigh.toFixed(3)}]`,
    },
  ]

  return (
    <section
      className="mech-frame glass relative flex flex-col gap-5 rounded-2xl p-5"
      style={
        {
          "--bracket": "oklch(0.78 0.08 45 / 0.7)",
          boxShadow:
            "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 30px oklch(0.78 0.08 45 / 0.05), 0 24px 60px -24px oklch(0 0 0 / 0.8)",
        } as React.CSSProperties
      }
    >
      <span className="mech-corners pointer-events-none absolute inset-0" />
      <header className="flex items-center gap-3 border-b border-border/60 pb-4">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--rose-gold)]/12 text-[var(--rose-gold)]">
          <Gavel className="h-4 w-4" />
        </span>
        <StackedLabel zh="行政裁决书" en="Executive Summary" size="lg" />
      </header>

      {/* Descriptive statistics matrix — data foundation */}
      <div className="recessed flex flex-col gap-3 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Sigma className="h-3.5 w-3.5 text-muted-foreground" />
          <StackedLabel zh="描述性统计" en="Descriptive Statistics" size="sm" />
        </div>

        {/* column headers */}
        <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2.5 border-b border-border/40 pb-1.5">
          <span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">
            Src
          </span>
          <span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">
            X̄ Mean
          </span>
          <span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">
            s StDev
          </span>
          <span className="font-num text-right text-[10px] uppercase tracking-widest text-muted-foreground">
            s² Var
          </span>
        </div>

        <DescriptiveRow
          tone="cyan"
          tag="X̄₁"
          mean={result.meanA}
          sd={result.sdA}
          n={result.nA}
        />
        <DescriptiveRow
          tone="rose"
          tag="X̄₂"
          mean={result.meanB}
          sd={result.sdB}
          n={result.nB}
        />
      </div>

      <dl className="flex flex-col">
        {metrics.map((m, i) => (
          <div
            key={m.en}
            className={cn(
              "flex items-center justify-between gap-3 py-3",
              i !== metrics.length - 1 && "border-b border-border/40",
            )}
          >
            <dt className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-foreground">
                {m.zh}
              </span>
              <span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">
                {m.en}
              </span>
            </dt>
            <dd className="font-num text-sm font-bold tabular-nums text-foreground">
              {m.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Conclusion block */}
      <div
        className="rounded-xl p-4"
        style={{
          background: reject
            ? "oklch(0.7 0.24 25 / 0.1)"
            : "oklch(0.82 0.14 200 / 0.08)",
          boxShadow: reject
            ? "inset 0 0 0 1px oklch(0.7 0.24 25 / 0.45)"
            : "inset 0 0 0 1px oklch(0.82 0.14 200 / 0.4)",
        }}
      >
        <div className="mb-2 flex items-center gap-2">
          <FileCheck2
            className={cn(
              "h-4 w-4",
              reject ? "text-[var(--warning)]" : "text-primary",
            )}
          />
          <StackedLabel zh="审计结论" en="Audit Conclusion" size="sm" />
        </div>
        <p
          className={cn(
            "font-num text-sm font-medium leading-relaxed",
            reject ? "text-[var(--warning)]" : "text-primary",
          )}
        >
          {reject
            ? `P = ${result.pValue < 0.0001 ? "< 0.0001" : result.pValue.toFixed(4)} < ${alpha.toFixed(2)}。存在统计学显著差异。拒绝原假设 H0。两模腔尺寸不一致，需启动工艺纠正。`
            : `P = ${result.pValue.toFixed(4)} ≥ ${alpha.toFixed(2)}。无统计学显著差异。无法拒绝原假设 H0。两模腔尺寸视为受控。`}
        </p>
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={onGenerate}
        className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-xl px-5 py-4 transition-transform active:translate-y-px"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.3 0.018 250), oklch(0.2 0.014 250))",
          boxShadow:
            "inset 0 1px 0 oklch(0.7 0.02 240 / 0.25), inset 0 -2px 4px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 24px -8px oklch(0.82 0.14 200 / 0.5)",
        }}
      >
        <FileCheck2 className="h-5 w-5 text-primary" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-sm font-bold tracking-wide text-foreground">
            生成最终审计报告
          </span>
          <span className="font-num text-[10px] uppercase tracking-[0.2em] text-primary">
            Generate Audit Report
          </span>
        </span>
      </button>
    </section>
  )
}
