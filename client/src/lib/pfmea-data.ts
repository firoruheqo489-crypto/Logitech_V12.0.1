export type PfmeaStatus = "pending" | "testing" | "closed"
export type PfmeaRiskBand = "critical" | "warning" | "safe"
export type PfmeaVector = "man" | "machine" | "material" | "method" | "environment"
export type PfmeaPokaYoke = "ccd" | "sensor" | "fixture" | "visual" | "program"
export type PfmeaNodeIcon =
  | "root"
  | "logistics"
  | "smt"
  | "assembly"
  | "testing"
  | "packaging"
  | "step"

export interface PfmeaRow {
  id: string
  areaId: string
  opCode: string
  process: string
  requirement: string
  effect: string
  sev: number
  vector: PfmeaVector
  cause: string
  occ: number
  pc: string
  dc: string
  pokaYoke: PfmeaPokaYoke
  det: number
  rpn: number
  action: string
  ownerGate: string
  status: PfmeaStatus
}

export interface PfmeaNode {
  id: string
  label: string
  description: string
  owner: string
  icon: PfmeaNodeIcon
  opCodes?: string[]
  children?: PfmeaNode[]
}

type SeedRow = Omit<PfmeaRow, "rpn" | "areaId">

export const defaultProcessNodeId = "pfmea-root"

export const pfmeaTree: PfmeaNode[] = [
  {
    id: defaultProcessNodeId,
    label: "制造过程 PFMEA 结构",
    description: "按制造流程分区组织过程失效模式、控制计划与责任闭环。",
    owner: "PE / ME / QE 联合评审",
    icon: "root",
    children: [
      {
        id: "process-logistics",
        label: "LOG 厂内物流与仓储",
        description: "聚焦来料接收、湿敏物料烘烤、发料与齐套防错。",
        owner: "IQC / 仓储 / 生产计划",
        icon: "logistics",
        opCodes: ["OP05", "OP10", "OP15", "OP20"],
        children: [
          {
            id: "process-op05",
            label: "OP05 IQC-电子/结构物料接收",
            description: "物料外观、数量与批次接收验证。",
            owner: "IQC",
            icon: "step",
            opCodes: ["OP05"],
          },
          {
            id: "process-op10",
            label: "OP10 IQC-光学透镜与反光杯",
            description: "光学件外观与污染控制。",
            owner: "IQC / 光学",
            icon: "step",
            opCodes: ["OP10"],
          },
          {
            id: "process-op15",
            label: "OP15 MSL湿敏元件烘烤与入库",
            description: "湿敏等级、烘烤条件与时效控制。",
            owner: "仓储 / PMC",
            icon: "step",
            opCodes: ["OP15"],
          },
          {
            id: "process-op20",
            label: "OP20 生产发料与齐套防错",
            description: "发料批次、齐套状态与错料防呆。",
            owner: "仓储 / 线边物料员",
            icon: "step",
            opCodes: ["OP20"],
          },
        ],
      },
      {
        id: "process-smt",
        label: "SMT 贴片车间",
        description: "聚焦锡膏印刷、贴片、回流焊与AOI全检。",
        owner: "SMT PE / 设备 / QE",
        icon: "smt",
        opCodes: ["OP25", "OP30", "OP35", "OP40", "OP45"],
        children: [
          {
            id: "process-op25",
            label: "OP25 锡膏印刷与 SPI 3D检测",
            description: "锡膏厚度、偏移与印刷稳定性。",
            owner: "SMT PE",
            icon: "step",
            opCodes: ["OP25"],
          },
          {
            id: "process-op30",
            label: "OP30 贴片机打件与偏位监控",
            description: "贴装精度、极性与视觉定位。",
            owner: "设备 / SMT PE",
            icon: "step",
            opCodes: ["OP30"],
          },
          {
            id: "process-op35",
            label: "OP35 回流焊接与炉温曲线",
            description: "炉温曲线、焊接窗口与环境稳定性。",
            owner: "SMT PE / QE",
            icon: "step",
            opCodes: ["OP35"],
          },
          {
            id: "process-op40",
            label: "OP40 AOI 炉后光学全检",
            description: "焊点、偏移与虚焊缺陷拦截。",
            owner: "QE / SMT",
            icon: "step",
            opCodes: ["OP40"],
          },
          {
            id: "process-op45",
            label: "OP45 铝基板分板与毛刺去除",
            description: "分板毛刺、板裂与污染风险。",
            owner: "SMT / ME",
            icon: "step",
            opCodes: ["OP45"],
          },
        ],
      },
      {
        id: "process-assembly",
        label: "ASM 光机电装配车间",
        description: "聚焦导热界面、锁附、焊线、装配与防水工艺。",
        owner: "ME / PE / 装配主管",
        icon: "assembly",
        opCodes: ["OP50", "OP55", "OP60", "OP65", "OP70", "OP75", "OP80"],
        children: [
          {
            id: "process-op50",
            label: "OP50 导热硅脂/硅胶垫涂布",
            description: "胶量、覆盖率与导热路径稳定性。",
            owner: "ME / QE",
            icon: "step",
            opCodes: ["OP50"],
          },
          {
            id: "process-op55",
            label: "OP55 光源板锁附/锁附定扭",
            description: "扭力一致性与螺丝到底验证。",
            owner: "PE / 工装",
            icon: "step",
            opCodes: ["OP55"],
          },
          {
            id: "process-op60",
            label: "OP60 手工焊线与端子压接",
            description: "压接高度、压力与焊线规范。",
            owner: "ME / 线长",
            icon: "step",
            opCodes: ["OP60"],
          },
          {
            id: "process-op65",
            label: "OP65 驱动电源组装与走线避让",
            description: "走线干涉、连接稳定性与空间避让。",
            owner: "ME / 结构",
            icon: "step",
            opCodes: ["OP65"],
          },
          {
            id: "process-op70",
            label: "OP70 透镜/导光板装配与防尘",
            description: "定位、防尘、无划伤与无异物。",
            owner: "装配 / QE",
            icon: "step",
            opCodes: ["OP70"],
          },
          {
            id: "process-op75",
            label: "OP75 防水胶灌封/打胶",
            description: "胶路连续性、胶量与密封性。",
            owner: "PE / 结构",
            icon: "step",
            opCodes: ["OP75"],
          },
          {
            id: "process-op80",
            label: "OP80 面盖合模与整机打螺丝",
            description: "装配干涉、缝隙与扭力失控。",
            owner: "装配 / PE",
            icon: "step",
            opCodes: ["OP80"],
          },
        ],
      },
      {
        id: "process-testing",
        label: "TEST 安规与老化车间",
        description: "聚焦点亮、耐压、接地与老化测试。",
        owner: "TE / QE / 认证",
        icon: "testing",
        opCodes: ["OP85", "OP90", "OP95", "OP100", "OP105"],
        children: [
          {
            id: "process-op85",
            label: "OP85 组装后初测点亮",
            description: "点亮功能与一次性通过率。",
            owner: "TE",
            icon: "step",
            opCodes: ["OP85"],
          },
          {
            id: "process-op90",
            label: "OP90 耐压测试/绝缘击穿",
            description: "覆盖率、程序完整性与安全拦截。",
            owner: "TE / 认证",
            icon: "step",
            opCodes: ["OP90"],
          },
          {
            id: "process-op95",
            label: "OP95 接地电阻测试",
            description: "接地连续性与测试可靠性。",
            owner: "TE",
            icon: "step",
            opCodes: ["OP95"],
          },
          {
            id: "process-op100",
            label: "OP100 满载/高温老化测试",
            description: "温控稳定性与早期失效筛出。",
            owner: "TE / QE",
            icon: "step",
            opCodes: ["OP100"],
          },
          {
            id: "process-op105",
            label: "OP105 调光与综合电参数测试",
            description: "电参数稳定性与调光边界。",
            owner: "TE / 电子",
            icon: "step",
            opCodes: ["OP105"],
          },
        ],
      },
      {
        id: "process-packaging",
        label: "PKG 包装与出货车间",
        description: "聚焦外观终检、齐套、防错与出货一致性。",
        owner: "OQC / 仓储 / PE",
        icon: "packaging",
        opCodes: ["OP110", "OP115", "OP120", "OP125", "OP130"],
        children: [
          {
            id: "process-op110",
            label: "OP110 FQC 外观与残胶全检",
            description: "外观、清洁与表面缺陷控制。",
            owner: "FQC",
            icon: "step",
            opCodes: ["OP110"],
          },
          {
            id: "process-op115",
            label: "OP115 镭雕/铭牌打印与比对",
            description: "标签、铭牌与追溯编码正确性。",
            owner: "FQC / OQC",
            icon: "step",
            opCodes: ["OP115"],
          },
          {
            id: "process-op120",
            label: "OP120 附件/说明书齐套验证",
            description: "齐套率、防漏装与版本一致性。",
            owner: "包装线 / OQC",
            icon: "step",
            opCodes: ["OP120"],
          },
          {
            id: "process-op125",
            label: "OP125 装箱防呆与封箱重量",
            description: "数量正确、重量防错与附件完整。",
            owner: "包装线 / PE",
            icon: "step",
            opCodes: ["OP125"],
          },
          {
            id: "process-op130",
            label: "OP130 栈板打托与 OQC 抽检",
            description: "出货批次、抽检一致性与混料风险。",
            owner: "OQC / 仓储",
            icon: "step",
            opCodes: ["OP130"],
          },
        ],
      },
    ],
  },
]

export const processNodeMapping: Record<string, string[]> = {
  [defaultProcessNodeId]: [],
  "process-logistics": ["OP05", "OP10", "OP15", "OP20"],
  "process-op05": ["OP05"],
  "process-op10": ["OP10"],
  "process-op15": ["OP15"],
  "process-op20": ["OP20"],
  "process-smt": ["OP25", "OP30", "OP35", "OP40", "OP45"],
  "process-op25": ["OP25"],
  "process-op30": ["OP30"],
  "process-op35": ["OP35"],
  "process-op40": ["OP40"],
  "process-op45": ["OP45"],
  "process-assembly": ["OP50", "OP55", "OP60", "OP65", "OP70", "OP75", "OP80"],
  "process-op50": ["OP50"],
  "process-op55": ["OP55"],
  "process-op60": ["OP60"],
  "process-op65": ["OP65"],
  "process-op70": ["OP70"],
  "process-op75": ["OP75"],
  "process-op80": ["OP80"],
  "process-testing": ["OP85", "OP90", "OP95", "OP100", "OP105"],
  "process-op85": ["OP85"],
  "process-op90": ["OP90"],
  "process-op95": ["OP95"],
  "process-op100": ["OP100"],
  "process-op105": ["OP105"],
  "process-packaging": ["OP110", "OP115", "OP120", "OP125", "OP130"],
  "process-op110": ["OP110"],
  "process-op115": ["OP115"],
  "process-op120": ["OP120"],
  "process-op125": ["OP125"],
  "process-op130": ["OP130"],
}

const AREA_NODE_IDS = [
  "process-logistics",
  "process-smt",
  "process-assembly",
  "process-testing",
  "process-packaging",
] as const

const OP_CODE_TO_AREA_ID = Object.entries(processNodeMapping).reduce<Record<string, string>>(
  (accumulator, [nodeId, opCodes]) => {
    if (!AREA_NODE_IDS.includes(nodeId as (typeof AREA_NODE_IDS)[number])) {
      return accumulator
    }

    for (const code of opCodes) {
      accumulator[code] = nodeId
    }

    return accumulator
  },
  {}
)

const seedRows: SeedRow[] = [
  {
    id: "pfmea-001",
    opCode: "OP25",
    process: "OP25 锡膏印刷",
    requirement: "锡膏厚度 150±20μm，位置偏移≤0.1mm",
    effect: "焊接不良、虚焊，可能导致产品功能失效或客户退货",
    sev: 7,
    vector: "machine",
    cause: "钢网张力不足导致印刷偏移，长期使用后网孔变形累积",
    occ: 4,
    pc: "钢网张力每周校验，新钢网入库检验",
    dc: "首件检验+SPC监控+3D锡膏检测仪",
    pokaYoke: "ccd",
    det: 5,
    action: "增加钢网张力定期校验频次，建立钢网寿命管理系统",
    ownerGate: "张工 @ PE",
    status: "pending",
  },
  {
    id: "pfmea-002",
    opCode: "OP25",
    process: "OP25 锡膏印刷",
    requirement: "锡膏位置偏移≤0.1mm",
    effect: "元器件贴装偏移，短路风险增加",
    sev: 6,
    vector: "man",
    cause: "操作员未按SOP进行Mark点校准，培训不足或疲劳作业",
    occ: 3,
    pc: "操作员资质认证，作业前checklist确认",
    dc: "AOI在线检测，自动报警停线",
    pokaYoke: "ccd",
    det: 3,
    action: "强化操作培训，增加防错提示，建立操作员技能矩阵",
    ownerGate: "李工 @ ME",
    status: "pending",
  },
  {
    id: "pfmea-003",
    opCode: "OP50",
    process: "OP50 导热硅脂涂布",
    requirement: "胶量控制±5%，胶点直径 3±0.3mm",
    effect: "散热不良导致产品过热，寿命缩短，严重时可能起火",
    sev: 8,
    vector: "material",
    cause: "导热硅脂黏度因过期或存储不当发生变化，流动性异常",
    occ: 3,
    pc: "材料先进先出管理，入库有效期标识",
    dc: "重量称量抽检，粘度定期测试",
    pokaYoke: "sensor",
    det: 6,
    action: "建立材料先进先出管理系统，增加粘度在线监测",
    ownerGate: "王工 @ QE",
    status: "pending",
  },
  {
    id: "pfmea-004",
    opCode: "OP30",
    process: "OP30 贴片机打件",
    requirement: "贴装精度≤0.05mm，极性正确",
    effect: "短路或开路，产品功能完全失效",
    sev: 8,
    vector: "machine",
    cause: "CCD定位算法漂移，镜头污染或光源衰减",
    occ: 2,
    pc: "设备PM计划，镜头每日清洁",
    dc: "AOI全检，X-Ray抽检",
    pokaYoke: "ccd",
    det: 2,
    action: "升级视觉系统算法，建立光源寿命预警",
    ownerGate: "陈工 @ EE",
    status: "closed",
  },
  {
    id: "pfmea-005",
    opCode: "OP55",
    process: "OP55 光源板锁附",
    requirement: "扭力 0.8±0.1 N·m，螺丝到底检测",
    effect: "产品松动，安全隐患，可能导致客户投诉召回",
    sev: 9,
    vector: "machine",
    cause: "电动螺丝刀扭力校准漂移，长期使用磨损",
    occ: 3,
    pc: "扭力工具每月校准，使用寿命管理",
    dc: "扭力仪100%在线检测，数据记录追溯",
    pokaYoke: "sensor",
    det: 5,
    action: "建立扭力校准周期管理，引入智能电批实时监控",
    ownerGate: "张工 @ PE",
    status: "testing",
  },
  {
    id: "pfmea-006",
    opCode: "OP60",
    process: "OP60 手工焊线",
    requirement: "压接高度 3.5±0.2mm，压力15±2N",
    effect: "接触不良导致信号传输异常，功能间歇性故障",
    sev: 7,
    vector: "method",
    cause: "作业指导书未明确定压接参数设定方法，不同班组理解不一致",
    occ: 4,
    pc: "SOP标准化，参数设定培训考核",
    dc: "高度检测仪全检，压力曲线监控",
    pokaYoke: "fixture",
    det: 3,
    action: "更新SOP增加图示说明，统一参数设定流程",
    ownerGate: "刘工 @ ME",
    status: "pending",
  },
  {
    id: "pfmea-007",
    opCode: "OP35",
    process: "OP35 回流焊接",
    requirement: "焊接温度260±10℃，焊接时间2±0.5s",
    effect: "冷焊导致导通不良，产品功能失效",
    sev: 8,
    vector: "environment",
    cause: "车间温湿度波动影响焊接质量，空调系统不稳定",
    occ: 2,
    pc: "车间温湿度24小时监控，异常自动报警",
    dc: "温度曲线实时监控，焊点外观检查",
    pokaYoke: "visual",
    det: 4,
    action: "安装恒温恒湿系统，建立环境参数与良率关联分析",
    ownerGate: "周工 @ QE",
    status: "testing",
  },
  {
    id: "pfmea-008",
    opCode: "OP90",
    process: "OP90 耐压测试",
    requirement: "测试覆盖率≥95%，测试时间≤30s",
    effect: "不良品流出到下工序或客户端，造成批量质量事故",
    sev: 9,
    vector: "method",
    cause: "测试程序未覆盖新增测试点，ECN变更管理流程漏同步",
    occ: 2,
    pc: "测试程序变更管理流程，ECN联动更新",
    dc: "测试覆盖率审核，功能测试一次把关",
    pokaYoke: "program",
    det: 4,
    action: "建立测试程序变更管理流程，增加覆盖率自动校验",
    ownerGate: "吴工 @ TE",
    status: "pending",
  },
  {
    id: "pfmea-009",
    opCode: "OP70",
    process: "OP70 透镜装配",
    requirement: "透镜定位精度±0.2mm，无划伤、无灰尘",
    effect: "光学性能下降，配光不均匀，客户投诉",
    sev: 6,
    vector: "man",
    cause: "员工手部接触透镜表面，防护手套佩戴不规范",
    occ: 5,
    pc: "无尘手套强制佩戴，手部清洁规范",
    dc: "目检全检，灯检抽样",
    pokaYoke: "visual",
    det: 4,
    action: "引入自动化透镜装配机构，减少人工接触",
    ownerGate: "赵工 @ ME",
    status: "pending",
  },
  {
    id: "pfmea-010",
    opCode: "OP100",
    process: "OP100 老化测试",
    requirement: "老化时间4h，温度 60±5℃，功率波动≤5%",
    effect: "早期失效未筛出，客户端批量故障",
    sev: 9,
    vector: "machine",
    cause: "老化房温控系统故障，局部温度超标",
    occ: 2,
    pc: "温控系统双重冗余，定期校验",
    dc: "多点温度实时监控，超温自动停机",
    pokaYoke: "sensor",
    det: 3,
    action: "升级老化房温控系统，增加温度场均匀性检测",
    ownerGate: "孙工 @ TE",
    status: "closed",
  },
  {
    id: "pfmea-011",
    opCode: "OP125",
    process: "OP125 装箱防呆",
    requirement: "产品数量正确，附件齐全，箱重误差≤±50g",
    effect: "客户收货数量短缺或附件缺失，造成投诉",
    sev: 5,
    vector: "man",
    cause: "操作员疲劳或分心导致漏装，未严格执行checklist",
    occ: 4,
    pc: "装箱checklist强制执行，每箱扫码确认",
    dc: "称重防呆100%在线检测，异常自动报警",
    pokaYoke: "sensor",
    det: 2,
    action: "升级称重防呆系统，增加视觉辅助提示",
    ownerGate: "钱工 @ PE",
    status: "pending",
  },
  {
    id: "pfmea-012",
    opCode: "OP130",
    process: "OP130 OQC 抽检",
    requirement: "抽检AQL达标，栈板标签与出货单一致",
    effect: "异常批次流入客户仓，触发退货与索赔",
    sev: 7,
    vector: "environment",
    cause: "出货区混料，标签打印批次与实物未二次核对",
    occ: 2,
    pc: "出货分区上锁管理，标签打印后双人核对",
    dc: "OQC抽检记录复核，扫码追溯校验",
    pokaYoke: "program",
    det: 3,
    action: "增加出货区电子围栏与批次锁定机制",
    ownerGate: "何工 @ OQC",
    status: "testing",
  },
]

export const pfmeaVectorMeta: Record<PfmeaVector, { label: string; shortLabel: string }> = {
  man: { label: "人 (Man)", shortLabel: "人" },
  machine: { label: "机 (Machine)", shortLabel: "机" },
  material: { label: "料 (Material)", shortLabel: "料" },
  method: { label: "法 (Method)", shortLabel: "法" },
  environment: { label: "环 (Environment)", shortLabel: "环" },
}

export const pfmeaPokaYokeMeta: Record<PfmeaPokaYoke, { label: string }> = {
  ccd: { label: "CCD" },
  sensor: { label: "传感器" },
  fixture: { label: "治具限位" },
  visual: { label: "人工目检" },
  program: { label: "程序校验" },
}

export function calculatePfmeaRpn(sev: number, occ: number, det: number): number {
  return sev * occ * det
}

export function clampPfmeaScore(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 1
  }

  return Math.max(1, Math.min(10, Math.round(numeric)))
}

export function normalizePfmeaStatus(value: unknown): PfmeaStatus {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (normalized === "closed") return "closed"
  if (normalized === "testing" || normalized === "in-progress") return "testing"
  return "pending"
}

export function inferAreaIdFromOpCode(opCode: string): string {
  return OP_CODE_TO_AREA_ID[opCode] ?? defaultProcessNodeId
}

export function finalizePfmeaRow(row: PfmeaRow): PfmeaRow {
  const sev = clampPfmeaScore(row.sev)
  const occ = clampPfmeaScore(row.occ)
  const det = clampPfmeaScore(row.det)

  return {
    ...row,
    areaId: row.areaId || inferAreaIdFromOpCode(row.opCode),
    sev,
    occ,
    det,
    rpn: calculatePfmeaRpn(sev, occ, det),
    status: normalizePfmeaStatus(row.status),
  }
}

export function isCriticalPfmeaRisk(sev: number, rpn: number): boolean {
  return sev >= 9 || rpn >= 100
}

export function getPfmeaRiskBand(sev: number, rpn: number): PfmeaRiskBand {
  if (isCriticalPfmeaRisk(sev, rpn)) {
    return "critical"
  }

  if (rpn >= 60) {
    return "warning"
  }

  return "safe"
}

export function createBlankPfmeaRow(opCode = ""): PfmeaRow {
  return finalizePfmeaRow({
    id: `pfmea-${Date.now()}`,
    areaId: inferAreaIdFromOpCode(opCode),
    opCode,
    process: opCode ? `${opCode} 新工序` : "",
    requirement: "",
    effect: "",
    sev: 5,
    vector: "method",
    cause: "",
    occ: 3,
    pc: "",
    dc: "",
    pokaYoke: "visual",
    det: 3,
    rpn: 0,
    action: "",
    ownerGate: "",
    status: "pending",
  })
}

export function findPfmeaNodeById(nodes: PfmeaNode[], targetId: string): PfmeaNode | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node
    }

    if (node.children?.length) {
      const nested = findPfmeaNodeById(node.children, targetId)
      if (nested) {
        return nested
      }
    }
  }

  return null
}

export const initialPfmeaData: PfmeaRow[] = seedRows.map((row) =>
  finalizePfmeaRow({
    ...row,
    areaId: inferAreaIdFromOpCode(row.opCode),
    rpn: 0,
  })
)
