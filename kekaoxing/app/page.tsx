"use client"

import { useMemo, useState } from "react"
import { ControlPanel } from "@/components/control-panel"
import { ExecutiveMetrics } from "@/components/executive-metrics"
import { AuditTrail } from "@/components/audit-trail"
import { RiskChart } from "@/components/risk-chart"
import { DataTerminal } from "@/components/data-terminal"
import { DerivationHud } from "@/components/derivation-hud"
import { computeArrhenius } from "@/lib/arrhenius"

const SYS_COMMANDS = [
  { zh: "数据层", en: "DATA LAYERS" },
  { zh: "信号处理", en: "SIGNAL PROCESSING" },
  { zh: "滤波器", en: "FILTERS" },
  { zh: "计算引擎", en: "COMPUTE ENGINE" },
  { zh: "纪元导航", en: "EPOCH NAVIGATOR" },
]

export default function Page() {
  const [tUse, setTUse] = useState(127)
  const [tTest, setTTest] = useState(160)
  const [ea, setEa] = useState(0.9)
  const [testDuration, setTestDuration] = useState(500)
  const [activeCmd, setActiveCmd] = useState("计算引擎")

  const tempWarning = tTest <= tUse

  const result = useMemo(
    () => computeArrhenius({ tUse, tTest, ea, testDuration }),
    [tUse, tTest, ea, testDuration],
  )

  return (
    <main className="min-h-svh">
      <div className="mx-auto max-w-[1480px] px-4 py-6 lg:px-8 lg:py-8">
        {/* 顶部栏 — 金/铂金镶嵌标题 */}
        <header className="glass-panel metal-edge mb-5 rounded-2xl px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* AXIOM 徽标 */}
              <div className="metal-edge brushed-metal glow-rose flex size-12 shrink-0 items-center justify-center rounded-xl">
                <span className="text-inlay-gold font-mono text-xl font-bold tracking-tight">
                  Λ
                </span>
              </div>
              <div>
                <h1 className="text-balance text-xl font-bold tracking-tight sm:text-2xl">
                  <span className="text-inlay-gold">ALT 加速寿命与时间测算引擎</span>
                </h1>
                <p className="mt-1 flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-inlay-platinum font-semibold tracking-[0.2em]">
                    AXIOM
                  </span>
                  <span className="text-[var(--color-rose-gold)]">v4.2.1</span>
                  <span className="text-muted-foreground">
                    · Arrhenius Life Projection Engine
                  </span>
                </p>
              </div>
            </div>

            <div className="metal-edge brushed-metal flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[11px]">
              <span className="size-1.5 animate-lux-pulse rounded-full bg-[var(--color-sapphire)] shadow-[0_0_8px_var(--color-sapphire)]" />
              <span className="text-[var(--color-platinum)]">实时解算</span>
              <span className="text-muted-foreground">LIVE COMPUTE</span>
            </div>
          </div>

          {/* 系统命令菜单 */}
          <nav className="mt-5 flex flex-wrap items-center gap-1 border-t border-border/60 pt-4">
            {SYS_COMMANDS.map((cmd) => {
              const active = activeCmd === cmd.zh
              return (
                <button
                  key={cmd.zh}
                  type="button"
                  onClick={() => setActiveCmd(cmd.zh)}
                  className={
                    active
                      ? "metal-edge brushed-metal rounded-lg px-3.5 py-2 text-left transition-all"
                      : "rounded-lg px-3.5 py-2 text-left transition-all hover:bg-secondary/40"
                  }
                >
                  <span
                    className={
                      active
                        ? "block text-xs font-semibold text-[var(--color-rose-gold-bright)]"
                        : "block text-xs font-medium text-foreground/80"
                    }
                  >
                    {cmd.zh}
                  </span>
                  <span className="block font-mono text-[9px] tracking-wider text-muted-foreground">
                    {cmd.en}
                  </span>
                </button>
              )
            })}
          </nav>
        </header>

        {/* 主仪表盘网格 */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
          <ControlPanel
            tUse={tUse}
            tTest={tTest}
            ea={ea}
            testDuration={testDuration}
            onTUse={setTUse}
            onTTest={setTTest}
            onEa={setEa}
            onTestDuration={setTestDuration}
            tempWarning={tempWarning}
          />
          <div className="flex flex-col gap-5">
            <ExecutiveMetrics result={result} />
            <AuditTrail
              tUse={tUse}
              tTest={tTest}
              ea={ea}
              testDuration={testDuration}
              result={result}
            />
            <RiskChart
              tUse={tUse}
              tTest={tTest}
              ea={ea}
              testDuration={testDuration}
            />
          </div>
        </div>

        {/* 白盒推演依据 — 全宽横向板块 */}
        <div className="mt-5">
          <DerivationHud ea={ea} tUse={tUse} tTest={tTest} />
        </div>

        {/* 底部功能半球 — 原始数据终端 */}
        <DataTerminal />

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 font-mono text-[10px] text-muted-foreground">
          <span className="text-inlay-platinum">
            AXIOM Reliability Suite · Module 01 / ALT
          </span>
          <span>
            k = 8.617e-5 eV/K · T(K) = T(°C) + 273.15 · AF = exp((Ea/k)(1/T_use −
            1/T_test))
          </span>
        </footer>
      </div>
    </main>
  )
}
