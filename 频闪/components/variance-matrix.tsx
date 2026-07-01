import { batch, delta } from "@/lib/batch-data"

type Row = {
  metric: string
  values: number[]
  format: (n: number) => string
  deltaFormat: (n: number) => string
}

const rows: Row[] = [
  {
    metric: "FLICKER % 频闪率",
    values: batch.map((s) => s.f),
    format: (n) => n.toFixed(2),
    deltaFormat: (n) => `Δ ${n.toFixed(2)}%`,
  },
  {
    metric: "FLICKER IDX 频闪指数",
    values: batch.map((s) => s.idx),
    format: (n) => n.toFixed(3),
    deltaFormat: (n) => `Δ ${n.toFixed(3)}`,
  },
  {
    metric: "FREQ (Hz) 频率",
    values: batch.map((s) => s.freq),
    format: (n) => n.toFixed(1),
    deltaFormat: (n) => `Δ ${n.toFixed(1)}`,
  },
]

const anomalyIdx = batch.findIndex((s) => s.id === "S4")

export function VarianceMatrix() {
  return (
    <div className="rounded-xl border border-t border-white/[0.04] border-t-cyan-400/20 bg-[#070c14]/30 p-6 shadow-2xl backdrop-blur-3xl">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.2em] text-[#00F3FF]">
        {"// BATCH VARIANCE AUDIT // 批次方差审计"}
      </h2>

      {/* header row */}
      <div className="grid grid-cols-[1.3fr_repeat(4,0.7fr)_1fr] items-center gap-1 border-b border-white/[0.03] pb-2 font-mono text-[9px] tracking-wider text-slate-500">
        <span>METRIC 指标</span>
        {batch.map((s) => (
          <span key={s.id} className="text-right">
            {s.id}
          </span>
        ))}
        <span className="text-right">MAX-Δ</span>
      </div>

      {/* data rows */}
      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.metric}
            className="grid grid-cols-[1.3fr_repeat(4,0.7fr)_1fr] items-center gap-1 border-b border-white/[0.03] py-2.5"
          >
            <span className="font-mono text-[10px] tracking-wide text-slate-400">{row.metric}</span>
            {row.values.map((v, i) => (
              <span
                key={i}
                className={`text-right font-mono text-[10px] ${
                  i === anomalyIdx
                    ? "text-[#FF003C] drop-shadow-[0_0_5px_rgba(255,0,60,0.5)]"
                    : "text-white"
                }`}
              >
                {row.format(v)}
              </span>
            ))}
            <span className="text-right font-mono text-[10px] font-medium text-[#FF003C] drop-shadow-[0_0_5px_rgba(255,0,60,0.5)]">
              {row.deltaFormat(delta(row.values))}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 font-mono text-[9px] leading-relaxed tracking-wider text-slate-600">
        AUTO-ALIGNED: 4/4 PAYLOADS 已对齐 // VARIANCE ENGINE: ACTIVE 方差引擎: 运行中
      </p>
    </div>
  )
}
