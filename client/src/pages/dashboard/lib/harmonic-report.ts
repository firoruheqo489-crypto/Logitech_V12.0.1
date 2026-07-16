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
  limitSource: "pdf" | "derived";
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
  limitSource: "pdf" | "derived";
};

export type AlphaMetric = {
  label: string;
  value: string;
  unit: string;
  sub: string;
  tone: "neutral" | "good" | "watch";
};

export type SecondaryStat = {
  label: string;
  value: string;
  tone: "neutral" | "good" | "critical" | "watch";
};

export type ReportInsight = {
  label: string;
  value: string;
  tone: "neutral" | "good" | "critical" | "watch";
  hint: string;
};

export type HarmonicEvidenceItem = {
  label: string;
  value: string;
  basis: string;
  status: "PASS" | "FAIL" | "WATCH" | "MISSING";
};

export type HarmonicEvidenceAudit = {
  verdict: "PASS" | "FAIL" | "WATCH";
  reportVerdict: "PASS" | "FAIL" | null;
  failHarmonics: string[];
  phaseFailCount: number;
  structuralFailCount: number;
  missingItems: string[];
  contradictions: string[];
  evidence: HarmonicEvidenceItem[];
  observations: HarmonicEvidenceItem[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeStatus(status: string | null | undefined): "PASS" | "FAIL" | "UNKNOWN" {
  const normalized = (status || "").trim().toUpperCase();
  if (normalized === "PASS" || normalized === "PASSED" || normalized === "可接受") return "PASS";
  if (normalized === "FAIL" || normalized === "FAILED" || normalized === "NG") return "FAIL";
  return "UNKNOWN";
}

function formatNumber(value: number | null | undefined, digits = 2, suffix = ""): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : "--";
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

function resolveRowLimit(row: HarmonicRow): { value: number; source: "pdf" | "derived" } {
  if (typeof row.limit_percent === "number") return { value: row.limit_percent, source: "pdf" };
  if (typeof row.max_limit_percent === "number") return { value: row.max_limit_percent, source: "pdf" };
  return { value: resolveIecClassCLimit(row.order), source: "derived" };
}

function rowFails(row: HarmonicRow): boolean {
  const limit = resolveRowLimit(row).value;
  return normalizeStatus(row.status) === "FAIL" || row.avg_percent > limit;
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

export function evaluateHarmonicEvidence(result: HarmonicParseResult): HarmonicEvidenceAudit {
  const reportVerdict = normalizeStatus(result.verdict);
  const failedRows = result.harmonics.filter(rowFails);
  const failHarmonics = failedRows.map((row) => `K${row.order}`);
  const phaseFailCount = result.phase_checks.filter((check) => normalizeStatus(check.status) === "FAIL").length;
  const structuralFailCount = result.structural_checks.filter((check) => normalizeStatus(check.status) === "FAIL").length;
  const missingItems = [
    result.verdict ? null : "PDF总判定",
    result.harmonics.length ? null : "谐波限值表",
    result.phase_checks.length ? null : "Q1-Q6相位检查",
    result.structural_checks.length ? null : "结构硬伤检查",
  ].filter(Boolean) as string[];

  const detailFails = failedRows.length > 0 || phaseFailCount > 0 || structuralFailCount > 0;
  const contradictions: string[] = [];
  if (reportVerdict === "PASS" && detailFails) {
    contradictions.push("PDF总判定为 PASS，但明细证据存在 Fail 或超限。");
  }
  if (reportVerdict === "FAIL" && !detailFails) {
    contradictions.push("PDF总判定为 FAIL，但当前解析明细未找到失败项。");
  }

  // Optional Q/structure sections are not present in every valid laboratory PDF.
  // A report-level PASS remains PASS when no parsed detail actually fails;
  // missing optional sections stay visible as MISSING evidence instead of
  // turning a valid PDF into a false red failure.
  const verdict: HarmonicEvidenceAudit["verdict"] =
    detailFails || reportVerdict === "FAIL"
      ? "FAIL"
      : reportVerdict === "PASS"
        ? "PASS"
        : "WATCH";

  const worstMargin = buildMarginAudit(result)[0];
  const evidence: HarmonicEvidenceItem[] = [
    {
      label: "PDF结论",
      value: reportVerdict === "UNKNOWN" ? "--" : reportVerdict,
      basis: result.standard || "未解析到测试标准",
      status: reportVerdict === "UNKNOWN" ? "MISSING" : reportVerdict,
    },
    {
      label: "谐波限值",
      value: failHarmonics.length ? failHarmonics.join("、") : "无超限",
      basis: worstMargin
        ? `最小余量 ${worstMargin.margin.toFixed(2)}%，限值来源：${worstMargin.limitSource === "pdf" ? "PDF原始限值" : "规则推导"}`
        : "未解析到谐波行",
      status: failHarmonics.length ? "FAIL" : result.harmonics.length ? "PASS" : "MISSING",
    },
    {
      label: "Q相位检查",
      value: phaseFailCount ? `${phaseFailCount}项失败` : result.phase_checks.length ? "全部通过" : "--",
      basis: result.phase_checks.length ? `已解析 ${result.phase_checks.length} 个检查点` : "未解析到Q1-Q6检查",
      status: phaseFailCount ? "FAIL" : result.phase_checks.length ? "PASS" : "MISSING",
    },
    {
      label: "结构检查",
      value: structuralFailCount ? `${structuralFailCount}项失败` : result.structural_checks.length ? "全部通过" : "--",
      basis: result.structural_checks.length ? `已解析 ${result.structural_checks.length} 个检查项` : "未解析到结构检查",
      status: structuralFailCount ? "FAIL" : result.structural_checks.length ? "PASS" : "MISSING",
    },
  ];

  const pf = result.process_metrics.power_factor_avg;
  const ithd = result.ithd_percent;
  const observations: HarmonicEvidenceItem[] = [
    {
      label: "功率因数",
      value: formatNumber(pf, 3),
      basis: "工程观察项，不直接覆盖实验室PASS/FAIL结论",
      status: pf == null ? "MISSING" : pf < 0.8 ? "WATCH" : "PASS",
    },
    {
      label: "总谐波失真",
      value: formatNumber(ithd, 2, "%"),
      basis: "描述电流畸变程度，合规仍以PDF限值表和报告结论为准",
      status: ithd == null ? "MISSING" : ithd > 100 ? "WATCH" : "PASS",
    },
    {
      label: "POHC",
      value: formatNumber(result.pohc_ma, 2, " mA"),
      basis:
        result.pohc_limit_ma == null
          ? "PDF未给出POHC限值"
          : `PDF限值 ${result.pohc_limit_ma.toFixed(2)} mA`,
      status:
        result.pohc_ma == null
          ? "MISSING"
          : result.pohc_limit_ma != null && result.pohc_ma > result.pohc_limit_ma
            ? "WATCH"
            : "PASS",
    },
  ];

  return {
    verdict,
    reportVerdict: reportVerdict === "UNKNOWN" ? null : reportVerdict,
    failHarmonics,
    phaseFailCount,
    structuralFailCount,
    missingItems,
    contradictions,
    evidence,
    observations,
  };
}

export function buildHarmonicWaveform(result: HarmonicParseResult): WavePoint[] {
  const points: WavePoint[] = [];
  const pf = clamp(result.process_metrics.power_factor_avg ?? 0.95, -1, 1);
  const phaseShift = Math.acos(pf);
  const voltageRms = result.process_metrics.voltage_avg_v ?? 230;
  const voltagePeak = voltageRms * Math.sqrt(2);
  const fundamentalCurrentRms = (result.process_metrics.fundamental_current_avg_ma ?? 200) / 1000;
  const baseCurrentPeak = result.process_metrics.current_peak_avg_a ?? fundamentalCurrentRms * Math.sqrt(2);
  const harmonics = result.harmonics.slice(0, 12);

  for (let deg = 0; deg <= 360; deg += 4) {
    const rad = (deg * Math.PI) / 180;
    const voltage = voltagePeak * Math.sin(rad);
    let current = baseCurrentPeak * Math.sin(rad - phaseShift);

    for (const harmonic of harmonics) {
      const ratio = (harmonic.avg_percent || 0) / 100;
      current += baseCurrentPeak * ratio * Math.sin(harmonic.order * rad - phaseShift);
    }

    points.push({ deg, voltage: round2(voltage), current: round2(current) });
  }

  return points;
}

export function buildHarmonicSpectrum(result: HarmonicParseResult): HarmonicBar[] {
  return result.harmonics.map((row) => {
    const magnitude = row.avg_percent;
    const limit = resolveRowLimit(row);
    const maxMagnitude = row.max_percent ?? row.avg_percent;
    const maxLimit = row.max_limit_percent ?? limit.value;
    return {
      order: `K${row.order}`,
      k: row.order,
      magnitude,
      limit: limit.value,
      maxMagnitude,
      maxLimit,
      exceeds: rowFails(row),
      limitSource: limit.source,
    };
  });
}

export function buildMarginAudit(result: HarmonicParseResult): MarginRow[] {
  return result.harmonics
    .map((row) => {
      const limit = resolveRowLimit(row);
      const value = row.avg_percent;
      const margin = round2(limit.value - value);
      return {
        label: `Harmonic K${row.order}`,
        order: `K${row.order}`,
        value,
        limit: limit.value,
        margin,
        critical: rowFails(row),
        maxValue: row.max_percent ?? row.avg_percent,
        maxLimit: row.max_limit_percent ?? limit.value,
        avgMilliamp: row.avg_ma,
        limitMilliamp: row.limit_100_ma,
        ratioPercent: row.ratio_percent,
        limitSource: limit.source,
      };
    })
    .sort((left, right) => left.margin - right.margin)
    .slice(0, 8);
}

export function resolveHarmonicVerdict(result: HarmonicParseResult): "PASS" | "FAIL" | "WATCH" {
  return evaluateHarmonicEvidence(result).verdict;
}

export function buildAlphaMetrics(result: HarmonicParseResult): AlphaMetric[] {
  const audit = evaluateHarmonicEvidence(result);
  return [
    {
      label: "THDi 总谐波失真",
      value: formatNumber(result.ithd_percent, 2),
      unit: "%",
      sub: `THC ${formatNumber(result.thc_ma, 2, " mA")}`,
      tone: result.ithd_percent != null && result.ithd_percent > 100 ? "watch" : "neutral",
    },
    {
      label: "PF 功率因数",
      value: formatNumber(result.process_metrics.power_factor_avg, 3),
      unit: "",
      sub: `DF ${formatNumber(result.distortion_factor, 3)}`,
      tone: result.process_metrics.power_factor_avg != null && result.process_metrics.power_factor_avg < 0.8 ? "watch" : "neutral",
    },
    {
      label: "POWER 实际功率",
      value: formatNumber(result.process_metrics.power_avg_w, 2),
      unit: "W",
      sub: `Voltage ${formatNumber(result.process_metrics.voltage_avg_v, 2, " V")}`,
      tone: "neutral",
    },
    {
      label: "PDF 结论",
      value: audit.reportVerdict ?? "--",
      unit: "",
      sub: result.standard || "未解析到标准",
      tone: audit.verdict === "PASS" ? "good" : audit.verdict === "WATCH" ? "watch" : "neutral",
    },
  ];
}

export function buildSecondaryStats(result: HarmonicParseResult): SecondaryStat[] {
  return [
    {
      label: "波峰比",
      value: formatNumber(result.process_metrics.crest_factor, 3),
      tone: "neutral",
    },
    {
      label: "频率",
      value: formatNumber(result.process_metrics.frequency_avg_hz, 2, " Hz"),
      tone: "good",
    },
    {
      label: "POHC",
      value: formatNumber(result.pohc_ma, 2, " mA"),
      tone:
        result.pohc_limit_ma != null && result.pohc_ma != null && result.pohc_ma > result.pohc_limit_ma
          ? "watch"
          : "neutral",
    },
    {
      label: "测试标准",
      value: result.standard || "--",
      tone: "neutral",
    },
  ];
}

export function buildReportInsights(result: HarmonicParseResult): ReportInsight[] {
  const audit = evaluateHarmonicEvidence(result);
  return [
    {
      label: "结论一致性",
      value: audit.contradictions.length ? "需复核" : audit.verdict,
      tone: audit.contradictions.length ? "watch" : audit.verdict === "FAIL" ? "critical" : "good",
      hint: audit.contradictions[0] || "PDF总判定与谐波、相位、结构明细保持一致。",
    },
    {
      label: "功率因数",
      value: formatNumber(result.process_metrics.power_factor_avg, 3),
      tone: result.process_metrics.power_factor_avg != null && result.process_metrics.power_factor_avg < 0.8 ? "watch" : "neutral",
      hint: "工程观察项：PF偏低说明驱动波形较窄，但不单独覆盖实验室PASS/FAIL。",
    },
    {
      label: "总谐波失真",
      value: formatNumber(result.ithd_percent, 2, "%"),
      tone: result.ithd_percent != null && result.ithd_percent > 100 ? "watch" : "neutral",
      hint: "描述畸变程度；当前合规判断仍以PDF原始限值表、Q检查和结构检查为准。",
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
    status: normalizeStatus(check.status),
  }));
}
