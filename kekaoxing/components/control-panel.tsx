"use client"

import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { MATERIAL_PRESETS, toKelvin } from "@/lib/arrhenius"
import { AlertTriangle } from "lucide-react"

interface ControlPanelProps {
  tUse: number
  tTest: number
  ea: number
  testDuration: number
  onTUse: (v: number) => void
  onTTest: (v: number) => void
  onEa: (v: number) => void
  onTestDuration: (v: number) => void
  tempWarning: boolean
}

interface ParamSliderProps {
  label: string
  labelEn: string
  symbol: string
  value: number
  min: number
  max: number
  step?: number
  unit: string
  warning?: boolean
  warningText?: string
  onChange: (v: number) => void
}

// 机械加工质感滑块：玫瑰金轨道 + 铂金嵌入式指示器
const SLIDER_CLASS = cn(
  "[&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-black/40 [&_[data-slot=slider-track]]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]",
  "[&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-[var(--color-copper)] [&_[data-slot=slider-range]]:to-[var(--color-rose-gold-bright)]",
  "[&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border [&_[data-slot=slider-thumb]]:border-[var(--color-rose-gold-bright)]/70 [&_[data-slot=slider-thumb]]:bg-gradient-to-b [&_[data-slot=slider-thumb]]:from-[var(--color-platinum)] [&_[data-slot=slider-thumb]]:to-[var(--color-rose-gold)] [&_[data-slot=slider-thumb]]:shadow-[0_0_10px_rgba(80,160,235,0.6),inset_0_1px_1px_rgba(255,255,255,0.6)] [&_[data-slot=slider-thumb]]:ring-0",
)

function ReadoutBox({
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="metal-edge flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-5 w-14 border-0 bg-transparent p-0 text-right font-mono text-sm font-semibold tabular-nums text-[var(--color-rose-gold-bright)] shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <span className="font-mono text-xs text-muted-foreground">{unit}</span>
    </div>
  )
}

function ParamSlider({
  label,
  labelEn,
  symbol,
  value,
  min,
  max,
  step = 1,
  unit,
  warning = false,
  warningText,
  onChange,
}: ParamSliderProps) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-3">
        <Label className="flex flex-col gap-0.5">
          <span className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
            {label}
            <span className="font-mono text-xs text-[var(--color-rose-gold)]">
              {symbol}
            </span>
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            {labelEn}
          </span>
        </Label>
        <ReadoutBox
          value={value}
          min={min}
          max={max}
          step={step}
          unit={unit}
          onChange={onChange}
        />
      </div>

      <div className="mt-3">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => onChange(v[0])}
          className={SLIDER_CLASS}
        />
      </div>

      {warning && warningText && (
        <div className="mt-2.5 flex items-start gap-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{warningText}</span>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ zh, en }: { zh: string; en: string }) {
  return (
    <div className="metal-edge brushed-metal flex items-center justify-between rounded-lg px-3 py-2">
      <span className="text-xs font-semibold tracking-wide text-[var(--color-rose-gold-bright)]">
        {zh}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {en}
      </span>
    </div>
  )
}

export function ControlPanel({
  tUse,
  tTest,
  ea,
  testDuration,
  onTUse,
  onTTest,
  onEa,
  onTestDuration,
  tempWarning,
}: ControlPanelProps) {
  return (
    <div className="glass-panel metal-edge flex flex-col rounded-2xl">
      {/* 标题 */}
      <div className="metal-edge brushed-metal flex items-center justify-between rounded-t-2xl px-5 py-4">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-inlay-gold">
            参数控制台
          </h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Parameter Console · Deck
          </p>
        </div>
        <span className="metal-edge rounded-full bg-black/30 px-2.5 py-1 font-mono text-[9px] tracking-wider text-[var(--color-sapphire)]">
          CALIBRATED
        </span>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        <SectionHeader zh="信号处理" en="SIGNAL PROCESSING" />

        <ParamSlider
          label="实际工作温度"
          labelEn="Operating Temp"
          symbol="T_use"
          value={tUse}
          min={25}
          max={150}
          unit="°C"
          onChange={onTUse}
        />

        <ParamSlider
          label="加速测试温度"
          labelEn="Stress Temp"
          symbol="T_test"
          value={tTest}
          min={80}
          max={250}
          unit="°C"
          warning={tempWarning}
          warningText="测试温度需高于工作温度，方可产生加速效应"
          onChange={onTTest}
        />

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <SectionHeader zh="计算引擎" en="COMPUTE ENGINE" />

        {/* 激活能 + 材料指纹库 */}
        <div className="py-1">
          <div className="flex items-center justify-between gap-3">
            <Label className="flex flex-col gap-0.5">
              <span className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
                激活能
                <span className="font-mono text-xs text-[var(--color-rose-gold)]">
                  E_a
                </span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                Activation Energy
              </span>
            </Label>
            <ReadoutBox
              value={ea}
              min={0.3}
              max={1.5}
              step={0.1}
              unit="eV"
              onChange={onEa}
            />
          </div>

          <div className="mt-3">
            <Slider
              value={[ea]}
              min={0.3}
              max={1.5}
              step={0.1}
              onValueChange={(v) => onEa(v[0])}
              className={SLIDER_CLASS}
            />
          </div>

          <div className="mt-4">
            <p className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span>材料激活能指纹库</span>
              <span>MATERIAL LIBRARY</span>
            </p>
            <div className="flex flex-col gap-3">
              {(
                [
                  {
                    tier: "system",
                    zh: "成品级判定 · 成品灯",
                    en: "SYSTEM-LEVEL",
                    ring: "ring-[var(--color-sapphire)]/35",
                    dot: "bg-[var(--color-sapphire)]",
                    label: "text-[var(--color-sapphire)]",
                  },
                  {
                    tier: "component",
                    zh: "材料级判定 · 原材料",
                    en: "COMPONENT-LEVEL",
                    ring: "ring-[var(--color-rose-gold)]/35",
                    dot: "bg-[var(--color-rose-gold)]",
                    label: "text-[var(--color-rose-gold)]",
                  },
                ] as const
              ).map((blk) => {
                const items = MATERIAL_PRESETS.filter((p) => p.tier === blk.tier)
                return (
                  <div
                    key={blk.tier}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-xl bg-black/15 p-2.5 ring-1",
                      blk.ring,
                    )}
                  >
                    <p className="flex items-center gap-2 px-0.5 pb-0.5 font-mono text-[9px] uppercase tracking-[0.18em]">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full shadow-[0_0_6px_currentColor]",
                          blk.dot,
                          blk.label,
                        )}
                      />
                      <span className={cn("font-semibold", blk.label)}>
                        {blk.zh}
                      </span>
                      <span className="ml-auto text-muted-foreground/60">
                        {blk.en}
                      </span>
                    </p>
                    {items.map((preset) => {
                      const active = Math.abs(ea - preset.ea) < 0.001
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onEa(preset.ea)}
                          className={cn(
                            "metal-edge flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-all",
                            active
                              ? "brushed-metal glow-rose text-[var(--color-rose-gold-bright)]"
                              : "bg-black/20 text-muted-foreground hover:bg-black/30 hover:text-foreground",
                          )}
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-sans text-[11px] font-medium">
                              {preset.label}
                            </span>
                            <span className="truncate font-mono text-[9px] uppercase tracking-wider opacity-70">
                              {preset.en}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
                              active
                                ? "bg-[var(--color-rose-gold)]/15"
                                : "bg-black/30",
                            )}
                          >
                            {preset.ea.toFixed(2)} eV
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <SectionHeader zh="滤波器" en="FILTERS" />

        <ParamSlider
          label="测试耗时"
          labelEn="Test Duration"
          symbol="Duration"
          value={testDuration}
          min={10}
          max={5000}
          step={10}
          unit="h"
          onChange={onTestDuration}
        />

        {/* 信息读出网格 */}
        <div className="metal-edge brushed-metal mt-1 grid grid-cols-2 gap-px overflow-hidden rounded-lg">
          {[
            { zh: "工作温度 (K)", v: `${toKelvin(tUse).toFixed(2)}` },
            { zh: "测试温度 (K)", v: `${toKelvin(tTest).toFixed(2)}` },
            { zh: "玻尔兹曼常数", v: "8.617e-5" },
            { zh: "ΔT 温差", v: `${(tTest - tUse).toFixed(0)} °C` },
          ].map((item) => (
            <div key={item.zh} className="bg-black/20 px-3 py-2">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {item.zh}
              </p>
              <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-[var(--color-platinum)]">
                {item.v}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
