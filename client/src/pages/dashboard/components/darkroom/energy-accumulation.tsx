import { formatDarkroomNumber, type DarkroomTelemetry, type EnergyZone } from "./photometric"

function sourceBadge(source: "pdf" | "reconstructed" | "missing") {
  if (source === "pdf") return "PDF 原文"
  if (source === "reconstructed") return "重建"
  return "源报告未给出"
}

function zoneName(zone: EnergyZone) {
  const label = zone.label.toLowerCase()
  if (label.includes("beam")) return "光束区"
  if (label.includes("field")) return "场角区"
  if (label.includes("erp")) return "ErP 有效光通"
  if (label.includes("total")) return "总光通"
  return zone.label
}

function zoneDescription(zone: EnergyZone) {
  const label = zone.label.toLowerCase()
  if (label.includes("beam")) return zone.sub || "50% Imax"
  if (label.includes("field")) return zone.sub || "10% Imax"
  if (label.includes("erp")) return zone.sub || "Useful flux"
  if (label.includes("total")) return "Luminary Flux"
  return zone.sub
}

function FeaturedZone({ zone }: { zone: EnergyZone }) {
  return (
    <div className="border-b border-white/[0.04] py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{zoneName(zone)}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{zoneDescription(zone)}</p>
        </div>
        <span className="shrink-0 rounded bg-cyan-400/[0.08] px-2 py-1 text-[11px] text-cyan-200">
          {sourceBadge(zone.source)}
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="whitespace-nowrap font-mono text-2xl font-semibold text-slate-100">
          {formatDarkroomNumber(zone.lumens, 1, "lm")}
        </p>
        <p className="whitespace-nowrap font-mono text-xl text-cyan-300">
          {formatDarkroomNumber(zone.percent, 1, "%")}
        </p>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.48)]"
          style={{ width: `${Math.min(100, Math.max(zone.percent ?? 0, zone.source === "missing" ? 0 : 1))}%` }}
        />
      </div>
    </div>
  )
}

function CompactZone({ zone }: { zone: EnergyZone }) {
  const percent = zone.percent ?? 0
  const isMissing = zone.source === "missing"

  return (
    <div className="border-b border-white/[0.035] py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-200">{zoneName(zone)}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{zoneDescription(zone)}</p>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[11px] ${
            isMissing ? "bg-amber-400/[0.08] text-amber-200/75" : "bg-cyan-400/[0.08] text-cyan-200"
          }`}
        >
          {sourceBadge(zone.source)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="h-1.5 min-w-0 flex-1 rounded-full bg-white/[0.05]">
          <div
            className={`h-full rounded-full ${isMissing ? "bg-slate-700" : "bg-cyan-300"}`}
            style={{ width: `${Math.min(100, Math.max(percent, isMissing ? 0 : 1))}%` }}
          />
        </div>
        <p className={`whitespace-nowrap font-mono text-sm ${isMissing ? "text-slate-500" : "text-cyan-200"}`}>
          {formatDarkroomNumber(zone.lumens, 1, "lm")} / {formatDarkroomNumber(zone.percent, 1, "%")}
        </p>
      </div>
    </div>
  )
}

export function EnergyAccumulation({ telemetry }: { telemetry: DarkroomTelemetry }) {
  const featured = telemetry.energyZones.filter((zone) => {
    const label = zone.label.toLowerCase()
    return label.includes("erp") || label.includes("total")
  })
  const supporting = telemetry.energyZones.filter((zone) => !featured.includes(zone))

  return (
    <section className="flex min-h-[640px] flex-col border-b border-white/[0.035] p-6 xl:border-b-0">
      <div className="mb-3 border-b border-white/[0.035] pb-4">
        <h3 className="truncate text-sm font-semibold text-slate-100">区域光通累积</h3>
        <p className="mt-1 text-xs text-slate-500">Energy accumulation</p>
      </div>

      <div className="grid">
        {featured.map((zone) => (
          <FeaturedZone key={zone.label} zone={zone} />
        ))}
      </div>

      <div className="mt-2 grid">
        {supporting.map((zone) => (
          <CompactZone key={zone.label} zone={zone} />
        ))}
      </div>

      <div className="mt-auto border-t border-white/[0.035] pt-4">
        <div className="flex items-center justify-between gap-4 px-1 py-2.5">
          <span className="text-xs text-slate-500">IRF PDF report value</span>
          <span className="whitespace-nowrap font-mono text-sm text-cyan-200">
            {formatDarkroomNumber(telemetry.irfPercent, 1, "%")}
          </span>
        </div>
      </div>
    </section>
  )
}
