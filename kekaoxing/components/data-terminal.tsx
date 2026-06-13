"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Radio, Layers, Zap, ChevronRight } from "lucide-react"

interface DataRow {
  ts: string
  source: string
  raw: number
  delta: number
  status: "NOMINAL" | "DRIFT" | "CRITICAL" | "SYNC"
}

const SOURCES = ["THERM-01", "THERM-02", "VOLT-A3", "FLUX-09", "STRESS-X", "BUS-7F"]

// 确定性伪随机，避免水合不一致
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 928.31 + salt * 13.7) * 43758.5453
  return x - Math.floor(x)
}

function buildRows(count: number): DataRow[] {
  const rows: DataRow[] = []
  const base = 1749500000 // 固定纪元基准
  for (let i = 0; i < count; i++) {
    const r1 = seeded(i, 1)
    const r2 = seeded(i, 2)
    const r3 = seeded(i, 3)
    const delta = (r2 - 0.5) * 18.4
    const t = base + i * 37
    const d = new Date(t * 1000)
    const ts = `${String(d.getUTCHours()).padStart(2, "0")}:${String(
      d.getUTCMinutes(),
    ).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}.${String(
      Math.floor(r3 * 1000),
    ).padStart(3, "0")}`
    let status: DataRow["status"] = "NOMINAL"
    if (delta > 6.5) status = "CRITICAL"
    else if (delta > 3) status = "DRIFT"
    else if (delta < -5) status = "SYNC"
    rows.push({
      ts,
      source: SOURCES[Math.floor(r1 * SOURCES.length)],
      raw: 100 + (r1 * 2 - 1) * 64 + r3 * 12,
      delta,
      status,
    })
  }
  return rows
}

const STATUS_STYLES: Record<DataRow["status"], string> = {
  NOMINAL: "text-muted-foreground",
  DRIFT: "text-[var(--color-rose-gold-bright)]",
  CRITICAL: "text-[oklch(0.72_0.22_25)]",
  SYNC: "text-[oklch(0.85_0.15_200)]",
}

const STATUS_LABEL: Record<DataRow["status"], string> = {
  NOMINAL: "标称 NOMINAL",
  DRIFT: "漂移 DRIFT",
  CRITICAL: "临界 CRITICAL",
  SYNC: "同步 SYNC",
}

const COLUMNS = [
  { zh: "时间戳", en: "TIMESTAMP", w: "w-[22%]" },
  { zh: "数据源", en: "SOURCE", w: "w-[16%]" },
  { zh: "原始值", en: "RAW_VAL", w: "w-[20%]" },
  { zh: "偏差率", en: "DELTA", w: "w-[18%]" },
  { zh: "状态", en: "STATUS", w: "w-[24%]" },
]

export function DataTerminal() {
  const [mode, setMode] = useState<"STREAM" | "BATCH">("STREAM")
  const [payload, setPayload] = useState(
    `{\n  "source": "THERM-01",\n  "unit": "celsius",\n  "samples": [127.4, 128.1, 126.9],\n  "epoch": 1749500000\n}`,
  )
  const [injected, setInjected] = useState(0)

  const rows = useMemo(() => buildRows(40), [])

  const handleInject = () => {
    setInjected((n) => n + 1)
    console.log("[v0] INJECT PAYLOAD", { mode, bytes: payload.length })
  }

  return (
    <section className="glass-panel metal-edge mt-5 overflow-hidden rounded-2xl">
      {/* 终端标题栏 */}
      <div className="brushed-metal flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="metal-edge brushed-metal glow-sapphire flex size-9 items-center justify-center rounded-lg">
            <Radio className="size-4 text-[var(--color-sapphire)]" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-inlay-gold">
              原始数据终端
            </h2>
            <p className="font-terminal text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              RAW DATA TERMINAL · MODULE 02
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-terminal text-[10px]">
          <span className="size-1.5 animate-lux-pulse rounded-full bg-[var(--color-sapphire)] shadow-[0_0_8px_var(--color-sapphire)]" />
          <span className="text-[var(--color-platinum)]">总线在线</span>
          <span className="text-muted-foreground">BUS ONLINE</span>
        </div>
      </div>

      {/* 30 / 70 双栏工作区 */}
      <div className="grid grid-cols-1 gap-px bg-border/40 lg:grid-cols-[30%_70%]">
        {/* 左：数据注入口 */}
        <div className="bg-card/40 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="size-3.5 text-[var(--color-rose-gold)]" />
            <span className="text-xs font-semibold text-foreground">
              数据注入口
            </span>
            <span className="font-terminal text-[9px] tracking-wider text-muted-foreground">
              INJECTION NODE
            </span>
          </div>

          {/* STREAM / BATCH 拉丝金属拨动开关 */}
          <div className="metal-edge brushed-metal mb-4 flex rounded-lg p-1">
            {(["STREAM", "BATCH"] as const).map((m) => {
              const active = mode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-2 text-center transition-all",
                    active
                      ? "bg-[var(--color-rose-gold)]/14 shadow-[inset_0_1px_0_oklch(0.95_0.05_70/0.2)]"
                      : "hover:bg-secondary/30",
                  )}
                >
                  <span
                    className={cn(
                      "block text-[11px] font-bold tracking-wide",
                      active
                        ? "text-[var(--color-rose-gold-bright)]"
                        : "text-muted-foreground",
                    )}
                  >
                    {m}
                  </span>
                  <span className="block font-terminal text-[8px] tracking-wider text-muted-foreground">
                    {m === "STREAM" ? "实时流" : "手动批处理"}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 深陷发光录入腔 */}
          <div className="recessed rounded-lg p-1">
            <div className="mb-1 flex items-center justify-between px-2 pt-1">
              <span className="font-terminal text-[9px] tracking-wider text-muted-foreground">
                PAYLOAD {mode === "STREAM" ? "// 流监听" : "// 静态载荷"}
              </span>
              <span className="font-terminal text-[9px] text-[var(--color-sapphire)]">
                {payload.length}B
              </span>
            </div>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              spellCheck={false}
              disabled={mode === "STREAM"}
              rows={9}
              className="terminal-cavity w-full resize-none rounded-md px-3 py-2 font-terminal text-[12px] leading-7 text-[oklch(0.85_0.15_200)] caret-[var(--color-sapphire)] outline-none placeholder:text-muted-foreground/50 disabled:opacity-55"
              placeholder='{ "source": "...", "samples": [] }'
            />
          </div>

          {/* 巨型机械执行按钮 */}
          <button
            type="button"
            onClick={handleInject}
            className="mech-button metal-edge group mt-4 flex w-full items-center justify-between rounded-xl px-5 py-4"
          >
            <span className="flex items-center gap-3">
              <span className="relative flex size-3 items-center justify-center">
                <span className="absolute size-3 animate-lux-pulse rounded-full bg-[var(--color-sapphire)] shadow-[0_0_12px_var(--color-sapphire)]" />
                <span className="size-1.5 rounded-full bg-[oklch(0.95_0.05_200)]" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-bold tracking-wide text-[var(--color-platinum)]">
                  INJECT PAYLOAD
                </span>
                <span className="block font-terminal text-[9px] tracking-wider text-muted-foreground">
                  执行录入 · {mode}
                </span>
              </span>
            </span>
            <Zap className="size-5 text-[var(--color-rose-gold)] transition-transform group-active:scale-90" />
          </button>

          {injected > 0 && (
            <p className="mt-3 font-terminal text-[10px] text-[var(--color-sapphire)]">
              {">"} {injected} 次载荷已注入总线队列
            </p>
          )}
        </div>

        {/* 右：高密度数据网格 */}
        <div className="bg-[oklch(0.04_0.002_280)]">
          <div className="flex items-center justify-between border-b border-border/60 bg-card/40 px-5 py-2.5">
            <div className="flex items-center gap-2">
              <Zap className="size-3.5 text-[var(--color-sapphire)]" />
              <span className="text-xs font-semibold text-foreground">
                实时数据网格
              </span>
              <span className="font-terminal text-[9px] tracking-wider text-muted-foreground">
                LIVE DATA GRID · VIRTUALIZED
              </span>
            </div>
            <span className="font-terminal text-[9px] text-muted-foreground">
              {rows.length} ROWS · 1.2k/s
            </span>
          </div>

          {/* 表头 */}
          <div className="sticky top-0 z-10 flex gap-3 border-b border-[var(--color-rose-gold)]/25 bg-[oklch(0.08_0.003_280)] px-5 py-2">
            {COLUMNS.map((c) => (
              <div
                key={c.en}
                className={cn(
                  "flex flex-col",
                  c.w,
                  c.en === "RAW_VAL" || c.en === "DELTA"
                    ? "items-end text-right"
                    : "items-start",
                )}
              >
                <span className="text-[11px] font-bold leading-tight text-[var(--color-rose-gold-bright)]">
                  {c.zh}
                </span>
                <span className="font-terminal text-[8px] tracking-wider text-muted-foreground">
                  {c.en}
                </span>
              </div>
            ))}
          </div>

          {/* 数据行 — 虚拟滚动容器 */}
          <div className="max-h-[420px] overflow-y-auto">
            {rows.map((row, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 px-5 py-1.5 font-terminal text-[12px] transition-colors",
                  i % 2 === 0 ? "grid-row-even" : "grid-row-odd",
                )}
              >
                <span className="w-[22%] text-muted-foreground">{row.ts}</span>
                <span className="flex w-[16%] items-center gap-1 text-foreground/85">
                  <ChevronRight className="size-3 text-[var(--color-rose-gold)]/50" />
                  {row.source}
                </span>
                <span className="w-[20%] text-right tabular-nums text-[var(--color-platinum)]">
                  {row.raw.toFixed(3)}
                </span>
                <span
                  className={cn(
                    "w-[18%] rounded px-1 text-right tabular-nums",
                    row.delta < 0
                      ? "cell-glow-cyan"
                      : row.delta > 6.5
                        ? "cell-bloom-red font-bold"
                        : "text-foreground/70",
                  )}
                >
                  {row.delta > 0 ? "+" : ""}
                  {row.delta.toFixed(2)}%
                </span>
                <span className={cn("w-[24%] text-[11px]", STATUS_STYLES[row.status])}>
                  <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
                  {STATUS_LABEL[row.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
