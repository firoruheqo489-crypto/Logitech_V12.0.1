'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Trash2, UploadCloud } from 'lucide-react';

import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';

type ShotTuple = [number | null, number | null, number | null];
type RowFilter = 'all' | 'qualified' | 'unqualified';

type FaiDataRow = {
  dim: string;
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

const EMPTY_SUMMARY: FaiParseSummary = {
  totalRows: 0,
  ngRows: 0,
  qualifiedRows: 0,
  qualifiedRate: null,
};

const SHOT_LABELS = ['Shot 1', 'Shot 2', 'Shot 3'] as const;

function buildFaiParserStorageKey(moldId: string, moldNo?: string, trialStage?: string): string {
  return `dashboard_fai_parser_state_v2:${moldId}:${moldNo || 'default'}:${trialStage || 'T0'}`;
}

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
    .replace(/[閿涘鑰縘]/g, '+')
    .replace(/[閿涘稄姊梋]/g, '-')
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

function roundToFourDecimals(value: number): number {
  return Number(value.toFixed(4));
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

function readStoredFaiState(storageKey: string): {
  data: FaiDataRow[];
  summary: FaiParseSummary;
  fileName: string;
  activeFilter: RowFilter;
} | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const activeFilter: RowFilter =
      parsed.activeFilter === 'qualified' || parsed.activeFilter === 'unqualified' ? parsed.activeFilter : 'all';

    return {
      data: sanitizePersistedRows(parsed.data),
      summary: sanitizePersistedSummary(parsed.summary),
      fileName: String(parsed.fileName ?? ''),
      activeFilter,
    };
  } catch {
    return null;
  }
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

  let totalRows = 0;
  let ngRows = 0;
  const parsedData: FaiDataRow[] = [];

  rows.slice(dataStartIndex).forEach((row) => {
    const dim = String(row[headerIndexes.dim] ?? '').trim();
    if (!dim) {
      return;
    }

    totalRows += 1;

    const judgeFos = normalizeJudge(row[headerIndexes.judgeFos]);
    const judgeGtol = normalizeJudge(row[headerIndexes.judgeGtol]);
    const isNG = judgeFos.includes('NG') || judgeGtol.includes('NG');

    if (isNG) {
      ngRows += 1;
    }

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
    summary: {
      totalRows,
      ngRows,
      qualifiedRows: totalRows - ngRows,
      qualifiedRate: totalRows > 0 ? roundToFourDecimals(((totalRows - ngRows) / totalRows) * 100) : null,
    },
  };
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

interface FaiParserSectionProps {
  moldId: string;
  moldNo?: string;
  trialStage?: string;
}

export default function FaiParserSection({
  moldId,
  moldNo,
  trialStage,
}: FaiParserSectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [faiData, setFaiData] = useState<FaiDataRow[]>([]);
  const [summary, setSummary] = useState<FaiParseSummary>(EMPTY_SUMMARY);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RowFilter>('all');
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydratedStorageKey, setHydratedStorageKey] = useState('');
  const storageKey = buildFaiParserStorageKey(moldId, moldNo, trialStage);

  const filteredRows =
    activeFilter === 'qualified'
      ? faiData.filter((row) => !row.isNG)
      : activeFilter === 'unqualified'
        ? faiData.filter((row) => row.isNG)
        : faiData;

  const clearParsedData = () => {
    setFaiData([]);
    setSummary(EMPTY_SUMMARY);
    setFileName('');
    setError('');
    setIsDragging(false);
    setActiveFilter('all');

    if (inputRef.current) {
      inputRef.current.value = '';
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
  };

  useEffect(() => {
    setIsHydrated(false);

    const storedState = readStoredFaiState(storageKey);
    if (storedState) {
      setFaiData(storedState.data);
      setSummary(storedState.summary);
      setFileName(storedState.fileName);
      setActiveFilter(storedState.activeFilter);
    } else {
      setFaiData([]);
      setSummary(EMPTY_SUMMARY);
      setFileName('');
      setActiveFilter('all');
    }

    setError('');
    setIsDragging(false);
    setShowClearConfirm(false);
    setIsHydrated(true);
    setHydratedStorageKey(storageKey);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated || hydratedStorageKey !== storageKey || typeof window === 'undefined') {
      return;
    }

    if (!fileName && faiData.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          data: faiData,
          summary,
          fileName,
          activeFilter,
        }),
      );
    } catch {
      // Ignore storage failures and keep the parser usable.
    }
  }, [activeFilter, faiData, fileName, hydratedStorageKey, isHydrated, storageKey, summary]);

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

      const firstSheet = workbook.Sheets[firstSheetName];
      const sheetRows = extractPopulatedSheetRows(firstSheet as Record<string, unknown>);

      const parsed = parseSheetRows(sheetRows);
      setFaiData(parsed.data);
      setSummary(parsed.summary);
      setFileName(file.name);
      setActiveFilter('all');
    } catch (err) {
      setFaiData([]);
      setSummary(EMPTY_SUMMARY);
      setFileName('');
      setActiveFilter('all');
      setError(err instanceof Error ? err.message : 'Failed to parse the FAI workbook.');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-300">
              FAI Parsing Data / 首件尺寸解析
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
              Sheet 1 Only
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
                Upload FAI Excel
                <span className="ml-1 text-slate-500">(.xlsx / .xls)</span>
              </div>
              <p className="text-xs leading-6 text-slate-500">
                Parses Sheet 1 only, keeps both FOS and G-Tol shot sets, counts rows strictly from Dim. #,
                trusts Judge FOS / Judge G-Tol for qualification, and reports the overall qualified rate.
              </p>
              {isParsing ? (
                <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-cyan-400">
                  Parsing Sheet 1...
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
                    FAI File Loaded
                  </div>
                  <div className="text-sm text-slate-200">{fileName || 'Current workbook attached'}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                上传框已收起。删除当前结果后可重新上传。
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

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800/80 px-3 py-2 text-[11px] font-mono uppercase tracking-[0.24em] text-slate-500">
                {activeFilter === 'qualified'
                  ? `Showing Qualified Rows (${filteredRows.length})`
                  : activeFilter === 'unqualified'
                    ? `Showing Unqualified Rows (${filteredRows.length})`
                    : `Showing All Rows (${filteredRows.length})`}
              </div>
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-950 text-xs font-semibold tracking-wider text-slate-400">
                    <tr className="border-b border-slate-800/80 text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      <th className="px-3 py-2 text-left" colSpan={7}>
                        FOS Block
                      </th>
                      <th className="px-3 py-2 text-left" colSpan={4}>
                        FOS Shots
                      </th>
                      <th className="px-3 py-2 text-left" colSpan={4}>
                        G-Tol Block
                      </th>
                    </tr>
                    <tr>
                      <th className="px-3 py-3 text-left">Dim. #</th>
                      <th className="px-3 py-3 text-left">FOS</th>
                      <th className="px-3 py-3 text-left">Plus Tol (+)</th>
                      <th className="px-3 py-3 text-left">Minus Tol (-)</th>
                      <th className="px-3 py-3 text-left">USL</th>
                      <th className="px-3 py-3 text-left">LSL</th>
                      <th className="px-3 py-3 text-left">Judge FOS</th>
                      {SHOT_LABELS.map((label) => (
                        <th key={`fos-${label}`} className="px-3 py-3 text-left whitespace-nowrap">
                          FOS {label}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-left">Judge G-Tol</th>
                      {SHOT_LABELS.map((label) => (
                        <th key={`gtol-${label}`} className="px-3 py-3 text-left whitespace-nowrap">
                          G-Tol {label}
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
                          <td className={`px-3 py-3 font-mono text-xs font-semibold ${row.isNG ? 'text-red-300' : 'text-slate-100'}`}>
                            {row.dim}
                          </td>
                          <td className={`px-3 py-3 font-mono text-xs ${rowValueClass}`}>{formatNumber(row.fos)}</td>
                          <td className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}>{formatNumber(row.plusTol)}</td>
                          <td className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}>{formatNumber(row.minusTol)}</td>
                          <td className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}>{formatNumber(row.usl)}</td>
                          <td className={`px-3 py-3 font-mono text-xs ${rowMutedValueClass}`}>{formatNumber(row.lsl)}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs ${getJudgeBadgeClass(row.judgeFos)}`}
                            >
                              {row.judgeFos || '--'}
                            </span>
                          </td>
                          {row.fosShots.map((value, shotIndex) => (
                            <td key={`${row.dim}-fos-${shotIndex}`} className="px-3 py-2">
                              <span className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs tabular-nums ${row.isNG ? 'text-red-300' : 'text-slate-200'}`}>
                                {formatNumber(value)}
                              </span>
                            </td>
                          ))}
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs ${getJudgeBadgeClass(row.judgeGtol)}`}
                            >
                              {row.judgeGtol || '--'}
                            </span>
                          </td>
                          {row.gtolShots.map((value, shotIndex) => (
                            <td key={`${row.dim}-gtol-${shotIndex}`} className="px-3 py-2">
                              <span className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs tabular-nums ${row.isNG ? 'text-red-300' : 'text-slate-200'}`}>
                                {formatNumber(value)}
                              </span>
                            </td>
                          ))}
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
                <span>Qualified rows are counted when neither judge contains NG</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                <span>Qualified Rate = (Total Rows - NG Rows) / Total Rows</span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <CyberConfirmDialog
        open={showClearConfirm}
        title="确认清除数据"
        message="确定要清除当前已上传的 FAI 文件、解析结果和统计面板吗？此操作会重置当前视图。"
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
