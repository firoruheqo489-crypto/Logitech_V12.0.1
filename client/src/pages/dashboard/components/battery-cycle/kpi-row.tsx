import type { BatteryDataset } from "./battery-data";

const glassCard = "rounded-lg border border-white/[0.05] bg-white/[0.02] p-4 backdrop-blur-xl";

export function KpiRow({ meta }: { meta: BatteryDataset["meta"] }) {
  const degraded = meta.retention < 95;

  const kpis = [
    {
      label: "目标循环数",
      sub: "目标循环数",
      value: `${meta.targetCycles}`,
      unit: "循环",
      note: `已完成 ${meta.cycleCount}`,
      accent: "text-cyan-300",
    },
    {
      label: "初始容量",
      sub: "初始放电容量",
      value: meta.initialCap.toFixed(2),
      unit: "Ah",
      note: `${meta.sampleCount.toLocaleString()} 采样点`,
      accent: "text-cyan-300",
    },
    {
      label: "容量保持率",
      sub: "容量保持率 SOH",
      value: `${meta.retention.toFixed(1)}%`,
      unit: "",
      note: degraded ? "检测到容量衰减" : "状态正常",
      accent: degraded ? "text-[#FF3C5C]" : "text-cyan-300",
    },
    {
      label: "最大直流内阻",
      sub: "最大直流内阻",
      value: meta.maxIr.toFixed(2),
      unit: "mΩ",
      note: "直流内阻 DCIR",
      accent: "text-cyan-300",
    },
  ];

  return (
    <section aria-label="核心指标" className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
      {kpis.map((kpi) => (
        <div key={kpi.label} className={glassCard}>
          <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500">{kpi.label}</p>
          <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
          <p className={`mt-2 font-mono text-2xl font-bold lg:text-3xl ${kpi.accent}`}>
            {kpi.value}
            {kpi.unit && <span className="ml-1.5 text-sm font-normal text-slate-500">{kpi.unit}</span>}
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-wider text-slate-600">{kpi.note}</p>
        </div>
      ))}
    </section>
  );
}
