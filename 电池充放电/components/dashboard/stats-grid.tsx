import type { CycleStat } from '@/lib/battery-data'

export function StatsGrid({ data }: { data: CycleStat[] }) {
  return (
    <div role="table" aria-label="循环统计矩阵" className="w-full">
      <div
        role="row"
        className="mb-2 grid grid-cols-4 border-b border-white/10 pb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500"
      >
        <span role="columnheader">CYCLE</span>
        <span role="columnheader" className="text-right">DISCHARGE CAP (Ah)</span>
        <span role="columnheader" className="text-right">EFFICIENCY (%)</span>
        <span role="columnheader" className="text-right">DCIR (mΩ)</span>
      </div>
      {data.map((row) => {
        const degraded = row.retention < 95
        return (
          <div
            key={row.cycle}
            role="row"
            className="grid grid-cols-4 border-b border-white/[0.02] py-1 font-mono text-[11px] text-gray-300 transition-colors hover:bg-white/[0.03]"
          >
            <span role="cell" className="text-slate-500">
              {String(row.cycle).padStart(3, '0')}
            </span>
            <span role="cell" className={`text-right ${degraded ? 'text-[#FF3C5C]' : ''}`}>
              {row.dischargeCap.toFixed(4)}
              {degraded && <span className="ml-1 text-[9px] text-[#FF3C5C]/60">{'▼'}</span>}
            </span>
            <span role="cell" className="text-right">{row.efficiency.toFixed(2)}</span>
            <span role="cell" className="text-right">{row.ir.toFixed(2)}</span>
          </div>
        )
      })}
    </div>
  )
}
