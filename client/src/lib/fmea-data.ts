export type FmeaStatus = "pending" | "testing" | "closed"
export type FmeaClass = "CC" | "SC" | "STD"
export type FmeaRiskBand = "critical" | "warning" | "safe"
export type FmeaBomIcon =
  | "root"
  | "driver"
  | "thermal"
  | "optical"
  | "mechanical"
  | "surge"
  | "derating"
  | "flicker"
  | "emc"
  | "heatsink"
  | "tim"
  | "cfd"
  | "junction"
  | "lens"
  | "reflector"
  | "ies"
  | "spectrum"
  | "sealing"
  | "corrosion"
  | "vent"
  | "drop"

export interface FmeaRow {
  id: string
  systemId: string
  process: string
  mode: string
  effect: string
  classification: FmeaClass
  crossRisk: string
  sev: number
  cause: string
  pc: string
  occ: number
  dc: string
  det: number
  rpn: number
  dvprLinks: string[]
  action: string
  ownerGate: string
  status: FmeaStatus
}

export interface FmeaBomNode {
  id: string
  label: string
  description: string
  owner: string
  icon: FmeaBomIcon
  children?: FmeaBomNode[]
}

export interface SeverityLockMeta {
  lockedSeverity: 9 | 10
  matchedRules: string[]
  helperText: string
}

type SeverityRule = {
  severity: 9 | 10
  label: string
  pattern: RegExp
}

type SeedRow = Omit<FmeaRow, "rpn" | "systemId"> & {
  systemId?: string
}

export const defaultBomNodeId = "lighting-root"

export const lightingBomTree: FmeaBomNode[] = [
  {
    id: defaultBomNodeId,
    label: "照明行业 FMEA 架构",
    description: "以四大核心子系统为主轴，建立跨部门联合签审与行政定责。",
    owner: "系统工程 / 项目负责人",
    icon: "root",
    children: [
      {
        id: "driver-electrical",
        label: "驱动与电气系统",
        description: "寿命短板与电网冲击，预防控制必须绑定关键物料降额审查（Derating）。",
        owner: "电子研发 / EMC / 认证",
        icon: "driver",
        children: [
          {
            id: "driver-derating",
            label: "关键物料降额审查",
            description: "聚焦电解电容、MOSFET 与磁件寿命裕量。",
            owner: "电子研发 / 采购",
            icon: "derating",
          },
          {
            id: "driver-surge",
            label: "浪涌与输入保护",
            description: "聚焦 Surge 拦截与雷击后安规风险。",
            owner: "电子研发 / 认证",
            icon: "surge",
          },
          {
            id: "driver-flicker",
            label: "频闪与调光控制",
            description: "聚焦 Flicker、Pst LM、SVM 与调光边界。",
            owner: "电子研发 / 测试",
            icon: "flicker",
          },
          {
            id: "driver-emc",
            label: "EMC / EMI 合规",
            description: "聚焦辐射、传导与认证出货门禁。",
            owner: "电子研发 / 认证",
            icon: "emc",
          },
        ],
      },
      {
        id: "thermal-management",
        label: "热管理系统",
        description: "结温是 LED 的生命线，失效后果必须直接挂钩 L70 寿命缩短与色漂移。",
        owner: "热学 / 结构",
        icon: "thermal",
        children: [
          {
            id: "thermal-heatsink",
            label: "散热器与热路径",
            description: "聚焦热阻预算、鳍片面积与热路径连续性。",
            owner: "热学 / 结构",
            icon: "heatsink",
          },
          {
            id: "thermal-tim",
            label: "导热界面材料涂覆",
            description: "聚焦 TIM 挥发、厚度离散与装配一致性。",
            owner: "热学 / 制造",
            icon: "tim",
          },
          {
            id: "thermal-cfd",
            label: "热仿真报告（CFD）",
            description: "聚焦仿真边界条件、八维工况输入与相关性。",
            owner: "热学 / 系统工程",
            icon: "cfd",
          },
          {
            id: "thermal-junction",
            label: "结温实测",
            description: "聚焦 Tc/Tj 实测与换算链闭环。",
            owner: "热学 / 测试",
            icon: "junction",
          },
        ],
      },
      {
        id: "optical-system",
        label: "光学系统",
        description: "聚焦配光与光品质，探测措施必须写明 IES 测试或积分球光谱分析。",
        owner: "光学 / 测试",
        icon: "optical",
        children: [
          {
            id: "optical-lens",
            label: "透镜与扩散件",
            description: "聚焦透镜黄化、材料耐 UV 与光通维持。",
            owner: "光学 / 材料",
            icon: "lens",
          },
          {
            id: "optical-reflector",
            label: "反光杯与镀层",
            description: "聚焦镀层附着、暗区与黄圈投诉。",
            owner: "光学 / 工艺",
            icon: "reflector",
          },
          {
            id: "optical-ies",
            label: "IES 配光验证",
            description: "聚焦 UGR、配光曲线与应用场景匹配。",
            owner: "光学 / 应用",
            icon: "ies",
          },
          {
            id: "optical-spectrum",
            label: "积分球光谱分析",
            description: "聚焦光谱、显指与色容差稳定性。",
            owner: "光学 / SQE",
            icon: "spectrum",
          },
        ],
      },
      {
        id: "mechanical-enclosure",
        label: "结构与防护系统",
        description: "聚焦进水、腐蚀与跌落伤害，预防控制必须写明透气阀配型或负压测试。",
        owner: "结构 / 可靠性",
        icon: "mechanical",
        children: [
          {
            id: "mechanical-sealing",
            label: "密封与防护",
            description: "聚焦密封圈老化、压缩永久变形与 IP 防护失效。",
            owner: "结构 / 可靠性",
            icon: "sealing",
          },
          {
            id: "mechanical-corrosion",
            label: "压铸铝与盐雾",
            description: "聚焦压铸铝腐蚀与表面处理耐候性。",
            owner: "结构 / 表处",
            icon: "corrosion",
          },
          {
            id: "mechanical-vent",
            label: "防水透气阀与压差",
            description: "聚焦呼吸效应吸水、内外压差与冷热循环。",
            owner: "结构 / 可靠性",
            icon: "vent",
          },
          {
            id: "mechanical-drop",
            label: "结构固定与跌落",
            description: "聚焦安装跌落、紧固失效与人身伤害。",
            owner: "结构 / 安全",
            icon: "drop",
          },
        ],
      },
    ],
  },
]

export const bomProcessMapping: Record<string, string[]> = {
  [defaultBomNodeId]: [],
  "driver-electrical": [
    "关键物料降额审查",
    "浪涌与输入保护",
    "频闪与调光控制",
    "EMC / EMI 合规",
  ],
  "driver-derating": ["关键物料降额审查"],
  "driver-surge": ["浪涌与输入保护"],
  "driver-flicker": ["频闪与调光控制"],
  "driver-emc": ["EMC / EMI 合规"],
  "thermal-management": [
    "散热器与热路径",
    "导热界面材料涂覆",
    "热仿真报告（CFD）",
    "结温实测",
  ],
  "thermal-heatsink": ["散热器与热路径"],
  "thermal-tim": ["导热界面材料涂覆"],
  "thermal-cfd": ["热仿真报告（CFD）"],
  "thermal-junction": ["结温实测"],
  "optical-system": [
    "透镜与扩散件",
    "反光杯与镀层",
    "IES 配光验证",
    "积分球光谱分析",
  ],
  "optical-lens": ["透镜与扩散件"],
  "optical-reflector": ["反光杯与镀层"],
  "optical-ies": ["IES 配光验证"],
  "optical-spectrum": ["积分球光谱分析"],
  "mechanical-enclosure": [
    "密封与防护",
    "压铸铝与盐雾",
    "防水透气阀与压差",
    "结构固定与跌落",
  ],
  "mechanical-sealing": ["密封与防护"],
  "mechanical-corrosion": ["压铸铝与盐雾"],
  "mechanical-vent": ["防水透气阀与压差"],
  "mechanical-drop": ["结构固定与跌落"],
}

const CORE_SYSTEM_NODE_IDS = [
  "driver-electrical",
  "thermal-management",
  "optical-system",
  "mechanical-enclosure",
] as const

const PROCESS_TO_SYSTEM_ID = Object.entries(bomProcessMapping).reduce<
  Record<string, string>
>((accumulator, [nodeId, processes]) => {
  if (!CORE_SYSTEM_NODE_IDS.includes(nodeId as (typeof CORE_SYSTEM_NODE_IDS)[number])) {
    return accumulator
  }

  for (const process of processes) {
    accumulator[process] = nodeId
  }

  return accumulator
}, {})

const SEVERITY_LOCK_RULES: SeverityRule[] = [
  {
    severity: 10,
    label: "安规击穿 / 起火",
    pattern: /(安规|击穿|起火|燃烧|fire)/i,
  },
  {
    severity: 10,
    label: "跌落伤人",
    pattern: /(跌落|伤人|坠落)/i,
  },
  {
    severity: 9,
    label: "进水 / IP 等级失效",
    pattern: /(进水|IP(?:等级)?失效|防水失效|起雾)/i,
  },
]

const seedRows: SeedRow[] = [
  {
    id: "lighting-001",
    process: "关键物料降额审查",
    mode: "电解电容干涸",
    effect: "驱动寿命提前终止，整灯死亡，质保期内批量失效。",
    classification: "CC",
    crossRisk: "@热学工程师复核驱动腔温升；@采购锁定 105°C 长寿命电容料号。",
    sev: 9,
    cause: "关键电容纹波电流与腔体温度降额不足。",
    pc: "关键物料降额审查（Derating）+ 电容寿命模型复核。",
    occ: 5,
    dc: "高温通电寿命试验 + 电容壳温实测。",
    dvprLinks: ["HTOL 85C", "TM-21 Review"],
    det: 4,
    action: "改为 105°C 长寿命电容，并下调纹波负载率。",
    ownerGate: "李工 @ EVT",
    status: "pending",
  },
  {
    id: "lighting-002",
    process: "浪涌与输入保护",
    mode: "浪涌击穿",
    effect: "雷击后驱动失效，安规击穿并可能起火。",
    classification: "CC",
    crossRisk: "@认证工程师确认雷击等级；@结构工程师复核接地路径。",
    sev: 6,
    cause: "MOV / TVS 选型余量不足，前级拦截失效。",
    pc: "SPD 级联设计 + 关键物料降额审查（Derating）。",
    occ: 3,
    dc: "IEC 61000-4-5 浪涌测试 + 绝缘耐压复测。",
    dvprLinks: ["Surge 4KV", "Hi-Pot"],
    det: 3,
    action: "提升 MOV 能量等级并增加共模防护。",
    ownerGate: "陈工 @ DVT",
    status: "testing",
  },
  {
    id: "lighting-003",
    process: "频闪与调光控制",
    mode: "频闪过高",
    effect: "视觉不适、视频拍摄条纹，项目验收失败。",
    classification: "SC",
    crossRisk: "@光学工程师确认频闪对显色演示影响；@软件工程师同步调光曲线。",
    sev: 7,
    cause: "PFC 与输出纹波控制不足，调光边界未覆盖低占空比。",
    pc: "驱动拓扑评审 + 调光边界条件验证。",
    occ: 4,
    dc: "频闪百分比 / Pst LM / SVM 测试。",
    dvprLinks: ["Flicker Test", "Pst LM", "SVM"],
    det: 4,
    action: "优化控制环路并增加输出储能。",
    ownerGate: "王工 @ DVT",
    status: "pending",
  },
  {
    id: "lighting-004",
    process: "EMC / EMI 合规",
    mode: "EMI 辐射超标",
    effect: "无法通过 EMC 认证，出货受阻。",
    classification: "SC",
    crossRisk: "@PCB 工程师调整布局；@认证工程师联合签字放行。",
    sev: 8,
    cause: "共模噪声抑制不足，布线回路过大。",
    pc: "EMC 预一致性设计审查 + 接地回流路径检查。",
    occ: 3,
    dc: "RE / CE 预扫 + LISN 复测。",
    dvprLinks: ["EN55015 RE", "EN55015 CE"],
    det: 4,
    action: "补充共模扼流圈并重构接地回路。",
    ownerGate: "赵工 @ DVT",
    status: "closed",
  },
  {
    id: "lighting-005",
    process: "散热器与热路径",
    mode: "热阻过高",
    effect: "LED 结温超限，L70 寿命缩短并出现色漂移。",
    classification: "CC",
    crossRisk: "@结构工程师确认体积边界；@光学工程师评估色漂移风险。",
    sev: 9,
    cause: "散热鳍片面积不足，热路径中断。",
    pc: "热仿真报告（CFD）+ 热阻预算评审。",
    occ: 4,
    dc: "热电偶 Mapping + 红外热像。",
    dvprLinks: ["CFD Report", "Tc Mapping"],
    det: 4,
    action: "增加鳍片表面积并缩短热传导路径。",
    ownerGate: "刘工 @ EVT",
    status: "pending",
  },
  {
    id: "lighting-006",
    process: "导热界面材料涂覆",
    mode: "硅脂挥发 / 涂抹不均",
    effect: "基板局部热点，光通维持率下降，早期光衰。",
    classification: "SC",
    crossRisk: "@制造工程师维护点胶治具；@质量工程师追加剖面审核。",
    sev: 8,
    cause: "TIM 点胶窗口不稳定，装配厚度漂移。",
    pc: "TIM 施工窗口标准 + 点胶重量监控。",
    occ: 5,
    dc: "剖面厚度检查 + 热阻抽测。",
    dvprLinks: ["Thermal Shock", "IR Mapping"],
    det: 5,
    action: "改用自动点胶并锁定涂覆重量。",
    ownerGate: "周工 @ PVT",
    status: "testing",
  },
  {
    id: "lighting-007",
    process: "热仿真报告（CFD）",
    mode: "仿真边界条件失真",
    effect: "量产热设计偏离实测，结温控制失真。",
    classification: "SC",
    crossRisk: "@结构工程师提供安装姿态；@项目经理确认八维工况边界。",
    sev: 8,
    cause: "环境工况与安装姿态未覆盖真实场景。",
    pc: "热仿真报告（CFD）强制评审 + 八维工况输入校核。",
    occ: 3,
    dc: "仿真 / 实测相关性比对。",
    dvprLinks: ["CFD Review", "ΔT Correlation"],
    det: 4,
    action: "补充封闭腔体与高温工况模型。",
    ownerGate: "黄工 @ EVT",
    status: "closed",
  },
  {
    id: "lighting-008",
    process: "结温实测",
    mode: "Tj 监控缺失",
    effect: "过热风险未被及时识别，寿命声明失真。",
    classification: "CC",
    crossRisk: "@测试工程师补足稳态记录；@电子工程师提供功耗边界。",
    sev: 8,
    cause: "仅测壳温，未建立 Tc 到 Tj 的换算链。",
    pc: "结温换算规范 + 热电偶布点审查。",
    occ: 4,
    dc: "Tc / Tj 联动实测 + 长稳态记录。",
    dvprLinks: ["LM-80", "Tj Estimation"],
    det: 4,
    action: "增加结温换算模板与复核门槛。",
    ownerGate: "孙工 @ DVT",
    status: "testing",
  },
  {
    id: "lighting-009",
    process: "透镜与扩散件",
    mode: "透镜黄化",
    effect: "光通下降、色温漂移，外观失真。",
    classification: "SC",
    crossRisk: "@采购确认树脂等级；@热学工程师复核温升对黄化加速影响。",
    sev: 8,
    cause: "UV 老化抗性不足，材料选型错误。",
    pc: "材料耐 UV 审查 + 老化样件比对。",
    occ: 4,
    dc: "积分球光谱分析 + UV 老化后光通复测。",
    dvprLinks: ["UV 500h", "Spectral Shift"],
    det: 4,
    action: "切换耐 UV 树脂等级并增加老化验证。",
    ownerGate: "许工 @ DVT",
    status: "pending",
  },
  {
    id: "lighting-010",
    process: "反光杯与镀层",
    mode: "镀层脱落",
    effect: "配光效率下降，局部暗区与黄圈投诉。",
    classification: "SC",
    crossRisk: "@结构工程师确认热循环应力；@供应链同步表面处理规范。",
    sev: 7,
    cause: "镀层附着力不足或清洗残留。",
    pc: "镀层前处理审核 + 盐雾兼容性验证。",
    occ: 3,
    dc: "附着力测试 + 光斑均匀性复测。",
    dvprLinks: ["Salt Spray", "IES Scan"],
    det: 4,
    action: "升级真空镀工艺并增加前处理清洁度窗口。",
    ownerGate: "邓工 @ PVT",
    status: "closed",
  },
  {
    id: "lighting-011",
    process: "IES 配光验证",
    mode: "UGR 超标",
    effect: "眩光不达标，办公照明项目验收失败。",
    classification: "CC",
    crossRisk: "@应用工程师提供场景要求；@结构工程师联合签审遮光边界。",
    sev: 7,
    cause: "遮光角设计不足，配光曲线偏离目标。",
    pc: "配光曲线（IES）测试门禁 + 遮光角评审。",
    occ: 3,
    dc: "IES 配光曲线测试 + UGR 仿真复核。",
    dvprLinks: ["IES Test", "UGR Calc"],
    det: 3,
    action: "优化遮光结构并调整透镜二次配光。",
    ownerGate: "郑工 @ DVT",
    status: "testing",
  },
  {
    id: "lighting-012",
    process: "积分球光谱分析",
    mode: "显色一致性漂移",
    effect: "批次色容差超标，客户抱怨色差。",
    classification: "SC",
    crossRisk: "@采购确认 LED bin 锁定；@计划工程师避免批次混料。",
    sev: 6,
    cause: "LED bin 管控与混光策略不足。",
    pc: "LED bin 锁定 + 混光配比评审。",
    occ: 4,
    dc: "积分球光谱分析 + 色容差 SPC。",
    dvprLinks: ["Integrating Sphere", "TM-30"],
    det: 3,
    action: "收紧 bin 组合并建立来料色坐标门限。",
    ownerGate: "冯工 @ IPQC",
    status: "closed",
  },
  {
    id: "lighting-013",
    process: "密封与防护",
    mode: "密封圈老化 / 压缩永久变形",
    effect: "进水、起雾，IP等级失效，户外返修。",
    classification: "CC",
    crossRisk: "@材料工程师确认橡胶配方；@热学工程师复核温升对老化加速影响。",
    sev: 6,
    cause: "材料耐候性不足，压缩量设计偏大。",
    pc: "防水透气阀配型 + 密封寿命验证 + 八维工况联审。",
    occ: 4,
    dc: "负压测试 + IP65 Test + 温湿循环验证。",
    dvprLinks: ["IP65 Test", "Negative Pressure"],
    det: 3,
    action: "更换高回弹密封材料并重算压缩量。",
    ownerGate: "钱工 @ DVT",
    status: "pending",
  },
  {
    id: "lighting-014",
    process: "压铸铝与盐雾",
    mode: "盐雾腐蚀",
    effect: "壳体腐蚀穿孔，防护失效，外观投诉。",
    classification: "SC",
    crossRisk: "@供应商质量确认膜厚能力；@认证工程师复核户外等级声明。",
    sev: 8,
    cause: "表面处理耐蚀等级不足。",
    pc: "涂层厚度规范 + 240h 盐雾门禁。",
    occ: 3,
    dc: "盐雾试验 + 截面膜厚测量。",
    dvprLinks: ["Salt Spray 240h", "Coating Thickness"],
    det: 3,
    action: "升级涂层体系并追加切边封闭工艺。",
    ownerGate: "吴工 @ SQE",
    status: "closed",
  },
  {
    id: "lighting-015",
    process: "防水透气阀与压差",
    mode: "呼吸效应吸水",
    effect: "冷热循环后内腔吸水起雾，IP等级失效。",
    classification: "SC",
    crossRisk: "@热学工程师提供内外压差模型；@工艺工程师确认安装方向。",
    sev: 7,
    cause: "透气阀流量选型偏差，压差释放不足。",
    pc: "防水透气阀配型 + 负压测试 + 温湿循环验证。",
    occ: 3,
    dc: "冷热冲击后称重比对 + 腔体湿度记录。",
    dvprLinks: ["Negative Pressure", "Temp Cycle"],
    det: 4,
    action: "上调透气量并优化阀位避水路径。",
    ownerGate: "朱工 @ PVT",
    status: "testing",
  },
  {
    id: "lighting-016",
    process: "结构固定与跌落",
    mode: "安装件松脱 / 跌落",
    effect: "灯体跌落伤人，项目停线与法律风险。",
    classification: "CC",
    crossRisk: "@现场应用工程师提供安装工况；@认证工程师联合签发安规结论。",
    sev: 7,
    cause: "固定点强度不足或扭矩控制失效。",
    pc: "跌落 FEA + 扭矩防错 + 双保险结构审查。",
    occ: 2,
    dc: "整灯跌落测试 + 安装力矩追溯。",
    dvprLinks: ["Drop Test", "Bracket Pull Test"],
    det: 3,
    action: "增加防脱结构并引入扭矩追溯工装。",
    ownerGate: "何工 @ DVT",
    status: "pending",
  },
]

export function calculateRpn(sev: number, occ: number, det: number): number {
  return sev * occ * det
}

export function isCriticalFmeaRisk(sev: number, rpn: number): boolean {
  return sev >= 9 || rpn >= 100
}

export function getFmeaRiskBand(sev: number, rpn: number): FmeaRiskBand {
  if (isCriticalFmeaRisk(sev, rpn)) {
    return "critical"
  }

  if (rpn >= 60) {
    return "warning"
  }

  return "safe"
}

export function clampScore(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 1
  }

  return Math.max(1, Math.min(10, Math.round(numeric)))
}

export function normalizeDvprLinks(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item ?? "").trim())
          .filter((item) => item.length > 0)
      )
    )
  }

  return String(value ?? "")
    .split(/[,\n/|]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function normalizeStatus(value: unknown): FmeaStatus {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (normalized === "testing") return "testing"
  if (normalized === "closed") return "closed"
  return "pending"
}

export function inferSystemIdFromProcess(process: string): string {
  return PROCESS_TO_SYSTEM_ID[process] ?? defaultBomNodeId
}

export function getSeverityLockMeta(effect: string): SeverityLockMeta | null {
  const trimmed = effect.trim()
  if (!trimmed) {
    return null
  }

  const matchedRules = SEVERITY_LOCK_RULES.filter((rule) => rule.pattern.test(trimmed))
  if (matchedRules.length === 0) {
    return null
  }

  const lockedSeverity = matchedRules.reduce<9 | 10>(
    (current, rule) => (rule.severity > current ? rule.severity : current),
    9
  )

  return {
    lockedSeverity,
    matchedRules: matchedRules.map((rule) => rule.label),
    helperText: `S 锚点已锁定为 ${lockedSeverity}：${matchedRules
      .map((rule) => rule.label)
      .join(" + ")}`,
  }
}

export function finalizeFmeaRow(row: FmeaRow): FmeaRow {
  const severityLock = getSeverityLockMeta(row.effect)
  const sev = severityLock ? severityLock.lockedSeverity : clampScore(row.sev)
  const occ = clampScore(row.occ)
  const det = clampScore(row.det)

  return {
    ...row,
    systemId: row.systemId || inferSystemIdFromProcess(row.process),
    classification: row.classification || "STD",
    sev,
    occ,
    det,
    rpn: calculateRpn(sev, occ, det),
    dvprLinks: normalizeDvprLinks(row.dvprLinks),
    status: normalizeStatus(row.status),
  }
}

export function createBlankRow(process: string = ""): FmeaRow {
  return finalizeFmeaRow({
    id: `lighting-${Date.now()}`,
    systemId: inferSystemIdFromProcess(process),
    process,
    mode: "",
    effect: "",
    classification: "SC",
    crossRisk: "",
    sev: 5,
    cause: "",
    pc: "",
    occ: 3,
    dc: "",
    det: 3,
    rpn: 0,
    dvprLinks: [],
    action: "",
    ownerGate: "",
    status: "pending",
  })
}

export function findBomNodeById(
  nodes: FmeaBomNode[],
  targetId: string
): FmeaBomNode | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node
    }

    if (node.children?.length) {
      const nested = findBomNodeById(node.children, targetId)
      if (nested) {
        return nested
      }
    }
  }

  return null
}

export const initialFmeaData: FmeaRow[] = seedRows.map((row) =>
  finalizeFmeaRow({
    ...row,
    systemId: row.systemId || inferSystemIdFromProcess(row.process),
    rpn: 0,
  })
)
