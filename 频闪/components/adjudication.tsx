const SCALE_MAX = 10 // % full-scale for the threshold track
const WORST = 8.45
const NO_RISK = 1
const LOW_RISK = 8

const pct = (v: number) => `${(v / SCALE_MAX) * 100}%`

export function Adjudication() {
  return (
    <div className="rounded-xl border border-t border-white/[0.04] border-t-cyan-400/20 bg-[#070c14]/30 p-6 shadow-2xl backdrop-blur-3xl">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.2em] text-[#00F3FF]">
        {"// IEEE 1789 COMPLIANCE (WORST-CASE) // 合规裁定 (最坏情况)"}
      </h2>

      {/* status */}
      <div>
        <p className="font-mono text-lg tracking-widest text-[#FF003C] drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]">
          {"[ STATUS: FAIL // 裁定: 不合格 ]"}
        </p>
        <p className="mt-1 font-mono text-[10px] tracking-wide text-slate-400">
          WORST CASE ANOMALY 最坏异常: SAMPLE S4 (<span className="text-white">8.45%</span>)
        </p>
      </div>

      {/* threshold gauge — ultra-thin track */}
      <div className="relative my-7 h-[2px] w-full rounded-full bg-white/10">
        {/* no-risk marker @ 1% */}
        <span
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-cyan-400/60"
          style={{ left: pct(NO_RISK) }}
          aria-hidden="true"
        />
        {/* low-risk marker @ 8% */}
        <span
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-slate-400/70"
          style={{ left: pct(LOW_RISK) }}
          aria-hidden="true"
        />
        {/* S4 indicator dot, just past 8% */}
        <span
          className="axiom-pulse absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF003C] shadow-[0_0_10px_#FF003C]"
          style={{ left: pct(WORST) }}
          aria-label="Sample S4 indicator at 8.45 percent"
        />
      </div>
      <div className="-mt-4 flex justify-between font-mono text-[8px] tracking-wider text-slate-600">
        <span>0%</span>
        <span className="text-[#00F3FF]/70">无风险 1%</span>
        <span className="text-slate-400/80">低风险 8%</span>
        <span>{SCALE_MAX}%</span>
      </div>

      {/* executive command — pure glowing text, no box */}
      <p className="axiom-blink mt-6 font-mono text-[10px] leading-relaxed tracking-wide text-[#FF003C] drop-shadow-[0_0_6px_rgba(255,0,60,0.5)]">
        {
          "[ WARNING: SEVERE DRIVER BOM VARIANCE DETECTED. MAX-Δ EXCEEDS 5%. REQUEST IMMEDIATE COMPONENT AUDIT. ] [ 警告: 检测到严重的驱动 BOM 方差。MAX-Δ 超过 5%。请立即进行元件审计。 ]"
        }
      </p>
    </div>
  )
}
