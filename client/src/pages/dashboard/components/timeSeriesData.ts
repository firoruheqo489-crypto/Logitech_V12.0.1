export type RangeKey = "1D" | "1W" | "1M" | "YTD" | "MAX";

export type TimeSeriesColumn = {
  id: string;
  label: string;
  color: string;
};

export type TimeSeriesRow = {
  id: string;
  timeLabel: string;
  values: Record<string, number>;
};

export type TimeSeriesDataset = {
  timeHeader: string;
  columns: TimeSeriesColumn[];
  rows: TimeSeriesRow[];
  sourceName: string;
  updatedAt: string;
};

type RangeConfig = {
  label: string;
};

const RANGE_CONFIG: Record<RangeKey, RangeConfig> = {
  "1D": { label: "短窗" },
  "1W": { label: "常规" },
  "1M": { label: "扩展" },
  YTD: { label: "累计" },
  MAX: { label: "全量" },
};

export const RANGES: RangeKey[] = ["1D", "1W", "1M", "YTD", "MAX"];

const DEFAULT_VALUES = [5, 6, 5, 6, 7, 6, 5, 4, 8, 5, 6, 4, 5, 3, 2, 5, 6, 7];

const DEFAULT_COLORS = [
  "#00f3ff",
  "#bc13fe",
  "#00ffa3",
  "#ffd60a",
  "#ff7a59",
  "#7dd3fc",
  "#f472b6",
  "#a3e635",
];

function buildColumnId(index: number) {
  return `column_${index + 1}`;
}

function getColumnColor(index: number) {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

function toDatasetTimestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function parseNumericValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(/[\s,，]/g, "");
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function excelSerialToLabel(serial: number, XLSX: typeof import("xlsx")) {
  try {
    const withSeconds = XLSX.SSF.format("yyyy/m/d h:mm:ss", serial);
    const [, timePart = ""] = withSeconds.split(" ");
    if (timePart.endsWith(":00")) {
      return XLSX.SSF.format("yyyy/m/d h:mm", serial);
    }
    return withSeconds;
  } catch {
    return String(serial);
  }
}

function normalizeTimeCell(value: unknown, XLSX?: typeof import("xlsx")) {
  if (typeof value === "number" && Number.isFinite(value) && XLSX) {
    if (value > 20000 && value < 60000) {
      return excelSerialToLabel(value, XLSX);
    }
    return String(value);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = (input: number) => String(input).padStart(2, "0");
    return `${value.getFullYear()}/${value.getMonth() + 1}/${value.getDate()} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  const text = String(value ?? "").trim();
  return text || "-";
}

function fallbackHeader(value: unknown, index: number) {
  const text = String(value ?? "").trim();
  return text || `数据列${String.fromCharCode(65 + index)}`;
}

function rowHasContent(row: unknown[]) {
  return row.some((cell) => String(cell ?? "").trim() !== "");
}

export function getRangeLabel(range: RangeKey) {
  return RANGE_CONFIG[range].label;
}

export function createDefaultDataset(): TimeSeriesDataset {
  const columns: TimeSeriesColumn[] = Array.from({ length: 5 }, (_, index) => ({
    id: buildColumnId(index),
    label: `数据列${String.fromCharCode(65 + index)}`,
    color: getColumnColor(index),
  }));

  const rows: TimeSeriesRow[] = DEFAULT_VALUES.map((value, index) => ({
    id: `row_${index + 1}`,
    timeLabel: `6月${index + 1}日`,
    values: Object.fromEntries(columns.map((column) => [column.id, value])),
  }));

  return {
    timeHeader: "时间",
    columns,
    rows,
    sourceName: "内置示例数据",
    updatedAt: toDatasetTimestamp(),
  };
}

export function buildChartWindowRows(rows: TimeSeriesRow[], range: RangeKey) {
  if (rows.length <= 2) return rows;

  const windowSizeMap: Record<RangeKey, number> = {
    "1D": Math.min(rows.length, 8),
    "1W": Math.min(rows.length, 18),
    "1M": Math.min(rows.length, 24),
    YTD: Math.min(rows.length, 36),
    MAX: rows.length,
  };

  const size = windowSizeMap[range];
  return rows.slice(Math.max(0, rows.length - size));
}

export async function parseTimeSeriesExcelFile(file: File): Promise<TimeSeriesDataset> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Excel 文件中没有可读取的工作表。");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  const rows = matrix.filter((row) => Array.isArray(row) && rowHasContent(row));
  if (rows.length < 2) {
    throw new Error("Excel 至少需要 1 行表头和 1 行数据。");
  }

  const headerRow = rows[0];
  const timeHeader = String(headerRow[0] ?? "").trim() || "时间";
  const sourceColumnCount = Math.max(1, headerRow.length - 1);

  const columns: TimeSeriesColumn[] = Array.from({ length: sourceColumnCount }, (_, index) => ({
    id: buildColumnId(index),
    label: fallbackHeader(headerRow[index + 1], index),
    color: getColumnColor(index),
  }));

  const dataRows: TimeSeriesRow[] = rows
    .slice(1)
    .filter((row) => rowHasContent(row))
    .map((row, rowIndex) => ({
      id: `row_${rowIndex + 1}`,
      timeLabel: normalizeTimeCell(row[0], XLSX),
      values: Object.fromEntries(
        columns.map((column, columnIndex) => [column.id, parseNumericValue(row[columnIndex + 1])]),
      ),
    }));

  if (dataRows.length === 0) {
    throw new Error("Excel 表中没有解析到有效数据行。");
  }

  return {
    timeHeader,
    columns,
    rows: dataRows,
    sourceName: file.name,
    updatedAt: toDatasetTimestamp(),
  };
}
