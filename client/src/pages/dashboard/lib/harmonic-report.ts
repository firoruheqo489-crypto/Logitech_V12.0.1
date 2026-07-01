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
  avg_ma: number | null;
  max_ma: number | null;
  limit_100_ma: number | null;
  limit_150_ma: number | null;
  ratio_percent: number | null;
  avg_percent: number;
  limit_percent: number | null;
  max_percent: number | null;
  max_limit_percent: number | null;
  status: string;
}

export interface PhaseCheck {
  checkpoint: string;
  measured_deg: number;
  limit_expression: string;
  status: string;
}

export interface StructuralCheck {
  code: string;
  value: number | null;
  limit: number | null;
  unit: string | null;
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
  phase_checks: PhaseCheck[];
  structural_checks: StructuralCheck[];
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
  avgMilliamp: number | null;
  limitMilliamp: number | null;
  ratioPercent: number | null;
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

export type ReportInsight = {
  label: string;
  value: string;
  tone: "neutral" | "good" | "critical";
  hint: string;
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

function resolveRowLimitPercent(row: HarmonicRow): number {
  if (typeof row.limit_percent === "number") return row.limit_percent;
  if (typeof row.max_limit_percent === "number") return row.max_limit_percent;
  return resolveIecClassCLimit(row.order);
}

function structuralCheckLabel(code: string): string {
  switch (code) {
    case "Ipeak_phase_angle":
      return "峰值电流最大相位角";
    case "I60_90pMin":
      return "60-90度正半波最小电流";
    case "I60_90nMax":
      return "60-90度负半波最大电流";
    default:
      return code;
  }
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
    const limit = resolveRowLimitPercent(row);
    const maxMagnitude = row.max_percent ?? row.avg_percent;
    const maxLimit = row.max_limit_percent ?? limit;
    const exceeds = row.status === "Fail" || magnitude > limit;
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
      const limit = resolveRowLimitPercent(row);
      const value = row.avg_percent;
      const margin = round2(limit - value);
      return {
        label: `Harmonic K${row.order}`,
        order: `K${row.order}`,
        value,
        limit,
        margin,
        critical: row.status === "Fail" || margin < 0,
        maxValue: row.max_percent ?? row.avg_percent,
        maxLimit: row.max_limit_percent ?? limit,
        avgMilliamp: row.avg_ma,
        limitMilliamp: row.limit_100_ma,
        ratioPercent: row.ratio_percent,
      };
    })
    .sort((left, right) => left.margin - right.margin)
    .slice(0, 8);
}

export function resolveHarmonicVerdict(result: HarmonicParseResult): "PASS" | "FAIL" {
  if (result.verdict === "Pass") return "PASS";
  if (result.verdict === "Fail") return "FAIL";
  if (result.phase_checks.some((check) => check.status === "Fail")) return "FAIL";
  if (result.structural_checks.some((check) => check.status === "Fail")) return "FAIL";
  return result.harmonics.some((row) => row.status === "Fail" || row.avg_percent > resolveRowLimitPercent(row))
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
      label: "PF — 功率因数",
      value: result.process_metrics.power_factor_avg?.toFixed(3) ?? "--",
      unit: "",
      sub: `DF ${result.distortion_factor?.toFixed(3) ?? "--"}`,
    },
    {
      label: "POWER — 实际功率",
      value: result.process_metrics.power_avg_w?.toFixed(2) ?? "--",
      unit: "W",
      sub: `Voltage ${result.process_metrics.voltage_avg_v?.toFixed(2) ?? "--"} V`,
    },
    {
      label: "FUNDAMENTAL — 基波电流",
      value: result.process_metrics.fundamental_current_avg_ma?.toFixed(2) ?? "--",
      unit: "mA",
      sub: `Ipeak ${(result.process_metrics.current_peak_avg_a ?? 0).toFixed(4)} A`,
    },
  ];
}

export function buildSecondaryStats(result: HarmonicParseResult): SecondaryStat[] {
  return [
    {
      label: "波峰比",
      value: result.process_metrics.crest_factor?.toFixed(3) ?? "--",
      tone: "neutral",
    },
    {
      label: "频率",
      value: result.process_metrics.frequency_avg_hz?.toFixed(2)
        ? `${result.process_metrics.frequency_avg_hz?.toFixed(2)} Hz`
        : "--",
      tone: "good",
    },
    {
      label: "POHC",
      value: result.pohc_ma?.toFixed(2) ? `${result.pohc_ma?.toFixed(2)} mA` : "--",
      tone: result.pohc_limit_ma != null && result.pohc_ma != null && result.pohc_ma > result.pohc_limit_ma ? "critical" : "neutral",
    },
    {
      label: "测试标准",
      value: result.standard || "--",
      tone: "neutral",
    },
  ];
}

export function buildReportInsights(result: HarmonicParseResult): ReportInsight[] {
  return [
    {
      label: "功率因数",
      value: result.process_metrics.power_factor_avg?.toFixed(3) ?? "--",
      tone: (result.process_metrics.power_factor_avg ?? 0) < 0.8 ? "critical" : "good",
      hint: "PF 偏低意味着驱动导通波形过窄，通常伴随高次谐波倒灌。",
    },
    {
      label: "总谐波失真",
      value: result.ithd_percent?.toFixed(2) ? `${result.ithd_percent?.toFixed(2)}%` : "--",
      tone: (result.ithd_percent ?? 0) > 100 ? "critical" : "neutral",
      hint: "THDi 明显高于 100% 时，谐波能量已经超过基波本体，属于结构性失真。",
    },
    {
      label: "波形相位失效点",
      value:
        result.phase_checks.filter((check) => check.status === "Fail").map((check) => check.checkpoint).join(", ") || "--",
      tone: result.phase_checks.some((check) => check.status === "Fail") ? "critical" : "good",
      hint: "先看 Q 相位点是否越界，可快速锁定导通峰值是否后移。",
    },
    {
      label: "谐波超标点",
      value:
        result.harmonics.filter((row) => row.status === "Fail").map((row) => `K${row.order}`).join(", ") || "--",
      tone: result.harmonics.some((row) => row.status === "Fail") ? "critical" : "good",
      hint: "最终定罪以具体超标谐波次序为证据链，当前重点是 3 次和 5 次。",
    },
  ];
}

export function buildStructuralAudit(result: HarmonicParseResult): Array<{
  label: string;
  value: string;
  limit: string;
  status: string;
}> {
  return result.structural_checks.map((check) => ({
    label: structuralCheckLabel(check.code),
    value: check.value != null ? `${check.value}${check.unit ? ` ${check.unit}` : ""}` : "--",
    limit: check.limit != null ? `${check.limit}${check.unit ? ` ${check.unit}` : ""}` : "--",
    status: check.status,
  }));
}
