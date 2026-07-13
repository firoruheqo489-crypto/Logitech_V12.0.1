import { anomalyIndex, hasFailingEvidence, hasWatchEvidence, type Sample } from "./batch-data"
import { FLICKER_COMPLIANCE_RULES } from "../laboratory/flicker-rules"

const SCALE_MAX = 10
const NO_RISK = FLICKER_COMPLIANCE_RULES.flickerPercent.noRiskMax
const LOW_RISK = FLICKER_COMPLIANCE_RULES.flickerPercent.lowRiskMax

const pct = (v: number) => `${(v / SCALE_MAX) * 100}%`

export function Adjudication({ samples }: { samples: Sample[] }) {
  const worstIndex = anomalyIndex(samples)
  const worstSample = worstIndex >= 0 ? samples[worstIndex] : null
  const flickerSamples = samples.filter((sample) => sample.f != null)
  const worst = Math.max(...flickerSamples.map((sample) => sample.f ?? 0), 0)
  const fail = samples.some(hasFailingEvidence)
  const watch = !fail && samples.some(hasWatchEvidence)
  const pstSample = samples.find((sample) => sample.pst != null)
  const svmSample = samples.find((sample) => sample.svm != null)

  return (
    <div className="rounded-xl border border-t border-white/[0.04] border-t-cyan-400/20 bg-[#070c14]/30 p-6 shadow-2xl backdrop-blur-3xl">
      <h2 className="mb-4 text-xs font-semibold tracking-[0.12em] text-[#00F3FF]">
        PDF 结论合规裁定
      </h2>

      <div>
        <p className={`text-2xl font-semibold tracking-[0.08em] ${fail ? "text-[#FF003C] drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]" : "text-cyan-400"}`}>
          {fail ? "裁定：不合格" : "裁定：合格"}
        </p>
        <p className="mt-2 text-sm tracking-[0.04em] text-slate-400">
          最差频闪 {worstSample?.id || "--"}（<span className="text-white">{worst.toFixed(3)}%</span>）
        </p>
        <p className="mt-2 text-xs leading-6 tracking-[0.03em] text-slate-500">
          Pst {pstSample?.pst == null ? "--" : pstSample.pst.toFixed(3)}
          {pstSample?.result ? ` / ${pstSample.result}` : ""} · SVM {svmSample?.svm == null ? "--" : svmSample.svm.toFixed(3)}
          {svmSample?.erp ? ` / ERP ${svmSample.erp}` : ""}
        </p>
      </div>

      <div className="relative my-7 h-[2px] w-full rounded-full bg-white/10">
        <span
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-cyan-400/60"
          style={{ left: pct(NO_RISK) }}
          aria-hidden="true"
        />
        <span
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-slate-400/70"
          style={{ left: pct(LOW_RISK) }}
          aria-hidden="true"
        />
        <span
          className={`absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${fail ? "bg-[#FF003C] shadow-[0_0_10px_#FF003C]" : "bg-cyan-400 shadow-[0_0_10px_#00F3FF]"}`}
          style={{ left: pct(Math.min(worst, SCALE_MAX)) }}
          aria-label="Worst flicker indicator"
        />
      </div>
      <div className="-mt-4 flex justify-between text-[11px] text-slate-600">
        <span>0%</span>
        <span className="text-[#00F3FF]/70">无风险 1%</span>
        <span className="text-slate-400/80">低风险 8%</span>
        <span>{SCALE_MAX}%</span>
      </div>

      <p className={`mt-6 text-sm leading-7 tracking-[0.03em] ${fail ? "text-[#FF003C] drop-shadow-[0_0_6px_rgba(255,0,60,0.5)]" : "text-cyan-400"}`}>
        {fail
          ? "检测到 PDF 结论或频闪指标超出控制范围，建议立即复核报告与关键元件一致性。"
          : watch
            ? "PDF 结论可接受，频闪率处于低风险观察区间，可按实验室结论继续推进并保留关注。"
            : "PDF 结论可接受，当前频闪、Pst 与 SVM 状态正常，可按现有结论继续推进。"}
      </p>
    </div>
  )
}
