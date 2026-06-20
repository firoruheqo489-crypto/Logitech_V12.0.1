"use client"

import { cn } from "@/lib/utils"
import { StackedLabel } from "@/components/stacked-label"
import { ClipboardPaste, FlaskConical, Trash2 } from "lucide-react"

const ALPHAS = [0.01, 0.05, 0.1]

interface ParameterPanelProps {
  h0: string
  h1: string
  alpha: number
  sampleA: string
  sampleB: string
  nA: number
  nB: number
  reject: boolean
  onAlpha: (a: number) => void
  onSampleA: (v: string) => void
  onSampleB: (v: string) => void
}

export function ParameterPanel({
  h0,
  h1,
  alpha,
  sampleA,
  sampleB,
  nA,
  nB,
  reject,
  onAlpha,
  onSampleA,
  onSampleB,
}: ParameterPanelProps) {
  async function pasteInto(setter: (v: string) => void) {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setter(text)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <section className="metal-panel flex flex-col gap-5 rounded-2xl p-5">
      <header className="flex items-center gap-3 border-b border-border/60 pb-4">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary glow-cyan">
          <FlaskConical className="h-4 w-4" />
        </span>
        <StackedLabel zh="参数配置" en="Audit Setup & Parameters" size="lg" />
      </header>

      {/* Hypotheses — reactive verdict state */}
      <div className="recessed flex flex-col gap-3 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <StackedLabel zh="假设陈述" en="Hypothesis Statement" size="sm" />
          <span
            className={cn(
              "font-num text-[9px] uppercase tracking-[0.2em]",
              reject ? "text-[var(--warning)]" : "text-primary",
            )}
          >
            {reject ? "H1 Prevails" : "H0 Holds"}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {/* H0 — killed when rejected */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-md p-1.5 transition-all duration-500",
              reject ? "opacity-30" : "opacity-100",
            )}
          >
            <span className="font-num grid h-6 w-9 shrink-0 place-items-center rounded bg-primary/15 text-[11px] font-bold text-primary">
              H0
            </span>
            <p
              className={cn(
                "font-num text-xs leading-relaxed text-foreground/85 transition-all",
                reject && "line-through decoration-[var(--warning)]/70",
              )}
            >
              {h0}
            </p>
          </div>
          {/* H1 — activated when rejected */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-md p-1.5 transition-all duration-500",
              reject
                ? "bg-[var(--warning)]/8"
                : "opacity-70",
            )}
            style={
              reject
                ? {
                    boxShadow:
                      "inset 0 0 0 1px oklch(0.7 0.24 25 / 0.55), 0 0 18px -6px oklch(0.7 0.24 25 / 0.6)",
                  }
                : undefined
            }
          >
            <span className="font-num grid h-6 w-9 shrink-0 place-items-center rounded bg-[var(--rose-gold)]/15 text-[11px] font-bold text-[var(--rose-gold)]">
              H1
            </span>
            <p
              className={cn(
                "font-num text-xs font-medium leading-relaxed transition-colors",
                reject ? "text-[var(--warning)]" : "text-foreground/85",
              )}
            >
              {h1}
            </p>
          </div>
        </div>
      </div>

      {/* Alpha */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <StackedLabel zh="显著性水平" en="Significance Level α" size="sm" />
          <span className="font-num text-sm font-bold text-primary text-glow-cyan">
            α = {alpha.toFixed(2)}
          </span>
        </div>
        <div className="recessed grid grid-cols-3 gap-1.5 rounded-lg p-1.5">
          {ALPHAS.map((a) => {
            const active = a === alpha
            return (
              <button
                key={a}
                type="button"
                onClick={() => onAlpha(a)}
                className={cn(
                  "font-num rounded-md py-2.5 text-sm font-semibold transition-all duration-200",
                  active
                    ? "glow-cyan bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                {a.toFixed(2)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Data sources */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <StackedLabel zh="数据源注入" en="Data Source Injection" size="sm" />
          <div className="flex items-center gap-1.5">
            <MicroButton
              icon={<ClipboardPaste className="h-3 w-3" />}
              label="PASTE"
              onClick={() => {
                pasteInto(onSampleA)
                pasteInto(onSampleB)
              }}
            />
            <MicroButton
              icon={<Trash2 className="h-3 w-3" />}
              label="CLEAR"
              tone="rose"
              onClick={() => {
                onSampleA("")
                onSampleB("")
              }}
            />
          </div>
        </div>

        <SampleInput
          tone="cyan"
          tag="A"
          zh="模腔1尺寸"
          en="Cavity 1 Dim"
          n={nA}
          value={sampleA}
          onChange={onSampleA}
          onPaste={() => pasteInto(onSampleA)}
        />
        <SampleInput
          tone="rose"
          tag="B"
          zh="模腔2尺寸"
          en="Cavity 2 Dim"
          n={nB}
          value={sampleB}
          onChange={onSampleB}
          onPaste={() => pasteInto(onSampleB)}
        />
      </div>
    </section>
  )
}

function MicroButton({
  icon,
  label,
  tone = "cyan",
  onClick,
}: {
  icon: React.ReactNode
  label: string
  tone?: "cyan" | "rose"
  onClick: () => void
}) {
  const accent =
    tone === "cyan"
      ? "text-primary hover:bg-primary/10 glow-cyan-hover"
      : "text-[var(--rose-gold)] hover:bg-[var(--rose-gold)]/10"
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "recessed font-num flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
        accent,
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function SampleInput({
  tone,
  tag,
  zh,
  en,
  n,
  value,
  onChange,
  onPaste,
}: {
  tone: "cyan" | "rose"
  tag: string
  zh: string
  en: string
  n: number
  value: string
  onChange: (v: string) => void
  onPaste: () => void
}) {
  const accent =
    tone === "cyan" ? "text-primary" : "text-[var(--rose-gold)]"
  const tagBg =
    tone === "cyan"
      ? "bg-primary/15 text-primary"
      : "bg-[var(--rose-gold)]/15 text-[var(--rose-gold)]"
  const lineCount = Math.max(2, value.split("\n").length)
  const gutter = Array.from({ length: lineCount }, (_, i) => i + 1)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-num grid h-6 w-6 place-items-center rounded text-[11px] font-bold",
              tagBg,
            )}
          >
            {tag}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold text-foreground">{zh}</span>
            <span className="font-num text-[10px] uppercase tracking-widest text-muted-foreground">
              {en}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPaste}
            title="Paste from clipboard"
            className={cn(
              "rounded p-1 transition-colors hover:bg-white/5",
              accent,
            )}
          >
            <ClipboardPaste className="h-3 w-3" />
          </button>
          <span className={cn("font-num text-[11px]", accent)}>n = {n}</span>
        </div>
      </div>
      <div className="recessed crt-well relative overflow-hidden rounded-lg focus-within:glow-cyan">
        {/* line-number gutter */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 flex w-8 select-none flex-col items-end gap-0 border-r border-border/40 bg-black/20 py-2.5 pr-1.5"
        >
          {gutter.map((ln) => (
            <span
              key={ln}
              className="font-num text-[11px] leading-5 text-muted-foreground/45 tabular-nums"
            >
              {ln.toString().padStart(2, "0")}
            </span>
          ))}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          spellCheck={false}
          wrap="off"
          className="neon-scroll font-num w-full resize-none bg-transparent py-2.5 pl-11 pr-3 text-xs leading-5 text-foreground/90 outline-none placeholder:text-muted-foreground/50"
          placeholder="25.01, 24.98, 25.03 ..."
        />
      </div>
    </div>
  )
}
