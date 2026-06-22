'use client'

import { GlassPanel } from './glass-panel'
import { toleranceOf, type StudyConfig } from './gage-rnr'

interface Props {
  cfg: StudyConfig
  onDims: (dims: { operators?: number; parts?: number; trials?: number }) => void
  onSpec: (spec: { usl?: number; lsl?: number; historicalSigma?: number; alpha?: number }) => void
}

function Field({
  label,
  value,
  onChange,
  onStep,
  step = 1,
  min,
  max,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  onStep?: (direction: -1 | 1) => void
  step?: number
  min?: number
  max?: number
  hint?: string
}) {
  const canDecrement = typeof min !== 'number' || value > min
  const canIncrement = typeof max !== 'number' || value < max

  return (
    <label className="flex flex-col gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
          className="w-full bg-transparent font-mono text-lg font-semibold text-zinc-50 tabular-nums outline-none"
          aria-label={label}
        />
        {onStep ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={!canDecrement}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-sm font-bold text-zinc-300 transition-colors hover:border-sky-400/40 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={`${label} decrease`}
            >
              -
            </button>
            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={!canIncrement}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-sm font-bold text-zinc-300 transition-colors hover:border-sky-400/40 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={`${label} increase`}
            >
              +
            </button>
          </div>
        ) : null}
      </div>
      {hint ? <span className="font-mono text-[10px] text-zinc-400">{hint}</span> : null}
    </label>
  )
}

export function ControlPanel({ cfg, onDims, onSpec }: Props) {
  const tol = toleranceOf(cfg)
  return (
    <GlassPanel className="px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-100">Study Design</span>
        <span className="text-[10px] font-medium text-zinc-400">研究设计</span>
        <span className="text-[10px] font-mono text-zinc-400">
          {cfg.operators} × {cfg.parts} × {cfg.trials} · {cfg.operators * cfg.parts * cfg.trials} reads
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <Field
          label="Parts (N)"
          value={cfg.parts}
          min={2}
          max={20}
          onChange={(v) => onDims({ parts: v })}
          onStep={(direction) => onDims({ parts: cfg.parts + direction })}
          hint="2–20"
        />
        <Field
          label="Appraisers (K)"
          value={cfg.operators}
          min={2}
          max={8}
          onChange={(v) => onDims({ operators: v })}
          onStep={(direction) => onDims({ operators: cfg.operators + direction })}
          hint="2–8"
        />
        <Field
          label="Trials (R)"
          value={cfg.trials}
          min={2}
          max={7}
          onChange={(v) => onDims({ trials: v })}
          onStep={(direction) => onDims({ trials: cfg.trials + direction })}
          hint="2–7"
        />
        <Field
          label="Alpha (α)"
          value={cfg.alpha}
          step={0.01}
          min={0.01}
          max={0.5}
          onChange={(v) => onSpec({ alpha: v })}
          hint="交互合并阈值"
        />
        <Field label="USL" value={cfg.usl} step={0.1} onChange={(v) => onSpec({ usl: v })} hint="upper spec" />
        <Field label="LSL" value={cfg.lsl} step={0.1} onChange={(v) => onSpec({ lsl: v })} hint={`tol ${tol.toFixed(2)}`} />
        <Field
          label="Historical σ"
          value={cfg.historicalSigma ?? 0}
          step={0.001}
          min={0}
          onChange={(v) => onSpec({ historicalSigma: v })}
          hint="历史过程标准差 (可选)"
        />
      </div>
      {cfg.historicalSigma && cfg.historicalSigma > 0 ? (
        <p className="mt-2.5 rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-[10px] leading-relaxed text-sky-200">
          Total Variation is driven by the historical sigma input — %Study Var is computed against the process,
          not the {cfg.parts} sampled parts. // 已启用历史标准差：总变差以历史过程标准差为基准，%研究变差不再受抽样零件代表性影响。
        </p>
      ) : null}
    </GlassPanel>
  )
}
