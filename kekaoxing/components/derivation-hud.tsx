"use client"

import { cn } from "@/lib/utils"

interface DerivationHudProps {
  ea: number
  tUse: number
  tTest: number
}

interface DerivationMode {
  zh: string
  en: string
  mechanismZh: string
  mechanismEn: string
  standard: string
  eaLabel: string
  descZh: string
  descEn: string
}

// 依据当前激活能 Ea 推断失效模式
function resolveMode(ea: number): DerivationMode {
  // 驱动失效 — 高活化能 (电介质击穿 / 栅氧退化)
  if (ea >= 0.85) {
    return {
      zh: "成品灯 - 掉驱动",
      en: "Driver Failure",
      mechanismZh: "电解电容热退化与驱动 IC 栅氧击穿",
      mechanismEn:
        "Thermal degradation of electrolytic capacitors & gate-oxide breakdown in driver ICs",
      standard: "JESD22-A108 / MIL-HDBK-217F",
      eaLabel: "Ea_driver = 0.90 eV",
      descZh:
        "依据 Arrhenius 电介质击穿模型，驱动电源主电容与 IC 芯片在高温下服从高活化能退化规律。",
      descEn:
        "Based on the Arrhenius dielectric breakdown model, driver capacitors and ICs follow high-Ea degradation patterns under thermal stress.",
    }
  }
  // 死灯 / 光衰 — 低至中等活化能 (晶格缺陷扩散 / 金丝合金化 / 荧光粉碳化)
  return {
    zh: "成品灯 - 死灯/光衰",
    en: "Dead Lamp & Lumen Drop",
    mechanismZh: "GaN 外延层晶格缺陷扩散、金丝焊点合金化、荧光粉碳化",
    mechanismEn:
      "Lattice defect diffusion in GaN epilayers, gold-wire bonding intermetallic growth, or phosphor carbonization",
    standard: "IES TM-21 / IES LM-80",
    eaLabel: "Ea_led = 0.45 eV ~ 0.65 eV",
    descZh:
      "依据 IES TM-21 固态照明寿命退化模型，外延层晶格缺陷扩散与金丝焊点合金化服从低至中等活化能规律。",
    descEn:
      "Per IES TM-21 for solid-state lighting, epitaxial lattice defect diffusion and wire-bond alloying follow low-to-medium Ea constants.",
  }
}

// 高对比发光常量块
function GlowConst({
  symbol,
  value,
  tone = "rose",
}: {
  symbol: React.ReactNode
  value: string
  tone?: "rose" | "cyan"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 font-terminal text-[12px] tabular-nums",
        tone === "rose"
          ? "bg-[var(--color-rose-gold)]/12 text-glow-rose"
          : "bg-[var(--color-sapphire)]/12 text-glow-cyan",
      )}
    >
      <span className="opacity-80">{symbol}</span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}

export function DerivationHud({ ea, tUse, tTest }: DerivationHudProps) {
  const mode = resolveMode(ea)
  const tUseK = (tUse + 273.15).toFixed(2)
  const tTestK = (tTest + 273.15).toFixed(2)

  return (
    <section className="glass-panel metal-edge rounded-2xl p-5">
      {/* 标题 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-inlay-gold">
            白盒推演依据
          </h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Theoretical Derivation HUD
          </p>
        </div>
        <div className="metal-edge brushed-metal flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px]">
          <span className="size-1.5 animate-lux-pulse rounded-full bg-[var(--color-sapphire)] shadow-[0_0_8px_var(--color-sapphire)]" />
          <span className="text-[var(--color-platinum)]">R&D AUDIT</span>
        </div>
      </div>

      {/* 全宽三列横向布局 */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr_1fr]">
        {/* 左列 — 失效模式 + 机理 */}
        <div className="flex flex-col gap-3">
          {/* 当前失效模式标签 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">
              ACTIVE MODE
            </span>
            <span className="metal-edge brushed-metal glow-rose rounded-md px-2.5 py-1 text-[11px] font-semibold text-[var(--color-rose-gold-bright)]">
              {mode.zh}
              <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider opacity-70">
                {mode.en}
              </span>
            </span>
          </div>

          {/* 失效机理 */}
          <div className="flex-1 rounded-lg bg-black/20 px-3 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Target Mechanism / 目标失效机理
            </p>
            <p className="mt-1 text-pretty text-[11px] leading-relaxed text-foreground/85">
              {mode.mechanismZh}
            </p>
            <p className="mt-1 text-pretty font-mono text-[10px] leading-relaxed text-muted-foreground">
              {mode.mechanismEn}
            </p>
          </div>
        </div>

        {/* 中列 — 定额推演公式区 */}
        <div className="flex flex-col">
          <p className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>定额推演依据</span>
            <span>METROLOGY BASIS</span>
          </p>

          {/* 类 LaTeX 实时编译公式区 — 内发光凹陷腔体 */}
          <div className="terminal-cavity flex flex-1 flex-col justify-center rounded-lg px-4 py-4">
            {/* AF 公式 — 分数布局 */}
            <div className="flex flex-wrap items-center justify-center gap-3 font-terminal text-[15px] text-foreground">
              <span className="text-glow-cyan font-semibold">AF</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-glow-rose">exp</span>
              <span className="text-[22px] text-muted-foreground">[</span>

              {/* Ea / k 分数 */}
              <span className="inline-flex flex-col items-center leading-tight">
                <span className="px-2 text-glow-rose">E_a</span>
                <span className="my-0.5 h-px w-full bg-[var(--color-rose-gold)]/50" />
                <span className="px-2 text-glow-cyan">k</span>
              </span>

              <span className="text-muted-foreground">·</span>
              <span className="text-[22px] text-muted-foreground">(</span>

              {/* 1/T_use 分数 */}
              <span className="inline-flex flex-col items-center leading-tight">
                <span className="px-1">1</span>
                <span className="my-0.5 h-px w-full bg-foreground/40" />
                <span className="px-1 text-[11px]">T_use</span>
              </span>

              <span className="text-muted-foreground">−</span>

              {/* 1/T_test 分数 */}
              <span className="inline-flex flex-col items-center leading-tight">
                <span className="px-1">1</span>
                <span className="my-0.5 h-px w-full bg-foreground/40" />
                <span className="px-1 text-[11px]">T_test</span>
              </span>

              <span className="text-[22px] text-muted-foreground">)</span>
              <span className="text-[22px] text-muted-foreground">]</span>
            </div>

            {/* 当前代入值 */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-t border-[var(--color-rose-gold)]/15 pt-3">
              <GlowConst symbol="T_use =" value={`${tUseK} K`} tone="cyan" />
              <GlowConst symbol="T_test =" value={`${tTestK} K`} tone="cyan" />
            </div>
          </div>
        </div>

        {/* 右列 — 常量定义 + 标准 + 描述 */}
        <div className="flex flex-col gap-3">
          {/* 常量定义 — Where 子句 */}
          <div className="flex flex-col gap-2 rounded-lg bg-black/20 px-3 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Where / 常量定义
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <GlowConst symbol="E_a =" value={mode.eaLabel.split("= ")[1]} />
              <GlowConst symbol="k =" value="8.6173 × 10⁻⁵ eV/K" tone="cyan" />
            </div>
            <p className="font-mono text-[9px] leading-relaxed text-muted-foreground/80">
              {ea >= 0.85
                ? "Strict semiconductor / dielectric activation energy threshold · Boltzmann Constant"
                : "Atomic diffusion & quantum efficiency degradation · Boltzmann Constant"}
            </p>
          </div>

          {/* 参考标准 */}
          <div className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Reference Standard
              <span className="ml-1.5 normal-case tracking-normal">参考标准</span>
            </span>
            <span className="metal-edge brushed-metal rounded px-2 py-1 text-right font-terminal text-[10px] font-semibold text-glow-cyan">
              {mode.standard}
            </span>
          </div>

          {/* 双语描述 */}
          <div className="flex-1 rounded-lg border border-[var(--color-rose-gold)]/15 bg-black/15 px-3 py-2.5">
            <p className="text-pretty text-[11px] leading-relaxed text-foreground/85">
              <span className="mr-1 font-mono text-[9px] text-[var(--color-rose-gold)]">
                [中]
              </span>
              {mode.descZh}
            </p>
            <p className="mt-2 text-pretty font-mono text-[10px] leading-relaxed text-muted-foreground">
              <span className="mr-1 text-[var(--color-sapphire)]">[EN]</span>
              {mode.descEn}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
