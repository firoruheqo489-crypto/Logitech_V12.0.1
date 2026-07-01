import type { MetricField } from "@/lib/report-data"
import { glassPanel, subTitle } from "@/lib/ui"

interface TelemetryVectorProps {
  title: string // e.g. "// ELECTRICAL INPUT TELEMETRY"
  fields: MetricField[]
}

// 把数据“嵌”进玻璃：每个向量是一块独立的毛玻璃机架，内部行像精密机加工卡槽
export function TelemetryVector({ title, fields }: TelemetryVectorProps) {
  return (
    <div className={`flex flex-col ${glassPanel} p-5`}>
      <h3 className={`${subTitle} mb-3`}>{title}</h3>
      <div className="flex flex-col">
        {fields.map((f) => (
          <div
            key={f.label}
            className="flex items-center justify-between border-b border-white/[0.03] px-3 py-2.5 transition-all last:border-none hover:bg-white/[0.01]"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-sans text-[10px] font-medium uppercase tracking-widest text-slate-500">
                {f.label}
              </span>
              <span className="text-[9px] tracking-wide text-slate-600">{f.cn}</span>
            </div>

            {f.primary ? (
              <div className="relative text-right">
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 blur-lg"
                  style={{ background: "radial-gradient(circle, rgba(0,243,255,0.18), transparent 70%)" }}
                />
                <span className="font-mono text-2xl font-bold tracking-tighter text-[#00F3FF]">{f.value}</span>
                {f.unit ? <span className="ml-1 font-sans text-[9px] text-slate-500">{f.unit}</span> : null}
              </div>
            ) : (
              <div className="text-right">
                <span className="font-mono text-sm font-semibold tracking-tight text-gray-100">{f.value}</span>
                {f.unit ? <span className="ml-1 font-sans text-[9px] text-slate-500">{f.unit}</span> : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
