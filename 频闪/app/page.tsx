"use client"

import { useState } from "react"
import { MassIngestion } from "@/components/mass-ingestion"
import { Oscilloscope } from "@/components/oscilloscope"
import { VarianceMatrix } from "@/components/variance-matrix"
import { Adjudication } from "@/components/adjudication"

export default function Page() {
  const [isBatchLoaded, setIsBatchLoaded] = useState(false)

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-slate-200 selection:bg-cyan-500/30">
      <div className="mx-auto max-w-7xl">
        {/* header */}
        <header className="mb-8 flex flex-col gap-3 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-mono text-base tracking-[0.3em] text-cyan-400">
              AXIOM&nbsp;SIGMA <span className="text-slate-400">公理西格玛</span>
            </h1>
            <p className="mt-1 font-mono text-[10px] tracking-[0.2em] text-slate-500">
              ULTIMATE MULTI-TRACE FLICKER MATRIX // 多路频闪溯源矩阵 // V3
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-slate-500">
            <span
              className={`size-1.5 rounded-full ${
                isBatchLoaded
                  ? "bg-[#FF003C] shadow-[0_0_8px_rgba(255,0,60,0.7)]"
                  : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
              }`}
            />
            {isBatchLoaded ? "STATUS: ANOMALY DETECTED // 检测到异常" : "STATUS: AWAITING PAYLOAD // 等待载荷"}
          </div>
        </header>

        {!isBatchLoaded ? (
          <MassIngestion onLoad={() => setIsBatchLoaded(true)} />
        ) : (
          <div className="grid w-full grid-cols-12 gap-6">
            {/* Master Core */}
            <div className="col-span-12 flex flex-col lg:col-span-8">
              <Oscilloscope />
            </div>
            {/* Slave Stack */}
            <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
              <VarianceMatrix />
              <Adjudication />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
