'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Trash2, UploadCloud } from 'lucide-react';

import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import {
  deletePartFaiState,
  fetchPartFaiState,
  savePartFaiState,
  type PartFaiColumnId,
} from '@/lib/part-fai-api';

type ShotTuple = [number | null, number | null, number | null];
type RowFilter = 'all' | 'qualified' | 'unqualified';
type ColumnGroupId = 'fosBlock' | 'fosShots' | 'gtolBlock';
type ColumnId =
  | 'dim'
  | 'fos'
  | 'plusTol'
  | 'minusTol'
  | 'usl'
  | 'lsl'
  | 'judgeFos'
  | 'cavity'
  | 'fosShot1'
  | 'fosShot2'
  | 'fosShot3'
  | 'judgeGtol'
  | 'gtolShot1'
  | 'gtolShot2'
  | 'gtolShot3';

type FaiDataRow = {
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

type HeaderIndexes = {
  dim: number;
  dimType: number;
  cavity: number;
  fos: number;
  plusTol: number;
  minusTol: number;
  usl: number;
  lsl: number;
  judgeFos: number;
  judgeGtol: number;
  fosShotIndexes: [number, number, number];
  gtolShotIndexes: [number, number, number];
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

const SHOT_LABELS = ['Shot 1', 'Shot 2', 'Shot 3'] as const;

const PART_FAI_COLUMN_GROUPS: Array<{ id: ColumnGroupId; label: string }> = [
  { id: 'fosBlock', label: 'FOS Block' },
  { id: 'fosShots', label: 'FOS Shots' },
  { id: 'gtolBlock', label: 'G-Tol Block' },
];

const PART_FAI_COLUMNS: PartFaiColumnDefinition[] = [
  { id: 'dim', label: 'Dim. #', group: 'fosBlock' },
  { id: 'fos', label: 'FOS', group: 'fosBlock' },
  { id: 'plusTol', label: 'Plus Tol (+)', group: 'fosBlock' },
  { id: 'minusTol', label: 'Minus Tol (-)', group: 'fosBlock' },
  { id: 'usl', label: 'USL', group: 'fosBlock' },
  { id: 'lsl', label: 'LSL', group: 'fosBlock' },
  { id: 'judgeFos', label: 'Judge FOS', group: 'fosBlock' },
  { id: 'cavity', label: 'Cavity #', group: 'fosBlock' },
  { id: 'fosShot1', label: `FOS ${SHOT_LABELS[0]}`, group: 'fosShots' },
  { id: 'fosShot2', label: `FOS ${SHOT_LABELS[1]}`, group: 'fosShots' },
  { id: 'fosShot3', label: `FOS ${SHOT_LABELS[2]}`, group: 'fosShots' },
  { id: 'judgeGtol', label: 'Judge G-Tol', group: 'gtolBlock' },
  { id: 'gtolShot1', label: `G-Tol ${SHOT_LABELS[0]}`, group: 'gtolBlock' },
  { id: 'gtolShot2', label: `G-Tol ${SHOT_LABELS[1]}`, group: 'gtolBlock' },
  { id: 'gtolShot3', label: `G-Tol ${SHOT_LABELS[2]}`, group: 'gtolBlock' },
];

const PART_FAI_COLUMN_IDS = PART_FAI_COLUMNS.map((column) => column.id);

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasCellValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const normalized = text
    .replace(/,/g, '')
    .replace(/[^\d.+-]/g, '');

  if (!normalized || normalized === '+' || normalized === '-' || normalized === '.') {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function coerceToleranceNumber(value: unknown, fallbackToZero: boolean): number | null {
  const parsed = coerceNumber(value);
  if (parsed !== null) {
    return parsed;
  }

  return fallbackToZero ? 0 : null;
}

function normalizeJudge(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function getJudgeStatus(value: string): 'ok' | 'ng' | 'other' {
  if (value.includes('NG')) {
    return 'ng';
  }

  if (value.includes('OK')) {
    return 'ok';
  }

  return 'other';
}

function summarizeParsedRows(rows: FaiDataRow[]): FaiParseSummary {
  const okResults = rows.reduce((count, row) => (
    count
    + (getJudgeStatus(row.judgeFos) === 'ok' ? 1 : 0)
    + (getJudgeStatus(row.judgeGtol) === 'ok' ? 1 : 0)
  ), 0);
  const ngResults = rows.reduce((count, row) => (
    count
    + (getJudgeStatus(row.judgeFos) === 'ng' ? 1 : 0)
    + (getJudgeStatus(row.judgeGtol) === 'ng' ? 1 : 0)
  ), 0);
  const totalResults = okResults + ngResults;

  return {
    totalRows: totalResults,
    ngRows: ngResults,
    qualifiedRows: okResults,
    qualifiedRate: totalResults > 0 ? roundToFourDecimals((okResults / totalResults) * 100) : null,
  };
}

function normalizeSheetNameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findSheetRowsByKey(sheetRowsByName: Record<string, unknown[][]>, expectedKey: string): unknown[][] | null {
  for (const [sheetName, rows] of Object.entries(sheetRowsByName)) {
    if (normalizeSheetNameKey(sheetName) === expectedKey) {
      return rows;
    }
  }

  return null;
}

function countStatusesInColumn(rows: unknown[][], columnLabel: string): { okCount: number; ngCount: number } {
  const columnIndex = columnLabelToIndex(columnLabel);
  if (columnIndex < 0) {
    return { okCount: 0, ngCount: 0 };
  }

  return rows.reduce((counts, row) => {
    const status = getJudgeStatus(normalizeJudge(row[columnIndex]));
    return {
      okCount: counts.okCount + (status === 'ok' ? 1 : 0),
      ngCount: counts.ngCount + (status === 'ng' ? 1 : 0),
    };
  }, { okCount: 0, ngCount: 0 });
}

export function summarizeWorkbookSheetRows(sheetRowsByName: Record<string, unknown[][]>): FaiParseSummary | null {
  const dimensionRows = findSheetRowsByKey(sheetRowsByName, 'dimensionreport');
  const profileScanRows = findSheetRowsByKey(sheetRowsByName, 'profilescanreport');

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
  const profileCounts = profileScanRows ? countStatusesInColumn(profileScanRows, 'C') : { okCount: 0, ngCount: 0 };

  const qualifiedRows = dimensionSummary.qualifiedRows + profileCounts.okCount;
  const ngRows = dimensionSummary.ngRows + profileCounts.ngCount;
  const totalRows = qualifiedRows + ngRows;

  return {
    totalRows,
    ngRows,
    qualifiedRows,
    qualifiedRate: totalRows > 0 ? roundToFourDecimals((qualifiedRows / totalRows) * 100) : null,
  };
}

function roundToFourDecimals(value: number): number {
  return Number(value.toFixed(4));
}

function normalizeDimTypeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '--';

  const normalized = Number(value.toFixed(4));
  return Number.isInteger(normalized) ? String(normalized) : normalized.toString();
}

function formatPercent(value: number | null): string {
  return value === null || Number.isNaN(value) ? 'N/A' : value.toFixed(2);
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
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const record = row as Record<string, unknown>;
      const dim = String(record.dim ?? '').trim();
      if (!dim) {
        return null;
      }

      return {
        dim,
        dimType: String(record.dimType ?? '').trim(),
        cavity: String(record.cavity ?? '').trim(),
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
  if (!value || typeof value !== 'object') {
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
        .map((item) => String(item ?? ''))
        .filter((item): item is ColumnId => isPartFaiColumnId(item)),
    ),
  );
}

function findRequiredIndex(headers: unknown[], matcher: (header: string) => boolean, label: string): number {
  const index = headers.findIndex((cell) => matcher(normalizeHeader(cell)));
  if (index < 0) {
    throw new Error(`Missing required column: ${label}`);
  }

  return index;
}

function findHeaderIndexes(headers: unknown[]): HeaderIndexes {
  const dim = 0;
  const dimType = headers.findIndex((cell) => {
    const header = normalizeHeader(cell);
    return header === 'dim. type' || header === 'dim type' || header.includes('dim type');
  });
  const cavity = headers.findIndex((cell) => {
    const header = normalizeHeader(cell);
    return header === 'cavity #' || header === 'cavity#' || header.includes('cavity');
  });
  const judgeFos = findRequiredIndex(headers, (header) => header.includes('judge fos'), 'Judge FOS');
  const judgeGtol = findRequiredIndex(
    headers,
    (header) => header.includes('judge g-tol') || header.includes('judge gtol'),
    'Judge G-Tol',
  );
  const fos = headers.findIndex((cell) => {
    const header = normalizeHeader(cell);
    return header.includes('fos') && !header.includes('judge');
  });
  const plusTol = headers.findIndex((cell) => normalizeHeader(cell).includes('plus tol'));
  const minusTol = headers.findIndex((cell) => normalizeHeader(cell).includes('minus tol'));
  const usl = headers.findIndex((cell) => {
    const header = normalizeHeader(cell);
    return header === 'usl' || header.includes('upper spec');
  });
  const lsl = headers.findIndex((cell) => {
    const header = normalizeHeader(cell);
    return header === 'lsl' || header.includes('lower spec');
  });

  return {
    dim,
    dimType,
    cavity,
    fos,
    plusTol,
    minusTol,
    usl,
    lsl,
    judgeFos,
    judgeGtol,
    fosShotIndexes: [judgeFos + 1, judgeFos + 2, judgeFos + 3],
    gtolShotIndexes: [judgeGtol + 1, judgeGtol + 2, judgeGtol + 3],
  };
}

function readShotTuple(row: unknown[], indexes: [number, number, number]): ShotTuple {
  return indexes.map((index) => coerceNumber(row[index])) as ShotTuple;
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

function decodeWorksheetAddress(address: string): { rowIndex: number; columnIndex: number } | null {
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
  if (!cell || typeof cell !== 'object') {
    return undefined;
  }

  const worksheetCell = cell as WorksheetCell;
  if (Object.prototype.hasOwnProperty.call(worksheetCell, 'v')) {
    return worksheetCell.v;
  }

  if (Object.prototype.hasOwnProperty.call(worksheetCell, 'w')) {
    return worksheetCell.w;
  }

  return undefined;
}

export function extractPopulatedSheetRows(sheet: Record<string, unknown>): unknown[][] {
  const rowsByIndex = new Map<number, Map<number, unknown>>();

  Object.entries(sheet).forEach(([address, rawCell]) => {
    if (address.startsWith('!')) {
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

export function parseSheetRows(rows: unknown[][]): { data: FaiDataRow[]; summary: FaiParseSummary } {
  const headerRowIndex = rows.findIndex((row) => {
    const firstCell = normalizeHeader(row[0]);
    return firstCell.includes('dim') && firstCell.includes('#');
  });

  if (headerRowIndex < 0) {
    throw new Error('Unable to locate the FAI header row.');
  }

  const headers = rows[headerRowIndex] ?? [];
  const dataStartIndex = headerRowIndex + 1;
  const headerIndexes = findHeaderIndexes(headers);

  const parsedData: FaiDataRow[] = [];

  rows.slice(dataStartIndex).forEach((row) => {
    const dim = String(row[headerIndexes.dim] ?? '').trim();
    if (!dim) {
      return;
    }

    const judgeFos = normalizeJudge(row[headerIndexes.judgeFos]);
    const judgeGtol = normalizeJudge(row[headerIndexes.judgeGtol]);
    const isNG = getJudgeStatus(judgeFos) === 'ng' || getJudgeStatus(judgeGtol) === 'ng';

    const rawFos = headerIndexes.fos >= 0 ? row[headerIndexes.fos] : null;
    const fos = hasCellValue(rawFos) ? coerceNumber(rawFos) : null;
    const plusTol =
      headerIndexes.plusTol >= 0
        ? coerceToleranceNumber(row[headerIndexes.plusTol], fos !== null)
        : fos !== null
          ? 0
          : null;
    const minusTol =
      headerIndexes.minusTol >= 0
        ? coerceToleranceNumber(row[headerIndexes.minusTol], fos !== null)
        : fos !== null
          ? 0
          : null;
    const directUsl = headerIndexes.usl >= 0 ? coerceNumber(row[headerIndexes.usl]) : null;
    const directLsl = headerIndexes.lsl >= 0 ? coerceNumber(row[headerIndexes.lsl]) : null;
    const usl = directUsl ?? (fos !== null && plusTol !== null ? roundToFourDecimals(fos + plusTol) : null);
    const lsl = directLsl ?? (fos !== null && minusTol !== null ? roundToFourDecimals(fos + minusTol) : null);

    parsedData.push({
      dim,
      dimType: headerIndexes.dimType >= 0 ? String(row[headerIndexes.dimType] ?? '').trim() : '',
      cavity: headerIndexes.cavity >= 0 ? String(row[headerIndexes.cavity] ?? '').trim() : '',
      fos,
      plusTol,
      minusTol,
      usl,
      lsl,
      judgeFos,
      judgeGtol,
      isNG,
      fosShots: readShotTuple(row, headerIndexes.fosShotIndexes),
      gtolShots: readShotTuple(row, headerIndexes.gtolShotIndexes),
    });
  });

  return {
    data: parsedData,
    summary: summarizeParsedRows(parsedData),
  };
}

export function summarizeDimensionRowsByDimTypes(
  rows: FaiDataRow[],
  expectedDimTypes: string[],
): FaiParseSummary {
  const allowedTypes = new Set(expectedDimTypes.map((value) => normalizeDimTypeKey(value)));
  const filteredRows = rows.filter((row) => {
    return allowedTypes.has(normalizeDimTypeKey(row.dimType));
  });

  return summarizeParsedRows(filteredRows);
}

function getJudgeBadgeClass(judge: string): string {
  if (judge.includes('NG')) {
    return 'border border-red-500/30 bg-red-500/15 text-red-300';
  }

  if (judge.includes('OK')) {
    return 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }

  return 'border border-slate-700 bg-slate-950 text-slate-400';
}

function getFilterCardClass(isActive: boolean, tone: 'neutral' | 'success' | 'danger'): string {
  if (tone === 'success') {
    return isActive
      ? 'border-emerald-400/40 bg-emerald-500/12 shadow-[0_0_0_1px_rgba(52,211,153,0.18)]'
      : 'border-emerald-500/15 bg-emerald-500/5 hover:border-emerald-400/25 hover:bg-emerald-500/10';
  }

  if (tone === 'danger') {
    return isActive
      ? 'border-red-400/35 bg-red-500/14 shadow-[0_0_0_1px_rgba(248,113,113,0.16)]'
      : 'border-red-500/20 bg-red-500/10 hover:border-red-400/25 hover:bg-red-500/14';
  }

  return isActive
    ? 'border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.14)]'
    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950/90';
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
  const [summary, setSummary] = useState<FaiParseSummary>(EMPTY_SUMMARY);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RowFilter>('all');
  const [hiddenColumns, setHiddenColumns] = useState<ColumnId[]>([]);
  const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const loadRequestIdRef = useRef(0);
  const visibleColumns = PART_FAI_COLUMNS.filter((column) => !hiddenColumns.includes(column.id));
  const visibleColumnCount = visibleColumns.length;
  const visibleGroupCounts = PART_FAI_COLUMN_GROUPS.map((group) => ({
    ...group,
    count: visibleColumns.filter((column) => column.group === group.id).length,
  })).filter((group) => group.count > 0);

  const filteredRows =
    activeFilter === 'qualified'
      ? faiData.filter((row) => !row.isNG)
      : activeFilter === 'unqualified'
        ? faiData.filter((row) => row.isNG)
        : faiData;
  const hcfFocusSummary = summarizeDimensionRowsByDimTypes(faiData, ['HCF+CP', 'HCF']);
  const hasDimTypeMetadata = faiData.some((row) => normalizeDimTypeKey(row.dimType).length > 0);
  const needsDimTypeReparse = fileName && faiData.length > 0 && !hasDimTypeMetadata;

  const clearParsedData = () => {
    setFaiData([]);
    setSummary(EMPTY_SUMMARY);
    setFileName('');
    setError('');
    setIsDragging(false);
    setActiveFilter('all');
    setHiddenColumns([]);
    setIsColumnPanelOpen(false);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  useEffect(() => {
    setIsHydrated(false);

    const requestId = ++loadRequestIdRef.current;
    let cancelled = false;
    setFaiData([]);
    setSummary(EMPTY_SUMMARY);
    setFileName('');
    setActiveFilter('all');
    setHiddenColumns([]);
    setIsColumnPanelOpen(false);

    void (async () => {
      try {
        const storedState = await fetchPartFaiState({ moldId, moldNo, trialStage });
        if (cancelled || loadRequestIdRef.current !== requestId) {
          return;
        }

        if (storedState) {
          setFaiData(sanitizePersistedRows(storedState.data));
          setSummary(sanitizePersistedSummary(storedState.summary));
          setFileName(String(storedState.fileName ?? ''));
          setActiveFilter(storedState.activeFilter === 'qualified' || storedState.activeFilter === 'unqualified' ? storedState.activeFilter : 'all');
          setHiddenColumns(sanitizePersistedHiddenColumns(storedState.hiddenColumns));
        } else {
          setFaiData([]);
          setSummary(EMPTY_SUMMARY);
          setFileName('');
          setActiveFilter('all');
          setHiddenColumns([]);
        }

        setError('');
      } catch (loadError) {
        if (cancelled || loadRequestIdRef.current !== requestId) {
          return;
        }

        setFaiData([]);
        setSummary(EMPTY_SUMMARY);
        setFileName('');
        setActiveFilter('all');
        setHiddenColumns([]);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load the saved Part FAI state.');
      } finally {
        if (cancelled) {
          return;
        }

        setIsDragging(false);
        setShowClearConfirm(false);
        setIsColumnPanelOpen(false);
        setIsHydrated(true);

        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [moldId, moldNo, trialStage]);

  useEffect(() => {
    if (!isHydrated) {
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
        console.error('Failed to persist Part FAI state:', saveError);
      }
    })();
  }, [activeFilter, faiData, fileName, hiddenColumns, isHydrated, moldId, moldNo, summary, trialStage]);

  const handleFile = async (file?: File) => {
    if (!file) return;

    setIsParsing(true);
    setError('');

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error('No worksheet found in the uploaded Excel file.');
      }

      const workbookSheetRows = Object.fromEntries(
        workbook.SheetNames.map((sheetName) => [
          sheetName,
          extractPopulatedSheetRows(workbook.Sheets[sheetName] as Record<string, unknown>),
        ]),
      ) as Record<string, unknown[][]>;
      const parseSourceRows = findSheetRowsByKey(workbookSheetRows, 'dimensionreport') ?? workbookSheetRows[firstSheetName];
      const parsed = parseSheetRows(parseSourceRows);
      const workbookSummary = summarizeWorkbookSheetRows(workbookSheetRows);

      setFaiData(parsed.data);
      setSummary(workbookSummary ?? parsed.summary);
      setFileName(file.name);
      setActiveFilter('all');
      setIsColumnPanelOpen(false);
    } catch (err) {
      setFaiData([]);
      setSummary(EMPTY_SUMMARY);
      setFileName('');
      setActiveFilter('all');
      setHiddenColumns([]);
      setError(err instanceof Error ? err.message : 'Failed to parse the product FAI workbook.');
    } finally {
      setIsParsing(false);
    }
  };

  const toggleColumnVisibility = (columnId: ColumnId) => {
    setHiddenColumns((current) => {
      if (current.includes(columnId)) {
        return current.filter((value) => value !== columnId);
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
              Sheet 1 + Sheet 2 Summary
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
              {trialStage || 'T0'}
            </span>
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
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void handleFile(event.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all ${
              isDragging
                ? 'border-cyan-500/60 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]'
                : 'border-slate-700 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-950'
            }`}
          >
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
              <UploadCloud className={`h-10 w-10 ${isDragging ? 'text-cyan-400' : 'text-slate-500'}`} />
              <div className="text-sm text-slate-300">
                Upload Product FAI Excel
                <span className="ml-1 text-slate-500">(.xlsx / .xls)</span>
              </div>
              <p className="text-xs leading-6 text-slate-500">
                Parses the Dimension report grid for table rows, and calculates summary cards from
                Dimension report plus Profile_Scan report OK-NG counts without double-counting mirrored rows.
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
                  <div className="text-sm text-slate-200">{fileName || 'Current workbook attached'}</div>
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
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = '';
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
                onClick={() => setActiveFilter('all')}
                className={`rounded-xl border p-3 text-left transition-all ${getFilterCardClass(activeFilter === 'all', 'neutral')}`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Total Rows
                </div>
                <div className="mt-2 text-2xl font-mono text-slate-100">{summary.totalRows}</div>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('qualified')}
                className={`rounded-xl border p-3 text-left transition-all ${getFilterCardClass(activeFilter === 'qualified', 'success')}`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
                  Qualified Rows
                </div>
                <div className="mt-2 text-2xl font-mono text-emerald-400">{summary.qualifiedRows}</div>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('unqualified')}
                className={`rounded-xl border p-3 text-left transition-all ${getFilterCardClass(activeFilter === 'unqualified', 'danger')}`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-red-300/80">
                  Unqualified Rows
                </div>
                <div className="mt-2 text-2xl font-mono text-red-400">{summary.ngRows}</div>
              </button>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300/80">
                  Qualified Rate
                </div>
                <div className="mt-2 text-2xl font-mono text-cyan-300">
                  {summary.qualifiedRate === null ? 'N/A' : `${formatPercent(summary.qualifiedRate)}%`}
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
                    {needsDimTypeReparse ? '--' : hcfFocusSummary.totalRows}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-slate-950/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-200/80">
                    Qualified Rows
                  </div>
                  <div className="mt-2 text-2xl font-mono text-emerald-300">
                    {needsDimTypeReparse ? '--' : hcfFocusSummary.qualifiedRows}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-slate-950/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-rose-200/80">
                    Unqualified Rows
                  </div>
                  <div className="mt-2 text-2xl font-mono text-rose-300">
                    {needsDimTypeReparse ? '--' : hcfFocusSummary.ngRows}
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-500/20 bg-slate-950/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-200/80">
                    Qualified Rate
                  </div>
                  <div className="mt-2 text-2xl font-mono text-cyan-300">
                    {needsDimTypeReparse
                      ? 'N/A'
                      : hcfFocusSummary.qualifiedRate === null
                        ? 'N/A'
                        : `${formatPercent(hcfFocusSummary.qualifiedRate)}%`}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800/80 px-3 py-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-slate-500">
                    {activeFilter === 'qualified'
                      ? `Showing Qualified Rows (${filteredRows.length})`
                      : activeFilter === 'unqualified'
                        ? `Showing Unqualified Rows (${filteredRows.length})`
                        : `Showing All Rows (${filteredRows.length})`}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                      Visible {visibleColumnCount}/{PART_FAI_COLUMNS.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsColumnPanelOpen((current) => !current)}
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
                    {PART_FAI_COLUMN_GROUPS.map((group) => (
                      <div key={group.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          {group.label}
                        </div>
                        <div className="space-y-2">
                          {PART_FAI_COLUMNS.filter((column) => column.group === group.id).map((column) => {
                            const isHidden = hiddenColumns.includes(column.id);
                            const disableHide = !isHidden && visibleColumnCount <= 1;

                            return (
                              <label
                                key={column.id}
                                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs transition ${
                                  isHidden
                                    ? 'border-slate-800 bg-slate-950/70 text-slate-500'
                                    : 'border-slate-700 bg-slate-900/90 text-slate-200'
                                } ${disableHide ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-cyan-400/30 hover:text-cyan-200'}`}
                              >
                                <span className="font-mono uppercase tracking-[0.12em]">{column.label}</span>
                                <input
                                  type="checkbox"
                                  checked={!isHidden}
                                  disabled={disableHide}
                                  onChange={() => toggleColumnVisibility(column.id)}
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
                      {visibleGroupCounts.map((group) => (
                        <th key={group.id} className="px-3 py-2 text-left" colSpan={group.count}>
                          {group.label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {visibleColumns.map((column) => (
                        <th key={column.id} className="px-3 py-3 text-left whitespace-nowrap">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => {
                      const rowValueClass = row.isNG ? 'text-red-400' : 'text-slate-300';
                      const rowMutedValueClass = row.isNG ? 'text-red-300' : 'text-slate-400';

                      return (
                        <tr
                          key={`${row.dim}-${index}`}
                          className={`border-t transition-colors ${
                            row.isNG
                              ? 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/15'
                              : 'border-slate-800/80 bg-slate-900/30 hover:bg-slate-900/60'
                          }`}
                        >
                          {visibleColumns.map((column) => {
                            switch (column.id) {
                              case 'dim':
                                return (
                                  <td
                                    key={`${row.dim}-${column.id}`}
                                    className={`px-3 py-3 font-mono text-xs font-semibold ${row.isNG ? 'text-red-300' : 'text-slate-100'}`}
                                  >
                                    {row.dim}
                                  </td>
                                );
                              case 'fos':
                                return (
                                  <td key={`${row.dim}-${column.id}`} className={`px-3 py-3 font-mono text-xs ${rowValueClass}`}>
                                    {formatNumber(row.fos)}
                                  </td>
                                );
                              case 'plusTol':
                                return (
                                  <td key={`${row.dim}-${column.id}`} className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}>
                                    {formatNumber(row.plusTol)}
                                  </td>
                                );
                              case 'minusTol':
                                return (
                                  <td key={`${row.dim}-${column.id}`} className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}>
                                    {formatNumber(row.minusTol)}
                                  </td>
                                );
                              case 'usl':
                                return (
                                  <td key={`${row.dim}-${column.id}`} className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}>
                                    {formatNumber(row.usl)}
                                  </td>
                                );
                              case 'lsl':
                                return (
                                  <td key={`${row.dim}-${column.id}`} className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}>
                                    {formatNumber(row.lsl)}
                                  </td>
                                );
                              case 'judgeFos':
                                return (
                                  <td key={`${row.dim}-${column.id}`} className="px-3 py-3">
                                    <span
                                      className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs ${getJudgeBadgeClass(row.judgeFos)}`}
                                    >
                                      {row.judgeFos || '--'}
                                    </span>
                                  </td>
                                );
                              case 'cavity':
                                return (
                                  <td key={`${row.dim}-${column.id}`} className={`px-3 py-3 font-mono text-xs ${row.isNG ? 'text-red-300' : 'text-slate-300'}`}>
                                    {row.cavity || '--'}
                                  </td>
                                );
                              case 'fosShot1':
                              case 'fosShot2':
                              case 'fosShot3': {
                                const shotIndex = Number(column.id.slice(-1)) - 1;

                                return (
                                  <td key={`${row.dim}-${column.id}`} className="px-3 py-2">
                                    <span className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs tabular-nums ${row.isNG ? 'text-red-300' : 'text-slate-200'}`}>
                                      {formatNumber(row.fosShots[shotIndex])}
                                    </span>
                                  </td>
                                );
                              }
                              case 'judgeGtol':
                                return (
                                  <td key={`${row.dim}-${column.id}`} className="px-3 py-3">
                                    <span
                                      className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs ${getJudgeBadgeClass(row.judgeGtol)}`}
                                    >
                                      {row.judgeGtol || '--'}
                                    </span>
                                  </td>
                                );
                              case 'gtolShot1':
                              case 'gtolShot2':
                              case 'gtolShot3': {
                                const shotIndex = Number(column.id.slice(-1)) - 1;

                                return (
                                  <td key={`${row.dim}-${column.id}`} className="px-3 py-2">
                                    <span className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs tabular-nums ${row.isNG ? 'text-red-300' : 'text-slate-200'}`}>
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
                <span>Summary cards count OK / NG from Dimension report K and Q plus Profile_Scan report C</span>
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
