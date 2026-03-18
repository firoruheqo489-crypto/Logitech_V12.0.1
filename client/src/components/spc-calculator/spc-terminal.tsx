'use client'

import { useState, useCallback } from 'react'
import type { ChartType, RawDataRow } from '@/lib/spc/spc-types'
import { processDataPayload } from '@/lib/spc/spc-parser'
import { 
  calculateVariablesSPC, 
  calculateAttributesSPC,
  type SPCComputedResult,
  type AttributesSPCResult,
  type SpecLimits,
} from '@/lib/spc/spc-math'
import { SPCHeader } from './spc-header'
import { SPCSidebar } from './spc-sidebar'
import { SPCMainArea } from './spc-main-area'

// ─── Parse Status Type ───────────────────────────────────────────────────────
export interface ParseStatus {
  type: 'idle' | 'success' | 'error'
  message?: string
  rowCount?: number
}

// ─── Spec Inputs (string form for input binding) ─────────────────────────────
export interface SpecInputs {
  usl: string
  target: string
  lsl: string
}

export function SPCTerminal() {
  // ─── Input State ─────────────────────────────────────────────────────────────
  const [selectedChart, setSelectedChart] = useState<ChartType>('Xbar-R')
  const [subgroupSize, setSubgroupSize] = useState(5)
  const [phaseOneLimit, setPhaseOneLimit] = useState(0)
  const [rawText, setRawText] = useState('')
  const [specInputs, setSpecInputs] = useState<SpecInputs>({ usl: '', target: '', lsl: '' })

  // ─── Parsed Data State ───────────────────────────────────────────────────────
  const [parsedData, setParsedData] = useState<RawDataRow[]>([])
  const [parseStatus, setParseStatus] = useState<ParseStatus>({ type: 'idle' })

  // ─── Computed SPC Results ────────────────────────────────────────────────────
  const [spcResult, setSpcResult] = useState<SPCComputedResult | null>(null)
  const [attributesResult, setAttributesResult] = useState<AttributesSPCResult | null>(null)

  // ─── Parse spec inputs to numeric limits ─────────────────────────────────────
  const parseSpecLimits = (): SpecLimits => {
    return {
      usl: specInputs.usl.trim() !== '' ? parseFloat(specInputs.usl) : null,
      target: specInputs.target.trim() !== '' ? parseFloat(specInputs.target) : null,
      lsl: specInputs.lsl.trim() !== '' ? parseFloat(specInputs.lsl) : null,
    }
  }

  // ─── Helper to clear error state ───────────────────────────────────────────
  const clearErrorIfPresent = useCallback(() => {
    if (parseStatus.type === 'error') {
      setParseStatus({ type: 'idle' })
    }
  }, [parseStatus.type])

  // ─── Input Change Handlers (auto-clear error) ────────────────────────────────
  const handleRawTextChange = useCallback((text: string) => {
    setRawText(text)
    clearErrorIfPresent()
  }, [clearErrorIfPresent])

  const handleSubgroupSizeChange = useCallback((size: number) => {
    setSubgroupSize(size)
    clearErrorIfPresent()
  }, [clearErrorIfPresent])

  const handlePhaseOneLimitChange = useCallback((limit: number) => {
    setPhaseOneLimit(limit)
    clearErrorIfPresent()
  }, [clearErrorIfPresent])

  const handleSpecInputsChange = useCallback((specs: SpecInputs) => {
    setSpecInputs(specs)
    clearErrorIfPresent()
  }, [clearErrorIfPresent])

  // ─── Execute Handler ─────────────────────────────────────────────────────────
  const handleExecute = useCallback(() => {
    // Clear any previous error before re-running
    setParseStatus({ type: 'idle' })
    
    const result = processDataPayload(rawText, selectedChart, subgroupSize)

    if (result.success) {
      setParsedData(result.data)
      setParseStatus({
        type: 'success',
        message: `DATA INGESTED: ${result.rowCount} ROWS`,
        rowCount: result.rowCount,
      })

      // Route to correct engine based on chart type
      const isVariablesChart = ['Xbar-R', 'Xbar-s', 'I-MR'].includes(selectedChart)

      if (isVariablesChart) {
        // Calculate Variables SPC metrics with spec limits and Phase I freeze
        const specLimits = parseSpecLimits()
        const computed = calculateVariablesSPC(result.data, selectedChart, subgroupSize, specLimits, phaseOneLimit)
        setSpcResult(computed)
        setAttributesResult(null)
      } else {
        // Calculate Attributes SPC metrics with Phase I freeze
        const computed = calculateAttributesSPC(result.data, selectedChart, subgroupSize, phaseOneLimit)
        setAttributesResult(computed)
        setSpcResult(null)
      }
    } else {
      setParsedData([])
      setSpcResult(null)
      setAttributesResult(null)
      setParseStatus({
        type: 'error',
        message: result.error,
      })
    }
  }, [rawText, selectedChart, subgroupSize, specInputs, phaseOneLimit])

  // ─── Chart Change Handler (reset parse status) ───────────────────────────────
  const handleChartChange = useCallback((chart: ChartType) => {
    setSelectedChart(chart)
    // Reset status when chart type changes
    if (parseStatus.type !== 'idle') {
      setParseStatus({ type: 'idle' })
      setParsedData([])
      setSpcResult(null)
      setAttributesResult(null)
    }
  }, [parseStatus.type])

  return (
    <div className="spc-scanline relative flex min-h-[calc(100vh-16rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
      {/* Top Header */}
      <SPCHeader activeChart={selectedChart} />

      {/* Main Body Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — THE FUNNEL */}
        <div className="w-[340px] shrink-0 overflow-y-auto xl:w-[380px]">
            <SPCSidebar
            selectedChart={selectedChart}
            onChartChange={handleChartChange}
            subgroupSize={subgroupSize}
            onSubgroupSizeChange={handleSubgroupSizeChange}
            phaseOneLimit={phaseOneLimit}
            onPhaseOneLimitChange={handlePhaseOneLimitChange}
            rawText={rawText}
            onRawTextChange={handleRawTextChange}
            specInputs={specInputs}
            onSpecInputsChange={handleSpecInputsChange}
            onExecute={handleExecute}
            parseStatus={parseStatus}
          />
        </div>

        {/* Right Main Area — THE AUDIT */}
        <SPCMainArea 
          activeChart={selectedChart} 
          parseStatus={parseStatus}
          parsedData={parsedData}
          spcResult={spcResult}
          attributesResult={attributesResult}
          specLimits={parseSpecLimits()}
        />
      </div>
    </div>
  )
}


export default SPCTerminal
