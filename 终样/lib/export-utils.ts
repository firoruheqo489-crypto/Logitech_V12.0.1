import type { TestItem } from "./test-data"

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function timestamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

export function exportJSON(data: TestItem[]) {
  triggerDownload(
    JSON.stringify(data, null, 2),
    `测试项目数据_${timestamp()}.json`,
    "application/json;charset=utf-8",
  )
}

const CSV_HEADERS: { key: keyof TestItem; label: string }[] = [
  { key: "category", label: "类目" },
  { key: "id", label: "序号" },
  { key: "item", label: "测试项目" },
  { key: "status", label: "是否需求" },
  { key: "result", label: "测试结果及不合格点" },
  { key: "comment", label: "备注" },
]

function escapeCSV(value: string | number): string {
  const str = String(value ?? "")
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportCSV(data: TestItem[]) {
  const header = CSV_HEADERS.map((h) => h.label).join(",")
  const rows = data.map((row) =>
    CSV_HEADERS.map((h) => escapeCSV(row[h.key])).join(","),
  )
  // 添加 BOM 以便 Excel 正确识别 UTF-8 中文
  const csv = "\uFEFF" + [header, ...rows].join("\r\n")
  triggerDownload(csv, `测试项目数据_${timestamp()}.csv`, "text/csv;charset=utf-8")
}
