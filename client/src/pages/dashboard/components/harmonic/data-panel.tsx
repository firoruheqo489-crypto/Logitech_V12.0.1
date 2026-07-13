import { CheckCircle2, CircleAlert, Info, TriangleAlert } from "lucide-react";

import { HarmonicGlassCard } from "./glass-card";
import type {
  AlphaMetric,
  HarmonicEvidenceAudit,
  HarmonicEvidenceItem,
  MarginRow,
  ReportInsight,
  SecondaryStat,
} from "@/pages/dashboard/lib/harmonic-report";

type StructuralAuditRow = {
  label: string;
  value: string;
  limit: string;
  status: string;
};

const toneColor: Record<SecondaryStat["tone"] | AlphaMetric["tone"], string> = {
  good: "text-cyan-200",
  neutral: "text-slate-100",
  watch: "text-amber-200",
  critical: "text-[#FF3C5C]",
};

const evidenceTone: Record<HarmonicEvidenceItem["status"], string> = {
  PASS: "border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-200",
  FAIL: "border-[#FF3C5C]/30 bg-[#FF3C5C]/[0.07] text-[#FF8FA3]",
  WATCH: "border-amber-300/25 bg-amber-300/[0.06] text-amber-200",
  MISSING: "border-white/[0.06] bg-white/[0.025] text-slate-400",
};

const evidenceIcon = {
  PASS: CheckCircle2,
  FAIL: CircleAlert,
  WATCH: TriangleAlert,
  MISSING: Info,
};

function EvidenceRow({ item }: { item: HarmonicEvidenceItem }) {
  const Icon = evidenceIcon[item.status];
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${evidenceTone[item.status]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-medium text-slate-200">{item.label}</span>
        </div>
        <span className="shrink-0 font-mono text-xs font-semibold">{item.value}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-slate-500">{item.basis}</p>
    </div>
  );
}

export function HarmonicAlphaMetricCard({ metrics }: { metrics: AlphaMetric[] }) {
  return (
    <HarmonicGlassCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-[0.18em] text-slate-500">核心指标</h2>
        <span className="text-[10px] text-slate-600">PDF字段</span>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-white/[0.06] bg-black/25 p-3">
            <p className="text-[11px] text-slate-400">{metric.label}</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className={`font-mono text-2xl font-black ${toneColor[metric.tone]}`}>{metric.value}</span>
              <span className="text-sm font-semibold text-slate-500">{metric.unit}</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-600">{metric.sub}</p>
          </div>
        ))}
      </div>
    </HarmonicGlassCard>
  );
}

export function HarmonicEvidenceCard({ audit }: { audit: HarmonicEvidenceAudit }) {
  return (
    <HarmonicGlassCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-[0.18em] text-slate-500">合规证据链</h2>
        <span className={audit.verdict === "FAIL" ? "font-mono text-xs text-[#FF3C5C]" : audit.verdict === "WATCH" ? "font-mono text-xs text-amber-200" : "font-mono text-xs text-cyan-200"}>
          {audit.verdict}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {audit.evidence.map((item) => (
          <EvidenceRow key={item.label} item={item} />
        ))}
      </div>
      {audit.contradictions.length || audit.missingItems.length ? (
        <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] px-3 py-2 text-xs leading-5 text-amber-100">
          {[...audit.contradictions, audit.missingItems.length ? `缺失项：${audit.missingItems.join("、")}` : null]
            .filter(Boolean)
            .join(" ")}
        </div>
      ) : null}
    </HarmonicGlassCard>
  );
}

export function HarmonicObservationCard({ rows }: { rows: HarmonicEvidenceItem[] }) {
  return (
    <HarmonicGlassCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-[0.18em] text-slate-500">工程观察项</h2>
        <span className="text-[10px] text-slate-600">不直接覆盖PDF结论</span>
      </div>
      <div className="space-y-2">
        {rows.map((item) => (
          <EvidenceRow key={item.label} item={item} />
        ))}
      </div>
    </HarmonicGlassCard>
  );
}

export function HarmonicOperatingAuditCard({
  stats,
  structuralRows,
}: {
  stats: SecondaryStat[];
  structuralRows: StructuralAuditRow[];
}) {
  return (
    <HarmonicGlassCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-[0.18em] text-slate-500">基础工况 / 结构硬伤</h2>
        <span className="text-[10px] text-slate-600">PDF明细</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5">
            <p className="text-[11px] text-slate-500">{stat.label}</p>
            <p className={`mt-1 break-words font-mono text-base font-bold leading-6 ${toneColor[stat.tone]}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06]">
        <div className="bg-white/[0.03] px-3 py-2 text-xs text-slate-400">结构硬伤检查</div>
        <div className="divide-y divide-white/[0.05]">
          {structuralRows.length ? (
            structuralRows.map((check) => (
              <div key={check.label} className="grid grid-cols-[minmax(0,1fr)_minmax(150px,auto)_64px] items-center gap-3 px-3 py-2.5 text-xs">
                <span className="min-w-0 break-words text-slate-100">{check.label}</span>
                <span className="break-words font-mono text-slate-500">
                  {check.value} / {check.limit}
                </span>
                <span className={check.status === "FAIL" ? "text-right font-mono text-[#FF3C5C]" : "text-right font-mono text-cyan-200"}>
                  {check.status}
                </span>
              </div>
            ))
          ) : (
            <div className="px-3 py-5 text-center text-xs text-slate-500">等待解析</div>
          )}
        </div>
      </div>
    </HarmonicGlassCard>
  );
}

export function HarmonicInsightCard({ rows }: { rows: ReportInsight[] }) {
  return (
    <HarmonicGlassCard>
      <h2 className="mb-3 text-xs font-medium tracking-[0.18em] text-slate-500">判读说明</h2>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-300">{row.label}</span>
              <span className={`font-mono text-sm font-semibold ${toneColor[row.tone]}`}>{row.value}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-500">{row.hint}</p>
          </div>
        ))}
      </div>
    </HarmonicGlassCard>
  );
}

export function HarmonicMarginAuditCard({ rows }: { rows: MarginRow[] }) {
  return (
    <HarmonicGlassCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-[0.18em] text-slate-500">限值余量</h2>
        <span className="text-[10px] text-slate-600">按最小余量排序</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-white/[0.06]">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.03] text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">阶次</th>
              <th className="px-3 py-2 font-medium">实测</th>
              <th className="px-3 py-2 font-medium">限值</th>
              <th className="px-3 py-2 font-medium">余量</th>
              <th className="px-3 py-2 font-medium">来源</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.label} className="border-t border-white/[0.05] text-slate-300">
                  <td className="px-3 py-2 font-mono text-slate-100">{row.order}</td>
                  <td className="px-3 py-2">{row.value}%</td>
                  <td className="px-3 py-2">{row.limit}%</td>
                  <td className={row.critical ? "px-3 py-2 font-mono text-[#FF3C5C]" : "px-3 py-2 font-mono text-cyan-200"}>
                    {row.margin > 0 ? `+${row.margin}` : row.margin}%
                  </td>
                  <td className="px-3 py-2 text-slate-500">{row.limitSource === "pdf" ? "PDF" : "推导"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                  等待解析谐波限值表
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </HarmonicGlassCard>
  );
}
