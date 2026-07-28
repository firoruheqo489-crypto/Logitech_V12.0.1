import type { ReportMeta } from "./report-data";
import { glassPanel } from "./ui";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium tracking-widest text-slate-500">
        {label}
      </span>
      <span className="font-mono text-sm font-semibold tracking-tight text-gray-100">
        {value}
      </span>
    </div>
  );
}

export function SummaryBanner({ reportMeta }: { reportMeta: ReportMeta }) {
  return (
    <header
      className={`mb-6 flex flex-col gap-6 ${glassPanel} p-6 md:flex-row md:items-center`}
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
    </header>
  );
}
