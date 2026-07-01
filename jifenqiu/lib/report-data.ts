// 积分球测试报告 - 解析后的遥测数据
// Integrating Sphere Report - parsed telemetry model

export type Judgment = "PASS" | "FAIL"

export interface ReportMeta {
  fileName: string
  productModel: string
  testDate: string
  equipmentId: string
  operator: string
  judgment: Judgment
}

export interface MetricField {
  label: string // English technical label
  cn: string // Chinese label
  value: string
  unit?: string
  primary?: boolean // scale up the number
}

export const reportMeta: ReportMeta = {
  fileName: "IS_Report_LED-X9_20260628.pdf",
  productModel: "LED-X9 / 5W COB Module",
  testDate: "2026-06-28 14:32:07",
  equipmentId: "OHSP-350 / SN-220841",
  operator: "LAB-OP-07",
  judgment: "PASS",
}

// 光学/色品关键指标
export const chromaticity = {
  x: "0.3142",
  y: "0.3271",
  uPrime: "0.1968",
  vPrime: "0.4612",
  cct: 6503, // K
  duv: "+0.0021",
  sdcm: 2.8, // step / MacAdam
  sdcmTarget: 3,
}

export const spectrumStats = {
  peakWavelength: "451.2", // λp nm
  dominantWavelength: "574.6", // λd nm
  halfBandwidth: "118.4", // FWHM nm
  purity: "31.4", // %
}

// 电参数输入舱
export const electricalInput: MetricField[] = [
  { label: "Voltage", cn: "电压", value: "219.84", unit: "V (AC)" },
  { label: "Current", cn: "电流", value: "23.41", unit: "mA" },
  { label: "Power", cn: "功率", value: "5.014", unit: "W" },
  { label: "Power Factor", cn: "功率因数", value: "0.962", unit: "PF" },
]

// 光参数输出舱
export const luminousOutput: MetricField[] = [
  { label: "Luminous Flux", cn: "光通量", value: "642.7", unit: "lm", primary: true },
  { label: "Luminous Efficiency", cn: "光效", value: "128.2", unit: "lm/W", primary: true },
  { label: "Radiant Power", cn: "辐射功率", value: "1843.6", unit: "mW" },
  { label: "Energy Class", cn: "能效等级", value: "A++", unit: "EEI" },
]

// 颜色质量诊断仓
export const colorQuality: MetricField[] = [
  { label: "CCT", cn: "相关色温", value: "6503", unit: "K" },
  { label: "Ra / R9", cn: "显色指数 / 饱和红", value: "85.4 / 42", unit: "CRI" },
  { label: "TM-30 Rf / Rg", cn: "保真度 / 色域", value: "88 / 101", unit: "" },
  { label: "Color Purity", cn: "颜色纯度", value: "31.4", unit: "%" },
]

// 生成光谱功率分布 (380nm - 780nm) - 典型白光 LED 双峰
export function generateSpectrum() {
  const data: { wavelength: number; power: number }[] = []
  const gauss = (x: number, mu: number, sigma: number, amp: number) =>
    amp * Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2))

  for (let wl = 380; wl <= 780; wl += 2) {
    // 蓝光泵浦峰 ~451nm + 荧光粉宽峰 ~600nm
    const blue = gauss(wl, 451, 13, 1.0)
    const phosphor = gauss(wl, 600, 75, 0.74)
    const tail = gauss(wl, 700, 60, 0.12)
    const power = Math.max(0, blue + phosphor + tail)
    data.push({ wavelength: wl, power: Number(power.toFixed(4)) })
  }
  return data
}
