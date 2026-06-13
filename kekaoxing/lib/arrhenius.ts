// 阿伦尼乌斯加速寿命物理引擎
// 玻尔兹曼常数 (eV/K)
export const BOLTZMANN_EV = 8.617e-5
export const HOURS_PER_YEAR = 8760
export const KELVIN_OFFSET = 273.15

export interface ArrheniusInput {
  tUse: number // 实际工作温度 °C
  tTest: number // 加速测试温度 °C
  ea: number // 激活能 eV
  testDuration: number // 测试耗时 (小时)
}

export interface ArrheniusResult {
  af: number // 加速因子
  projectedHours: number // 预测寿命 (小时)
  projectedYears: number // 预测寿命 (年)
  valid: boolean // 物理是否有效 (T_test > T_use)
}

// 摄氏度转开尔文
export function toKelvin(celsius: number): number {
  return celsius + KELVIN_OFFSET
}

// 计算加速因子: AF = exp((Ea / k) * (1/T_use - 1/T_test))
export function accelerationFactor(
  tUseC: number,
  tTestC: number,
  ea: number,
): number {
  const tUseK = toKelvin(tUseC)
  const tTestK = toKelvin(tTestC)
  return Math.exp((ea / BOLTZMANN_EV) * (1 / tUseK - 1 / tTestK))
}

export function computeArrhenius(input: ArrheniusInput): ArrheniusResult {
  const { tUse, tTest, ea, testDuration } = input
  const valid = tTest > tUse
  const af = accelerationFactor(tUse, tTest, ea)
  const projectedHours = testDuration * af
  const projectedYears = projectedHours / HOURS_PER_YEAR
  return { af, projectedHours, projectedYears, valid }
}

// 材料激活能指纹库
export interface MaterialPreset {
  id: string
  label: string
  en: string
  ea: number
  tier: "system" | "component"
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: "sys-composite",
    label: "成品灯 - 综合失效",
    en: "System Composite",
    ea: 0.65,
    tier: "system",
  },
  {
    id: "sys-driver",
    label: "成品灯 - 驱动瓶颈",
    en: "Driver Bottleneck",
    ea: 0.9,
    tier: "system",
  },
  {
    id: "sys-lumen",
    label: "成品灯 - 光衰衰减",
    en: "Lumen Drop",
    ea: 0.45,
    tier: "system",
  },
  {
    id: "led",
    label: "LED芯片 - 硅胶",
    en: "LED Chip / Silicone",
    ea: 0.6,
    tier: "component",
  },
  {
    id: "cap",
    label: "电解电容 - 驱动",
    en: "Electrolytic Cap",
    ea: 0.9,
    tier: "component",
  },
  {
    id: "pcb",
    label: "PCB - 焊点疲劳",
    en: "PCB Solder Fatigue",
    ea: 1.2,
    tier: "component",
  },
]

// 目标质保年限 (违约风险阈值)
export const TARGET_WARRANTY_YEARS = 3

// 透视数据行
export interface ProjectionRow {
  tempC: number
  tempK: number
  af: number
  hours: number
  years: number
}

// 生成温度扫描数据表 (默认 25→150°C 步长 5)
export function buildProjectionTable(
  tTest: number,
  ea: number,
  testDuration: number,
  from = 25,
  to = 150,
  step = 5,
): ProjectionRow[] {
  const rows: ProjectionRow[] = []
  for (let t = from; t <= to; t += step) {
    const af = t < tTest ? accelerationFactor(t, tTest, ea) : 0
    const hours = af > 0 ? testDuration * af : 0
    rows.push({
      tempC: t,
      tempK: toKelvin(t),
      af,
      hours,
      years: hours / HOURS_PER_YEAR,
    })
  }
  return rows
}

// 格式化数字加逗号
export function formatNumber(n: number, digits = 0): string {
  if (!isFinite(n)) return '∞'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
