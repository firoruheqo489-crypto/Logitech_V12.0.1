'use client'

import { useCallback, useState } from 'react'
import type { ChartType, RawDataRow } from '@/lib/spc/spc-types'
import { processDataPayload } from '@/lib/spc/spc-parser'
import {
  calculateAttributesSPC,
  calculateVariablesSPC,
  type AttributesSPCResult,
  type SPCComputedResult,
  type SpecLimits,
} from '@/lib/spc/spc-math'
import { SPCHeader } from './spc-header'
import { SPCSidebar } from './spc-sidebar'
import { SPCMainArea } from './spc-main-area'
import './spc-terminal.css'

export interface ParseStatus {
  type: 'idle' | 'success' | 'error'
  message?: string
  rowCount?: number
}

export interface SpecInputs {
  usl: string
  target: string
  lsl: string
}

export function SPCTerminal() {
  const [selectedChart, setSelectedChart] = useState<ChartType>('Xbar-R')
  const [subgroupSize, setSubgroupSize] = useState(5)
  const [phaseOneLimit, setPhaseOneLimit] = useState(0)
  const [rawText, setRawText] = useState('')
  const [specInputs, setSpecInputs] = useState<SpecInputs>({
    usl: '',
    target: '',
    lsl: '',
  })

  const [parsedData, setParsedData] = useState<RawDataRow[]>([])
  const [parseStatus, setParseStatus] = useState<ParseStatus>({ type: 'idle' })
  const [spcResult, setSpcResult] = useState<SPCComputedResult | null>(null)
  const [attributesResult, setAttributesResult] =
    useState<AttributesSPCResult | null>(null)

  const parseSpecLimits = (): SpecLimits => ({
    usl: specInputs.usl.trim() !== '' ? parseFloat(specInputs.usl) : null,
    target: specInputs.target.trim() !== '' ? parseFloat(specInputs.target) : null,
    lsl: specInputs.lsl.trim() !== '' ? parseFloat(specInputs.lsl) : null,
  })

  const clearErrorIfPresent = useCallback(() => {
    if (parseStatus.type === 'error') {
      setParseStatus({ type: 'idle' })
    }
  }, [parseStatus.type])

  const handleRawTextChange = useCallback(
    (text: string) => {
      setRawText(text)
      clearErrorIfPresent()
    },
    [clearErrorIfPresent],
  )

  const handleSubgroupSizeChange = useCallback(
    (size: number) => {
      setSubgroupSize(size)
      clearErrorIfPresent()
    },
    [clearErrorIfPresent],
  )

  const handlePhaseOneLimitChange = useCallback(
    (limit: number) => {
      setPhaseOneLimit(limit)
      clearErrorIfPresent()
    },
    [clearErrorIfPresent],
  )

  const handleSpecInputsChange = useCallback(
    (specs: SpecInputs) => {
      setSpecInputs(specs)
      clearErrorIfPresent()
    },
    [clearErrorIfPresent],
  )

  const handleExecute = useCallback(() => {
    try {
      setParseStatus({ type: 'idle' })

      const result = processDataPayload(rawText, selectedChart, subgroupSize)

      if (result.success) {
        setParsedData(result.data)
        setParseStatus({
          type: 'success',
          message: `已导入 ${result.rowCount} 行数据`,
          rowCount: result.rowCount,
        })

        const isVariablesChart = ['Xbar-R', 'Xbar-s', 'I-MR'].includes(selectedChart)

        if (isVariablesChart) {
          const specLimits = parseSpecLimits()
          const computed = calculateVariablesSPC(
            result.data,
            selectedChart,
            subgroupSize,
            specLimits,
            phaseOneLimit,
          )
          setSpcResult(computed)
          setAttributesResult(null)
        } else {
          const computed = calculateAttributesSPC(
            result.data,
            selectedChart,
            subgroupSize,
            phaseOneLimit,
          )
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知执行失败'
      setParsedData([])
      setSpcResult(null)
      setAttributesResult(null)
      setParseStatus({
        type: 'error',
        message: `执行失败：${message}`,
      })
    }
  }, [rawText, selectedChart, subgroupSize, specInputs, phaseOneLimit])

  const handleChartChange = useCallback(
    (chart: ChartType) => {
      setSelectedChart(chart)
      if (parseStatus.type !== 'idle') {
        setParseStatus({ type: 'idle' })
        setParsedData([])
        setSpcResult(null)
        setAttributesResult(null)
      }
    },
    [parseStatus.type],
  )

  return (
    <div className="spc-terminal-shell relative flex min-h-[calc(100vh-16rem)] flex-col overflow-hidden rounded-[28px] border border-white/10">
      <SPCHeader activeChart={selectedChart} />

      <div className="flex flex-1 overflow-hidden">
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
