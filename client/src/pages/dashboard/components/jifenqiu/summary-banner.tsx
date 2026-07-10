import type { ReportMeta } from "./report-data";
import { glassPanel } from "./ui";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium tracking-widest text-slate-500">{label}</span>
      <span className="font-mono text-sm font-semibold tracking-tight text-gray-100">{value}</span>
    </div>
  );
}

export function SummaryBanner({ reportMeta }: { reportMeta: ReportMeta }) {
  const pass = reportMeta.judgment === "PASS";

  return (
    <header
      className={`mb-6 flex flex-col gap-6 ${glassPanel} p-6 md:flex-row md:items-center md:justify-between`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600">积分球检测报告</span>
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <MetaItem label="解析文件" value={reportMeta.fileName} />
          <MetaItem label="产品型号" value={reportMeta.productModel} />
          <MetaItem label="测试日期" value={reportMeta.testDate} />
          <MetaItem label="设备编号" value={reportMeta.equipmentId} />
          <MetaItem label="操作员" value={reportMeta.operator} />
        </div>
      </div>

      <div className="relative flex flex-col items-start gap-0.5 md:items-end">
        <span className="text-[10px] font-medium tracking-widest text-slate-500">综合判定</span>
        <span className="relative font-mono text-4xl font-bold tracking-tight">
          <span
            aria-hidden
            className="absolute inset-0 -z-10 blur-xl"
            style={{
              background: pass
                ? "radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)"
                : "radial-gradient(circle, rgba(239,68,68,0.25), transparent 70%)",
            }}
          />
          <span className={pass ? "text-emerald-400" : "text-red-400"}>{reportMeta.judgment}</span>
        </span>
        <span className="text-xs text-slate-600">{pass ? "合规" : "待复核"}</span>
      </div>
    </header>
  );
}
