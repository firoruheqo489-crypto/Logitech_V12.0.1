"use client"

import { Activity, AlertOctagon, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Limits } from "@/lib/emc"

export interface ProjectMeta {
  projectNo: string
  standard: string
  date: string
}

interface Props {
  meta: ProjectMeta
  onMeta: (m: ProjectMeta) => void
  limits: Limits
  onLimits: (l: Limits) => void
  verdict: "PASS" | "FAIL" | null
  highCount: number
  band: "conducted" | "radiated"
  onBand: (b: "conducted" | "radiated") => void
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  width = "w-40",
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  type?: string
  width?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded-md border border-input bg-secondary px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary",
          width,
        )}
      />
    </label>
  )
}

export function HeaderBar({ meta, onMeta, limits, onLimits, verdict, highCount, band, onBand }: Props) {
  return (
    <header className="rounded-xl border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-balance text-lg font-semibold text-foreground">EMC 传导辐射解析看板</h1>
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              DQE · 单机版
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="项目编号" value={meta.projectNo} onChange={(v) => onMeta({ ...meta, projectNo: v })} />
            <Field label="测试标准" value={meta.standard} onChange={(v) => onMeta({ ...meta, standard: v })} />
            <Field label="测试日期" type="date" value={meta.date} onChange={(v) => onMeta({ ...meta, date: v })} width="w-40" />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label="QP 限值 (dBµV)"
              type="number"
              value={limits.qp}
              onChange={(v) => onLimits({ ...limits, qp: Number(v) || 0 })}
              width="w-32"
            />
            <Field
              label="AV 限值 (dBµV)"
              type="number"
              value={limits.av}
              onChange={(v) => onLimits({ ...limits, av: Number(v) || 0 })}
              width="w-32"
            />
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">频段</span>
              <div className="inline-flex overflow-hidden rounded-md border border-input">
                {(["conducted", "radiated"] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => onBand(b)}
                    className={cn(
                      "px-3 py-1.5 text-xs transition-colors",
                      band === b ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {b === "conducted" ? "传导 0.15–30M" : "辐射 30–300M"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 判定结果 */}
        <div
          className={cn(
            "flex min-w-[180px] flex-col items-center justify-center gap-1 rounded-lg border px-6 py-4",
            verdict === "FAIL"
              ? "border-risk-high/50 bg-risk-high/10"
              : verdict === "PASS"
                ? "border-risk-safe/50 bg-risk-safe/10"
                : "border-border bg-secondary",
          )}
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">判定结果</span>
          <span
            className={cn(
              "flex items-center gap-2 text-3xl font-bold tracking-wider",
              verdict === "FAIL" ? "text-risk-high" : verdict === "PASS" ? "text-risk-safe" : "text-muted-foreground",
            )}
          >
            {verdict === "FAIL" ? (
              <AlertOctagon className="h-7 w-7" />
            ) : verdict === "PASS" ? (
              <ShieldCheck className="h-7 w-7" />
            ) : null}
            {verdict ?? "—"}
          </span>
          {verdict && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {highCount > 0 ? `${highCount} 个高危频点` : "无超标频点"}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
