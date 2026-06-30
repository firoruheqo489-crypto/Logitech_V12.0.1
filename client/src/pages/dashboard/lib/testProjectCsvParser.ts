export type RequirementStatus = "√" | "×" | "";

export interface TestProjectRecord {
  category: string;
  id: number;
  item: string;
  status: RequirementStatus;
  result: string;
  comment: string;
}

export interface ParsedTestProjectFile {
  fileName: string;
  sheetName: string;
  category: string;
  rowCount: number;
}

export interface ParseTestProjectExcelResult {
  records: TestProjectRecord[];
  parsedFiles: ParsedTestProjectFile[];
  skippedFiles: string[];
}

const HEADER = ["序号", "项目", "测试结果及不合格点", "需求测试项目（√×）", "备注"] as const;
const STOP_KEYWORDS = ["成员签字", "成员签名"];
const SHEET_CATEGORY_SUFFIXES = [/测试项目$/u, /试项目$/u];

export const demoTestProjectRecords: TestProjectRecord[] = [
  { category: "球泡", id: 1, item: "终样通用测试", status: "√", result: "合格", comment: "" },
  { category: "球泡", id: 2, item: "积分球", status: "√", result: "合格", comment: "光效正常" },
  { category: "球泡", id: 3, item: "暗房", status: "×", result: "", comment: "本轮暂不测试" },
  { category: "壁灯", id: 1, item: "积分球", status: "√", result: "合格", comment: "" },
  { category: "壁灯", id: 2, item: "暗房", status: "√", result: "不合格：照度分布异常", comment: "需复核配光" },
  { category: "壁灯", id: 3, item: "防水", status: "√", result: "", comment: "模拟安装后复测" },
  { category: "路灯", id: 1, item: "谐波", status: "√", result: "合格", comment: "" },
  { category: "路灯", id: 2, item: "浪涌", status: "√", result: "合格", comment: "" },
  { category: "路灯", id: 3, item: "温升", status: "√", result: "", comment: "待实验室回填" },
];

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\ufeff/g, "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStatus(value: string): RequirementStatus {
  const cleaned = cleanText(value);
  if (cleaned === "√" || cleaned === "×") {
    return cleaned;
  }
  return "";
}

function normalizeDataRow(row: unknown[]): string[] {
  const cleaned = row.map((cell) => cleanText(cell));
  while (cleaned.length < HEADER.length) {
    cleaned.push("");
  }
  return cleaned.slice(0, HEADER.length);
}

function findHeaderIndex(rows: unknown[][]): number {
  const normalizedHeader = HEADER.map((item) => cleanText(item));
  return rows.findIndex((row) => {
    const normalizedRow = normalizeDataRow(row);
    return normalizedRow.every((cell, index) => cell === normalizedHeader[index]);
  });
}

function shouldStop(row: string[]): boolean {
  const joined = row.join(" ");
  return STOP_KEYWORDS.some((keyword) => joined.includes(keyword));
}

function normalizeSheetCategory(sheetName: string): string {
  let category = cleanText(sheetName);
  for (const pattern of SHEET_CATEGORY_SUFFIXES) {
    category = category.replace(pattern, "").trim();
  }
  return category || cleanText(sheetName);
}

function parseWorksheetRows(sheetName: string, rows: unknown[][]): TestProjectRecord[] {
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) {
    throw new Error(`未在工作表 ${sheetName} 中找到目标表头`);
  }

  const category = normalizeSheetCategory(sheetName);
  const records: TestProjectRecord[] = [];

  for (const rawRow of rows.slice(headerIndex + 1)) {
    const row = normalizeDataRow(rawRow);
    if (!row.some(Boolean)) {
      continue;
    }
    if (shouldStop(row)) {
      break;
    }
    if (!row[1]) {
      continue;
    }

    const numericId = Number.parseInt(row[0], 10);
    records.push({
      category,
      id: Number.isFinite(numericId) ? numericId : records.length + 1,
      item: row[1],
      result: row[2],
      status: normalizeStatus(row[3]),
      comment: row[4],
    });
  }

  return records;
}

export async function parseTestProjectExcelFiles(files: File[]): Promise<ParseTestProjectExcelResult> {
  const workbookFiles = [...files].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  const parsedFiles: ParsedTestProjectFile[] = [];
  const skippedFiles: string[] = [];
  const records: TestProjectRecord[] = [];
  const XLSX = await import("xlsx");

  for (const file of workbookFiles) {
    if (!/\.(xls|xlsx)$/iu.test(file.name)) {
      skippedFiles.push(file.name);
      continue;
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    let parsedSheetCountForWorkbook = 0;

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        continue;
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        raw: false,
        blankrows: true,
        defval: "",
      });

      if (!Array.isArray(rows) || rows.length === 0) {
        continue;
      }

      const headerIndex = findHeaderIndex(rows);
      if (headerIndex < 0) {
        continue;
      }

      const sheetRecords = parseWorksheetRows(sheetName, rows);
      parsedSheetCountForWorkbook += 1;
      parsedFiles.push({
        fileName: file.name,
        sheetName,
        category: normalizeSheetCategory(sheetName),
        rowCount: sheetRecords.length,
      });
      records.push(...sheetRecords);
    }

    if (parsedSheetCountForWorkbook === 0) {
      skippedFiles.push(file.name);
    }
  }

  return { records, parsedFiles, skippedFiles };
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function timestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function escapeCsvCell(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportTestProjectJson(records: TestProjectRecord[]) {
  triggerDownload(
    JSON.stringify(records, null, 2),
    `master_test_projects_${timestamp()}.json`,
    "application/json;charset=utf-8",
  );
}

export function exportTestProjectCsv(records: TestProjectRecord[]) {
  const header = ["类目", "序号", "项目", "测试结果及不合格点", "需求测试项目（√×）", "备注"];
  const rows = records.map((record) =>
    [record.category, record.id, record.item, record.result, record.status, record.comment]
      .map((value) => escapeCsvCell(value))
      .join(","),
  );
  const csv = `\uFEFF${[header.join(","), ...rows].join("\r\n")}`;
  triggerDownload(csv, `master_test_projects_${timestamp()}.csv`, "text/csv;charset=utf-8");
}
