"use client"

import { cn } from "@/lib/utils"
import {
  formatNumber,
  TARGET_WARRANTY_YEARS,
  type ArrheniusResult,
} from "@/lib/arrhenius"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"

interface ExecutiveMetricsProps {
  result: ArrheniusResult
}

function MetricCard({
  tag,
  titleZh,
  titleEn,
  trend,
  children,
  footer,
}: {
  tag: string
  titleZh: string
  titleEn: string
  trend?: { dir: "up" | "down"; value: string; tone: "cyan" | "red" }
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="glass-panel metal-edge lux-grid group relative flex flex-col overflow-hidden rounded-2xl px-5 py-5">
      {/* 顶部装饰金线 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-rose-gold)]/60 to-transparent" />

      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {titleZh}
          </h3>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            {titleEn}
          </p>
        </div>
        <span className="metal-edge brushed-metal rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[var(--color-rose-gold)]">
          {tag}
        </span>
      </div>

      <div className="mt-5 flex flex-1 items-end justify-between gap-2">
        <div>{children}</div>
        {trend && (
          <div
            className={cn(
              "mb-1 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold",
              trend.tone === "cyan"
                ? "text-glow-cyan bg-[var(--color-sapphire)]/10"
                : "text-glow-red bg-destructive/10",
            )}
          >
            {trend.dir === "up" ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {trend.value}
          </div>
        )}
      </div>

      {footer && (
        <div className="mt-4 border-t border-border/50 pt-3">{footer}</div>
      )}
    </div>
  )
}

export function ExecutiveMetrics({ result }: ExecutiveMetricsProps) {
  const { af, projectedHours, projectedYears } = result
  const warrantyRisk = projectedYears < TARGET_WARRANTY_YEARS

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* 卡片 A: 加速因子 */}
      <MetricCard
        tag="ACCEL"
        titleZh="物理加速倍率"
        titleEn="Acceleration Factor"
        trend={{ dir: "up", value: "ACTIVE", tone: "cyan" }}
        footer={
          <p className="font-mono text-[11px] text-muted-foreground">
            阿伦尼乌斯模型实时解算 · White-box
          </p>
        }
      >
        <div className="flex items-baseline gap-0.5">
          <span className="text-glow-rose font-mono text-5xl font-bold tabular-nums tracking-tight">
            {af.toFixed(1)}
          </span>
          <span className="font-mono text-2xl font-medium text-[var(--color-rose-gold)]/70">
            x
          </span>
        </div>
      </MetricCard>

      {/* 卡片 B: 预测寿命 (小时) */}
      <MetricCard
        tag="HOURS"
        titleZh="预测真实寿命"
        titleEn="Projected · Hours"
        trend={{ dir: "up", value: "PEAK", tone: "cyan" }}
        footer={
          <p className="font-mono text-[11px] text-muted-foreground">
            等效现场运行小时数
          </p>
        }
      >
        <div className="flex items-baseline gap-1">
          <span className="text-glow-cyan font-mono text-5xl font-bold tabular-nums tracking-tight">
            {formatNumber(projectedHours)}
          </span>
          <span className="font-mono text-xl font-medium text-[var(--color-sapphire)]/70">
            h
          </span>
        </div>
      </MetricCard>

      {/* 卡片 C: 生存周期 (年) + 风险阻断 */}
      <MetricCard
        tag="YEARS"
        titleZh="产品生存周期"
        titleEn="Survival · Years"
        trend={
          warrantyRisk
            ? { dir: "down", value: "RISK", tone: "red" }
            : { dir: "up", value: "PASS", tone: "cyan" }
        }
        footer={
          warrantyRisk ? (
            <p className="text-glow-red font-mono text-[11px]">
              违约风险 · 未达 {TARGET_WARRANTY_YEARS} 年质保门限
            </p>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">
              合规 · 满足 {TARGET_WARRANTY_YEARS} 年质保门限
            </p>
          )
        }
      >
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "font-mono text-5xl font-bold tabular-nums tracking-tight",
              warrantyRisk ? "text-glow-red" : "text-glow-rose",
            )}
          >
            {formatNumber(projectedYears, 1)}
          </span>
          <span
            className={cn(
              "font-mono text-xl font-medium",
              warrantyRisk
                ? "text-destructive/70"
                : "text-[var(--color-rose-gold)]/70",
            )}
          >
            年
          </span>
        </div>
      </MetricCard>
    </div>
  )
}
