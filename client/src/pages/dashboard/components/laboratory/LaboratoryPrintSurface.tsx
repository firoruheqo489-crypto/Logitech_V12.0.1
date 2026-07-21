import type {
  LaboratoryModuleSummary,
  LaboratoryOverallAdjudication,
  LaboratoryFinalVerdict,
  LaboratoryOverallVerdict,
  LaboratoryReportMeta,
} from "./laboratory-contract";
import { FLICKER_COMPLIANCE_RULES } from "./flicker-rules";

function statusTone(verdict: LaboratoryModuleSummary["verdict"]) {
  if (verdict === "FAIL") return "text-[#FF3C5C]";
  if (verdict === "WATCH") return "text-amber-300";
  if (verdict === "PASS") return "text-cyan-300";
  return "text-slate-400";
}

function overallTone(verdict: LaboratoryOverallVerdict) {
  if (verdict === "FAIL") return "text-[#FF3C5C]";
  if (verdict === "WATCH") return "text-amber-300";
  if (verdict === "PASS") return "text-cyan-300";
  return "text-slate-400";
}

function PrintMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
      <p className="font-mono text-[9px] tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function findMetric(summary: LaboratoryModuleSummary, label: string) {
  return summary.keyMetrics.find((metric) => metric.label === label)?.value ?? "--";
}

function FlickerEvidencePrintBlock({ summary }: { summary: LaboratoryModuleSummary }) {
  if (summary.type !== "FLICKER") return null;

  const evidenceRows = [
    {
      label: "频闪率",
      value: findMetric(summary, "最差频闪率"),
      basis: `无风险 <= ${FLICKER_COMPLIANCE_RULES.flickerPercent.noRiskMax}%，低风险 <= ${FLICKER_COMPLIANCE_RULES.flickerPercent.lowRiskMax}%`,
    },
    {
      label: "Pst",
      value: findMetric(summary, "Pst"),
      basis: "PDF Result 为可接受",
    },
    {
      label: "SVM",
      value: findMetric(summary, "SVM"),
      basis: "PDF ERP 为 PASS",
    },
    {
      label: "可见性",
      value: findMetric(summary, "SVM可见性"),
      basis: "SVM 报告可见性字段",
    },
  ];

  const standardRows = [
    findMetric(summary, "频闪标准"),
    findMetric(summary, "Pst标准"),
    findMetric(summary, "SVM标准"),
  ].filter((value) => value !== "--");

  return (
    <div className="mt-4 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.035] p-3">
      <p className="font-mono text-[10px] tracking-[0.18em] text-cyan-200">频闪证据链</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {evidenceRows.map((row) => (
          <div key={row.label} className="rounded-md border border-white/[0.06] bg-black/20 p-2">
            <p className="font-mono text-[9px] tracking-[0.14em] text-slate-500">{row.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{row.value}</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">{row.basis}</p>
          </div>
        ))}
      </div>
      {standardRows.length ? (
        <p className="mt-3 text-xs leading-5 text-slate-400">标准依据：{standardRows.join("；")}</p>
      ) : null}
    </div>
  );
}

export function LaboratoryPrintSurface({
  summaries,
  meta,
  overall,
  manualConclusion = "",
  finalVerdict,
}: {
  summaries: LaboratoryModuleSummary[];
  meta: LaboratoryReportMeta;
  overall: LaboratoryOverallAdjudication;
  manualConclusion?: string;
  finalVerdict: LaboratoryFinalVerdict;
}) {
  const generatedAt = new Date().toLocaleString("zh-CN");
  const passCount = summaries.filter((summary) => summary.verdict === "PASS").length;
  const watchCount = summaries.filter((summary) => summary.verdict === "WATCH").length;
  const failCount = summaries.filter((summary) => summary.verdict === "FAIL").length;
  const metaRows = [
    { label: "报告编号", value: meta.reportNo || "--" },
    { label: "项目名称", value: meta.projectName || "--" },
    { label: "样品名称", value: meta.sampleName || "--" },
    { label: "样品编号", value: meta.sampleNo || "--" },
    { label: "客户/项目方", value: meta.customer || "--" },
    { label: "测试阶段", value: meta.stage || "--" },
    { label: "测试日期", value: meta.testDate || "--" },
    { label: "测试人员", value: meta.operator || "--" },
    { label: "审核人员", value: meta.reviewer || "--" },
  ];

  return (
    <article className="laboratory-print-surface w-[1120px] bg-[#020406] p-8 text-slate-100">
      <header className="rounded-[24px] border border-cyan-300/15 bg-cyan-300/[0.04] p-6">
        <p className="font-mono text-[10px] tracking-[0.24em] text-cyan-300">LABORATORY CONSOLIDATED REPORT</p>
        <div className="mt-3 flex items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-50">实验室综合测试报告</h1>
            <p className="mt-2 text-sm text-slate-500">生成时间：{generatedAt}</p>
            <p className={`mt-3 font-mono text-sm tracking-[0.16em] ${overallTone(finalVerdict)}`}>
              最终判定：{finalVerdict}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3 font-mono text-xs">
            <PrintMetric label="PASS" value={String(passCount)} />
            <PrintMetric label="WATCH" value={String(watchCount)} />
            <PrintMetric label="FAIL" value={String(failCount)} />
            <PrintMetric label="待解析" value={String(overall.pendingCount)} />
          </div>
        </div>
      </header>

      <section className="mt-6 rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
          <h2 className="font-mono text-xs tracking-[0.2em] text-slate-300">// 报告元信息</h2>
          <span className={`font-mono text-xs ${overallTone(finalVerdict)}`}>{finalVerdict}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {metaRows.map((item) => (
            <PrintMetric key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
        <div className="mt-4 whitespace-pre-wrap rounded-lg border border-cyan-300/10 bg-black/20 p-3 text-sm leading-6 text-slate-300">
          {manualConclusion.trim() || overall.summary}
        </div>
      </section>

      <section className="mt-6 rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
          <h2 className="font-mono text-xs tracking-[0.2em] text-slate-300">// 模块清单</h2>
          <span className="text-xs text-slate-500">共 {summaries.length} 个测试模块</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {summaries.map((summary) => (
            <div key={summary.nodeId} className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <p className="text-sm font-semibold text-slate-100">{summary.label}</p>
              <p className="mt-1 text-[11px] text-slate-500">{summary.category}</p>
              <p className={`mt-3 font-mono text-xs ${statusTone(summary.verdict)}`}>{summary.verdict}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 space-y-5">
        {summaries.map((summary, index) => (
          <div key={summary.nodeId} className="break-inside-avoid rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-5">
            <div className="mb-4 flex items-start justify-between border-b border-white/[0.06] pb-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500">
                  MODULE {String(index + 1).padStart(2, "0")} / {summary.type}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-50">{summary.printTitle}</h2>
              </div>
              <span className={`rounded-md border border-white/[0.08] bg-black/30 px-3 py-1 font-mono text-sm ${statusTone(summary.verdict)}`}>
                {summary.verdict}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {summary.keyMetrics.map((metric) => (
                <PrintMetric key={`${summary.nodeId}-${metric.label}`} label={metric.label} value={metric.value} />
              ))}
            </div>

            <FlickerEvidencePrintBlock summary={summary} />

            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500">数据源</p>
              <p className="mt-1 text-sm text-slate-300">
                {summary.sourceFiles.length ? summary.sourceFiles.join("、") : "等待子模块上报源文件"}
              </p>
            </div>

            {summary.warnings.length ? (
              <div className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3">
                <p className="font-mono text-[10px] tracking-[0.18em] text-amber-200">审计提示</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {summary.warnings.map((warning) => (
                    <li key={warning}>- {warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </article>
  );
}
