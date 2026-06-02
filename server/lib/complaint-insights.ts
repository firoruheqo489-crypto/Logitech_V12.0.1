import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

export type ComplaintInsightRow = {
  id: number;
  occurredAt: string;
  year: number;
  month: number;
  issueDescription: string;
  causeCategory: string;
  causeAnalysis: string;
  temporaryAction: string;
  longTermAction: string;
  rootSolved: string;
};

export type ComplaintMonthlyPoint = {
  month: string;
  count: number;
};

export type ComplaintCategoryBreakdown = {
  name: string;
  count: number;
  percentage: number;
};

export type ComplaintWarningSignal = {
  mode: "问题描述重复" | "原因分析相似重复";
  label: string;
  repeatCount: number;
  repeatMonths: string[];
  lastSeen: string;
};

export type ComplaintInsightsPayload = {
  sourceFile: string;
  lastUpdated: string;
  rowCount: number;
  monthlySeries: ComplaintMonthlyPoint[];
  categoryBreakdown: ComplaintCategoryBreakdown[];
  warnings: ComplaintWarningSignal[];
  rows: ComplaintInsightRow[];
};

type ExcelRecord = Record<string, unknown>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const complaintWorkbookPath = path.resolve(__dirname, "../../keusu/客诉台账.xlsx");

const COLUMN_ALIASES: Record<string, string> = {
  原因分类: "原因类别",
  是否根本解: "是否根本解决",
};

let cachedPayload:
  | {
      mtimeMs: number;
      payload: ComplaintInsightsPayload;
    }
  | null = null;

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeSignature(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/[\W_]+/g, "");
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const { y, m, d, H = 0, M = 0, S = 0 } = parsed;
    return new Date(y, (m || 1) - 1, d || 1, H, M, S);
  }

  const text = normalizeText(value);
  if (!text) return null;
  const candidate = new Date(text);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function isRootSolved(value: unknown): boolean {
  return ["是", "yes", "true", "已解决", "已关闭"].includes(normalizeText(value).toLowerCase());
}

function hasCompleteLongTermMeasure(value: unknown): boolean {
  const text = normalizeText(value);
  const compact = normalizeSignature(text);
  return Boolean(
    compact &&
      (compact.length >= 18 ||
        text.includes("\n") ||
        text.includes("1.") ||
        text.includes("1、") ||
        text.includes("①") ||
        text.includes("；") ||
        text.includes(";"))
  );
}

function sequenceSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (!shorter) return 0;

  let bestCommon = 0;
  for (let start = 0; start < shorter.length; start += 1) {
    for (let end = start + 1; end <= shorter.length; end += 1) {
      const fragment = shorter.slice(start, end);
      if (longer.includes(fragment) && fragment.length > bestCommon) {
        bestCommon = fragment.length;
      }
    }
  }

  return (2 * bestCommon) / (left.length + right.length);
}

function readWorkbookRows(): ExcelRecord[] {
  if (!fs.existsSync(complaintWorkbookPath)) {
    throw new Error(`Complaint workbook not found: ${complaintWorkbookPath}`);
  }

  const buffer = fs.readFileSync(complaintWorkbookPath);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Complaint workbook has no sheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<ExcelRecord>(sheet, {
    raw: true,
    defval: "",
  });

  return rawRows.map((row) => {
    const normalized: ExcelRecord = {};
    Object.entries(row).forEach(([key, value]) => {
      const mappedKey = COLUMN_ALIASES[key] ?? key;
      normalized[mappedKey] = value;
    });
    return normalized;
  });
}

function normalizeRows(records: ExcelRecord[]): ComplaintInsightRow[] {
  return records
    .map((row, index) => {
      const occurredAt = parseExcelDate(row["发生时间"]);
      if (!occurredAt) return null;
      const yearValue = Number.parseInt(normalizeText(row["年"]), 10);
      const monthValue = Number.parseInt(normalizeText(row["月"]), 10);
      const year = Number.isFinite(yearValue) ? yearValue : occurredAt.getFullYear();
      const month = Number.isFinite(monthValue) ? monthValue : occurredAt.getMonth() + 1;

      return {
        id: index + 1,
        occurredAt: occurredAt.toISOString(),
        year,
        month,
        issueDescription: normalizeText(row["问题描述"]),
        causeCategory: normalizeText(row["原因类别"]),
        causeAnalysis: normalizeText(row["原因分析"]),
        temporaryAction: normalizeText(row["临时措施"]),
        longTermAction: normalizeText(row["长期措施"]),
        rootSolved: normalizeText(row["是否根本解决"]),
      } satisfies ComplaintInsightRow;
    })
    .filter((row): row is ComplaintInsightRow => Boolean(row))
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

function buildMonthlySeries(rows: ComplaintInsightRow[]): ComplaintMonthlyPoint[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const monthKey = row.occurredAt.slice(0, 7);
    counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((left, right) => left.month.localeCompare(right.month));
}

function buildCategoryBreakdown(rows: ComplaintInsightRow[]): ComplaintCategoryBreakdown[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const name = row.causeCategory || "未分类";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });

  const total = rows.length || 1;
  return Array.from(counts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: Number(((count / total) * 100).toFixed(2)),
    }))
    .sort((left, right) => right.count - left.count);
}

type WarningCandidate = ComplaintWarningSignal & {
  rowIds: number[];
};

function buildDescriptionWarnings(rows: ComplaintInsightRow[]): WarningCandidate[] {
  const buckets = new Map<string, ComplaintInsightRow[]>();

  rows.forEach((row) => {
    const key = normalizeSignature(row.issueDescription);
    if (!key) return;
    const existing = buckets.get(key) ?? [];
    existing.push(row);
    buckets.set(key, existing);
  });

  const warnings: WarningCandidate[] = [];
  buckets.forEach((group) => {
    const ordered = [...group].sort(
      (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
    );
    const repeatMonths = Array.from(new Set(ordered.map((row) => row.occurredAt.slice(0, 7))));
    if (repeatMonths.length <= 2) return;

    const historical = ordered.slice(0, -1);
    const hasHistoricalClosure = historical.some(
      (row) => isRootSolved(row.rootSolved) || hasCompleteLongTermMeasure(row.longTermAction)
    );
    if (!hasHistoricalClosure) return;

    warnings.push({
      mode: "问题描述重复",
      label: ordered[0]?.issueDescription ?? "",
      repeatCount: ordered.length,
      repeatMonths,
      lastSeen: ordered.at(-1)?.occurredAt ?? ordered[0]?.occurredAt ?? "",
      rowIds: ordered.map((row) => row.id).sort((a, b) => a - b),
    });
  });

  return warnings;
}

function buildCauseWarnings(rows: ComplaintInsightRow[]): WarningCandidate[] {
  const candidates = rows
    .filter((row) => normalizeSignature(row.causeAnalysis))
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime());

  const signatures = new Map<number, string>(
    candidates.map((row) => [row.id, normalizeSignature(row.causeAnalysis)])
  );
  const clusters: ComplaintInsightRow[][] = [];

  candidates.forEach((row) => {
    const signature = signatures.get(row.id) ?? "";
    if (!signature) return;

    const matchedCluster = clusters.find((cluster) =>
      cluster.some((member) => sequenceSimilarity(signature, signatures.get(member.id) ?? "") >= 0.88)
    );

    if (matchedCluster) {
      matchedCluster.push(row);
    } else {
      clusters.push([row]);
    }
  });

  return clusters
    .map((cluster) =>
      [...cluster].sort(
        (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
      )
    )
    .filter((cluster) => cluster.length >= 3)
    .flatMap((cluster) => {
      const repeatMonths = Array.from(new Set(cluster.map((row) => row.occurredAt.slice(0, 7))));
      if (repeatMonths.length <= 2) return [];

      const historical = cluster.slice(0, -1);
      const hasHistoricalClosure = historical.some(
        (row) => isRootSolved(row.rootSolved) || hasCompleteLongTermMeasure(row.longTermAction)
      );
      if (!hasHistoricalClosure) return [];

      return [
        {
          mode: "原因分析相似重复" as const,
          label: cluster[0]?.causeAnalysis ?? "",
          repeatCount: cluster.length,
          repeatMonths,
          lastSeen: cluster.at(-1)?.occurredAt ?? cluster[0]?.occurredAt ?? "",
          rowIds: cluster.map((row) => row.id).sort((a, b) => a - b),
        },
      ];
    });
}

function buildWarnings(rows: ComplaintInsightRow[]): ComplaintWarningSignal[] {
  const combined = [...buildDescriptionWarnings(rows), ...buildCauseWarnings(rows)].sort((left, right) => {
    const monthDelta = right.repeatMonths.length - left.repeatMonths.length;
    if (monthDelta !== 0) return monthDelta;
    const countDelta = right.repeatCount - left.repeatCount;
    if (countDelta !== 0) return countDelta;
    return new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime();
  });

  const deduped: ComplaintWarningSignal[] = [];
  const seen = new Set<string>();
  combined.forEach((warning) => {
    const key = warning.rowIds.join(",");
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push({
      mode: warning.mode,
      label: warning.label,
      repeatCount: warning.repeatCount,
      repeatMonths: warning.repeatMonths,
      lastSeen: warning.lastSeen,
    });
  });
  return deduped;
}

export function getComplaintInsightsPayload(): ComplaintInsightsPayload {
  const stat = fs.statSync(complaintWorkbookPath);
  if (cachedPayload && cachedPayload.mtimeMs === stat.mtimeMs) {
    return cachedPayload.payload;
  }

  const rows = normalizeRows(readWorkbookRows());
  const payload: ComplaintInsightsPayload = {
    sourceFile: path.basename(complaintWorkbookPath),
    lastUpdated: stat.mtime.toISOString(),
    rowCount: rows.length,
    monthlySeries: buildMonthlySeries(rows),
    categoryBreakdown: buildCategoryBreakdown(rows),
    warnings: buildWarnings(rows),
    rows,
  };

  cachedPayload = {
    mtimeMs: stat.mtimeMs,
    payload,
  };
  return payload;
}
