'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Trash2, UploadCloud } from 'lucide-react';

import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import {
  deleteToolingFaiState,
  fetchToolingFaiState,
  saveToolingFaiState,
  type ToolingFaiDataRow,
  type ToolingFaiParseSummary,
  type ToolingFaiRowFilter,
  type ToolingFaiRemoteState,
  type ToolingFaiShotTuple,
} from '@/lib/tooling-fai-api';
import { extractPopulatedSheetRows } from './part-fai-parser';

type ToolingFaiRow = ToolingFaiDataRow;
type ToolingFaiSummary = ToolingFaiParseSummary;
type ToolingRowFilter = ToolingFaiRowFilter;
type ToolingShotTuple = ToolingFaiShotTuple;

const EMPTY_SUMMARY: ToolingFaiSummary = {
  totalRows: 0,
  qualifiedRows: 0,
  ngRows: 0,
  totalMeasurements: 0,
  qualifiedMeasurements: 0,
  ngMeasurements: 0,
  qualifiedRate: null,
};

const TOOLING_SHOT_LABELS = ['SZ 1', 'SZ 2', 'SZ 3', 'SZ 4'] as const;

function buildToolingFaiStorageKey(moldId: string, moldNo?: string, trialStage?: string): string {
  return `dashboard_tooling_fai_parser_state_v2:${moldId}:${moldNo || 'default'}:${trialStage || 'T0'}`;
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

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '--';
  const normalized = Number(value.toFixed(4));
  return Number.isInteger(normalized) ? String(normalized) : normalized.toString();
}

function formatPercent(value: number | null): string {
  return value === null || Number.isNaN(value) ? 'N/A' : value.toFixed(2);
}

function roundToFourDecimals(value: number): number {
  return Number(value.toFixed(4));
}

function sanitizeShots(value: unknown): ToolingShotTuple {
  if (!Array.isArray(value)) {
    return [null, null, null, null];
  }

  return [
    coerceNumber(value[0]),
    coerceNumber(value[1]),
    coerceNumber(value[2]),
    coerceNumber(value[3]),
  ];
}

function sanitizePersistedRows(value: unknown): ToolingFaiRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const record = row as Record<string, unknown>;
      const faiNo = String(record.faiNo ?? '').trim();
      if (!faiNo) {
        return null;
      }

      return {
        faiNo,
        partPrecision: String(record.partPrecision ?? '').trim(),
        partDimension: coerceNumber(record.partDimension),
        plusTol: coerceNumber(record.plusTol),
        minusTol: coerceNumber(record.minusTol),
        toolingDimensionMinusC: coerceNumber(record.toolingDimensionMinusC),
        toolingDimension: coerceNumber(record.toolingDimension),
        toolingPlusTol: coerceNumber(record.toolingPlusTol),
        toolingMinusTol: coerceNumber(record.toolingMinusTol),
        process: String(record.process ?? '').trim(),
        shots: sanitizeShots(record.shots),
        accuracyScore: coerceNumber(record.accuracyScore),
        toolingScore: coerceNumber(record.toolingScore) ?? 0,
        measurementCount: coerceNumber(record.measurementCount) ?? 0,
        qualifiedCount: coerceNumber(record.qualifiedCount) ?? 0,
        isNG: Boolean(record.isNG),
      } satisfies ToolingFaiRow;
    })
    .filter((row): row is ToolingFaiRow => row !== null);
}

function sanitizePersistedSummary(value: unknown): ToolingFaiSummary {
  if (!value || typeof value !== 'object') {
    return EMPTY_SUMMARY;
  }

  const record = value as Record<string, unknown>;

  return {
    totalRows: coerceNumber(record.totalRows) ?? 0,
    qualifiedRows: coerceNumber(record.qualifiedRows) ?? 0,
    ngRows: coerceNumber(record.ngRows) ?? 0,
    totalMeasurements: coerceNumber(record.totalMeasurements) ?? 0,
    qualifiedMeasurements: coerceNumber(record.qualifiedMeasurements) ?? 0,
    ngMeasurements: coerceNumber(record.ngMeasurements) ?? 0,
    qualifiedRate: coerceNumber(record.qualifiedRate),
  };
}

function readStoredToolingFaiState(storageKey: string): {
  data: ToolingFaiRow[];
  summary: ToolingFaiSummary;
  fileName: string;
  activeFilter: ToolingRowFilter;
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
    const activeFilter: ToolingRowFilter =
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

function classifyShot(
  shot: number | null,
  toolingDimension: number | null,
  toolingPlusTol: number | null,
  toolingMinusTol: number | null,
): 0 | 1 {
  if (shot === null || toolingDimension === null) {
    return 0;
  }

  const normalizedShot = roundToFourDecimals(shot);
  const upperLimit = roundToFourDecimals(
    toolingPlusTol !== null ? toolingDimension + toolingPlusTol : toolingDimension,
  );
  const lowerLimit = roundToFourDecimals(
    toolingMinusTol !== null ? toolingDimension - toolingMinusTol : toolingDimension,
  );

  if (normalizedShot > upperLimit) return 0;
  if (normalizedShot < lowerLimit) return 0;
  return 1;
}

export function parseToolingFaiSheetRows(rows: unknown[][]): { data: ToolingFaiRow[]; summary: ToolingFaiSummary } {
  const parsedRows: ToolingFaiRow[] = [];
  let totalMeasurements = 0;
  let qualifiedMeasurements = 0;

  rows.slice(7).forEach((row) => {
    const faiNo = String(row[0] ?? '').trim();
    if (!faiNo) {
      return;
    }

    const shots: ToolingShotTuple = [
      coerceNumber(row[10]),
      coerceNumber(row[11]),
      coerceNumber(row[12]),
      coerceNumber(row[13]),
    ];

    const toolingDimension = coerceNumber(row[6]);
    const toolingPlusTol = coerceNumber(row[7]);
    const toolingMinusTol = coerceNumber(row[8]);

    const measurementCount = shots.filter((value) => value !== null).length;
    const qualifiedCount = shots.reduce<number>((sum, shot) => {
      return sum + classifyShot(shot, toolingDimension, toolingPlusTol, toolingMinusTol);
    }, 0);

    totalMeasurements += measurementCount;
    qualifiedMeasurements += qualifiedCount;

    const toolingScore = coerceNumber(row[15]) ?? qualifiedCount;
    const isNG = measurementCount > 0 ? qualifiedCount < measurementCount : toolingScore === 0;

    parsedRows.push({
      faiNo,
      partPrecision: String(row[1] ?? '').trim(),
      partDimension: coerceNumber(row[2]),
      plusTol: coerceNumber(row[3]),
      minusTol: coerceNumber(row[4]),
      toolingDimensionMinusC: coerceNumber(row[5]),
      toolingDimension,
      toolingPlusTol,
      toolingMinusTol,
      process: String(row[9] ?? '').trim(),
      shots,
      accuracyScore: coerceNumber(row[14]),
      toolingScore,
      measurementCount,
      qualifiedCount,
      isNG,
    });
  });

  const totalRows = parsedRows.length;
  const ngRows = parsedRows.filter((row) => row.isNG).length;
  const qualifiedRows = totalRows - ngRows;
  const ngMeasurements = totalMeasurements - qualifiedMeasurements;

  return {
    data: parsedRows,
    summary: {
      totalRows,
      qualifiedRows,
      ngRows,
      totalMeasurements,
      qualifiedMeasurements,
      ngMeasurements,
      qualifiedRate: totalMeasurements > 0 ? roundToFourDecimals((qualifiedMeasurements / totalMeasurements) * 100) : null,
    },
  };
}

interface ToolingFaiParserSectionProps {
  moldId: string;
  moldNo?: string;
  trialStage?: string;
}

export default function ToolingFaiParserSection({
  moldId,
  moldNo,
  trialStage,
}: ToolingFaiParserSectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [faiData, setFaiData] = useState<ToolingFaiRow[]>([]);
  const [summary, setSummary] = useState<ToolingFaiSummary>(EMPTY_SUMMARY);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ToolingRowFilter>('all');
  const [isHydrated, setIsHydrated] = useState(false);
  const loadRequestIdRef = useRef(0);
  const storageKey = buildToolingFaiStorageKey(moldId, moldNo, trialStage);

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

    const requestId = ++loadRequestIdRef.current;
    const storedState = readStoredToolingFaiState(storageKey);
    let cancelled = false;
    setFaiData([]);
    setSummary(EMPTY_SUMMARY);
    setFileName('');
    setActiveFilter('all');
    setIsDragging(false);
    setShowClearConfirm(false);

    void (async () => {
      try {
        const remoteState = await fetchToolingFaiState({ moldId, moldNo, trialStage });
        if (cancelled || loadRequestIdRef.current !== requestId) {
          return;
        }

        const nextState = remoteState ?? storedState;
        if (nextState) {
          setFaiData(sanitizePersistedRows(nextState.data));
          setSummary(sanitizePersistedSummary(nextState.summary));
          setFileName(String(nextState.fileName ?? ''));
          setActiveFilter(
            nextState.activeFilter === 'qualified' || nextState.activeFilter === 'unqualified'
              ? nextState.activeFilter
              : 'all',
          );
        }

        setError('');
      } catch (loadError) {
        if (cancelled || loadRequestIdRef.current !== requestId) {
          return;
        }

        if (storedState) {
          setFaiData(storedState.data);
          setSummary(storedState.summary);
          setFileName(storedState.fileName);
          setActiveFilter(storedState.activeFilter);
          setError('');
        } else {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the saved Tooling FAI state.');
        }
      } finally {
        if (cancelled) {
          return;
        }

        setIsHydrated(true);

        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void (async () => {
      try {
        if (!fileName && faiData.length === 0) {
          await deleteToolingFaiState({ moldId, moldNo, trialStage });
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(storageKey);
          }
          return;
        }

        await saveToolingFaiState({
          moldId,
          moldNo,
          trialStage,
          fileName,
          activeFilter,
          summary,
          data: faiData,
        } satisfies ToolingFaiRemoteState);

        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(storageKey);
        }
      } catch (saveError) {
        console.error('Failed to persist Tooling FAI state:', saveError);
      }
    })();
  }, [activeFilter, faiData, fileName, isHydrated, moldId, moldNo, storageKey, summary, trialStage]);

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
      const parsed = parseToolingFaiSheetRows(sheetRows);

      setFaiData(parsed.data);
      setSummary(parsed.summary);
      setFileName(file.name);
      setActiveFilter('all');
    } catch (err) {
      setFaiData([]);
      setSummary(EMPTY_SUMMARY);
      setFileName('');
      setActiveFilter('all');
      setError(err instanceof Error ? err.message : 'Failed to parse the tooling FAI workbook.');
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
              TOOLING FAI PARSING DATA / 模具尺寸解析
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
              Current Sheet Only
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
                Upload Tooling FAI Excel
                <span className="ml-1 text-slate-500">(.xlsx / .xls)</span>
              </div>
              <p className="text-xs leading-6 text-slate-500">
                Parses the current sheet only, uses the fixed Tooling FAI layout, evaluates P-column logic from
                K:N against G/H/I tolerances, and reports the overall qualified rate.
              </p>
              {isParsing ? (
                <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-cyan-400">
                  Parsing current sheet...
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
                    Tooling FAI File Loaded
                  </div>
                  <div className="text-sm text-slate-200">{fileName || 'Current workbook attached'}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                仅识别当前页固定表格，其他页默认忽略。
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
                  总测点数
                </div>
                <div className="mt-2 text-2xl font-mono text-slate-100">{summary.totalMeasurements}</div>
                <div className="mt-2 text-[11px] text-slate-500">尺寸项 {summary.totalRows}</div>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('qualified')}
                className={`rounded-xl border p-3 text-left transition-all ${getFilterCardClass(activeFilter === 'qualified', 'success')}`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
                  合格测点
                </div>
                <div className="mt-2 text-2xl font-mono text-emerald-400">{summary.qualifiedMeasurements}</div>
                <div className="mt-2 text-[11px] text-emerald-300/70">
                  合格尺寸项 {summary.qualifiedRows}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('unqualified')}
                className={`rounded-xl border p-3 text-left transition-all ${getFilterCardClass(activeFilter === 'unqualified', 'danger')}`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-red-300/80">
                  不合格测点
                </div>
                <div className="mt-2 text-2xl font-mono text-red-400">{summary.ngMeasurements}</div>
                <div className="mt-2 text-[11px] text-red-300/70">不合格尺寸项 {summary.ngRows}</div>
              </button>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300/80">
                  合格率
                </div>
                <div className="mt-2 text-2xl font-mono text-cyan-300">
                  {summary.qualifiedRate === null ? 'N/A' : `${formatPercent(summary.qualifiedRate)}%`}
                </div>
                <div className="mt-2 text-[11px] text-cyan-200/70">按测点计算，不按尺寸项计算</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800/80 px-3 py-2 text-[11px] font-mono uppercase tracking-[0.24em] text-slate-500">
                {activeFilter === 'qualified'
                  ? `显示合格尺寸项 (${filteredRows.length})`
                  : activeFilter === 'unqualified'
                    ? `显示不合格尺寸项 (${filteredRows.length})`
                    : `显示全部尺寸项 (${filteredRows.length})`}
              </div>
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-950 text-xs font-semibold tracking-wider text-slate-400">
                    <tr>
                      <th className="min-w-[112px] px-3 py-3 text-left whitespace-nowrap">FAI No.</th>
                      <th className="min-w-[92px] px-2 py-3 text-left leading-4">
                        <span className="inline-flex flex-col">
                          <span>Part</span>
                          <span>Precision</span>
                        </span>
                      </th>
                      <th className="min-w-[96px] px-2 py-3 text-left leading-4">
                        <span className="inline-flex flex-col">
                          <span>Part</span>
                          <span>Dimension</span>
                        </span>
                      </th>
                      <th className="px-3 py-3 text-left">Tol +</th>
                      <th className="px-3 py-3 text-left">Tol -</th>
                      <th className="px-3 py-3 text-left">Tooling Dim -C</th>
                      <th className="px-3 py-3 text-left">Tooling Dimension</th>
                      <th className="px-3 py-3 text-left">Tooling Tol +</th>
                      <th className="px-3 py-3 text-left">Tooling Tol -</th>
                      <th className="px-3 py-3 text-left">Process</th>
                      {TOOLING_SHOT_LABELS.map((label) => (
                        <th key={label} className="px-3 py-3 text-left whitespace-nowrap">
                          {label}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-left">Accuracy Score</th>
                      <th className="px-3 py-3 text-left">Tooling FAI Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => {
                      const rowClass = row.isNG
                        ? 'border-red-500/20 bg-red-500/10 hover:bg-red-500/15'
                        : 'border-slate-800/80 bg-slate-900/30 hover:bg-slate-900/60';

                      const buildValueClass = (value: number | null) => {
                        if (value === 0) return 'text-red-400';
                        if (row.isNG) return 'text-red-300';
                        return 'text-slate-300';
                      };

                      return (
                        <tr key={`${row.faiNo}-${index}`} className={`border-t transition-colors ${rowClass}`}>
                          <td className={`min-w-[112px] px-3 py-3 font-mono text-xs font-semibold whitespace-nowrap ${row.isNG ? 'text-red-300' : 'text-slate-100'}`}>
                            {row.faiNo}
                          </td>
                          <td className={`min-w-[92px] px-2 py-3 font-mono text-xs ${row.isNG ? 'text-red-300' : 'text-slate-300'}`}>
                            {row.partPrecision || '--'}
                          </td>
                          <td className={`min-w-[96px] px-2 py-3 font-mono text-xs ${buildValueClass(row.partDimension)}`}>
                            {formatNumber(row.partDimension)}
                          </td>
                          <td className={`px-3 py-3 font-mono text-xs ${buildValueClass(row.plusTol)}`}>
                            {formatNumber(row.plusTol)}
                          </td>
                          <td className={`px-3 py-3 font-mono text-xs ${buildValueClass(row.minusTol)}`}>
                            {formatNumber(row.minusTol)}
                          </td>
                          <td className={`px-3 py-3 font-mono text-xs ${buildValueClass(row.toolingDimensionMinusC)}`}>
                            {formatNumber(row.toolingDimensionMinusC)}
                          </td>
                          <td className={`px-3 py-3 font-mono text-xs ${buildValueClass(row.toolingDimension)}`}>
                            {formatNumber(row.toolingDimension)}
                          </td>
                          <td className={`px-3 py-3 font-mono text-xs ${buildValueClass(row.toolingPlusTol)}`}>
                            {formatNumber(row.toolingPlusTol)}
                          </td>
                          <td className={`px-3 py-3 font-mono text-xs ${buildValueClass(row.toolingMinusTol)}`}>
                            {formatNumber(row.toolingMinusTol)}
                          </td>
                          <td className={`px-3 py-3 font-mono text-xs ${row.isNG ? 'text-red-300' : 'text-slate-300'}`}>
                            {row.process || '--'}
                          </td>
                          {row.shots.map((shot, shotIndex) => (
                            <td key={`${row.faiNo}-${shotIndex}`} className={`px-3 py-3 font-mono text-xs ${buildValueClass(shot)}`}>
                              {formatNumber(shot)}
                            </td>
                          ))}
                          <td className={`px-3 py-3 font-mono text-xs ${buildValueClass(row.accuracyScore)}`}>
                            {formatNumber(row.accuracyScore)}
                          </td>
                          <td className={`px-3 py-3 font-mono text-xs font-semibold ${row.toolingScore === 0 ? 'text-red-400' : row.isNG ? 'text-red-300' : 'text-cyan-300'}`}>
                            {row.toolingScore}
                          </td>
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
                <span>RED = zero score or out-of-range dimension</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Qualified Rate = SUM(P score) / COUNT(K:N measurement cells)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                <span>
                  Qualified points {summary.qualifiedMeasurements} / Total points {summary.totalMeasurements}
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <CyberConfirmDialog
        open={showClearConfirm}
        title="确认清除数据"
        message="确定要清除当前已上传的模具 FAI 文件、解析结果和统计面板吗？此操作会重置当前视图。"
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
