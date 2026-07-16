import type { MetricField } from "./report-data";
import { glassPanel } from "./ui";

interface TelemetryVectorProps {
  title: string;
  fields: MetricField[];
}

export function TelemetryVector({ title, fields }: TelemetryVectorProps) {
  return (
    <div className={`flex flex-col ${glassPanel} p-5`}>
      <div className="mb-3 flex items-start border-b border-white/[0.05] pb-3">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-cyan-300/80" aria-hidden />
          <h3 className="text-[13px] font-semibold tracking-wide text-slate-400">{title}</h3>
        </div>
      </div>
      <div className="flex flex-col">
        {fields.map((field) => (
          <div
            key={field.label}
            className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-white/[0.035] px-3 py-3 last:border-none"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-sans text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">
                {field.label}
              </span>
              <span className="truncate text-[9px] font-medium tracking-wide text-slate-600">{field.cn}</span>
            </div>

            {field.primary ? (
              <div className="relative text-right">
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 blur-lg"
                  style={{ background: "radial-gradient(circle, rgba(0,243,255,0.18), transparent 70%)" }}
                />
                <span className="font-mono text-3xl font-black tracking-[-0.04em] text-cyan-200 tabular-nums">{field.value}</span>
                {field.unit ? <span className="ml-1.5 font-sans text-[9px] font-medium text-slate-600">{field.unit}</span> : null}
              </div>
            ) : (
              <div className="whitespace-nowrap text-right">
                <span className="font-mono text-xl font-extrabold tracking-[-0.03em] text-cyan-200 tabular-nums">{field.value}</span>
                {field.unit ? <span className="ml-1.5 font-sans text-[9px] font-medium text-slate-600">{field.unit}</span> : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
