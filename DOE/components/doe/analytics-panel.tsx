"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts"
import { Activity, Box, Zap, TrendingUp, Terminal, Play } from "lucide-react"

const mockMainEffectsData = [
  { level: "L1", frontMold: 0.12, backMold: 0.08, pressure: 0.15, time: 0.10 },
  { level: "L2", frontMold: 0.07, backMold: 0.11, pressure: 0.06, time: 0.08 },
  { level: "L3", frontMold: 0.14, backMold: 0.05, pressure: 0.11, time: 0.12 },
]

interface AnalyticsPanelProps {
  hasData: boolean
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card-elevated rounded-xl px-4 py-3 border border-white/15">
        <p className="text-[10px] text-white/50 mb-2 uppercase tracking-wider">{label}</p>
        {payload.map((entry, idx) => (
          <p key={idx} className="text-xs font-mono flex items-center gap-2" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}: <span className="font-semibold">{entry.value.toFixed(4)}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function AnalyticsPanel({ hasData }: AnalyticsPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsAnalyzing(false)
    setShowResults(true)
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="section-label mb-2">Section C</div>
          <h2 className="text-xl font-semibold text-white tracking-tight">分析与优化看板</h2>
          <p className="text-sm text-white/40 mt-1">Analytics Dashboard - Palantir Style</p>
        </div>
        {!showResults && (
          <motion.button
            onClick={handleAnalyze}
            disabled={!hasData || isAnalyzing}
            className={`px-6 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold transition-all ${
              hasData
                ? isAnalyzing
                  ? "glass-card-elevated"
                  : "btn-premium-solid btn-pulse"
                : "glass-inner text-white/30 cursor-not-allowed"
            }`}
            whileHover={hasData && !isAnalyzing ? { scale: 1.02, y: -2 } : {}}
            whileTap={hasData && !isAnalyzing ? { scale: 0.98 } : {}}
          >
            {isAnalyzing ? (
              <>
                <motion.div
                  className="w-5 h-5 border-2 border-[#00E5FF]/30 border-t-[#00E5FF] rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                <span className="text-white/70">分析中...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>运行田口信噪比分析</span>
                <span className="text-black/50 font-normal text-xs">Execute S/N Analytics</span>
              </>
            )}
          </motion.button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Effects Chart */}
        <div className="glass-card-elevated rounded-2xl p-6 radial-glow overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/25">
              <TrendingUp className="w-5 h-5 text-[#00E5FF]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">主效应分析图</h3>
              <p className="text-xs text-white/40">Main Effects Plot</p>
            </div>
          </div>

          <div className="h-64">
            {showResults ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockMainEffectsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientTeal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradientIndigo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradientEmerald" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradientAmber" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="level"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    domain={[0, 0.2]}
                    tickFormatter={(v) => v.toFixed(2)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="frontMold"
                    name="前模温度"
                    stroke="#00E5FF"
                    strokeWidth={2.5}
                    fill="url(#gradientTeal)"
                    dot={{ fill: '#00E5FF', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#00E5FF', stroke: '#000', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="backMold"
                    name="后模温度"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#gradientIndigo)"
                    dot={{ fill: '#6366f1', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#6366f1', stroke: '#000', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pressure"
                    name="保压压力"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#gradientEmerald)"
                    dot={{ fill: '#10b981', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#10b981', stroke: '#000', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="time"
                    name="保压时间"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fill="url(#gradientAmber)"
                    dot={{ fill: '#f59e0b', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#f59e0b', stroke: '#000', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl glass-inner flex items-center justify-center">
                    <TrendingUp className="w-10 h-10 text-white/15" />
                  </div>
                  <p className="text-sm text-white/30">运行分析以查看图表</p>
                  <p className="text-xs text-white/20 mt-1">Run analysis to view chart</p>
                </div>
              </div>
            )}
          </div>

          {showResults && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-4 border-t border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.5)]" />
                <span className="text-[11px] text-white/60">前模温度</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                <span className="text-[11px] text-white/60">后模温度</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[11px] text-white/60">保压压力</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <span className="text-[11px] text-white/60">保压时间</span>
              </div>
            </div>
          )}
        </div>

        {/* 3D Heatmap Viewer */}
        <div className="glass-card-elevated rounded-2xl p-6 radial-glow-indigo overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
              <Box className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">偏差热力图查看器</h3>
              <p className="text-xs text-white/40">3D Deviation Heatmap Viewer</p>
            </div>
          </div>

          <div className="h-64 relative rounded-xl overflow-hidden border border-white/[0.08] bg-black/50">
            {/* High-tech frame corners */}
            <div className="absolute top-0 left-0 w-12 h-12">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#00E5FF]/60 to-transparent" />
              <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-[#00E5FF]/60 to-transparent" />
            </div>
            <div className="absolute top-0 right-0 w-12 h-12">
              <div className="absolute top-0 right-0 w-full h-[2px] bg-gradient-to-l from-[#00E5FF]/60 to-transparent" />
              <div className="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-[#00E5FF]/60 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 w-12 h-12">
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#00E5FF]/60 to-transparent" />
              <div className="absolute bottom-0 left-0 w-[2px] h-full bg-gradient-to-t from-[#00E5FF]/60 to-transparent" />
            </div>
            <div className="absolute bottom-0 right-0 w-12 h-12">
              <div className="absolute bottom-0 right-0 w-full h-[2px] bg-gradient-to-l from-[#00E5FF]/60 to-transparent" />
              <div className="absolute bottom-0 right-0 w-[2px] h-full bg-gradient-to-t from-[#00E5FF]/60 to-transparent" />
            </div>

            {/* 3D Viewer Placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="relative">
                  <motion.div
                    className="absolute -inset-8 rounded-full border border-[#00E5FF]/20"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute -inset-4 rounded-full border border-indigo-500/20"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                  />
                  <div className="w-20 h-20 rounded-2xl glass-inner flex items-center justify-center">
                    <Box className="w-10 h-10 text-white/20" />
                  </div>
                </div>
                <p className="text-sm text-white/30 mt-6">3D 模型查看器</p>
                <p className="text-xs text-white/20 mt-1">Upload scan data to visualize</p>
              </div>
            </div>

            {/* Subtle grid overlay */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `
                linear-gradient(rgba(0,229,255,1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,229,255,1) 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px'
            }} />
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-white/40">状态:</span>
              <span className="text-[11px] text-white/60 font-medium">等待数据上传</span>
            </div>
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 rounded-full bg-amber-500"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[11px] text-amber-500/80 font-medium">Standby</span>
            </div>
          </div>
        </div>
      </div>

      {/* Optimal Parameters Terminal Card */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="glass-card-elevated rounded-2xl p-6 glow-teal-intense border-pulse"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/25">
                <Zap className="w-5 h-5 text-[#00E5FF]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">最优参数推荐</h3>
                <p className="text-xs text-white/40">Optimal Parameter Recommendation</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 status-dot" />
                <span className="text-xs text-emerald-400 font-medium">Analysis Complete</span>
              </div>
            </div>

            <div className="terminal-box rounded-xl p-5 font-mono text-sm">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/[0.06]">
                <Terminal className="w-4 h-4 text-[#00E5FF]/70" />
                <span className="text-[#00E5FF]/70">taguchi_optimizer</span>
                <span className="text-white/40">--mode optimal --confidence 0.95</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-2">模温系统</p>
                  <p><span className="text-[#00E5FF]">前模温度:</span> <span className="text-emerald-400 font-semibold">85°C</span> <span className="text-white/30">(L2)</span></p>
                  <p><span className="text-[#00E5FF]">后模温度:</span> <span className="text-emerald-400 font-semibold">82°C</span> <span className="text-white/30">(L3)</span></p>
                </div>
                <div className="space-y-2">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-2">保压系统</p>
                  <p><span className="text-indigo-400">第一段压力:</span> <span className="text-emerald-400 font-semibold">65 MPa</span> <span className="text-white/30">(L2)</span></p>
                  <p><span className="text-indigo-400">第一段时间:</span> <span className="text-emerald-400 font-semibold">2.5s</span> <span className="text-white/30">(L1)</span></p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.06] space-y-1">
                <p className="text-white/50">
                  <span className="text-white/30">预测偏差:</span> <span className="text-emerald-400 font-bold">0.042mm</span> <span className="text-white/30">(±0.008)</span>
                </p>
                <p className="text-white/50">
                  <span className="text-white/30">信噪比:</span> <span className="text-[#00E5FF] font-bold">28.7 dB</span>
                </p>
                <p className="text-white/50">
                  <span className="text-white/30">置信度:</span> <span className="text-[#00E5FF] font-bold">94.7%</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
