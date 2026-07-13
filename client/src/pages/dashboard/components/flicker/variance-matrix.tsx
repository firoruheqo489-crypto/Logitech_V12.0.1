import { delta, reportTypeLabel, type Sample } from "./batch-data"

type Row = {
  metric: string
  values: Array<number | null>
  format: (n: number | null) => string
  deltaFormat?: (n: number | null) => string
}

const formatNumber = (value: number | null, digits = 3) => (value == null ? "--" : value.toFixed(digits))
const formatDelta = (value: number | null, unit = "") => (value == null ? "--" : `Δ ${value.toFixed(3)}${unit}`)

function maxValueIndex(values: Array<number | null>) {
  let maxIndex = -1
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (value == null) continue
    if (maxIndex < 0 || value > (values[maxIndex] ?? -Infinity)) {
      maxIndex = index
    }
  }
  return maxIndex
}

export function VarianceMatrix({ samples }: { samples: Sample[] }) {
  const rows: Row[] = [
    {
      metric: "频闪率",
      values: samples.map((s) => s.f),
      format: (n) => formatNumber(n),
      deltaFormat: (n) => formatDelta(n, "%"),
    },
    {
      metric: "频闪指数",
      values: samples.map((s) => s.idx),
      format: (n) => formatNumber(n),
      deltaFormat: formatDelta,
    },
    {
      metric: "Pst",
      values: samples.map((s) => s.pst),
      format: (n) => formatNumber(n),
      deltaFormat: formatDelta,
    },
    {
      metric: "SVM",
      values: samples.map((s) => s.svm),
      format: (n) => formatNumber(n),
      deltaFormat: formatDelta,
    },
    {
      metric: "频率(Hz)",
      values: samples.map((s) => s.freq),
      format: (n) => formatNumber(n),
    },
  ]

  return (
    <div className="rounded-xl border border-t border-white/[0.04] border-t-cyan-400/20 bg-[#070c14]/30 p-6 shadow-2xl backdrop-blur-3xl">
      <h2 className="mb-4 text-xs font-semibold tracking-[0.12em] text-[#00F3FF]">PDF 结论矩阵</h2>

      <div
        className="grid items-center gap-1 border-b border-white/[0.03] pb-2 text-[10px] tracking-wide text-slate-500"
        style={{ gridTemplateColumns: `1.3fr repeat(${samples.length}, 0.7fr) 1fr` }}
      >
        <span>指标</span>
        {samples.map((sample) => (
          <span key={sample.id} className="text-right">
            {reportTypeLabel(sample.reportType)}
          </span>
        ))}
        <span className="text-right">同类偏差</span>
      </div>

      <div className="flex flex-col">
        {rows.map((row) => {
          const rowMaxIndex = maxValueIndex(row.values)
          return (
            <div
              key={row.metric}
              className="grid items-center gap-1 border-b border-white/[0.03] py-2.5"
              style={{ gridTemplateColumns: `1.3fr repeat(${samples.length}, 0.7fr) 1fr` }}
            >
              <span className="text-[10px] tracking-wide text-slate-400">{row.metric}</span>
              {row.values.map((value, index) => (
                <span
                  key={index}
                  className={`text-right font-mono text-[10px] ${
                    value != null && index === rowMaxIndex
                      ? "text-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.35)]"
                      : value == null
                        ? "text-slate-600"
                        : "text-white"
                  }`}
                >
                  {row.format(value)}
                </span>
              ))}
              <span className="text-right font-mono text-[10px] font-medium text-slate-300">
                {row.deltaFormat?.(delta(row.values)) ?? "--"}
              </span>
            </div>
          )
        })}
        <div
          className="grid items-center gap-1 border-b border-white/[0.03] py-2.5"
          style={{ gridTemplateColumns: `1.3fr repeat(${samples.length}, 0.7fr) 1fr` }}
        >
          <span className="text-[10px] tracking-wide text-slate-400">PDF结论</span>
          {samples.map((sample) => (
            <span key={sample.id} className="truncate text-right text-[10px] text-slate-200" title={sample.result || sample.erp || sample.visibility || ""}>
              {sample.result || sample.erp || sample.visibility || "--"}
            </span>
          ))}
          <span className="text-right text-[10px] text-slate-600">--</span>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed tracking-wide text-slate-600">
        当前已对齐 {samples.length}/{samples.length} 份报告，按 PDF 结论字段归档。
      </p>
    </div>
  )
}
