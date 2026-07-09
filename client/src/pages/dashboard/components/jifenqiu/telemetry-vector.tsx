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
          <h3 className="text-sm font-bold text-cyan-100">{title}</h3>
        </div>
      </div>
      <div className="flex flex-col">
        {fields.map((field) => (
          <div
            key={field.label}
            className="flex items-center justify-between border-b border-white/[0.03] px-3 py-2.5 transition-all last:border-none hover:bg-white/[0.01]"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-sans text-[10px] font-medium uppercase tracking-widest text-slate-500">
                {field.label}
              </span>
              <span className="text-[9px] tracking-wide text-slate-600">{field.cn}</span>
            </div>

            {field.primary ? (
              <div className="relative text-right">
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 blur-lg"
                  style={{ background: "radial-gradient(circle, rgba(0,243,255,0.18), transparent 70%)" }}
                />
                <span className="font-mono text-2xl font-bold tracking-tighter text-[#00F3FF]">{field.value}</span>
                {field.unit ? <span className="ml-1 font-sans text-[9px] text-slate-500">{field.unit}</span> : null}
              </div>
            ) : (
              <div className="text-right">
                <span className="font-mono text-sm font-semibold tracking-tight text-gray-100">{field.value}</span>
                {field.unit ? <span className="ml-1 font-sans text-[9px] text-slate-500">{field.unit}</span> : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
