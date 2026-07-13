import { readFile } from 'fs/promises'
import path from 'path'
import { read, utils } from 'xlsx'

export interface TimeSeriesPoint {
  /** 循环内相对秒数 */
  sec: number
  /** 采样电压 (V) */
  v: number
  /** 采样电流 (A) */
  i: number
  /** 工步类型 */
  step: string
  /** 循环号 */
  cycle: number
}

export interface CycleStat {
  cycle: number
  chargeCap: number
  dischargeCap: number
  efficiency: number
  avgV: number
  ir: number
  retention: number
}

export interface BatteryDataset {
  timeSeries: TimeSeriesPoint[]
  cycleStats: CycleStat[]
  meta: {
    deviceLabel: string
    cycleCount: number
    targetCycles: number
    initialCap: number
    /** 最后一个完整循环的容量保持率 (%) */
    retention: number
    maxIr: number
    sampleCount: number
  }
}

interface RawTimeSeriesRow {
  '采样序号': number
  '真实时间': string
  '采样电压(V)': number
  '采样电流(A)': number
  '工步类型': string
  '循环次数': number
}

interface RawCycleRow {
  '循环号': number
  '总充电容量(Ah)': number
  '总放电容量(Ah)': number
  '充放电效率(%)': number
  '放电均压(V)': number
  '直流内阻(mΩ)': number
}

const round = (n: number, d: number) => {
  const p = Math.pow(10, d)
  return Math.round(n * p) / p
}

export async function loadBatteryDataset(): Promise<BatteryDataset> {
  const filePath = path.join(process.cwd(), 'data', 'EL2600-1-453a4c.xlsx')
  const buf = await readFile(filePath)
  const wb = read(buf)

  const rawTs = utils.sheet_to_json<RawTimeSeriesRow>(wb.Sheets['测试数据'])
  const rawCs = utils.sheet_to_json<RawCycleRow>(wb.Sheets['循环统计'])

  // 每个循环的起始真实时间，用于计算循环内相对秒数
  const cycleStart = new Map<number, number>()
  for (const row of rawTs) {
    const cycle = row['循环次数']
    const epoch = Date.parse(String(row['真实时间']).replace(' ', 'T'))
    if (!cycleStart.has(cycle) || epoch < (cycleStart.get(cycle) as number)) {
      cycleStart.set(cycle, epoch)
    }
  }

  const timeSeries: TimeSeriesPoint[] = rawTs.map((row) => {
    const cycle = row['循环次数']
    const epoch = Date.parse(String(row['真实时间']).replace(' ', 'T'))
    return {
      sec: Math.round((epoch - (cycleStart.get(cycle) as number)) / 1000),
      v: round(row['采样电压(V)'], 3),
      i: round(row['采样电流(A)'], 3),
      step: row['工步类型'],
      cycle,
    }
  })

  const initialCap = rawCs[0]['总放电容量(Ah)']

  const cycleStats: CycleStat[] = rawCs.map((row) => ({
    cycle: row['循环号'],
    chargeCap: round(row['总充电容量(Ah)'], 4),
    dischargeCap: round(row['总放电容量(Ah)'], 4),
    efficiency: round(row['充放电效率(%)'], 2),
    avgV: round(row['放电均压(V)'], 3),
    ir: round(row['直流内阻(mΩ)'], 2),
    retention: round((row['总放电容量(Ah)'] / initialCap) * 100, 1),
  }))

  // 末尾可能存在被中断的不完整循环，SOH 取最后一个完整循环（容量 >= 初始 50%）
  const completeCycles = cycleStats.filter((c) => c.dischargeCap >= initialCap * 0.5)
  const lastComplete = completeCycles[completeCycles.length - 1] ?? cycleStats[cycleStats.length - 1]

  return {
    timeSeries,
    cycleStats,
    meta: {
      deviceLabel: 'EL2600 电池循环 1#',
      cycleCount: cycleStats.length,
      targetCycles: 50, // 流程信息: 程序跳转 49 次 + 首循环
      initialCap: round(initialCap, 3),
      retention: lastComplete.retention,
      maxIr: round(Math.max(...cycleStats.map((c) => c.ir)), 2),
      sampleCount: timeSeries.length,
    },
  }
}
