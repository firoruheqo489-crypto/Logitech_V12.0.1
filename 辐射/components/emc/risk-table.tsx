"use client"

import { cn } from "@/lib/utils"
import { type PeakRecord, RISK_META, type RiskLevel } from "@/lib/emc"
import { CHANNEL_HEX } from "./spectrum-chart"

interface Props {
  records: PeakRecord[]
  selected: PeakRecord | null
  onSelect: (r: PeakRecord) => void
}

const ROW_STYLE: Record<RiskLevel, string> = {
  high: "bg-risk-high/15 hover:bg-risk-high/25",
  mid: "bg-risk-mid/12 hover:bg-risk-mid/20",
  safe: "hover:bg-accent/60",
}

const BADGE_STYLE: Record<RiskLevel, string> = {
  high: "bg-risk-high text-risk-high-fg",
  mid: "bg-risk-mid text-risk-mid-fg",
  safe: "bg-risk-safe/20 text-risk-safe",
}

function formatFreq(f: number): string {
  if (f >= 1) return `${f.toFixed(3)} MHz`
  return `${(f * 1000).toFixed(1)} kHz`
}

export function RiskTable({ records, selected, onSelect }: Props) {
  if (records.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        无极值记录
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-secondary text-muted-foreground">
          <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
            <th>通道</th>
            <th>频点</th>
            <th>检波</th>
            <th className="text-right">读数</th>
            <th className="text-right">限值</th>
            <th className="text-right">余量 Δ</th>
            <th>风险判定</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {records.map((r) => {
            const meta = RISK_META[r.level]
            const isSel = selected?.id === r.id
            return (
              <tr
                key={r.id}
                onClick={() => onSelect(r)}
                className={cn(
                  "cursor-pointer border-t border-border/60 transition-colors",
                  ROW_STYLE[r.level],
                  isSel && "outline outline-2 -outline-offset-2 outline-primary",
                )}
              >
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: CHANNEL_HEX[r.channel] }}
                      aria-hidden
                    />
                    {r.channel}
                  </span>
                </td>
                <td className="px-3 py-2 text-foreground">{formatFreq(r.freq)}</td>
                <td className="px-3 py-2">{r.detector}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.reading.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.limit.toFixed(1)}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-semibold tabular-nums",
                    r.margin < 3 ? "text-risk-high" : r.margin < 6 ? "text-risk-mid" : "text-risk-safe",
                  )}
                >
                  {r.margin > 0 ? "+" : ""}
                  {r.margin.toFixed(1)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      BADGE_STYLE[r.level],
                    )}
                  >
                    {meta.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
