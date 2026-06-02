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
  sourceFiles: string[];
  lastUpdated: string;
  rowCount: number;
  monthlySeries: ComplaintMonthlyPoint[];
  categoryBreakdown: ComplaintCategoryBreakdown[];
  warnings: ComplaintWarningSignal[];
  rows: ComplaintInsightRow[];
};

export type ComplaintTemplateFieldKey =
  | "occurredAt"
  | "year"
  | "month"
  | "issueDescription"
  | "causeCategory"
  | "causeAnalysis"
  | "temporaryAction"
  | "longTermAction"
  | "rootSolved";

export type ComplaintTemplateMapping = Record<ComplaintTemplateFieldKey, string[]>;

export type ComplaintTemplateFieldDefinition = {
  key: ComplaintTemplateFieldKey;
  label: string;
  description: string;
  defaultAliases: string[];
};

export const COMPLAINT_TEMPLATE_FIELDS: ComplaintTemplateFieldDefinition[] = [
  {
    key: "occurredAt",
    label: "发生时间",
    description: "源表里的时间列，必须能定位到具体日期。",
    defaultAliases: ["发生时间", "客诉时间", "异常时间", "日期"],
  },
  {
    key: "year",
    label: "年",
    description: "如果源表没有单独的年份列，可以由发生时间自动补齐。",
    defaultAliases: ["年", "年份"],
  },
  {
    key: "month",
    label: "月",
    description: "如果源表没有单独的月份列，可以由发生时间自动补齐。",
    defaultAliases: ["月", "月份"],
  },
  {
    key: "issueDescription",
    label: "问题描述",
    description: "用于时间落点提示、复发识别和问题台账。",
    defaultAliases: ["问题描述", "异常描述", "客诉内容", "问题点"],
  },
  {
    key: "causeCategory",
    label: "原因类别",
    description: "用于饼图和柏拉图统计。",
    defaultAliases: ["原因类别", "原因分类", "责任类别", "异常分类"],
  },
  {
    key: "causeAnalysis",
    label: "原因分析",
    description: "用于因果链台账和相似复发识别。",
    defaultAliases: ["原因分析", "原因说明", "根因分析", "分析"],
  },
  {
    key: "temporaryAction",
    label: "临时措施",
    description: "短期止血措施。",
    defaultAliases: ["临时措施", "短期措施", "应急措施"],
  },
  {
    key: "longTermAction",
    label: "长期措施",
    description: "长期改善或闭环措施。",
    defaultAliases: ["长期措施", "改善措施", "永久措施", "对策"],
  },
  {
    key: "rootSolved",
    label: "是否根本解决",
    description: "支持是/否、已解决/已关闭等表达。",
    defaultAliases: ["是否根本解决", "是否根本解", "是否解决", "根本解决", "关闭状态"],
  },
];

type XlsxModuleLike = {
  read: (data: ArrayBuffer, options: Record<string, unknown>) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: <T>(sheet: unknown, options: Record<string, unknown>) => T[];
  };
  SSF: {
    parse_date_code: (value: number) => {
      y: number;
      m: number;
      d: number;
      H?: number;
      M?: number;
      S?: number;
    } | null;
  };
};

type RawRow = Record<string, unknown>;
type RowValueMap = Map<string, unknown>;
type WarningCandidate = ComplaintWarningSignal & { rowIds: number[] };

export function createDefaultComplaintTemplateMapping(): ComplaintTemplateMapping {
  return Object.fromEntries(
    COMPLAINT_TEMPLATE_FIELDS.map((field) => [field.key, [...field.defaultAliases]])
  ) as ComplaintTemplateMapping;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeSignature(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function sanitizeMapping(mapping?: Partial<ComplaintTemplateMapping>): ComplaintTemplateMapping {
  const defaults = createDefaultComplaintTemplateMapping();
  return Object.fromEntries(
    COMPLAINT_TEMPLATE_FIELDS.map((field) => {
      const rawAliases = mapping?.[field.key] ?? defaults[field.key];
      const aliases = rawAliases.map((item) => normalizeText(item)).filter(Boolean);
      return [field.key, aliases.length > 0 ? aliases : defaults[field.key]];
    })
  ) as ComplaintTemplateMapping;
}

function createRowValueMap(row: RawRow): RowValueMap {
  return new Map(
    Object.entries(row)
      .map(([key, value]) => [normalizeSignature(key), value] as const)
      .filter(([key]) => Boolean(key))
  );
}

function getMappedValue(rowMap: RowValueMap, aliases: string[]): unknown {
  for (const alias of aliases) {
    const matched = rowMap.get(normalizeSignature(alias));
    if (matched !== undefined) {
      return matched;
    }
  }
  return "";
}

function parseExcelDate(value: unknown, XLSX: XlsxModuleLike): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

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
  return ["是", "yes", "true", "已解决", "已关闭", "closed", "rootsolved"].includes(
    normalizeSignature(value)
  );
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

function bigramSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const toBigrams = (value: string) => {
    const grams = new Set<string>();
    if (value.length < 2) {
      grams.add(value);
      return grams;
    }
    for (let index = 0; index < value.length - 1; index += 1) {
      grams.add(value.slice(index, index + 2));
    }
    return grams;
  };

  const leftBigrams = toBigrams(left);
  const rightBigrams = toBigrams(right);
  let intersection = 0;
  leftBigrams.forEach((gram) => {
    if (rightBigrams.has(gram)) {
      intersection += 1;
    }
  });

  const union = leftBigrams.size + rightBigrams.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function readWorkbookRows(
  rawRows: RawRow[],
  XLSX: XlsxModuleLike,
  mapping: ComplaintTemplateMapping,
  sourceLabel: string,
  rowOffset: number
): ComplaintInsightRow[] {
  return rawRows
    .map((row, index) => {
      const rowMap = createRowValueMap(row);
      const occurredAt = parseExcelDate(getMappedValue(rowMap, mapping.occurredAt), XLSX);
      if (!occurredAt) return null;

      const parsedYear = Number.parseInt(normalizeText(getMappedValue(rowMap, mapping.year)), 10);
      const parsedMonth = Number.parseInt(normalizeText(getMappedValue(rowMap, mapping.month)), 10);

      return {
        id: rowOffset + index + 1,
        occurredAt: occurredAt.toISOString(),
        year: Number.isFinite(parsedYear) ? parsedYear : occurredAt.getFullYear(),
        month: Number.isFinite(parsedMonth) ? parsedMonth : occurredAt.getMonth() + 1,
        issueDescription: normalizeText(getMappedValue(rowMap, mapping.issueDescription)),
        causeCategory: normalizeText(getMappedValue(rowMap, mapping.causeCategory)),
        causeAnalysis: normalizeText(getMappedValue(rowMap, mapping.causeAnalysis)),
        temporaryAction: normalizeText(getMappedValue(rowMap, mapping.temporaryAction)),
        longTermAction: normalizeText(getMappedValue(rowMap, mapping.longTermAction)),
        rootSolved: normalizeText(getMappedValue(rowMap, mapping.rootSolved)),
      } satisfies ComplaintInsightRow;
    })
    .filter((row): row is ComplaintInsightRow => Boolean(row))
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

function buildMonthlySeries(rows: ComplaintInsightRow[]): ComplaintMonthlyPoint[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const month = row.occurredAt.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((left, right) => left.month.localeCompare(right.month));
}

function buildCategoryBreakdown(rows: ComplaintInsightRow[]): ComplaintCategoryBreakdown[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = row.causeCategory || "未分类";
    counts.set(key, (counts.get(key) ?? 0) + 1);
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

function buildDescriptionWarnings(rows: ComplaintInsightRow[]): WarningCandidate[] {
  const bucket = new Map<string, ComplaintInsightRow[]>();
  rows.forEach((row) => {
    const key = normalizeSignature(row.issueDescription);
    if (!key) return;
    const existing = bucket.get(key) ?? [];
    existing.push(row);
    bucket.set(key, existing);
  });

  const warnings: WarningCandidate[] = [];
  bucket.forEach((group) => {
    const ordered = [...group].sort(
      (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
    );
    const repeatMonths = Array.from(new Set(ordered.map((row) => row.occurredAt.slice(0, 7))));
    if (repeatMonths.length <= 2) return;

    const historical = ordered.slice(0, -1);
    const hasHistoryClosure = historical.some(
      (row) => isRootSolved(row.rootSolved) || hasCompleteLongTermMeasure(row.longTermAction)
    );
    if (!hasHistoryClosure) return;

    warnings.push({
      mode: "问题描述重复",
      label: ordered[0]?.issueDescription ?? "",
      repeatCount: ordered.length,
      repeatMonths,
      lastSeen: ordered.at(-1)?.occurredAt ?? ordered[0]?.occurredAt ?? "",
      rowIds: ordered.map((row) => row.id).sort((left, right) => left - right),
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
    const target = clusters.find((cluster) =>
      cluster.some((member) => bigramSimilarity(signature, signatures.get(member.id) ?? "") >= 0.88)
    );
    if (target) {
      target.push(row);
    } else {
      clusters.push([row]);
    }
  });

  return clusters
    .filter((cluster) => cluster.length >= 3)
    .flatMap((cluster) => {
      const ordered = [...cluster].sort(
        (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
      );
      const repeatMonths = Array.from(new Set(ordered.map((row) => row.occurredAt.slice(0, 7))));
      if (repeatMonths.length <= 2) return [];

      const historical = ordered.slice(0, -1);
      const hasHistoryClosure = historical.some(
        (row) => isRootSolved(row.rootSolved) || hasCompleteLongTermMeasure(row.longTermAction)
      );
      if (!hasHistoryClosure) return [];

      return [
        {
          mode: "原因分析相似重复" as const,
          label: ordered[0]?.causeAnalysis ?? "",
          repeatCount: ordered.length,
          repeatMonths,
          lastSeen: ordered.at(-1)?.occurredAt ?? ordered[0]?.occurredAt ?? "",
          rowIds: ordered.map((row) => row.id).sort((left, right) => left - right),
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
  combined.forEach((item) => {
    const key = item.rowIds.join(",");
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push({
      mode: item.mode,
      label: item.label,
      repeatCount: item.repeatCount,
      repeatMonths: item.repeatMonths,
      lastSeen: item.lastSeen,
    });
  });
  return deduped;
}

function buildSourceFileSummary(files: File[]): string {
  if (files.length <= 1) return files[0]?.name ?? "";
  return `${files[0]?.name ?? ""} + ${files.length - 1} 个文件`;
}

export async function parseComplaintInsightExcel(
  input: File | File[],
  options?: { mapping?: Partial<ComplaintTemplateMapping> }
): Promise<ComplaintInsightsPayload> {
  const files = Array.isArray(input) ? input : [input];
  const validFiles = files.filter(Boolean);
  if (validFiles.length === 0) {
    throw new Error("请先选择至少 1 个 Excel 文件。");
  }

  const XLSX = ((await import("xlsx")) as unknown) as XlsxModuleLike;
  const mapping = sanitizeMapping(options?.mapping);

  let nextRowOffset = 0;
  const mergedRows: ComplaintInsightRow[] = [];

  for (const file of validFiles) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error(`Excel 文件 ${file.name} 中没有可读取的工作表。`);
    }

    const rawRows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheetName], {
      raw: true,
      defval: "",
    });
    const rows = readWorkbookRows(rawRows, XLSX, mapping, file.name, nextRowOffset);
    nextRowOffset += rows.length;
    mergedRows.push(...rows);
  }

  const rows = mergedRows.sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  );

  if (rows.length === 0) {
    throw new Error(
      `未解析到有效记录，请检查“${mapping.occurredAt.join(" / ")}”这类核心列名是否与源表一致。`
    );
  }

  return {
    sourceFile: buildSourceFileSummary(validFiles),
    sourceFiles: validFiles.map((file) => file.name),
    lastUpdated: new Date().toISOString(),
    rowCount: rows.length,
    monthlySeries: buildMonthlySeries(rows),
    categoryBreakdown: buildCategoryBreakdown(rows),
    warnings: buildWarnings(rows),
    rows,
  };
}
