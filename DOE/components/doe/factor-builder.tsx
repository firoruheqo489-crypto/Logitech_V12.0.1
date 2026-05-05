"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Thermometer, Gauge, Timer, Layers } from "lucide-react"
import { PremiumToggle } from "./premium-toggle"

interface FactorBuilderProps {
  factors: {
    sliderTemp: boolean
    stage2Hold: boolean
    stage3Hold: boolean
  }
  onFactorToggle: (factor: keyof FactorBuilderProps["factors"]) => void
  factorValues: {
    frontMold: [string, string, string]
    backMold: [string, string, string]
    sliderMold: [string, string, string]
    stage1Pressure: [string, string, string]
    stage1Time: [string, string, string]
    stage2Pressure: [string, string, string]
    stage2Time: [string, string, string]
    stage3Pressure: [string, string, string]
    stage3Time: [string, string, string]
  }
  onValueChange: (factor: keyof FactorBuilderProps["factorValues"], level: number, value: string) => void
}

function LevelInputs({
  label,
  labelCn,
  icon: Icon,
  unit,
  values,
  onChange,
  accentColor = "teal",
  disabled = false
}: {
  label: string
  labelCn: string
  icon: React.ElementType
  unit: string
  values: [string, string, string]
  onChange: (level: number, value: string) => void
  accentColor?: "teal" | "indigo"
  disabled?: boolean
}) {
  const iconBg = accentColor === "teal"
    ? "bg-[#00E5FF]/10 border-[#00E5FF]/25"
    : "bg-indigo-500/10 border-indigo-500/25"
  const iconColor = accentColor === "teal" ? "text-[#00E5FF]" : "text-indigo-400"

  return (
    <motion.div
      className={`space-y-3 transition-all duration-300 ${disabled ? "factor-disabled" : ""}`}
      animate={{ opacity: disabled ? 0.3 : 1 }}
    >
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-lg ${iconBg} border`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div>
          <span className="text-sm font-medium text-white/90">{label}</span>
          <span className="text-xs text-white/40 ml-2">{labelCn}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((level, idx) => (
          <div key={level} className="relative group">
            <span className={`absolute -top-2 left-3 text-[9px] font-bold tracking-wider uppercase z-10 px-1.5 py-0.5 rounded ${
              level === 1 ? "bg-emerald-500/20 text-emerald-400" :
              level === 2 ? "bg-amber-500/20 text-amber-400" :
              "bg-rose-500/20 text-rose-400"
            }`}>
              L{level}
            </span>
            <input
              type="text"
              value={values[idx]}
              onChange={(e) => onChange(idx, e.target.value)}
              placeholder="—"
              disabled={disabled}
              className="w-full h-12 px-3 pt-1 rounded-xl premium-input text-white/90 text-sm font-mono text-center placeholder:text-white/20 focus:outline-none disabled:cursor-not-allowed"
            />
            <span className="absolute right-3 bottom-3 text-[10px] text-white/30 font-mono">{unit}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export function FactorBuilder({ factors, onFactorToggle, factorValues, onValueChange }: FactorBuilderProps) {
  const activeFactorCount = 4 + (factors.sliderTemp ? 1 : 0) +
    (factors.stage2Hold ? 2 : 0) + (factors.stage3Hold ? 2 : 0)

  const getArrayType = () => {
    if (activeFactorCount <= 4) return "L9"
    if (activeFactorCount <= 8) return "L18"
    return "L27"
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="section-label mb-2">Section A</div>
          <h2 className="text-xl font-semibold text-white tracking-tight">因子配置构建器</h2>
          <p className="text-sm text-white/40 mt-1">Factor Configuration Builder - 按需配置乐高模式</p>
        </div>
        <div className="flex items-center gap-4 px-5 py-3 rounded-2xl glass-card-elevated">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">激活因子</span>
            <span className="text-2xl font-bold font-mono text-[#00E5FF]">{activeFactorCount}</span>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">正交阵列</span>
            <span className="text-2xl font-bold font-mono text-[#00E5FF]">{getArrayType()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mold Temperature System */}
        <div className="glass-card-elevated rounded-2xl p-6 space-y-6 radial-glow overflow-hidden">
          <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
            <div className="p-2.5 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/25">
              <Thermometer className="w-5 h-5 text-[#00E5FF]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">模温系统</h3>
              <p className="text-xs text-white/40">Mold Temperature System</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Layers className="w-4 h-4 text-white/30" />
              <span className="text-xs font-mono text-white/40">{factors.sliderTemp ? 3 : 2} vars</span>
            </div>
          </div>

          {/* Default Factors: Front & Back Mold */}
          <LevelInputs
            label="前模温度"
            labelCn="Front Mold Temp"
            icon={Thermometer}
            unit="°C"
            values={factorValues.frontMold}
            onChange={(l, v) => onValueChange("frontMold", l, v)}
          />
          <LevelInputs
            label="后模温度"
            labelCn="Back Mold Temp"
            icon={Thermometer}
            unit="°C"
            values={factorValues.backMold}
            onChange={(l, v) => onValueChange("backMold", l, v)}
          />

          {/* Toggle: Slider Temp */}
          <div className="pt-2">
            <PremiumToggle
              enabled={factors.sliderTemp}
              onToggle={() => onFactorToggle("sliderTemp")}
              label="启用滑块模温机"
              labelCn="Enable Slider Temperature"
            />
          </div>

          <AnimatePresence>
            {factors.sliderTemp && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <LevelInputs
                  label="滑块模温"
                  labelCn="Slider Mold Temp"
                  icon={Thermometer}
                  unit="°C"
                  values={factorValues.sliderMold}
                  onChange={(l, v) => onValueChange("sliderMold", l, v)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Holding Pressure System */}
        <div className="glass-card-elevated rounded-2xl p-6 space-y-6 radial-glow-indigo overflow-hidden">
          <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
              <Gauge className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">保压系统</h3>
              <p className="text-xs text-white/40">Holding Pressure System</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Layers className="w-4 h-4 text-white/30" />
              <span className="text-xs font-mono text-white/40">
                {2 + (factors.stage2Hold ? 2 : 0) + (factors.stage3Hold ? 2 : 0)} vars
              </span>
            </div>
          </div>

          {/* Stage 1 - Always Active */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 rounded-full bg-indigo-500/50" />
              <span className="text-xs font-semibold tracking-wider text-indigo-400/90 uppercase">
                第一段保压 — Stage 1
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <LevelInputs
                label="压力"
                labelCn="Pressure"
                icon={Gauge}
                unit="MPa"
                values={factorValues.stage1Pressure}
                onChange={(l, v) => onValueChange("stage1Pressure", l, v)}
                accentColor="indigo"
              />
              <LevelInputs
                label="时间"
                labelCn="Time"
                icon={Timer}
                unit="s"
                values={factorValues.stage1Time}
                onChange={(l, v) => onValueChange("stage1Time", l, v)}
                accentColor="indigo"
              />
            </div>
          </div>

          {/* Toggle: Stage 2 */}
          <div className="pt-2">
            <PremiumToggle
              enabled={factors.stage2Hold}
              onToggle={() => onFactorToggle("stage2Hold")}
              label="启用第二段保压"
              labelCn="Enable Stage 2 Hold"
            />
          </div>

          <AnimatePresence>
            {factors.stage2Hold && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 rounded-full bg-indigo-500/40" />
                    <span className="text-xs font-semibold tracking-wider text-indigo-400/70 uppercase">
                      第二段保压 — Stage 2
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <LevelInputs
                      label="压力"
                      labelCn="Pressure"
                      icon={Gauge}
                      unit="MPa"
                      values={factorValues.stage2Pressure}
                      onChange={(l, v) => onValueChange("stage2Pressure", l, v)}
                      accentColor="indigo"
                    />
                    <LevelInputs
                      label="时间"
                      labelCn="Time"
                      icon={Timer}
                      unit="s"
                      values={factorValues.stage2Time}
                      onChange={(l, v) => onValueChange("stage2Time", l, v)}
                      accentColor="indigo"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle: Stage 3 */}
          <div className="pt-2">
            <PremiumToggle
              enabled={factors.stage3Hold}
              onToggle={() => onFactorToggle("stage3Hold")}
              label="启用第三段保压"
              labelCn="Enable Stage 3 Hold"
            />
          </div>

          <AnimatePresence>
            {factors.stage3Hold && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 rounded-full bg-indigo-500/30" />
                    <span className="text-xs font-semibold tracking-wider text-indigo-400/50 uppercase">
                      第三段保压 — Stage 3
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <LevelInputs
                      label="压力"
                      labelCn="Pressure"
                      icon={Gauge}
                      unit="MPa"
                      values={factorValues.stage3Pressure}
                      onChange={(l, v) => onValueChange("stage3Pressure", l, v)}
                      accentColor="indigo"
                    />
                    <LevelInputs
                      label="时间"
                      labelCn="Time"
                      icon={Timer}
                      unit="s"
                      values={factorValues.stage3Time}
                      onChange={(l, v) => onValueChange("stage3Time", l, v)}
                      accentColor="indigo"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
