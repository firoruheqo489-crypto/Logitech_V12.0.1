import type { BatteryDataset, CycleStat } from "./battery-data";
import type { BatteryAdjudication } from "./battery-rules";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCycle(row: CycleStat) {
  return `
    <tr>
      <td>${row.cycle}</td>
      <td>${row.dischargeCap.toFixed(4)}</td>
      <td>${row.retention.toFixed(1)}%</td>
      <td>${row.ir.toFixed(2)}</td>
      <td>${row.medianV.toFixed(3)}</td>
      <td>${row.efficiency.toFixed(2)}%</td>
    </tr>
  `;
}

export function buildBatteryAuditReportHtml(dataset: BatteryDataset, adjudication: BatteryAdjudication) {
  const validation = dataset.parseSummary.validation;
  const highlightedCycles = Array.from(
    new Set(
      adjudication.rules
        .filter((rule) => rule.level !== "Pass")
        .flatMap((rule) => rule.triggerCycles),
    ),
  ).sort((a, b) => a - b);
  const evidenceRows = highlightedCycles
    .map((cycle) => dataset.cycleStats.find((row) => row.cycle === cycle))
    .filter((row): row is CycleStat => Boolean(row))
    .map(formatCycle)
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(dataset.meta.deviceLabel)} 审计报告</title>
  <style>
    body { margin: 0; padding: 32px; background: #020617; color: #dbeafe; font-family: "Microsoft YaHei", sans-serif; }
    .card { border: 1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.035); border-radius: 14px; padding: 18px; margin: 16px 0; }
    h1, h2 { color: #67e8f9; letter-spacing: .08em; }
    h1 { font-size: 22px; }
    h2 { font-size: 14px; margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric { border: 1px solid rgba(103,232,249,.16); border-radius: 10px; padding: 12px; background: rgba(0,0,0,.22); }
    .label { color: #64748b; font-size: 11px; letter-spacing: .12em; }
    .value { color: #f8fafc; font-size: 18px; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid rgba(255,255,255,.08); padding: 8px; text-align: left; }
    th { color: #93c5fd; font-weight: 500; }
    .pass { color: #67e8f9; }
    .watch { color: #fbbf24; }
    .fail { color: #ff6b81; }
    .muted { color: #94a3b8; }
  </style>
</head>
<body>
  <h1>${escapeHtml(dataset.meta.deviceLabel)} 电池循环审计报告</h1>
  <p class="muted">数据源：${escapeHtml(dataset.parseSummary.sourceFile)} ｜ 规则版本：${escapeHtml(validation.templateFingerprint.version)} ｜ 模板状态：${escapeHtml(validation.templateFingerprint.compatibility)}</p>

  <section class="card">
    <h2>// EXECUTIVE SUMMARY</h2>
    <p class="${adjudication.overallLevel.toLowerCase()}">${escapeHtml(adjudication.statusText)}</p>
    <p>${escapeHtml(adjudication.summary)}</p>
  </section>

  <section class="card">
    <h2>// TEMPLATE CONTRACT</h2>
    <div class="grid">
      <div class="metric"><div class="label">模板可信度</div><div class="value">${validation.quality.grade} / ${validation.quality.score}</div></div>
      <div class="metric"><div class="label">必需列匹配</div><div class="value">${validation.templateFingerprint.matchedRequiredColumnCount}/${validation.templateFingerprint.requiredColumnCount}</div></div>
      <div class="metric"><div class="label">采样点</div><div class="value">${dataset.meta.sampleCount.toLocaleString()}</div></div>
      <div class="metric"><div class="label">循环覆盖</div><div class="value">${dataset.meta.cycleCount}/${dataset.meta.targetCycles}</div></div>
    </div>
    <p class="muted">${validation.quality.issues.map(escapeHtml).join("；")}</p>
  </section>

  <section class="card">
    <h2>// KPI SNAPSHOT</h2>
    <div class="grid">
      <div class="metric"><div class="label">初始放电容量</div><div class="value">${dataset.meta.initialCap.toFixed(3)} Ah</div></div>
      <div class="metric"><div class="label">最终 SOH</div><div class="value">${dataset.meta.retention.toFixed(1)}%</div></div>
      <div class="metric"><div class="label">最大 DCIR</div><div class="value">${dataset.meta.maxIr.toFixed(2)} mΩ</div></div>
      <div class="metric"><div class="label">最高温度</div><div class="value">${dataset.parseSummary.cycleStats.maxTemperature.toFixed(1)} ℃</div></div>
    </div>
  </section>

  <section class="card">
    <h2>// RULE MATRIX</h2>
    <table>
      <thead><tr><th>规则</th><th>结果</th><th>阻断级别</th><th>指标</th><th>依据</th></tr></thead>
      <tbody>
        ${adjudication.rules
          .map(
            (rule) => `
              <tr>
                <td>${escapeHtml(rule.name)}</td>
                <td class="${rule.level.toLowerCase()}">${rule.level}</td>
                <td>${escapeHtml(rule.blockLevel)}</td>
                <td>${escapeHtml(rule.metric)}</td>
                <td>${escapeHtml(rule.basis)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h2>// ABNORMAL CYCLE EVIDENCE</h2>
    <table>
      <thead><tr><th>循环</th><th>放电容量(Ah)</th><th>SOH</th><th>DCIR(mΩ)</th><th>中值电压(V)</th><th>效率</th></tr></thead>
      <tbody>${evidenceRows || '<tr><td colspan="6" class="muted">无 Watch/Fail 触发循环。</td></tr>'}</tbody>
    </table>
  </section>
</body>
</html>`;
}

export function makeBatteryReportFileName(dataset: BatteryDataset) {
  const safeName = dataset.parseSummary.sourceFile.replace(/[\\/:*?"<>|]/g, "_").replace(/\.(xlsx|xls)$/i, "");
  return `${safeName || "battery-cycle"}-audit-report.html`;
}
