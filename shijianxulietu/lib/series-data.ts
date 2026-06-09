export type SeriesPoint = {
  t: number // epoch ms
  primary: number
  baseline: number
  volume: number
  anomaly: number // 0-1 anomaly score
}

export type RangeKey = '1D' | '1W' | '1M' | 'YTD' | 'MAX'

const RANGE_CONFIG: Record<RangeKey, { points: number; stepMs: number; label: string }> = {
  '1D': { points: 96, stepMs: 15 * 60 * 1000, label: '15m' },
  '1W': { points: 168, stepMs: 60 * 60 * 1000, label: '1h' },
  '1M': { points: 120, stepMs: 6 * 60 * 60 * 1000, label: '6h' },
  YTD: { points: 160, stepMs: 24 * 60 * 60 * 1000, label: '1d' },
  MAX: { points: 200, stepMs: 7 * 24 * 60 * 60 * 1000, label: '1w' },
}

// Deterministic pseudo-random so SSR and client match
function seeded(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Fixed time anchor so server and client render identical timestamps (no hydration mismatch).
const ANCHOR_MS = Date.UTC(2026, 5, 9, 5, 46, 0)

export function generateSeries(range: RangeKey, seed = 42): SeriesPoint[] {
  const { points, stepMs } = RANGE_CONFIG[range]
  const rand = seeded(seed + points)
  const now = ANCHOR_MS
  const start = now - points * stepMs

  const data: SeriesPoint[] = []
  let value = 5200
  for (let i = 0; i < points; i++) {
    const t = start + i * stepMs
    const trend = Math.sin(i / (points / 6)) * 800
    const wave = Math.cos(i / 7) * 220
    const noise = (rand() - 0.5) * 340
    value = 5200 + trend + wave + noise + i * 4

    const baseline = 5200 + Math.sin(i / (points / 6)) * 640 + i * 4

    const spike = rand() > 0.94 ? (rand() - 0.5) * 1600 : 0
    const primary = Math.max(800, value + spike)

    const deviation = Math.abs(primary - baseline)
    const anomaly = Math.min(1, deviation / 1800)

    data.push({
      t,
      primary: Math.round(primary),
      baseline: Math.round(baseline),
      volume: Math.round(2000 + rand() * 6000 + Math.abs(spike)),
      anomaly: Number(anomaly.toFixed(3)),
    })
  }
  return data
}

export function getRangeLabel(range: RangeKey) {
  return RANGE_CONFIG[range].label
}

export function formatTimestamp(t: number, range: RangeKey) {
  const d = new Date(t)
  if (range === '1D') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  if (range === '1W') {
    return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
}

export function formatFullTimestamp(t: number) {
  const d = new Date(t)
  return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z'
}

export const RANGES: RangeKey[] = ['1D', '1W', '1M', 'YTD', 'MAX']

export type RawRecord = {
  id: string
  timestamp: string
  source: string
  rawVal: number
  delta: number
  status: 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'SYNCED'
}

const SOURCES = ['NODE-01', 'NODE-02', 'EDGE-A', 'EDGE-B', 'CORE', 'RELAY']
const STATUSES: RawRecord['status'][] = ['NOMINAL', 'NOMINAL', 'SYNCED', 'WARNING', 'CRITICAL']

export function generateRawRecords(count = 40, seed = 7): RawRecord[] {
  const rand = seeded(seed)
  const now = ANCHOR_MS
  const rows: RawRecord[] = []
  for (let i = 0; i < count; i++) {
    const t = now - i * (rand() * 90 + 30) * 1000
    const rawVal = Math.round(4200 + rand() * 3200)
    const delta = Number(((rand() - 0.45) * 12).toFixed(2))
    const r = rand()
    const status =
      Math.abs(delta) > 5
        ? 'CRITICAL'
        : Math.abs(delta) > 3
          ? 'WARNING'
          : r > 0.7
            ? 'SYNCED'
            : 'NOMINAL'
    rows.push({
      id: `0x${(983440 + i * 17).toString(16).toUpperCase().padStart(6, '0')}`,
      timestamp: new Date(t).toISOString().replace('T', ' ').slice(0, 19),
      source: SOURCES[Math.floor(rand() * SOURCES.length)],
      rawVal,
      delta,
      status,
    })
  }
  return rows
}
