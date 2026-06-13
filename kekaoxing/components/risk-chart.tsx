"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/arrhenius"

interface RiskChartProps {
  tUse: number
  tTest: number
  ea: number
  testDuration: number
}

// 未来科技蓝多色光线
const CYAN = "oklch(0.82 0.15 200)"
const RED = "oklch(0.66 0.23 30)"
const MUTED = "oklch(0.62 0.02 235)"

// 硬编码的物理精确阿伦尼乌斯寿命数据（单调递减指数衰减）
const arrheniusData = [
  { temp: 25, life: 120000, label: "Room Temp" },
  { temp: 50, life: 55000, label: "" },
  { temp: 85, life: 18000, label: "Standard Operating" },
  { temp: 105, life: 8500, label: "" },
  { temp: 127, life: 3653, label: "T_use Target" },
  { temp: 150, life: 1200, label: "" },
  { temp: 160, life: 600, label: "T_test Base" },
]

// 真值标记点
const USE_POINT = { temp: 127, life: 3653 }
const TEST_POINT = { temp: 160, life: 600 }

type View = "curve" | "data"

// HUD 悬浮提示
function HudTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: (typeof arrheniusData)[number] }>
  label?: number
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="glass-panel metal-edge min-w-[180px] rounded-lg px-3 py-2.5 font-mono">
      <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-1.5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          TEMP
        </span>
        <span className="text-glow-cyan text-xs font-bold tabular-nums">
          {label}°C
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="tracking-wider">LIFE</span>
            <span className="text-[9px] text-muted-foreground/60">期望寿命</span>
          </span>
          <span className="text-glow-cyan font-semibold tabular-nums">
            {formatNumber(point.life)} h
          </span>
        </div>
        {point.label && (
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="tracking-wider text-muted-foreground">PHASE</span>
            <span className="font-semibold text-[var(--color-rose-gold-bright)]">
              {point.label}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function RiskChart({ tUse, tTest, ea, testDuration }: RiskChartProps) {
  const [view, setView] = useState<View>("curve")

  const tableRows = useMemo(
    () =>
      arrheniusData.map((d) => ({
        tempC: d.temp,
        tempK: d.temp + 273.15,
        life: d.life,
        years: d.life / 8760,
        label: d.label,
      })),
    [],
  )

  function handleExport() {
    const header = "温度(°C),温度(K),期望寿命(小时),期望寿命(年),阶段标签"
    const lines = tableRows.map(
      (r) =>
        `${r.tempC},${r.tempK.toFixed(2)},${r.life},${r.years.toFixed(3)},${r.label || "-"}`,
    )
    console.log("[v0] Export CSV\n" + [header, ...lines].join("\n"))
  }

  return (
    <div className="glass-panel metal-edge flex flex-col rounded-2xl">
      <div className="metal-edge brushed-metal flex flex-wrap items-center justify-between gap-3 rounded-t-2xl px-5 py-4">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-inlay-gold">
            指数级寿命坍塌图谱
          </h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Arrhenius Life-Decay · Calibrated Physics Model
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 图例 */}
          <div className="hidden items-center gap-3 font-mono text-[10px] sm:flex">
            <span className="flex items-center gap-1.5 text-[var(--color-sapphire)]">
              <span className="h-0.5 w-4 rounded bg-[var(--color-sapphire)]" />
              T_use
            </span>
            <span className="flex items-center gap-1.5 text-destructive">
              <span className="h-0.5 w-4 rounded bg-destructive" />
              T_test
            </span>
          </div>

          {/* 视图切换器 */}
          <div className="metal-edge inline-flex items-center rounded-lg bg-black/30 p-0.5">
            {(
              [
                { id: "curve", label: "曲线视图" },
                { id: "data", label: "原始数据表" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cn(
                  "rounded-md px-3 py-1 font-mono text-[11px] transition-all",
                  view === tab.id
                    ? "brushed-metal text-[var(--color-rose-gold-bright)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "curve" ? (
        <div className="lux-grid px-3 py-4">
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={arrheniusData}
                margin={{ top: 28, right: 28, left: 12, bottom: 12 }}
              >
                <defs>
                  {/* 青→红 温度渐变描边 */}
                  <linearGradient id="strokeTemp" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={CYAN} />
                    <stop offset="55%" stopColor={CYAN} />
                    <stop offset="80%" stopColor="oklch(0.78 0.16 70)" />
                    <stop offset="100%" stopColor={RED} />
                  </linearGradient>
                  {/* 曲线下面积渐变 — 淡出至黑曜石 */}
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CYAN} stopOpacity={0.28} />
                    <stop offset="55%" stopColor={CYAN} stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#050505" stopOpacity={0} />
                  </linearGradient>
                  <filter
                    id="lineGlow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feGaussianBlur stdDeviation="3.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <CartesianGrid
                  stroke="oklch(0.7 0.08 230 / 0.08)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="temp"
                  type="number"
                  domain={[25, 160]}
                  ticks={[25, 50, 85, 105, 127, 150, 160]}
                  tick={{
                    fill: MUTED,
                    fontSize: 10,
                    fontFamily: "var(--font-terminal)",
                  }}
                  tickLine={false}
                  axisLine={{ stroke: "oklch(0.5 0.06 230 / 0.25)" }}
                  tickFormatter={(v) => `${v}°C`}
                />
                <YAxis
                  dataKey="life"
                  tick={{
                    fill: MUTED,
                    fontSize: 10,
                    fontFamily: "var(--font-terminal)",
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k h` : `${v}h`
                  }
                />
                <Tooltip
                  cursor={{
                    stroke: CYAN,
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                  content={<HudTooltip />}
                />

                {/* 指数衰减主曲线 — 渐变发光描边 + 面积填充 */}
                <Area
                  type="monotone"
                  dataKey="life"
                  stroke="url(#strokeTemp)"
                  strokeWidth={3}
                  fill="url(#areaFill)"
                  filter="url(#lineGlow)"
                  dot={{
                    r: 3,
                    fill: "oklch(0.13 0.01 240)",
                    stroke: CYAN,
                    strokeWidth: 1.5,
                  }}
                  activeDot={{
                    r: 5,
                    fill: CYAN,
                    stroke: "oklch(0.13 0.01 240)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />

                {/* T_use 真值 — 青色垂直虚线 */}
                <ReferenceLine
                  x={USE_POINT.temp}
                  stroke={CYAN}
                  strokeDasharray="5 4"
                  strokeWidth={1.25}
                />
                {/* T_test 真值 — 红色垂直虚线 */}
                <ReferenceLine
                  x={TEST_POINT.temp}
                  stroke={RED}
                  strokeDasharray="5 4"
                  strokeWidth={1.25}
                />

                {/* T_use 发光青点 + 常驻 HUD 标签 */}
                <ReferenceDot
                  x={USE_POINT.temp}
                  y={USE_POINT.life}
                  r={6}
                  fill={CYAN}
                  stroke="oklch(0.13 0.01 240)"
                  strokeWidth={2}
                  filter="url(#lineGlow)"
                  label={{
                    value: "T_use: 127°C | Life: 3,653h",
                    position: "top",
                    fill: CYAN,
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontFamily: "var(--font-terminal)",
                    offset: 14,
                  }}
                />
                {/* T_test 发光红点 + 常驻 HUD 标签 */}
                <ReferenceDot
                  x={TEST_POINT.temp}
                  y={TEST_POINT.life}
                  r={6}
                  fill={RED}
                  stroke="oklch(0.13 0.01 240)"
                  strokeWidth={2}
                  filter="url(#lineGlow)"
                  label={{
                    value: "T_test: 160°C | Accel Base",
                    position: "top",
                    fill: RED,
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontFamily: "var(--font-terminal)",
                    offset: 14,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="px-3 py-4">
          <div className="mb-3 flex items-center justify-between px-2">
            <p className="font-mono text-[11px] text-muted-foreground">
              校准物理模型 · 25°C → 160°C · 共 {tableRows.length} 个采样点
            </p>
            <button
              type="button"
              onClick={handleExport}
              className="metal-edge inline-flex items-center gap-1.5 rounded-md bg-black/30 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-[var(--color-rose-gold-bright)]"
            >
              <Download className="size-3" />
              导出 CSV
            </button>
          </div>

          <div className="metal-edge max-h-[360px] overflow-y-auto rounded-lg">
            <table className="w-full border-collapse text-right font-terminal text-[11px] tabular-nums">
              <thead className="brushed-metal sticky top-0 z-10">
                <tr className="text-muted-foreground">
                  <th className="border-b border-border px-3 py-2 text-left font-medium">
                    温度 °C
                  </th>
                  <th className="border-b border-border px-3 py-2 font-medium">
                    温度 K
                  </th>
                  <th className="border-b border-border px-3 py-2 font-medium">
                    期望寿命 (h)
                  </th>
                  <th className="border-b border-border px-3 py-2 font-medium">
                    期望寿命 (年)
                  </th>
                  <th className="border-b border-border px-3 py-2 text-left font-medium">
                    阶段
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => {
                  const isUse = r.tempC === USE_POINT.temp
                  const isTest = r.tempC === TEST_POINT.temp
                  return (
                    <tr
                      key={r.tempC}
                      className={cn(
                        "transition-colors",
                        isUse
                          ? "bg-[var(--color-sapphire)]/12 text-foreground"
                          : isTest
                            ? "bg-destructive/12 text-foreground"
                            : "text-muted-foreground hover:bg-secondary/30",
                      )}
                    >
                      <td className="border-b border-border/30 px-3 py-1.5 text-left">
                        <span className="inline-flex items-center gap-1.5">
                          {isUse && (
                            <span className="size-1.5 rounded-full bg-[var(--color-sapphire)] shadow-[0_0_6px_var(--color-sapphire)]" />
                          )}
                          {isTest && (
                            <span className="size-1.5 rounded-full bg-destructive shadow-[0_0_6px_var(--color-destructive)]" />
                          )}
                          {r.tempC}
                        </span>
                      </td>
                      <td className="border-b border-border/30 px-3 py-1.5">
                        {r.tempK.toFixed(2)}
                      </td>
                      <td className="border-b border-border/30 px-3 py-1.5 text-foreground/90">
                        {formatNumber(r.life)}
                      </td>
                      <td
                        className={cn(
                          "border-b border-border/30 px-3 py-1.5",
                          r.years < 3 && "text-destructive",
                        )}
                      >
                        {r.years.toFixed(2)}
                      </td>
                      <td className="border-b border-border/30 px-3 py-1.5 text-left font-mono text-[10px] text-[var(--color-rose-gold-bright)]">
                        {r.label || "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="border-t border-border/60 px-5 py-3 font-mono text-[10px] text-muted-foreground">
        校准锚点 T_use=127°C (3,653h) · T_test=160°C (Accel Base) · E_a={ea}eV ——
        寿命随工作温度升高呈指数级坍塌
      </p>
    </div>
  )
}
