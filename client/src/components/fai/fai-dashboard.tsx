"use client"

import { useMemo, useRef, useState } from "react"
import { FAISidebar, computeAggregatedStatus } from "./fai-sidebar"
import { ToleranceMap } from "./tolerance-map"
import { DiagnosticAssertion } from "./diagnostic-assertion"
import { generateSPCData, SPCDistributionChart } from "./spc-distribution-chart"
import { CavityGrid } from "./cavity-grid"
import {
  faiItemsBase,
  faiSpecs,
  generateCavityData,
  generateSPCChartData,
} from "@/lib/fai-mock-data"
import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog"
import { Activity, BarChart3, Gauge, Trash2, UploadCloud } from "lucide-react"

type CavityPoint = {
  id: string
  label: string
  value: number
  status: "OK" | "+NG" | "-NG"
}

type ParsedFaiData = {
  faiId: string
  nominal: number
  usl: number
  lsl: number
  flatValues: number[]
  cavityMatrix: { cavity: string; value: number }[]
  cavityShots?: { cavity: string; shot: 1 | 2 | 3; value: number }[]
}

const DIM_HEADER_CANDIDATES = ["Dim. #", "Dim #", "Dim.#", "Dim#"]
const CAVITY_HEADER_CANDIDATES = ["Cavity #", "Cavity#", "Cavity"]
const FOS_HEADER_CANDIDATES = ["FOS", "FOS (Nominal)", "FOS(Nominal)"]
const PLUS_TOL_HEADER_CANDIDATES = [
  "Plus Tol (+)",
  "Plus Tol(+)",
  "Plus Tol",
  "Plus\nTol (+)",
]
const MINUS_TOL_HEADER_CANDIDATES = [
  "Minus Tol (-)",
  "Minus Tol(-)",
  "Minus Tol",
  "Minus\nTol (-)",
]
const USL_HEADER_CANDIDATES = ["USL", "Upper Spec", "Upper Limit"]
const LSL_HEADER_CANDIDATES = ["LSL", "Lower Spec", "Lower Limit"]

function roundToFour(value: number): number {
  return Number(value.toFixed(4))
}

function roundToThree(value: number): number {
  return Number(Math.round((value + Number.EPSILON) * 1000) / 1000)
}

function normalizeHeaderKey(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function normalizeCompactHeaderKey(value: string): string {
  return normalizeHeaderKey(value).replace(/[^a-z0-9#+.-]/g, "")
}

function isDimHeaderKey(value: string): boolean {
  const normalized = normalizeHeaderKey(value)
  if (normalized.includes("dim type")) return false
  return (
    normalized === "dim" ||
    normalized === "dim #" ||
    normalized === "dim.#" ||
    (normalized.includes("dim") && normalized.includes("#"))
  )
}

function isShotHeaderKey(value: string, shot: 1 | 2 | 3): boolean {
  const compact = normalizeCompactHeaderKey(value)
  const target = `shot${shot}`
  return compact === target || compact.startsWith(`${target}_`) || compact.startsWith(`${target}-`)
}

function hasRequiredParserHeaders(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false

  const keys = Object.keys(rows[0] ?? {})
  const hasDim = keys.some(isDimHeaderKey)
  const hasShot1 = keys.some((key) => isShotHeaderKey(key, 1))

  return hasDim && hasShot1
}

function getRowCell(
  row: Record<string, unknown>,
  exactCandidates: string[],
  containsCandidates: string[] = [],
  forbiddenContains: string[] = []
): unknown {
  for (const key of exactCandidates) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key]
    }
  }

  const entries = Object.entries(row)
  const normalizedExact = new Set(exactCandidates.map(normalizeHeaderKey))
  for (const [key, value] of entries) {
    if (normalizedExact.has(normalizeHeaderKey(key))) {
      return value
    }
  }

  if (containsCandidates.length > 0) {
    const normalizedContains = containsCandidates.map(normalizeHeaderKey)
    const normalizedForbidden = forbiddenContains.map(normalizeHeaderKey)
    for (const [key, value] of entries) {
      const normalizedKey = normalizeHeaderKey(key)
      if (normalizedForbidden.some((candidate) => normalizedKey.includes(candidate))) {
        continue
      }
      if (normalizedContains.some((candidate) => normalizedKey.includes(candidate))) {
        return value
      }
    }
  }

  return ""
}

function getPrimaryShotCell(
  row: Record<string, unknown>,
  shot: 1 | 2 | 3
): unknown {
  const direct = getRowCell(row, [`Shot ${shot}`, `Shot${shot}`])
  if (String(direct ?? "").trim() !== "") {
    return direct
  }

  const target = `shot${shot}`
  const entries = Object.entries(row)

  for (const [key, value] of entries) {
    const compact = normalizeCompactHeaderKey(key)
    if (compact === target && !/_\d+$/.test(key.trim())) {
      return value
    }
  }

  for (const [key, value] of Object.entries(row)) {
    const compact = normalizeCompactHeaderKey(key)
    if (compact.startsWith(target) && !/_\d+$/.test(key.trim())) {
      return value
    }
  }

  for (const [key, value] of entries) {
    const compact = normalizeCompactHeaderKey(key)
    if (compact === target || compact.startsWith(target)) {
      return value
    }
  }

  return ""
}

function getFosShotCells(
  row: Record<string, unknown>
): [unknown, unknown, unknown] {
  const primary1 = getPrimaryShotCell(row, 1)
  const primary2 = getPrimaryShotCell(row, 2)
  const primary3 = getPrimaryShotCell(row, 3)
  const hasPrimary2 = String(primary2 ?? "").trim() !== ""
  const hasPrimary3 = String(primary3 ?? "").trim() !== ""

  if (hasPrimary2 && hasPrimary3) {
    return [primary1, primary2, primary3]
  }

  const keys = Object.keys(row)
  const shot1Index = keys.findIndex((key) => {
    const compact = normalizeCompactHeaderKey(key)
    return (
      (compact === "shot1" || compact.startsWith("shot1")) &&
      !/_\d+$/.test(key.trim())
    )
  })

  if (shot1Index < 0) {
    return [primary1, primary2, primary3]
  }

  const fallback2Key = keys[shot1Index + 1]
  const fallback3Key = keys[shot1Index + 2]
  const fallback2 = fallback2Key ? row[fallback2Key] : ""
  const fallback3 = fallback3Key ? row[fallback3Key] : ""

  return [
    primary1,
    hasPrimary2 ? primary2 : fallback2,
    hasPrimary3 ? primary3 : fallback3,
  ]
}

function resolveSpecFromRow(
  row: Record<string, unknown>,
  fallbackNominal: number
): { nominal: number; usl: number; lsl: number } {
  const fos = toNumberOrNaN(getRowCell(row, FOS_HEADER_CANDIDATES, ["fos"], ["judge"]))
  const plusTol = toNumberOrNaN(getRowCell(row, PLUS_TOL_HEADER_CANDIDATES, ["plus tol"]))
  const minusTol = toNumberOrNaN(getRowCell(row, MINUS_TOL_HEADER_CANDIDATES, ["minus tol"]))
  const directUsl = toNumberOrNaN(getRowCell(row, USL_HEADER_CANDIDATES, ["usl", "upper spec"]))
  const directLsl = toNumberOrNaN(getRowCell(row, LSL_HEADER_CANDIDATES, ["lsl", "lower spec"]))

  const baseNominal = !Number.isNaN(fos)
    ? fos
    : (!Number.isNaN(fallbackNominal) && fallbackNominal !== 0)
      ? fallbackNominal
      : (!Number.isNaN(directUsl) && !Number.isNaN(directLsl))
        ? (directUsl + directLsl) / 2
        : 0

  const usl = !Number.isNaN(plusTol)
    ? baseNominal + plusTol
    : !Number.isNaN(directUsl)
      ? directUsl
      : baseNominal

  const lsl = !Number.isNaN(minusTol)
    ? baseNominal + minusTol
    : !Number.isNaN(directLsl)
      ? directLsl
      : baseNominal

  return {
    nominal: roundToThree(baseNominal),
    usl: roundToThree(usl),
    lsl: roundToThree(lsl),
  }
}

function toNumberOrNaN(value: unknown): number {
  const text = String(value ?? "").replace(/,/g, "").trim()
  if (!text) return Number.NaN
  const parsed = Number.parseFloat(text)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function computeSafeStats(flatValues: number[] | undefined, nominal: number) {
  if (!flatValues || flatValues.length === 0) {
    const fallback = nominal || 0
    return {
      mean: fallback,
      stdDev: 0.0001,
      max: fallback,
      min: fallback,
      range: 0,
      count: 0,
    }
  }

  const mean = flatValues.reduce((sum, value) => sum + value, 0) / flatValues.length
  const variance =
    flatValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / flatValues.length
  const stdDev = Math.sqrt(variance)
  const max = Math.max(...flatValues)
  const min = Math.min(...flatValues)

  return {
    mean,
    stdDev: stdDev > 0 ? stdDev : 0.0001,
    max,
    min,
    range: max - min,
    count: flatValues.length,
  }
}

function buildCavityPointsFromMatrix(
  faiId: string,
  usl: number,
  lsl: number,
  cavityMatrix: { cavity: string; value: number }[]
): CavityPoint[] {
  return cavityMatrix.map((point, index) => {
    const rounded = roundToFour(point.value)
    const status: "OK" | "+NG" | "-NG" =
      rounded > usl ? "+NG" : rounded < lsl ? "-NG" : "OK"

    return {
      id: `${faiId}-${index + 1}`,
      label: point.cavity || `CAV${index + 1}`,
      value: rounded,
      status,
    }
  })
}

function buildCavityPointsFromShots(
  faiId: string,
  usl: number,
  lsl: number,
  cavityShots: { cavity: string; shot: 1 | 2 | 3; value: number }[]
): CavityPoint[] {
  const sortedShots = [...cavityShots].sort((left, right) => {
    if (left.shot !== right.shot) {
      return left.shot - right.shot
    }

    const leftCavity = Number.parseInt(String(left.cavity).replace(/[^\d]/g, ""), 10)
    const rightCavity = Number.parseInt(String(right.cavity).replace(/[^\d]/g, ""), 10)
    const leftOrder = Number.isFinite(leftCavity) ? leftCavity : Number.MAX_SAFE_INTEGER
    const rightOrder = Number.isFinite(rightCavity) ? rightCavity : Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return String(left.cavity).localeCompare(String(right.cavity))
  })

  return sortedShots.map((point, index) => {
    const rounded = roundToFour(point.value)
    const status: "OK" | "+NG" | "-NG" =
      rounded > usl ? "+NG" : rounded < lsl ? "-NG" : "OK"

    return {
      id: `${faiId}-${point.shot}-${index + 1}`,
      label: `${point.shot}-${point.cavity}`,
      value: rounded,
      status,
    }
  })
}

export function FAIDashboard() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFAI, setSelectedFAI] = useState("fai1")
  const [parsedWorkbookData, setParsedWorkbookData] = useState<ParsedFaiData[]>([])
  const [uploadedFileName, setUploadedFileName] = useState("")
  const [parseError, setParseError] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const hasUploadedDataset = parsedWorkbookData.length > 0
  const parsedPointTotal = useMemo(
    () => parsedWorkbookData.reduce((sum, item) => sum + item.flatValues.length, 0),
    [parsedWorkbookData]
  )

  const analyzedData = useMemo(() => {
    if (!hasUploadedDataset) {
      const mockSpec = faiSpecs[selectedFAI]
      const faiItemBase = faiItemsBase.find((f) => f.id === selectedFAI)
      if (!mockSpec || !faiItemBase) {
        return null
      }

      const spcData = generateSPCChartData(selectedFAI)
      const cavityData = generateCavityData(selectedFAI, faiItemBase.cavities)
      const faiItems = faiItemsBase.map((item) => {
        const cavities = generateCavityData(item.id, item.cavities)
        return {
          ...item,
          aggregatedStatus: computeAggregatedStatus(cavities),
        }
      })
      const faiItem = faiItems.find((f) => f.id === selectedFAI)
      if (!faiItem) {
        return null
      }

      const ppk = Math.min(
        (mockSpec.usl - mockSpec.actual) / (3 * mockSpec.stddev),
        (mockSpec.actual - mockSpec.lsl) / (3 * mockSpec.stddev)
      )
      const cavityValues = cavityData.map((c) => c.value)
      const cavityMean = cavityValues.reduce((a, b) => a + b, 0) / cavityValues.length
      const cavityStdDev = Math.sqrt(
        cavityValues.reduce((sum, value) => sum + Math.pow(value - cavityMean, 2), 0) / cavityValues.length
      )
      const cavityRange = Math.max(...cavityValues) - Math.min(...cavityValues)

      return {
        faiItem,
        spec: {
          nominal: mockSpec.nominal,
          usl: mockSpec.usl,
          lsl: mockSpec.lsl,
          unit: mockSpec.unit,
        },
        cavityData,
        spc: {
          data: spcData.data,
          nominal: spcData.nominal,
          mean: mockSpec.actual,
        },
        stats: {
          ppk,
          mean: cavityMean,
          stdDev: cavityStdDev,
          range: cavityRange,
        },
        faiItems,
        audit: {
          selectedFosPoints: cavityData.length * 3,
          selectedGTolPoints: 0,
          selectedTotalPoints: cavityData.length * 3,
          selectedValueCount: cavityData.length,
        },
        sampleValues: undefined as number[] | undefined,
      }
    }

    const selected = parsedWorkbookData.find((item) => item.faiId === selectedFAI) ?? parsedWorkbookData[0]
    if (!selected) {
      return null
    }

    const statsSnapshot = computeSafeStats(selected.flatValues, selected.nominal)
    const ppk = Math.min(
      (selected.usl - statsSnapshot.mean) / (3 * statsSnapshot.stdDev),
      (statsSnapshot.mean - selected.lsl) / (3 * statsSnapshot.stdDev)
    )
    const spc = generateSPCData(
      statsSnapshot.mean,
      statsSnapshot.stdDev,
      selected.usl,
      selected.lsl,
      selected.flatValues
    )

    const cavityData =
      (selected.cavityShots?.length ?? 0) > 0
        ? buildCavityPointsFromShots(selected.faiId, selected.usl, selected.lsl, selected.cavityShots ?? [])
        : buildCavityPointsFromMatrix(selected.faiId, selected.usl, selected.lsl, selected.cavityMatrix)
    const range =
      cavityData.length > 0
        ? Math.max(...cavityData.map((point) => point.value)) -
          Math.min(...cavityData.map((point) => point.value))
        : statsSnapshot.range

    const faiItems = parsedWorkbookData.map((item) => {
      const points =
        (item.cavityShots?.length ?? 0) > 0
          ? buildCavityPointsFromShots(item.faiId, item.usl, item.lsl, item.cavityShots ?? [])
          : buildCavityPointsFromMatrix(item.faiId, item.usl, item.lsl, item.cavityMatrix)
      return {
        id: item.faiId,
        label: item.faiId,
        cavities: (item.cavityShots?.length ?? 0) > 0 ? (item.cavityShots?.length ?? 0) : item.cavityMatrix.length,
        aggregatedStatus: computeAggregatedStatus(points),
      }
    })

    const faiItem = faiItems.find((item) => item.id === selected.faiId)
    if (!faiItem) {
      return null
    }

    return {
      faiItem,
      spec: {
        nominal: selected.nominal,
        usl: selected.usl,
        lsl: selected.lsl,
        unit: "mm",
      },
      cavityData,
      spc: {
        data: spc.data,
        nominal: spc.nominal,
        mean: statsSnapshot.mean,
      },
      stats: {
        ppk,
        mean: statsSnapshot.mean,
        stdDev: statsSnapshot.stdDev,
        range,
      },
      faiItems,
      audit: {
        selectedFosPoints: selected.flatValues.length,
        selectedGTolPoints: 0,
        selectedTotalPoints: selected.flatValues.length,
        selectedValueCount: statsSnapshot.count,
      },
      sampleValues: selected.flatValues,
    }
  }, [hasUploadedDataset, parsedWorkbookData, selectedFAI])

  const handleUploadClick = () => {
    if (!fileInputRef.current) {
      return
    }

    // Always reset to allow re-uploading the same file and forcing re-parse.
    fileInputRef.current.value = ""
    fileInputRef.current.click()
  }

  const handleClearUploadedData = () => {
    setParsedWorkbookData([])
    setUploadedFileName("")
    setParseError("")
    setShowClearConfirm(false)
    setSelectedFAI("fai1")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFileUpload = async (file?: File) => {
    if (!file) {
      return
    }

    setIsParsing(true)
    setParseError("")

    try {
      const XLSX = await import("xlsx")
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false })

      // 1. Skip title row. If parser headers are not detected, fallback to range 2.
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!worksheet) {
        throw new Error("No worksheet found in the uploaded Excel file.")
      }
      const rawJsonDataRange1 = XLSX.utils.sheet_to_json(worksheet, { range: 1, defval: "" }) as Record<string, unknown>[]
      const rawJsonDataRange2 = XLSX.utils.sheet_to_json(worksheet, { range: 2, defval: "" }) as Record<string, unknown>[]
      const jsonData = hasRequiredParserHeaders(rawJsonDataRange1)
        ? rawJsonDataRange1
        : rawJsonDataRange2
      if (!hasRequiredParserHeaders(jsonData)) {
        throw new Error("Unable to locate required Excel headers (Dim. # / Shot 1).")
      }

      const faiMap: Record<string, ParsedFaiData> = {}
      let currentDimCache = ""

      jsonData.forEach((row) => {
        // 2. Fill down Dim. #.
        let dimVal = String(
          getRowCell(row, DIM_HEADER_CANDIDATES, ["dim #", "dim.#", "dim#"], ["dim type"])
        ).trim()
        if (dimVal !== "") {
          currentDimCache = dimVal
        } else {
          dimVal = currentDimCache
        }

        // Keep only FAI rows.
        if (!dimVal || !dimVal.startsWith("FAI")) return

        // 3. Init FAI bucket.
        if (!faiMap[dimVal]) {
          const spec = resolveSpecFromRow(row, 0)

          faiMap[dimVal] = {
            faiId: dimVal,
            nominal: spec.nominal,
            usl: spec.usl,
            lsl: spec.lsl,
            flatValues: [],
            cavityMatrix: [],
            cavityShots: [],
          }
        }

        // Backfill standards when later rows provide valid values.
        const currentBucket = faiMap[dimVal]
        const nextSpec = resolveSpecFromRow(row, currentBucket.nominal)
        currentBucket.nominal = nextSpec.nominal
        currentBucket.usl = nextSpec.usl
        currentBucket.lsl = nextSpec.lsl

        // 4. Read FOS shots.
        const [shot1Cell, shot2Cell, shot3Cell] = getFosShotCells(row)
        const s1 = toNumberOrNaN(shot1Cell)
        const s2 = toNumberOrNaN(shot2Cell)
        const s3 = toNumberOrNaN(shot3Cell)
        const cavity = String(
          getRowCell(row, CAVITY_HEADER_CANDIDATES, ["cavity"]) ?? ""
        ).trim() || "CAV?"

        const validShots: number[] = []
        if (!Number.isNaN(s1)) {
          const value = roundToThree(s1)
          validShots.push(value)
          faiMap[dimVal].flatValues.push(value)
          ;(faiMap[dimVal].cavityShots ??= []).push({ cavity, shot: 1, value })
        }
        if (!Number.isNaN(s2)) {
          const value = roundToThree(s2)
          validShots.push(value)
          faiMap[dimVal].flatValues.push(value)
          ;(faiMap[dimVal].cavityShots ??= []).push({ cavity, shot: 2, value })
        }
        if (!Number.isNaN(s3)) {
          const value = roundToThree(s3)
          validShots.push(value)
          faiMap[dimVal].flatValues.push(value)
          ;(faiMap[dimVal].cavityShots ??= []).push({ cavity, shot: 3, value })
        }

        // 5. Build cavity average for matrix.
        if (validShots.length > 0) {
          const cavAvg = validShots.reduce((a, b) => a + b, 0) / validShots.length
          faiMap[dimVal].cavityMatrix.push({
            cavity,
            value: Number(cavAvg.toFixed(3)),
          })
        }
      })

      const finalParsedData = Object.values(faiMap)
      console.log("Parse audit complete:", finalParsedData.map((item) => ({
        faiId: item.faiId,
        points: item.flatValues.length,
        cavities: item.cavityMatrix.length,
        shotCavities: item.cavityShots?.length ?? 0,
        nominal: item.nominal,
        usl: item.usl,
        lsl: item.lsl,
      })))
      if (finalParsedData.length === 0) {
        throw new Error("No valid FAI data was found in Excel.")
      }

      setParsedWorkbookData(finalParsedData)
      setUploadedFileName(file.name)
      setSelectedFAI(finalParsedData[0]?.faiId ?? "fai1")
    } catch (error) {
      setParsedWorkbookData([])
      setUploadedFileName("")
      setSelectedFAI("fai1")
      setParseError(error instanceof Error ? error.message : "Excel parse failed.")
    } finally {
      setIsParsing(false)
    }
  }

  if (!analyzedData) {
    return (
      <div className="flex w-full h-full min-h-screen items-center justify-center bg-[#0f172a] text-slate-200">
        <div className="rounded-md border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-mono text-slate-300">
          No FAI data available for the current selection.
        </div>
      </div>
    )
  }

  const { faiItem, spec, cavityData, spc, stats, faiItems } = analyzedData
  const yieldRate =
    cavityData.length > 0
      ? (cavityData.filter((point) => point.status === "OK").length / cavityData.length) * 100
      : 0

  return (
    <div className="flex w-full h-full min-h-screen bg-[#0f172a] text-slate-200 overflow-hidden">
      <FAISidebar
        items={faiItems}
        selectedId={selectedFAI}
        onSelect={setSelectedFAI}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            void handleFileUpload(event.target.files?.[0])
          }}
        />

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
                {faiItem.label} &mdash; {faiItem.cavities} {hasUploadedDataset ? "POINTS" : "CAVITIES"} &mdash; SPEC:{" "}
                {spec.lsl} ~ {spec.usl} {spec.unit}
                {uploadedFileName ? ` - FILE: ${uploadedFileName}` : ""}
              </p>
              {hasUploadedDataset ? (
                <p className="text-[11px] font-mono text-cyan-300/90">
                  PARSED FAI: {faiItems.length} &mdash; SELECTED POINTS: {analyzedData.audit.selectedTotalPoints}
                  {" "}(FOS {analyzedData.audit.selectedFosPoints}) &mdash; GLOBAL POINTS: {parsedPointTotal}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StatusPill
              icon={<Gauge className="h-3.5 w-3.5" />}
              label="Ppk"
              value={stats.ppk.toFixed(2)}
              good={stats.ppk >= 1.33}
            />
            <StatusPill
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              label="YIELD"
              value={`${yieldRate.toFixed(1)}%`}
              good={
                cavityData.length > 0
                  ? cavityData.filter((point) => point.status === "OK").length / cavityData.length >= 0.95
                  : false
              }
            />
          </div>
        </header>

        <div className="flex items-center justify-between border-b border-slate-800/70 px-6 py-2">
          <p className="text-xs font-mono text-slate-400">
            POSITION: DIMENSION ANALYSIS / EXCEL PARSER ENTRANCE
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isParsing}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              {isParsing ? "Parsing..." : "Excel Parse Entry"}
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={!hasUploadedDataset}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Excel Data
            </button>
          </div>
        </div>

        {parseError ? (
          <div className="border-b border-amber-700/40 bg-amber-500/10 px-6 py-2 text-xs font-mono text-amber-200">
            {parseError}
          </div>
        ) : null}

        <main className="flex-1 overflow-auto p-4">
          <div className="flex flex-col gap-4">
            <ToleranceMap
              nominal={spec.nominal}
              actual={stats.mean}
              usl={spec.usl}
              lsl={spec.lsl}
              unit={spec.unit}
              stdDev={stats.stdDev}
              range={stats.range}
              ppk={stats.ppk}
            />

            <DiagnosticAssertion
              cavityData={cavityData}
              sampleValues={analyzedData.sampleValues}
              excelFileName={uploadedFileName}
              actualMean={stats.mean}
              nominal={spec.nominal}
              usl={spec.usl}
              lsl={spec.lsl}
            />

            <SPCDistributionChart
              data={spc.data}
              usl={spec.usl}
              lsl={spec.lsl}
              mean={spc.mean}
              nominal={spc.nominal}
            />

            <CavityGrid
              cavities={cavityData}
              usl={spec.usl}
              lsl={spec.lsl}
            />
          </div>
        </main>
      </div>

      <CyberConfirmDialog
        open={showClearConfirm}
        title="Confirm Deleting Excel Data"
        message="Delete current parsed Excel dataset?\nAfter deletion the dashboard falls back to mock data."
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={handleClearUploadedData}
        confirmText="Delete"
        cancelText="Cancel"
      />
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
