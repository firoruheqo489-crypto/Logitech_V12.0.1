"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  BOLTZMANN_EV,
  KELVIN_OFFSET,
  toKelvin,
  formatNumber,
  type ArrheniusResult,
} from "@/lib/arrhenius"

interface AuditTrailProps {
  tUse: number
  tTest: number
  ea: number
  testDuration: number
  result: ArrheniusResult
}

// 公式行：左侧标号 + 等宽数学表达式
function Step({
  index,
  title,
  children,
}: {
  index: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 shrink-0 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground">{title}</p>
        <div className="mt-1.5 space-y-1 font-mono text-[11px] leading-relaxed text-foreground/90 sm:text-xs">
          {children}
        </div>
      </div>
    </div>
  )
}

// 高亮数值片段
function V({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-[var(--color-rose-gold)]/12 px-1 py-px font-semibold text-[var(--color-rose-gold-bright)] tabular-nums">
      {children}
    </span>
  )
}

// 通俗语言注释（带发光圆点指示器）
function Note({ zh, en }: { zh: string; en: string }) {
  return (
    <div className="mt-2 flex gap-2 rounded-md bg-[var(--color-sapphire)]/[0.06] px-2.5 py-2">
      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-sapphire)] shadow-[0_0_6px_var(--color-sapphire)]" />
      <div className="min-w-0 flex-1 font-sans not-italic">
        <p className="text-[10.5px] italic leading-relaxed text-white/60">
          {zh}
        </p>
        <p className="mt-0.5 text-[10px] italic leading-relaxed text-white/45">
          {en}
        </p>
      </div>
    </div>
  )
}

export function AuditTrail({
  tUse,
  tTest,
  ea,
  testDuration,
  result,
}: AuditTrailProps) {
  const [open, setOpen] = useState(true)

  const tUseK = toKelvin(tUse)
  const tTestK = toKelvin(tTest)
  const invDiff = 1 / tUseK - 1 / tTestK
  const exponent = (ea / BOLTZMANN_EV) * invDiff
  const { af, projectedHours, projectedYears, valid } = result

  return (
    <div className="glass-panel metal-edge rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-t-2xl px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-sm font-bold tracking-tight text-inlay-gold">
            计算溯源 · 行政审计留痕
          </h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Formula Breakdown · White-box Derivation
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--color-rose-gold)] transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4">
          <div className="divide-y divide-border/60">
            <Step index="01" title="绝对温度转换 (Kelvin Conversion)">
              <p>
                T_use(K) = {tUse} + {KELVIN_OFFSET} = <V>{tUseK.toFixed(2)} K</V>
              </p>
              <p>
                T_test(K) = {tTest} + {KELVIN_OFFSET} ={" "}
                <V>{tTestK.toFixed(2)} K</V>
              </p>
              <Note
                zh="为什么加 273.15？因为物理公式必须在绝对零度 (Kelvin) 下计算分子运动速率。"
                en="Kelvin scaling is required to measure absolute molecular kinetic energy."
              />
            </Step>

            <Step index="02" title="物理加速因子测算 (Acceleration Factor)">
              <p className="text-muted-foreground">
                {"AF = exp[ (E_a / k) \u00D7 (1/T_use \u2212 1/T_test) ]"}
              </p>
              <p className="break-all">
                = exp[ ({ea} / {BOLTZMANN_EV.toExponential(3)}) {"\u00D7"} (1/
                {tUseK.toFixed(2)} {"\u2212"} 1/{tTestK.toFixed(2)}) ]
              </p>
              <p>
                = exp[ {(ea / BOLTZMANN_EV).toFixed(1)} {"\u00D7"}{" "}
                {invDiff.toExponential(4)} ] = exp[ {exponent.toFixed(4)} ]
              </p>
              <p>
                {"\u21D2"} AF ={" "}
                <V>{valid ? `${af.toFixed(3)} x` : "无效 (T_test \u2264 T_use)"}</V>
              </p>
              <Note
                zh="通俗解释：激活能 (Ea) 越高，材料在高温下越容易加速老化；温差越大，加速倍率越高。"
                en="Simplified: Higher Activation Energy (Ea) means heat degrades it faster. Larger temp diff = higher acceleration."
              />
            </Step>

            <Step index="03" title="寿命折算 (Life Projection)">
              <p>
                Projected Life = Test Duration {"\u00D7"} AF
              </p>
              <p>
                = {testDuration} h {"\u00D7"} {af.toFixed(3)} ={" "}
                <V>{formatNumber(projectedHours)} h</V>
              </p>
              <p>
                = {formatNumber(projectedHours)} / 8760 ={" "}
                <V>{formatNumber(projectedYears, 2)} 年</V>
              </p>
              <Note
                zh={`审计结论：在 ${tTest}℃ 下测试 ${testDuration} 小时，等效于在常温下运行约 ${formatNumber(projectedHours)} 小时。`}
                en={`Audit Summary: ${testDuration}h stress test at ${tTest}°C equates to ~${formatNumber(projectedHours)}h of normal operation.`}
              />
            </Step>
          </div>
        </div>
      )}
    </div>
  )
}
