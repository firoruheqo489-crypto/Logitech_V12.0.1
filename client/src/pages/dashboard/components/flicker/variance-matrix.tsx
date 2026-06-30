import { anomalyIndex, delta, type Sample } from "./batch-data"

type Row = {
  metric: string
  values: number[]
  format: (n: number) => string
  deltaFormat: (n: number) => string
}

export function VarianceMatrix({ samples }: { samples: Sample[] }) {
  const worstIndex = anomalyIndex(samples)

  const rows: Row[] = [
    {
      metric: "FLICKER % 频闪率",
      values: samples.map((s) => s.f),
      format: (n) => n.toFixed(3),
      deltaFormat: (n) => `Δ ${n.toFixed(3)}%`,
    },
    {
      metric: "FLICKER IDX 频闪指数",
      values: samples.map((s) => s.idx),
      format: (n) => n.toFixed(3),
      deltaFormat: (n) => `Δ ${n.toFixed(3)}`,
    },
    {
      metric: "FREQ (Hz) 频率",
      values: samples.map((s) => s.freq),
      format: (n) => n.toFixed(3),
      deltaFormat: (n) => `Δ ${n.toFixed(3)}`,
    },
  ]

  return (
    <div className="rounded-xl border border-t border-white/[0.04] border-t-cyan-400/20 bg-[#070c14]/30 p-6 shadow-2xl backdrop-blur-3xl">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.2em] text-[#00F3FF]">
        {"// BATCH VARIANCE AUDIT // 批次方差审计"}
      </h2>

      <div
        className="grid items-center gap-1 border-b border-white/[0.03] pb-2 font-mono text-[9px] tracking-wider text-slate-500"
        style={{ gridTemplateColumns: `1.3fr repeat(${samples.length}, 0.7fr) 1fr` }}
      >
        <span>METRIC 指标</span>
        {samples.map((sample) => (
          <span key={sample.id} className="text-right">
            {sample.id}
          </span>
        ))}
        <span className="text-right">MAX-Δ</span>
      </div>

      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.metric}
            className="grid items-center gap-1 border-b border-white/[0.03] py-2.5"
            style={{ gridTemplateColumns: `1.3fr repeat(${samples.length}, 0.7fr) 1fr` }}
          >
            <span className="font-mono text-[10px] tracking-wide text-slate-400">{row.metric}</span>
            {row.values.map((value, index) => (
              <span
                key={index}
                className={`text-right font-mono text-[10px] ${
                  index === worstIndex
                    ? "text-[#FF003C] drop-shadow-[0_0_5px_rgba(255,0,60,0.5)]"
                    : "text-white"
                }`}
              >
                {row.format(value)}
              </span>
            ))}
            <span className="text-right font-mono text-[10px] font-medium text-[#FF003C] drop-shadow-[0_0_5px_rgba(255,0,60,0.5)]">
              {row.deltaFormat(delta(row.values))}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 font-mono text-[9px] leading-relaxed tracking-wider text-slate-600">
        AUTO-ALIGNED: {samples.length}/{samples.length} PAYLOADS 已对齐 // VARIANCE ENGINE: ACTIVE 方差引擎: 运行中
      </p>
    </div>
  )
}
