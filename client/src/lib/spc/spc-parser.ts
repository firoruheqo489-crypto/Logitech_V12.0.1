import type { ChartType, RawDataRow } from './spc-types'

// ─── Parser Result Types ─────────────────────────────────────────────────────
export interface ParseSuccess {
  success: true
  data: RawDataRow[]
  rowCount: number
}

export interface ParseError {
  success: false
  error: string
  errorCode: 'EMPTY_DATA' | 'ROW_LENGTH_MISMATCH' | 'NO_VALID_ROWS' | 'INVALID_ATTRIBUTE_FORMAT'
  errorRow?: number
}

export type ParseResult = ParseSuccess | ParseError

// ─── UUID Generator ──────────────────────────────────────────────────────────
function generateId(): string {
  return crypto.randomUUID()
}

// ─── Core Parser Function ────────────────────────────────────────────────────
export function processDataPayload(
  rawText: string,
  chartType: ChartType,
  subgroupSize: number
): ParseResult {
  // Step 1: Check for empty input
  const trimmed = rawText.trim()
  if (!trimmed) {
    return {
      success: false,
      error: 'ERR: NO DATA DETECTED. PASTE RAW FACTORY DATA.',
      errorCode: 'EMPTY_DATA',
    }
  }

  // Step 2: Split by newline and parse each row
  const lines = trimmed.split(/\n/)
  const parsedRows: RawDataRow[] = []

  // Determine expected values per row based on chart type
  const isVariableChart = chartType === 'Xbar-R' || chartType === 'Xbar-s' || chartType === 'I-MR'
  const isAttributeChart = chartType === 'p' || chartType === 'np' || chartType === 'c' || chartType === 'u'

  // For I-MR, force n=1 internally
  const effectiveSubgroupSize = chartType === 'I-MR' ? 1 : subgroupSize

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip completely empty lines
    if (!line) continue

    // Step 3: Extract numeric values using strict regex
    const tokens = line.split(/[\s,;\t]+/)
    const values: number[] = []

    for (const token of tokens) {
      if (token === '') continue
      const num = Number(token)
      if (!Number.isNaN(num)) {
        values.push(num)
      }
    }

    // Skip rows with no valid numbers
    if (values.length === 0) continue

    // Step 4: Tactical Interception — Cross-Chart Validation
    if (isVariableChart) {
      // Variable charts: EVERY row must have exactly n values
      if (values.length !== effectiveSubgroupSize) {
        return {
          success: false,
          error: `ERR: ROW ${i + 1} LENGTH MISMATCH. EXPECTED n=${effectiveSubgroupSize}, GOT ${values.length}.`,
          errorCode: 'ROW_LENGTH_MISMATCH',
          errorRow: i + 1,
        }
      }
    } else if (isAttributeChart) {
      // Attribute charts: EVERY row must have 1 value (defect count) or 2 values (defect count, subgroup size)
      if (values.length < 1 || values.length > 2) {
        return {
          success: false,
          error: `ERR: ROW ${i + 1} INVALID ATTRIBUTE FORMAT. EXPECTED 1-2 VALUES (defects[, n]), GOT ${values.length}.`,
          errorCode: 'INVALID_ATTRIBUTE_FORMAT',
          errorRow: i + 1,
        }
      }
    }

    // Step 5: Map to RawDataRow structure
    parsedRows.push({
      id: generateId(),
      label: `SG-${parsedRows.length + 1}`,
      values,
    })
  }

  // Step 6: Final validation — ensure we have at least some data
  if (parsedRows.length === 0) {
    return {
      success: false,
      error: 'ERR: NO VALID NUMERIC ROWS DETECTED. CHECK DATA FORMAT.',
      errorCode: 'NO_VALID_ROWS',
    }
  }

  // Success!
  return {
    success: true,
    data: parsedRows,
    rowCount: parsedRows.length,
  }
}

// ─── Validation Helper for UI ────────────────────────────────────────────────
export function getExpectedFormatHint(chartType: ChartType, subgroupSize: number): string {
  switch (chartType) {
    case 'Xbar-R':
    case 'Xbar-s':
      return `每行需要 ${subgroupSize} 个数值 (子组大小 n=${subgroupSize})`
    case 'I-MR':
      return '每行需要 1 个数值 (单值控制图)'
    case 'p':
    case 'np':
      return '每行需要 1-2 个数值: 不合格品数[, 样本量]'
    case 'c':
    case 'u':
      return '每行需要 1-2 个数值: 缺陷数[, 检验单位数]'
    default:
      return ''
  }
}
