"use client"

import { FileStack } from "lucide-react"

export function MassIngestion({ onLoad }: { onLoad: () => void }) {
  return (
    <button
      type="button"
      onClick={onLoad}
      aria-label="Mass ingestion bay — load batch reports"
      className="group flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-500/20 bg-white/[0.01] transition-all hover:bg-cyan-500/[0.03]"
    >
      <FileStack
        className="axiom-float mb-4 size-10 text-cyan-400 transition-transform group-hover:scale-110"
        strokeWidth={1.25}
        aria-hidden="true"
      />
      <p className="font-mono text-sm tracking-widest text-cyan-400">
        {"[ MASS INGESTION BAY // 批量投递舱 ]"}
      </p>
      <p className="mt-1 font-mono text-[11px] tracking-wide text-slate-400">
        {"DRAG 3-5 PDF REPORTS HERE // 拖入 3-5 份 PDF 报告"}
      </p>
      <p className="mt-2 font-mono text-[11px] tracking-wide text-slate-500">
        {"System will auto-align temporal payloads to calculate MAX-Δ variance."}
      </p>
      <p className="font-mono text-[11px] tracking-wide text-slate-500">
        {"系统将自动对齐时序载荷以计算 MAX-Δ 方差。"}
      </p>
    </button>
  )
}
