import { anomalyIndex, type Sample } from "./batch-data"

const SCALE_MAX = 10
const NO_RISK = 1
const LOW_RISK = 8

const pct = (v: number) => `${(v / SCALE_MAX) * 100}%`

export function Adjudication({ samples }: { samples: Sample[] }) {
  const worstIndex = anomalyIndex(samples)
  const worstSample = worstIndex >= 0 ? samples[worstIndex] : null
  const worst = worstSample?.f ?? 0
  const fail = worst > LOW_RISK

  return (
    <div className="rounded-xl border border-t border-white/[0.04] border-t-cyan-400/20 bg-[#070c14]/30 p-6 shadow-2xl backdrop-blur-3xl">
      <h2 className="mb-4 text-xs font-semibold tracking-[0.12em] text-[#00F3FF]">
        最坏情况合规裁定
      </h2>

      <div>
        <p className={`text-2xl font-semibold tracking-[0.08em] ${fail ? "text-[#FF003C] drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]" : "text-cyan-400"}`}>
          {fail ? "裁定：不合格" : "裁定：合格"}
        </p>
        <p className="mt-2 text-sm tracking-[0.04em] text-slate-400">
          最差样本 {worstSample?.id || "--"}（<span className="text-white">{worst.toFixed(3)}%</span>）
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
          ? "检测到驱动物料差异超出控制范围，最大偏差超过预警阈值，建议立即复核关键元件与批次一致性。"
          : "当前批次波动处于控制范围内，整体状态正常，可按现有结论继续推进。"}
      </p>
    </div>
  )
}
