import {
  hasFailingEvidence,
  hasWatchEvidence,
  reportTypeLabel,
  type Sample,
} from "./batch-data"

const formatNumber = (value: number | null, digits = 3, unit = "") =>
  value == null ? "--" : `${value.toFixed(digits)}${unit}`

function primaryMetric(sample: Sample) {
  if (sample.reportType === "pst") {
    return { label: "Pst", value: formatNumber(sample.pst), detail: sample.result || "PDF 结论未标注" }
  }
  if (sample.reportType === "svm") {
    return { label: "SVM", value: formatNumber(sample.svm), detail: sample.erp ? `ERP ${sample.erp}` : sample.visibility || "PDF 结论未标注" }
  }
  return { label: "频闪率", value: formatNumber(sample.f, 3, "%"), detail: `指数 ${formatNumber(sample.idx)}` }
}

function conclusionText(sample: Sample) {
  if (sample.result) return sample.result
  if (sample.erp) return `ERP ${sample.erp}`
  if (sample.visibility) return sample.visibility
  if (sample.f != null && sample.f > 8) return "超出低风险阈值"
  if (sample.f != null && sample.f > 1) return "低风险观察"
  return "可接受"
}

function conclusionClass(sample: Sample) {
  if (hasFailingEvidence(sample)) return "border-[#FF003C]/40 bg-[#FF003C]/10 text-[#FF6B86]"
  if (hasWatchEvidence(sample)) return "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
  return "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
}

function flickerPosition(value: number | null) {
  if (value == null) return "0%"
  return `${Math.min(Math.max(value, 0), 10) * 10}%`
}

function EvidenceRow({ sample }: { sample: Sample }) {
  const metric = primaryMetric(sample)
  const isFlicker = sample.reportType === "flicker"

  return (
    <div className="grid gap-4 border-b border-white/[0.04] py-5 last:border-b-0 lg:grid-cols-[160px_1fr_150px] lg:items-center">
      <div className="min-w-0">
        <div className="text-xs font-semibold tracking-[0.12em] text-[#00F3FF]">{reportTypeLabel(sample.reportType)}</div>
        <div className="mt-2 truncate font-mono text-[11px] text-slate-300" title={sample.fileName}>
          {sample.fileName}
        </div>
        <div className="mt-1 text-[11px] text-slate-600">{sample.measuredAt || "--"}</div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[11px] tracking-wide text-slate-500">{metric.label}</span>
          <span className="font-mono text-2xl font-semibold text-slate-100">{metric.value}</span>
          <span className="text-xs text-slate-500">{metric.detail}</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div>
            <div className="text-[10px] tracking-wide text-slate-600">频率</div>
            <div className="mt-1 font-mono text-xs text-slate-300">{formatNumber(sample.freq, 3, " Hz")}</div>
          </div>
          <div>
            <div className="text-[10px] tracking-wide text-slate-600">平均照度</div>
            <div className="mt-1 font-mono text-xs text-slate-300">{formatNumber(sample.illuminance, 2, " lx")}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] tracking-wide text-slate-600">标准</div>
            <div className="mt-1 truncate text-xs text-slate-300" title={sample.standard || ""}>
              {sample.standard || "--"}
            </div>
          </div>
        </div>
        {isFlicker ? (
          <div className="relative mt-5 h-[2px] rounded-full bg-white/10">
            <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-cyan-300/60" style={{ left: "10%" }} />
            <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-slate-400/70" style={{ left: "80%" }} />
            <span
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]"
              style={{ left: flickerPosition(sample.f) }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex lg:justify-end">
        <span className={`inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium ${conclusionClass(sample)}`}>
          {conclusionText(sample)}
        </span>
      </div>
    </div>
  )
}

export function Oscilloscope({ samples }: { samples: Sample[] }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-t border-white/[0.04] border-t-cyan-400/20 bg-[#070c14]/30 p-6 shadow-2xl backdrop-blur-3xl">
      <h2 className="mb-4 text-xs font-semibold tracking-[0.12em] text-[#00F3FF]">PDF 证据视图</h2>

      <div className="min-h-[400px] flex-1">
        {samples.map((sample) => (
          <EvidenceRow key={`${sample.reportType}-${sample.fileName}`} sample={sample} />
        ))}
      </div>

      <p className="mt-4 text-[11px] tracking-wide text-slate-600">
        已载入 {samples.length} 份报告，按实验室 PDF 结论字段归档。
      </p>
    </div>
  )
}
