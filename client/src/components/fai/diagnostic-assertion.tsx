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
  const audit = useFaiDiagnosis({ cavityData, sampleValues, actualMean, nominal, usl, lsl })
  const headerText = excelFileName || "数据稽核清单 / DATA AUDIT CHECKLIST"

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-slate-400" />
        <h3 className="max-w-full truncate text-xs font-bold text-slate-400 font-mono tracking-wider" title={headerText}>
          {headerText}
        </h3>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-200 leading-relaxed font-mono">
          {audit.auditLine}
        </p>
        <p className="text-sm text-slate-200 leading-relaxed font-mono">
          {audit.profileLine}
        </p>
      </div>

      <div className="mt-3 border-t border-slate-700/50 pt-2">
        <p className="text-xs text-slate-600 font-mono">
          [系统解析时间: {audit.timestamp}]
        </p>
      </div>
    </div>
  )
}
