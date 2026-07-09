// 终样测试报告 —— A1 版本
// 数据来源：data/A1-c1dc8d.xlsx（已在构建前解析并结构化）

export type Status = "P" | "F" | "N"

export type StandardType = "rigid" | "soft"

export interface TestItem {
  code: string
  name: string
  /** 依据标准或要求 */
  standard: string
  /** 试验结果 / 数据路径 / 参数（若有） */
  result?: string
  /** 判定状态 P=合格 F=不合格 N=不适用或未测试 */
  status: Status
  /** 额外备注（异常提示等） */
  note?: string
  /** 是否为系统级风险源 */
  risk?: boolean
}

export interface ReportModule {
  key: "S" | "E" | "P" | "R"
  name: string
  fullName: string
  /** 模块汇总判定（来自结果汇总首页） */
  summaryStatus: Status
  standardType: StandardType
  /** 模块引用标准 */
  standard: string
  items: TestItem[]
}

export const meta = {
  title: "终样测试报告",
  subtitle: "Final Sample Test Report · A1 版本",
  oaNumber: "CPCESRZ-202606263269",
  applicant: "研发设计区 / 电子设计司 · 陆宇",
  productModel: "TL3006-GLR-6W / 12W / 16W",
  sampleCount: "3 × 3",
  receiveDate: "2026-06-29",
  testDate: "2026-06-29",
  tester: "刘星宇",
  testerDate: "2026-07-06",
  reviewer: "蔡雷",
  reviewerDate: "2026-07-06",
  environment: { temp: "25℃", humidity: "55%RH" },
} as const

export const modules: ReportModule[] = [
  {
    key: "S",
    name: "安规",
    fullName: "第一章 · 安规 / Safety",
    summaryStatus: "F",
    standardType: "rigid",
    standard: "IEC 60598-1:2020",
    items: [
      { code: "S1", name: "可替换部件", standard: "可替换零件应有足够更换空间，且更换时不损坏安全性。", status: "N" },
      { code: "S2", name: "接线端子座", standard: "链接引线需独立接线端子座，并预留足够安装空间。", status: "N" },
      { code: "S3", name: "开关", standard: "开关额定值充足、安装牢固，电子开关须符合 IEC 61058-1。", status: "N" },
      { code: "S4", name: "绝缘衬垫和套管", standard: "衬垫套管应保持部件位置，并具备机械/电气/热强度。", status: "N" },
      { code: "S5", name: "机械伤害", standard: "灯具不得有尖端或锐边，避免安装及使用中伤人。", status: "N" },
      { code: "S6", name: "接触电流", standard: "泄漏电流不超过 IEC60598-1 表10.3 数值。", status: "N", risk: true, note: "人身安全关键项未闭环" },
      { code: "S7", name: "外壳冲击试验", standard: "IEC60068-2-75 弹簧冲击装置验证机械强度。", status: "N" },
      { code: "S8", name: "外部导线", standard: "线径≥0.75/1.0mm²，导线固定拉力测试位移<2.0mm。", status: "N" },
      { code: "S9", name: "接地保护", standard: "接地电阻欧标<0.5Ω / 美标<0.1Ω，10A/1min。", status: "N", risk: true, note: "接地防线未见闭环数据" },
      { code: "S10", name: "防触电保护", standard: "带电部件不可被试验指触及，基本绝缘不可被Ø50mm球触及。", status: "N" },
      { code: "S11", name: "防水", standard: "对应 IP 等级后承受电气强度测试且无进水痕迹。", status: "N" },
      { code: "S12", name: "绝缘电阻 / 电气强度", standard: "500V/1min，双重绝缘4MΩ；耐压1000V+2U/2000V+4U。", status: "N", risk: true, note: "绝缘防线未见闭环数据" },
      { code: "S13", name: "爬电距离和电气间隙", standard: "基本绝缘间隙>1.5mm、爬电>2.5mm；加强绝缘>3.0/5.0mm。", status: "N" },
      { code: "S14", name: "热试验", standard: "IEC60598-1/IEC62560 温升测试。", result: "见附录一", status: "N", note: "有数据路径，明细未给判定" },
      { code: "S15", name: "耐热、耐燃", standard: "球压125℃/75℃、针焰10s、灼热丝650℃。", status: "N" },
      { code: "S16", name: "灯头互换性", standard: "灯头量规测试参考 IEC62560。", status: "N" },
      { code: "S17", name: "灯头抗扭矩", standard: "E27:3Nm / E14:1.15Nm / G5:0.5Nm / G13:1.0Nm。", result: "E14: 1.15Nm", status: "N", note: "有参数，明细未给判定" },
      { code: "S18", name: "结构", standard: "走线槽应光滑、无锐边毛刺，防止绝缘层磨损。", status: "N" },
      { code: "S19", name: "机械悬挂", standard: "4倍灯具质量负载施加1h，无明显变形。", status: "N" },
      { code: "S20", name: "滚筒测试", standard: "5圈/min，50cm跌落钢板，250g界限25/50次。", status: "N" },
      { code: "S21", name: "插头放电测试", standard: "断电1s后插头间电压≤34V（电容>0.1uF时）。", status: "N" },
      { code: "S22", name: "铭牌 / 标识擦拭测试", standard: "水/汽油布各擦拭15s，标记清晰不脱落卷曲。", status: "N" },
    ],
  },
  {
    key: "E",
    name: "EMC",
    fullName: "第二章 · 电磁兼容 / EMC",
    summaryStatus: "P",
    standardType: "rigid",
    standard: "IEC 61000 · EN55015 · EN61547",
    items: [
      { code: "E1", name: "传导（EMI）", standard: "EN55015（插座 EN55032），0.009-30MHz。", status: "N" },
      { code: "E2", name: "辐射（CDNE）", standard: "EN55015，30-300MHz。", result: "见 CDNE 报告", status: "N", note: "指向外部报告" },
      { code: "E3", name: "浪涌", standard: "EN61547，线-线 / 线-地测试后功能无异常。", result: "线-线 AC500V / AC1000V", status: "N", note: "有参数，明细未给判定" },
      { code: "E4", name: "谐波", standard: "IEC61000-3-2，Class C 谐波电流限值。", result: "见谐波报告", status: "N", note: "指向外部报告" },
      { code: "E5", name: "群脉冲测试", standard: "IEC61547，试验电压1000V，重复频率5KHz。", status: "N" },
    ],
  },
  {
    key: "P",
    name: "性能",
    fullName: "第三章 · 功能及性能 / Performance",
    summaryStatus: "F",
    standardType: "soft",
    standard: "依据规格书要求",
    items: [
      { code: "P1", name: "光色电", standard: "应符合规格书、说明书、包装和标签要求。", result: "见附录2", status: "F", risk: true, note: "总评不合格来源" },
      { code: "P2", name: "宽压", standard: "电压上/下限通电测试，功能应正常。", status: "N" },
      { code: "P3", name: "频闪测试", standard: "按规格书要求。", result: "见频闪报告", status: "N" },
      { code: "P4", name: "回流电", standard: "通电1min断电后，要求无回流电。", status: "N" },
      { code: "P5", name: "照度", standard: "按规格书要求。", result: "见频闪报告", status: "N" },
      { code: "P6", name: "驱动电性能", standard: "按规格书要求。", result: "见附录3", status: "N" },
      { code: "P7", name: "功率因素（PF）", standard: "5W<P≤25W 时 PF>0.7；家居允许>0.5。", status: "N" },
      { code: "P8", name: "产品功能", standard: "按规格书描述进行功能测试。", result: "见频闪报告", status: "N", risk: true, note: "未提供适配器 · 核心功能未验证仍流转" },
      { code: "P9", name: "待机功耗", standard: "无特殊要求时待机功耗≤0.5W。", status: "N" },
    ],
  },
  {
    key: "R",
    name: "可靠性",
    fullName: "第四章 · 可靠性及其它 / Reliability",
    summaryStatus: "F",
    standardType: "soft",
    standard: "依据规格书要求",
    items: [
      { code: "R1", name: "高温运行测试", standard: "+40℃环境连续运行，功能应正常。", status: "N", risk: true, note: "可靠性真空" },
      { code: "R2", name: "低温运行测试", standard: "-20℃环境连续运行72h，功能应正常。", status: "N", risk: true, note: "可靠性真空" },
      { code: "R3", name: "低温启动", standard: "-20℃放置2h后功能应正常。", status: "N", risk: true, note: "可靠性真空" },
      { code: "R4", name: "高温高湿", standard: "85℃/85%RH 放置168h，外观功能应正常。", status: "N", risk: true, note: "可靠性真空" },
      { code: "R5", name: "盐雾", standard: "中性盐雾NSS 48h，结果>9级。", status: "N", risk: true, note: "可靠性真空" },
      { code: "R6", name: "百格", standard: "10×10 网格附着力测试，等级>1级。", status: "N", risk: true, note: "可靠性真空" },
      { code: "R7", name: "震动测试", standard: "240Hz 震动1h后外观功能应正常。", status: "N", risk: true, note: "可靠性真空" },
      { code: "R8", name: "工艺检查", standard: "无裂纹断裂、严重划痕、标签剥离等重大缺陷。", status: "N" },
      { code: "R9", name: "开关耐用性", standard: "200次操作循环后应继续正常工作。", status: "N" },
      { code: "R10", name: "夹紧装置的耐用性", standard: "100周期连接/拆卸后弹簧夹仍能固定灯具。", status: "N" },
      { code: "R11", name: "整灯尺寸", standard: "尺寸符合规格书要求（±5%）。", result: "见附录4", status: "N" },
      { code: "R12", name: "整灯重量", standard: "重量（含配件）符合规格书要求（±5%）。", result: "见附录4", status: "N" },
      { code: "R13", name: "开关冲击", standard: "通电30s/断电30s，循环2000次后功能正常。", status: "N" },
      { code: "R14", name: "噪音", standard: "底噪<15dB 环境测试，值应低于规格书要求。", status: "N" },
      { code: "R15", name: "跌落", standard: "一角三边六面跌落后产品无损、功能正常。", status: "N" },
      { code: "R16", name: "灯珠颗数", standard: "灯珠颗数按规格书确认。", status: "N" },
      { code: "R17", name: "寿命测试", standard: "依据规格书进行，测试后功能应正常。", status: "N" },
    ],
  },
]

// ===== 附录：实测数据（报告中唯一的量化数值） =====

export const appendixTemperature = {
  title: "附录1 · 温度测试数据",
  ambient: "23℃",
  voltage: "40V(DC)",
  columns: ["温度点", "6W (℃)", "12W (℃)", "16W (℃)"],
  rows: [
    ["Q1", "69.28", "82.83", "74.07"],
    ["U1", "66.93", "82.31", "68.59"],
    ["二极管", "67.07", "83.76", "70.29"],
    ["灯珠", "61.87", "69.70", "62.97"],
    ["壳体", "58.06", "59.04", "56.99"],
  ],
}

export const appendixPhotometric = {
  title: "附录2 · 光色电数据记录",
  columns: ["样品型号", "电流(mA)", "功率(W)", "功率因数", "光通量(lm)", "色温(K)"],
  rows: [
    ["TL3006-GLR-6W", "499.4 / 463.5", "92 / 92", "0.2 / 0.2", "2731 / 2730", "—"],
    ["TL3006-GLR-12W", "998.5", "92.1", "1.0", "2746", "—"],
    ["TL3006-GLR-16W", "1298.8 / 1230", "82.2 / 82.3", "1.0 / 1.0", "2746 / 2743", "—"],
  ],
}

export const appendixDimension = {
  title: "附录4 · 整灯尺寸重量数据",
  columns: ["样品型号", "整灯重量(g)", "整灯尺寸(mm)"],
  rows: [
    ["TL3006-GLR-6W", "76", "115.84 × 24.92 × 27.53"],
    ["TL3006-GLR-12W", "137", "221.70 × 24.91 × 27.41"],
    ["TL3006-GLR-16W", "210", "327.48 × 25.46 × 27.33"],
  ],
}

// ===== 派生统计 =====

export function isExecuted(item: TestItem): boolean {
  return item.status !== "N" || Boolean(item.result)
}

export interface ModuleStats {
  total: number
  executed: number
  pass: number
  fail: number
  untested: number
  coverage: number // 已测覆盖率 %
}

export function getModuleStats(mod: ReportModule): ModuleStats {
  const total = mod.items.length
  const executed = mod.items.filter(isExecuted).length
  const pass = mod.items.filter((i) => i.status === "P").length
  const fail = mod.items.filter((i) => i.status === "F").length
  const untested = mod.items.filter((i) => i.status === "N" && !i.result).length
  return {
    total,
    executed,
    pass,
    fail,
    untested,
    coverage: Math.round((executed / total) * 100),
  }
}

export function getOverallStats() {
  const allItems = modules.flatMap((m) => m.items)
  const total = allItems.length
  const executed = allItems.filter(isExecuted).length
  const fail = allItems.filter((i) => i.status === "F").length
  const untested = allItems.filter((i) => i.status === "N" && !i.result).length
  const moduleTotal = modules.length
  const modulePass = modules.filter((m) => m.summaryStatus === "P").length
  const riskCount = allItems.filter((i) => i.risk).length
  return {
    total,
    executed,
    fail,
    untested,
    coverage: Math.round((executed / total) * 100),
    moduleTotal,
    modulePass,
    modulePassRate: Math.round((modulePass / moduleTotal) * 100),
    riskCount,
  }
}

export const statusLabel: Record<Status, string> = {
  P: "合格",
  F: "不合格",
  N: "未测 / 不适用",
}
