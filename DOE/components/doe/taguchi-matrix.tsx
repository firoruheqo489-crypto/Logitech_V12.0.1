"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Grid3X3, Upload, Check, Scan, ChevronDown, ChevronUp, Sparkles } from "lucide-react"

interface MatrixRow {
  run: number
  factors: number[]
  deviation: string
  scanUploaded: boolean
}

interface TaguchiMatrixProps {
  arrayType: "L9" | "L18" | "L27"
  activeFactors: string[]
  onGenerate: () => void
  matrixData: MatrixRow[]
  onDeviationChange: (run: number, value: string) => void
  onScanUpload: (run: number) => void
}

export function TaguchiMatrix({
  arrayType,
  activeFactors,
  onGenerate,
  matrixData,
  onDeviationChange,
  onScanUpload
}: TaguchiMatrixProps) {
  const [isGenerated, setIsGenerated] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const rowCount = parseInt(arrayType.slice(1))

  const handleGenerate = async () => {
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    setIsGenerated(true)
    setIsGenerating(false)
    onGenerate()
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="section-label mb-2">Section B</div>
          <h2 className="text-xl font-semibold text-white tracking-tight">田口正交阵列矩阵</h2>
          <p className="text-sm text-white/40 mt-1">Taguchi Orthogonal Array Matrix & 3D Scan Upload</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl glass-card">
            <Grid3X3 className="w-4 h-4 text-[#00E5FF]/70" />
            <span className="text-lg font-mono font-bold text-[#00E5FF]">{arrayType}</span>
            <div className="w-px h-5 bg-white/10" />
            <span className="text-xs text-white/50">{rowCount} 组实验</span>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      {!isGenerated && (
        <motion.button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`w-full py-5 rounded-2xl flex items-center justify-center gap-4 text-base font-semibold transition-all ${
            isGenerating
              ? "glass-card-elevated"
              : "btn-premium-solid btn-pulse"
          }`}
          whileHover={!isGenerating ? { scale: 1.01, y: -2 } : {}}
          whileTap={!isGenerating ? { scale: 0.99 } : {}}
        >
          {isGenerating ? (
            <>
              <motion.div
                className="w-5 h-5 border-2 border-[#00E5FF]/30 border-t-[#00E5FF] rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
              <span className="text-white/70">正在生成矩阵...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>生成正交矩阵</span>
              <span className="text-black/50 font-normal">Generate Matrix</span>
            </>
          )}
        </motion.button>
      )}

      {/* Matrix Table */}
      <AnimatePresence>
        {isGenerated && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="glass-card-elevated rounded-2xl overflow-hidden glow-teal">
              {/* Table Header Toggle */}
              <button
                className="flex items-center justify-between w-full px-6 py-4 border-b border-white/[0.08] hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpanded(!expanded)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/20">
                    <Grid3X3 className="w-4 h-4 text-[#00E5FF]" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-medium text-white">实验运行数据</span>
                    <span className="text-xs text-white/40 ml-3">Experimental Runs</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#00E5FF]/70">{rowCount} runs</span>
                  <motion.div
                    animate={{ rotate: expanded ? 0 : 180 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronUp className="w-4 h-4 text-white/40" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="max-h-[500px] overflow-auto">
                      <table className="w-full">
                        <thead className="sticky-header">
                          <tr className="border-b border-white/[0.08]">
                            <th className="px-4 py-4 text-left text-[10px] font-bold text-white/50 uppercase tracking-wider w-16">
                              Run
                            </th>
                            {activeFactors.slice(0, Math.min(activeFactors.length, 8)).map((factor, idx) => (
                              <th key={idx} className="px-3 py-4 text-center text-[10px] font-bold text-white/50 uppercase tracking-wider">
                                {factor}
                              </th>
                            ))}
                            <th className="px-4 py-4 text-center text-[10px] font-bold text-[#00E5FF]/80 uppercase tracking-wider w-32">
                              最大偏差
                            </th>
                            <th className="px-4 py-4 text-center text-[10px] font-bold text-[#00E5FF]/80 uppercase tracking-wider w-44">
                              3D扫描热力图
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {matrixData.slice(0, rowCount).map((row, rowIdx) => (
                            <motion.tr
                              key={row.run}
                              className="data-row border-b border-white/[0.04] last:border-b-0"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: rowIdx * 0.03 }}
                            >
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/20">
                                  <span className="text-sm font-mono font-bold text-[#00E5FF]">
                                    {String(row.run).padStart(2, '0')}
                                  </span>
                                </div>
                              </td>
                              {row.factors.slice(0, Math.min(activeFactors.length, 8)).map((level, colIdx) => (
                                <td key={colIdx} className="px-3 py-4 text-center">
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-mono font-semibold level-${level}`}>
                                    {level}
                                  </span>
                                </td>
                              ))}
                              <td className="px-4 py-4">
                                <input
                                  type="text"
                                  value={row.deviation}
                                  onChange={(e) => onDeviationChange(row.run, e.target.value)}
                                  placeholder="0.000"
                                  className="w-full h-9 px-3 rounded-lg premium-input text-white/90 text-xs font-mono text-center placeholder:text-white/20 focus:outline-none"
                                />
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  onClick={() => onScanUpload(row.run)}
                                  className={`w-full h-9 rounded-lg flex items-center justify-center gap-2 text-[11px] font-medium transition-all ${
                                    row.scanUploaded
                                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                      : "dropzone"
                                  }`}
                                >
                                  {row.scanUploaded ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>已上传</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3.5 h-3.5 text-white/40" />
                                      <span className="text-white/40">上传3D扫描</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Table Footer Stats */}
              <div className="px-6 py-4 border-t border-white/[0.06] bg-black/20">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">已完成:</span>
                      <span className="font-mono text-[#00E5FF]">
                        {matrixData.filter(r => r.deviation !== "").length}/{rowCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40">扫描上传:</span>
                      <span className="font-mono text-emerald-400">
                        {matrixData.filter(r => r.scanUploaded).length}/{rowCount}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded level-1 text-[8px] flex items-center justify-center">1</span>
                      <span className="text-white/30">Low</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded level-2 text-[8px] flex items-center justify-center">2</span>
                      <span className="text-white/30">Mid</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded level-3 text-[8px] flex items-center justify-center">3</span>
                      <span className="text-white/30">High</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
