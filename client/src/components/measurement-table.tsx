'use client'

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Minus, Trash2, Download, AlertTriangle, CheckCircle2 } from 'lucide-react'
import * as XLSX from 'xlsx'

interface HeaderInfo {
  projectName: string
  moldNumber: string
  measurer: string
  measureDate: string
}

interface MeasurementRow {
  id: string
  itemDescription: string
  standardValue: string
  upperLimit: string
  lowerLimit: string
  actuals: string[]
  remark: string
}

const DEFAULT_ACTUAL_COUNT = 5
const MIN_ACTUAL_COUNT = 1
const MAX_ACTUAL_COUNT = 20

type MeasurementEditableField = Exclude<keyof MeasurementRow, 'id' | 'actuals'>

const createEmptyActuals = (count: number) => Array.from({ length: count }, () => '')

const normalizeActuals = (actuals: string[], count: number) =>
  Array.from({ length: count }, (_, index) => actuals[index] ?? '')

const createEmptyRow = (id: string, actualCount = DEFAULT_ACTUAL_COUNT): MeasurementRow => ({
  id,
  itemDescription: '',
  standardValue: '',
  upperLimit: '',
  lowerLimit: '',
  actuals: createEmptyActuals(actualCount),
  remark: '',
})

export function MeasurementTable() {
  const [headerInfo, setHeaderInfo] = useState<HeaderInfo>({
    projectName: '',
    moldNumber: '',
    measurer: '',
    measureDate: new Date().toISOString().split('T')[0],
  })

  const [rows, setRows] = useState<MeasurementRow[]>([
    createEmptyRow('1'),
    createEmptyRow('2'),
    createEmptyRow('3'),
  ])
  const [actualColumnCount, setActualColumnCount] = useState(DEFAULT_ACTUAL_COUNT)

  const actualColumns = useMemo(
    () => Array.from({ length: actualColumnCount }, (_, index) => index),
    [actualColumnCount]
  )

  const handleHeaderChange = useCallback(
    (field: keyof HeaderInfo, value: string) => {
      setHeaderInfo((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const handleRowChange = useCallback(
    (id: string, field: MeasurementEditableField, value: string) => {
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
      )
    },
    []
  )

  const handleActualChange = useCallback(
    (id: string, actualIndex: number, value: string) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== id) return row
          const nextActuals = normalizeActuals(row.actuals, Math.max(row.actuals.length, actualIndex + 1))
          nextActuals[actualIndex] = value
          return { ...row, actuals: nextActuals }
        })
      )
    },
    []
  )

  const addActualColumn = useCallback(() => {
    setActualColumnCount((current) => Math.min(MAX_ACTUAL_COUNT, current + 1))
  }, [])

  const removeActualColumn = useCallback(() => {
    setActualColumnCount((current) => Math.max(MIN_ACTUAL_COUNT, current - 1))
  }, [])

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow(String(Date.now()), actualColumnCount)])
  }, [actualColumnCount])

  const clearData = useCallback(() => {
    setHeaderInfo({
      projectName: '',
      moldNumber: '',
      measurer: '',
      measureDate: new Date().toISOString().split('T')[0],
    })
    setRows([
      createEmptyRow('1', actualColumnCount),
      createEmptyRow('2', actualColumnCount),
      createEmptyRow('3', actualColumnCount),
    ])
  }, [actualColumnCount])

  // 计算行数据（平均值、极差、判定结果）
  const computedRows = useMemo(() => {
    return rows.map((row) => {
      const visibleActuals = normalizeActuals(row.actuals, actualColumnCount)
      const actualValues = visibleActuals
        .map((v) => parseFloat(v))
        .filter((v) => !isNaN(v))

      const upperLimit = parseFloat(row.upperLimit)
      const lowerLimit = parseFloat(row.lowerLimit)

      let average: number | null = null
      let range: number | null = null

      if (actualValues.length > 0) {
        average =
          actualValues.reduce((sum, v) => sum + v, 0) / actualValues.length
        range = Math.max(...actualValues) - Math.min(...actualValues)
      }

      // 判定每个实测值是否越界
      const hasLimits = !isNaN(upperLimit) && !isNaN(lowerLimit)
      const actualStatuses = visibleActuals.map((v) => {
        const num = parseFloat(v)
        if (isNaN(num) || !hasLimits) return 'neutral'
        if (num < lowerLimit) return 'below'
        if (num > upperLimit) return 'above'
        return 'ok'
      })

      // 判定结果：只要有一个越界就是 NG
      const hasOutOfRange = actualStatuses.some(
        (s) => s === 'below' || s === 'above'
      )
      const hasValidActuals = actualValues.length > 0
      const judgment: 'OK' | 'NG' | null =
        hasValidActuals && hasLimits ? (hasOutOfRange ? 'NG' : 'OK') : null

      return {
        ...row,
        average,
        range,
        actualStatuses,
        judgment,
      }
    })
  }, [actualColumnCount, rows])

  // 全局状态：是否有任何 NG
  const hasAnyNG = useMemo(() => {
    return computedRows.some((row) => row.judgment === 'NG')
  }, [computedRows])

  // 导出 Excel
  const exportToExcel = useCallback(() => {
    // 创建工作表数据
    const wsData: (string | number | null)[][] = []

    // 表头信息
    wsData.push(['在线测量数据检入表'])
    wsData.push([])
    wsData.push([
      '项目名称',
      headerInfo.projectName,
      '',
      '模具编号',
      headerInfo.moldNumber,
    ])
    wsData.push([
      '测量人',
      headerInfo.measurer,
      '',
      '测量日期',
      headerInfo.measureDate,
    ])
    wsData.push([])

    // 表格表头
    const actualHeaders = actualColumns.map((index) => `实测${index + 1}`)

    wsData.push([
      '序号',
      '检验项目描述',
      '标准值',
      '上限值',
      '下限值',
      ...actualHeaders,
      '平均值',
      '极差',
      '判定结果',
      '备注',
    ])

    // 表格数据
    computedRows.forEach((row, index) => {
      wsData.push([
        index + 1,
        row.itemDescription,
        row.standardValue,
        row.upperLimit,
        row.lowerLimit,
        ...actualColumns.map((actualIndex) => row.actuals[actualIndex] ?? ''),
        row.average !== null ? row.average.toFixed(3) : '',
        row.range !== null ? row.range.toFixed(3) : '',
        row.judgment || '',
        row.remark,
      ])
    })

    // 全局状态
    wsData.push([])
    wsData.push(['批次状态', hasAnyNG ? '批次不合格' : '批次合格'])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '测量数据')

    // 设置列宽
    ws['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      ...actualColumns.map(() => ({ wch: 10 })),
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 20 },
    ]

    XLSX.writeFile(
      wb,
      `测量数据_${headerInfo.projectName || '未命名'}_${headerInfo.measureDate}.xlsx`
    )
  }, [actualColumns, headerInfo, computedRows, hasAnyNG])

  const getActualValueStyle = (status: string) => {
    switch (status) {
      case 'below':
        return 'text-blue-600 font-bold'
      case 'above':
        return 'text-red-600 font-bold'
      case 'ok':
        return 'text-green-600'
      default:
        return ''
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* 全局状态指示器 */}
      <div
        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-lg font-bold transition-colors ${
          hasAnyNG
            ? 'bg-red-500 text-white'
            : 'bg-green-500 text-white'
        }`}
      >
        {hasAnyNG ? (
          <>
            <AlertTriangle className="size-6" />
            批次不合格
          </>
        ) : (
          <>
            <CheckCircle2 className="size-6" />
            批次合格
          </>
        )}
      </div>

      {/* 表头信息区 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          基础信息
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              项目名称
            </label>
            <Input
              value={headerInfo.projectName}
              onChange={(e) => handleHeaderChange('projectName', e.target.value)}
              placeholder="请输入项目名称"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              模具编号
            </label>
            <Input
              value={headerInfo.moldNumber}
              onChange={(e) => handleHeaderChange('moldNumber', e.target.value)}
              placeholder="请输入模具编号"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              测量人
            </label>
            <Input
              value={headerInfo.measurer}
              onChange={(e) => handleHeaderChange('measurer', e.target.value)}
              placeholder="请输入测量人"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              测量日期
            </label>
            <Input
              type="date"
              value={headerInfo.measureDate}
              onChange={(e) => handleHeaderChange('measureDate', e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center">序号</TableHead>
                <TableHead className="min-w-[140px]">检验项目描述</TableHead>
                <TableHead className="w-20 text-center">标准值</TableHead>
                <TableHead className="w-20 text-center">上限值</TableHead>
                <TableHead className="w-20 text-center">下限值</TableHead>
                {actualColumns.map((actualIndex) => {
                  const isLastActual = actualIndex === actualColumnCount - 1
                  return (
                    <TableHead
                      key={`actual-head-${actualIndex}`}
                      className={isLastActual ? 'w-28 text-center' : 'w-20 text-center'}
                    >
                      {isLastActual ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span>实测{actualIndex + 1}</span>
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={addActualColumn}
                              disabled={actualColumnCount >= MAX_ACTUAL_COUNT}
                              aria-label="增加实测列"
                              title="增加实测列"
                              className="inline-flex size-5 items-center justify-center rounded border border-white/15 bg-white/[0.04] text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <Plus className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={removeActualColumn}
                              disabled={actualColumnCount <= MIN_ACTUAL_COUNT}
                              aria-label="减少实测列"
                              title="减少实测列"
                              className="inline-flex size-5 items-center justify-center rounded border border-white/15 bg-white/[0.04] text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <Minus className="size-3" />
                            </button>
                          </span>
                        </div>
                      ) : (
                        `实测${actualIndex + 1}`
                      )}
                    </TableHead>
                  )
                })}
                <TableHead className="w-20 text-center">平均值</TableHead>
                <TableHead className="w-20 text-center">极差</TableHead>
                <TableHead className="w-16 text-center">判定</TableHead>
                <TableHead className="min-w-[120px]">备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {computedRows.map((row, index) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  <TableCell className="text-center font-medium text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.itemDescription}
                      onChange={(e) =>
                        handleRowChange(row.id, 'itemDescription', e.target.value)
                      }
                      placeholder="输入检验项目"
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="any"
                      value={row.standardValue}
                      onChange={(e) =>
                        handleRowChange(row.id, 'standardValue', e.target.value)
                      }
                      placeholder="标准值"
                      className="h-8 w-full text-center text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="any"
                      value={row.upperLimit}
                      onChange={(e) =>
                        handleRowChange(row.id, 'upperLimit', e.target.value)
                      }
                      placeholder="上限"
                      className="h-8 w-full text-center text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="any"
                      value={row.lowerLimit}
                      onChange={(e) =>
                        handleRowChange(row.id, 'lowerLimit', e.target.value)
                      }
                      placeholder="下限"
                      className="h-8 w-full text-center text-sm"
                    />
                  </TableCell>
                  {actualColumns.map((actualIndex) => {
                    const status = row.actualStatuses[actualIndex] || 'neutral'
                    return (
                    <TableCell key={`actual-${row.id}-${actualIndex}`}>
                      <Input
                        type="number"
                        step="any"
                        value={row.actuals[actualIndex] ?? ''}
                        onChange={(e) =>
                          handleActualChange(row.id, actualIndex, e.target.value)
                        }
                        placeholder="实测"
                        className={`h-8 w-full text-center text-sm ${getActualValueStyle(status)}`}
                      />
                    </TableCell>
                    )
                  })}
                  <TableCell className="text-center text-sm font-medium">
                    {row.average !== null ? row.average.toFixed(3) : '-'}
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">
                    {row.range !== null ? row.range.toFixed(3) : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.judgment && (
                      <span
                        className={`inline-flex items-center justify-center rounded px-2 py-1 text-xs font-bold ${
                          row.judgment === 'OK'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {row.judgment}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.remark}
                      onChange={(e) =>
                        handleRowChange(row.id, 'remark', e.target.value)
                      }
                      placeholder={row.judgment === 'NG' ? '请填写异常说明' : '备注'}
                      className={`h-8 text-sm ${
                        row.judgment === 'NG' && !row.remark.trim()
                          ? 'border-red-500 ring-1 ring-red-500'
                          : ''
                      }`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ��作按钮区 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button onClick={addRow} variant="outline" className="gap-1.5">
            <Plus className="size-4" />
            新增一行
          </Button>
          <Button
            onClick={clearData}
            variant="outline"
            className="gap-1.5 text-destructive hover:bg-destructive hover:text-white"
          >
            <Trash2 className="size-4" />
            清空数据
          </Button>
        </div>
        <Button onClick={exportToExcel} className="gap-1.5">
          <Download className="size-4" />
          一键导出为 Excel
        </Button>
      </div>
    </div>
  )
}
