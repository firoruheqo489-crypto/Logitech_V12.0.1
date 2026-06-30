export type EmcChannelId = "L" | "N" | "F";
export type EmcBand = "conducted" | "radiated";

export const EMC_CHANNELS: { id: EmcChannelId; label: string; desc: string; color: string }[] = [
  { id: "L", label: "L 火线", desc: "Live", color: "#4f8df7" },
  { id: "N", label: "N 零线", desc: "Neutral", color: "#34c98a" },
  { id: "F", label: "F 地线", desc: "Frame / Ground", color: "#b06bf0" },
];

export interface SpectrumPoint {
  freq: number;
  qp: number | null;
  av: number | null;
  qpLimit?: number | null;
  avLimit?: number | null;
}

export interface EmcChannelData {
  channel: EmcChannelId;
  fileName: string;
  band: EmcBand;
  points: SpectrumPoint[];
  source: "pdf" | "emc" | "sample";
  pdfFileName?: string;
  emcFileName?: string;
}

export type EmcDetector = "QP" | "AV";
export type EmcRiskLevel = "high" | "mid" | "safe";

export interface EmcPeakRecord {
  id: string;
  channel: EmcChannelId;
  band: EmcBand;
  freq: number;
  detector: EmcDetector;
  reading: number;
  limit: number;
  margin: number;
  level: EmcRiskLevel;
}

export interface EmcLimits {
  qp: number;
  av: number;
}

export interface ParsedEmcPdfPeak {
  index: number;
  freq_mhz: number;
  reading_dbuv: number;
  limit_dbuv: number;
  margin_db: number;
  detector: EmcDetector;
  remark: string;
}

export interface ParsedEmcPdfPoint {
  freq: number;
  qp: number | null;
  av: number | null;
  qp_limit: number | null;
  av_limit: number | null;
}

export interface ParsedEmcPdfResult {
  file_name: string;
  project_no: string | null;
  standard: string | null;
  date: string | null;
  time: string | null;
  band: EmcBand;
  channel: EmcChannelId | null;
  peaks: ParsedEmcPdfPeak[];
  points: ParsedEmcPdfPoint[];
  raw_text: string;
}

export interface ParsedEmcBinaryResult {
  channel: EmcChannelId | null;
  band: EmcBand;
  points: SpectrumPoint[];
  fileName: string;
}

export const DEFAULT_EMC_LIMITS: EmcLimits = { qp: 64, av: 54 };

export const EMC_RISK_META: Record<EmcRiskLevel, { label: string; tag: string }> = {
  high: { label: "量产高危", tag: "高烈度博弈" },
  mid: { label: "需审查", tag: "存量风险" },
  safe: { label: "安全", tag: "低能量噪声" },
};

export function classifyEmcMargin(margin: number): EmcRiskLevel {
  if (margin < 3) return "high";
  if (margin < 6) return "mid";
  return "safe";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildEmcPeakRecords(channels: EmcChannelData[], limits: EmcLimits): EmcPeakRecord[] {
  const records: EmcPeakRecord[] = [];

  for (const channel of channels) {
    for (const point of channel.points) {
      if (point.qp !== null) {
        const qpLimit = point.qpLimit ?? limits.qp;
        const margin = round1(qpLimit - point.qp);
        records.push({
          id: `${channel.channel}-${channel.band}-QP-${point.freq}`,
          channel: channel.channel,
          band: channel.band,
          freq: point.freq,
          detector: "QP",
          reading: point.qp,
          limit: qpLimit,
          margin,
          level: classifyEmcMargin(margin),
        });
      }

      if (point.av !== null) {
        const avLimit = point.avLimit ?? limits.av;
        const margin = round1(avLimit - point.av);
        records.push({
          id: `${channel.channel}-${channel.band}-AV-${point.freq}`,
          channel: channel.channel,
          band: channel.band,
          freq: point.freq,
          detector: "AV",
          reading: point.av,
          limit: avLimit,
          margin,
          level: classifyEmcMargin(margin),
        });
      }
    }
  }

  return records.sort((left, right) => left.margin - right.margin);
}

export function overallEmcVerdict(records: EmcPeakRecord[]): "PASS" | "FAIL" {
  return records.some((record) => record.margin < 0) ? "FAIL" : "PASS";
}

function generateSweep(
  seed: number,
  base: number,
  spikes: Array<{ freq: number; qp: number; av: number }>,
): SpectrumPoint[] {
  const points: SpectrumPoint[] = [];
  const start = 0.15;
  const end = 30;
  const steps = 90;

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const freq = round3(start * Math.pow(end / start, t));
    const noise = Math.sin((index + seed) * 1.7) * 3 + Math.cos((index + seed) * 0.5) * 2;
    const slope = base - t * 10;
    let qp = round1(slope + noise);
    for (const spike of spikes) {
      const distance = Math.abs(Math.log10(freq) - Math.log10(spike.freq));
      if (distance < 0.06) {
        qp = Math.max(qp, spike.qp - distance * 40);
      }
    }
    const av = round1(qp - 8 - Math.abs(noise) * 0.5);
    points.push({ freq, qp, av });
  }

  for (const spike of spikes) {
    points.push({ freq: spike.freq, qp: spike.qp, av: spike.av });
  }

  return points.sort((left, right) => left.freq - right.freq);
}

export function sampleEmcChannels(): EmcChannelData[] {
  return [
    {
      channel: "L",
      fileName: "sample_L_live.pdf",
      band: "conducted",
      source: "sample",
      points: generateSweep(1, 38, [
        { freq: 0.45, qp: 63.5, av: 56.8 },
        { freq: 2.1, qp: 58, av: 49 },
        { freq: 13.5, qp: 52, av: 44 },
      ]),
    },
    {
      channel: "N",
      fileName: "sample_N_neutral.pdf",
      band: "conducted",
      source: "sample",
      points: generateSweep(7, 36, [
        { freq: 0.72, qp: 61.5, av: 52 },
        { freq: 5.6, qp: 55, av: 46 },
      ]),
    },
    {
      channel: "F",
      fileName: "sample_F_ground.pdf",
      band: "radiated",
      source: "sample",
      points: [
        { freq: 30, qp: 46, av: null },
        { freq: 100, qp: 43, av: null },
        { freq: 230, qp: 39, av: null },
      ],
    },
  ];
}

function guessChannelFromName(fileName: string): EmcChannelId | null {
  const normalized = fileName.toLowerCase();
  if (/(^|[^a-z])l([^a-z]|$)|live|火线|line/.test(normalized)) return "L";
  if (/(^|[^a-z])n([^a-z]|$)|neutral|零线/.test(normalized)) return "N";
  if (/(^|[^a-z])f([^a-z]|$)|frame|ground|gnd|地线/.test(normalized)) return "F";
  return null;
}

function readFloatLE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(offset, true);
}

function detectFrequencyRun(bytes: Uint8Array): { offset: number; count: number; band: EmcBand } | null {
  const maxStart = Math.min(bytes.length - 4 * 12, 512);
  let bestMatch: { offset: number; count: number; band: EmcBand } | null = null;

  for (let start = 0; start <= maxStart; start += 1) {
    const values: number[] = [];
    let valid = true;
    for (let index = 0; index < 12; index += 1) {
      const offset = start + index * 4;
      if (offset + 4 > bytes.length) {
        valid = false;
        break;
      }
      values.push(readFloatLE(bytes, offset));
    }
    if (!valid) break;

    const first = values[0];
    const diffs = values.slice(1).map((value, index) => value - values[index]);
    const isConducted =
      first >= 0.005 &&
      first < 1 &&
      diffs.slice(0, 6).every((diff) => diff > 0 && diff < 0.02);
    const isRadiated =
      first >= 30 &&
      first <= 40 &&
      diffs.slice(0, 6).every((diff) => diff > 0 && diff < 1);

    if (!isConducted && !isRadiated) {
      continue;
    }

    let count = 1;
    while (start + (count + 1) * 4 <= bytes.length) {
      const current = readFloatLE(bytes, start + (count - 1) * 4);
      const next = readFloatLE(bytes, start + count * 4);
      const step = next - current;
      const upperStep = isConducted ? 0.02 : 1;
      if (!Number.isFinite(current) || !Number.isFinite(next) || step <= 0 || step >= upperStep) {
        break;
      }
      count += 1;
    }

    const match: { offset: number; count: number; band: EmcBand } = {
      offset: start,
      count,
      band: isRadiated ? "radiated" : "conducted",
    };

    if (!bestMatch || match.count > bestMatch.count) {
      bestMatch = match;
    }
  }

  if (bestMatch && bestMatch.count >= 200) {
    return bestMatch;
  }

  return null;
}

function readFloatArray(bytes: Uint8Array, offset: number, count: number): number[] {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const valueOffset = offset + index * 4;
    if (valueOffset + 4 > bytes.length) break;
    values.push(readFloatLE(bytes, valueOffset));
  }
  return values;
}

export function parseEmcBinaryFile(fileName: string, buffer: ArrayBuffer): ParsedEmcBinaryResult {
  const bytes = new Uint8Array(buffer);
  const frequencyRun = detectFrequencyRun(bytes);
  if (!frequencyRun) {
    throw new Error("未识别到 .emc 文件中的连续频率序列");
  }

  const freqValues = readFloatArray(bytes, frequencyRun.offset, frequencyRun.count);
  const block1Offset = frequencyRun.offset + frequencyRun.count * 4;
  const block2Offset = block1Offset + frequencyRun.count * 4;
  const block3Offset = block2Offset + frequencyRun.count * 4;

  const qpValues = readFloatArray(bytes, block1Offset, frequencyRun.count);
  const block2Values = readFloatArray(bytes, block2Offset, frequencyRun.count);
  const avValues = readFloatArray(bytes, block3Offset, frequencyRun.count);

  const hasQp = qpValues.some((value) => Number.isFinite(value) && value > 0 && value < 130);
  const hasAv = avValues.some((value) => Number.isFinite(value) && value > 0 && value < 130);
  const block2IsFlat = block2Values.every((value) => Math.abs(value - block2Values[0]) < 1e-6);

  const points: SpectrumPoint[] = freqValues.map((freq, index) => ({
    freq,
    qp: hasQp ? qpValues[index] ?? null : null,
    av: hasAv && !block2IsFlat ? avValues[index] ?? null : hasAv ? avValues[index] ?? null : null,
  }));

  return {
    fileName,
    band: frequencyRun.band,
    channel: guessChannelFromName(fileName),
    points,
  };
}
