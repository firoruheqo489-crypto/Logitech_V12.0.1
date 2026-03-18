/**
 * VDI 3400 动态工程计算器
 * 支持材质联动、实时计算、CSS 纹理模拟
 */
import { useState } from 'react';
import { Search, AlertTriangle, Zap, Fingerprint, Flame, ArrowLeft } from 'lucide-react';

/* ─── CSS Texture Swatch ─── */
function TextureSwatch({ vdi }: { vdi: number }) {
  const style: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 6, flexShrink: 0,
  };

  if (vdi <= 18) {
    // High Gloss — reflective gradient
    return (
      <div style={{
        ...style,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(148,187,233,0.7) 40%, rgba(255,255,255,0.95) 60%, rgba(180,210,240,0.6) 100%)',
        boxShadow: 'inset 0 0 8px rgba(255,255,255,0.4)',
      }} />
    );
  }

  if (vdi <= 30) {
    // Matte — subtle noise
    return (
      <div style={{
        ...style,
        backgroundColor: '#3a3f4a',
        filter: 'contrast(0.9)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='40' height='40' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E")`,
        backgroundSize: '40px 40px',
      }} />
    );
  }

  // Rough — heavy grain
  return (
    <div style={{
      ...style,
      backgroundColor: '#2a2d33',
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='r'%3E%3CfeTurbulence type='turbulence' baseFrequency='1.8' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='40' height='40' filter='url(%23r)' opacity='0.35'/%3E%3C/svg%3E")`,
      backgroundSize: '40px 40px',
      border: '1px solid rgba(255,255,255,0.08)',
    }} />
  );
}

/* ─── VDI Card ─── */
function VDICard({ data, getDynamicDraft, isCustom, onHover }: { data: VDIData; getDynamicDraft: (d: number) => { value: string; colorClass: string; isWarning: boolean }; isCustom?: boolean; onHover?: (vdi: number) => void }) {
  const draft = getDynamicDraft(data.draft);

  return (
    <div
      onMouseEnter={() => onHover?.(data.level)}
      className={`group relative overflow-hidden rounded-lg border p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg ${
      isCustom
        ? 'border-[#3b82f6]/60 bg-[#3b82f6]/[0.06] shadow-[0_0_24px_rgba(59,130,246,0.15)] hover:shadow-[#3b82f6]/25'
        : 'border-white/[0.08] bg-white/[0.03] backdrop-blur-sm hover:border-[#3b82f6]/50 hover:shadow-[#3b82f6]/10'
    }`}>
      {isCustom && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3b82f6]/20 border border-[#3b82f6]/40">
          <Zap className="w-3 h-3 text-[#60a5fa]" />
          <span className="text-[9px] font-semibold text-[#60a5fa] uppercase tracking-wider">Real-time Calculated</span>
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-5">
        {/* VDI Level + Texture Swatch */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#6E7681] mb-2 font-medium">VDI 等级</div>
            <div className="font-mono text-5xl font-bold bg-gradient-to-br from-white to-blue-200 bg-clip-text text-transparent">{data.level}</div>
          </div>
          <TextureSwatch vdi={data.level} />
        </div>

        {/* Ra */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6E7681] mb-1">Ra 粗糙度</div>
          <div className="font-mono text-xl font-semibold text-[#E6EDF3]">{data.ra} <span className="text-sm text-[#6E7681]">μm</span></div>
        </div>

        {/* Gloss */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6E7681] mb-2">预期光泽度</div>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="font-mono text-sm text-[#E6EDF3]">{data.glossRange[0]} - {data.glossRange[1]}</span>
            <span className="text-[10px] text-[#6E7681]">GU</span>
          </div>
          <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
              data.glossPercent > 70 ? 'bg-gradient-to-r from-blue-400 to-cyan-300'
              : data.glossPercent > 40 ? 'bg-gradient-to-r from-blue-500 to-blue-600'
              : 'bg-gradient-to-r from-blue-700 to-slate-600'
            }`} style={{ width: `${data.glossPercent}%` }} />
          </div>
        </div>

        {/* Draft Angle — dynamic with material */}
        <div className={`flex items-start gap-2 p-3 rounded-md border ${
          draft.isWarning ? 'bg-amber-500/10 border-amber-500/30' : 'bg-green-500/10 border-green-500/30'
        }`}>
          {draft.isWarning && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[#6E7681] mb-1">最小脱模斜度</div>
            <div className={`font-mono text-lg font-semibold ${draft.colorClass}`}>
              ≥ {draft.value}°
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Cross-Reference (static) ─── */
const crossReferenceData = [
  { vdi: 'VDI 12', standard: 'SPI A-3', description: '高光' },
  { vdi: 'VDI 24', standard: 'MT-11010', description: '细纹' },
  { vdi: 'VDI 30', standard: 'MT-11020', description: '中等皮纹' },
  { vdi: 'VDI 36', standard: 'MT-11050', description: '粗皮纹' },
];

/* ─── VDI Data ─── */
interface VDIData {
  level: number; ra: number; glossRange: [number, number];
  glossPercent: number; draft: number;
  textureClass: 'mirror' | 'high-gloss' | 'semi-matte' | 'matte' | 'rough';
  isCustom?: boolean;
}

const vdiData: VDIData[] = [
  { level: 12, ra: 0.4,  glossRange: [75, 95], glossPercent: 95, draft: 0.5, textureClass: 'mirror' },
  { level: 18, ra: 1.6,  glossRange: [40, 70], glossPercent: 75, draft: 1.5, textureClass: 'high-gloss' },
  { level: 24, ra: 3.2,  glossRange: [20, 40], glossPercent: 50, draft: 2.0, textureClass: 'semi-matte' },
  { level: 30, ra: 6.3,  glossRange: [10, 25], glossPercent: 30, draft: 3.0, textureClass: 'matte' },
  { level: 36, ra: 12.5, glossRange: [3, 10],  glossPercent: 10, draft: 4.0, textureClass: 'rough' },
];

/* ─── Interpolation helpers for custom VDI ─── */
function vdiToRa(vdi: number): number {
  return 0.1 * Math.pow(10, vdi / 20);
}

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

function interpolateFromVDI(vdi: number) {
  const pts = vdiData;
  if (vdi <= pts[0].level) return { glossRange: pts[0].glossRange, glossPercent: pts[0].glossPercent, draft: pts[0].draft };
  if (vdi >= pts[pts.length - 1].level) return { glossRange: pts[pts.length - 1].glossRange, glossPercent: pts[pts.length - 1].glossPercent, draft: pts[pts.length - 1].draft };
  let lo = pts[0], hi = pts[1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (vdi >= pts[i].level && vdi <= pts[i + 1].level) { lo = pts[i]; hi = pts[i + 1]; break; }
  }
  return {
    glossRange: [Math.round(lerp(vdi, lo.level, hi.level, lo.glossRange[0], hi.glossRange[0])), Math.round(lerp(vdi, lo.level, hi.level, lo.glossRange[1], hi.glossRange[1]))] as [number, number],
    glossPercent: Math.round(lerp(vdi, lo.level, hi.level, lo.glossPercent, hi.glossPercent)),
    draft: parseFloat(lerp(vdi, lo.level, hi.level, lo.draft, hi.draft).toFixed(1)),
  };
}

function classifyTexture(vdi: number): VDIData['textureClass'] {
  if (vdi <= 14) return 'mirror';
  if (vdi <= 20) return 'high-gloss';
  if (vdi <= 27) return 'semi-matte';
  if (vdi <= 33) return 'matte';
  return 'rough';
}

/* ─── Main Component ─── */
export type MaterialType = 'PC/ABS' | 'POM/PA' | 'PP/PE';

interface VDISurfaceGridProps {
  onClose: () => void;
  selectedMat: MaterialType;
  onMatChange: (m: MaterialType) => void;
  currentVDI: number;
  onVDIChange: (v: number) => void;
}

export default function VDISurfaceGrid({ onClose, selectedMat, onMatChange, currentVDI, onVDIChange }: VDISurfaceGridProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 定义材质全维度物理属性 (包含：拔模系数、主要风险、电极损耗预估、风险百分比)
  const materialMap = {
    'PC/ABS': {
      multiplier: 1.0,
      riskTitle: 'Drag Marks (拉伤/顶白)',
      riskDesc: '高抱紧力，需严格保证拔模角',
      electrodeWear: 'Normal',
      glossRiskPct: 85,
      textureRiskPct: 90,
    },
    'POM/PA': {
      multiplier: 0.85,
      riskTitle: 'Gas Burns (困气/烧焦)',
      riskDesc: '结晶速度快，需加强排气设计',
      electrodeWear: 'High',
      glossRiskPct: 60,
      textureRiskPct: 65,
    },
    'PP/PE': {
      multiplier: 0.6,
      riskTitle: 'Shrinkage (缩水/变形)',
      riskDesc: '收缩率极大，深纹理处易积料',
      electrodeWear: 'Low',
      glossRiskPct: 40,
      textureRiskPct: 30,
    },
  };

  // 2. 材质状态由父组件管理 (props: selectedMat / onMatChange)

  // 3. 动态计算引擎：根据基础斜率和材质系数，算出最终安全拔模角度
  const getDynamicDraft = (baseDraft: number) => {
    const calculated = (baseDraft * materialMap[selectedMat].multiplier).toFixed(1);
    const numVal = Number(calculated);
    // 物理报警阀值：如果换算后依然 >= 3.0度，显示橙色警示；低于 3.0度 显示绿色安全
    const isWarning = numVal >= 3.0;
    const colorClass = isWarning ? 'text-amber-500' : 'text-emerald-400';
    return { value: calculated, colorClass, isWarning };
  };

  // 4. VDI 数值由父组件管理 (props: currentVDI / onVDIChange)
  const hoveredVDI = currentVDI;
  const setHoveredVDI = onVDIChange;

  // 5. 核心物理引擎：根据 VDI 数值 + 材质联动计算加工成本和光学表现
  const getVDIImpact = (vdi: number, mat: keyof typeof materialMap) => {
    // 材质加工成本系数：POM/PA 结晶 + 排气设计增加成本；PP/PE 流动性好、成本较低
    const matCostFactor = mat === 'POM/PA' ? 1.25 : mat === 'PP/PE' ? 0.65 : 1.0;

    // EDM 时间基于 VDI 等级（模具端加工，材质仅间接影响）
    let edmTime: string, edmPct: number, baseCost: number, opt: string;
    let edmColorClass: string, edmBgClass: string;
    if (vdi <= 18) {
      edmTime = 'LOW'; edmPct = 20; baseCost = 0; opt = 'A';
      edmColorClass = 'text-emerald-400'; edmBgClass = 'bg-emerald-400';
    } else if (vdi <= 24) {
      edmTime = 'MEDIUM'; edmPct = 50; baseCost = 15; opt = 'A';
      edmColorClass = 'text-blue-400'; edmBgClass = 'bg-blue-400';
    } else if (vdi <= 30) {
      edmTime = 'HIGH'; edmPct = 80; baseCost = 30; opt = 'B';
      edmColorClass = 'text-amber-500'; edmBgClass = 'bg-amber-500';
    } else {
      edmTime = 'EXTREME'; edmPct = 100; baseCost = 50; opt = 'B';
      edmColorClass = 'text-red-500'; edmBgClass = 'bg-red-500';
    }

    // 成本 = VDI 基准 × 材质系数
    const cost = Math.round(baseCost * matCostFactor);
    const costStr = cost <= 0 ? 'BASE' : `+${cost}%`;
    const costPct = Math.min(100, Math.round(edmPct * matCostFactor));

    // 成本颜色（材质联动）
    let colorClass: string, bgClass: string;
    if (costPct <= 20) { colorClass = 'text-emerald-400'; bgClass = 'bg-emerald-400'; }
    else if (costPct <= 50) { colorClass = 'text-blue-400'; bgClass = 'bg-blue-400'; }
    else if (costPct <= 80) { colorClass = 'text-amber-500'; bgClass = 'bg-amber-500'; }
    else { colorClass = 'text-red-500'; bgClass = 'bg-red-500'; }

    return { edmTime, edmPct, edmColorClass, edmBgClass, costStr, costPct, colorClass, bgClass, opt };
  };

  const impact = getVDIImpact(hoveredVDI, selectedMat);

  // Custom card from search input
  const customCard = (() => {
    const num = parseFloat(searchTerm);
    if (isNaN(num) || num < 1 || num > 50) return null;
    if (vdiData.some(d => d.level === num)) return null;
    const ra = parseFloat(vdiToRa(num).toFixed(2));
    const interp = interpolateFromVDI(num);
    return {
      level: num, ra,
      glossRange: interp.glossRange,
      glossPercent: interp.glossPercent,
      draft: interp.draft,
      textureClass: classifyTexture(num),
      isCustom: true,
    } as VDIData;
  })();

  return (
    <div className="fixed inset-0 z-[9998] bg-[#0B0F14] overflow-y-auto">
      <div className="p-6 md:p-12 text-white">
        {/* Header */}
        <header className="max-w-7xl mx-auto mb-10">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
                VDI 3400 表面物理特征对照库
              </h1>
              <p className="text-sm text-[#6E7681]">基于 Ra 粗糙度与脱模斜度的安全阈值参考 · 动态工程计算器</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:border-[#3b82f6]/40 hover:bg-[#3b82f6]/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                返回项目
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              {/* Search — dynamic calculator */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E7681]" />
                <input type="text" placeholder="输入任意 VDI 数值实时计算 (如 27, 33)..." value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#3b82f6]/40 transition-all" />
                {customCard && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3b82f6]/15 border border-[#3b82f6]/30">
                    <Zap className="w-3 h-3 text-[#60a5fa]" />
                    <span className="text-[10px] text-[#60a5fa] font-medium">Ra ≈ {customCard.ra} μm</span>
                  </div>
                )}
              </div>

              {/* Material Selector */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] text-[#6E7681]">全局材质参照器</div>
                <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                  {(['PC/ABS', 'POM/PA', 'PP/PE'] as const).map(m => (
                    <button key={m} onClick={() => onMatChange(m)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
                        selectedMat === m
                          ? 'bg-slate-800 text-[#60a5fa]'
                          : 'bg-transparent text-[#6E7681] hover:text-[#E6EDF3]'
                      }`}>{m}</button>
                  ))}
                </div>
                <div className="text-[10px] text-[#3b82f6]/60">当前拔模斜度基于 {selectedMat} 收缩率计算的参照值</div>
              </div>
            </div>
          </div>
        </header>

        {/* Cards Grid */}
        <div className="max-w-7xl mx-auto mb-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {customCard && (
              <div onMouseEnter={() => setHoveredVDI(customCard.level)} onClick={() => setHoveredVDI(customCard.level)}>
                <VDICard data={customCard} getDynamicDraft={getDynamicDraft} isCustom onHover={setHoveredVDI} />
              </div>
            )}
            {vdiData.map(item => (
              <div key={item.level} onMouseEnter={() => setHoveredVDI(item.level)} onClick={() => setHoveredVDI(item.level)}>
                <VDICard data={item} getDynamicDraft={getDynamicDraft} onHover={setHoveredVDI} />
              </div>
            ))}
          </div>
        </div>

        {/* Engineering Console (static reference) */}
        <div className="max-w-7xl mx-auto">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-800/50 to-transparent mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cross-Reference Matrix */}
            <div className="rounded-lg border border-white/[0.06] bg-[#0B0F14] p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Industry Standard Mapping</h3>
              <p className="text-[10px] text-[#6E7681] mb-5">国际纹理标准换算矩阵</p>
              <div className="space-y-0.5">
                {crossReferenceData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-3 px-3 rounded-md hover:bg-white/[0.03] transition-all">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="font-mono text-xs text-slate-400 min-w-[60px]">{item.vdi}</span>
                      <div className="h-px flex-1 bg-gradient-to-r from-slate-700/50 to-transparent" />
                      <span className="font-mono text-xs text-[#60a5fa]/80 min-w-[80px] text-right">{item.standard}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 ml-4 min-w-[70px] text-right">({item.description})</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Formula */}
            <div className="rounded-lg border border-white/[0.06] bg-[#0B0F14] p-6 flex flex-col">
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Calculation Anchor</h3>
              <p className="text-[10px] text-[#6E7681] mb-8">物理运算基准</p>
              <div className="flex-1 flex items-center justify-center py-8">
                <div className="relative">
                  <div className="absolute inset-0 blur-xl bg-[#3b82f6]/20 animate-pulse" />
                  <div className="relative font-mono text-2xl md:text-3xl font-bold text-[#60a5fa]" style={{ textShadow: '0 0 8px rgba(96,165,250,0.5)' }}>
                    VDI = 20 × log₁₀(10 × Ra)
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-6 border-t border-white/[0.04]">
                <p className="text-[10px] leading-relaxed text-slate-600">
                  * 预估光泽度基于 60° 测量角。拔模斜度补偿系数 K=1.2 (PC基准)。
                  模具实际表面反光率受钢材纯度 (如 S136 / NAK80) 影响。
                  本参照库数据仅供工程预估使用，实际加工参数需结合生产环境校准。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Process & Risk Intelligence Section ─── */}
        <div className="w-full bg-transparent mt-10 relative">
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent to-white/[0.02] pointer-events-none" />
          <div className="h-px bg-gradient-to-r from-transparent via-slate-700/40 to-transparent" />
          <div className="max-w-7xl mx-auto px-6 py-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left: Process Risk Map — material-aware */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-0.5">Process Risk Map</h3>
                <p className="text-[10px] text-[#6E7681] mb-5">常见缺陷雷达 · {selectedMat}</p>

                <div className="space-y-4">
                  {/* Material-specific Risk */}
                  <div className={`p-3 rounded-md border ${
                    selectedMat === 'POM/PA' ? 'bg-orange-500/[0.06] border-orange-500/20'
                    : selectedMat === 'PP/PE' ? 'bg-violet-500/[0.06] border-violet-500/20'
                    : 'bg-red-500/[0.06] border-red-500/20'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className={`w-3.5 h-3.5 ${
                        selectedMat === 'POM/PA' ? 'text-orange-400'
                        : selectedMat === 'PP/PE' ? 'text-violet-400'
                        : 'text-red-400'
                      }`} />
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                        selectedMat === 'POM/PA' ? 'text-orange-400'
                        : selectedMat === 'PP/PE' ? 'text-violet-400'
                        : 'text-red-400'
                      }`}>{selectedMat} · Primary Risk</span>
                    </div>
                    <p className={`text-xs font-mono mb-1.5 ${
                      selectedMat === 'POM/PA' ? 'text-orange-300/90'
                      : selectedMat === 'PP/PE' ? 'text-violet-300/90'
                      : 'text-red-300/90'
                    }`}>{materialMap[selectedMat].riskTitle}</p>
                    <p className="text-[10px] text-slate-500">{materialMap[selectedMat].riskDesc}</p>
                  </div>

                  {/* High Gloss Risk */}
                  <div className="p-3 rounded-md bg-red-500/[0.06] border border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Fingerprint className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">VDI 12–24 · High Gloss Zone</span>
                    </div>
                    <p className="text-xs text-red-300/90 font-mono mb-1.5">Flow Lines & Scratches</p>
                    <div className="w-full h-1 bg-red-900/30 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500" style={{ width: `${materialMap[selectedMat].glossRiskPct}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">Risk: {materialMap[selectedMat].glossRiskPct}% — 流痕 / 划伤</p>
                  </div>

                  {/* Texture Risk */}
                  <div className="p-3 rounded-md bg-amber-500/[0.06] border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">VDI 30–36 · Texture Zone</span>
                    </div>
                    <p className="text-xs text-amber-300/90 font-mono mb-1.5">Drag Marks & Stress Whitening</p>
                    <div className="w-full h-1 bg-amber-900/30 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500" style={{ width: `${materialMap[selectedMat].textureRiskPct}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">Risk: {materialMap[selectedMat].textureRiskPct}% — 拉伤 / 顶白</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
                  高光面需高模温以掩盖熔接线；粗纹面需加大拔模角防止拉伤。
                </p>
              </div>

              {/* Center: Manufacturing Impact — driven by hoveredVDI */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-0.5">Manufacturing Impact</h3>
                <p className="text-[10px] text-[#6E7681] mb-5">加工成本估算 · VDI {hoveredVDI} · {selectedMat}</p>

                <div className="space-y-4">
                  {/* EDM Time */}
                  <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">EDM Time</span>
                      <span className={`font-mono text-sm font-semibold ${impact.edmColorClass}`}>{impact.edmTime}</span>
                    </div>
                    {/* EDM TIME 进度条 */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-3">
                      <div
                        className={`h-full transition-all duration-500 ${impact.edmBgClass}`}
                        style={{ width: `${impact.edmPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5">深纹路需更长放电加工时间</p>
                  </div>

                  {/* Cost Factor */}
                  <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Cost Factor</span>
                      <span className={`font-mono text-sm font-semibold ${impact.colorClass}`}>{impact.costStr}</span>
                    </div>
                    {/* COST FACTOR 进度条 */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-3">
                      <div
                        className={`h-full transition-all duration-500 ${impact.bgClass}`}
                        style={{ width: `${impact.costPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5">电极损耗与工时增加</p>
                  </div>

                  {/* Electrode Wear — material-aware */}
                  <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Electrode Wear · {selectedMat}</span>
                      <span className={`font-mono text-sm font-semibold ${
                        materialMap[selectedMat].electrodeWear === 'High' ? 'text-red-400'
                        : materialMap[selectedMat].electrodeWear === 'Low' ? 'text-emerald-400'
                        : 'text-slate-400'
                      }`}>
                        {materialMap[selectedMat].electrodeWear === 'High' ? 'HIGH' : materialMap[selectedMat].electrodeWear === 'Low' ? 'LOW' : 'NORMAL'}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${
                        materialMap[selectedMat].electrodeWear === 'High' ? 'w-[85%] bg-red-500'
                        : materialMap[selectedMat].electrodeWear === 'Low' ? 'w-[20%] bg-emerald-500'
                        : 'w-[45%] bg-slate-500'
                      }`} />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5">铜公/石墨电极消耗率</p>
                  </div>
                </div>
              </div>

              {/* Right: Optical Behavior */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-0.5">Optical Behavior</h3>
                <p className="text-[10px] text-[#6E7681] mb-5">光学物理图解</p>

                <div className="space-y-5">
                  {/* Specular Reflection — VDI 12 */}
                  {/* 图A 动态高亮外框 */}
                  <div className={`p-4 rounded-xl border transition-all duration-500 ${
                    impact.opt === 'A'
                      ? 'opacity-100 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                      : 'opacity-30 border-slate-800'
                  }`}>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">A · Specular Reflection — VDI ≤24</div>
                    <svg viewBox="0 0 200 80" className="w-full h-auto" aria-label="Specular reflection diagram">
                      <line x1="20" y1="55" x2="180" y2="55" stroke="#334155" strokeWidth="2" />
                      <line x1="60" y1="15" x2="100" y2="55" stroke="#60a5fa" strokeWidth="1.5" />
                      <polygon points="62,18 56,12 68,14" fill="#60a5fa" />
                      <line x1="100" y1="55" x2="140" y2="15" stroke="#60a5fa" strokeWidth="1.5" />
                      <polygon points="138,18 144,12 132,14" fill="#60a5fa" />
                      <line x1="100" y1="10" x2="100" y2="55" stroke="#475569" strokeWidth="0.5" strokeDasharray="3,3" />
                      <path d="M 100 40 Q 90 42 88 48" fill="none" stroke="#475569" strokeWidth="0.5" />
                      <path d="M 100 40 Q 110 42 112 48" fill="none" stroke="#475569" strokeWidth="0.5" />
                      <text x="78" y="44" fill="#6E7681" fontSize="7" fontFamily="monospace">θi</text>
                      <text x="114" y="44" fill="#6E7681" fontSize="7" fontFamily="monospace">θr</text>
                      <text x="100" y="73" fill="#475569" fontSize="7" fontFamily="monospace" textAnchor="middle">θi = θr (Mirror)</text>
                    </svg>
                  </div>

                  {/* Diffuse Reflection — VDI 30+ */}
                  {/* 图B 动态高亮外框 */}
                  <div className={`p-4 rounded-xl border transition-all duration-500 ${
                    impact.opt === 'B'
                      ? 'opacity-100 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                      : 'opacity-30 border-slate-800'
                  }`}>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">B · Diffuse Reflection — VDI 30+</div>
                    <svg viewBox="0 0 200 80" className="w-full h-auto" aria-label="Diffuse reflection diagram">
                      <polyline points="20,55 40,55 50,52 60,56 70,53 80,55 90,52 100,56 110,53 120,55 130,52 140,56 150,53 160,55 180,55" fill="none" stroke="#334155" strokeWidth="2" />
                      <line x1="60" y1="15" x2="100" y2="53" stroke="#60a5fa" strokeWidth="1.5" />
                      <polygon points="62,18 56,12 68,14" fill="#60a5fa" />
                      <line x1="100" y1="53" x2="130" y2="18" stroke="#f59e0b" strokeWidth="1" opacity="0.7" />
                      <polygon points="128,21 134,15 122,17" fill="#f59e0b" opacity="0.7" />
                      <line x1="100" y1="53" x2="100" y2="12" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
                      <polygon points="97,15 103,15 100,8" fill="#f59e0b" opacity="0.5" />
                      <line x1="100" y1="53" x2="70" y2="22" stroke="#f59e0b" strokeWidth="1" opacity="0.4" />
                      <polygon points="72,25 66,19 78,21" fill="#f59e0b" opacity="0.4" />
                      <text x="100" y="73" fill="#475569" fontSize="7" fontFamily="monospace" textAnchor="middle">Multi-angle scatter (Matte)</text>
                    </svg>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
                  Roughness &gt; 1.6μm triggers diffuse reflection (Matte effect).
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* ─── Heavy Data Deck — 粗糙度与光泽度耦合机制 ─── */}
        <div className="w-full mt-12 border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto">
            <div className="bg-[#0B0F14] rounded-b-2xl grid grid-cols-1 md:grid-cols-3 py-10 px-6">

              {/* Left: [01] + [02] + [03] 全部堆叠 */}
              <div className="space-y-6 py-4 md:py-0 md:pr-8 md:border-r md:border-slate-800/60">
                {/* 01 */}
                <div className="space-y-3">
                  <p className="text-sm text-blue-400 font-bold uppercase tracking-widest font-mono">[01] Topological Causality</p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    粗糙度 (Ra) 是物理拓扑的<span className="text-white font-medium">因</span>，光泽度 (Gloss) 是光学漫反射的<span className="text-white font-medium">果</span>。
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    微观几何起伏直接切断光束的定向反射。当 Ra 大于可见光波长 (&gt;0.7μm) 时，定向光束被多向打散，强制触发宏观哑光效应。
                  </p>
                  <div className="p-3 rounded-lg bg-blue-500/[0.08] border border-blue-500/20">
                    <p className="text-xs text-blue-300 font-mono">
                      Critical Threshold: Ra &gt; 0.4μm (VDI 12) triggers light scattering.
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-5" />

                {/* 02 */}
                <div className="space-y-3">
                  <p className="text-sm text-emerald-400 font-bold uppercase tracking-widest font-mono">[02] Material Correction</p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    即使模具钢材 Ra 完全一致，受菲涅尔方程 (Fresnel Equations) 限制，高折射率树脂的本征反射率必然高于低折射率材料。
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    微观 Ra 支配光泽度数值高低；宏观波纹度 Wa 支配反射影像的扭曲度 (即橘皮缺陷)。两者在视觉上极易混淆。
                  </p>
                  <div className="w-full border-t border-slate-700 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">PC (Polycarbonate)</span>
                      <span className="font-mono text-xs text-emerald-400">n = 1.58 <span className="text-slate-500">High Natural Gloss</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">PP (Polypropylene)</span>
                      <span className="font-mono text-xs text-slate-400">n = 1.49 <span className="text-slate-500">Low Natural Gloss</span></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">PMMA (Acrylic)</span>
                      <span className="font-mono text-xs text-blue-400">n = 1.49 <span className="text-slate-500">Optical Grade</span></span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-5" />

                {/* 03 — 从中列移入左列 */}
                <div className="space-y-3">
                  <p className="text-sm text-amber-400 font-bold uppercase tracking-widest font-mono">[03] Gloss Decay Matrix</p>
                  <div className="bg-slate-900/80 p-4 rounded-lg">
                    <p className="font-mono text-sm text-blue-400/80 text-center leading-relaxed">
                      Gloss ≈ Gloss₀ · exp(-(4π·Ra·cosθ / λ)²)
                    </p>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    光泽度随粗糙度增加呈指数级暴跌。测定高 Ra 哑面时，必须将仪器入射角 θ 切换至 85°，利用微小余弦值抵抗指数衰减以获取有效读数。
                  </p>
                  <div className="w-full border-t border-slate-700 pt-3">
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="border-b border-slate-800/60">
                          <td className="py-1.5 font-mono text-slate-400">VDI 12 <span className="text-slate-600">(Ra 0.4)</span></td>
                          <td className="py-1.5 font-mono text-blue-400 text-right">~ 95 GU <span className="text-slate-500">Mirror</span></td>
                        </tr>
                        <tr className="border-b border-slate-800/60">
                          <td className="py-1.5 font-mono text-slate-400">VDI 24 <span className="text-slate-600">(Ra 1.6)</span></td>
                          <td className="py-1.5 font-mono text-amber-400 text-right">~ 35 GU <span className="text-slate-500">Satin</span></td>
                        </tr>
                        <tr>
                          <td className="py-1.5 font-mono text-slate-400">VDI 30 <span className="text-slate-600">(Ra 3.2)</span></td>
                          <td className="py-1.5 font-mono text-red-400 text-right">~ 8 GU <span className="text-slate-500">Matte</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= 全装甲版指数灾难曲线 (SVG V4.0) — 占 2 列 ================= */}
              <div className="py-4 md:py-0 md:pl-8 md:col-span-2 flex flex-col h-full">
                <div className="flex-1 w-full p-6 bg-[#080c14] rounded-lg border border-slate-800/80 relative overflow-hidden shadow-inner flex flex-col min-h-0">
                  {/* 标题栏 */}
                  <div className="flex justify-between items-end mb-2 shrink-0">
                    <div>
                      <h4 className="text-[13px] text-slate-300 font-bold tracking-wider">NON-LINEAR DEPTH CLIFF</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Ra doubles every ~6 VDI points after V30</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                      <span className="text-[10px] text-red-400 font-mono">EXPONENTIAL ZONE DETECTED</span>
                    </div>
                  </div>

                  {/* SVG V4.0 */}
                  <svg viewBox="-45 -18 440 218" className="w-full flex-1 min-h-0 overflow-visible cursor-crosshair" preserveAspectRatio="xMidYMid meet" aria-label="VDI exponential roughness curve V4.0">
                    <defs>
                      <linearGradient id="curve-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="40%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                      <linearGradient id="danger-bg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(239,68,68,0.10)" />
                        <stop offset="100%" stopColor="rgba(239,68,68,0.02)" />
                      </linearGradient>
                      <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="2" height="6" fill="rgba(239,68,68,0.07)"></rect>
                      </pattern>
                      <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(59,130,246,0.20)" />
                        <stop offset="100%" stopColor="rgba(59,130,246,0.02)" />
                      </linearGradient>
                    </defs>

                    {/*
                      画布: X 0→360, Y 0(顶)→160(底)
                      Y 轴对数映射:
                        Ra 0.4  → y=155
                        Ra 1.6  → y=135
                        Ra 3.2  → y=105
                        Ra 6.3  → y=58
                        Ra 12.5 → y=8
                    */}

                    {/* 危险区背景已移除 */}

                    {/* 工程网格线 */}
                    <g stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3">
                      <line x1="0" y1="135" x2="370" y2="135" />
                      <line x1="0" y1="105" x2="370" y2="105" />
                      <line x1="0" y1="58" x2="370" y2="58" opacity="0.7" />
                      <line x1="0" y1="8" x2="370" y2="8" opacity="0.5" />
                      <line x1="60" y1="-5" x2="60" y2="160" opacity="0.3" />
                      <line x1="120" y1="-5" x2="120" y2="160" />
                      <line x1="180" y1="-5" x2="180" y2="160" opacity="0.7" />
                      <line x1="240" y1="-5" x2="240" y2="160" opacity="0.5" />
                      <line x1="360" y1="-5" x2="360" y2="160" opacity="0.3" />
                    </g>

                    {/* 坐标轴 */}
                    <line x1="0" y1="160" x2="375" y2="160" stroke="#475569" strokeWidth="1.2" />
                    <line x1="0" y1="165" x2="0" y2="-10" stroke="#475569" strokeWidth="1.2" />
                    <polygon points="375,157 375,163 383,160" fill="#475569" />
                    <polygon points="-3,-10 3,-10 0,-16" fill="#475569" />

                    {/* Y 轴标签 — 水平放置在 SAFE 上方空白区 */}
                    <text x="60" y="-22" fill="#64748b" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">Ra (μm)</text>
                    <g fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="end">
                      <text x="-8" y="159">0.4</text>
                      <text x="-8" y="139">1.6</text>
                      <text x="-8" y="109">3.2</text>
                      <text x="-8" y="62" fill="#ef4444" fontWeight="bold">6.3</text>
                      <text x="-8" y="12" fill="#ef4444" fontWeight="bold">12.5</text>
                    </g>

                    {/* 区域标注 — 贴在 X 轴上方，不和数据点冲突 */}
                    <text x="60" y="-5" fill="#3b82f6" fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.5">SAFE</text>
                    <text x="210" y="-5" fill="#f59e0b" fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.6">WARNING</text>
                    <text x="330" y="-5" fill="#ef4444" fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.7">DANGER</text>

                    {/* 曲线下方面积填充 — 加深可见度 */}
                    <path
                      d="M 0,155 C 30,154 50,148 60,144 C 80,138 100,136 120,135 C 145,130 165,118 180,105 Q 200,82 240,58 Q 280,28 360,8 L 360,160 L 0,160 Z"
                      fill="url(#area-grad)"
                    />

                    {/* 核心曲线 — V30 后陡峭化 */}
                    <path
                      d="M 0,155 C 30,154 50,148 60,144 C 80,138 100,136 120,135 C 145,130 165,118 180,105 Q 200,82 240,58 Q 280,28 360,8"
                      fill="none"
                      stroke="url(#curve-grad)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]"
                    />

                    {/* 拐点辅助虚线 */}
                    <line x1="180" y1="105" x2="180" y2="160" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" opacity="0.8" />
                    <line x1="240" y1="58" x2="240" y2="160" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" opacity="0.8" />

                    {/* 数据锚点 + X 轴标签 */}
                    <g fontFamily="monospace" textAnchor="middle">
                      {/* V12 */}
                      <circle cx="0" cy="155" r="4" fill="#3b82f6" className="animate-pulse" />
                      <text x="0" y="178" fill="#64748b" fontSize="10">V12</text>
                      <text x="0" y="189" fill="#64748b" fontSize="8" opacity="0.6">(0.4μm)</text>

                      {/* V18 */}
                      <circle cx="60" cy="144" r="3" fill="#3b82f6" opacity="0.6" />
                      <text x="60" y="178" fill="#64748b" fontSize="10" opacity="0.5">V18</text>

                      {/* V24 */}
                      <circle cx="120" cy="135" r="4.5" fill="#3b82f6" stroke="#0f172a" strokeWidth="1" />
                      <text x="120" y="178" fill="#64748b" fontSize="10">V24</text>
                      <text x="120" y="189" fill="#64748b" fontSize="8" opacity="0.6">(1.6μm)</text>

                      {/* V30 — 拐点 */}
                      <circle cx="180" cy="105" r="5.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" className="drop-shadow-[0_0_6px_rgba(245,158,11,0.9)]" />
                      <text x="180" y="178" fill="#f59e0b" fontSize="11" fontWeight="bold">V30</text>
                      <text x="180" y="189" fill="#f59e0b" fontSize="8" opacity="0.8">(Ra 3.2)</text>

                      {/* V36 — 危险 */}
                      <circle cx="240" cy="58" r="6" fill="#ef4444" stroke="#0f172a" strokeWidth="1.5" className="drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]" />
                      <text x="240" y="178" fill="#ef4444" fontSize="11" fontWeight="bold">V36</text>
                      <text x="240" y="189" fill="#ef4444" fontSize="8" opacity="0.8">(Ra 6.3)</text>

                      {/* V42 — 极限 (标签放在圆点左下方，避开 DANGER) */}
                      <circle cx="360" cy="8" r="7" fill="#ef4444" stroke="#0f172a" strokeWidth="2" className="drop-shadow-[0_0_14px_rgba(239,68,68,1)]" />
                      <text x="360" y="178" fill="#ef4444" fontSize="11" fontWeight="bold">V42</text>
                      <text x="360" y="189" fill="#ef4444" fontSize="8" opacity="0.8">(Ra 12.5)</text>
                    </g>

                    {/* X 轴标题 */}
                    <text x="185" y="210" fill="#64748b" fontSize="10" fontFamily="monospace" textAnchor="middle">VDI 3400 SURFACE FINISH LEVEL</text>
                  </svg>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
