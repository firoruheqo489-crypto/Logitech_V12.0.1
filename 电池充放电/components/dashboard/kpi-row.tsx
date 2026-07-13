import type { BatteryDataset } from '@/lib/battery-data'

const glassCard = 'glass-panel p-6'

export function KpiRow({ meta }: { meta: BatteryDataset['meta'] }) {
  const degraded = meta.retention < 95

  const kpis = [
    {
      label: 'TARGET CYCLES',
      sub: '目标循环数',
      value: `${meta.targetCycles}`,
      unit: 'CYCLES',
      note: `已完成 ${meta.cycleCount}`,
      accent: 'text-[#E8B84B]',
    },
    {
      label: 'INITIAL CAPACITY',
      sub: '初始放电容量',
      value: meta.initialCap.toFixed(2),
      unit: 'Ah',
      note: `${meta.sampleCount.toLocaleString()} 采样点`,
      accent: 'text-[#E8B84B]',
    },
    {
      label: 'CAPACITY RETENTION',
      sub: '容量保持率 SOH',
      value: `${meta.retention.toFixed(1)}%`,
      unit: '',
      note: degraded ? 'DEGRADATION DETECTED' : 'NOMINAL',
      accent: degraded ? 'text-[#FF3C5C]' : 'text-[#E8B84B]',
    },
    {
      label: 'MAX DCIR',
      sub: '最大直流内阻',
      value: meta.maxIr.toFixed(2),
      unit: 'mΩ',
      note: 'DC INTERNAL RESISTANCE',
      accent: 'text-[#E8B84B]',
    },
  ]

  return (
    <section aria-label="核心指标" className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
      {kpis.map((kpi) => (
        <div key={kpi.label} className={glassCard}>
          <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500">{kpi.label}</p>
          <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
          <p className={`mt-3 font-mono text-2xl font-bold lg:text-3xl ${kpi.accent}`}>
            {kpi.value}
            {kpi.unit && <span className="ml-1.5 text-sm font-normal text-slate-500">{kpi.unit}</span>}
          </p>
          <p className="mt-2 font-mono text-[10px] tracking-wider text-slate-600">{kpi.note}</p>
        </div>
      ))}
    </section>
  )
}
