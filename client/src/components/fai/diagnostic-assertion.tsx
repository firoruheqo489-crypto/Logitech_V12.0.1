"use client"

import { useFaiDiagnosis } from "@/hooks/use-fai-diagnosis"
import { Database } from "lucide-react"

interface DiagnosticAssertionProps {
  cavityData: Array<{ value: number; status: "OK" | "+NG" | "-NG" }>
  sampleValues?: number[]
  excelFileName?: string
  actualMean: number
  nominal: number
  usl: number
  lsl: number
}

export function DiagnosticAssertion({
  cavityData,
  sampleValues,
  excelFileName,
  actualMean,
  nominal,
  usl,
  lsl,
}: DiagnosticAssertionProps) {
  const audit = useFaiDiagnosis({
    cavityData,
    sampleValues,
    actualMean,
    nominal,
    usl,
    lsl,
  })
  const headerText = excelFileName || "数据稽核清单 / DATA AUDIT CHECKLIST"
  const toleranceWidth = usl - lsl
  const grrBuffer = toleranceWidth * 0.05
  const absoluteLSL = lsl - grrBuffer
  const absoluteUSL = usl + grrBuffer

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-slate-400" />
        <h3
          className="max-w-full truncate font-mono text-xs font-bold tracking-wider text-slate-400"
          title={headerText}
        >
          {headerText}
        </h3>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-sm leading-relaxed text-slate-200">
          {audit.auditLine}
        </p>
        <p className="font-mono text-sm leading-relaxed text-slate-200">
          {audit.profileLine}
        </p>
      </div>

      <div className="mt-3 border-t border-slate-700/50 pt-2">
        <p className="font-mono text-[11px] font-semibold leading-relaxed text-slate-500">
          [GRR冗余已启用: 5% 公差缓冲；LSL&apos;={absoluteLSL.toFixed(3)} / USL&apos;=
          {absoluteUSL.toFixed(3)}（{grrBuffer.toFixed(4)} mm，约{" "}
          {(grrBuffer * 1000).toFixed(1)}μm）]
        </p>
      </div>
    </div>
  )
}
