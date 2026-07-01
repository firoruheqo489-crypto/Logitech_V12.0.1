"use client"

import { useMemo, useState } from "react"
import { HeaderBar, type ProjectMeta } from "@/components/emc/header-bar"
import { UploadZone } from "@/components/emc/upload-zone"
import { ControlPanel } from "@/components/emc/control-panel"
import { SpectrumChart } from "@/components/emc/spectrum-chart"
import { RiskTable } from "@/components/emc/risk-table"
import {
  type ChannelData,
  type ChannelId,
  DEFAULT_LIMITS,
  type Detector,
  type Limits,
  type PeakRecord,
  RISK_META,
  buildPeakRecords,
  overallVerdict,
  sampleChannels,
} from "@/lib/emc"

export default function Page() {
  const [channels, setChannels] = useState<ChannelData[]>([])
  const [meta, setMeta] = useState<ProjectMeta>({
    projectNo: "EMC-2026-0001",
    standard: "EN 55032 Class B",
    date: "2026-06-30",
  })
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS)
  const [enabled, setEnabled] = useState<Record<ChannelId, boolean>>({ L: true, N: true, F: true })
  const [detector, setDetector] = useState<Detector>("QP")
  const [band, setBand] = useState<"conducted" | "radiated">("conducted")
  const [selected, setSelected] = useState<PeakRecord | null>(null)

  const available = useMemo<Record<ChannelId, boolean>>(
    () => ({
      L: channels.some((c) => c.channel === "L"),
      N: channels.some((c) => c.channel === "N"),
      F: channels.some((c) => c.channel === "F"),
    }),
    [channels],
  )

  const records = useMemo(() => {
    const active = channels.filter((c) => enabled[c.channel])
    return buildPeakRecords(active, limits)
  }, [channels, enabled, limits])

  // 表格只展示当前检波器读数，按余量升序取风险最高的前 40 个频点
  const tableRecords = useMemo(() => {
    return records.filter((r) => r.detector === detector).slice(0, 40)
  }, [records, detector])

  const counts = useMemo(() => {
    const c = { high: 0, mid: 0, safe: 0 }
    for (const r of tableRecords) c[r.level]++
    return c
  }, [tableRecords])

  const verdict = channels.length > 0 ? overallVerdict(records) : null

  function handleLoad(data: ChannelData) {
    setChannels((prev) => [...prev.filter((c) => c.channel !== data.channel), data])
    setEnabled((prev) => ({ ...prev, [data.channel]: true }))
    setSelected(null)
  }

  function handleClear(id: ChannelId) {
    setChannels((prev) => prev.filter((c) => c.channel !== id))
    setSelected((s) => (s?.channel === id ? null : s))
  }

  function handleSample() {
    setChannels(sampleChannels())
    setEnabled({ L: true, N: true, F: true })
    setSelected(null)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4 lg:p-6">
      <HeaderBar
        meta={meta}
        onMeta={setMeta}
        limits={limits}
        onLimits={setLimits}
        verdict={verdict}
        highCount={records.filter((r) => r.margin < 0).length}
        band={band}
        onBand={setBand}
      />

      <section aria-label="数据上传与解析">
        <UploadZone channels={channels} onLoad={handleLoad} onClear={handleClear} onLoadSample={handleSample} />
      </section>

      <div className="grid flex-1 gap-4 xl:grid-cols-[1.75fr_1fr]">
        {/* 全局频谱比对图 */}
        <section className="flex min-h-[440px] flex-col gap-3 rounded-xl border border-border bg-card/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">全局频谱比对图</h2>
            <span className="font-mono text-[10px] text-muted-foreground">
              X 对数轴 · Y 线性 0–130 dBµV · {detector} 曲线
            </span>
          </div>
          <ControlPanel
            enabled={enabled}
            onToggle={(id) => setEnabled((p) => ({ ...p, [id]: !p[id] }))}
            detector={detector}
            onDetector={setDetector}
            available={available}
          />
          <div className="h-[420px] flex-1">
            <SpectrumChart
              channels={channels}
              enabled={enabled}
              detector={detector}
              limits={limits}
              selected={selected}
              band={band}
            />
          </div>
        </section>

        {/* 风险审查区 */}
        <section className="flex min-h-[440px] flex-col gap-3 rounded-xl border border-border bg-card/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">DQE 风险审查 · 极值定标</h2>
            <span className="font-mono text-[10px] text-muted-foreground">余量升序</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatCard label={RISK_META.high.label} value={counts.high} tone="high" />
            <StatCard label={RISK_META.mid.label} value={counts.mid} tone="mid" />
            <StatCard label={RISK_META.safe.label} value={counts.safe} tone="safe" />
          </div>

          <div className="min-h-0 flex-1">
            <RiskTable records={tableRecords} selected={selected} onSelect={setSelected} />
          </div>

          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            {"分级规则：Margin < 3dB 量产高危 · 3–6dB 需审查 · ≥ 6dB 安全。点击行可在频谱图定位十字准星。"}
          </p>
        </section>
      </div>
    </main>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "high" | "mid" | "safe" }) {
  const map = {
    high: "border-risk-high/40 bg-risk-high/10 text-risk-high",
    mid: "border-risk-mid/40 bg-risk-mid/10 text-risk-mid",
    safe: "border-risk-safe/40 bg-risk-safe/10 text-risk-safe",
  }
  return (
    <div className={`flex flex-col items-center rounded-lg border px-2 py-2 ${map[tone]}`}>
      <span className="font-mono text-xl font-bold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}
