export type Judgment = "PASS" | "FAIL";

export interface ReportMeta {
  fileName: string;
  productModel: string;
  testDate: string;
  equipmentId: string;
  operator: string;
  judgment: Judgment;
}

export interface MetricField {
  label: string;
  cn: string;
  value: string;
  unit?: string;
  primary?: boolean;
}

export interface ChromaticityModel {
  x: string;
  y: string;
  uPrime: string;
  vPrime: string;
  cct: string;
  duv: string;
  sdcm: number;
  sdcmTarget: number;
}

export interface SpectrumStats {
  peakWavelength: string;
  dominantWavelength: string;
  halfBandwidth: string;
  purity: string;
}

export interface IntegratingSphereParseResult {
  sdcm: number | null;
  chromaticity_x: number | null;
  chromaticity_y: number | null;
  u_prime: number | null;
  v_prime: number | null;
  duv: number | null;
  cct_k: number | null;
  ra: number | null;
  avg_r: number | null;
  flux_lm: number | null;
  efficacy_lm_per_w: number | null;
  radiant_power_mw: number | null;
  voltage_v: number | null;
  current_a: number | null;
  power_w: number | null;
  power_factor: number | null;
  dominant_wavelength_nm: number | null;
  peak_wavelength_nm: number | null;
  fwhm_nm: number | null;
  color_purity_percent: number | null;
  model: string | null;
  report_datetime: string | null;
  energy_efficiency_class: string | null;
  cqs_tm30_metrics: string | null;
  render_indices: Array<Record<string, number | null>>;
}

export interface ReportViewModel {
  reportMeta: ReportMeta;
  chromaticity: ChromaticityModel;
  spectrumStats: SpectrumStats;
  electricalInput: MetricField[];
  luminousOutput: MetricField[];
  colorQuality: MetricField[];
}

function formatMaybeNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function formatMaybeInteger(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "--";
  }
  return String(Math.round(value));
}

function formatMaybeSigned(value: number | null | undefined, digits = 4): string {
  if (value == null || Number.isNaN(value)) {
    return "--";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function findRenderIndex(rows: Array<Record<string, number | null>>, key: string): number | null {
  const row = rows.find((entry) => Object.prototype.hasOwnProperty.call(entry, key));
  const value = row?.[key];
  return typeof value === "number" ? value : null;
}

export function generateSpectrum() {
  const data: { wavelength: number; power: number }[] = [];
  const gauss = (x: number, mu: number, sigma: number, amp: number) =>
    amp * Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));

  for (let wl = 380; wl <= 780; wl += 2) {
    const blue = gauss(wl, 451, 13, 1.0);
    const phosphor = gauss(wl, 600, 75, 0.74);
    const tail = gauss(wl, 700, 60, 0.12);
    const power = Math.max(0, blue + phosphor + tail);
    data.push({ wavelength: wl, power: Number(power.toFixed(4)) });
  }

  return data;
}

export function buildReportViewModel(fileName: string, result: IntegratingSphereParseResult | null): ReportViewModel {
  const renderRows = result?.render_indices ?? [];
  const r9 = result ? findRenderIndex(renderRows, "R9") : null;
  const hasCorePass =
    result != null &&
    [
      result.cct_k,
      result.ra,
      result.flux_lm,
      result.efficacy_lm_per_w,
      result.voltage_v,
      result.current_a,
      result.power_w,
      result.power_factor,
    ].every((value) => value != null);

  return {
    reportMeta: {
      fileName: fileName || "--",
      productModel: result?.model || "--",
      testDate: result?.report_datetime || "--",
      equipmentId: "EVERFINE HAAS-1200",
      operator: "--",
      judgment: hasCorePass ? "PASS" : "FAIL",
    },
    chromaticity: {
      x: formatMaybeNumber(result?.chromaticity_x, 4),
      y: formatMaybeNumber(result?.chromaticity_y, 4),
      uPrime: formatMaybeNumber(result?.u_prime, 4),
      vPrime: formatMaybeNumber(result?.v_prime, 4),
      cct: formatMaybeInteger(result?.cct_k),
      duv: formatMaybeSigned(result?.duv, 4),
      sdcm: result?.sdcm ?? 0,
      sdcmTarget: 3,
    },
    spectrumStats: {
      peakWavelength: formatMaybeNumber(result?.peak_wavelength_nm, 1),
      dominantWavelength: formatMaybeNumber(result?.dominant_wavelength_nm, 1),
      halfBandwidth: formatMaybeNumber(result?.fwhm_nm, 1),
      purity: formatMaybeNumber(result?.color_purity_percent, 1),
    },
    electricalInput: [
      { label: "Voltage", cn: "电压", value: formatMaybeNumber(result?.voltage_v, 2), unit: "V (AC)" },
      { label: "Current", cn: "电流", value: formatMaybeNumber(result?.current_a != null ? result.current_a * 1000 : null, 2), unit: "mA" },
      { label: "Power", cn: "功率", value: formatMaybeNumber(result?.power_w, 3), unit: "W" },
      { label: "Power Factor", cn: "功率因数", value: formatMaybeNumber(result?.power_factor, 3), unit: "PF" },
    ],
    luminousOutput: [
      { label: "Luminous Flux", cn: "光通量", value: formatMaybeNumber(result?.flux_lm, 1), unit: "lm", primary: true },
      { label: "Luminous Efficiency", cn: "光效", value: formatMaybeNumber(result?.efficacy_lm_per_w, 2), unit: "lm/W", primary: true },
      { label: "Radiant Power", cn: "辐射功率", value: formatMaybeNumber(result?.radiant_power_mw, 1), unit: "mW" },
      { label: "Energy Class", cn: "能效等级", value: result?.energy_efficiency_class || "--", unit: "EEI" },
    ],
    colorQuality: [
      { label: "CCT", cn: "相关色温", value: formatMaybeInteger(result?.cct_k), unit: "K" },
      { label: "Ra / R9", cn: "显色指数 / 饱和红", value: `${formatMaybeNumber(result?.ra, 1)} / ${formatMaybeNumber(r9, 1)}`, unit: "CRI" },
      { label: "TM-30 Rf / Rg", cn: "保真度 / 色域", value: result?.cqs_tm30_metrics || "--", unit: "" },
      { label: "Color Purity", cn: "颜色纯度", value: formatMaybeNumber(result?.color_purity_percent, 1), unit: "%" },
    ],
  };
}
