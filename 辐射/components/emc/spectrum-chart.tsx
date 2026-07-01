"use client"

import { useMemo } from "react"
import {
  CartesianGrid,
  Line,
  ComposedChart,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ChannelData, ChannelId, Detector, Limits, PeakRecord } from "@/lib/emc"

interface Props {
  channels: ChannelData[]
  enabled: Record<ChannelId, boolean>
  detector: Detector
  limits: Limits
  selected: PeakRecord | null
  band: "conducted" | "radiated"
}

type MergedRow = { freq: number; L?: number | null; N?: number | null; F?: number | null }

const CHANNEL_HEX: Record<ChannelId, string> = {
  L: "#4f8df7",
  N: "#34c98a",
  F: "#b06bf0",
}

function fmtFreq(f: number): string {
  if (f >= 1) return `${f >= 10 ? f.toFixed(0) : f.toFixed(1)}M`
  return `${(f * 1000).toFixed(0)}k`
}

export function SpectrumChart({ channels, enabled, detector, limits, selected, band }: Props) {
  const data = useMemo<MergedRow[]>(() => {
    const map = new Map<number, MergedRow>()
    for (const ch of channels) {
      if (!enabled[ch.channel]) continue
      for (const p of ch.points) {
        const v = detector === "QP" ? p.qp : p.av
        const row = map.get(p.freq) ?? { freq: p.freq }
        row[ch.channel] = v
        map.set(p.freq, row)
      }
    }
    return [...map.values()].sort((a, b) => a.freq - b.freq)
  }, [channels, enabled, detector])

  const domain = band === "conducted" ? [0.15, 30] : [30, 300]
  const ticks =
    band === "conducted" ? [0.15, 0.5, 1, 5, 10, 30] : [30, 50, 100, 200, 300]
  const limitVal = detector === "QP" ? limits.qp : limits.av

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border bg-card/40 text-sm text-muted-foreground">
        暂无可显示的通道数据 · 请上传或载入示例数据
      </div>
    )
  }

  return (
    <div className="h-full min-h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 28, left: 4 }}>
          <CartesianGrid stroke="oklch(1 0 0 / 7%)" vertical={false} />
          <XAxis
            dataKey="freq"
            type="number"
            scale="log"
            domain={domain}
            ticks={ticks}
            allowDataOverflow
            tickFormatter={fmtFreq}
            stroke="oklch(0.66 0.02 230)"
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
            label={{
              value: `频率 (MHz) · ${band === "conducted" ? "0.15–30 MHz 传导" : "30–300 MHz 辐射"}`,
              position: "insideBottom",
              offset: -16,
              fill: "oklch(0.66 0.02 230)",
              fontSize: 11,
            }}
          />
          <YAxis
            domain={[0, 130]}
            ticks={[0, 20, 40, 54, 64, 80, 100, 120]}
            stroke="oklch(0.66 0.02 230)"
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
            label={{
              value: "电平 (dBµV)",
              angle: -90,
              position: "insideLeft",
              fill: "oklch(0.66 0.02 230)",
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(0.2 0.014 240)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
            labelStyle={{ color: "oklch(0.93 0.01 230)" }}
            labelFormatter={(l) => `f = ${Number(l).toFixed(3)} MHz`}
            formatter={(value, name) => [`${Number(value).toFixed(1)} dBµV`, `${name} 线`]}
          />

          {/* QP / AV 硬性限值红线 */}
          <ReferenceLine
            y={limits.qp}
            stroke="#ef4444"
            strokeDasharray="7 4"
            strokeWidth={1.5}
            label={{ value: `QP 限值 ${limits.qp}`, position: "right", fill: "#ef4444", fontSize: 10 }}
          />
          <ReferenceLine
            y={limits.av}
            stroke="#f87171"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: `AV 限值 ${limits.av}`, position: "right", fill: "#f87171", fontSize: 10 }}
          />

          {/* 选中点高亮十字准星 */}
          {selected && (
            <>
              <ReferenceLine x={selected.freq} stroke="oklch(0.78 0.14 200)" strokeWidth={1} strokeDasharray="3 3" />
              <ReferenceLine y={selected.reading} stroke="oklch(0.78 0.14 200)" strokeWidth={1} strokeDasharray="3 3" />
              <ReferenceDot
                x={selected.freq}
                y={selected.reading}
                r={5}
                fill="oklch(0.78 0.14 200)"
                stroke="oklch(0.16 0.012 240)"
                strokeWidth={2}
              />
            </>
          )}

          {(["L", "N", "F"] as ChannelId[]).map((id) =>
            enabled[id] ? (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                name={id}
                stroke={CHANNEL_HEX[id]}
                strokeWidth={1.6}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null,
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export { CHANNEL_HEX }
export type { Props as SpectrumChartProps }
