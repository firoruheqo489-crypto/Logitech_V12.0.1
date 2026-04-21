"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  UploadCloud,
} from "lucide-react";

import CyberConfirmDialog from "@/components/ui/CyberConfirmDialog";
import {
  deletePartFaiState,
  fetchPartFaiState,
  savePartFaiState,
  type PartFaiColumnId,
} from "@/lib/part-fai-api";

type ShotTuple = [number | null, number | null, number | null];
type RowFilter = "all" | "qualified" | "unqualified";
type ColumnGroupId = "fosBlock" | "fosShots" | "gtolBlock";
type ColumnId =
  | "dim"
  | "fos"
  | "plusTol"
  | "minusTol"
  | "usl"
  | "lsl"
  | "judgeFos"
  | "cavity"
  | "fosShot1"
  | "fosShot2"
  | "fosShot3"
  | "judgeGtol"
  | "gtolShot1"
  | "gtolShot2"
  | "gtolShot3";

type FaiDataRow = {
  faiSet: string;
  dim: string;
  dimType: string;
  cavity: string;
  fos: number | null;
  plusTol: number | null;
  minusTol: number | null;
  usl: number | null;
  lsl: number | null;
  judgeFos: string;
  judgeGtol: string;
  isNG: boolean;
  fosShots: ShotTuple;
  gtolShots: ShotTuple;
};

type FaiParseSummary = {
  totalRows: number;
  ngRows: number;
  qualifiedRows: number;
  qualifiedRate: number | null;
};

export type FaiMeasurementPoint = {
  cavity: string;
  shot: number;
  value: number;
};

export type FaiMeasurementTrack = {
  nominal: number;
  usl: number;
  lsl: number;
  rawData: FaiMeasurementPoint[];
  flatValues: number[];
};

export type FaiParsedData = {
  faiId: string;
  measurements: {
    FOS: FaiMeasurementTrack;
    GTol: FaiMeasurementTrack | null;
  };
};

type WorksheetCell = {
  v?: unknown;
  w?: unknown;
};

type PartFaiColumnDefinition = {
  id: ColumnId;
  label: string;
  group: ColumnGroupId;
};

const EMPTY_SUMMARY: FaiParseSummary = {
  totalRows: 0,
  ngRows: 0,
  qualifiedRows: 0,
  qualifiedRate: null,
};

const SHOT_LABELS = ["Shot 1", "Shot 2", "Shot 3"] as const;

const PART_FAI_COLUMN_GROUPS: Array<{ id: ColumnGroupId; label: string }> = [
  { id: "fosBlock", label: "FOS Block" },
  { id: "fosShots", label: "FOS Shots" },
  { id: "gtolBlock", label: "G-Tol Block" },
];

const PART_FAI_COLUMNS: PartFaiColumnDefinition[] = [
  { id: "dim", label: "Dim. #", group: "fosBlock" },
  { id: "fos", label: "FOS", group: "fosBlock" },
  { id: "plusTol", label: "Plus Tol (+)", group: "fosBlock" },
  { id: "minusTol", label: "Minus Tol (-)", group: "fosBlock" },
  { id: "usl", label: "USL", group: "fosBlock" },
  { id: "lsl", label: "LSL", group: "fosBlock" },
  { id: "judgeFos", label: "Judge FOS", group: "fosBlock" },
  { id: "cavity", label: "Cavity #", group: "fosBlock" },
  { id: "fosShot1", label: `FOS ${SHOT_LABELS[0]}`, group: "fosShots" },
  { id: "fosShot2", label: `FOS ${SHOT_LABELS[1]}`, group: "fosShots" },
  { id: "fosShot3", label: `FOS ${SHOT_LABELS[2]}`, group: "fosShots" },
  { id: "judgeGtol", label: "Judge G-Tol", group: "gtolBlock" },
  { id: "gtolShot1", label: `G-Tol ${SHOT_LABELS[0]}`, group: "gtolBlock" },
  { id: "gtolShot2", label: `G-Tol ${SHOT_LABELS[1]}`, group: "gtolBlock" },
  { id: "gtolShot3", label: `G-Tol ${SHOT_LABELS[2]}`, group: "gtolBlock" },
];

const PART_FAI_COLUMN_IDS = PART_FAI_COLUMNS.map(column => column.id);

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeHeaderKey(value: unknown): string {
  return normalizeHeader(value).replace(/[^a-z0-9]+/g, "");
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  const normalized = text.replace(/,/g, "").replace(/[^\d.+-]/g, "");

  if (
    !normalized ||
    normalized === "+" ||
    normalized === "-" ||
    normalized === "."
  ) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeJudge(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function getJudgeStatus(value: string): "ok" | "ng" | "other" {
  if (value.includes("NG")) {
    return "ng";
  }

  if (value.includes("OK") || value.includes("QK")) {
    return "ok";
  }

  return "other";
}

function summarizeParsedRows(rows: FaiDataRow[]): FaiParseSummary {
  const okResults = rows.reduce(
    (count, row) =>
      count +
      (getJudgeStatus(row.judgeFos) === "ok" ? 1 : 0) +
      (getJudgeStatus(row.judgeGtol) === "ok" ? 1 : 0),
    0
  );
  const ngResults = rows.reduce(
    (count, row) =>
      count +
      (getJudgeStatus(row.judgeFos) === "ng" ? 1 : 0) +
      (getJudgeStatus(row.judgeGtol) === "ng" ? 1 : 0),
    0
  );
  const totalResults = okResults + ngResults;

  return {
    totalRows: totalResults,
    ngRows: ngResults,
    qualifiedRows: okResults,
    qualifiedRate:
      totalResults > 0
        ? roundToFourDecimals((okResults / totalResults) * 100)
        : null,
  };
}

function normalizeSheetNameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findSheetRowsByKey(
  sheetRowsByName: Record<string, unknown[][]>,
  expectedKey: string
): unknown[][] | null {
  for (const [sheetName, rows] of Object.entries(sheetRowsByName)) {
    if (normalizeSheetNameKey(sheetName) === expectedKey) {
      return rows;
    }
  }

  return null;
}

function countStatusesInColumn(
  rows: unknown[][],
  columnLabel: string
): { okCount: number; ngCount: number } {
  const columnIndex = columnLabelToIndex(columnLabel);
  if (columnIndex < 0) {
    return { okCount: 0, ngCount: 0 };
  }

  return rows.reduce(
    (counts, row) => {
      const status = getJudgeStatus(normalizeJudge(row[columnIndex]));
      return {
        okCount: counts.okCount + (status === "ok" ? 1 : 0),
        ngCount: counts.ngCount + (status === "ng" ? 1 : 0),
      };
    },
    { okCount: 0, ngCount: 0 }
  );
}

export function summarizeWorkbookSheetRows(
  sheetRowsByName: Record<string, unknown[][]>
): FaiParseSummary | null {
  const profileScanRows = findSheetRowsByKey(
    sheetRowsByName,
    "profilescanreport"
  );
  const dimensionRows = findSheetRowsByKey(sheetRowsByName, "dimensionreport");

  if (!dimensionRows && !profileScanRows) {
    return null;
  }

  const dimensionSummary = (() => {
    if (!dimensionRows) {
      return EMPTY_SUMMARY;
    }

    try {
      return parseSheetRows(dimensionRows).summary;
    } catch {
      return EMPTY_SUMMARY;
    }
  })();
  const profileCounts = profileScanRows
    ? countStatusesInColumn(profileScanRows, "C")
    : { okCount: 0, ngCount: 0 };

  const qualifiedRows = dimensionSummary.qualifiedRows + profileCounts.okCount;
  const ngRows = dimensionSummary.ngRows + profileCounts.ngCount;
  const totalRows = qualifiedRows + ngRows;

  return {
    totalRows,
    ngRows,
    qualifiedRows,
    qualifiedRate:
      totalRows > 0
        ? roundToFourDecimals((qualifiedRows / totalRows) * 100)
        : null,
  };
}

function roundToFourDecimals(value: number): number {
  return Number(value.toFixed(4));
}

function normalizeDimTypeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeFaiSetKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";

  const normalized = Number(value.toFixed(4));
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toString();
}

function formatPercent(value: number | null): string {
  return value === null || Number.isNaN(value) ? "N/A" : value.toFixed(2);
}

function sanitizeShotTuple(value: unknown): ShotTuple {
  if (!Array.isArray(value)) {
    return [null, null, null];
  }

  return [
    coerceNumber(value[0]),
    coerceNumber(value[1]),
    coerceNumber(value[2]),
  ];
}

function sanitizePersistedRows(value: unknown): FaiDataRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(row => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const record = row as Record<string, unknown>;
      const dim = String(record.dim ?? "").trim();
      if (!dim) {
        return null;
      }

      return {
        faiSet: normalizeFaiSetKey(record.faiSet ?? record.dim),
        dim,
        dimType: String(record.dimType ?? "").trim(),
        cavity: String(record.cavity ?? "").trim(),
        fos: coerceNumber(record.fos),
        plusTol: coerceNumber(record.plusTol),
        minusTol: coerceNumber(record.minusTol),
        usl: coerceNumber(record.usl),
        lsl: coerceNumber(record.lsl),
        judgeFos: normalizeJudge(record.judgeFos),
        judgeGtol: normalizeJudge(record.judgeGtol),
        isNG: Boolean(record.isNG),
        fosShots: sanitizeShotTuple(record.fosShots),
        gtolShots: sanitizeShotTuple(record.gtolShots),
      } satisfies FaiDataRow;
    })
    .filter((row): row is FaiDataRow => row !== null);
}

function sanitizePersistedSummary(value: unknown): FaiParseSummary {
  if (!value || typeof value !== "object") {
    return EMPTY_SUMMARY;
  }

  const record = value as Record<string, unknown>;

  return {
    totalRows: coerceNumber(record.totalRows) ?? 0,
    ngRows: coerceNumber(record.ngRows) ?? 0,
    qualifiedRows: coerceNumber(record.qualifiedRows) ?? 0,
    qualifiedRate: coerceNumber(record.qualifiedRate),
  };
}

function isPartFaiColumnId(value: string): value is ColumnId {
  return PART_FAI_COLUMN_IDS.includes(value as ColumnId);
}

function sanitizePersistedHiddenColumns(value: unknown): ColumnId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(item => String(item ?? ""))
        .filter((item): item is ColumnId => isPartFaiColumnId(item))
    )
  );
}

function isFaiHeaderRow(row: unknown[]): boolean {
  return row.some(cell => {
    const header = normalizeHeader(cell);
    return (
      (header.includes("dim") && header.includes("#")) ||
      (header === "dim" && !header.includes("type"))
    );
  });
}

type ParserHeaderIndexes = {
  dim: number;
  dimType: number;
  cavity: number;
  fos: number;
  plusTol: number;
  minusTol: number;
  usl: number;
  lsl: number;
  gtolRange: number;
  fosShotIndexes: [number, number, number];
  gtolShotIndexes: [number, number, number];
};

type FaiAggregationBuffer = {
  faiId: string;
  fosNominal: number | null;
  fosUsl: number | null;
  fosLsl: number | null;
  plusTol: number | null;
  minusTol: number | null;
  gtolRange: number | null;
  fosRawData: FaiMeasurementPoint[];
  gtolRawData: FaiMeasurementPoint[];
  cavityDimTypes: Map<string, string>;
};

type ParsedWorkbookSnapshot = {
  contractData: FaiParsedData[];
  rowData: FaiDataRow[];
};

type SheetJsonRow = Record<string, unknown>;

function findRequiredIndex(
  headers: unknown[],
  matcher: (header: string) => boolean,
  label: string
): number {
  const index = headers.findIndex(cell => matcher(normalizeHeader(cell)));
  if (index < 0) {
    throw new Error(`Missing required column: ${label}`);
  }

  return index;
}

function roundToThreeDecimals(value: number): number {
  return Number(Math.round(Number(`${value}e3`)) + "e-3");
}

function isStrictNumericCell(value: unknown): boolean {
  if (value === "" || value === null || value === undefined) {
    return false;
  }

  const text = String(value).trim();
  if (!text || /^(-|n\/a|na)$/i.test(text)) {
    return false;
  }

  const normalized = text.replace(/,/g, "");
  return !Number.isNaN(Number(normalized));
}

function parseMeasurementValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return roundToThreeDecimals(value);
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  if (/^(-|n\/a|na)$/i.test(text)) {
    return null;
  }

  const cleaned = text.replace(/,/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return roundToThreeDecimals(parsed);
}

function normalizeFaiIdFromDim(value: unknown): string {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) {
    return "";
  }

  const compact = text.replace(/\s+/g, "");
  const match = compact.match(/^FAI0*(\d+)$/i);
  if (match) {
    return `FAI${Number.parseInt(match[1], 10)}`;
  }

  return compact;
}

function normalizeCavity(value: unknown, rowIndex: number): string {
  const text = String(value ?? "").trim();
  if (!text) {
    return `ROW${rowIndex + 1}`;
  }

  return text.replace(/\s+/g, "").toUpperCase();
}

function compareFaiId(left: string, right: string): number {
  const leftMatch = left.match(/^FAI(\d+)$/i);
  const rightMatch = right.match(/^FAI(\d+)$/i);
  if (leftMatch && rightMatch) {
    return Number.parseInt(leftMatch[1], 10) - Number.parseInt(rightMatch[1], 10);
  }

  return left.localeCompare(right);
}

function compareCavity(left: string, right: string): number {
  const leftMatch = left.match(/^CAV0*(\d+)$/i);
  const rightMatch = right.match(/^CAV0*(\d+)$/i);
  if (leftMatch && rightMatch) {
    return Number.parseInt(leftMatch[1], 10) - Number.parseInt(rightMatch[1], 10);
  }

  return left.localeCompare(right);
}

function computeJudgeFromShots(
  shots: ShotTuple,
  usl: number,
  lsl: number
): string {
  const values = shots.filter((value): value is number => value !== null);
  if (values.length === 0) {
    return "";
  }

  return values.some(value => value > usl || value < lsl) ? "NG" : "OK";
}

function findShotIndexesByHeader(
  headers: unknown[],
  shot: 1 | 2 | 3
): number[] {
  const directPattern = new RegExp(`(^|\\s)shot\\s*0*${shot}(?=\\s|$)`);
  const compactPattern = new RegExp(`(^|\\s)shot0*${shot}(?=\\s|$)`);

  return headers
    .map((cell, index) => ({
      header: normalizeHeader(cell).replace(/[_-]+/g, " "),
      index,
    }))
    .filter(
      ({ header }) => directPattern.test(header) || compactPattern.test(header)
    )
    .map(({ index }) => index);
}

function resolveShotIndexes(headers: unknown[]): {
  fosShotIndexes: [number, number, number];
  gtolShotIndexes: [number, number, number];
} {
  const fosFallback: [number, number, number] = [
    columnLabelToIndex("L"),
    columnLabelToIndex("M"),
    columnLabelToIndex("N"),
  ];
  const gtolFallback: [number, number, number] = [
    columnLabelToIndex("R"),
    columnLabelToIndex("S"),
    columnLabelToIndex("T"),
  ];

  const shot1 = findShotIndexesByHeader(headers, 1);
  const shot2 = findShotIndexesByHeader(headers, 2);
  const shot3 = findShotIndexesByHeader(headers, 3);

  if (shot1.length >= 2 && shot2.length >= 2 && shot3.length >= 2) {
    return {
      fosShotIndexes: [shot1[0], shot2[0], shot3[0]],
      gtolShotIndexes: [shot1[1], shot2[1], shot3[1]],
    };
  }

  return {
    fosShotIndexes: fosFallback,
    gtolShotIndexes: gtolFallback,
  };
}

function findParserHeaderIndexes(headers: unknown[]): ParserHeaderIndexes {
  const dim = findRequiredIndex(
    headers,
    header =>
      (header.includes("dim") && header.includes("#")) ||
      (header === "dim" && !header.includes("type")),
    "Dim. #"
  );

  const dimType = headers.findIndex(cell => normalizeHeaderKey(cell).includes("dimtype"));
  const cavity = headers.findIndex(cell => normalizeHeader(cell).includes("cavity"));
  const fos = headers.findIndex(cell => {
    const header = normalizeHeader(cell);
    return header.includes("fos") && !header.includes("judge");
  });
  const plusTol = headers.findIndex(cell => normalizeHeader(cell).includes("plus tol"));
  const minusTol = headers.findIndex(cell => normalizeHeader(cell).includes("minus tol"));
  const usl = headers.findIndex(cell => {
    const header = normalizeHeader(cell);
    return header === "usl" || header.includes("upper spec");
  });
  const lsl = headers.findIndex(cell => {
    const header = normalizeHeader(cell);
    return header === "lsl" || header.includes("lower spec");
  });
  const gtolRange = headers.findIndex(cell => {
    const header = normalizeHeader(cell);
    return header.includes("g-tol range") || header.includes("gtol range");
  });

  const { fosShotIndexes, gtolShotIndexes } = resolveShotIndexes(headers);

  return {
    dim,
    dimType,
    cavity,
    fos,
    plusTol,
    minusTol,
    usl,
    lsl,
    gtolRange,
    fosShotIndexes,
    gtolShotIndexes,
  };
}

function readShotTupleFromRow(
  row: unknown[],
  indexes: [number, number, number]
): ShotTuple {
  return indexes.map(index => {
    const value = row[index];
    if (!isStrictNumericCell(value)) {
      return null;
    }

    return parseMeasurementValue(value);
  }) as ShotTuple;
}

function fillDownDimInMatrixRows(
  rows: unknown[][],
  headerRowIndex: number,
  nextHeaderRowIndex: number,
  dimColumnIndex: number
): unknown[][] {
  let currentDimCache = "";

  return rows.slice(headerRowIndex + 1, nextHeaderRowIndex).map(row => {
    const normalizedRow = [...row];
    const dimText = String(normalizedRow[dimColumnIndex] ?? "").trim();
    if (dimText) {
      currentDimCache = dimText;
    } else if (currentDimCache) {
      normalizedRow[dimColumnIndex] = currentDimCache;
    }

    return normalizedRow;
  });
}

function normalizeSheetJsonHeaderKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isDimHeaderKey(key: string): boolean {
  const normalized = normalizeSheetJsonHeaderKey(key);
  return (
    (normalized.includes("dim") && normalized.includes("#")) ||
    normalized === "dim" ||
    normalized === "dim #"
  );
}

export function fillDownDimInJsonRows(rows: SheetJsonRow[]): SheetJsonRow[] {
  let currentDimCache = "";
  let dimKey: string | null = null;

  return rows.map(rawRow => {
    const row: SheetJsonRow = { ...rawRow };

    if (!dimKey) {
      dimKey = Object.keys(row).find(isDimHeaderKey) ?? null;
    }

    if (!dimKey) {
      return row;
    }

    const rawDim = String(row[dimKey] ?? "").trim();
    if (rawDim) {
      currentDimCache = rawDim;
    } else if (currentDimCache) {
      row[dimKey] = currentDimCache;
    }

    return row;
  });
}

export function convertSheetJsonRowsToMatrixRows(rows: SheetJsonRow[]): unknown[][] {
  if (rows.length === 0) {
    return [];
  }

  const headers: string[] = [];
  const seen = new Set<string>();

  rows.forEach(row => {
    Object.keys(row).forEach(key => {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    });
  });

  return [
    headers,
    ...rows.map(row => headers.map(header => row[header] ?? "")),
  ];
}

function buildContractSnapshot(rows: unknown[][]): ParsedWorkbookSnapshot {
  const headerRowIndexes = rows
    .map((row, index) => (isFaiHeaderRow(row) ? index : -1))
    .filter((index): index is number => index >= 0);

  if (headerRowIndexes.length === 0) {
    throw new Error("Unable to locate the FAI header row.");
  }

  const buffers = new Map<string, FaiAggregationBuffer>();
  let parseError: unknown = null;
  let parsedSectionCount = 0;

  headerRowIndexes.forEach((headerRowIndex, sectionIndex) => {
    const nextHeaderRowIndex = headerRowIndexes[sectionIndex + 1] ?? rows.length;

    try {
      const headerIndexes = findParserHeaderIndexes(rows[headerRowIndex] ?? []);
      const normalizedRows = fillDownDimInMatrixRows(
        rows,
        headerRowIndex,
        nextHeaderRowIndex,
        headerIndexes.dim
      );
      let currentFaiId = "";

      normalizedRows.forEach((row, rowOffset) => {
        const rowIndex = headerRowIndex + 1 + rowOffset;
        const rowDim = String(row[headerIndexes.dim] ?? "").trim();
        const normalizedDim = normalizeFaiIdFromDim(rowDim);
        if (normalizedDim) {
          currentFaiId = normalizedDim;
        }

        if (!currentFaiId) {
          return;
        }

        const cavity = normalizeCavity(
          headerIndexes.cavity >= 0 ? row[headerIndexes.cavity] : "",
          rowIndex
        );
        const dimType =
          headerIndexes.dimType >= 0
            ? String(row[headerIndexes.dimType] ?? "").trim()
            : "";

        const buffer =
          buffers.get(currentFaiId) ??
          ({
            faiId: currentFaiId,
            fosNominal: null,
            fosUsl: null,
            fosLsl: null,
            plusTol: null,
            minusTol: null,
            gtolRange: null,
            fosRawData: [],
            gtolRawData: [],
            cavityDimTypes: new Map<string, string>(),
          } satisfies FaiAggregationBuffer);

        if (!buffers.has(currentFaiId)) {
          buffers.set(currentFaiId, buffer);
        }

        if (!buffer.cavityDimTypes.has(cavity)) {
          buffer.cavityDimTypes.set(cavity, dimType);
        } else if (dimType && !buffer.cavityDimTypes.get(cavity)) {
          buffer.cavityDimTypes.set(cavity, dimType);
        }

        const fosNominal =
          headerIndexes.fos >= 0
            ? parseMeasurementValue(row[headerIndexes.fos])
            : null;
        const plusTol =
          headerIndexes.plusTol >= 0
            ? parseMeasurementValue(row[headerIndexes.plusTol])
            : null;
        const minusTol =
          headerIndexes.minusTol >= 0
            ? parseMeasurementValue(row[headerIndexes.minusTol])
            : null;
        const directUsl =
          headerIndexes.usl >= 0
            ? parseMeasurementValue(row[headerIndexes.usl])
            : null;
        const directLsl =
          headerIndexes.lsl >= 0
            ? parseMeasurementValue(row[headerIndexes.lsl])
            : null;
        const gtolRange =
          headerIndexes.gtolRange >= 0
            ? parseMeasurementValue(row[headerIndexes.gtolRange])
            : null;

        if (buffer.fosNominal === null && fosNominal !== null) {
          buffer.fosNominal = fosNominal;
        }
        if (buffer.plusTol === null && plusTol !== null) {
          buffer.plusTol = plusTol;
        }
        if (buffer.minusTol === null && minusTol !== null) {
          buffer.minusTol = minusTol;
        }
        if (buffer.gtolRange === null && gtolRange !== null) {
          buffer.gtolRange = gtolRange;
        }

        const computedUsl =
          directUsl ??
          (fosNominal !== null && plusTol !== null
            ? roundToThreeDecimals(fosNominal + plusTol)
            : null);
        const computedLsl =
          directLsl ??
          (fosNominal !== null && minusTol !== null
            ? roundToThreeDecimals(fosNominal + minusTol)
            : null);

        if (buffer.fosUsl === null && computedUsl !== null) {
          buffer.fosUsl = computedUsl;
        }
        if (buffer.fosLsl === null && computedLsl !== null) {
          buffer.fosLsl = computedLsl;
        }

        const fosShots = readShotTupleFromRow(row, headerIndexes.fosShotIndexes);
        const gtolShots = readShotTupleFromRow(row, headerIndexes.gtolShotIndexes);

        fosShots.forEach((value, index) => {
          if (value === null) {
            return;
          }

          buffer.fosRawData.push({
            cavity,
            shot: index + 1,
            value,
          });
        });

        gtolShots.forEach((value, index) => {
          if (value === null) {
            return;
          }

          buffer.gtolRawData.push({
            cavity,
            shot: index + 1,
            value,
          });
        });
      });

      parsedSectionCount += 1;
    } catch (sectionError) {
      if (!parseError) {
        parseError = sectionError;
      }
    }
  });

  if (parsedSectionCount === 0) {
    if (parseError instanceof Error) {
      throw parseError;
    }
    throw new Error("Unable to parse any FAI data blocks in worksheet.");
  }

  const contractData = Array.from(buffers.values())
    .sort((left, right) => compareFaiId(left.faiId, right.faiId))
    .map(buffer => {
      const fosNominal = roundToThreeDecimals(buffer.fosNominal ?? 0);
      const fosUsl = roundToThreeDecimals(buffer.fosUsl ?? fosNominal);
      const fosLsl = roundToThreeDecimals(buffer.fosLsl ?? fosNominal);
      const fosRawData = buffer.fosRawData.map(point => ({
        cavity: point.cavity,
        shot: point.shot,
        value: roundToThreeDecimals(point.value),
      }));
      const fosFlatValues = fosRawData.map(point => point.value);

      const gtolMeasurement =
        buffer.gtolRawData.length === 0 && buffer.gtolRange === null
          ? null
          : {
              nominal: 0,
              usl: roundToThreeDecimals(buffer.gtolRange ?? 0),
              lsl: 0,
              rawData: buffer.gtolRawData.map(point => ({
                cavity: point.cavity,
                shot: point.shot,
                value: roundToThreeDecimals(point.value),
              })),
              flatValues: buffer.gtolRawData.map(point => roundToThreeDecimals(point.value)),
            };

      return {
        faiId: buffer.faiId,
        measurements: {
          FOS: {
            nominal: fosNominal,
            usl: fosUsl,
            lsl: fosLsl,
            rawData: fosRawData,
            flatValues: fosFlatValues,
          },
          GTol: gtolMeasurement,
        },
      } satisfies FaiParsedData;
    });

  const rowData: FaiDataRow[] = [];
  contractData.forEach(item => {
    const sourceBuffer = buffers.get(item.faiId);
    const cavitySet = new Set<string>();
    sourceBuffer?.cavityDimTypes.forEach((_, cavity) => cavitySet.add(cavity));
    item.measurements.FOS.rawData.forEach(point => cavitySet.add(point.cavity));
    item.measurements.GTol?.rawData.forEach(point => cavitySet.add(point.cavity));
    const cavities = Array.from(cavitySet).sort(compareCavity);

    const fosValueMap = new Map<string, number>();
    item.measurements.FOS.rawData.forEach(point => {
      fosValueMap.set(`${point.cavity}|${point.shot}`, point.value);
    });
    const gtolValueMap = new Map<string, number>();
    item.measurements.GTol?.rawData.forEach(point => {
      gtolValueMap.set(`${point.cavity}|${point.shot}`, point.value);
    });

    cavities.forEach(cavity => {
      const fosShots: ShotTuple = [
        fosValueMap.get(`${cavity}|1`) ?? null,
        fosValueMap.get(`${cavity}|2`) ?? null,
        fosValueMap.get(`${cavity}|3`) ?? null,
      ];
      const gtolShots: ShotTuple = [
        gtolValueMap.get(`${cavity}|1`) ?? null,
        gtolValueMap.get(`${cavity}|2`) ?? null,
        gtolValueMap.get(`${cavity}|3`) ?? null,
      ];

      const judgeFos = computeJudgeFromShots(
        fosShots,
        item.measurements.FOS.usl,
        item.measurements.FOS.lsl
      );
      const judgeGtol = item.measurements.GTol
        ? computeJudgeFromShots(
            gtolShots,
            item.measurements.GTol.usl,
            item.measurements.GTol.lsl
          )
        : "";

      rowData.push({
        faiSet: item.faiId,
        dim: item.faiId,
        dimType: sourceBuffer?.cavityDimTypes.get(cavity) ?? "",
        cavity,
        fos: item.measurements.FOS.nominal,
        plusTol:
          sourceBuffer?.plusTol ??
          roundToThreeDecimals(item.measurements.FOS.usl - item.measurements.FOS.nominal),
        minusTol:
          sourceBuffer?.minusTol ??
          roundToThreeDecimals(item.measurements.FOS.lsl - item.measurements.FOS.nominal),
        usl: item.measurements.FOS.usl,
        lsl: item.measurements.FOS.lsl,
        judgeFos,
        judgeGtol,
        isNG: judgeFos === "NG" || judgeGtol === "NG",
        fosShots,
        gtolShots,
      });
    });
  });

  return {
    contractData,
    rowData,
  };
}

function columnLabelToIndex(label: string): number {
  let index = 0;

  for (const char of label.toUpperCase()) {
    const charCode = char.charCodeAt(0);
    if (charCode < 65 || charCode > 90) {
      return -1;
    }

    index = index * 26 + (charCode - 64);
  }

  return index - 1;
}

function decodeWorksheetAddress(
  address: string
): { rowIndex: number; columnIndex: number } | null {
  const match = /^([A-Z]+)([1-9]\d*)$/i.exec(address);
  if (!match) {
    return null;
  }

  const columnIndex = columnLabelToIndex(match[1]);
  if (columnIndex < 0) {
    return null;
  }

  return {
    rowIndex: Number.parseInt(match[2], 10) - 1,
    columnIndex,
  };
}

function readWorksheetCellValue(cell: unknown): unknown {
  if (!cell || typeof cell !== "object") {
    return undefined;
  }

  const worksheetCell = cell as WorksheetCell;
  if (Object.prototype.hasOwnProperty.call(worksheetCell, "v")) {
    return worksheetCell.v;
  }

  if (Object.prototype.hasOwnProperty.call(worksheetCell, "w")) {
    return worksheetCell.w;
  }

  return undefined;
}

export function extractPopulatedSheetRows(
  sheet: Record<string, unknown>
): unknown[][] {
  const rowsByIndex = new Map<number, Map<number, unknown>>();

  Object.entries(sheet).forEach(([address, rawCell]) => {
    if (address.startsWith("!")) {
      return;
    }

    const coordinates = decodeWorksheetAddress(address);
    if (!coordinates) {
      return;
    }

    const value = readWorksheetCellValue(rawCell);
    if (value === undefined) {
      return;
    }

    const existingRow = rowsByIndex.get(coordinates.rowIndex);
    const row = existingRow ?? new Map<number, unknown>();
    row.set(coordinates.columnIndex, value);

    if (!existingRow) {
      rowsByIndex.set(coordinates.rowIndex, row);
    }
  });

  return Array.from(rowsByIndex.entries())
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([, cellMap]) => {
      const row: unknown[] = [];

      Array.from(cellMap.entries())
        .sort(([leftColumn], [rightColumn]) => leftColumn - rightColumn)
        .forEach(([columnIndex, value]) => {
          row[columnIndex] = value;
        });

      return row;
    });
}

export function parseSheetRowsToContract(rows: unknown[][]): FaiParsedData[] {
  return buildContractSnapshot(rows).contractData;
}

export function parseSheetJsonRowsToContract(jsonRows: SheetJsonRow[]): FaiParsedData[] {
  const cleanedData = fillDownDimInJsonRows(jsonRows);
  const matrixRows = convertSheetJsonRowsToMatrixRows(cleanedData);
  return parseSheetRowsToContract(matrixRows);
}

export function parseSheetRows(rows: unknown[][]): {
  data: FaiDataRow[];
  summary: FaiParseSummary;
  contractData: FaiParsedData[];
} {
  const snapshot = buildContractSnapshot(rows);

  return {
    data: snapshot.rowData,
    summary: summarizeParsedRows(snapshot.rowData),
    contractData: snapshot.contractData,
  };
}

export function parseSheetJsonRows(jsonRows: SheetJsonRow[]): {
  data: FaiDataRow[];
  summary: FaiParseSummary;
  contractData: FaiParsedData[];
} {
  const cleanedData = fillDownDimInJsonRows(jsonRows);
  const matrixRows = convertSheetJsonRowsToMatrixRows(cleanedData);
  return parseSheetRows(matrixRows);
}

export function summarizeDimensionRowsByDimTypes(
  rows: FaiDataRow[],
  expectedDimTypes: string[]
): FaiParseSummary {
  const filteredRows = filterDimensionRowsByDimTypes(rows, expectedDimTypes);
  return summarizeParsedRows(filteredRows);
}

function filterDimensionRowsByDimTypes(
  rows: FaiDataRow[],
  expectedDimTypes: string[]
): FaiDataRow[] {
  const allowedTypes = new Set(
    expectedDimTypes.map(value => normalizeDimTypeKey(value))
  );
  return rows.filter(row => {
    return allowedTypes.has(normalizeDimTypeKey(row.dimType));
  });
}

function getJudgeBadgeClass(judge: string): string {
  if (judge.includes("NG")) {
    return "border border-red-500/30 bg-red-500/15 text-red-300";
  }

  if (judge.includes("OK") || judge.includes("QK")) {
    return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  return "border border-slate-700 bg-slate-950 text-slate-400";
}

function getFilterCardClass(
  isActive: boolean,
  tone: "neutral" | "success" | "danger"
): string {
  if (tone === "success") {
    return isActive
      ? "border-emerald-400/40 bg-emerald-500/12 shadow-[0_0_0_1px_rgba(52,211,153,0.18)]"
      : "border-emerald-500/15 bg-emerald-500/5 hover:border-emerald-400/25 hover:bg-emerald-500/10";
  }

  if (tone === "danger") {
    return isActive
      ? "border-red-400/35 bg-red-500/14 shadow-[0_0_0_1px_rgba(248,113,113,0.16)]"
      : "border-red-500/20 bg-red-500/10 hover:border-red-400/25 hover:bg-red-500/14";
  }

  return isActive
    ? "border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.14)]"
    : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950/90";
}

interface PartFaiParserSectionProps {
  moldId: string;
  moldNo?: string;
  trialStage?: string;
}

export default function PartFaiParserSection({
  moldId,
  moldNo,
  trialStage,
}: PartFaiParserSectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [faiData, setFaiData] = useState<FaiDataRow[]>([]);
  const [faiParsedData, setFaiParsedData] = useState<FaiParsedData[]>([]);
  const [summary, setSummary] = useState<FaiParseSummary>(EMPTY_SUMMARY);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RowFilter>("all");
  const [hiddenColumns, setHiddenColumns] = useState<ColumnId[]>([]);
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [canPersistRemoteState, setCanPersistRemoteState] = useState(false);
  const [isHcfFocusNgFilterActive, setIsHcfFocusNgFilterActive] =
    useState(false);
  const loadRequestIdRef = useRef(0);
  const visibleColumns = PART_FAI_COLUMNS.filter(
    column => !hiddenColumns.includes(column.id)
  );
  const visibleColumnCount = visibleColumns.length;
  const visibleGroupCounts = PART_FAI_COLUMN_GROUPS.map(group => ({
    ...group,
    count: visibleColumns.filter(column => column.group === group.id).length,
  })).filter(group => group.count > 0);

  const baseFilteredRows =
    activeFilter === "qualified"
      ? faiData.filter(row => !row.isNG)
      : activeFilter === "unqualified"
        ? faiData.filter(row => row.isNG)
        : faiData;
  const hcfFocusDimTypes = useMemo(() => ["HCF+CP", "HCF"], []);
  const hcfFocusRows = useMemo(
    () => filterDimensionRowsByDimTypes(faiData, hcfFocusDimTypes),
    [faiData, hcfFocusDimTypes]
  );
  const hcfFocusUnqualifiedRows = useMemo(
    () =>
      hcfFocusRows.filter(row => {
        return (
          getJudgeStatus(row.judgeFos) === "ng" ||
          getJudgeStatus(row.judgeGtol) === "ng"
        );
      }),
    [hcfFocusRows]
  );
  const hcfFocusSummary = useMemo(
    () => summarizeParsedRows(hcfFocusRows),
    [hcfFocusRows]
  );
  const filteredRows = isHcfFocusNgFilterActive
    ? hcfFocusUnqualifiedRows
    : baseFilteredRows;
  const hasDimTypeMetadata = faiData.some(
    row => normalizeDimTypeKey(row.dimType).length > 0
  );
  const needsDimTypeReparse =
    Boolean(fileName) && faiData.length > 0 && !hasDimTypeMetadata;

  const clearParsedData = () => {
    setFaiData([]);
    setFaiParsedData([]);
    setSummary(EMPTY_SUMMARY);
    setFileName("");
    setError("");
    setIsDragging(false);
    setActiveFilter("all");
    setHiddenColumns([]);
    setIsColumnPanelOpen(false);
    setIsHcfFocusNgFilterActive(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  useEffect(() => {
    setIsHydrated(false);
    setCanPersistRemoteState(false);

    const requestId = ++loadRequestIdRef.current;
    let cancelled = false;
    setFaiData([]);
    setFaiParsedData([]);
    setSummary(EMPTY_SUMMARY);
    setFileName("");
    setActiveFilter("all");
    setHiddenColumns([]);
    setIsHcfFocusNgFilterActive(false);
    setIsColumnPanelOpen(false);

    void (async () => {
      try {
        const storedState = await fetchPartFaiState({
          moldId,
          moldNo,
          trialStage,
        });
        if (cancelled || loadRequestIdRef.current !== requestId) {
          return;
        }

        if (storedState) {
          setFaiData(sanitizePersistedRows(storedState.data));
          setFaiParsedData([]);
          setSummary(sanitizePersistedSummary(storedState.summary));
          setFileName(String(storedState.fileName ?? ""));
          setActiveFilter(
            storedState.activeFilter === "qualified" ||
              storedState.activeFilter === "unqualified"
              ? storedState.activeFilter
              : "all"
          );
          setHiddenColumns(
            sanitizePersistedHiddenColumns(storedState.hiddenColumns)
          );
        } else {
          setFaiData([]);
          setFaiParsedData([]);
          setSummary(EMPTY_SUMMARY);
          setFileName("");
          setActiveFilter("all");
          setHiddenColumns([]);
        }

        setCanPersistRemoteState(true);
        setError("");
      } catch (loadError) {
        if (cancelled || loadRequestIdRef.current !== requestId) {
          return;
        }

        setFaiData([]);
        setFaiParsedData([]);
        setSummary(EMPTY_SUMMARY);
        setFileName("");
        setActiveFilter("all");
        setHiddenColumns([]);
        setCanPersistRemoteState(false);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load the saved Part FAI state."
        );
      } finally {
        if (cancelled) {
          return;
        }

        setIsDragging(false);
        setShowClearConfirm(false);
        setIsColumnPanelOpen(false);
        setIsHydrated(true);

        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [moldId, moldNo, trialStage]);

  useEffect(() => {
    if (!isHydrated || !canPersistRemoteState) {
      return;
    }

    void (async () => {
      try {
        if (!fileName && faiData.length === 0) {
          await deletePartFaiState({ moldId, moldNo, trialStage });
          return;
        }

        await savePartFaiState({
          moldId,
          moldNo,
          trialStage,
          fileName,
          activeFilter,
          hiddenColumns: hiddenColumns as PartFaiColumnId[],
          summary,
          data: faiData,
        });
      } catch (saveError) {
        console.error("Failed to persist Part FAI state:", saveError);
      }
    })();
  }, [
    activeFilter,
    faiData,
    fileName,
    hiddenColumns,
    canPersistRemoteState,
    isHydrated,
    moldId,
    moldNo,
    summary,
    trialStage,
  ]);

  const handleFile = async (file?: File) => {
    if (!file) return;

    setIsParsing(true);
    setError("");

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const targetSheetNames = workbook.SheetNames.slice(0, 2);
      if (targetSheetNames.length === 0) {
        throw new Error("No worksheet found in the uploaded Excel file.");
      }

      const selectedSheetRows = targetSheetNames.reduce<Record<string, unknown[][]>>(
        (accumulator, sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) {
            return accumulator;
          }

          accumulator[sheetName] = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
            header: 1,
            defval: "",
          });
          return accumulator;
        },
        {}
      );

      let firstSheetParsed: ReturnType<typeof parseSheetJsonRows> | null = null;
      let firstSheetError: unknown = null;
      for (const sheetName of targetSheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          continue;
        }

        try {
          const jsonData = XLSX.utils.sheet_to_json<SheetJsonRow>(worksheet, {
            defval: "",
          });
          firstSheetParsed = parseSheetJsonRows(jsonData);
          break;
        } catch (parseError) {
          firstSheetError = parseError;
        }
      }

      if (!firstSheetParsed) {
        if (firstSheetError instanceof Error) {
          throw firstSheetError;
        }
        throw new Error("Unable to parse the first two worksheets.");
      }

      const mergedSummary = summarizeWorkbookSheetRows(selectedSheetRows);

      setFaiData(firstSheetParsed.data);
      setFaiParsedData(firstSheetParsed.contractData);
      setSummary(mergedSummary ?? firstSheetParsed.summary);
      setFileName(file.name);
      setActiveFilter("all");
      setIsColumnPanelOpen(false);
    } catch (err) {
      setFaiData([]);
      setFaiParsedData([]);
      setSummary(EMPTY_SUMMARY);
      setFileName("");
      setActiveFilter("all");
      setHiddenColumns([]);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to parse the product FAI workbook."
      );
    } finally {
      setIsParsing(false);
    }
  };

  const toggleColumnVisibility = (columnId: ColumnId) => {
    setHiddenColumns(current => {
      if (current.includes(columnId)) {
        return current.filter(value => value !== columnId);
      }

      if (PART_FAI_COLUMNS.length - current.length <= 1) {
        return current;
      }

      return [...current, columnId];
    });
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-300">
              PRODUCT FAI PARSING DATA / 产品尺寸解析
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
              First 2 Worksheets Summary
            </span>
            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
              {moldId}
            </span>
            {moldNo ? (
              <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                {moldNo}
              </span>
            ) : null}
            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
              {trialStage || "T0"}
            </span>
            {faiParsedData.length > 0 ? (
              <span className="rounded-md border border-cyan-700/60 bg-cyan-950/30 px-2 py-1 text-cyan-300">
                FAI Keys: {faiParsedData.length}
              </span>
            ) : null}
            {fileName ? <span>{fileName}</span> : null}
            {(fileName || faiData.length > 0 || error) && !isParsing ? (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
              >
                <Trash2 className="h-3 w-3" />
                Clear Data
              </button>
            ) : null}
          </div>
        </div>

        {faiData.length === 0 ? (
          <div
            onDragOver={event => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={event => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={event => {
              event.preventDefault();
              setIsDragging(false);
              void handleFile(event.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all ${
              isDragging
                ? "border-cyan-500/60 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                : "border-slate-700 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-950"
            }`}
          >
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
              <UploadCloud
                className={`h-10 w-10 ${isDragging ? "text-cyan-400" : "text-slate-500"}`}
              />
              <div className="text-sm text-slate-300">
                Upload Product FAI Excel
                <span className="ml-1 text-slate-500">(.xlsx / .xls)</span>
              </div>
              <p className="text-xs leading-6 text-slate-500">
                Parses the Dimension report grid for table rows, and calculates
                summary cards from the isolated first worksheet
                OK-NG counts without double-counting mirrored rows.
              </p>
              {isParsing ? (
                <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-cyan-400">
                  Parsing workbook...
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-cyan-300">
                    Product FAI File Loaded
                  </div>
                  <div className="text-sm text-slate-200">
                    {fileName || "Current workbook attached"}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                上传区已收起。清除当前结果后可重新上传。
              </div>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={event => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        ) : null}

        {faiData.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  setIsHcfFocusNgFilterActive(false);
                  setActiveFilter("all");
                }}
                className={`rounded-xl border p-3 text-left transition-all ${getFilterCardClass(activeFilter === "all", "neutral")}`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Total Rows
                </div>
                <div className="mt-2 text-2xl font-mono text-slate-100">
                  {summary.totalRows}
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsHcfFocusNgFilterActive(false);
                  setActiveFilter("qualified");
                }}
                className={`rounded-xl border p-3 text-left transition-all ${getFilterCardClass(activeFilter === "qualified", "success")}`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
                  Qualified Rows
                </div>
                <div className="mt-2 text-2xl font-mono text-emerald-400">
                  {summary.qualifiedRows}
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsHcfFocusNgFilterActive(false);
                  setActiveFilter("unqualified");
                }}
                className={`rounded-xl border p-3 text-left transition-all ${getFilterCardClass(activeFilter === "unqualified", "danger")}`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-red-300/80">
                  Unqualified Rows
                </div>
                <div className="mt-2 text-2xl font-mono text-red-400">
                  {summary.ngRows}
                </div>
              </button>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300/80">
                  Qualified Rate
                </div>
                <div className="mt-2 text-2xl font-mono text-cyan-300">
                  {summary.qualifiedRate === null
                    ? "N/A"
                    : `${formatPercent(summary.qualifiedRate)}%`}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/[0.06] p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-fuchsia-300/80">
                    HCF+CP + HCF Focus
                  </div>
                  <div className="mt-1 text-sm text-slate-200">
                    Dim. Type = HCF+CP + HCF
                  </div>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-fuchsia-200/70">
                  Dimension report column C subset · Total uses OK+NG counts
                </div>
              </div>
              {needsDimTypeReparse ? (
                <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  当前这份已保存的 Part FAI 结果缺少 `Dim. Type` 元数据。
                  清除当前结果后重新上传同一份 Excel，HCF+CP 统计会正常显示。
                </div>
              ) : null}
            <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="rounded-xl border border-fuchsia-500/20 bg-slate-950/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-fuchsia-200/80">
                    Total Rows
                  </div>
                  <div className="mt-2 text-2xl font-mono text-slate-100">
                    {needsDimTypeReparse ? "--" : hcfFocusSummary.totalRows}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-slate-950/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-200/80">
                    Qualified Rows
                  </div>
                  <div className="mt-2 text-2xl font-mono text-emerald-300">
                    {needsDimTypeReparse ? "--" : hcfFocusSummary.qualifiedRows}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={needsDimTypeReparse}
                  onClick={() => {
                    if (needsDimTypeReparse) return;
                    setActiveFilter("all");
                    setIsHcfFocusNgFilterActive(current => !current);
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    needsDimTypeReparse
                      ? "cursor-not-allowed opacity-60"
                      : isHcfFocusNgFilterActive
                        ? "border-rose-400/35 bg-rose-500/14 shadow-[0_0_0_1px_rgba(251,113,133,0.16)]"
                        : "border-rose-500/20 bg-slate-950/40 hover:border-rose-400/40 hover:bg-rose-500/8"
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-rose-200/80">
                    Unqualified Rows
                  </div>
                  <div className="mt-2 text-2xl font-mono text-rose-300">
                    {needsDimTypeReparse ? "--" : hcfFocusSummary.ngRows}
                  </div>
                  <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.2em] text-rose-200/60">
                    Click To Filter Table
                  </div>
                </button>
                <div className="rounded-xl border border-cyan-500/20 bg-slate-950/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-200/80">
                    Qualified Rate
                  </div>
                  <div className="mt-2 text-2xl font-mono text-cyan-300">
                    {needsDimTypeReparse
                      ? "N/A"
                      : hcfFocusSummary.qualifiedRate === null
                        ? "N/A"
                        : `${formatPercent(hcfFocusSummary.qualifiedRate)}%`}
                  </div>
                </div>
              </div>
              {false ? (
                <div className="mt-3 rounded-xl border border-rose-500/20 bg-slate-950/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-rose-200/80">
                      HCF+CP + HCF NG Values ({hcfFocusUnqualifiedRows.length})
                    </div>
                    <button
                      type="button"
                      onClick={() => undefined}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  {hcfFocusUnqualifiedRows.length === 0 ? (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                      当前 HCF+CP + HCF 子集中没有 NG 项。
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-xs">
                        <thead className="bg-slate-900/80 text-slate-300">
                          <tr>
                            <th className="border border-slate-800 px-2 py-1.5 text-left">Dim. #</th>
                            <th className="border border-slate-800 px-2 py-1.5 text-left">Dim. Type</th>
                            <th className="border border-slate-800 px-2 py-1.5 text-left">Cavity</th>
                            <th className="border border-slate-800 px-2 py-1.5 text-left">Judge FOS</th>
                            <th className="border border-slate-800 px-2 py-1.5 text-left">Judge G-Tol</th>
                            <th className="border border-slate-800 px-2 py-1.5 text-left">FOS Shots</th>
                            <th className="border border-slate-800 px-2 py-1.5 text-left">G-Tol Shots</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hcfFocusUnqualifiedRows.map((row, rowIndex) => (
                            <tr key={`${row.dim}-${row.cavity}-${rowIndex}`} className="odd:bg-slate-900/30">
                              <td className="border border-slate-800 px-2 py-1.5 text-slate-200">{row.dim || "--"}</td>
                              <td className="border border-slate-800 px-2 py-1.5 text-slate-300">{row.dimType || "--"}</td>
                              <td className="border border-slate-800 px-2 py-1.5 text-slate-300">{row.cavity || "--"}</td>
                              <td className="border border-slate-800 px-2 py-1.5 text-slate-300">{row.judgeFos || "--"}</td>
                              <td className="border border-slate-800 px-2 py-1.5 text-slate-300">{row.judgeGtol || "--"}</td>
                              <td className="border border-slate-800 px-2 py-1.5 text-slate-300">
                                {row.fosShots.map(value => formatNumber(value)).join(" / ")}
                              </td>
                              <td className="border border-slate-800 px-2 py-1.5 text-slate-300">
                                {row.gtolShots.map(value => formatNumber(value)).join(" / ")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800/80 px-3 py-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-slate-500">
                    {isHcfFocusNgFilterActive
                      ? `Showing HCF+CP + HCF NG Rows (${filteredRows.length})`
                      : activeFilter === "qualified"
                        ? `Showing Qualified Rows (${filteredRows.length})`
                        : activeFilter === "unqualified"
                          ? `Showing Unqualified Rows (${filteredRows.length})`
                          : `Showing All Rows (${filteredRows.length})`}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                      Visible {visibleColumnCount}/{PART_FAI_COLUMNS.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsColumnPanelOpen(current => !current)}
                      className="rounded-md border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
                    >
                      Hide Columns / 隐藏列
                    </button>
                    {hiddenColumns.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setHiddenColumns([])}
                        className="rounded-md border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
                      >
                        Reset Columns
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              {isColumnPanelOpen ? (
                <div className="border-b border-slate-800/80 bg-slate-950/50 px-3 py-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-500">
                      Toggle table columns. At least one column stays visible.
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-600">
                      Hidden {hiddenColumns.length}
                    </span>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-3">
                    {PART_FAI_COLUMN_GROUPS.map(group => (
                      <div
                        key={group.id}
                        className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"
                      >
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          {group.label}
                        </div>
                        <div className="space-y-2">
                          {PART_FAI_COLUMNS.filter(
                            column => column.group === group.id
                          ).map(column => {
                            const isHidden = hiddenColumns.includes(column.id);
                            const disableHide =
                              !isHidden && visibleColumnCount <= 1;

                            return (
                              <label
                                key={column.id}
                                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs transition ${
                                  isHidden
                                    ? "border-slate-800 bg-slate-950/70 text-slate-500"
                                    : "border-slate-700 bg-slate-900/90 text-slate-200"
                                } ${disableHide ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-cyan-400/30 hover:text-cyan-200"}`}
                              >
                                <span className="font-mono uppercase tracking-[0.12em]">
                                  {column.label}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={!isHidden}
                                  disabled={disableHide}
                                  onChange={() =>
                                    toggleColumnVisibility(column.id)
                                  }
                                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400/40"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-950 text-xs font-semibold tracking-wider text-slate-400">
                    <tr className="border-b border-slate-800/80 text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      {visibleGroupCounts.map(group => (
                        <th
                          key={group.id}
                          className="px-3 py-2 text-left"
                          colSpan={group.count}
                        >
                          {group.label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {visibleColumns.map(column => (
                        <th
                          key={column.id}
                          className="px-3 py-3 text-left whitespace-nowrap"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => {
                      const fosJudgeStatus = getJudgeStatus(row.judgeFos);
                      const gtolJudgeStatus = getJudgeStatus(row.judgeGtol);
                      const rowValueClass = row.isNG
                        ? "text-red-400"
                        : "text-slate-300";
                      const rowMutedValueClass = row.isNG
                        ? "text-red-300"
                        : "text-slate-400";
                      const fosShotValueClass =
                        fosJudgeStatus === "ok"
                          ? "text-emerald-300"
                          : fosJudgeStatus === "ng"
                            ? "text-red-300"
                            : "text-slate-200";
                      const gtolShotValueClass =
                        gtolJudgeStatus === "ok"
                          ? "text-emerald-300"
                          : gtolJudgeStatus === "ng"
                            ? "text-red-300"
                            : "text-slate-200";

                      return (
                        <tr
                          key={`${row.dim}-${index}`}
                          className={`border-t transition-colors ${
                            row.isNG
                              ? "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/15"
                              : "border-slate-800/80 bg-slate-900/30 hover:bg-slate-900/60"
                          }`}
                        >
                          {visibleColumns.map(column => {
                            switch (column.id) {
                              case "dim":
                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className={`px-3 py-3 font-mono text-xs font-semibold ${row.isNG ? "text-red-300" : "text-slate-100"}`}
                                  >
                                    {row.dim}
                                  </td>
                                );
                              case "fos":
                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className={`px-3 py-3 font-mono text-xs ${rowValueClass}`}
                                  >
                                    {formatNumber(row.fos)}
                                  </td>
                                );
                              case "plusTol":
                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}
                                  >
                                    {formatNumber(row.plusTol)}
                                  </td>
                                );
                              case "minusTol":
                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}
                                  >
                                    {formatNumber(row.minusTol)}
                                  </td>
                                );
                              case "usl":
                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}
                                  >
                                    {formatNumber(row.usl)}
                                  </td>
                                );
                              case "lsl":
                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}
                                  >
                                    {formatNumber(row.lsl)}
                                  </td>
                                );
                              case "judgeFos":
                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className="px-3 py-3"
                                  >
                                    <span
                                      className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs ${getJudgeBadgeClass(row.judgeFos)}`}
                                    >
                                      {row.judgeFos || "--"}
                                    </span>
                                  </td>
                                );
                              case "cavity":
                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className={`px-3 py-3 font-mono text-xs ${row.isNG ? "text-red-300" : "text-slate-300"}`}
                                  >
                                    {row.cavity || "--"}
                                  </td>
                                );
                              case "fosShot1":
                              case "fosShot2":
                              case "fosShot3": {
                                const shotIndex =
                                  Number(column.id.slice(-1)) - 1;

                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className="px-3 py-2"
                                  >
                                    <span
                                      className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs tabular-nums ${fosShotValueClass}`}
                                    >
                                      {formatNumber(row.fosShots[shotIndex])}
                                    </span>
                                  </td>
                                );
                              }
                              case "judgeGtol":
                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className="px-3 py-3"
                                  >
                                    <span
                                      className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs ${getJudgeBadgeClass(row.judgeGtol)}`}
                                    >
                                      {row.judgeGtol || "--"}
                                    </span>
                                  </td>
                                );
                              case "gtolShot1":
                              case "gtolShot2":
                              case "gtolShot3": {
                                const shotIndex =
                                  Number(column.id.slice(-1)) - 1;

                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className="px-3 py-2"
                                  >
                                    <span
                                      className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs tabular-nums ${gtolShotValueClass}`}
                                    >
                                      {formatNumber(row.gtolShots[shotIndex])}
                                    </span>
                                  </td>
                                );
                              }
                              default:
                                return null;
                            }
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span>RED = Judge FOS or Judge G-Tol contains NG</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  Summary cards count OK / NG from first worksheet Judge columns
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                <span>Qualified Rate = OK Count / (OK Count + NG Count)</span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <CyberConfirmDialog
        open={showClearConfirm}
        title="确认清除数据"
        message="确定要清除当前已上传的产品 FAI 文件、解析结果和统计面板吗？此操作会重置当前视图。"
        onConfirm={() => {
          setShowClearConfirm(false);
          clearParsedData();
        }}
        onCancel={() => setShowClearConfirm(false)}
        confirmText="确认清除"
        cancelText="取消"
      />
    </section>
  );
}
