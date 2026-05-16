import { createClientId } from '@/lib/create-client-id'
import type { ChartType, RawDataRow } from './spc-types'

export interface ParseSuccess {
  success: true
  data: RawDataRow[]
  rowCount: number
}

export interface ParseError {
  success: false
  error: string
  errorCode:
    | 'EMPTY_DATA'
    | 'ROW_LENGTH_MISMATCH'
    | 'NO_VALID_ROWS'
    | 'INVALID_ATTRIBUTE_FORMAT'
  errorRow?: number
}

export type ParseResult = ParseSuccess | ParseError

function generateId(): string {
  return createClientId('spc')
}

export function processDataPayload(
  rawText: string,
  chartType: ChartType,
  subgroupSize: number,
): ParseResult {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return {
      success: false,
      error: '未检测到数据，请粘贴原始测量值。',
      errorCode: 'EMPTY_DATA',
    }
  }

  const lines = trimmed.split(/\n/)
  const parsedRows: RawDataRow[] = []

  const isVariableChart =
    chartType === 'Xbar-R' || chartType === 'Xbar-s' || chartType === 'I-MR'
  const isAttributeChart =
    chartType === 'p' || chartType === 'np' || chartType === 'c' || chartType === 'u'
  const effectiveSubgroupSize = chartType === 'I-MR' ? 1 : subgroupSize

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line) continue

    const tokens = line.split(/[\s,;\t]+/)
    const values: number[] = []

    for (const token of tokens) {
      if (token === '') continue
      const num = Number(token)
      if (!Number.isNaN(num)) {
        values.push(num)
      }
    }

    if (values.length === 0) continue

    if (isVariableChart) {
      if (values.length !== effectiveSubgroupSize) {
        return {
          success: false,
          error: `第 ${i + 1} 行长度不匹配，应为 n=${effectiveSubgroupSize}，实际为 ${values.length}。`,
          errorCode: 'ROW_LENGTH_MISMATCH',
          errorRow: i + 1,
        }
      }
    } else if (isAttributeChart) {
      if (values.length < 1 || values.length > 2) {
        return {
          success: false,
          error: `第 ${i + 1} 行计数型格式无效，应为 1-2 个值（缺陷数[, 样本量n]），实际为 ${values.length}。`,
          errorCode: 'INVALID_ATTRIBUTE_FORMAT',
          errorRow: i + 1,
        }
      }
    }

    parsedRows.push({
      id: generateId(),
      label: `SG-${parsedRows.length + 1}`,
      values,
    })
  }

  if (parsedRows.length === 0) {
    return {
      success: false,
      error: '未识别到有效数值行，请检查数据格式。',
      errorCode: 'NO_VALID_ROWS',
    }
  }

  return {
    success: true,
    data: parsedRows,
    rowCount: parsedRows.length,
  }
}

export function getExpectedFormatHint(chartType: ChartType, subgroupSize: number): string {
  switch (chartType) {
    case 'Xbar-R':
    case 'Xbar-s':
      return `每行需要 ${subgroupSize} 个数值（子组大小 n=${subgroupSize}）。`
    case 'I-MR':
      return '每行需要 1 个数值（单值图）。'
    case 'p':
    case 'np':
      return '每行需要 1-2 个数值：[缺陷数, 样本量n]。'
    case 'c':
    case 'u':
      return '每行需要 1-2 个数值：[缺陷数, 检验单位数]。'
    default:
      return ''
  }
}
