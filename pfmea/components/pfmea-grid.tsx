"use client"

import { useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Settings2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  Plus,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

// 4M1E 类型定义
type Vector4M1E = "人" | "机" | "料" | "法" | "环"

interface Vector4M1EConfig {
  label: string
  labelEn: string
  className: string
}

const VECTOR_4M1E_CONFIG: Record<Vector4M1E, Vector4M1EConfig> = {
  人: {
    label: "人",
    labelEn: "Man",
    className: "bg-amber-900/30 text-amber-400 border border-amber-700/50",
  },
  机: {
    label: "机",
    labelEn: "Machine",
    className: "bg-blue-900/30 text-blue-400 border border-blue-700/50",
  },
  料: {
    label: "料",
    labelEn: "Material",
    className: "bg-purple-900/30 text-purple-400 border border-purple-700/50",
  },
  法: {
    label: "法",
    labelEn: "Method",
    className: "bg-cyan-900/30 text-cyan-400 border border-cyan-700/50",
  },
  环: {
    label: "环",
    labelEn: "Environment",
    className: "bg-emerald-900/30 text-emerald-400 border border-emerald-700/50",
  },
}

// 防呆类型定义
type PokaYokeType = "CCD" | "治具限位" | "人工目检" | "传感器" | "程序校验"

interface PokaYokeConfig {
  label: string
  className: string
}

const POKA_YOKE_CONFIG: Record<PokaYokeType, PokaYokeConfig> = {
  CCD: {
    label: "CCD",
    className: "bg-violet-900/30 text-violet-400 border border-violet-700/50",
  },
  治具限位: {
    label: "治具限位",
    className: "bg-orange-900/30 text-orange-400 border border-orange-700/50",
  },
  人工目检: {
    label: "人工目检",
    className: "bg-slate-700/50 text-slate-300 border border-slate-600/50",
  },
  传感器: {
    label: "传感器",
    className: "bg-teal-900/30 text-teal-400 border border-teal-700/50",
  },
  程序校验: {
    label: "程序校验",
    className: "bg-indigo-900/30 text-indigo-400 border border-indigo-700/50",
  },
}

// PFMEA 数据结构 - 完整15列 (含责任人)
interface PFMEARecord {
  id: string
  opCode: string // 关联左侧工序流程树的 code
  opStep: string
  requirement: string
  failureEffect: string
  severity: number
  vector4M1E: Vector4M1E
  rootCause: string
  occurrence: number
  preventionControl: string
  detectionControl: string
  pokaYoke: PokaYokeType
  detection: number
  recommendedAction: string
  owner: string // 责任人
  status: "open" | "in-progress" | "closed"
}

// 工序流程树节点
interface ProcessNode {
  id: string
  name: string
  code: string
  children?: ProcessNode[]
  recordCount: number
}

// 模拟数据 - 工序流程树 (28节点完整照明产品制造流程)
const PROCESS_TREE: ProcessNode[] = [
  {
    id: "section-1",
    name: "厂内物流与仓储",
    code: "LOG",
    recordCount: 12,
    children: [
      { id: "op05", name: "IQC-电子/结构物料接收", code: "OP05", recordCount: 3 },
      { id: "op10", name: "IQC-光学透镜与反光杯", code: "OP10", recordCount: 2 },
      { id: "op15", name: "MSL湿敏元件烘烤与入库", code: "OP15", recordCount: 4 },
      { id: "op20", name: "生产发料与齐套防错", code: "OP20", recordCount: 3 },
    ],
  },
  {
    id: "section-2",
    name: "SMT 贴片车间",
    code: "SMT",
    recordCount: 18,
    children: [
      { id: "op25", name: "锡膏印刷与 SPI 3D检测", code: "OP25", recordCount: 4 },
      { id: "op30", name: "贴片机打件与偏位监控", code: "OP30", recordCount: 5 },
      { id: "op35", name: "回流焊接与炉温曲线", code: "OP35", recordCount: 3 },
      { id: "op40", name: "AOI 炉后光学全检", code: "OP40", recordCount: 4 },
      { id: "op45", name: "铝基板分板与毛刺去除", code: "OP45", recordCount: 2 },
    ],
  },
  {
    id: "section-3",
    name: "光机电装配车间",
    code: "ASM",
    recordCount: 28,
    children: [
      { id: "op50", name: "导热硅脂/硅胶垫涂布", code: "OP50", recordCount: 4 },
      { id: "op55", name: "光源板铆接/锁附定扭", code: "OP55", recordCount: 5 },
      { id: "op60", name: "手工焊线与端子压接", code: "OP60", recordCount: 6 },
      { id: "op65", name: "驱动电源组装与走线避让", code: "OP65", recordCount: 4 },
      { id: "op70", name: "透镜/导光板装配与防尘", code: "OP70", recordCount: 3 },
      { id: "op75", name: "防水胶灌封/打胶", code: "OP75", recordCount: 3 },
      { id: "op80", name: "面盖合模与整机打螺丝", code: "OP80", recordCount: 3 },
    ],
  },
  {
    id: "section-4",
    name: "安规与老化车间",
    code: "TEST",
    recordCount: 16,
    children: [
      { id: "op85", name: "组装后初测点亮", code: "OP85", recordCount: 3 },
      { id: "op90", name: "耐压测试/绝缘击穿", code: "OP90", recordCount: 4 },
      { id: "op95", name: "接地电阻测试", code: "OP95", recordCount: 2 },
      { id: "op100", name: "满载/高温老化测试", code: "OP100", recordCount: 4 },
      { id: "op105", name: "调光与综合电参数测试", code: "OP105", recordCount: 3 },
    ],
  },
  {
    id: "section-5",
    name: "包装与出货车间",
    code: "PKG",
    recordCount: 14,
    children: [
      { id: "op110", name: "FQC 外观与残胶全检", code: "OP110", recordCount: 3 },
      { id: "op115", name: "镭雕/铭牌打印与比对", code: "OP115", recordCount: 2 },
      { id: "op120", name: "附件/说明书齐套验证", code: "OP120", recordCount: 3 },
      { id: "op125", name: "装箱防呆与封箱重量", code: "OP125", recordCount: 3 },
      { id: "op130", name: "栈板打托与 OQC 抽检", code: "OP130", recordCount: 3 },
    ],
  },
]

// 模拟数据 - PFMEA记录 (完整15列，含opCode关联与责任人)
const PFMEA_DATA: PFMEARecord[] = [
  {
    id: "pfmea-001",
    opCode: "OP25",
    opStep: "OP25 锡膏印刷",
    requirement: "锡膏厚度 150±20μm，位置偏移≤0.1mm",
    failureEffect: "焊接不良，虚焊，可能导致产品功能失效或客户退货",
    severity: 7,
    vector4M1E: "机",
    rootCause: "钢网张力不足导致印刷偏移，长期使用后网孔变形累积",
    occurrence: 4,
    preventionControl: "钢网张力每周校验，新钢网入库检验",
    detectionControl: "首件检验+SPC监控+3D锡膏检测仪",
    pokaYoke: "CCD",
    detection: 5,
    recommendedAction: "增加钢网张力定期校验频次，建立钢网寿命管理系统",
    owner: "张工 @ PE",
    status: "in-progress",
  },
  {
    id: "pfmea-002",
    opCode: "OP25",
    opStep: "OP25 锡膏印刷",
    requirement: "锡膏位置偏移≤0.1mm",
    failureEffect: "元器件贴装偏移，短路风险增加",
    severity: 6,
    vector4M1E: "人",
    rootCause: "操作员未按SOP进行Mark点校准，培训不足或疲劳作业",
    occurrence: 3,
    preventionControl: "操作员资质认证，作业前checklist确认",
    detectionControl: "AOI在线检测，自动报警停线",
    pokaYoke: "CCD",
    detection: 3,
    recommendedAction: "强化操作培训，增加防错提示，建立操作员技能矩阵",
    owner: "李工 @ ME",
    status: "open",
  },
  {
    id: "pfmea-003",
    opCode: "OP50",
    opStep: "OP50 导热硅脂涂布",
    requirement: "胶量控制±5%，胶点直径3±0.3mm",
    failureEffect: "散热不良导致产品过热，寿命缩短，严重时可能起火",
    severity: 8,
    vector4M1E: "料",
    rootCause: "导热硅脂粘度因过期或存储不当发生变化，流动性异常",
    occurrence: 3,
    preventionControl: "材料先进先出管理，入库有效期标识",
    detectionControl: "重量称量抽检，粘度定期测试",
    pokaYoke: "传感器",
    detection: 6,
    recommendedAction: "建立材料先进先出管理系统，增加粘度在线监测",
    owner: "王工 @ QE",
    status: "open",
  },
  {
    id: "pfmea-004",
    opCode: "OP30",
    opStep: "OP30 贴片机打件",
    requirement: "贴装精度≤0.05mm，极性正确",
    failureEffect: "短路或开路，产品功能完全失效",
    severity: 8,
    vector4M1E: "机",
    rootCause: "CCD定位算法漂移，镜头污染或光源衰减",
    occurrence: 2,
    preventionControl: "设备PM计划，镜头每日清洁",
    detectionControl: "AOI全检，X-Ray抽检",
    pokaYoke: "CCD",
    detection: 2,
    recommendedAction: "升级视觉系统算法，建立光源寿命预警",
    owner: "陈工 @ EE",
    status: "closed",
  },
  {
    id: "pfmea-005",
    opCode: "OP55",
    opStep: "OP55 光源板锁附",
    requirement: "扭力 0.8±0.1 N·m，螺丝到底检测",
    failureEffect: "产品松动，安全隐患，可能导致客户投诉或召回",
    severity: 9,
    vector4M1E: "机",
    rootCause: "电动螺丝刀扭力校准漂移，长期使用磨损",
    occurrence: 3,
    preventionControl: "扭力工具每月校准，使用寿命管理",
    detectionControl: "扭力仪100%在线检测，数据记录追溯",
    pokaYoke: "传感器",
    detection: 5,
    recommendedAction: "建立扭力校准周期管理，引入智能电批实时监控",
    owner: "张工 @ PE",
    status: "in-progress",
  },
  {
    id: "pfmea-006",
    opCode: "OP60",
    opStep: "OP60 手工焊线",
    requirement: "压接高度3.5±0.2mm，压力15±2N",
    failureEffect: "接触不良导致信号传输异常，功能间歇性故障",
    severity: 7,
    vector4M1E: "法",
    rootCause: "作业指导书未明确压接参数设定方法，不同班组理解不一致",
    occurrence: 4,
    preventionControl: "SOP标准化，参数设定培训考核",
    detectionControl: "高度检测仪全检，压力曲线监控",
    pokaYoke: "治具限位",
    detection: 3,
    recommendedAction: "更新SOP增加图示说明，统一参数设定流程",
    owner: "刘工 @ ME",
    status: "open",
  },
  {
    id: "pfmea-007",
    opCode: "OP35",
    opStep: "OP35 回流焊接",
    requirement: "焊接温度260±10°C，焊接时间2±0.5s",
    failureEffect: "冷焊导致导通不良，产品功能失效",
    severity: 8,
    vector4M1E: "环",
    rootCause: "车间温湿度波动影响焊接质量，空调系统不稳定",
    occurrence: 2,
    preventionControl: "车间温湿度24小时监控，异常自动报警",
    detectionControl: "温度曲线实时监控，焊点外观检查",
    pokaYoke: "人工目检",
    detection: 4,
    recommendedAction: "安装恒温恒湿系统，建立环境参数与良率关联分析",
    owner: "周工 @ QE",
    status: "in-progress",
  },
  {
    id: "pfmea-008",
    opCode: "OP90",
    opStep: "OP90 耐压测试",
    requirement: "测试覆盖率≥95%，测试时间≤30s",
    failureEffect: "不良品流出到下工序或客户端，造成批量质量事故",
    severity: 9,
    vector4M1E: "法",
    rootCause: "测试程序未覆盖新增测试点，ECN变更管理流程漏洞",
    occurrence: 2,
    preventionControl: "测试程序变更管理流程，ECN联动更新",
    detectionControl: "测试覆盖率审核，功能测试二次把关",
    pokaYoke: "程序校验",
    detection: 4,
    recommendedAction: "建立测试程序变更管理流程，增加覆盖率自动校验",
    owner: "吴工 @ TE",
    status: "open",
  },
  {
    id: "pfmea-009",
    opCode: "OP70",
    opStep: "OP70 透镜装配",
    requirement: "透镜定位精度±0.2mm，无划伤、无灰尘",
    failureEffect: "光学性能下降，配光不均匀，客户投诉",
    severity: 6,
    vector4M1E: "人",
    rootCause: "员工手部接触透镜表面，防护手套佩戴不规范",
    occurrence: 5,
    preventionControl: "无尘手套强制佩戴，手部清洁规范",
    detectionControl: "目检全检，灯检抽样",
    pokaYoke: "人工目检",
    detection: 4,
    recommendedAction: "引入自动化透镜装配机构，减少人工接触",
    owner: "赵工 @ ME",
    status: "open",
  },
  {
    id: "pfmea-010",
    opCode: "OP100",
    opStep: "OP100 老化测试",
    requirement: "老化时间4h，温度60±5°C，功率波动≤5%",
    failureEffect: "早期失效未筛出，客户端批量故障",
    severity: 9,
    vector4M1E: "机",
    rootCause: "老化房温控系统故障，局部温度超标",
    occurrence: 2,
    preventionControl: "温控系统双重冗余，定期校验",
    detectionControl: "多点温度实时监控，超温自动停机",
    pokaYoke: "传感器",
    detection: 3,
    recommendedAction: "升级老化房温控系统，增加温度场均匀性检测",
    owner: "孙工 @ TE",
    status: "closed",
  },
  {
    id: "pfmea-011",
    opCode: "OP125",
    opStep: "OP125 装箱防呆",
    requirement: "产品数量正确，附件齐全，箱重误差≤±50g",
    failureEffect: "客户收货数量短缺或附件缺失，造成投诉",
    severity: 5,
    vector4M1E: "人",
    rootCause: "操作员疲劳或分心导致漏装，未严格执行checklist",
    occurrence: 4,
    preventionControl: "装箱checklist强制执行，每箱扫码确认",
    detectionControl: "称重防呆100%在线检测，异常自动报警",
    pokaYoke: "传感器",
    detection: 2,
    recommendedAction: "升级称重防呆系统，增加视觉辅助提示",
    owner: "钱工 @ PE",
    status: "open",
  },
  {
    id: "pfmea-012",
    opCode: "OP110",
    opStep: "OP110 FQC外观全检",
    requirement: "无划伤、无残胶、无色差，外观一致性100%",
    failureEffect: "外观不良品流出，影响品牌形象，客户投诉",
    severity: 5,
    vector4M1E: "人",
    rootCause: "检验员视觉疲劳，光线条件不一致导致漏检",
    occurrence: 4,
    preventionControl: "检验员轮岗制度，标准光源箱使用",
    detectionControl: "双人互检，抽样复核",
    pokaYoke: "人工目检",
    detection: 5,
    recommendedAction: "引入AOI视觉检测系统辅助人工检验",
    owner: "郑工 @ QE",
    status: "open",
  },
]

// 4M1E 徽章组件
function Vector4M1EBadge({ vector }: { vector: Vector4M1E }) {
  const config = VECTOR_4M1E_CONFIG[vector]
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium",
        config.className
      )}
    >
      {config.label} ({config.labelEn})
    </span>
  )
}

// 防呆徽章组件
function PokaYokeBadge({ type }: { type: PokaYokeType }) {
  const config = POKA_YOKE_CONFIG[type]
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  )
}

// RPN 等级指示器 (自动计算 S*O*D)
function RPNIndicator({ severity, occurrence, detection }: { severity: number; occurrence: number; detection: number }) {
  const rpn = severity * occurrence * detection
  let bgClassName = "bg-emerald-900/20 border-emerald-700/30"
  let textClassName = "text-emerald-400"
  let label = "低"
  if (rpn >= 100) {
    bgClassName = "bg-red-900/30 border-red-700/50"
    textClassName = "text-red-400"
    label = "高"
  } else if (rpn >= 50) {
    bgClassName = "bg-amber-900/20 border-amber-700/30"
    textClassName = "text-amber-400"
    label = "中"
  }
  return (
    <div className={cn("flex flex-col items-center gap-0.5 px-2 py-1 rounded border", bgClassName)}>
      <span className={cn("font-mono font-bold text-sm", textClassName)}>
        {rpn}
      </span>
      <span className={cn("text-[10px]", textClassName)}>({label})</span>
    </div>
  )
}

// 状态徽章
function StatusBadge({ status }: { status: PFMEARecord["status"] }) {
  const config = {
    open: {
      icon: XCircle,
      label: "待处理",
      className: "bg-red-900/30 text-red-400 border-red-700/50",
    },
    "in-progress": {
      icon: AlertTriangle,
      label: "进行中",
      className: "bg-amber-900/30 text-amber-400 border-amber-700/50",
    },
    closed: {
      icon: CheckCircle2,
      label: "已关闭",
      className: "bg-emerald-900/30 text-emerald-400 border-emerald-700/50",
    },
  }
  const { icon: Icon, label, className } = config[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// 工序流程树节点组件 - 增强视觉层次
function ProcessTreeNode({
  node,
  level = 0,
  selectedId,
  onSelect,
}: {
  node: ProcessNode
  level?: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = node.id === selectedId || node.code === selectedId
  const isZoneHeader = level === 0 && hasChildren

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-2 rounded cursor-pointer transition-colors group",
          isZoneHeader
            ? "py-2.5 mt-3 first:mt-0"
            : "py-1.5",
          isSelected
            ? "bg-primary/20 text-primary"
            : isZoneHeader
              ? "hover:bg-secondary/50 text-foreground"
              : "hover:bg-secondary text-muted-foreground hover:text-foreground"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (hasChildren) {
            setExpanded(!expanded)
          }
          onSelect(node.id)
        }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className={cn("shrink-0", isZoneHeader ? "h-4 w-4" : "h-3.5 w-3.5")} />
          ) : (
            <ChevronRight className={cn("shrink-0", isZoneHeader ? "h-4 w-4" : "h-3.5 w-3.5")} />
          )
        ) : (
          <div className="w-3.5" />
        )}
        <span className={cn(
          "font-mono",
          isZoneHeader 
            ? "text-xs font-semibold text-primary/80" 
            : "text-[11px] text-muted-foreground"
        )}>
          {node.code}
        </span>
        <span className={cn(
          "truncate flex-1",
          isZoneHeader 
            ? "text-sm font-medium" 
            : "text-xs"
        )}>
          {node.name}
        </span>
        <Badge 
          variant="secondary" 
          className={cn(
            "px-1.5 py-0",
            isZoneHeader 
              ? "text-[10px] bg-primary/10 text-primary border border-primary/20" 
              : "text-[10px]"
          )}
        >
          {node.recordCount}
        </Badge>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <ProcessTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 主组件
export default function PFMEAGrid() {
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<PFMEARecord | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"view" | "edit">("view")

  // 过滤逻辑：根据左侧工序流程树选中的节点过滤表格数据
  const filteredData = selectedProcess
    ? PFMEA_DATA.filter((d) => d.opCode === selectedProcess.toUpperCase())
    : PFMEA_DATA

  // 处理工序选择（支持区域头部选择所有子节点）
  const handleProcessSelect = (nodeId: string) => {
    // 查找是否是区域头部
    const section = PROCESS_TREE.find((s) => s.id === nodeId)
    if (section && section.children) {
      // 如果已选中，取消选择显示全部
      if (selectedProcess === nodeId) {
        setSelectedProcess(null)
      } else {
        setSelectedProcess(nodeId)
      }
    } else {
      // OP 节点直接使用其 code
      const opNode = PROCESS_TREE.flatMap((s) => s.children || []).find(
        (n) => n.id === nodeId
      )
      if (opNode) {
        if (selectedProcess === opNode.code) {
          setSelectedProcess(null)
        } else {
          setSelectedProcess(opNode.code)
        }
      }
    }
  }

  // 获取当前选中工序的所有 opCode（用于区域过滤）
  const getFilteredOpCodes = (): string[] => {
    if (!selectedProcess) return []
    // 检查是否是区域头部
    const section = PROCESS_TREE.find((s) => s.id === selectedProcess)
    if (section && section.children) {
      return section.children.map((c) => c.code)
    }
    return [selectedProcess]
  }

  // 实际过滤数据
  const displayData = (() => {
    const opCodes = getFilteredOpCodes()
    if (opCodes.length === 0) return PFMEA_DATA
    return PFMEA_DATA.filter((d) => opCodes.includes(d.opCode))
  })()

  // 表单状态
  const [formData, setFormData] = useState({
    vector4M1E: "" as Vector4M1E | "",
    rootCause: "",
    preventionControl: "",
    detectionControl: "",
    pokaYoke: "" as PokaYokeType | "",
    recommendedAction: "",
    status: "" as PFMEARecord["status"] | "",
  })

  const handleRowClick = (record: PFMEARecord) => {
    setSelectedRecord(record)
    setFormData({
      vector4M1E: record.vector4M1E,
      rootCause: record.rootCause,
      preventionControl: record.preventionControl,
      detectionControl: record.detectionControl,
      pokaYoke: record.pokaYoke,
      recommendedAction: record.recommendedAction,
      status: record.status,
    })
    setDrawerMode("view")
    setIsDrawerOpen(true)
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部元数据头 */}
      <header className="shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold text-foreground">
                PFMEA 工作台
              </h1>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">产品:</span>
              <span className="font-medium text-foreground">
                LED灯具模组 LM-2024
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">版本:</span>
              <span className="font-mono text-foreground">Rev.03</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">更新:</span>
              <span className="text-foreground">2024-01-15</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              筛选
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              导出
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              新增记录
            </Button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧工序流程树 */}
        <aside className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col">
          <div className="p-3 border-b border-sidebar-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索工序..."
                className="pl-8 h-8 text-sm bg-sidebar-accent border-sidebar-border"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5 mb-1">
                工序流程树
              </div>
              {PROCESS_TREE.map((node) => (
                <ProcessTreeNode
                  key={node.id}
                  node={node}
                  selectedId={selectedProcess}
                  onSelect={handleProcessSelect}
                />
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* 右侧表格区域 */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* 表格 - 使用 table-auto 和 align-top */}
          <div className="flex-1 overflow-auto">
            <table className="table-auto w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-card border-b border-border">
                  {/* 1. 工序步骤 [FROZEN LEFT] */}
                  <th className="sticky left-0 z-20 bg-card px-3 py-3 text-left font-medium text-muted-foreground border-r border-border min-w-[140px] align-top shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]">
                    工序步骤
                    <div className="text-[10px] text-muted-foreground/70 font-normal">OP Step</div>
                  </th>
                  {/* 2. 工序要求 [FROZEN LEFT] */}
                  <th className="sticky left-[140px] z-20 bg-card px-3 py-3 text-left font-medium text-muted-foreground border-r border-border min-w-[180px] align-top shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]">
                    工序要求
                    <div className="text-[10px] text-muted-foreground/70 font-normal">Requirement</div>
                  </th>
                  {/* 3. 失效影响 */}
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground border-r border-border min-w-[200px] align-top">
                    失效影响
                    <div className="text-[10px] text-muted-foreground/70 font-normal">Effects</div>
                  </th>
                  {/* 4. S */}
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground border-r border-border w-12 align-top">
                    S
                  </th>
                  {/* 5. 异动维度 4M1E */}
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground border-r border-border min-w-[100px] align-top">
                    异动维度
                    <div className="text-[10px] text-muted-foreground/70 font-normal">4M1E Vector</div>
                  </th>
                  {/* 6. 根本原因 */}
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground border-r border-border min-w-[200px] align-top">
                    根本原因
                    <div className="text-[10px] text-muted-foreground/70 font-normal">Root Cause</div>
                  </th>
                  {/* 7. O */}
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground border-r border-border w-12 align-top">
                    O
                  </th>
                  {/* 8. 现行预防控制 */}
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground border-r border-border min-w-[180px] align-top">
                    现行预防控制
                    <div className="text-[10px] text-muted-foreground/70 font-normal">Prevention Control</div>
                  </th>
                  {/* 9. 现行探测控制 */}
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground border-r border-border min-w-[180px] align-top">
                    现行探测控制
                    <div className="text-[10px] text-muted-foreground/70 font-normal">Detection Control</div>
                  </th>
                  {/* 10. 防呆判定 [RESTORED] */}
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground border-r border-border min-w-[100px] align-top">
                    防呆判定
                    <div className="text-[10px] text-muted-foreground/70 font-normal">Poka-Yoke</div>
                  </th>
                  {/* 11. D */}
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground border-r border-border w-12 align-top">
                    D
                  </th>
                  {/* 12. RPN */}
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground border-r border-border w-16 align-top">
                    RPN
                  </th>
                  {/* 13. 建议措施 */}
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground border-r border-border min-w-[180px] align-top">
                    建议措施
                    <div className="text-[10px] text-muted-foreground/70 font-normal">Action</div>
                  </th>
                  {/* 14. 责任人 [RESTORED] */}
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground border-r border-border min-w-[100px] align-top">
                    责任人
                    <div className="text-[10px] text-muted-foreground/70 font-normal">Owner</div>
                  </th>
                  {/* 15. 状态 */}
                  <th className="px-3 py-3 text-center font-medium text-muted-foreground min-w-[90px] align-top">
                    状态
                    <div className="text-[10px] text-muted-foreground/70 font-normal">Status</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((record, index) => (
                  <tr
                    key={record.id}
                    className={cn(
                      "border-b border-border/50 cursor-pointer transition-colors",
                      index % 2 === 0 ? "bg-background" : "bg-card/30",
                      "hover:bg-primary/5",
                      selectedRecord?.id === record.id && "bg-primary/10"
                    )}
                    onClick={() => handleRowClick(record)}
                  >
                    {/* 1. 工序步骤 [FROZEN] */}
                    <td className="sticky left-0 z-10 px-3 py-4 border-r border-border font-medium text-foreground align-top whitespace-normal break-words shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]" style={{ backgroundColor: 'inherit' }}>
                      <div className={cn(index % 2 === 0 ? "bg-background" : "bg-card/30", selectedRecord?.id === record.id && "bg-primary/10", "hover:bg-primary/5")}>
                        {record.opStep}
                      </div>
                    </td>
                    {/* 2. 工序要求 [FROZEN] */}
                    <td className="sticky left-[140px] z-10 px-3 py-4 border-r border-border text-muted-foreground align-top whitespace-normal break-words shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]" style={{ backgroundColor: 'inherit' }}>
                      {record.requirement}
                    </td>
                    {/* 3. 失效影响 */}
                    <td className="px-3 py-4 border-r border-border/50 text-muted-foreground align-top whitespace-normal break-words">
                      {record.failureEffect}
                    </td>
                    {/* 4. S */}
                    <td className="px-3 py-4 border-r border-border/50 text-center align-top">
                      <span className="font-mono font-semibold text-amber-400">
                        {record.severity}
                      </span>
                    </td>
                    {/* 5. 4M1E */}
                    <td className="px-3 py-4 border-r border-border/50 text-center align-top">
                      <Vector4M1EBadge vector={record.vector4M1E} />
                    </td>
                    {/* 6. 根本原因 */}
                    <td className="px-3 py-4 border-r border-border/50 text-muted-foreground align-top whitespace-normal break-words">
                      {record.rootCause}
                    </td>
                    {/* 7. O */}
                    <td className="px-3 py-4 border-r border-border/50 text-center align-top">
                      <span className="font-mono font-semibold text-blue-400">
                        {record.occurrence}
                      </span>
                    </td>
                    {/* 8. 现行预防控制 */}
                    <td className="px-3 py-4 border-r border-border/50 text-muted-foreground align-top whitespace-normal break-words">
                      {record.preventionControl}
                    </td>
                    {/* 9. 现行探测控制 */}
                    <td className="px-3 py-4 border-r border-border/50 text-muted-foreground align-top whitespace-normal break-words">
                      {record.detectionControl}
                    </td>
                    {/* 10. 防呆判定 */}
                    <td className="px-3 py-4 border-r border-border/50 text-center align-top">
                      <PokaYokeBadge type={record.pokaYoke} />
                    </td>
                    {/* 11. D */}
                    <td className="px-3 py-4 border-r border-border/50 text-center align-top">
                      <span className="font-mono font-semibold text-cyan-400">
                        {record.detection}
                      </span>
                    </td>
                    {/* 12. RPN (自动计算 S*O*D) */}
                    <td className="px-3 py-4 border-r border-border/50 text-center align-top">
                      <RPNIndicator severity={record.severity} occurrence={record.occurrence} detection={record.detection} />
                    </td>
                    {/* 13. 建议措施 */}
                    <td className="px-3 py-4 border-r border-border/50 text-muted-foreground align-top whitespace-normal break-words">
                      {record.recommendedAction}
                    </td>
                    {/* 14. 责任人 [RESTORED] */}
                    <td className="px-3 py-4 border-r border-border/50 text-center align-top">
                      <span className="text-xs text-foreground font-medium">
                        {record.owner}
                      </span>
                    </td>
                    {/* 15. 状态 */}
                    <td className="px-3 py-4 text-center align-top">
                      <StatusBadge status={record.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 底部统计栏 */}
          <footer className="shrink-0 border-t border-border bg-card px-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>
                  {selectedProcess 
                    ? `筛选: ${displayData.length} / ${PFMEA_DATA.length} 条`
                    : `共 ${PFMEA_DATA.length} 条记录`
                  }
                </span>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <span>4M1E 分布:</span>
                  {(Object.keys(VECTOR_4M1E_CONFIG) as Vector4M1E[]).map(
                    (vector) => {
                      const count = displayData.filter(
                        (r) => r.vector4M1E === vector
                      ).length
                      if (count === 0) return null
                      return (
                        <span
                          key={vector}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px]",
                            VECTOR_4M1E_CONFIG[vector].className
                          )}
                        >
                          {vector}: {count}
                        </span>
                      )
                    }
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span>
                  高风险 (RPN≥100):{" "}
                  {displayData.filter((r) => r.severity * r.occurrence * r.detection >= 100).length}
                </span>
                <span>
                  待处理: {displayData.filter((r) => r.status === "open").length}
                </span>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* 右侧审核抽屉 */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent
          side="right"
          className="w-[520px] sm:max-w-[520px] bg-card border-border p-0 flex flex-col"
        >
          <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-foreground">
                  PFMEA 记录详情
                </SheetTitle>
                <SheetDescription className="text-muted-foreground">
                  {selectedRecord?.opStep}
                </SheetDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={drawerMode === "view" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setDrawerMode("view")}
                >
                  查看
                </Button>
                <Button
                  variant={drawerMode === "edit" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setDrawerMode("edit")}
                >
                  编辑
                </Button>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            {selectedRecord && (
              <div className="p-6 space-y-6">
                {/* 基本信息 */}
                <section>
                  <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />
                    基本信息
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs mb-1">
                        工序步骤
                      </div>
                      <div className="text-foreground font-medium">
                        {selectedRecord.opStep}
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs mb-1">
                        状态
                      </div>
                      <StatusBadge status={selectedRecord.status} />
                    </div>
                    <div className="col-span-2 bg-secondary/50 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs mb-1">
                        工序要求
                      </div>
                      <div className="text-foreground">
                        {selectedRecord.requirement}
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* 失效分析 */}
                <section>
                  <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    失效分析
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs mb-1">
                        失效影响
                      </div>
                      <div className="text-foreground">
                        {selectedRecord.failureEffect}
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* 4M1E 原因分析 */}
                <section>
                  <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <div className="h-4 w-4 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                      4M
                    </div>
                    原因分析 (4M1E)
                  </h3>
                  <div className="space-y-3">
                    {/* 4M1E 选择器 */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        异动维度 (4M1E Vector)
                      </Label>
                      {drawerMode === "edit" ? (
                        <div className="grid grid-cols-5 gap-2">
                          {(
                            Object.keys(VECTOR_4M1E_CONFIG) as Vector4M1E[]
                          ).map((vector) => {
                            const config = VECTOR_4M1E_CONFIG[vector]
                            const isSelected = formData.vector4M1E === vector
                            return (
                              <button
                                key={vector}
                                type="button"
                                className={cn(
                                  "px-2 py-2 rounded text-xs font-medium border transition-all",
                                  isSelected
                                    ? config.className
                                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50"
                                )}
                                onClick={() =>
                                  setFormData({ ...formData, vector4M1E: vector })
                                }
                              >
                                <div>{config.label}</div>
                                <div className="text-[10px] opacity-70">
                                  {config.labelEn}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <Vector4M1EBadge vector={selectedRecord.vector4M1E} />
                      )}
                    </div>

                    {/* 根本原因 */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        根本原因描述 (Root Cause)
                      </Label>
                      {drawerMode === "edit" ? (
                        <Textarea
                          value={formData.rootCause}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              rootCause: e.target.value,
                            })
                          }
                          className="bg-secondary/50 border-border text-foreground resize-none"
                          rows={3}
                          placeholder="请描述具体的根本原因..."
                        />
                      ) : (
                        <div className="bg-secondary/50 rounded-lg p-3 text-sm text-foreground">
                          {selectedRecord.rootCause}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <Separator />

                {/* SOD评分 */}
                <section>
                  <h3 className="text-sm font-medium text-foreground mb-3">
                    风险评估 (S-O-D)
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 text-center">
                      <div className="text-amber-400 text-2xl font-bold font-mono">
                        {selectedRecord.severity}
                      </div>
                      <div className="text-amber-400/70 text-[10px] uppercase tracking-wider">
                        严重度
                      </div>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 text-center">
                      <div className="text-blue-400 text-2xl font-bold font-mono">
                        {selectedRecord.occurrence}
                      </div>
                      <div className="text-blue-400/70 text-[10px] uppercase tracking-wider">
                        发生度
                      </div>
                    </div>
                    <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-3 text-center">
                      <div className="text-cyan-400 text-2xl font-bold font-mono">
                        {selectedRecord.detection}
                      </div>
                      <div className="text-cyan-400/70 text-[10px] uppercase tracking-wider">
                        探测度
                      </div>
                    </div>
                    {(() => {
                      const rpn = selectedRecord.severity * selectedRecord.occurrence * selectedRecord.detection
                      return (
                        <div
                          className={cn(
                            "rounded-lg p-3 text-center border",
                            rpn >= 100
                              ? "bg-red-900/20 border-red-700/30"
                              : rpn >= 50
                              ? "bg-amber-900/20 border-amber-700/30"
                              : "bg-emerald-900/20 border-emerald-700/30"
                          )}
                        >
                          <div
                            className={cn(
                              "text-2xl font-bold font-mono",
                              rpn >= 100
                                ? "text-red-400"
                                : rpn >= 50
                                ? "text-amber-400"
                                : "text-emerald-400"
                            )}
                          >
                            {rpn}
                          </div>
                          <div
                            className={cn(
                              "text-[10px] uppercase tracking-wider",
                              rpn >= 100
                                ? "text-red-400/70"
                                : rpn >= 50
                                ? "text-amber-400/70"
                                : "text-emerald-400/70"
                            )}
                          >
                            RPN
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </section>

                <Separator />

                {/* 控制措施 */}
                <section>
                  <h3 className="text-sm font-medium text-foreground mb-3">
                    控制措施
                  </h3>
                  <div className="space-y-3 text-sm">
                    {/* 预防控制 */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        现行预防控制 (Prevention Control)
                      </Label>
                      {drawerMode === "edit" ? (
                        <Textarea
                          value={formData.preventionControl}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              preventionControl: e.target.value,
                            })
                          }
                          className="bg-secondary/50 border-border text-foreground resize-none"
                          rows={2}
                          placeholder="请描述预防控制措施..."
                        />
                      ) : (
                        <div className="bg-secondary/50 rounded-lg p-3 text-foreground">
                          {selectedRecord.preventionControl}
                        </div>
                      )}
                    </div>

                    {/* 探测控制 */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        现行探测控制 (Detection Control)
                      </Label>
                      {drawerMode === "edit" ? (
                        <Textarea
                          value={formData.detectionControl}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              detectionControl: e.target.value,
                            })
                          }
                          className="bg-secondary/50 border-border text-foreground resize-none"
                          rows={2}
                          placeholder="请描述探测控制措施..."
                        />
                      ) : (
                        <div className="bg-secondary/50 rounded-lg p-3 text-foreground">
                          {selectedRecord.detectionControl}
                        </div>
                      )}
                    </div>

                    {/* 防呆判定 */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        防呆判定 (Poka-Yoke)
                      </Label>
                      {drawerMode === "edit" ? (
                        <div className="grid grid-cols-5 gap-2">
                          {(
                            Object.keys(POKA_YOKE_CONFIG) as PokaYokeType[]
                          ).map((type) => {
                            const config = POKA_YOKE_CONFIG[type]
                            const isSelected = formData.pokaYoke === type
                            return (
                              <button
                                key={type}
                                type="button"
                                className={cn(
                                  "px-2 py-2 rounded text-xs font-medium border transition-all",
                                  isSelected
                                    ? config.className
                                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50"
                                )}
                                onClick={() =>
                                  setFormData({ ...formData, pokaYoke: type })
                                }
                              >
                                {config.label}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <PokaYokeBadge type={selectedRecord.pokaYoke} />
                      )}
                    </div>
                  </div>
                </section>

                <Separator />

                {/* 改善措施 */}
                <section>
                  <h3 className="text-sm font-medium text-foreground mb-3">
                    改善措施
                  </h3>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      建议改善措施 (Recommended Action)
                    </Label>
                    {drawerMode === "edit" ? (
                      <Textarea
                        value={formData.recommendedAction}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            recommendedAction: e.target.value,
                          })
                        }
                        className="bg-secondary/50 border-border text-foreground resize-none"
                        rows={3}
                        placeholder="请输入建议的改善措施..."
                      />
                    ) : (
                      <div className="bg-secondary/50 rounded-lg p-3 text-sm text-foreground">
                        {selectedRecord.recommendedAction}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </ScrollArea>

          {/* 抽屉底部操作 */}
          {drawerMode === "edit" && (
            <div className="shrink-0 border-t border-border p-4 bg-card">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDrawerMode("view")}
                >
                  取消
                </Button>
                <Button onClick={() => setDrawerMode("view")}>保存更改</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
