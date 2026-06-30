export interface HarmonicProcessMetrics {
  voltage_avg_v: number | null;
  voltage_max_v: number | null;
  frequency_avg_hz: number | null;
  frequency_max_hz: number | null;
  current_peak_avg_a: number | null;
  current_peak_max_a: number | null;
  current_rms_avg_a: number | null;
  current_rms_max_a: number | null;
  fundamental_current_avg_ma: number | null;
  fundamental_current_max_ma: number | null;
  crest_factor: number | null;
  power_avg_w: number | null;
  power_max_w: number | null;
  power_factor_avg: number | null;
  power_factor_max: number | null;
}

export interface HarmonicRow {
  order: number;
  avg_percent: number;
  max_percent: number;
  limit_100_percent: number;
  limit_150_percent: number;
  avg_limit_percent: number;
  max_limit_percent: number;
  status: string;
}

export interface HarmonicParseResult {
  file_name: string;
  product_name: string | null;
  mode: string | null;
  test_date: string | null;
  start_time: string | null;
  end_time: string | null;
  standard: string | null;
  duration_min: number | null;
  remarks: string | null;
  verdict: string | null;
  thc_ma: number | null;
  ithd_percent: number | null;
  pohc_ma: number | null;
  pohc_limit_ma: number | null;
  distortion_factor: number | null;
  process_metrics: HarmonicProcessMetrics;
  harmonics: HarmonicRow[];
  raw_text: string;
}

export type WavePoint = {
  deg: number;
  voltage: number;
  current: number;
};

export type HarmonicBar = {
  order: string;
  k: number;
  magnitude: number;
  limit: number;
  maxMagnitude: number;
  maxLimit: number;
  exceeds: boolean;
};

export type MarginRow = {
  label: string;
  order: string;
  value: number;
  limit: number;
  margin: number;
  critical: boolean;
  maxValue: number;
  maxLimit: number;
};

export type AlphaMetric = {
  label: string;
  value: string;
  unit: string;
  sub: string;
};

export type SecondaryStat = {
  label: string;
  value: string;
  tone: "neutral" | "good" | "critical";
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveIecClassCLimit(order: number): number {
  if (order === 2) return 2;
  if (order === 3) return 27;
  if (order === 5) return 10;
  if (order === 7) return 7;
  if (order === 9) return 5;
  if (order >= 11 && order <= 39) return 3;
  return 3;
}

export function buildHarmonicWaveform(result: HarmonicParseResult): WavePoint[] {
  const points: WavePoint[] = [];
  const pf = clamp(result.process_metrics.power_factor_avg ?? 0.95, -1, 1);
  const phaseShift = Math.acos(pf);
  const voltageRms = result.process_metrics.voltage_avg_v ?? 230;
  const voltagePeak = voltageRms * Math.sqrt(2);
  const fundamentalCurrentRms =
    (result.process_metrics.fundamental_current_avg_ma ?? 200) / 1000;
  const baseCurrentPeak =
    result.process_metrics.current_peak_avg_a ??
    fundamentalCurrentRms * Math.sqrt(2);
  const harmonics = result.harmonics.slice(0, 12);

  for (let deg = 0; deg <= 360; deg += 3) {
    const rad = (deg * Math.PI) / 180;
    const voltage = voltagePeak * Math.sin(rad);
    let current = baseCurrentPeak * Math.sin(rad - phaseShift);

    for (const harmonic of harmonics) {
      const ratio = (harmonic.avg_percent || 0) / 100;
      current += baseCurrentPeak * ratio * Math.sin(harmonic.order * rad - phaseShift);
    }

    points.push({
      deg,
      voltage: round2(voltage),
      current: round2(current),
    });
  }

  return points;
}

export function buildHarmonicSpectrum(result: HarmonicParseResult): HarmonicBar[] {
  return result.harmonics.map((row) => {
    const magnitude = row.avg_percent;
    const limit = resolveIecClassCLimit(row.order);
    const maxMagnitude = row.max_percent;
    const maxLimit = row.limit_150_percent;
    const exceeds = magnitude > limit;
    return {
      order: `K${row.order}`,
      k: row.order,
      magnitude,
      limit,
      maxMagnitude,
      maxLimit,
      exceeds,
    };
  });
}

export function buildMarginAudit(result: HarmonicParseResult): MarginRow[] {
  return result.harmonics
    .map((row) => {
      const limit = resolveIecClassCLimit(row.order);
      const value = row.avg_percent;
      const margin = round2(limit - value);
      return {
        label: `Harmonic K${row.order}`,
        order: `K${row.order}`,
        value,
        limit,
        margin,
        critical: margin < 0,
        maxValue: row.max_percent,
        maxLimit: row.limit_150_percent,
      };
    })
    .sort((left, right) => left.margin - right.margin)
    .slice(0, 8);
}

export function resolveHarmonicVerdict(result: HarmonicParseResult): "PASS" | "FAIL" {
  return result.harmonics.some((row) => row.avg_percent > resolveIecClassCLimit(row.order))
    ? "FAIL"
    : "PASS";
}

export function buildAlphaMetrics(result: HarmonicParseResult): AlphaMetric[] {
  return [
    {
      label: "THDi — 电流总谐波失真",
      value: result.ithd_percent?.toFixed(2) ?? "--",
      unit: "%",
      sub: `THC ${result.thc_ma?.toFixed(2) ?? "--"} mA`,
    },
    {
      label: "POHC — 部分奇次谐波电流",
      value: result.pohc_ma?.toFixed(2) ?? "--",
      unit: "mA",
      sub: `Limit ${result.pohc_limit_ma?.toFixed(2) ?? "--"} mA`,
    },
  ];
}

export function buildSecondaryStats(result: HarmonicParseResult): SecondaryStat[] {
  return [
    {
      label: "功率因数",
      value: result.process_metrics.power_factor_avg?.toFixed(3) ?? "--",
      tone: (result.process_metrics.power_factor_avg ?? 0) >= 0.9 ? "good" : "neutral",
    },
    {
      label: "波峰因数",
      value: result.process_metrics.crest_factor?.toFixed(3) ?? "--",
      tone: "neutral",
    },
    {
      label: "失真因数",
      value: result.distortion_factor?.toFixed(3) ?? "--",
      tone: (result.distortion_factor ?? 0) >= 0.95 ? "good" : "critical",
    },
    {
      label: "频率",
      value: result.process_metrics.frequency_avg_hz?.toFixed(2)
        ? `${result.process_metrics.frequency_avg_hz?.toFixed(2)} Hz`
        : "--",
      tone: "good",
    },
    {
      label: "功率",
      value: result.process_metrics.power_avg_w?.toFixed(2)
        ? `${result.process_metrics.power_avg_w?.toFixed(2)} W`
        : "--",
      tone: "neutral",
    },
    {
      label: "电压",
      value: result.process_metrics.voltage_avg_v?.toFixed(2)
        ? `${result.process_metrics.voltage_avg_v?.toFixed(2)} V`
        : "--",
      tone: "neutral",
    },
  ];
}
