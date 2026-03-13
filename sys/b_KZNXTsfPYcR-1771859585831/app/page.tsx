'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, AlertTriangle, Settings, Thermometer, Package } from 'lucide-react'

type DefectType = 'sink-mark' | 'flash' | 'short-shot' | 'burn-mark' | 'weld-line'

interface Solution {
  en: string
  cn: string
}

interface DefectData {
  id: DefectType
  name: string
  nameCN: string
  severity: number
  cause: string
  mold: Solution[]
  process: Solution[]
  material: Solution[]
}

const defects: DefectData[] = [
  {
    id: 'sink-mark',
    name: 'SINK MARK',
    nameCN: '缩水',
    severity: 75,
    cause: 'Volumetric shrinkage during cooling phase',
    mold: [
      { en: 'Reduce rib thickness to 60% of wall', cn: '减少加强筋厚度至壁厚的60%' },
      { en: 'Add venting slots at sink locations', cn: '在缩水位置增加排气槽' },
      { en: 'Increase gate size by 15-20%', cn: '增大浇口尺寸15-20%' },
      { en: 'Optimize cooling channel layout', cn: '优化冷却水路布局' }
    ],
    process: [
      { en: 'Increase pack pressure: +10-15%', cn: '提高保压压力：+10-15%' },
      { en: 'Extend holding time: +2-3s', cn: '延长保压时间：+2-3秒' },
      { en: 'Lower melt temperature: -5-10°C', cn: '降低料温：-5-10°C' },
      { en: 'Increase cooling time: +15%', cn: '增加冷却时间：+15%' }
    ],
    material: [
      { en: 'Check material drying time (80°C/4hrs)', cn: '检查材料干燥时间（80°C/4小时）' },
      { en: 'Verify melt flow index (MFI)', cn: '验证熔融指数（MFI）' },
      { en: 'Consider high-flow resin grade', cn: '考虑使用高流动性树脂牌号' }
    ]
  },
  {
    id: 'flash',
    name: 'FLASH',
    nameCN: '披锋',
    severity: 60,
    cause: 'Clamp force too low or parting line damage',
    mold: [
      { en: 'Check parting line flatness', cn: '检查分型面平整度' },
      { en: 'Inspect mold lock mechanism', cn: '检查模具锁模机构' },
      { en: 'Reduce venting depth to 0.02mm', cn: '减少排气深度至0.02mm' },
      { en: 'Polish parting surface', cn: '抛光分型面' }
    ],
    process: [
      { en: 'Reduce injection pressure: -5-10%', cn: '降低注射压力：-5-10%' },
      { en: 'Decrease injection speed', cn: '降低注射速度' },
      { en: 'Increase clamp force', cn: '增加锁模力' },
      { en: 'Lower melt temperature: -10°C', cn: '降低料温：-10°C' }
    ],
    material: [
      { en: 'Check viscosity at processing temp', cn: '检查加工温度下的粘度' },
      { en: 'Avoid over-drying material', cn: '避免过度干燥材料' },
      { en: 'Use higher viscosity grade', cn: '使用更高粘度牌号' }
    ]
  },
  {
    id: 'weld-line',
    name: 'WELD LINE',
    nameCN: '熔接线',
    severity: 55,
    cause: 'Flow fronts meeting when material is too cool',
    mold: [
      { en: 'Relocate gate closer to weld line', cn: '将浇口移至更靠近熔接线位置' },
      { en: 'Add overflow well at weld location', cn: '在熔接位置增加溢流井' },
      { en: 'Increase venting at merge point', cn: '在汇流点增加排气' },
      { en: 'Modify flow path geometry', cn: '修改流道几何形状' }
    ],
    process: [
      { en: 'Increase melt temperature: +10-15°C', cn: '提高料温：+10-15°C' },
      { en: 'Increase mold temperature: +5-10°C', cn: '提高模温：+5-10°C' },
      { en: 'Increase injection speed: +20%', cn: '提高注射速度：+20%' },
      { en: 'Optimize injection pressure profile', cn: '优化注射压力曲线' }
    ],
    material: [
      { en: 'Ensure proper material drying', cn: '确保材料充分干燥' },
      { en: 'Use higher flow grade resin', cn: '使用更高流动性树脂牌号' },
      { en: 'Check molecular weight distribution', cn: '检查分子量分布' }
    ]
  },
  {
    id: 'short-shot',
    name: 'SHORT SHOT',
    nameCN: '缺胶',
    severity: 85,
    cause: 'Insufficient material to fill cavity completely',
    mold: [
      { en: 'Enlarge gate and runner size', cn: '扩大浇口和流道尺寸' },
      { en: 'Improve venting system', cn: '改善排气系统' },
      { en: 'Check for cold slug wells', cn: '检查冷料井' },
      { en: 'Reduce flow length ratio', cn: '减少流长比' }
    ],
    process: [
      { en: 'Increase injection pressure: +15-20%', cn: '提高注射压力：+15-20%' },
      { en: 'Increase injection speed', cn: '提高注射速度' },
      { en: 'Increase melt temperature: +10-15°C', cn: '提高料温：+10-15°C' },
      { en: 'Extend injection time', cn: '延长注射时间' }
    ],
    material: [
      { en: 'Verify material flow properties', cn: '验证材料流动性能' },
      { en: 'Check for moisture contamination', cn: '检查水分污染' },
      { en: 'Use higher MFI grade', cn: '使用更高MFI牌号' },
      { en: 'Ensure consistent material feed', cn: '确保材料供给稳定' }
    ]
  },
  {
    id: 'burn-mark',
    name: 'BURN MARK',
    nameCN: '烧焦',
    severity: 70,
    cause: 'Poor venting causing gas trap and combustion',
    mold: [
      { en: 'Add deep vents at gas trap areas', cn: '在气体滞留区增加深排气槽' },
      { en: 'Reduce sharp corners (R > 0.5mm)', cn: '减少尖角（圆角半径 > 0.5mm）' },
      { en: 'Install vacuum venting system', cn: '安装真空排气系统' },
      { en: 'Check ejector pin clearance', cn: '检查顶针间隙' }
    ],
    process: [
      { en: 'Reduce injection speed: -15-20%', cn: '降低注射速度：-15-20%' },
      { en: 'Lower melt temperature: -10-15°C', cn: '降低料温：-10-15°C' },
      { en: 'Decrease back pressure', cn: '降低背压' },
      { en: 'Optimize fill time', cn: '优化充填时间' }
    ],
    material: [
      { en: 'Ensure complete material drying', cn: '确保材料完全干燥' },
      { en: 'Check for contamination', cn: '检查污染情况' },
      { en: 'Use thermal-stable additives', cn: '使用热稳定添加剂' },
      { en: 'Verify degradation temperature', cn: '验证降解温度' }
    ]
  }
]

export default function DefectLab() {
  const [selectedDefect, setSelectedDefect] = useState<DefectType | null>(null)

  const selectedData = defects.find(d => d.id === selectedDefect)

  return (
    <div className="min-h-screen bg-[#05080f] text-slate-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-balance !text-white">
          注塑缺陷数字诊断实验室
        </h1>
        <p className="text-slate-400 text-sm">
          INJECTION MOLDING DEFECT DIAGNOSTIC LAB
        </p>
      </div>

      {/* Split View Layout */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: Virtual Specimen Grid (40%) */}
        <div className="lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-200 mb-1">
              虚拟缺陷样本库
            </h2>
            <p className="text-xs text-slate-500">VIRTUAL SPECIMEN GRID</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {defects.map((defect) => (
              <Card
                key={defect.id}
                className={`bg-slate-900/50 border-slate-800 p-4 cursor-pointer transition-all hover:bg-slate-900/80 hover:scale-[1.02] ${
                  selectedDefect === defect.id
                    ? 'border-blue-500 ring-2 ring-blue-500/30 scale-105'
                    : ''
                }`}
                onClick={() => setSelectedDefect(defect.id)}
              >
                <div className="flex flex-col items-center gap-3">
                  {/* CSS Defect Simulation Box - 3D Physical Material */}
                  <div 
                    className="relative w-32 h-32 bg-slate-800 rounded-xl border border-slate-700/50 transition-transform duration-300"
                    style={{
                      boxShadow: 'inset 2px 2px 5px rgba(255,255,255,0.1), inset -4px -4px 10px rgba(0,0,0,0.6), 4px 4px 10px rgba(0,0,0,0.5)'
                    }}
                  >
                    {/* Sink Mark: extreme depression with heavy shadows */}
                    {defect.id === 'sink-mark' && (
                      <div
                        className="absolute inset-0 rounded-xl"
                        style={{
                          background:
                            'radial-gradient(circle at 45% 45%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 30%, rgba(15,15,20,0.2) 50%, transparent 70%)',
                          boxShadow: 'inset 10px 10px 20px rgba(0,0,0,0.5), inset -10px -10px 20px rgba(255,255,255,0.05)'
                        }}
                      />
                    )}

                    {/* Flash: glowing edge line - more prominent */}
                    {defect.id === 'flash' && (
                      <>
                        <div
                          className="absolute -right-1 top-6 bottom-6 w-1.5 bg-slate-300/90 rounded-full"
                          style={{
                            boxShadow: '0 0 12px rgba(255,255,255,0.9), 3px 3px 6px rgba(255,255,255,0.7)'
                          }}
                        />
                        <div
                          className="absolute left-6 -bottom-1 right-6 h-1 bg-slate-300/70 rounded-full"
                          style={{
                            boxShadow: '0 0 8px rgba(255,255,255,0.7)'
                          }}
                        />
                      </>
                    )}

                    {/* Short Shot: aggressive clipped corner with irregular edge */}
                    {defect.id === 'short-shot' && (
                      <div
                        className="absolute inset-0 bg-slate-800 rounded-xl"
                        style={{
                          clipPath: 'polygon(0 0, 100% 0, 100% 60%, 70% 100%, 0 100%)',
                          boxShadow: 'inset 1px 1px 3px rgba(255,255,255,0.08)'
                        }}
                      />
                    )}

                    {/* Burn Mark: dark blurry gradient - more intense */}
                    {defect.id === 'burn-mark' && (
                      <div
                        className="absolute top-0 right-0 w-16 h-16 rounded-tr-xl"
                        style={{
                          background:
                            'radial-gradient(circle at top right, rgba(10,5,0,0.95) 0%, rgba(30,15,5,0.8) 25%, rgba(50,25,10,0.5) 50%, transparent 75%)',
                          filter: 'blur(3px)'
                        }}
                      />
                    )}

                    {/* Weld Line: thin dark line with bright highlight for physical crease */}
                    {defect.id === 'weld-line' && (
                      <>
                        <div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-slate-950 -translate-x-1" />
                        <div
                          className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-slate-100/30 translate-x-0.5"
                          style={{
                            boxShadow: '1px 0 3px rgba(255,255,255,0.3), -1px 0 2px rgba(255,255,255,0.1)'
                          }}
                        />
                      </>
                    )}
                  </div>

                  {/* Label */}
                  <div className="text-center">
                    <p className="text-xs font-mono text-slate-400 mb-0.5">
                      {defect.name}
                    </p>
                    <p className="text-sm font-medium text-slate-200">
                      {defect.nameCN}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Right: Resolution Console (60%) */}
        <div className="lg:col-span-3">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-200 mb-1">
              战术解决控制台
            </h2>
            <p className="text-xs text-slate-500">RESOLUTION CONSOLE</p>
          </div>

          <Card className="bg-slate-900/50 border-slate-800 p-6 min-h-[600px]">
            {!selectedData ? (
              <div className="flex items-center justify-center h-full min-h-[500px] relative overflow-hidden">
                {/* Radar Grid Background */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                  }} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-blue-500/20" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-blue-500/15" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-blue-500/10" />
                </div>

                {/* Mouse Wireframe */}
                <div className="text-center z-10">
                  <div className="mb-6 inline-block">
                    <svg width="80" height="100" viewBox="0 0 80 100" className="text-blue-500/20">
                      <rect x="15" y="10" width="50" height="70" rx="25" fill="none" stroke="currentColor" strokeWidth="2" />
                      <line x1="40" y1="10" x2="40" y2="35" stroke="currentColor" strokeWidth="2" />
                      <circle cx="40" cy="28" r="4" fill="currentColor" className="animate-pulse" />
                    </svg>
                  </div>
                  <p className="text-blue-500/40 text-lg font-mono tracking-wider animate-pulse">
                    SYSTEM STANDBY
                  </p>
                  <p className="text-blue-500/30 text-sm font-mono mt-2 tracking-wide">
                    WAITING FOR SPECIMEN INPUT<span className="animate-pulse">_</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-3xl font-bold text-balance">
                        {selectedData.name} / {selectedData.nameCN}
                      </h3>
                      <p className="text-slate-200 text-sm mt-2 font-medium">
                        {selectedData.cause}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        selectedData.severity >= 75
                          ? 'border-red-500 text-red-400'
                          : selectedData.severity >= 60
                          ? 'border-yellow-500 text-yellow-400'
                          : 'border-blue-500 text-blue-400'
                      }`}
                    >
                      严重等级 {selectedData.severity}%
                    </Badge>
                  </div>
                  <Progress
                    value={selectedData.severity}
                    className="h-1"
                  />
                </div>

                {/* 3D Attribution Analysis Tabs */}
                <Tabs defaultValue="mold" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
                    <TabsTrigger value="mold" className="data-[state=active]:bg-slate-700">
                      <Settings className="w-4 h-4 mr-2" />
                      MOLD 模具
                    </TabsTrigger>
                    <TabsTrigger value="process" className="data-[state=active]:bg-slate-700">
                      <Thermometer className="w-4 h-4 mr-2" />
                      PROCESS 工艺
                    </TabsTrigger>
                    <TabsTrigger value="material" className="data-[state=active]:bg-slate-700">
                      <Package className="w-4 h-4 mr-2" />
                      MATERIAL 材料
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="mold" className="space-y-3 mt-4">
                    <p className="text-sm text-slate-400 mb-3">
                      模具层面的修改方案 / Mold-level modifications
                    </p>
                    {selectedData.mold.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-slate-800/30 rounded border border-slate-700/50"
                      >
                        <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-200">{item.en}</p>
                          <p className="text-xs text-slate-400 mt-1">{item.cn}</p>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="process" className="space-y-3 mt-4">
                    <p className="text-sm text-slate-400 mb-3">
                      调机参数建议 / Process parameter adjustments
                    </p>
                    {selectedData.process.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-slate-800/30 rounded border border-slate-700/50"
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-200">{item.en}</p>
                          <p className="text-xs text-slate-400 mt-1">{item.cn}</p>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="material" className="space-y-3 mt-4">
                    <p className="text-sm text-slate-400 mb-3">
                      材料检查与建议 / Material inspection & recommendations
                    </p>
                    {selectedData.material.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-slate-800/30 rounded border border-slate-700/50"
                      >
                        <CheckCircle2 className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-200">{item.en}</p>
                          <p className="text-xs text-slate-400 mt-1">{item.cn}</p>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
