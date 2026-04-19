"use client"

import { useFaiDiagnosis } from "@/hooks/use-fai-diagnosis"
import { Database } from "lucide-react"

interface DiagnosticAssertionProps {
  cavityData: Array<{ value: number; status: "OK" | "+NG" | "-NG" }>
  actualMean: number
  nominal: number
  usl: number
  lsl: number
}

/**
 * Hardcore Data Checklist Display
 * 
 * Pure data audit output using strict template.
 * NO trend guessing, NO colored indicators, NO subjective language.
 * Only counts, rates, and objective shift direction.
 */
export function DiagnosticAssertion({
  cavityData,
  actualMean,
  nominal,
  usl,
  lsl,
}: DiagnosticAssertionProps) {
  const audit = useFaiDiagnosis({ cavityData, actualMean, nominal, usl, lsl })

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/50 p-4">
      {/* Header - Data audit icon */}
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-slate-400" />
        <h3 className="text-xs font-bold text-slate-400 font-mono tracking-wider">
          数据稽核清单 / DATA AUDIT CHECKLIST
        </h3>
      </div>

      {/* Audit Lines - High contrast text */}
      <div className="space-y-2">
        <p className="text-sm text-slate-200 leading-relaxed font-mono">
          {audit.auditLine}
        </p>
        <p className="text-sm text-slate-200 leading-relaxed font-mono">
          {audit.profileLine}
        </p>
      </div>

      {/* Timestamp */}
      <div className="mt-3 border-t border-slate-700/50 pt-2">
        <p className="text-xs text-slate-600 font-mono">
          [系统解析时间: {audit.timestamp}]
        </p>
      </div>
    </div>
  )
}
