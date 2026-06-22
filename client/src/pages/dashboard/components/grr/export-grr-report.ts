'use client'

import type { ControlChart, GrrResults, StudyConfig } from './gage-rnr'
import type { StudyMeta } from './metadata-header'

const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const PAGE_MARGIN_MM = 8
const PREVIEW_WINDOW_FEATURES = 'width=1100,height=900'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatNumber(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-'
}

function formatNullable(value: number | null, digits = 3) {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

function formatPValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value < 0.001) return '<0.001'
  return value.toFixed(3)
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function range(values: number[]) {
  return Math.max(...values) - Math.min(...values)
}

function buildFileBaseName(meta: { partName?: string; characteristic?: string; date?: string }) {
  const parts = ['GRR', meta.partName?.trim(), meta.characteristic?.trim(), meta.date?.trim()].filter(Boolean)
  return parts.join('-').replace(/[\\/:*?"<>|]+/g, '-')
}

function getVerdictMeta(verdict: GrrResults['verdict']) {
  if (verdict === 'acceptable') {
    return { label: 'SYSTEM ACCEPTABLE', accent: '#059669', soft: '#ecfdf5' }
  }
  if (verdict === 'marginal') {
    return { label: 'CONDITIONAL', accent: '#d97706', soft: '#fffbeb' }
  }
  return { label: 'SYSTEM REJECTED', accent: '#dc2626', soft: '#fef2f2' }
}

function buildVariationBarRows(results: GrrResults) {
  const rows = [results.grr, ...results.components]
  const max = Math.max(...rows.map((row) => row.pctStudyVar), 1)
  const colorMap: Record<string, string> = {
    GRR: '#f59e0b',
    EV: '#0ea5e9',
    AV: '#8b5cf6',
    PV: '#10b981',
  }

  return rows
    .map(
      (row) => `
        <div class="grr-bar-row">
          <div class="grr-bar-head">
            <span>${escapeHtml(row.label)}</span>
            <strong style="color:${colorMap[row.key] ?? '#334155'}">${formatNumber(row.pctStudyVar, 1)}%</strong>
          </div>
          <div class="grr-bar-track">
            <div class="grr-bar-fill" style="width:${(row.pctStudyVar / max) * 100}%;background:${colorMap[row.key] ?? '#94a3b8'}"></div>
          </div>
          <div class="grr-bar-meta">σ ${formatNumber(row.stdDev, 4)} · contrib ${formatNumber(row.pctContribution, 1)}%</div>
        </div>
      `,
    )
    .join('')
}

function buildRunChartSvg(results: GrrResults, cfg: StudyConfig) {
  const width = 760
  const height = 240
  const padding = { top: 18, right: 16, bottom: 32, left: 40 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const colors = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
  const values = results.runPoints.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const yMin = min - span * 0.1
  const yMax = max + span * 0.1
  const colWidth = innerWidth / cfg.parts

  const x = (part: number, operator: number, trial: number) => {
    const base = padding.left + colWidth * (part + 0.5)
    const slots = cfg.operators * cfg.trials
    const slot = operator * cfg.trials + trial
    return base + (slot / Math.max(1, slots - 1) - 0.5) * colWidth * 0.55
  }

  const y = (value: number) => padding.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight

  const grid = Array.from({ length: 5 }, (_, index) => {
    const tick = yMin + (index / 4) * (yMax - yMin)
    return `
      <line x1="${padding.left}" y1="${y(tick)}" x2="${width - padding.right}" y2="${y(tick)}" stroke="#d7dee8" stroke-width="1"/>
      <text x="${padding.left - 6}" y="${y(tick) + 4}" text-anchor="end" font-size="9" fill="#64748b">${formatNumber(tick, 2)}</text>
    `
  }).join('')

  const labels = Array.from({ length: cfg.parts }, (_, part) => `
    <text x="${padding.left + colWidth * (part + 0.5)}" y="${height - 10}" text-anchor="middle" font-size="8.5" fill="#64748b">${escapeHtml(cfg.partNames[part])}</text>
  `).join('')

  const points = results.runPoints
    .map((point) => `<circle cx="${x(point.part, point.operator, point.trial)}" cy="${y(point.value)}" r="2.6" fill="${colors[point.operator % colors.length]}" />`)
    .join('')

  return `<svg viewBox="0 0 ${width} ${height}" class="grr-chart-svg" role="img" aria-label="Run chart">${grid}${labels}${points}</svg>`
}

function buildInteractionSvg(results: GrrResults, cfg: StudyConfig) {
  const width = 760
  const height = 240
  const padding = { top: 18, right: 18, bottom: 30, left: 42 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const colors = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
  const values = results.interactionSeries.flatMap((series) => series.points.map((point) => point.avg))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const yMin = min - span * 0.12
  const yMax = max + span * 0.12
  const x = (part: number) => (cfg.parts <= 1 ? padding.left + innerWidth / 2 : padding.left + (part / (cfg.parts - 1)) * innerWidth)
  const y = (value: number) => padding.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight

  const grid = Array.from({ length: 5 }, (_, index) => {
    const tick = yMin + (index / 4) * (yMax - yMin)
    return `
      <line x1="${padding.left}" y1="${y(tick)}" x2="${width - padding.right}" y2="${y(tick)}" stroke="#d7dee8" stroke-width="1"/>
      <text x="${padding.left - 6}" y="${y(tick) + 4}" text-anchor="end" font-size="9" fill="#64748b">${formatNumber(tick, 2)}</text>
    `
  }).join('')

  const labels = Array.from({ length: cfg.parts }, (_, part) => `
    <text x="${x(part)}" y="${height - 8}" text-anchor="middle" font-size="8.5" fill="#64748b">${escapeHtml(cfg.partNames[part])}</text>
  `).join('')

  const lines = results.interactionSeries
    .map((series) => {
      const color = colors[series.operator % colors.length]
      const path = series.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.part)} ${y(point.avg)}`).join(' ')
      const dots = series.points.map((point) => `<circle cx="${x(point.part)}" cy="${y(point.avg)}" r="2.8" fill="${color}" />`).join('')
      return `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.8" />${dots}`
    })
    .join('')

  return `<svg viewBox="0 0 ${width} ${height}" class="grr-chart-svg" role="img" aria-label="Interaction chart">${grid}${labels}${lines}</svg>`
}

function buildControlChartSvg(chart: ControlChart, operatorNames: string[], title: string, accent: string) {
  const width = 760
  const height = 210
  const padding = { top: 20, right: 50, bottom: 28, left: 18 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const values = chart.points.map((point) => point.value)
  const min = Math.min(chart.lcl, ...values)
  const max = Math.max(chart.ucl, ...values)
  const span = max - min || 1
  const yMin = min - span * 0.12
  const yMax = max + span * 0.12
  const x = (index: number) => padding.left + (chart.points.length === 1 ? innerWidth / 2 : (index / (chart.points.length - 1)) * innerWidth)
  const y = (value: number) => padding.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight
  const path = chart.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.index)} ${y(point.value)}`).join(' ')

  const labels = chart.operatorStarts
    .map((start, operatorIndex) => {
      const end = chart.operatorStarts[operatorIndex + 1] ?? chart.points.length
      const middle = (start + end - 1) / 2
      const separator = operatorIndex === 0 ? '' : `<line x1="${x(start) - (x(1) - x(0)) / 2}" y1="${padding.top}" x2="${x(start) - (x(1) - x(0)) / 2}" y2="${height - padding.bottom}" stroke="#cbd5e1" stroke-dasharray="3 4" />`
      return `${separator}<text x="${x(middle)}" y="${height - 8}" text-anchor="middle" font-size="8.5" fill="#64748b">${escapeHtml(operatorNames[operatorIndex])}</text>`
    })
    .join('')

  const points = chart.points
    .map((point) => `<circle cx="${x(point.index)}" cy="${y(point.value)}" r="${point.outOfControl ? 4 : 2.8}" fill="${point.outOfControl ? '#ef4444' : accent}" />`)
    .join('')

  return `
    <div class="grr-chart-block">
      <div class="grr-chart-title">${escapeHtml(title)}</div>
      <svg viewBox="0 0 ${width} ${height}" class="grr-chart-svg" role="img" aria-label="${escapeHtml(title)}">
        <line x1="${padding.left}" y1="${y(chart.ucl)}" x2="${width - padding.right}" y2="${y(chart.ucl)}" stroke="#ef4444" stroke-dasharray="5 4" />
        <line x1="${padding.left}" y1="${y(chart.centerLine)}" x2="${width - padding.right}" y2="${y(chart.centerLine)}" stroke="#94a3b8" />
        <line x1="${padding.left}" y1="${y(chart.lcl)}" x2="${width - padding.right}" y2="${y(chart.lcl)}" stroke="${chart.lcl <= 1e-9 ? '#06b6d4' : '#ef4444'}" stroke-dasharray="4 5" />
        ${labels}
        <path d="${path}" fill="none" stroke="${accent}" stroke-width="1.5" />
        ${points}
      </svg>
    </div>
  `
}

function buildAppraiserSpreadRows(results: GrrResults, cfg: StudyConfig) {
  const colors = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
  const stats = results.appraiserStats
  const globalMin = Math.min(...stats.map((item) => item.min))
  const globalMax = Math.max(...stats.map((item) => item.max))
  const span = globalMax - globalMin || 1
  const position = (value: number) => ((value - globalMin) / span) * 100

  return stats
    .map((stat) => {
      const color = colors[stat.operator % colors.length]
      return `
        <div class="grr-spread-row">
          <div class="grr-spread-head">
            <span>${escapeHtml(cfg.operatorNames[stat.operator])}</span>
            <strong>Δ ${formatNumber(stat.spread, 3)}</strong>
          </div>
          <div class="grr-spread-track">
            <div class="grr-spread-band" style="left:${position(stat.min)}%;width:${position(stat.max) - position(stat.min)}%;background:${color}55"></div>
            <span class="grr-spread-tick" style="left:${position(stat.min)}%;background:${color}"></span>
            <span class="grr-spread-tick" style="left:${position(stat.max)}%;background:${color}"></span>
            <span class="grr-spread-dot" style="left:${position(stat.avg)}%;background:${color}"></span>
          </div>
          <div class="grr-spread-meta">min ${formatNumber(stat.min, 3)} · avg ${formatNumber(stat.avg, 3)} · max ${formatNumber(stat.max, 3)}</div>
        </div>
      `
    })
    .join('')
}

function buildVariationTable(results: GrrResults) {
  const [ev, av, pv] = results.components
  const rows = [
    { ...results.grr, key: 'GRR' },
    ev,
    av,
    pv,
    {
      key: 'TV',
      label: 'Total Variation (TV)',
      stdDev: results.totalVariation / 6,
      studyVar: results.totalVariation,
      pctContribution: 100,
      pctStudyVar: 100,
      pctTolerance: results.grr.pctTolerance * (results.totalVariation / (results.grr.studyVar || 1)),
    },
  ]

  return `
    <table class="grr-table">
      <thead>
        <tr>
          <th>Source</th>
          <th>Std Dev</th>
          <th>Study Var</th>
          <th>% Contrib</th>
          <th>% Study Var</th>
          <th>% Tol</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.label)}</td>
                <td>${formatNumber(row.stdDev, 4)}</td>
                <td>${formatNumber(row.studyVar, 4)}</td>
                <td>${formatNumber(row.pctContribution, 2)}</td>
                <td>${formatNumber(row.pctStudyVar, 2)}</td>
                <td>${formatNumber(row.pctTolerance, 2)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `
}

function buildAnovaTable(results: GrrResults) {
  return `
    <table class="grr-table">
      <thead>
        <tr>
          <th>Source</th>
          <th>DF</th>
          <th>SS</th>
          <th>MS</th>
          <th>F</th>
          <th>P</th>
        </tr>
      </thead>
      <tbody>
        ${results.anova.rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.label)}</td>
                <td>${row.df}</td>
                <td>${formatNullable(row.ss, 4)}</td>
                <td>${formatNullable(row.ms, 4)}</td>
                <td>${formatNullable(row.f, 3)}</td>
                <td>${formatPValue(row.p)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `
}

function buildOperatorSummaryTable(results: GrrResults, cfg: StudyConfig) {
  return `
    <table class="grr-table">
      <thead>
        <tr>
          <th>Appraiser</th>
          <th>Average</th>
          <th>Average Range</th>
          <th>Min</th>
          <th>Max</th>
          <th>Spread</th>
        </tr>
      </thead>
      <tbody>
        ${cfg.operatorNames
          .map((name, index) => {
            const stat = results.appraiserStats[index]
            return `
              <tr>
                <td>${escapeHtml(name)}</td>
                <td>${formatNumber(results.operatorAverages[index], 4)}</td>
                <td>${formatNumber(results.operatorRanges[index], 4)}</td>
                <td>${formatNumber(stat?.min ?? 0, 3)}</td>
                <td>${formatNumber(stat?.max ?? 0, 3)}</td>
                <td>${formatNumber(stat?.spread ?? 0, 3)}</td>
              </tr>
            `
          })
          .join('')}
      </tbody>
    </table>
  `
}

function buildStudyFactsGrid(meta: StudyMeta, cfg: StudyConfig, results: GrrResults) {
  const facts = [
    ['Part Name', meta.partName || '—'],
    ['Characteristic', meta.characteristic || '—'],
    ['Gage ID', meta.gageId || '—'],
    ['Date', meta.date || '—'],
    ['Parts', String(cfg.parts)],
    ['Appraisers', String(cfg.operators)],
    ['Trials', String(cfg.trials)],
    ['Alpha', formatNumber(cfg.alpha, 2)],
    ['USL', formatNumber(cfg.usl, 3)],
    ['LSL', formatNumber(cfg.lsl, 3)],
    ['Tolerance', formatNumber(results.tolerance, 3)],
    ['Historical Sigma', formatNumber(cfg.historicalSigma ?? 0, 3)],
  ]

  return facts
    .map(
      ([label, value]) => `
        <div class="grr-fact-card">
          <div class="grr-label">${escapeHtml(label)}</div>
          <div class="grr-value-sm">${escapeHtml(value)}</div>
        </div>
      `,
    )
    .join('')
}

function buildMetricCards(results: GrrResults) {
  const verdict = getVerdictMeta(results.verdict)
  return `
    <div class="grr-metric-card">
      <div class="grr-label">System Verdict</div>
      <div class="grr-value-lg" style="color:${verdict.accent}">${verdict.label}</div>
    </div>
    <div class="grr-metric-card">
      <div class="grr-label">% Gage R&R (Study Var)</div>
      <div class="grr-value-lg">${formatNumber(results.pctGrrStudyVar)}</div>
      <div class="grr-note">Target &lt; 10%</div>
    </div>
    <div class="grr-metric-card">
      <div class="grr-label">% Gage R&R (Tolerance)</div>
      <div class="grr-value-lg">${formatNumber(results.pctGrrTolerance)}</div>
      <div class="grr-note">6σ vs tolerance</div>
    </div>
    <div class="grr-metric-card">
      <div class="grr-label">NDC</div>
      <div class="grr-value-lg">${results.ndc}</div>
      <div class="grr-note">Target ≥ 5 groups</div>
    </div>
  `
}

type AppendixRow = {
  operatorName: string
  partName: string
  trials: number[]
  mean: number
  range: number
}

function buildAppendixRows(cfg: StudyConfig): AppendixRow[] {
  const rows: AppendixRow[] = []
  cfg.measurements.forEach((operatorRows, operatorIndex) => {
    operatorRows.forEach((trials, partIndex) => {
      rows.push({
        operatorName: cfg.operatorNames[operatorIndex] ?? `APPRAISER ${operatorIndex + 1}`,
        partName: cfg.partNames[partIndex] ?? `P${partIndex + 1}`,
        trials,
        mean: mean(trials),
        range: range(trials),
      })
    })
  })
  return rows
}

function chunkAppendixRows(rows: AppendixRow[], trials: number) {
  const rowsPerPage = trials <= 3 ? 24 : trials <= 5 ? 18 : 14
  const pages: AppendixRow[][] = []
  for (let index = 0; index < rows.length; index += rowsPerPage) {
    pages.push(rows.slice(index, index + rowsPerPage))
  }
  return pages
}

function buildAppendixTable(rows: AppendixRow[], trialCount: number) {
  return `
    <table class="grr-table grr-table-compact">
      <thead>
        <tr>
          <th>Appraiser</th>
          <th>Part</th>
          ${Array.from({ length: trialCount }, (_, index) => `<th>T${index + 1}</th>`).join('')}
          <th>Mean</th>
          <th>Range</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.operatorName)}</td>
                <td>${escapeHtml(row.partName)}</td>
                ${row.trials.map((value) => `<td>${formatNumber(value, 3)}</td>`).join('')}
                <td>${formatNumber(row.mean, 3)}</td>
                <td>${formatNumber(row.range, 3)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `
}

function buildPageShell(pageNumber: number, totalPages: number, title: string, subtitle: string, body: string) {
  return `
    <section class="grr-pdf-page">
      <header class="grr-page-header">
        <div>
          <div class="grr-page-kicker">GRR_AERO REPORT</div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div class="grr-page-number">Page ${pageNumber} / ${totalPages}</div>
      </header>
      <div class="grr-page-body">
        ${body}
      </div>
      <footer class="grr-page-footer">
        <span>Measurement System Analysis · Generated for daily GRR task report</span>
        <span>AIAG X-bar & R</span>
      </footer>
    </section>
  `
}

function buildGrrDocumentMarkup(options: {
  meta: StudyMeta
  cfg: StudyConfig
  results: GrrResults
}) {
  const { meta, cfg, results } = options
  const verdict = getVerdictMeta(results.verdict)
  const appendixPages = chunkAppendixRows(buildAppendixRows(cfg), cfg.trials)
  const totalPages = 3 + appendixPages.length

  const pages = [
    buildPageShell(
      1,
      totalPages,
      'Executive Summary',
      'Study metadata, KPI overview, diagnosis and measurement-system summary',
      `
        <section class="grr-cover-band" style="border-color:${verdict.accent}33;background:${verdict.soft}">
          <div>
            <div class="grr-eyebrow">Measurement System Analysis Report</div>
            <h1>GRR / Gage R&R Executive Summary</h1>
            <p>测量系统分析日报 · 可直接用于打印与导出 PDF 的正式报告版式</p>
          </div>
          <div class="grr-verdict" style="color:${verdict.accent};border-color:${verdict.accent}44;background:#ffffff">
            ${verdict.label}
          </div>
        </section>

        <section class="grr-grid grr-grid-4">${buildStudyFactsGrid(meta, cfg, results)}</section>

        <section class="grr-grid grr-grid-4">${buildMetricCards(results)}</section>

        <section class="grr-card grr-card-emphasis">
          <div class="grr-section-title">Diagnosis / Root-Cause Diagnostic</div>
          <div class="grr-diagnosis-title">${escapeHtml(results.diagnosis.title)}</div>
          <p class="grr-diagnosis-copy">${escapeHtml(results.diagnosis.detail)}</p>
        </section>

        <section class="grr-grid grr-grid-2">
          <div class="grr-card">
            <div class="grr-section-title">Components of Variation</div>
            ${buildVariationBarRows(results)}
          </div>
          <div class="grr-card">
            <div class="grr-section-title">Appraiser Spread</div>
            ${buildAppraiserSpreadRows(results, cfg)}
          </div>
        </section>
      `,
    ),
    buildPageShell(
      2,
      totalPages,
      'Analytical Tables',
      'Variance decomposition, ANOVA output, and operator-level statistics',
      `
        <section class="grr-card">
          <div class="grr-section-title">Variance Decomposition / 方差分解</div>
          ${buildVariationTable(results)}
        </section>

        <section class="grr-card">
          <div class="grr-section-title">ANOVA Statistics / 方差分析</div>
          ${buildAnovaTable(results)}
          <p class="grr-footnote">
            Interaction P = ${formatPValue(results.anova.interactionP)} · α = ${formatNumber(results.anova.alpha, 2)} ·
            ${results.anova.pooled ? 'interaction pooled into repeatability' : 'interaction retained as significant'}
          </p>
        </section>

        <section class="grr-grid grr-grid-2">
          <div class="grr-card">
            <div class="grr-section-title">Study Facts</div>
            <div class="grr-mini-grid">
              <div><span class="grr-label">Total Variation</span><strong>${formatNumber(results.totalVariation, 4)}</strong></div>
              <div><span class="grr-label">Grand Mean</span><strong>${formatNumber(results.grandMean, 4)}</strong></div>
              <div><span class="grr-label">Tolerance</span><strong>${formatNumber(results.tolerance, 4)}</strong></div>
              <div><span class="grr-label">Historical Sigma Used</span><strong>${results.usingHistoricalSigma ? 'Yes' : 'No'}</strong></div>
            </div>
          </div>
          <div class="grr-card">
            <div class="grr-section-title">Operator Summary</div>
            ${buildOperatorSummaryTable(results, cfg)}
          </div>
        </section>
      `,
    ),
    buildPageShell(
      3,
      totalPages,
      'Diagnostic Visualizations',
      'Distribution, interaction, and control-chart diagnostics',
      `
        <section class="grr-card">
          <div class="grr-section-title">Run Chart / 原始数据分布</div>
          ${buildRunChartSvg(results, cfg)}
        </section>

        <section class="grr-card">
          <div class="grr-section-title">Appraiser × Part Interaction / 评价人与零件交互作用图</div>
          ${buildInteractionSvg(results, cfg)}
        </section>

        <section class="grr-grid grr-grid-2">
          <div class="grr-card">${buildControlChartSvg(results.xbarChart, cfg.operatorNames, 'X̄ Chart', '#0ea5e9')}</div>
          <div class="grr-card">${buildControlChartSvg(results.rChart, cfg.operatorNames, 'R Chart', '#f59e0b')}</div>
        </section>
      `,
    ),
    ...appendixPages.map((rows, index) =>
      buildPageShell(
        4 + index,
        totalPages,
        'Raw Data Appendix',
        'Operator-part raw measurement matrix with mean and range by row',
        `
          <section class="grr-card">
            <div class="grr-section-title">Raw Measurement Matrix / 原始测量附录</div>
            ${buildAppendixTable(rows, cfg.trials)}
          </section>
        `,
      ),
    ),
  ]

  return pages.join('')
}

function buildGrrDocumentCss() {
  return `
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #f3f6fa;
      color: #0f172a;
      font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
    }
    .grr-pdf-page {
      width: ${PAGE_WIDTH_MM}mm;
      min-height: ${PAGE_HEIGHT_MM}mm;
      padding: ${PAGE_MARGIN_MM}mm;
      background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      page-break-after: always;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .grr-pdf-page:last-child { page-break-after: auto; }
    .grr-page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      border-bottom: 2px solid #dbe4ee;
      padding-bottom: 10px;
    }
    .grr-page-kicker, .grr-eyebrow {
      font-size: 10px;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: #64748b;
    }
    .grr-page-header h2, .grr-cover-band h1 {
      margin: 5px 0 4px;
      font-size: 22px;
      line-height: 1.15;
      color: #0f172a;
    }
    .grr-page-header p, .grr-cover-band p {
      margin: 0;
      font-size: 11px;
      color: #64748b;
    }
    .grr-page-number {
      border-radius: 999px;
      background: #eff4f9;
      color: #334155;
      padding: 6px 10px;
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
    }
    .grr-page-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }
    .grr-page-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-top: 1px solid #dbe4ee;
      padding-top: 7px;
      font-size: 9px;
      color: #64748b;
    }
    .grr-cover-band {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      border: 1px solid;
      border-radius: 16px;
      padding: 14px 16px;
    }
    .grr-verdict {
      border: 1px solid;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .grr-grid { display: grid; gap: 10px; }
    .grr-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .grr-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grr-card, .grr-fact-card, .grr-metric-card {
      border: 1px solid #d8e1eb;
      border-radius: 14px;
      background: #ffffff;
    }
    .grr-card { padding: 11px 12px; }
    .grr-card-emphasis {
      background: linear-gradient(180deg, #f8fbff, #ffffff);
      border-color: #cdd9e6;
    }
    .grr-fact-card, .grr-metric-card { padding: 10px 12px; }
    .grr-label {
      display: block;
      margin-bottom: 6px;
      font-size: 9px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #64748b;
    }
    .grr-value-lg {
      font-size: 24px;
      font-weight: 800;
      line-height: 1.1;
      color: #0f172a;
    }
    .grr-value-sm {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.35;
      color: #111827;
      word-break: break-word;
    }
    .grr-note {
      margin-top: 4px;
      font-size: 10px;
      color: #64748b;
    }
    .grr-section-title {
      margin-bottom: 9px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #1e293b;
    }
    .grr-diagnosis-title {
      margin-bottom: 6px;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .grr-diagnosis-copy {
      margin: 0;
      font-size: 11px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-wrap;
    }
    .grr-mini-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 14px;
    }
    .grr-mini-grid strong {
      display: block;
      font-size: 13px;
      color: #0f172a;
    }
    .grr-bar-row + .grr-bar-row { margin-top: 10px; }
    .grr-bar-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      font-weight: 700;
      color: #1f2937;
    }
    .grr-bar-track {
      height: 8px;
      border-radius: 999px;
      background: #e5e7eb;
      overflow: hidden;
      margin-top: 6px;
    }
    .grr-bar-fill { height: 100%; border-radius: 999px; }
    .grr-bar-meta {
      margin-top: 4px;
      font-size: 9px;
      color: #64748b;
    }
    .grr-spread-row + .grr-spread-row { margin-top: 12px; }
    .grr-spread-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      font-weight: 700;
      color: #1f2937;
    }
    .grr-spread-track {
      position: relative;
      height: 12px;
      border-radius: 999px;
      background: #e5e7eb;
      margin-top: 7px;
    }
    .grr-spread-band { position: absolute; top: 0; height: 100%; border-radius: 999px; }
    .grr-spread-tick { position: absolute; top: -2px; width: 2px; height: 16px; transform: translateX(-1px); }
    .grr-spread-dot {
      position: absolute;
      top: 50%;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      transform: translate(-50%, -50%);
      border: 2px solid #ffffff;
    }
    .grr-spread-meta {
      margin-top: 5px;
      font-size: 9px;
      color: #64748b;
    }
    .grr-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      table-layout: fixed;
    }
    .grr-table th, .grr-table td {
      border: 1px solid #d7dee8;
      padding: 5px 6px;
      vertical-align: top;
      word-break: break-word;
    }
    .grr-table th {
      background: #eff3f8;
      color: #334155;
      text-align: left;
      font-weight: 700;
    }
    .grr-table-compact { font-size: 8.6px; }
    .grr-footnote {
      margin: 8px 0 0;
      font-size: 9px;
      color: #64748b;
    }
    .grr-chart-svg {
      width: 100%;
      height: auto;
      display: block;
      background: #ffffff;
    }
    .grr-chart-block { width: 100%; }
    .grr-chart-title {
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #1f2937;
    }
  `
}

function buildExportHost(options: { meta: StudyMeta; cfg: StudyConfig; results: GrrResults }) {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = `${PAGE_WIDTH_MM}mm`
  host.innerHTML = `<style>${buildGrrDocumentCss()}</style>${buildGrrDocumentMarkup(options)}`
  return host
}

async function waitForHostReady(host: HTMLElement) {
  if ('fonts' in document) {
    await document.fonts.ready
  }

  const images = Array.from(host.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          const img = image as HTMLImageElement
          if (img.complete) {
            resolve()
            return
          }

          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        }),
    ),
  )
}

async function renderPagesFromOptions(options: {
  meta: StudyMeta
  cfg: StudyConfig
  results: GrrResults
}): Promise<string[]> {
  const { default: html2canvas } = await import('html2canvas')
  const host = buildExportHost(options)
  document.body.appendChild(host)

  try {
    await waitForHostReady(host)
    const pageNodes = Array.from(host.querySelectorAll('.grr-pdf-page')) as HTMLElement[]
    if (pageNodes.length === 0) {
      throw new Error('GRR report template failed to render')
    }

    const pages: string[] = []
    for (const pageNode of pageNodes) {
      const canvas = await html2canvas(pageNode, {
        scale: 2.2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: pageNode.offsetWidth,
        height: pageNode.offsetHeight,
        windowWidth: pageNode.offsetWidth,
        windowHeight: pageNode.offsetHeight,
        imageTimeout: 0,
      })
      pages.push(canvas.toDataURL('image/png', 1))
    }

    return pages
  } finally {
    host.remove()
  }
}

export async function exportGrrPdf(options: {
  meta: StudyMeta
  cfg: StudyConfig
  results: GrrResults
  fileBaseName: string
}) {
  const pages = await renderPagesFromOptions(options)
  if (pages.length === 0) {
    throw new Error('当前没有可导出的 GRR 报告内容')
  }

  const jspdfModule = await import('jspdf')
  const jsPDF = jspdfModule.jsPDF || jspdfModule.default
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: false,
  })

  pages.forEach((page, index) => {
    if (index > 0) {
      pdf.addPage('a4', 'portrait')
    }
    pdf.addImage(page, 'PNG', 0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM, `grr-page-${index + 1}`, 'FAST')
  })

  pdf.save(`${options.fileBaseName}.pdf`)
}

function buildPrintPreviewHtml(title: string, options: {
  meta: StudyMeta
  cfg: StudyConfig
  results: GrrResults
}) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} 打印预览</title>
    <style>
      ${buildGrrDocumentCss()}
      @page { size: A4 portrait; margin: 0; }
      html, body { background: #e5e7eb; }
      .grr-preview-toolbar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        background: rgba(2, 6, 23, 0.92);
        color: #e2e8f0;
      }
      .grr-preview-title { font-size: 15px; font-weight: 700; }
      .grr-preview-meta { margin-top: 4px; font-size: 12px; color: #94a3b8; }
      .grr-preview-actions { display: flex; gap: 10px; }
      .grr-preview-button {
        border: 0;
        border-radius: 999px;
        padding: 10px 18px;
        background: #38bdf8;
        color: #082f49;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .grr-preview-button.secondary { background: rgba(148, 163, 184, 0.18); color: #e2e8f0; }
      .grr-preview-shell { padding: 24px 0 48px; }
      .grr-pdf-page { margin: 0 auto 20px; box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18); }
      @media print {
        html, body { background: #ffffff; }
        .grr-preview-toolbar { display: none !important; }
        .grr-preview-shell { padding: 0; }
        .grr-pdf-page { margin: 0; box-shadow: none; }
      }
    </style>
  </head>
  <body>
    <div class="grr-preview-toolbar">
      <div>
        <div class="grr-preview-title">${escapeHtml(title)} 打印预览</div>
        <div class="grr-preview-meta">A4 连续报告模板。先预览分页，再点击右侧按钮打印。</div>
      </div>
      <div class="grr-preview-actions">
        <button class="grr-preview-button secondary" type="button" onclick="window.close()">关闭预览</button>
        <button class="grr-preview-button" type="button" onclick="window.print()">打印</button>
      </div>
    </div>
    <main class="grr-preview-shell">${buildGrrDocumentMarkup(options)}</main>
  </body>
</html>`
}

export async function printGrrReport(options: {
  meta: StudyMeta
  cfg: StudyConfig
  results: GrrResults
  fileBaseName: string
}) {
  const previewHtml = buildPrintPreviewHtml(options.fileBaseName, options)
  const previewBlob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' })
  const previewUrl = URL.createObjectURL(previewBlob)
  const previewWindow = window.open(previewUrl, '_blank', PREVIEW_WINDOW_FEATURES)

  if (!previewWindow) {
    URL.revokeObjectURL(previewUrl)
    throw new Error('打印预览窗口被浏览器拦截，请允许弹窗后重试')
  }

  previewWindow.addEventListener(
    'beforeunload',
    () => {
      URL.revokeObjectURL(previewUrl)
    },
    { once: true },
  )
  previewWindow.focus()
}

export function buildGrrReportFileBaseName(meta: {
  partName?: string
  characteristic?: string
  date?: string
}) {
  return buildFileBaseName(meta)
}
