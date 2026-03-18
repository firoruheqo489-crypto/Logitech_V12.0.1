/**
 * 注塑缺陷数字诊断实验室 V3 — Context-Aware Data Factory
 * 动态感知材质 + VDI 状态，所有建议和风险等级实时联动
 */
import { useState } from 'react';
import { X, CheckCircle2, Settings, Thermometer, Package } from 'lucide-react';
import EmpiricalKnowledgeBase from './EmpiricalKnowledgeBase';
import type { KnowledgeRecord } from './knowledge-base-types';

type MaterialType = 'PC/ABS' | 'POM/PA' | 'PP/PE';
type DefectType = 'sink-mark' | 'flash' | 'short-shot' | 'burn-mark' | 'weld-line' | 'warpage' | 'splay-marks' | 'ejector-whitening';
type TabType = 'mold' | 'process' | 'material';

interface Solution { en: string; cn: string; }
interface DefectData {
  id: DefectType; name: string; nameCN: string; severity: number; cause: string;
  mold: Solution[]; process: Solution[]; material: Solution[];
}

const mockKnowledgeRecords: KnowledgeRecord[] = [
  {
    id: '1',
    date: '2026-03-12',
    defectIndex: '披锋 FLASH',
    defectType: 'MOLD',
    countermeasure: '排气槽深度从 0.04mm 降至 0.02mm，重新研磨分型面，披锋彻底消除。',
    hasAttachment: true,
    submittedBy: '张工 / Mold Tech',
  },
  {
    id: '2',
    date: '2026-02-18',
    defectIndex: '缩水 SINK MARK',
    defectType: 'PROCESS',
    countermeasure: '保压压力提升 15%，保压时间延长 2.5s，冷却水路切换为冰水机 (12℃)。',
    hasAttachment: false,
    submittedBy: '王师傅 / Process',
  },
  {
    id: '3',
    date: '2026-01-05',
    defectIndex: '烧焦 BURN MARK',
    defectType: 'MATERIAL',
    countermeasure: '降低末段注射速度至 25%，增加末端排气间隙，解决死角困气高温。',
    hasAttachment: true,
    submittedBy: '刘工 / QE',
  },
];

/* ════════════════════════════════════════════════
   物理计算引擎
   ════════════════════════════════════════════════ */
const MATERIAL_PHYSICS: Record<MaterialType, {
  multiplier: number; shrinkRate: string; moldTemp: string; dryTemp: string; dryTime: string;
  mfi: string; riskBias: Partial<Record<DefectType, number>>;
}> = {
  'PC/ABS': {
    multiplier: 1.0, shrinkRate: '0.5-0.7%', moldTemp: '60-80°C', dryTemp: '80°C', dryTime: '4hrs',
    mfi: '15-25 g/10min',
    riskBias: { 'ejector-whitening': 20, 'weld-line': 10, 'splay-marks': 5 },
  },
  'POM/PA': {
    multiplier: 0.85, shrinkRate: '1.5-2.5%', moldTemp: '80-120°C', dryTemp: '85°C', dryTime: '6hrs',
    mfi: '8-15 g/10min',
    riskBias: { 'burn-mark': 20, 'flash': 10, 'warpage': 15 },
  },
  'PP/PE': {
    multiplier: 0.6, shrinkRate: '1.0-3.0%', moldTemp: '20-50°C', dryTemp: '—', dryTime: '—',
    mfi: '5-35 g/10min',
    riskBias: { 'sink-mark': 25, 'warpage': 20, 'short-shot': -10 },
  },
};

/** 拔模角计算 — 与 VDISurfaceGrid 同源公式 */
function calculateDraft(material: MaterialType, vdi: number): string {
  // 基础拔模角: VDI 每增加 6 点，拔模角 +0.5°
  const baseDraft = 1.0 + Math.max(0, (vdi - 12) / 6) * 0.5;
  return (baseDraft * MATERIAL_PHYSICS[material].multiplier).toFixed(1);
}

/** 动态严重度计算 */
function calcSeverity(base: number, material: MaterialType, vdi: number, defectId: DefectType): number {
  const bias = MATERIAL_PHYSICS[material].riskBias[defectId] ?? 0;
  // VDI > 30 时所有缺陷风险上浮
  const vdiPenalty = vdi > 30 ? Math.round((vdi - 30) * 1.5) : 0;
  return Math.min(100, Math.max(10, base + bias + vdiPenalty));
}

/** 严重度等级标签 */
function severityLabel(s: number): 'FATAL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (s >= 95) return 'FATAL';
  if (s >= 75) return 'CRITICAL';
  if (s >= 60) return 'HIGH';
  if (s >= 40) return 'MEDIUM';
  return 'LOW';
}

/* ════════════════════════════════════════════════
   Context-Aware Data Factory
   ════════════════════════════════════════════════ */
function getDynamicDefects(material: MaterialType, vdi: number): DefectData[] {
  const mat = MATERIAL_PHYSICS[material];
  const draft = calculateDraft(material, vdi);

  return [
    {
      id: 'sink-mark', name: 'SINK MARK', nameCN: '缩水',
      severity: calcSeverity(75, material, vdi, 'sink-mark'),
      cause: `Volumetric shrinkage — ${material} 收缩率 ${mat.shrinkRate}`,
      mold: [
        { en: 'Reduce rib thickness to 60% of wall', cn: '减少加强筋厚度至壁厚的60%' },
        { en: 'Add venting slots at sink locations', cn: '在缩水位置增加排气槽' },
        { en: 'Increase gate size by 15-20%', cn: '增大浇口尺寸15-20%' },
        { en: 'Optimize cooling channel layout', cn: '优化冷却水路布局' },
      ],
      process: [
        { en: `Increase pack pressure: +10-15% (${material} baseline)`, cn: `提高保压压力：+10-15%（${material} 基准）` },
        { en: 'Extend holding time: +2-3s', cn: '延长保压时间：+2-3秒' },
        { en: `Lower melt temperature: -5-10°C (current mold temp: ${mat.moldTemp})`, cn: `降低料温：-5-10°C（当前模温参考：${mat.moldTemp}）` },
        { en: `Increase cooling time: +15% — shrink rate ${mat.shrinkRate} demands longer pack`, cn: `增加冷却时间：+15% — 收缩率 ${mat.shrinkRate} 需要更长保压` },
      ],
      material: [
        { en: `Check ${material} drying: ${mat.dryTemp} / ${mat.dryTime}`, cn: `检查 ${material} 干燥条件：${mat.dryTemp} / ${mat.dryTime}` },
        { en: `Verify MFI (${material} typical: ${mat.mfi})`, cn: `验证熔融指数（${material} 典型值：${mat.mfi}）` },
        { en: 'Consider high-flow resin grade', cn: '考虑使用高流动性树脂牌号' },
      ],
    },
    {
      id: 'flash', name: 'FLASH', nameCN: '披锋',
      severity: calcSeverity(60, material, vdi, 'flash'),
      cause: 'Clamp force too low or parting line damage',
      mold: [
        { en: 'Check parting line flatness', cn: '检查分型面平整度' },
        { en: 'Inspect mold lock mechanism', cn: '检查模具锁模机构' },
        { en: 'Reduce venting depth to 0.02mm', cn: '减少排气深度至0.02mm' },
        { en: 'Polish parting surface', cn: '抛光分型面' },
      ],
      process: [
        { en: 'Reduce injection pressure: -5-10%', cn: '降低注射压力：-5-10%' },
        { en: 'Decrease injection speed', cn: '降低注射速度' },
        { en: 'Increase clamp force', cn: '增加锁模力' },
        { en: `Lower melt temperature: -10°C (${material} mold temp: ${mat.moldTemp})`, cn: `降低料温：-10°C（${material} 模温：${mat.moldTemp}）` },
      ],
      material: [
        { en: `Check ${material} viscosity at processing temp`, cn: `检查 ${material} 加工温度下的粘度` },
        { en: 'Avoid over-drying material', cn: '避免过度干燥材料' },
        { en: 'Use higher viscosity grade', cn: '使用更高粘度牌号' },
      ],
    },
    {
      id: 'weld-line', name: 'WELD LINE', nameCN: '熔接线',
      severity: calcSeverity(55, material, vdi, 'weld-line'),
      cause: 'Flow fronts meeting when material is too cool',
      mold: [
        { en: 'Relocate gate closer to weld line', cn: '将浇口移至更靠近熔接线位置' },
        { en: 'Add overflow well at weld location', cn: '在熔接位置增加溢流井' },
        { en: 'Increase venting at merge point', cn: '在汇流点增加排气' },
        { en: 'Modify flow path geometry', cn: '修改流道几何形状' },
      ],
      process: [
        { en: `Increase melt temperature: +10-15°C (${material})`, cn: `提高料温：+10-15°C（${material}）` },
        { en: `Increase mold temperature: +5-10°C (ref: ${mat.moldTemp})`, cn: `提高模温：+5-10°C（参考：${mat.moldTemp}）` },
        { en: 'Increase injection speed: +20%', cn: '提高注射速度：+20%' },
        { en: 'Optimize injection pressure profile', cn: '优化注射压力曲线' },
      ],
      material: [
        { en: `Ensure ${material} properly dried: ${mat.dryTemp} / ${mat.dryTime}`, cn: `确保 ${material} 充分干燥：${mat.dryTemp} / ${mat.dryTime}` },
        { en: 'Use higher flow grade resin', cn: '使用更高流动性树脂牌号' },
        { en: 'Check molecular weight distribution', cn: '检查分子量分布' },
      ],
    },
    {
      id: 'short-shot', name: 'SHORT SHOT', nameCN: '缺胶',
      severity: calcSeverity(85, material, vdi, 'short-shot'),
      cause: 'Insufficient material to fill cavity completely',
      mold: [
        { en: 'Enlarge gate and runner size', cn: '扩大浇口和流道尺寸' },
        { en: 'Improve venting system', cn: '改善排气系统' },
        { en: 'Check for cold slug wells', cn: '检查冷料井' },
        { en: 'Reduce flow length ratio', cn: '减少流长比' },
      ],
      process: [
        { en: 'Increase injection pressure: +15-20%', cn: '提高注射压力：+15-20%' },
        { en: 'Increase injection speed', cn: '提高注射速度' },
        { en: `Increase melt temperature: +10-15°C (${material})`, cn: `提高料温：+10-15°C（${material}）` },
        { en: 'Extend injection time', cn: '延长注射时间' },
      ],
      material: [
        { en: `Verify ${material} flow properties (MFI: ${mat.mfi})`, cn: `验证 ${material} 流动性能（MFI：${mat.mfi}）` },
        { en: 'Check for moisture contamination', cn: '检查水分污染' },
        { en: 'Use higher MFI grade', cn: '使用更高MFI牌号' },
        { en: 'Ensure consistent material feed', cn: '确保材料供给稳定' },
      ],
    },
    {
      id: 'burn-mark', name: 'BURN MARK', nameCN: '烧焦',
      severity: calcSeverity(70, material, vdi, 'burn-mark'),
      cause: `Poor venting — ${material === 'POM/PA' ? '⚠ POM/PA 结晶速度快，困气风险极高' : 'gas trap and combustion'}`,
      mold: [
        { en: 'Add deep vents at gas trap areas', cn: '在气体滞留区增加深排气槽' },
        { en: 'Reduce sharp corners (R > 0.5mm)', cn: '减少尖角（圆角半径 > 0.5mm）' },
        { en: 'Install vacuum venting system', cn: '安装真空排气系统' },
        { en: 'Check ejector pin clearance', cn: '检查顶针间隙' },
      ],
      process: [
        { en: 'Reduce injection speed: -15-20%', cn: '降低注射速度：-15-20%' },
        { en: `Lower melt temperature: -10-15°C (${material})`, cn: `降低料温：-10-15°C（${material}）` },
        { en: 'Decrease back pressure', cn: '降低背压' },
        { en: 'Optimize fill time', cn: '优化充填时间' },
      ],
      material: [
        { en: `Ensure ${material} completely dried: ${mat.dryTemp} / ${mat.dryTime}`, cn: `确保 ${material} 完全干燥：${mat.dryTemp} / ${mat.dryTime}` },
        { en: 'Check for contamination', cn: '检查污染情况' },
        { en: 'Use thermal-stable additives', cn: '使用热稳定添加剂' },
        { en: 'Verify degradation temperature', cn: '验证降解温度' },
      ],
    },
    {
      id: 'warpage', name: 'WARPAGE', nameCN: '翘曲',
      severity: calcSeverity(80, material, vdi, 'warpage'),
      cause: `Uneven cooling — ${material} 收缩率 ${mat.shrinkRate}${material === 'PP/PE' ? ' (极高收缩，翘曲风险倍增)' : ''}`,
      mold: [
        { en: 'Balance cooling channel layout', cn: '平衡冷却水路布局' },
        { en: 'Add conformal cooling circuits', cn: '增加随形冷却回路' },
        { en: 'Optimize gate location symmetry', cn: '优化浇口位置对称性' },
        { en: 'Reduce wall thickness variation', cn: '减少壁厚变化' },
      ],
      process: [
        { en: `Extend cooling time: +20-30% (${material} shrink: ${mat.shrinkRate})`, cn: `延长冷却时间：+20-30%（${material} 收缩率：${mat.shrinkRate}）` },
        { en: `Balance mold temperature zones (ref: ${mat.moldTemp})`, cn: `平衡模温区域（参考：${mat.moldTemp}）` },
        { en: 'Reduce injection pressure variation', cn: '减少注射压力波动' },
        { en: 'Optimize holding pressure profile', cn: '优化保压曲线' },
      ],
      material: [
        { en: 'Use low-shrinkage resin grade', cn: '使用低收缩树脂牌号' },
        { en: 'Add glass fiber reinforcement', cn: '添加玻纤增强' },
        { en: 'Check crystallinity for semi-crystalline polymers', cn: '检查半结晶聚合物的结晶度' },
        { en: 'Verify thermal expansion coefficient', cn: '验证热膨胀系数' },
      ],
    },
    {
      id: 'splay-marks', name: 'SPLAY MARKS', nameCN: '银丝',
      severity: calcSeverity(65, material, vdi, 'splay-marks'),
      cause: 'Moisture or volatile gas creating surface streaks',
      mold: [
        { en: 'Enlarge venting area near gate', cn: '扩大浇口附近排气区域' },
        { en: `Polish runner surface to Ra < 0.4μm (current VDI ${vdi} → Ra ≈ ${vdiToRaApprox(vdi)}μm)`, cn: `抛光流道表面至 Ra < 0.4μm（当前 VDI ${vdi} → Ra ≈ ${vdiToRaApprox(vdi)}μm）` },
        { en: 'Reduce gate land length', cn: '减少浇口进胶长度' },
        { en: 'Install gas-escape channels', cn: '安装气体逃逸通道' },
      ],
      process: [
        { en: `Lower melt temperature: -10-20°C (${material})`, cn: `降低料温：-10-20°C（${material}）` },
        { en: 'Reduce injection speed by 20-30%', cn: '降低注射速度20-30%' },
        { en: 'Increase back pressure slightly', cn: '轻微提高背压' },
        { en: 'Extend barrel residence time', cn: '延长料筒停留时间' },
      ],
      material: [
        { en: `Dry ${material} thoroughly: ${mat.dryTemp} / ${mat.dryTime}`, cn: `彻底干燥 ${material}：${mat.dryTemp} / ${mat.dryTime}` },
        { en: 'Check moisture content < 0.02%', cn: '检查水分含量 < 0.02%' },
        { en: 'Avoid regrind contamination', cn: '避免回料污染' },
        { en: 'Use desiccant dryer system', cn: '使用除湿干燥系统' },
      ],
    },
    {
      id: 'ejector-whitening', name: 'EJECTOR WHITENING', nameCN: '顶白',
      severity: calcSeverity(
        // PC/ABS + VDI>30 → 强制 FATAL 级
        material === 'PC/ABS' && vdi > 30 ? 95 : 50,
        material, vdi, 'ejector-whitening'
      ),
      cause: material === 'PC/ABS' && vdi > 30
        ? `⚠ FATAL: ${material} + VDI ${vdi} 高抱紧力 + 深纹理 = 顶白必发区`
        : 'Stress whitening from ejector pin pressure',
      mold: [
        { en: `[SYS DETECT] ${material} + VDI ${vdi}: min draft angle ≥ ${draft}° — verify 3D data immediately`, cn: `[当前系统检测] 材质 ${material} + 纹理 VDI ${vdi}。强制要求最小拔模斜度需达到 ${draft}° 以上，请立即复核 3D 数据！` },
        { en: 'Increase ejector pin diameter', cn: '增加顶针直径' },
        { en: 'Add more ejector pins to distribute force', cn: '增加更多顶针分散力量' },
        { en: 'Polish ejector pin surface', cn: '抛光顶针表面' },
      ],
      process: [
        { en: `Extend cooling time before ejection (${material} mold temp: ${mat.moldTemp})`, cn: `延长顶出前冷却时间（${material} 模温：${mat.moldTemp}）` },
        { en: 'Reduce ejection speed', cn: '降低顶出速度' },
        { en: `Increase mold temperature: +5-10°C (ref: ${mat.moldTemp})`, cn: `提高模温：+5-10°C（参考：${mat.moldTemp}）` },
        { en: 'Optimize ejection stroke timing', cn: '优化顶出行程时机' },
      ],
      material: [
        { en: `Use impact-modified ${material} grade`, cn: `使用冲击改性 ${material} 牌号` },
        { en: 'Check material flexibility', cn: '检查材料柔韧性' },
        { en: 'Verify stress-crack resistance', cn: '验证抗应力开裂性能' },
        { en: 'Consider rubber-toughened polymer', cn: '考虑橡胶增韧聚合物' },
      ],
    },
  ];
}

/** VDI → Ra 近似 (简化公式) */
function vdiToRaApprox(vdi: number): string {
  return (0.1 * Math.pow(10, vdi / 20)).toFixed(1);
}

/* ── CSS Defect Texture Renderer ── */
function DefectTexture({ id, active }: { id: DefectType; active: boolean }) {
  const base = `relative w-32 h-32 bg-slate-800 rounded-xl border transition-all duration-300 ${active ? 'border-cyan-400/50 brightness-125' : 'border-slate-700/30'}`;
  const shadow = active
    ? 'inset 0 0 20px rgba(34,211,238,0.3), inset 2px 2px 5px rgba(255,255,255,0.15), inset -4px -4px 10px rgba(0,0,0,0.6), 4px 4px 15px rgba(34,211,238,0.4)'
    : 'inset 2px 2px 5px rgba(255,255,255,0.1), inset -4px -4px 10px rgba(0,0,0,0.6), 4px 4px 10px rgba(0,0,0,0.5)';
  return (
    <div className={base} style={{ boxShadow: shadow }}>
      {id === 'sink-mark' && <div className="absolute inset-0 rounded-xl" style={{ background: 'radial-gradient(circle at 45% 45%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 30%, rgba(15,15,20,0.2) 50%, transparent 70%)', boxShadow: 'inset 10px 10px 20px rgba(0,0,0,0.5), inset -10px -10px 20px rgba(255,255,255,0.05)' }} />}
      {id === 'flash' && (<><div className="absolute -right-1 top-6 bottom-6 w-1.5 bg-slate-300/90 rounded-full" style={{ boxShadow: '0 0 12px rgba(255,255,255,0.9), 3px 3px 6px rgba(255,255,255,0.7)' }} /><div className="absolute left-6 -bottom-1 right-6 h-1 bg-slate-300/70 rounded-full" style={{ boxShadow: '0 0 8px rgba(255,255,255,0.7)' }} /></>)}
      {id === 'short-shot' && <div className="absolute inset-0 bg-slate-800 rounded-xl" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 70% 100%, 0 100%)' }} />}
      {id === 'burn-mark' && <div className="absolute top-0 right-0 w-16 h-16 rounded-tr-xl" style={{ background: 'radial-gradient(circle at top right, rgba(10,5,0,0.95) 0%, rgba(30,15,5,0.8) 25%, rgba(50,25,10,0.5) 50%, transparent 75%)', filter: 'blur(3px)' }} />}
      {id === 'weld-line' && (<><div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-slate-950 -translate-x-1" /><div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-slate-100/30 translate-x-0.5" style={{ boxShadow: '1px 0 3px rgba(255,255,255,0.3), -1px 0 2px rgba(255,255,255,0.1)' }} /></>)}
      {id === 'warpage' && <div className="absolute inset-0 rounded-xl" style={{ transform: 'perspective(400px) rotateX(15deg) rotateY(-10deg) skewY(-5deg)', background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.6) 100%)', boxShadow: 'inset -5px -5px 15px rgba(0,0,0,0.8), inset 5px 5px 10px rgba(255,255,255,0.15)' }} />}
      {id === 'splay-marks' && <div className="absolute inset-0 rounded-xl" style={{ backgroundImage: 'repeating-radial-gradient(circle at 10% 10%, rgba(255,255,255,0.15) 0%, transparent 2%, transparent 4%, rgba(255,255,255,0.05) 5%), repeating-radial-gradient(circle at 10% 10%, rgba(34,211,238,0.08) 0%, transparent 3%, transparent 5%, rgba(34,211,238,0.03) 6%)' }} />}
      {id === 'ejector-whitening' && <div className="absolute inset-0 rounded-xl" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(226,232,240,0.4) 0%, transparent 15%), radial-gradient(circle at 30% 70%, rgba(226,232,240,0.3) 0%, transparent 12%), radial-gradient(circle at 60% 80%, rgba(148,163,184,0.25) 0%, transparent 10%)' }} />}
    </div>
  );
}

/* ── Severity Badge — 支持 FATAL 级别 ── */
function SeverityBadge({ severity }: { severity: number }) {
  const label = severityLabel(severity);
  const cfg = {
    FATAL:    { bg: 'bg-gradient-to-r from-red-700 to-rose-500 text-white animate-pulse', glow: '0 0 20px rgba(239,68,68,0.8)' },
    CRITICAL: { bg: 'bg-gradient-to-r from-red-600 to-fuchsia-600 text-white', glow: '0 0 15px rgba(217,70,239,0.6)' },
    HIGH:     { bg: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black', glow: '0 0 15px rgba(251,191,36,0.6)' },
    MEDIUM:   { bg: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white', glow: '0 0 15px rgba(34,211,238,0.6)' },
    LOW:      { bg: 'bg-gradient-to-r from-slate-500 to-slate-400 text-white', glow: '0 0 10px rgba(100,116,139,0.4)' },
  }[label];
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded font-mono tracking-wider ${cfg.bg}`} style={{ boxShadow: cfg.glow }}>
      {label}
    </span>
  );
}

/* ── Tab Button ── */
function TabBtn({ label, icon, active, color, onClick }: { label: string; icon: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  const colors: Record<string, { activeBg: string; text: string; border: string }> = {
    cyan:   { activeBg: 'from-cyan-500/20 to-blue-500/20',   text: 'text-cyan-300',   border: 'border-cyan-400/50' },
    green:  { activeBg: 'from-green-500/20 to-emerald-500/20', text: 'text-green-300',  border: 'border-green-400/50' },
    yellow: { activeBg: 'from-yellow-500/20 to-amber-500/20',  text: 'text-yellow-300', border: 'border-yellow-400/50' },
  };
  const c = colors[color];
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded font-mono text-[11px] tracking-wider transition-all duration-300 cursor-pointer ${active ? `bg-gradient-to-r ${c.activeBg} ${c.text} border ${c.border}` : 'text-slate-400 hover:text-slate-200'}`}>
      {icon} {label}
    </button>
  );
}

/* ── Solution List ── */
function SolutionList({ items, color }: { items: Solution[]; color: 'cyan' | 'green' | 'yellow' }) {
  const cfg = {
    cyan:   { border: 'border-cyan-500/20 hover:border-cyan-400/60 hover:bg-cyan-500/5', icon: 'text-cyan-400', text: 'text-cyan-100', glow: '0 0 10px rgba(34,211,238,0.1)', iconGlow: 'drop-shadow(0 0 4px rgba(34,211,238,0.6))' },
    green:  { border: 'border-green-500/20 hover:border-green-400/60 hover:bg-green-500/5', icon: 'text-green-400', text: 'text-green-100', glow: '0 0 10px rgba(74,222,128,0.1)', iconGlow: 'drop-shadow(0 0 4px rgba(74,222,128,0.6))' },
    yellow: { border: 'border-yellow-500/20 hover:border-yellow-400/60 hover:bg-yellow-500/5', icon: 'text-yellow-400', text: 'text-yellow-100', glow: '0 0 10px rgba(250,204,21,0.1)', iconGlow: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))' },
  }[color];
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className={`flex items-start gap-3 p-3 bg-slate-800/30 rounded border ${cfg.border} transition-all duration-300`} style={{ boxShadow: cfg.glow }}>
          <CheckCircle2 className={`w-5 h-5 ${cfg.icon} mt-0.5 flex-shrink-0`} style={{ filter: cfg.iconGlow }} />
          <div className="flex-1">
            <p className={`text-sm ${cfg.text} font-medium leading-relaxed font-mono`}>{item.en}</p>
            <p className="text-xs text-slate-400 mt-1.5">{item.cn}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ label, color }: { label: string; color: 'cyan' | 'green' | 'yellow' }) {
  const cfg = {
    cyan:   { bar: 'bg-cyan-400', border: 'border-cyan-500/20', text: 'text-cyan-300', glow: '0 0 8px rgba(34,211,238,0.8)' },
    green:  { bar: 'bg-green-400', border: 'border-green-500/20', text: 'text-green-300', glow: '0 0 8px rgba(74,222,128,0.8)' },
    yellow: { bar: 'bg-yellow-400', border: 'border-yellow-500/20', text: 'text-yellow-300', glow: '0 0 8px rgba(250,204,21,0.8)' },
  }[color];
  return (
    <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${cfg.border}`}>
      <div className={`w-1 h-5 ${cfg.bar} rounded-full`} style={{ boxShadow: cfg.glow, animation: 'neon-pulse 2s ease-in-out infinite' }} />
      <p className={`text-sm ${cfg.text} font-medium font-mono tracking-wide`}>{label}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════
   MAIN COMPONENT — Context-Aware
   ════════════════════════════════════════════════ */
export default function DefectLab({
  onClose,
  material,
  vdi,
  assetId = 'LA26006',
}: {
  onClose: () => void;
  material: MaterialType;
  vdi: number;
  assetId?: string;
}) {
  const [selectedDefect, setSelectedDefect] = useState<DefectType | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('mold');

  // 动态数据工厂 — 每次 material/vdi 变化自动重算
  const defects = getDynamicDefects(material, vdi);
  const selectedData = defects.find(d => d.id === selectedDefect);

  // severity → progress bar color
  const barColor = (s: number) =>
    s >= 95 ? 'bg-gradient-to-r from-red-600 to-rose-400' :
    s >= 75 ? 'bg-gradient-to-r from-red-500 to-fuchsia-500' :
    s >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
    s >= 40 ? 'bg-gradient-to-r from-cyan-500 to-blue-500' :
    'bg-gradient-to-r from-slate-500 to-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-6">
      <style>{`
        @keyframes neon-pulse { 0%,100%{opacity:1;filter:brightness(1)} 50%{opacity:.8;filter:brightness(1.2)} }
        @keyframes chromatic-aberration { 0%,100%{text-shadow:-2px 0 red,2px 0 cyan} 50%{text-shadow:2px 0 red,-2px 0 cyan} }
        @keyframes glitch { 0%,100%{transform:translate(0)} 20%{transform:translate(-2px,2px)} 40%{transform:translate(-2px,-2px)} 60%{transform:translate(2px,2px)} 80%{transform:translate(2px,-2px)} }
        .glitch-active{animation:glitch .3s cubic-bezier(.25,.46,.45,.94) infinite}
      `}</style>

      <div className="relative w-[95vw] max-w-[1400px] bg-[#020510] text-slate-100 rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Circuit Board Background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.4) 1px, transparent 1px), radial-gradient(circle at 20% 50%, rgba(34,211,238,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(217,70,239,0.2) 0%, transparent 50%)', backgroundSize: '60px 60px, 60px 60px, 100% 100%, 100% 100%' }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)', backgroundSize: '100% 2px' }} />
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-red-500/20 hover:border-red-500/50 transition-all cursor-pointer">
          <X className="w-5 h-5 text-slate-400 hover:text-red-400" />
        </button>

        <div className="relative z-10 p-6">
          {/* Header — 显示当前上下文 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-white" style={{ animation: 'chromatic-aberration 3s ease-in-out infinite' }}>
              注塑诊所
            </h1>
            <div className="flex items-center gap-4">
              <p className="text-cyan-400/60 text-sm font-mono tracking-wider">INJECTION MOLDING DEFECT DIAGNOSTIC LAB</p>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                CTX: {material} · VDI {vdi}
              </span>
            </div>
          </div>

          {/* Split View */}
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Left: Specimen Grid */}
            <div className="lg:col-span-2">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-200 mb-1">虚拟缺陷样本库</h2>
                <p className="text-xs text-slate-500 font-mono">VIRTUAL SPECIMEN GRID</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {defects.map(d => {
                  const label = severityLabel(d.severity);
                  const isFatal = label === 'FATAL';
                  return (
                    <div
                      key={d.id}
                      onClick={() => { setSelectedDefect(d.id); setActiveTab('mold'); }}
                      className={`bg-slate-900/30 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:bg-slate-900/50 hover:scale-[1.02] border ${
                        selectedDefect === d.id ? 'border-cyan-400 scale-105 glitch-active'
                        : isFatal ? 'border-red-500/60'
                        : 'border-slate-700/30'
                      }`}
                      style={
                        selectedDefect === d.id ? { boxShadow: '0 0 25px rgba(34,211,238,0.6), inset 0 0 15px rgba(34,211,238,0.2)' }
                        : isFatal ? { boxShadow: '0 0 15px rgba(239,68,68,0.3), inset 0 0 10px rgba(239,68,68,0.1)' }
                        : undefined
                      }
                    >
                      <div className="flex flex-col items-center gap-3">
                        <DefectTexture id={d.id} active={selectedDefect === d.id} />
                        <div className="text-center">
                          <p className="text-xs font-mono text-slate-400 mb-0.5">{d.name}</p>
                          <p className={`text-sm font-medium ${isFatal ? 'text-red-400' : 'text-slate-200'}`}>{d.nameCN}</p>
                          {isFatal && <p className="text-[9px] font-mono text-red-500 mt-1 animate-pulse">⚠ FATAL RISK</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Resolution Console */}
            <div className="lg:col-span-3">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-200 mb-1">战术解决控制台</h2>
                <p className="text-xs text-slate-500 font-mono">RESOLUTION CONSOLE</p>
              </div>

              <div className="bg-slate-900/40 rounded-xl border border-blue-500/30 p-6 min-h-[600px]" style={{ boxShadow: '0 0 20px rgba(59,130,246,0.2), inset 0 0 30px rgba(59,130,246,0.05)' }}>
                {!selectedData ? (
                  <div className="flex items-center justify-center h-full min-h-[500px] relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-blue-500/20" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-blue-500/15" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-blue-500/10" />
                    </div>
                    <div className="text-center z-10">
                      <div className="mb-6 inline-block" style={{ animation: 'neon-pulse 2s ease-in-out infinite' }}>
                        <svg width="80" height="100" viewBox="0 0 80 100" className="text-cyan-400/30">
                          <rect x="15" y="10" width="50" height="70" rx="25" fill="none" stroke="currentColor" strokeWidth="2" />
                          <line x1="40" y1="10" x2="40" y2="35" stroke="currentColor" strokeWidth="2" />
                          <circle cx="40" cy="28" r="4" fill="currentColor" className="animate-pulse" />
                        </svg>
                      </div>
                      <p className="text-cyan-400/60 text-lg font-mono tracking-[0.3em] animate-pulse" style={{ animation: 'chromatic-aberration 3s ease-in-out infinite' }}>SYSTEM STANDBY</p>
                      <p className="text-fuchsia-400/40 text-sm font-mono mt-2 tracking-widest" style={{ animation: 'chromatic-aberration 3s ease-in-out infinite' }}>WAITING FOR SPECIMEN INPUT<span className="animate-pulse">_</span></p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Defect Header */}
                    <div className="border-b border-cyan-500/20 pb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-4xl font-bold text-cyan-300 mb-2 tracking-tight font-mono">{selectedData.name}</h3>
                          <p className="text-slate-200 text-base font-medium">
                            {selectedData.nameCN} / <span className="text-cyan-400/80">{selectedData.cause}</span>
                          </p>
                        </div>
                        <SeverityBadge severity={selectedData.severity} />
                      </div>
                      <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor(selectedData.severity)}`} style={{ width: `${selectedData.severity}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-1.5">SEVERITY: {selectedData.severity}/100 — {material} · VDI {vdi}</p>
                    </div>

                    {/* Tabs */}
                    <div className="grid grid-cols-3 bg-slate-900/50 p-1.5 gap-2 rounded-lg border border-slate-700/30">
                      <TabBtn label="MOLD ENGINEERING" icon={<Settings className="w-4 h-4" />} active={activeTab === 'mold'} color="cyan" onClick={() => setActiveTab('mold')} />
                      <TabBtn label="PROCESS TUNING" icon={<Thermometer className="w-4 h-4" />} active={activeTab === 'process'} color="green" onClick={() => setActiveTab('process')} />
                      <TabBtn label="MATERIAL SPEC" icon={<Package className="w-4 h-4" />} active={activeTab === 'material'} color="yellow" onClick={() => setActiveTab('material')} />
                    </div>

                    {activeTab === 'mold' && (<><SectionHeader label="模具层面的修改方案 / Mold-level modifications" color="cyan" /><SolutionList items={selectedData.mold} color="cyan" /></>)}
                    {activeTab === 'process' && (<><SectionHeader label="调机参数建议 / Process parameter adjustments" color="green" /><SolutionList items={selectedData.process} color="green" /></>)}
                    {activeTab === 'material' && (<><SectionHeader label="材料检查与建议 / Material inspection & recommendations" color="yellow" /><SolutionList items={selectedData.material} color="yellow" /></>)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <EmpiricalKnowledgeBase assetId={assetId} knowledgeRecords={mockKnowledgeRecords} />
          </div>
        </div>
      </div>
    </div>
  );
}
