import { formatDarkroomNumber, type DarkroomTelemetry } from "./photometric"

export function ConicalAttenuation({ telemetry }: { telemetry: DarkroomTelemetry }) {
  return (
    <section className="flex min-h-[640px] flex-col p-6">
      <div className="mb-5 border-b border-white/[0.035] pb-4">
        <h3 className="truncate text-sm font-semibold text-slate-100">锥形照度衰减</h3>
        <p className="mt-1 text-xs text-slate-500">Conical attenuation</p>
      </div>

      <div className="grid grid-cols-[58px_minmax(86px,1fr)_minmax(86px,1fr)_78px] gap-3 border-b border-white/[0.035] px-1 pb-2 text-xs text-slate-500">
        <span>高度</span>
        <span className="text-right">中心照度</span>
        <span className="text-right">平均照度</span>
        <span className="text-right">直径</span>
      </div>

      <div className="grid">
        {telemetry.attenuationSlots.length ? (
          telemetry.attenuationSlots.map((slot) => (
            <div
              key={slot.height}
              className="grid grid-cols-[58px_minmax(86px,1fr)_minmax(86px,1fr)_78px] items-center gap-3 border-b border-white/[0.035] px-1 py-3 transition-colors hover:bg-cyan-300/[0.02]"
            >
              <span className="whitespace-nowrap font-mono text-xs text-cyan-200">
                {slot.height}
              </span>
              <span className="whitespace-nowrap text-right font-mono text-lg font-semibold tabular-nums text-slate-100">
                {slot.centerLux.toFixed(2)} <span className="text-xs font-normal text-slate-500">lx</span>
              </span>
              <span className="whitespace-nowrap text-right font-mono text-sm tabular-nums text-slate-300">
                {slot.averageLux.toFixed(2)} <span className="text-xs text-slate-500">lx</span>
              </span>
              <span className="whitespace-nowrap text-right font-mono text-xs text-cyan-300/85">
                Ø {slot.diameter.toFixed(2)}m
              </span>
            </div>
          ))
        ) : (
          <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-white/10 px-6 text-center text-xs text-slate-500">
            PDF 未解析到 Illuminance-Distance 表，暂不展示衰减数据。
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-white/[0.035] pt-4">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.03] px-1 py-2.5">
          <span className="text-xs text-slate-500">安装高度 Mounting height</span>
          <span className="whitespace-nowrap font-mono text-sm text-cyan-200">
            {formatDarkroomNumber(telemetry.mountingHeight, 2, "m")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 px-1 py-2.5">
          <span className="text-xs text-slate-500">工作面 Emax</span>
          <span className="whitespace-nowrap font-mono text-sm text-cyan-200">
            {formatDarkroomNumber(telemetry.workingPlaneEMax, 2, "lx")}
          </span>
        </div>
      </div>
    </section>
  )
}
