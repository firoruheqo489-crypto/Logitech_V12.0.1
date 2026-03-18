// ─── SPC Chart Type Union ────────────────────────────────────────────────────
export type ChartType = 'Xbar-R' | 'Xbar-s' | 'I-MR' | 'p' | 'np' | 'c' | 'u'

// ─── Raw Data Row ────────────────────────────────────────────────────────────
export interface RawDataRow {
  id: string
  label: string
  values: number[]
}

// ─── SPC Application State ──────────────────────────────────────────────────
export interface SPCState {
  selectedChart: ChartType
  rawData: RawDataRow[]
  phaseOneLimit: number
}

// ─── Chart Group Classification ─────────────────────────────────────────────
export interface ChartGroup {
  label: string
  charts: { value: ChartType; name: string; description: string }[]
}

export const CHART_GROUPS: ChartGroup[] = [
  {
    label: '变量型 (连续数据)',
    charts: [
      { value: 'Xbar-R', name: 'X\u0304-R', description: '均值-极差控制图' },
      { value: 'Xbar-s', name: 'X\u0304-s', description: '均值-标准差控制图' },
      { value: 'I-MR', name: 'I-MR', description: '单值-移动极差控制图' },
    ],
  },
  {
    label: '属性型 (离散数据)',
    charts: [
      { value: 'p', name: 'p', description: '不合格品率控制图' },
      { value: 'np', name: 'np', description: '不合格品数控制图' },
      { value: 'c', name: 'c', description: '缺陷数控制图' },
      { value: 'u', name: 'u', description: '单位缺陷数控制图' },
    ],
  },
]

// ─── Metric Card Type ───────────────────────────────────────────────────────
export interface MetricCardData {
  label: string
  value: string
  unit?: string
}
