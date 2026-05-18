import type { PfmeaHeaderFields } from "@/components/pfmea/pfmea-context-header"
import { getPfmeaRiskBand, isCriticalPfmeaRisk, type PfmeaRow } from "@/lib/pfmea-data"

type ExportPfmeaPdfOptions = {
  rows: PfmeaRow[]
  contextLabel: string
  contextOwner: string
  activeNodeId: string
  headerFields: PfmeaHeaderFields
}

type ExportColumn = {
  id: string
  label: string
  width: number
  align?: "left" | "center"
  wrap?: boolean
  render: (row: PfmeaRow, index: number) => string
}

type ExportRowItem = {
  row: PfmeaRow
  index: number
}

const PAGE_WIDTH_MM = 297
const PAGE_HEIGHT_MM = 210
const PAGE_MARGIN_MM = 6
const PX_PER_MM = 96 / 25.4
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2
const CONTENT_WIDTH_PX = Math.round(CONTENT_WIDTH_MM * PX_PER_MM)
const CONTENT_HEIGHT_PX = Math.round(CONTENT_HEIGHT_MM * PX_PER_MM)
const HEADER_HEIGHT_PX = 92
const TABLE_HEADER_HEIGHT_PX = 28
const SUMMARY_HEIGHT_PX = 22
const TABLE_BODY_HEIGHT_PX =
  CONTENT_HEIGHT_PX - HEADER_HEIGHT_PX - SUMMARY_HEIGHT_PX - TABLE_HEADER_HEIGHT_PX - 8
const BASE_ROW_HEIGHT_PX = 24
const WRAP_LINE_HEIGHT_PX = 11
const WRAP_ROW_PADDING_PX = 10

const columns: ExportColumn[] = [
  { id: "seq", label: "#", width: 28, align: "center", render: (_row, index) => String(index + 1) },
  { id: "process", label: "工序步骤", width: 100, wrap: true, render: (row) => row.process || "-" },
  { id: "requirement", label: "工序要求", width: 126, wrap: true, render: (row) => row.requirement || "-" },
  { id: "effect", label: "失效影响", width: 114, wrap: true, render: (row) => row.effect || "-" },
  { id: "sev", label: "S", width: 24, align: "center", render: (row) => String(row.sev) },
  { id: "cause", label: "根本原因", width: 122, wrap: true, render: (row) => row.cause || "-" },
  { id: "occ", label: "O", width: 24, align: "center", render: (row) => String(row.occ) },
  { id: "pc", label: "预防控制", width: 118, wrap: true, render: (row) => row.pc || "-" },
  { id: "dc", label: "探测控制", width: 118, wrap: true, render: (row) => row.dc || "-" },
  { id: "det", label: "D", width: 24, align: "center", render: (row) => String(row.det) },
  { id: "rpn", label: "RPN", width: 40, align: "center", render: (row) => String(row.rpn) },
  { id: "action", label: "建议措施", width: 122, wrap: true, render: (row) => row.action || "-" },
  { id: "ownerGate", label: "责任人", width: 56, wrap: true, render: (row) => row.ownerGate || "-" },
  { id: "status", label: "状态", width: 52, align: "center", render: (row) => getStatusLabel(row.status) },
]

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function getStatusLabel(status: PfmeaRow["status"]) {
  if (status === "closed") return "已闭环"
  if (status === "testing") return "验证中"
  return "待处理"
}

function getStatusClass(status: PfmeaRow["status"]) {
  if (status === "closed") return "status-text status-text-closed"
  if (status === "testing") return "status-text status-text-testing"
  return "status-text status-text-pending"
}

function getRpnCellClass(row: PfmeaRow) {
  if (isCriticalPfmeaRisk(row.sev, row.rpn)) {
    return "rpn-critical"
  }

  if (getPfmeaRiskBand(row.sev, row.rpn) === "warning") {
    return "rpn-warning"
  }

  return "rpn-safe"
}

function estimateWrappedLineCount(column: ExportColumn, value: string) {
  if (!column.wrap) {
    return 1
  }

  const normalized = normalizeText(value || "-")
  const charsPerLine = Math.max(4, Math.floor((column.width - 10) / 7))
  return Math.max(1, Math.ceil(Array.from(normalized).length / charsPerLine))
}

function estimateRowHeight(row: PfmeaRow, index: number) {
  const maxLines = columns.reduce((highest, column) => {
    const rendered = column.render(row, index)
    return Math.max(highest, estimateWrappedLineCount(column, rendered))
  }, 1)

  return Math.max(BASE_ROW_HEIGHT_PX, maxLines * WRAP_LINE_HEIGHT_PX + WRAP_ROW_PADDING_PX)
}

function splitRowsIntoPages(rows: PfmeaRow[]) {
  const pages: ExportRowItem[][] = []
  let currentPage: ExportRowItem[] = []
  let currentHeight = 0

  rows.forEach((row, index) => {
    const rowHeight = estimateRowHeight(row, index)

    if (currentPage.length > 0 && currentHeight + rowHeight > TABLE_BODY_HEIGHT_PX) {
      pages.push(currentPage)
      currentPage = []
      currentHeight = 0
    }

    currentPage.push({ row, index })
    currentHeight += rowHeight
  })

  if (currentPage.length > 0) {
    pages.push(currentPage)
  }

  return pages.length > 0 ? pages : [[]]
}

function buildHeaderFieldsMarkup(headerFields: PfmeaHeaderFields) {
  const items: Array<{ label: string; value: string }> = [
    { label: "项目名称", value: headerFields.projectName || "" },
    { label: "产品/机种", value: headerFields.partNumber || "" },
    { label: "责任部门", value: headerFields.owner || "" },
    { label: "评审日期", value: headerFields.reviewDate || "" },
  ]

  return items
    .map(
      (item) => `
        <div class="fmea-header-field">
          <span class="fmea-header-field-label">${escapeHtml(item.label)}：</span>
          <strong class="fmea-header-field-value">${escapeHtml(item.value || "______")}</strong>
        </div>
      `
    )
    .join("")
}

function buildPageMarkup(
  pageRows: ExportRowItem[],
  pageIndex: number,
  pageCount: number,
  contextLabel: string,
  contextOwner: string,
  totalRows: number,
  headerFields: PfmeaHeaderFields
) {
  const colGroup = columns.map((column) => `<col style="width:${column.width}px" />`).join("")

  const tableHead = columns
    .map((column) => {
      const alignClass = column.align === "center" ? "align-center" : ""
      return `<th class="${alignClass}">${escapeHtml(column.label)}</th>`
    })
    .join("")

  const tableRows = pageRows
    .map(({ row, index }) => {
      const cells = columns
        .map((column) => {
          const alignClass = column.align === "center" ? "align-center" : ""
          const wrapClass = column.wrap ? "wrap-cell" : "nowrap-cell"
          const content = escapeHtml(column.render(row, index))

          if (column.id === "rpn") {
            return `<td class="${alignClass} ${wrapClass} ${getRpnCellClass(row)}">${content}</td>`
          }

          if (column.id === "status") {
            return `<td class="${alignClass} ${wrapClass}"><span class="${getStatusClass(row.status)}">${content}</span></td>`
          }

          return `<td class="${alignClass} ${wrapClass}">${content}</td>`
        })
        .join("")

      const rowTone = isCriticalPfmeaRisk(row.sev, row.rpn) ? "critical-row" : ""
      return `<tr class="${rowTone}">${cells}</tr>`
    })
    .join("")

  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

  return `
    <div class="fmea-pdf-page">
      <div class="fmea-page-header">
        <div class="fmea-title-block">
          <div class="fmea-title">PFMEA REPORT</div>
          <div class="fmea-subtitle">${escapeHtml(contextLabel || "PFMEA Analysis")}</div>
        </div>
        <div class="fmea-meta">
          <div><span>责任节点</span><strong>${escapeHtml(contextOwner || "-")}</strong></div>
          <div><span>导出时间</span><strong>${escapeHtml(timestamp)}</strong></div>
          <div><span>页码</span><strong>${pageIndex + 1} / ${pageCount}</strong></div>
        </div>
      </div>
      <div class="fmea-header-fields">${buildHeaderFieldsMarkup(headerFields)}</div>
      <div class="fmea-summary">
        <span>本页行数 ${pageRows.length}</span>
        <span>总行数 ${totalRows}</span>
      </div>
      <table class="fmea-table">
        <colgroup>${colGroup}</colgroup>
        <thead><tr>${tableHead}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `
}

function buildExportHost(
  rows: PfmeaRow[],
  contextLabel: string,
  contextOwner: string,
  headerFields: PfmeaHeaderFields
) {
  const pages = splitRowsIntoPages(rows)

  const host = document.createElement("div")
  host.style.position = "fixed"
  host.style.left = "-100000px"
  host.style.top = "0"
  host.style.width = `${CONTENT_WIDTH_PX}px`
  host.style.pointerEvents = "none"
  host.style.opacity = "0"
  host.style.zIndex = "-1"

  host.innerHTML = `
    <style>
      .fmea-pdf-page {
        width: ${CONTENT_WIDTH_PX}px;
        height: ${CONTENT_HEIGHT_PX}px;
        box-sizing: border-box;
        overflow: hidden;
        background: #ffffff;
        color: #0f172a;
        font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
      }

      .fmea-page-header {
        height: ${HEADER_HEIGHT_PX}px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .fmea-title-block {
        min-width: 0;
      }

      .fmea-title {
        font-size: 18px;
        line-height: 1.1;
        font-weight: 700;
        letter-spacing: 0.08em;
      }

      .fmea-subtitle {
        margin-top: 6px;
        font-size: 11px;
        line-height: 1.2;
        color: #64748b;
        white-space: normal;
        word-break: break-all;
      }

      .fmea-meta {
        display: grid;
        gap: 4px;
        min-width: 190px;
        font-size: 10px;
        text-align: right;
      }

      .fmea-meta div {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }

      .fmea-meta span {
        color: #64748b;
      }

      .fmea-meta strong {
        font-weight: 600;
        color: #0f172a;
      }

      .fmea-header-fields {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 4px;
      }

      .fmea-header-field {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 1px 0;
      }

      .fmea-header-field-label {
        flex: 0 0 auto;
        font-size: 9px;
        line-height: 1.2;
        color: #334155;
        white-space: nowrap;
      }

      .fmea-header-field-value {
        display: inline-flex;
        align-items: flex-end;
        width: 128px;
        min-width: 128px;
        max-width: 128px;
        padding: 0 2px 1px;
        font-size: 9px;
        line-height: 1.2;
        font-weight: 600;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: inset 0 -1px 0 #94a3b8;
      }

      .fmea-summary {
        height: ${SUMMARY_HEIGHT_PX}px;
        display: flex;
        align-items: center;
        gap: 16px;
        font-size: 10px;
        color: #64748b;
      }

      .fmea-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .fmea-table thead th {
        height: ${TABLE_HEADER_HEIGHT_PX}px;
        border: 1px solid #cbd5e1;
        background: #0f172a;
        color: #f8fafc;
        padding: 4px 5px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-align: left;
        white-space: nowrap;
      }

      .fmea-table tbody td {
        min-height: ${BASE_ROW_HEIGHT_PX}px;
        border: 1px solid #dbe4ee;
        padding: 4px 5px;
        font-size: 8.6px;
        line-height: 1.25;
        vertical-align: top;
      }

      .align-center {
        text-align: center !important;
      }

      .nowrap-cell {
        white-space: nowrap;
      }

      .wrap-cell {
        white-space: normal;
        word-break: break-all;
        line-break: anywhere;
        overflow: visible;
      }

      .critical-row td:first-child {
        border-left: 2px solid #dc2626;
      }

      .rpn-critical {
        color: #dc2626;
        font-weight: 700;
        background: #fef2f2;
      }

      .rpn-warning {
        color: #d97706;
        font-weight: 700;
      }

      .rpn-safe {
        color: #047857;
        font-weight: 700;
      }

      .status-text {
        display: inline-block;
        font-size: 9px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
      }

      .status-text-pending {
        color: #c2410c;
      }

      .status-text-testing {
        color: #2563eb;
      }

      .status-text-closed {
        color: #64748b;
      }
    </style>
    ${pages
      .map((pageRows, pageIndex) =>
        buildPageMarkup(
          pageRows,
          pageIndex,
          pages.length,
          contextLabel,
          contextOwner,
          rows.length,
          headerFields
        )
      )
      .join("")}
  `

  return { host, pageCount: pages.length }
}

function buildFileName(activeNodeId: string) {
  const date = new Date().toISOString().slice(0, 10)
  return `pfmea-${activeNodeId}-${date}.pdf`
}

export async function exportPfmeaPdf({
  rows,
  contextLabel,
  contextOwner,
  activeNodeId,
  headerFields,
}: ExportPfmeaPdfOptions) {
  if (rows.length === 0) {
    throw new Error("当前没有可导出的 PFMEA 数据")
  }

  const { default: html2canvas } = await import("html2canvas")
  const jspdfModule = await import("jspdf")
  const jsPDF = jspdfModule.jsPDF || jspdfModule.default

  const { host, pageCount } = buildExportHost(rows, contextLabel, contextOwner, headerFields)
  document.body.appendChild(host)

  try {
    if ("fonts" in document) {
      await document.fonts.ready
    }

    const pageNodes = Array.from(host.querySelectorAll(".fmea-pdf-page")) as HTMLElement[]
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
      compress: false,
    })

    for (let index = 0; index < pageNodes.length; index += 1) {
      const pageNode = pageNodes[index]
      const canvas = await html2canvas(pageNode, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: CONTENT_WIDTH_PX,
        height: CONTENT_HEIGHT_PX,
        windowWidth: CONTENT_WIDTH_PX,
        windowHeight: CONTENT_HEIGHT_PX,
        imageTimeout: 0,
      })

      if (index > 0) {
        pdf.addPage("a4", "landscape")
      }

      pdf.addImage(
        canvas.toDataURL("image/png", 1),
        "PNG",
        PAGE_MARGIN_MM,
        PAGE_MARGIN_MM,
        CONTENT_WIDTH_MM,
        CONTENT_HEIGHT_MM,
        `pfmea-page-${index + 1}-of-${pageCount}`,
        "FAST"
      )
    }

    pdf.save(buildFileName(activeNodeId))
  } finally {
    host.remove()
  }
}

export function printPfmeaDocument({
  rows,
  contextLabel,
  contextOwner,
  activeNodeId: _activeNodeId,
  headerFields,
}: ExportPfmeaPdfOptions) {
  if (rows.length === 0) {
    throw new Error("当前没有可打印的 PFMEA 数据")
  }

  const { host } = buildExportHost(rows, contextLabel, contextOwner, headerFields)

  try {
    const styleMatch = host.innerHTML.match(/<style>[\s\S]*?<\/style>/)
    const embeddedStyle = styleMatch ? styleMatch[0] : ""
    const contentMarkup = host.innerHTML.replace(/<style>[\s\S]*?<\/style>/, "")
    const previewHtml = `
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>PFMEA Print Preview</title>
          ${embeddedStyle}
          <style>
            @page {
              size: A4 landscape;
              margin: ${PAGE_MARGIN_MM}mm;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #e5e7eb;
              font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
            }

            body {
              padding: 12px 0;
            }

            .preview-toolbar {
              position: sticky;
              top: 0;
              z-index: 20;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 12px 20px;
              border-bottom: 1px solid rgba(148, 163, 184, 0.24);
              background: rgba(15, 23, 42, 0.92);
              backdrop-filter: blur(14px);
              -webkit-backdrop-filter: blur(14px);
            }

            .preview-toolbar__title {
              color: #e2e8f0;
              font-size: 14px;
              font-weight: 600;
              letter-spacing: 0.04em;
            }

            .preview-toolbar__meta {
              margin-top: 2px;
              color: #94a3b8;
              font-size: 11px;
            }

            .preview-toolbar__actions {
              display: flex;
              align-items: center;
              gap: 10px;
            }

            .preview-button {
              border: 1px solid rgba(56, 189, 248, 0.32);
              background: rgba(8, 145, 178, 0.18);
              color: #67e8f9;
              border-radius: 10px;
              padding: 8px 14px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
              transition: background 0.2s ease, border-color 0.2s ease;
            }

            .preview-button:hover {
              background: rgba(8, 145, 178, 0.28);
              border-color: rgba(103, 232, 249, 0.46);
            }

            .preview-button--ghost {
              border-color: rgba(148, 163, 184, 0.24);
              background: transparent;
              color: #cbd5e1;
            }

            .preview-button--ghost:hover {
              background: rgba(148, 163, 184, 0.12);
              border-color: rgba(148, 163, 184, 0.4);
            }

            .print-shell {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 12px;
              padding: 12px 0 18px;
            }

            .fmea-pdf-page {
              box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
            }

            @media print {
              html, body {
                background: #ffffff;
              }

              body {
                padding: 0;
              }

              .preview-toolbar {
                display: none !important;
              }

              .print-shell {
                gap: 0;
                padding: 0;
              }

              .fmea-pdf-page {
                box-shadow: none;
                page-break-after: always;
              }

              .fmea-pdf-page:last-child {
                page-break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="preview-toolbar">
            <div>
              <div class="preview-toolbar__title">PFMEA 打印预览</div>
              <div class="preview-toolbar__meta">先检查版式与分页，确认后再点击打印</div>
            </div>
            <div class="preview-toolbar__actions">
              <button type="button" class="preview-button preview-button--ghost" onclick="window.close()">关闭</button>
              <button type="button" class="preview-button" onclick="window.print()">打印</button>
            </div>
          </div>
          <div class="print-shell">${contentMarkup}</div>
        </body>
      </html>
    `
    const previewBlob = new Blob([previewHtml], {
      type: "text/html;charset=utf-8",
    })
    const previewUrl = URL.createObjectURL(previewBlob)
    const printWindow = window.open(previewUrl, "_blank")

    if (!printWindow) {
      URL.revokeObjectURL(previewUrl)
      throw new Error("打印预览窗口被浏览器拦截，请允许弹窗后重试")
    }
    printWindow.addEventListener(
      "beforeunload",
      () => {
        URL.revokeObjectURL(previewUrl)
      },
      { once: true }
    )
    printWindow.focus()
  } finally {
    host.remove()
  }
}
