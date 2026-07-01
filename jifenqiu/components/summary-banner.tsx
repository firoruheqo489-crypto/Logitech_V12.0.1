import { reportMeta } from "@/lib/report-data"
import { glassPanel } from "@/lib/ui"

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{label}</span>
      <span className="font-mono text-sm font-semibold tracking-tight text-gray-100">{value}</span>
    </div>
  )
}

export function SummaryBanner() {
  const pass = reportMeta.judgment === "PASS"
  return (
    <header
      className={`mb-6 flex flex-col gap-6 ${glassPanel} p-6 md:flex-row md:items-center md:justify-between`}
    >
      {/* 左：文件/产品元数据 */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-cyan-500/80">
            Integrating Sphere
          </span>
          <span className="text-xs text-slate-600">积分球检测报告</span>
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <MetaItem label="Parsed File" value={reportMeta.fileName} />
          <MetaItem label="Product" value={reportMeta.productModel} />
          <MetaItem label="Test Date" value={reportMeta.testDate} />
          <MetaItem label="Equipment ID" value={reportMeta.equipmentId} />
          <MetaItem label="Operator" value={reportMeta.operator} />
        </div>
      </div>

      {/* 右：全局判定印章 */}
      <div className="relative flex flex-col items-start gap-0.5 md:items-end">
        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Global Judgment</span>
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
        <span className="text-xs text-slate-600">{pass ? "COMPLIANT · 合规" : "NON-COMPLIANT · 不合规"}</span>
      </div>
    </header>
  )
}
