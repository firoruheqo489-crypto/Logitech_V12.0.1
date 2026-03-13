'use client'

import { useState } from 'react'
import { Search, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'

interface VDIData {
  vdi: number
  ra: number
  glossRange: [number, number]
  glossPercent: number
  draftAngle: number
  textureClass: 'mirror' | 'high-gloss' | 'semi-matte' | 'matte' | 'rough'
}

const vdiData: VDIData[] = [
  {
    vdi: 12,
    ra: 0.4,
    glossRange: [75, 95],
    glossPercent: 95,
    draftAngle: 0.5,
    textureClass: 'mirror'
  },
  {
    vdi: 18,
    ra: 1.6,
    glossRange: [40, 70],
    glossPercent: 75,
    draftAngle: 1.5,
    textureClass: 'high-gloss'
  },
  {
    vdi: 24,
    ra: 3.2,
    glossRange: [20, 40],
    glossPercent: 50,
    draftAngle: 2.0,
    textureClass: 'semi-matte'
  },
  {
    vdi: 30,
    ra: 6.3,
    glossRange: [10, 25],
    glossPercent: 30,
    draftAngle: 3.0,
    textureClass: 'matte'
  },
  {
    vdi: 36,
    ra: 12.5,
    glossRange: [3, 10],
    glossPercent: 10,
    draftAngle: 4.0,
    textureClass: 'rough'
  }
]

const getTextureStyle = (textureClass: string): string => {
  switch (textureClass) {
    case 'mirror':
      return 'vdi-mirror'
    case 'high-gloss':
      return 'vdi-high-gloss'
    case 'semi-matte':
      return 'vdi-semi-matte'
    case 'matte':
      return 'vdi-matte'
    case 'rough':
      return 'vdi-rough'
    default:
      return ''
  }
}

export function VDISurfaceGrid() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState<'PC/ABS' | 'POM/PA' | 'PP/PE'>('PC/ABS')

  const filteredData = vdiData.filter(item =>
    item.vdi.toString().includes(searchTerm)
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f16] via-[#0d1117] to-[#0f172a] text-white p-6 md:p-12">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-12">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-balance mb-3 bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
              VDI 3400 表面物理特征对照库
            </h1>
            <p className="text-lg text-muted-foreground text-pretty">
              基于 Ra 粗糙度与脱模斜度的安全阈值参考
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="输入 VDI 数值搜索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card/50 border-border/50 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Material Selector */}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-muted-foreground">全局材质参照器</div>
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-card/30 border border-border/50 backdrop-blur-sm">
                {(['PC/ABS', 'POM/PA', 'PP/PE'] as const).map((material) => (
                  <button
                    key={material}
                    onClick={() => setSelectedMaterial(material)}
                    className={`
                      relative px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
                      ${selectedMaterial === material
                        ? 'bg-primary/20 text-primary shadow-lg shadow-primary/20 border border-primary/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      }
                    `}
                  >
                    {material}
                    {selectedMaterial === material && (
                      <div className="absolute inset-0 rounded-md bg-primary/10 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-primary/60 max-w-xs">
                当前拔模斜度基于 {selectedMaterial} 收缩率计算的参照值
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Interactive Data Cards Grid */}
      <div className="max-w-7xl mx-auto mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {filteredData.map((item) => (
            <VDICard key={item.vdi} data={item} />
          ))}
        </div>
        
        {filteredData.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">未找到匹配的 VDI 等级</p>
          </div>
        )}
      </div>

      {/* Engineering Reference Console */}
      <EngineeringConsole />
    </div>
  )
}

function VDICard({ data }: { data: VDIData }) {
  const isWarning = data.draftAngle >= 3.0

  return (
    <div
      className={`
        group relative overflow-hidden rounded-lg border border-border/50 
        bg-card/40 backdrop-blur-sm p-6 
        transition-all duration-300 ease-out
        hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10
        ${getTextureStyle(data.textureClass)}
      `}
    >
      {/* Texture Background Overlay */}
      <div className="absolute inset-0 opacity-30 pointer-events-none texture-overlay" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col gap-5">
        {/* VDI Number */}
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">
            VDI 等级
          </div>
          <div className="font-mono text-6xl font-bold bg-gradient-to-br from-white to-blue-200 bg-clip-text text-transparent">
            {data.vdi}
          </div>
        </div>

        {/* Ra Roughness */}
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Ra 粗糙度
          </div>
          <div className="font-mono text-2xl font-semibold text-foreground">
            {data.ra} <span className="text-base text-muted-foreground">μm</span>
          </div>
        </div>

        {/* Gloss Range with Progress Bar */}
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            预期光泽度
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="font-mono text-sm text-foreground">
                {data.glossRange[0]} - {data.glossRange[1]}
              </span>
              <span className="text-xs text-muted-foreground">GU</span>
            </div>
            <div className="relative h-2 bg-secondary/50 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                  data.glossPercent > 70
                    ? 'bg-gradient-to-r from-blue-400 to-cyan-300'
                    : data.glossPercent > 40
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                    : 'bg-gradient-to-r from-blue-700 to-slate-600'
                }`}
                style={{ width: `${data.glossPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Draft Angle Warning */}
        <div
          className={`
            flex items-start gap-2 p-3 rounded-md border
            ${isWarning 
              ? 'bg-amber-500/10 border-amber-500/30' 
              : 'bg-green-500/10 border-green-500/30'
            }
          `}
        >
          {isWarning && (
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground mb-1">
              最小脱模斜度
            </div>
            <div className={`font-mono text-lg font-semibold ${
              isWarning ? 'text-amber-400' : 'text-green-400'
            }`}>
              ≥ {data.draftAngle}°
            </div>
          </div>
        </div>
      </div>

      {/* Hover Glow Effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent" />
      </div>
    </div>
  )
}

function EngineeringConsole() {
  const crossReferenceData = [
    { vdi: 'VDI 12', standard: 'SPI A-3', description: '高光' },
    { vdi: 'VDI 24', standard: 'MT-11010', description: '细纹' },
    { vdi: 'VDI 30', standard: 'MT-11020', description: '中等皮纹' },
    { vdi: 'VDI 36', standard: 'MT-11050', description: '粗皮纹' },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Divider with Grid Pattern */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
        <div className="h-px bg-gradient-to-r from-transparent via-slate-800/50 to-transparent" />
      </div>

      {/* Bottom Dual Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Cross-Reference Matrix */}
        <div className="relative overflow-hidden rounded-lg border border-slate-800/50 bg-[#05080f] p-6 backdrop-blur-sm">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
          
          <div className="relative z-10">
            <h3 className="text-sm font-semibold text-slate-300 mb-1 tracking-wide">
              Industry Standard Mapping
            </h3>
            <p className="text-xs text-muted-foreground mb-5">国际纹理标准换算矩阵</p>
            
            <div className="space-y-0.5">
              {crossReferenceData.map((item, index) => (
                <div
                  key={index}
                  className="group flex items-center justify-between py-3 px-3 rounded-md transition-all duration-200 hover:bg-slate-800/30 cursor-default"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <span className="font-mono text-xs text-slate-400 min-w-[60px]">
                      {item.vdi}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-slate-700/50 to-transparent" />
                    <span className="font-mono text-xs text-primary/80 min-w-[80px] text-right">
                      {item.standard}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 ml-4 min-w-[70px] text-right">
                    ({item.description})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Physics Engine & Formula */}
        <div className="relative overflow-hidden rounded-lg border border-slate-800/50 bg-[#05080f] p-6 backdrop-blur-sm">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
          
          <div className="relative z-10 flex flex-col h-full">
            <h3 className="text-sm font-semibold text-slate-300 mb-1 tracking-wide">
              Calculation Anchor
            </h3>
            <p className="text-xs text-muted-foreground mb-8">物理运算基准</p>
            
            {/* Formula Display */}
            <div className="flex-1 flex items-center justify-center py-8">
              <div className="relative">
                {/* Glow Effect */}
                <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
                
                {/* Formula */}
                <div className="relative text-center">
                  <div className="font-mono text-2xl md:text-3xl font-bold text-primary drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]">
                    VDI = 20 × log₁₀(10 × Ra)
                  </div>
                </div>
              </div>
            </div>
            
            {/* Disclaimer */}
            <div className="mt-auto pt-6 border-t border-slate-800/50">
              <p className="text-[10px] leading-relaxed text-slate-600">
                * 预估光泽度基于 60° 测量角。拔模斜度补偿系数 K=1.2 (PC基准)。
                模具实际表面反光率受钢材纯度 (如 S136 / NAK80) 影响。
                本参照库数据仅供工程预估使用，实际加工参数需结合生产环境校准。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
