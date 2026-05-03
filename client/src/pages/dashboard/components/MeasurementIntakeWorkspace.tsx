import { MeasurementTable } from "@/components/measurement-table";

export default function MeasurementIntakeWorkspace() {
  return (
    <section className="rounded-lg border border-white/10 bg-[#0B0F14] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)] md:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">在线测量数据检入表</h2>
        </div>
        <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
          EXCEL
        </span>
      </div>
      <MeasurementTable />
    </section>
  );
}
