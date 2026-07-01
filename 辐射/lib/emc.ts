// EMC 传导/辐射数据解析核心逻辑
// 多通道 (L/N/F) 数据模型、文件解析、极值定标与风险分级

export type ChannelId = "L" | "N" | "F"

export const CHANNELS: { id: ChannelId; label: string; desc: string; color: string }[] = [
  { id: "L", label: "L 火线", desc: "Live", color: "var(--chan-l)" },
  { id: "N", label: "N 零线", desc: "Neutral", color: "var(--chan-n)" },
  { id: "F", label: "F 地线", desc: "Frame / Ground", color: "var(--chan-f)" },
]

export const CHANNEL_COLORS: Record<ChannelId, string> = {
  L: "var(--chan-l)",
  N: "var(--chan-n)",
  F: "var(--chan-f)",
}

// 单个测量点：频率(MHz) + QP/AV 读数(dBuV)
export interface SpectrumPoint {
  freq: number // MHz
  qp: number | null // 准峰值 dBuV
  av: number | null // 平均值 dBuV
}

export interface ChannelData {
  channel: ChannelId
  fileName: string
  points: SpectrumPoint[]
}

export type Detector = "QP" | "AV"

// 风险等级
export type RiskLevel = "high" | "mid" | "safe"

export interface PeakRecord {
  id: string
  channel: ChannelId
  freq: number
  detector: Detector
  reading: number // dBuV
  limit: number // dBuV
  margin: number // limit - reading
  level: RiskLevel
}

export interface Limits {
  qp: number
  av: number
}

export const DEFAULT_LIMITS: Limits = { qp: 64, av: 54 }

export function classifyMargin(margin: number): RiskLevel {
  if (margin < 3) return "high"
  if (margin < 6) return "mid"
  return "safe"
}

export const RISK_META: Record<RiskLevel, { label: string; tag: string }> = {
  high: { label: "量产高危", tag: "高烈度博弈" },
  mid: { label: "需审查", tag: "存量风险" },
  safe: { label: "安全", tag: "低能量噪声" },
}

// ---------- 解析 ----------

function coerceNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).trim())
  return Number.isFinite(n) ? n : null
}

// 统一各种字段命名
function pickKey(keys: string[], candidates: string[]): string | undefined {
  const lower = keys.map((k) => k.toLowerCase().trim())
  for (const c of candidates) {
    const idx = lower.indexOf(c)
    if (idx >= 0) return keys[idx]
  }
  return undefined
}

const FREQ_KEYS = ["freq", "frequency", "频率", "freq_mhz", "f", "mhz", "freq(mhz)"]
const QP_KEYS = ["qp", "quasi-peak", "quasipeak", "准峰值", "qpeak"]
const AV_KEYS = ["av", "avg", "average", "平均值", "aver"]
const LEVEL_KEYS = ["level", "value", "amp", "amplitude", "reading", "dbuv", "电平"]

function normalizePoints(rows: Record<string, unknown>[]): SpectrumPoint[] {
  if (rows.length === 0) return []
  const keys = Object.keys(rows[0])
  const fKey = pickKey(keys, FREQ_KEYS)
  const qpKey = pickKey(keys, QP_KEYS)
  const avKey = pickKey(keys, AV_KEYS)
  const lvlKey = pickKey(keys, LEVEL_KEYS)

  const points: SpectrumPoint[] = []
  for (const row of rows) {
    const freq = coerceNum(fKey ? row[fKey] : undefined)
    if (freq === null) continue
    let qp = qpKey ? coerceNum(row[qpKey]) : null
    let av = avKey ? coerceNum(row[avKey]) : null
    // 只有单一电平列时，归入 QP
    if (qp === null && av === null && lvlKey) {
      qp = coerceNum(row[lvlKey])
    }
    points.push({ freq, qp, av })
  }
  return points.sort((a, b) => a.freq - b.freq)
}

export function parseJSON(text: string): SpectrumPoint[] {
  const data = JSON.parse(text)
  let rows: Record<string, unknown>[]
  if (Array.isArray(data)) {
    rows = data
  } else if (data && Array.isArray(data.points)) {
    rows = data.points
  } else if (data && Array.isArray(data.data)) {
    rows = data.data
  } else {
    throw new Error("无法识别的 JSON 结构，需要数组或包含 points/data 字段")
  }
  return normalizePoints(rows as Record<string, unknown>[])
}

export function parseCSV(text: string): SpectrumPoint[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
  if (lines.length < 2) throw new Error("CSV 至少需要表头与一行数据")
  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ","
  const headers = lines[0].split(delimiter).map((h) => h.trim())
  const rows: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter)
    const row: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      row[h] = cells[idx]
    })
    rows.push(row)
  }
  return normalizePoints(rows)
}

export function parseFile(fileName: string, text: string): SpectrumPoint[] {
  const isJSON = fileName.toLowerCase().endsWith(".json") || text.trim().startsWith("{") || text.trim().startsWith("[")
  return isJSON ? parseJSON(text) : parseCSV(text)
}

// 从文件名推断通道 (l/n/f)
export function guessChannel(fileName: string, fallback: ChannelId): ChannelId {
  const n = fileName.toLowerCase()
  if (/(^|[^a-z])l([^a-z]|$)|live|火线|line/.test(n)) return "L"
  if (/(^|[^a-z])n([^a-z]|$)|neutral|零线/.test(n)) return "N"
  if (/(^|[^a-z])f([^a-z]|$)|frame|ground|gnd|地线/.test(n)) return "F"
  return fallback
}

// ---------- 极值定标与风险计算 ----------

export function buildPeakRecords(channels: ChannelData[], limits: Limits): PeakRecord[] {
  const records: PeakRecord[] = []
  for (const ch of channels) {
    for (const p of ch.points) {
      if (p.qp !== null) {
        const margin = round1(limits.qp - p.qp)
        records.push({
          id: `${ch.channel}-QP-${p.freq}`,
          channel: ch.channel,
          freq: p.freq,
          detector: "QP",
          reading: p.qp,
          limit: limits.qp,
          margin,
          level: classifyMargin(margin),
        })
      }
      if (p.av !== null) {
        const margin = round1(limits.av - p.av)
        records.push({
          id: `${ch.channel}-AV-${p.freq}`,
          channel: ch.channel,
          freq: p.freq,
          detector: "AV",
          reading: p.av,
          limit: limits.av,
          margin,
          level: classifyMargin(margin),
        })
      }
    }
  }
  // 余量升序：最危险的排在最前
  return records.sort((a, b) => a.margin - b.margin)
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function overallVerdict(records: PeakRecord[]): "PASS" | "FAIL" {
  // 任一读数超过限值 (margin < 0) 判 FAIL
  return records.some((r) => r.margin < 0) ? "FAIL" : "PASS"
}

// ---------- 示例数据 ----------

function genSweep(seed: number, base: number, spikes: { freq: number; qp: number; av: number }[]): SpectrumPoint[] {
  const points: SpectrumPoint[] = []
  // 0.15 - 30 MHz 对数扫描
  const start = 0.15
  const end = 30
  const steps = 90
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const freq = round3(start * Math.pow(end / start, t))
    const noise = Math.sin((i + seed) * 1.7) * 3 + Math.cos((i + seed) * 0.5) * 2
    // 噪声基底：随频率轻微下降，整体远低于限值
    const slope = base - t * 10
    let qp = round1(slope + noise)
    // 叠加尖峰
    for (const s of spikes) {
      const d = Math.abs(Math.log10(freq) - Math.log10(s.freq))
      if (d < 0.06) qp = Math.max(qp, s.qp - d * 40)
    }
    const av = round1(qp - 8 - Math.abs(noise) * 0.5)
    points.push({ freq, qp, av })
  }
  // 注入精确尖峰点确保极值存在
  for (const s of spikes) {
    points.push({ freq: s.freq, qp: s.qp, av: s.av })
  }
  return points.sort((a, b) => a.freq - b.freq)
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function sampleChannels(): ChannelData[] {
  return [
    {
      channel: "L",
      fileName: "sample_L_live.json",
      points: genSweep(1, 38, [
        { freq: 0.45, qp: 63.5, av: 56.8 }, // 高危 QP/AV
        { freq: 2.1, qp: 58, av: 49 },
        { freq: 13.5, qp: 52, av: 44 },
      ]),
    },
    {
      channel: "N",
      fileName: "sample_N_neutral.json",
      points: genSweep(7, 36, [
        { freq: 0.72, qp: 61.5, av: 52 },
        { freq: 5.6, qp: 55, av: 46 },
      ]),
    },
    {
      channel: "F",
      fileName: "sample_F_ground.json",
      points: genSweep(13, 33, [
        { freq: 0.3, qp: 60, av: 50.5 },
        { freq: 9.2, qp: 49, av: 41 },
        { freq: 24, qp: 47, av: 39 },
      ]),
    },
  ]
}
