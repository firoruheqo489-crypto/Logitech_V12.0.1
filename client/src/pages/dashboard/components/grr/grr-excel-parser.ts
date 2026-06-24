'use client'

import { resizeStudy, type StudyConfig } from './gage-rnr'
import type { StudyMeta } from './metadata-header'

type ParsedGrrWorkbook = {
  cfg: StudyConfig
  meta: StudyMeta
  summary: {
    appraisers: number
    parts: number
    trials: number
    records: number
  }
}

type XlsxModuleLike = {
  read: (data: ArrayBuffer, options: Record<string, unknown>) => {
    SheetNames: string[]
    Sheets: Record<string, unknown>
  }
  utils: {
    sheet_to_json: <T>(sheet: unknown, options: Record<string, unknown>) => T[]
  }
}

type LongRow = Record<string, unknown>
type RawSheetRow = unknown[]

type ParsedMeasurementGrid = {
  appraisers: string[]
  parts: string[]
  trials: number
  measurements: number[][][]
  recordCount: number
}

type WideColumn = {
  columnIndex: number
  operatorKey: string
  operatorLabel: string
  trial: number
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[._-]/g, '')
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeOperatorPrefix(value: string) {
  const cleaned = value.trim()
  if (!cleaned) return '人员'
  if (/[\u4e00-\u9fffA-Za-z]/.test(cleaned)) {
    return cleaned
  }
  return '人员'
}

function parseNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value ?? '').trim().replace(/,/g, '')
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function parsePositiveInt(value: unknown) {
  const parsed = parseNumber(value)
  if (parsed === null) return null
  const rounded = Math.trunc(parsed)
  return rounded >= 1 ? rounded : null
}

function readColumn(row: LongRow, aliases: string[]) {
  const entries = Object.entries(row)
  for (const [key, value] of entries) {
    const normalized = normalizeHeader(key)
    if (aliases.includes(normalized)) return value
  }
  return undefined
}

function readMetaValue(rows: LongRow[], aliases: string[]) {
  for (const row of rows) {
    const value = readColumn(row, aliases)
    if (normalizeText(value)) return normalizeText(value)
  }
  return ''
}

function sortNatural(values: string[]) {
  return [...values].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }),
  )
}

function isPartHeaderCell(value: unknown) {
  const normalized = normalizeHeader(value)
  return [
    'part',
    'partname',
    'partno',
    'partnumber',
    '零件',
    '零件号',
    '零件名稱',
    '零件名称',
  ].includes(normalized)
}

function parseWideHeaderCell(value: unknown): Omit<WideColumn, 'columnIndex'> | null {
  const raw = normalizeText(value)
  if (!raw) return null

  const compact = raw.replace(/\s+/g, '')

  const numericMatch = compact.match(/^(.*?)(\d+)[-_/－—](\d+)$/)
  if (!numericMatch) {
    return null
  }

  const operatorPrefix = normalizeOperatorPrefix(numericMatch[1] || '人员')
  const operatorIndex = Number.parseInt(numericMatch[2], 10)
  const trial = Number.parseInt(numericMatch[3], 10)

  if (!Number.isFinite(operatorIndex) || operatorIndex < 1 || !Number.isFinite(trial) || trial < 1) {
    return null
  }

  const operatorKey = `${operatorPrefix}#${operatorIndex}`
  const operatorLabel = `${operatorPrefix}${operatorIndex}`

  return {
    operatorKey,
    operatorLabel,
    trial,
  }
}

function parseWideFormat(rawRows: RawSheetRow[]): ParsedMeasurementGrid | null {
  const headerRowIndex = rawRows.findIndex((row) => Array.isArray(row) && row.some((cell) => normalizeText(cell)))
  if (headerRowIndex < 0) return null

  const headerRow = rawRows[headerRowIndex] || []
  const wideColumns: WideColumn[] = []
  for (let columnIndex = 1; columnIndex < headerRow.length; columnIndex += 1) {
    const parsed = parseWideHeaderCell(headerRow[columnIndex])
    if (!parsed) continue
    wideColumns.push({
      columnIndex,
      operatorKey: parsed.operatorKey,
      operatorLabel: parsed.operatorLabel,
      trial: parsed.trial,
    })
  }

  const firstCellLooksLikePartHeader = isPartHeaderCell(headerRow[0])
  const parseCoverage = headerRow.length > 1 ? wideColumns.length / (headerRow.length - 1) : 0

  if (wideColumns.length < 4) {
    return null
  }

  if (!firstCellLooksLikePartHeader && parseCoverage < 0.75) {
    return null
  }

  const operatorOrder: string[] = []
  const operatorLabelByKey = new Map<string, string>()
  const trialSetByOperator = new Map<string, Set<number>>()

  for (const column of wideColumns) {
    if (!operatorLabelByKey.has(column.operatorKey)) {
      operatorOrder.push(column.operatorKey)
      operatorLabelByKey.set(column.operatorKey, column.operatorLabel)
    }

    if (!trialSetByOperator.has(column.operatorKey)) {
      trialSetByOperator.set(column.operatorKey, new Set<number>())
    }
    trialSetByOperator.get(column.operatorKey)?.add(column.trial)
  }

  const trialCounts = operatorOrder.map((key) => trialSetByOperator.get(key)?.size ?? 0)
  const trials = Math.max(...trialCounts, 0)
  if (operatorOrder.length < 2 || trials < 2) {
    return null
  }

  for (const key of operatorOrder) {
    const seenTrials = trialSetByOperator.get(key)
    if (!seenTrials || seenTrials.size !== trials) {
      throw new Error(`Excel 宽表中 ${operatorLabelByKey.get(key) || key} 的重复次数不一致，无法解析。`)
    }

    for (let trial = 1; trial <= trials; trial += 1) {
      if (!seenTrials.has(trial)) {
        throw new Error(`Excel 宽表中 ${operatorLabelByKey.get(key) || key} 缺少第 ${trial} 次重复测量列。`)
      }
    }
  }

  const operatorColumnMap = new Map<string, Map<number, number>>()
  for (const key of operatorOrder) {
    operatorColumnMap.set(key, new Map<number, number>())
  }
  for (const column of wideColumns) {
    operatorColumnMap.get(column.operatorKey)?.set(column.trial, column.columnIndex)
  }

  const partRows = rawRows
    .slice(headerRowIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((cell) => normalizeText(cell) || parseNumber(cell) !== null))

  const parts: string[] = []
  const measurements: number[][][] = operatorOrder.map(() => [])
  let recordCount = 0

  for (const row of partRows) {
    const rawPart = row[0]
    const partLabel = normalizeText(rawPart)
    const numericPart = parsePositiveInt(rawPart)
    const partName = partLabel || (numericPart !== null ? String(numericPart) : '')

    if (!partName) {
      continue
    }

    const operatorRows = operatorOrder.map((key) => {
      const columns = operatorColumnMap.get(key)
      return Array.from({ length: trials }, (_, trialIndex) => {
        const columnIndex = columns?.get(trialIndex + 1)
        const value = columnIndex === undefined ? null : parseNumber(row[columnIndex])
        if (value === null) {
          throw new Error(`零件 ${partName} 的 ${operatorLabelByKey.get(key) || key} 第 ${trialIndex + 1} 次测量为空或不是数字。`)
        }
        recordCount += 1
        return value
      })
    })

    parts.push(partName)
    operatorRows.forEach((trialValues, operatorIndex) => {
      measurements[operatorIndex].push(trialValues)
    })
  }

  if (parts.length < 2) {
    return null
  }

  return {
    appraisers: operatorOrder.map((key) => operatorLabelByKey.get(key) || key),
    parts,
    trials,
    measurements,
    recordCount,
  }
}

function parseLongFormat(rows: LongRow[]): ParsedMeasurementGrid | null {
  const recordMap = new Map<string, number>()
  const appraiserSet = new Set<string>()
  const partSet = new Set<string>()
  let maxTrial = 0
  let recordCount = 0

  for (const row of rows) {
    const appraiser = normalizeText(
      readColumn(row, ['appraiser', 'operator', 'inspector', '评价人', '测量员', '检验员']),
    )
    const part = normalizeText(
      readColumn(row, ['part', 'partname', 'partno', '零件', '零件号', '零件名称']),
    )
    const trial = parsePositiveInt(
      readColumn(row, ['trial', 'repeat', 'replicate', 'shot', '重复', '次数', '试次']),
    )
    const value = parseNumber(
      readColumn(row, ['value', 'measurement', 'measuredvalue', 'result', '测量值', '数值', '结果']),
    )

    if (!appraiser && !part && !trial && value === null) {
      continue
    }

    if (!appraiser || !part || trial === null || value === null) {
      continue
    }

    appraiserSet.add(appraiser)
    partSet.add(part)
    maxTrial = Math.max(maxTrial, trial)
    recordMap.set(`${appraiser}__${part}__${trial}`, value)
    recordCount += 1
  }

  const appraisers = sortNatural(Array.from(appraiserSet))
  const parts = sortNatural(Array.from(partSet))
  const trials = maxTrial

  if (appraisers.length < 2 || parts.length < 2 || trials < 2) {
    return null
  }

  const requiredRecordCount = appraisers.length * parts.length * trials
  if (recordMap.size !== requiredRecordCount) {
    throw new Error(`Excel 数据不完整，应有 ${requiredRecordCount} 条测量记录，实际识别到 ${recordMap.size} 条。`)
  }

  return {
    appraisers,
    parts,
    trials,
    measurements: appraisers.map((appraiser) =>
      parts.map((part) =>
        Array.from({ length: trials }, (_, trialIndex) => {
          const key = `${appraiser}__${part}__${trialIndex + 1}`
          return recordMap.get(key) ?? 0
        }),
      ),
    ),
    recordCount,
  }
}

function parseMeasurementGrid(rawRows: RawSheetRow[], longRows: LongRow[]): ParsedMeasurementGrid {
  const wide = parseWideFormat(rawRows)
  if (wide) {
    return wide
  }

  const long = parseLongFormat(longRows)
  if (long) {
    return long
  }

  throw new Error('当前 Excel 格式无法识别。请使用“第一列零件 + 后续列按 人员1-1、人员1-2 … 横向展开”的宽表，或使用 appraiser / part / trial / value 长表。')
}

export async function parseGrrExcelFile(file: File, baseCfg: StudyConfig): Promise<ParsedGrrWorkbook> {
  const XLSX = ((await import('xlsx')) as unknown) as XlsxModuleLike
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new Error('Excel 文件中没有可读取的工作表。')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json<RawSheetRow>(sheet, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: false,
  })
  const longRows = XLSX.utils.sheet_to_json<LongRow>(sheet, {
    defval: '',
    raw: true,
  })

  if (rawRows.length === 0) {
    throw new Error('Excel 中没有解析到任何数据。')
  }

  const parsed = parseMeasurementGrid(rawRows, longRows)

  if (parsed.appraisers.length < 2 || parsed.parts.length < 2 || parsed.trials < 2) {
    throw new Error('GRR Excel 至少需要 2 个评价人、2 个零件、2 次重复测量。')
  }

  const nextCfg = resizeStudy(baseCfg, {
    operators: parsed.appraisers.length,
    parts: parsed.parts.length,
    trials: parsed.trials,
  })

  nextCfg.operatorNames = parsed.appraisers
  nextCfg.partNames = parsed.parts
  nextCfg.measurements = parsed.measurements

  const meta: StudyMeta = {
    partName:
      readMetaValue(longRows, ['partname', 'product', 'component', '零件名称', '产品名称']) || '',
    characteristic:
      readMetaValue(longRows, ['characteristic', 'dimension', 'measureitem', '测量特性', '测量项目']) || '',
    gageId: readMetaValue(longRows, ['gageid', 'gage', 'instrument', '量具编号', '量具']) || '',
    date: readMetaValue(longRows, ['date', '测量日期', '日期']) || new Date().toISOString().slice(0, 10),
  }

  return {
    cfg: nextCfg,
    meta,
    summary: {
      appraisers: parsed.appraisers.length,
      parts: parsed.parts.length,
      trials: parsed.trials,
      records: parsed.recordCount,
    },
  }
}
