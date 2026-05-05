"use client"

import { useState, useCallback } from "react"
import { Header } from "@/components/doe/header"
import { FactorBuilder } from "@/components/doe/factor-builder"
import { TaguchiMatrix } from "@/components/doe/taguchi-matrix"
import { AnalyticsPanel } from "@/components/doe/analytics-panel"

interface FactorToggles {
  sliderTemp: boolean
  stage2Hold: boolean
  stage3Hold: boolean
}

interface FactorValues {
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

interface MatrixRow {
  run: number
  factors: number[]
  deviation: string
  scanUploaded: boolean
}

const initialFactorValues: FactorValues = {
  frontMold: ["75", "80", "85"],
  backMold: ["70", "75", "80"],
  sliderMold: ["65", "70", "75"],
  stage1Pressure: ["55", "60", "65"],
  stage1Time: ["2.0", "2.5", "3.0"],
  stage2Pressure: ["45", "50", "55"],
  stage2Time: ["2.5", "3.0", "3.5"],
  stage3Pressure: ["35", "40", "45"],
  stage3Time: ["1.5", "2.0", "2.5"],
}

// Generate orthogonal array based on type
function generateOrthogonalArray(type: "L9" | "L18" | "L27"): number[][] {
  const arrays: Record<string, number[][]> = {
    L9: [
      [1, 1, 1, 1], [1, 2, 2, 2], [1, 3, 3, 3],
      [2, 1, 2, 3], [2, 2, 3, 1], [2, 3, 1, 2],
      [3, 1, 3, 2], [3, 2, 1, 3], [3, 3, 2, 1],
    ],
    L18: [
      [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 2, 2, 2, 2, 2, 2], [1, 1, 3, 3, 3, 3, 3, 3],
      [1, 2, 1, 1, 2, 2, 3, 3], [1, 2, 2, 2, 3, 3, 1, 1], [1, 2, 3, 3, 1, 1, 2, 2],
      [1, 3, 1, 2, 1, 3, 2, 3], [1, 3, 2, 3, 2, 1, 3, 1], [1, 3, 3, 1, 3, 2, 1, 2],
      [2, 1, 1, 3, 3, 2, 2, 1], [2, 1, 2, 1, 1, 3, 3, 2], [2, 1, 3, 2, 2, 1, 1, 3],
      [2, 2, 1, 2, 3, 1, 3, 2], [2, 2, 2, 3, 1, 2, 1, 3], [2, 2, 3, 1, 2, 3, 2, 1],
      [2, 3, 1, 3, 2, 3, 1, 2], [2, 3, 2, 1, 3, 1, 2, 3], [2, 3, 3, 2, 1, 2, 3, 1],
    ],
    L27: Array.from({ length: 27 }, (_, i) => {
      const row: number[] = []
      for (let j = 0; j < 13; j++) {
        row.push(((Math.floor(i / Math.pow(3, j % 3)) + j) % 3) + 1)
      }
      return row
    })
  }
  return arrays[type]
}

function initializeMatrixData(arrayType: "L9" | "L18" | "L27"): MatrixRow[] {
  const baseArray = generateOrthogonalArray(arrayType)

  return baseArray.map((factors, index) => ({
    run: index + 1,
    factors,
    deviation: "",
    scanUploaded: false,
  }))
}

export default function DOEDashboard() {
  const [factors, setFactors] = useState<FactorToggles>({
    sliderTemp: false,
    stage2Hold: false,
    stage3Hold: false,
  })

  const [factorValues, setFactorValues] = useState<FactorValues>(initialFactorValues)
  const [matrixData, setMatrixData] = useState<MatrixRow[]>([])
  const [matrixGenerated, setMatrixGenerated] = useState(false)

  // Calculate array type based on active factors
  const getArrayType = useCallback((): "L9" | "L18" | "L27" => {
    const count = 4 + (factors.sliderTemp ? 1 : 0) +
      (factors.stage2Hold ? 2 : 0) + (factors.stage3Hold ? 2 : 0)
    if (count <= 4) return "L9"
    if (count <= 8) return "L18"
    return "L27"
  }, [factors])

  // Get active factor names
  const getActiveFactors = useCallback((): string[] => {
    const active = ["前模", "后模", "P1", "T1"]
    if (factors.sliderTemp) active.splice(2, 0, "滑块")
    if (factors.stage2Hold) active.push("P2", "T2")
    if (factors.stage3Hold) active.push("P3", "T3")
    return active
  }, [factors])

  const handleFactorToggle = useCallback((factor: keyof FactorToggles) => {
    setFactors(prev => ({ ...prev, [factor]: !prev[factor] }))
    setMatrixGenerated(false)
    setMatrixData([])
  }, [])

  const handleValueChange = useCallback((
    factor: keyof FactorValues,
    level: number,
    value: string
  ) => {
    setFactorValues(prev => {
      const updated = [...prev[factor]] as [string, string, string]
      updated[level] = value
      return { ...prev, [factor]: updated }
    })
  }, [])

  const handleGenerateMatrix = useCallback(() => {
    const arrayType = getArrayType()
    setMatrixData(initializeMatrixData(arrayType))
    setMatrixGenerated(true)
  }, [getArrayType])

  const handleDeviationChange = useCallback((run: number, value: string) => {
    setMatrixData(prev => prev.map(row =>
      row.run === run ? { ...row, deviation: value } : row
    ))
  }, [])

  const handleScanUpload = useCallback((run: number) => {
    setMatrixData(prev => prev.map(row =>
      row.run === run ? { ...row, scanUploaded: true } : row
    ))
  }, [])

  const hasData = matrixData.some(row => row.deviation !== "" || row.scanUploaded)

  return (
    <div className="min-h-screen bg-black">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#00E5FF]/[0.02] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/[0.02] rounded-full blur-[150px]" />
      </div>

      <Header />

      <main className="relative max-w-[1400px] mx-auto px-8 py-10 space-y-14">
        {/* Section A: Factor Builder */}
        <FactorBuilder
          factors={factors}
          onFactorToggle={handleFactorToggle}
          factorValues={factorValues}
          onValueChange={handleValueChange}
        />

        {/* Section B: Taguchi Matrix */}
        <TaguchiMatrix
          arrayType={getArrayType()}
          activeFactors={getActiveFactors()}
          onGenerate={handleGenerateMatrix}
          matrixData={matrixData}
          onDeviationChange={handleDeviationChange}
          onScanUpload={handleScanUpload}
        />

        {/* Section C: Analytics */}
        <AnalyticsPanel hasData={hasData || matrixGenerated} />
      </main>

      {/* Footer */}
      <footer className="relative max-w-[1400px] mx-auto px-8 py-8 mt-8">
        <div className="flex items-center justify-between pt-6 border-t border-white/[0.06]">
          <div className="flex items-center gap-6 text-[10px] font-mono text-white/20 uppercase tracking-wider">
            <span>Precision Injection Molding Systems</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Logitech Engineering</span>
          </div>
          <div className="text-[10px] font-mono text-white/30">
            Taguchi DOE Module <span className="text-[#00E5FF]/50">v3.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
