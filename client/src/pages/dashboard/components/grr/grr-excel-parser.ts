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

export async function parseGrrExcelFile(file: File, baseCfg: StudyConfig): Promise<ParsedGrrWorkbook> {
  const XLSX = ((await import('xlsx')) as unknown) as XlsxModuleLike
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new Error('Excel 文件中没有可读取的工作表。')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<LongRow>(sheet, {
    defval: '',
    raw: true,
  })

  if (rows.length === 0) {
    throw new Error('Excel 中没有解析到任何数据。')
  }

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
    throw new Error('GRR Excel 至少需要 2 个评价人、2 个零件、2 次重复测量。')
  }

  const requiredRecordCount = appraisers.length * parts.length * trials
  if (recordMap.size !== requiredRecordCount) {
    throw new Error(`Excel 数据不完整，应有 ${requiredRecordCount} 条测量记录，实际识别到 ${recordMap.size} 条。`)
  }

  const nextCfg = resizeStudy(baseCfg, {
    operators: appraisers.length,
    parts: parts.length,
    trials,
  })

  nextCfg.operatorNames = appraisers
  nextCfg.partNames = parts
  nextCfg.measurements = appraisers.map((appraiser) =>
    parts.map((part) =>
      Array.from({ length: trials }, (_, trialIndex) => {
        const key = `${appraiser}__${part}__${trialIndex + 1}`
        return recordMap.get(key) ?? 0
      }),
    ),
  )

  const meta: StudyMeta = {
    partName:
      readMetaValue(rows, ['partname', 'product', 'component', '零件名称', '产品名称']) || parts[0] || '',
    characteristic:
      readMetaValue(rows, ['characteristic', 'dimension', 'measureitem', '测量特性', '测量项目']) || '',
    gageId: readMetaValue(rows, ['gageid', 'gage', 'instrument', '量具编号', '量具']) || '',
    date: readMetaValue(rows, ['date', '测量日期', '日期']) || new Date().toISOString().slice(0, 10),
  }

  return {
    cfg: nextCfg,
    meta,
    summary: {
      appraisers: appraisers.length,
      parts: parts.length,
      trials,
      records: recordCount,
    },
  }
}
