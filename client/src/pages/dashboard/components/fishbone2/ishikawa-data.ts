export type Risk = "HIGH" | "MED" | "LOW";

export type Validation = "UNVERIFIED" | "PROVEN" | "FALSE" | "MITIGATED";

export interface Cause {
  id: string;
  label: string;
  risk: Risk;
  contribution: number;
  note: string;
  metric: string;
  validation: Validation;
  protocol: string;
  owner: string;
}

export interface Category {
  id: string;
  code: string;
  label: string;
  side: "top" | "bottom";
  col: number;
  causes: Cause[];
}

export interface TargetData {
  code: string;
  label: string;
  metric: string;
  delta: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "man",
    code: "MAN",
    label: "人员",
    side: "top",
    col: 2,
    causes: [
      { id: "man-1", label: "操作员培训不足", risk: "HIGH", contribution: 0.71, metric: "认证率 62%", note: "三班次中夜班操作员持证比例低于阈值，与不良率峰值时间窗高度重合。", validation: "PROVEN", protocol: "对持证率与不良率做卡方独立性检验", owner: "QE · 林涛" },
      { id: "man-2", label: "换班交接遗漏", risk: "MED", contribution: 0.44, metric: "遗漏 3.2/周", note: "交接清单未数字化，参数变更未随班次同步传递。", validation: "UNVERIFIED", protocol: "", owner: "" },
      { id: "man-3", label: "判废标准主观", risk: "LOW", contribution: 0.21, metric: "一致性 88%", note: "目检判废存在个体差异，影响轻微但需标准化。", validation: "FALSE", protocol: "Kappa 一致性研究 (n=120)", owner: "QA · 周敏" },
    ],
  },
  {
    id: "machine",
    code: "MACHINE",
    label: "设备",
    side: "top",
    col: 1,
    causes: [
      { id: "mac-1", label: "贴片机吸嘴磨损", risk: "HIGH", contribution: 0.83, metric: "磨损 +0.18mm", note: "Line-3 吸嘴超出磨损公差，抛料率与批次不良率强相关 r=0.79。", validation: "PROVEN", protocol: "对吸嘴尺寸做 2-Way ANOVA", owner: "Eng · 张伟" },
      { id: "mac-2", label: "回流焊温区漂移", risk: "HIGH", contribution: 0.68, metric: "Δ +6.4℃", note: "第四温区实测高于设定曲线，冷焊与虚焊缺陷上升。", validation: "MITIGATED", protocol: "炉温曲线复测 + SPC 监控", owner: "Eng · 张伟" },
      { id: "mac-3", label: "保养计划超期", risk: "MED", contribution: 0.39, metric: "逾期 11 天", note: "预防性维护被生产任务挤占，触发非计划停机。", validation: "UNVERIFIED", protocol: "", owner: "" },
    ],
  },
  {
    id: "material",
    code: "MATERIAL",
    label: "物料",
    side: "top",
    col: 0,
    causes: [
      { id: "mat-1", label: "来料批次混用", risk: "HIGH", contribution: 0.64, metric: "混批 2 个", note: "供应商批次未隔离上料，可追溯性链路断裂。", validation: "PROVEN", protocol: "批次分层抽样 + 双样本 t 检验", owner: "SQE · 王芳" },
      { id: "mat-2", label: "元件受潮氧化", risk: "MED", contribution: 0.47, metric: "湿度卡 3 级", note: "MSD 元件开封后超出曝露时限，焊接润湿性下降。", validation: "UNVERIFIED", protocol: "", owner: "" },
      { id: "mat-3", label: "替代料未验证", risk: "LOW", contribution: 0.18, metric: "待验 1 项", note: "替代料处于试用阶段，尚无足够批次数据。", validation: "UNVERIFIED", protocol: "", owner: "" },
    ],
  },
  {
    id: "method",
    code: "METHOD",
    label: "方法",
    side: "bottom",
    col: 2,
    causes: [
      { id: "met-1", label: "首件检验缺失", risk: "HIGH", contribution: 0.7, metric: "覆盖 74%", note: "换型后首件未全检即放行，缺陷在批内放大。", validation: "MITIGATED", protocol: "强制首件门禁 + 防错卡控", owner: "PE · 陈晨" },
      { id: "met-2", label: "参数设定错误", risk: "HIGH", contribution: 0.66, metric: "偏差 2 项", note: "钢网开口与印刷压力配置与新设计不匹配。", validation: "PROVEN", protocol: "DOE 全因子实验 (压力×速度)", owner: "PE · 陈晨" },
      { id: "met-3", label: "SOP 版本滞后", risk: "MED", contribution: 0.35, metric: "滞后 v2", note: "现场作业文件未同步最新工程变更。", validation: "UNVERIFIED", protocol: "", owner: "" },
    ],
  },
  {
    id: "env",
    code: "ENVIRON",
    label: "环境",
    side: "bottom",
    col: 1,
    causes: [
      { id: "env-1", label: "静电防护失效", risk: "HIGH", contribution: 0.58, metric: "接地 2 处断", note: "工位腕带与离子风机检测异常，敏感器件潜在损伤。", validation: "UNVERIFIED", protocol: "", owner: "" },
      { id: "env-2", label: "车间湿度超标", risk: "MED", contribution: 0.41, metric: "RH 63%", note: "湿度高于工艺窗口上限，加剧物料吸湿风险。", validation: "FALSE", protocol: "湿度与不良率回归分析", owner: "Facility · 赵磊" },
      { id: "env-3", label: "粉尘污染", risk: "LOW", contribution: 0.16, metric: "颗粒 +12%", note: "回风口滤网周期内饱和，影响有限。", validation: "FALSE", protocol: "洁净度等级复测", owner: "Facility · 赵磊" },
    ],
  },
  {
    id: "measure",
    code: "MEASURE",
    label: "测量",
    side: "bottom",
    col: 0,
    causes: [
      { id: "mea-1", label: "量具未校准", risk: "HIGH", contribution: 0.55, metric: "逾期 2 台", note: "卡尺与厚度仪超出校准周期，测量基准存疑。", validation: "PROVEN", protocol: "Gage R&R 测量系统分析", owner: "Metro · 孙杰" },
      { id: "mea-2", label: "AOI 误判率高", risk: "MED", contribution: 0.43, metric: "误报 7.1%", note: "光学检测程序阈值偏松，漏检与误报并存。", validation: "UNVERIFIED", protocol: "", owner: "" },
      { id: "mea-3", label: "采样方案不足", risk: "LOW", contribution: 0.19, metric: "n=8/批", note: "抽样量不满足统计置信要求。", validation: "UNVERIFIED", protocol: "", owner: "" },
    ],
  },
];

export const TARGET: TargetData = {
  code: "TARGET DEFECT",
  label: "批次不良率暴增",
  metric: "DPMO 4,820",
  delta: "+312%",
};

export const RISK_META: Record<Risk, { label: string; color: string; text: string }> = {
  HIGH: { label: "HIGH", color: "var(--risk-high)", text: "text-red-400" },
  MED: { label: "MED", color: "var(--risk-med)", text: "text-amber-400" },
  LOW: { label: "LOW", color: "var(--risk-low)", text: "text-emerald-400" },
};

export const VALIDATION_META: Record<
  Validation,
  { sigil: string; label: string; en: string; color: string; text: string; glow: boolean; strike: boolean }
> = {
  UNVERIFIED: { sigil: "?", label: "待验证", en: "UNVERIFIED", color: "oklch(0.7 0.02 220)", text: "text-slate-300/70", glow: false, strike: false },
  PROVEN: { sigil: "!", label: "强相关", en: "VERIFIED · PROVEN", color: "var(--risk-high)", text: "text-red-300", glow: true, strike: false },
  FALSE: { sigil: "x", label: "已排除", en: "VERIFIED · FALSE", color: "oklch(0.55 0.03 200)", text: "text-slate-400/45", glow: false, strike: true },
  MITIGATED: { sigil: "+", label: "已管控", en: "MITIGATED", color: "var(--cyan)", text: "text-cyan-200", glow: true, strike: false },
};

export const VALIDATION_ORDER: Validation[] = ["UNVERIFIED", "PROVEN", "FALSE", "MITIGATED"];

export type MatrixData = Record<string, Cause[]>;
export type CategoryMeta = Omit<Category, "causes">;
export const CATEGORY_META = CATEGORIES.map(({ causes, ...meta }) => meta);

export function seedMatrix(): MatrixData {
  const m: MatrixData = {};
  for (const cat of CATEGORIES) m[cat.id] = cat.causes.map((c) => ({ ...c }));
  return m;
}

export function makeCause(label: string): Cause {
  return {
    id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    risk: "MED",
    contribution: 0.3,
    metric: "待采集",
    note: "新注入的根因假设，等待数据验证与归因分析。",
    validation: "UNVERIFIED",
    protocol: "",
    owner: "",
  };
}

export const VIEW = { w: 1000, h: 720 };
const SPINE_Y = VIEW.h / 2;
const SPINE_START = 64;
const TARGET_X = 898;
const ATTACH_X = [690, 470, 250];
const RIB_TOP_Y = 92;
const RIB_BOTTOM_Y = VIEW.h - 92;
const RIB_BACKSWEEP = 128;

export interface Pt {
  x: number;
  y: number;
}

export interface RibGeometry {
  attach: Pt;
  end: Pt;
  c1: Pt;
  c2: Pt;
  d: string;
  causeAnchors: Pt[];
  leaderEnds: Pt[];
}

function cubicAt(p0: Pt, c1: Pt, c2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  };
}

export function anchorTs(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0.55];
  const start = 0.28;
  const end = 0.86;
  return Array.from({ length: count }, (_, i) => start + (end - start) * (i / (count - 1)));
}

export function ribGeometry(cat: CategoryMeta, count = 3): RibGeometry {
  const attachX = ATTACH_X[cat.col];
  const endY = cat.side === "top" ? RIB_TOP_Y : RIB_BOTTOM_Y;
  const attach: Pt = { x: attachX, y: SPINE_Y };
  const end: Pt = { x: attachX - RIB_BACKSWEEP, y: endY };
  const c1: Pt = { x: attachX - RIB_BACKSWEEP * 0.55, y: SPINE_Y };
  const c2: Pt = { x: end.x + 36, y: end.y + (SPINE_Y - end.y) * 0.42 };
  const d = `M ${attach.x} ${attach.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
  const ts = anchorTs(count);
  const causeAnchors = ts.map((t) => cubicAt(attach, c1, c2, end, t));
  const leaderEnds = causeAnchors.map((p) => ({ x: p.x - 14, y: p.y }));
  return { attach, end, c1, c2, d, causeAnchors, leaderEnds };
}

export const GEO = { SPINE_Y, SPINE_START, TARGET_X };
export const px = (x: number) => `${(x / VIEW.w) * 100}%`;
export const py = (y: number) => `${(y / VIEW.h) * 100}%`;
