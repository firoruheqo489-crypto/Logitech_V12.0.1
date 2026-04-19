"use client"

import { useState, useMemo } from "react"
import { FAISidebar, computeAggregatedStatus } from "./fai-sidebar"
import { ToleranceMap } from "./tolerance-map"
import { DiagnosticAssertion } from "./diagnostic-assertion"
import { SPCDistributionChart } from "./spc-distribution-chart"
import { CavityGrid } from "./cavity-grid"
import {
  faiItemsBase,
  faiSpecs,
  generateCavityData,
  generateSPCChartData,
} from "@/lib/fai-mock-data"
import { Activity, Gauge, BarChart3 } from "lucide-react"

export function FAIDashboard() {
  const [selectedFAI, setSelectedFAI] = useState("fai1")

  const spec = faiSpecs[selectedFAI]
  const faiItemBase = faiItemsBase.find((f) => f.id === selectedFAI)

  const spcData = useMemo(() => generateSPCChartData(selectedFAI), [selectedFAI])
  const cavityData = useMemo(
    () => generateCavityData(selectedFAI, faiItemBase?.cavities ?? 16),
    [selectedFAI, faiItemBase?.cavities]
  )

  // Compute aggregated status for all FAI items based on their cavity data
  const faiItems = useMemo(() => {
    return faiItemsBase.map((item) => {
      const cavities = generateCavityData(item.id, item.cavities)
      return {
        ...item,
        aggregatedStatus: computeAggregatedStatus(cavities),
      }
    })
  }, [])

  const faiItem = faiItems.find((f) => f.id === selectedFAI)

  if (!spec || !faiItem) return null

  // Ppk (Process Performance Index) - appropriate for FAI stage
  const ppk = Math.min(
    (spec.usl - spec.actual) / (3 * spec.stddev),
    (spec.actual - spec.lsl) / (3 * spec.stddev)
  )
  
  // Calculate statistics from actual cavity data
  const cavityValues = cavityData.map((c) => c.value)
  const cavityMean = cavityValues.reduce((a, b) => a + b, 0) / cavityValues.length
  const cavityStdDev = Math.sqrt(
    cavityValues.reduce((sum, v) => sum + Math.pow(v - cavityMean, 2), 0) / cavityValues.length
  )
  const cavityRange = Math.max(...cavityValues) - Math.min(...cavityValues)

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Left Sidebar */}
      <FAISidebar
        items={faiItems}
        selectedId={selectedFAI}
        onSelect={setSelectedFAI}
      />

      {/* Right Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground font-mono tracking-wide">
                FAI DIMENSION ANALYZER
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                {faiItem.label} &mdash; {faiItem.cavities} CAVITIES &mdash;{" "}
                SPEC: {spec.lsl} ~ {spec.usl} {spec.unit}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StatusPill
              icon={<Gauge className="h-3.5 w-3.5" />}
              label="Ppk"
              value={ppk.toFixed(2)}
              good={ppk >= 1.33}
            />
            <StatusPill
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              label="YIELD"
              value={`${(
                (cavityData.filter((c) => c.status === "OK").length /
                  cavityData.length) *
                100
              ).toFixed(1)}%`}
              good={
                cavityData.filter((c) => c.status === "OK").length /
                  cavityData.length >=
                0.95
              }
            />
          </div>
        </header>

        {/* Content Grid */}
        <main className="flex-1 overflow-auto p-4">
          <div className="flex flex-col gap-4">
            {/* Module A: Tolerance Map */}
            <ToleranceMap
              nominal={spec.nominal}
              actual={cavityMean}
              usl={spec.usl}
              lsl={spec.lsl}
              unit={spec.unit}
              stdDev={cavityStdDev}
              range={cavityRange}
              ppk={ppk}
            />

            {/* Diagnostic Assertion - Data Audit Checklist */}
            <DiagnosticAssertion
              cavityData={cavityData}
              actualMean={cavityMean}
              nominal={spec.nominal}
              usl={spec.usl}
              lsl={spec.lsl}
            />

            {/* Module B: SPC Distribution */}
            <SPCDistributionChart
              data={spcData.data}
              usl={spec.usl}
              lsl={spec.lsl}
              mean={spec.actual}
              nominal={spcData.nominal}
            />

            {/* Module C: Cavity Grid */}
            <CavityGrid
              cavities={cavityData}
              usl={spec.usl}
              lsl={spec.lsl}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

function StatusPill({
  icon,
  label,
  value,
  good,
}: {
  icon: React.ReactNode
  label: string
  value: string
  good: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
        good
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-destructive/30 bg-destructive/5 text-destructive"
      }`}
    >
      {icon}
      <span className="text-xs font-mono font-semibold">
        {label}: {value}
      </span>
    </div>
  )
}
