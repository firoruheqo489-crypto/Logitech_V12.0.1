'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Sparkles, Trash2, UploadCloud } from 'lucide-react';

import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import { buildDashboardScopedStorageKey } from '@/lib/dashboardClientState';

import {
  normalizeColorDifferenceRows,
  normalizeColorSectionMeta,
  parseSurfaceSheetRows,
  type RoughnessRow,
  type SurfaceParseSummary,
  type SurfaceSectionMeta,
  type SurfaceValueRow,
} from './surface-parser-core';

const EMPTY_SUMMARY: SurfaceParseSummary = {
  totalRows: 0,
  ngRows: 0,
  qualifiedRows: 0,
  qualifiedRate: null,
};

const EMPTY_META: SurfaceSectionMeta = {
  title: '--',
  standard: '--',
  placement: '--',
};

function buildSurfaceParserStorageKey(moldId: string, moldNo?: string, trialStage?: string): string {
  return buildDashboardScopedStorageKey(
    'surface-parser',
    moldId,
    moldNo || 'default',
    trialStage || 'T0',
  );
}

function sanitizeMeta(value: unknown): SurfaceSectionMeta {
  if (!value || typeof value !== 'object') {
    return EMPTY_META;
  }

  const record = value as Record<string, unknown>;
  return {
    title: String(record.title ?? '--'),
    standard: String(record.standard ?? '--'),
    placement: String(record.placement ?? '--'),
  };
}

function sanitizeSummary(value: unknown): SurfaceParseSummary {
  if (!value || typeof value !== 'object') {
    return EMPTY_SUMMARY;
  }

  const record = value as Record<string, unknown>;
  return {
    totalRows: Number(record.totalRows ?? 0) || 0,
    ngRows: Number(record.ngRows ?? 0) || 0,
    qualifiedRows: Number(record.qualifiedRows ?? 0) || 0,
    qualifiedRate: record.qualifiedRate === null || record.qualifiedRate === undefined
      ? null
      : Number(record.qualifiedRate),
  };
}

function buildSummaryFromRows<T extends { isNG: boolean }>(rows: T[]): SurfaceParseSummary {
  const totalRows = rows.length;
  const ngRows = rows.filter((row) => row.isNG).length;
  const qualifiedRows = totalRows - ngRows;

  return {
    totalRows,
    ngRows,
    qualifiedRows,
    qualifiedRate: totalRows > 0 ? Number(((qualifiedRows / totalRows) * 100).toFixed(2)) : null,
  };
}

function sanitizeRoughnessRows(value: unknown): RoughnessRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const record = row as Record<string, unknown>;
      const cavity = String(record.cavity ?? '').trim();
      if (!cavity) {
        return null;
      }

      const rawFrontRa = typeof record.frontRa === 'number' ? record.frontRa : Number(record.frontRa ?? NaN);
      const rawFrontRpc = typeof record.frontRpc === 'number' ? record.frontRpc : Number(record.frontRpc ?? NaN);
      const rawBackRa = typeof record.backRa === 'number' ? record.backRa : Number(record.backRa ?? NaN);
      const rawBackRpc = typeof record.backRpc === 'number' ? record.backRpc : Number(record.backRpc ?? NaN);

      return {
        cavity,
        frontRa: Number.isFinite(rawFrontRa) ? rawFrontRa : null,
        frontRpc: Number.isFinite(rawFrontRpc) ? rawFrontRpc : null,
        frontJudge: String(record.frontJudge ?? '').trim().toUpperCase(),
        backRa: Number.isFinite(rawBackRa) ? rawBackRa : null,
        backRpc: Number.isFinite(rawBackRpc) ? rawBackRpc : null,
        backJudge: String(record.backJudge ?? '').trim().toUpperCase(),
        isNG: Boolean(record.isNG),
      };
    })
    .filter((row): row is RoughnessRow => row !== null);
}

function sanitizeValueRows(value: unknown): SurfaceValueRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const record = row as Record<string, unknown>;
      const cavity = String(record.cavity ?? '').trim();
      if (!cavity) {
        return null;
      }

      const rawFrontVal = typeof record.frontVal === 'number' ? record.frontVal : Number(record.frontVal ?? NaN);
      const rawBackVal = typeof record.backVal === 'number' ? record.backVal : Number(record.backVal ?? NaN);

      return {
        cavity,
        frontVal: Number.isFinite(rawFrontVal) ? rawFrontVal : null,
        frontJudge: String(record.frontJudge ?? '').trim().toUpperCase(),
        backVal: Number.isFinite(rawBackVal) ? rawBackVal : null,
        backJudge: String(record.backJudge ?? '').trim().toUpperCase(),
        isNG: Boolean(record.isNG),
      };
    })
    .filter((row): row is SurfaceValueRow => row !== null);
}

function readStoredSurfaceState(storageKey: string): {
  fileName: string;
  roughnessData: RoughnessRow[];
  glossData: SurfaceValueRow[];
  colorData: SurfaceValueRow[];
  roughnessMeta: SurfaceSectionMeta;
  glossMeta: SurfaceSectionMeta;
  colorMeta: SurfaceSectionMeta;
  roughnessSummary: SurfaceParseSummary;
  glossSummary: SurfaceParseSummary;
  colorSummary: SurfaceParseSummary;
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
    const normalizedColorData = normalizeColorDifferenceRows(sanitizeValueRows(parsed.colorData));

    return {
      fileName: String(parsed.fileName ?? ''),
      roughnessData: sanitizeRoughnessRows(parsed.roughnessData),
      glossData: sanitizeValueRows(parsed.glossData),
      colorData: normalizedColorData,
      roughnessMeta: sanitizeMeta(parsed.roughnessMeta),
      glossMeta: sanitizeMeta(parsed.glossMeta),
      colorMeta: normalizeColorSectionMeta(sanitizeMeta(parsed.colorMeta)),
      roughnessSummary: sanitizeSummary(parsed.roughnessSummary),
      glossSummary: sanitizeSummary(parsed.glossSummary),
      colorSummary: buildSummaryFromRows(normalizedColorData),
    };
  } catch {
    return null;
  }
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '--';

  const normalized = Number(value.toFixed(4));
  return Number.isInteger(normalized) ? String(normalized) : normalized.toString();
}

function formatPercent(value: number | null): string {
  return value === null || Number.isNaN(value) ? 'N/A' : value.toFixed(2);
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

function SummaryCards({ summary }: { summary: SurfaceParseSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Total Cavities
        </div>
        <div className="mt-2 text-2xl font-mono text-slate-100">{summary.totalRows}</div>
      </div>
      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
          Qualified
        </div>
        <div className="mt-2 text-2xl font-mono text-emerald-400">{summary.qualifiedRows}</div>
      </div>
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-red-300/80">
          NG
        </div>
        <div className="mt-2 text-2xl font-mono text-red-400">{summary.ngRows}</div>
      </div>
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300/80">
          Qualified Rate
        </div>
        <div className="mt-2 text-2xl font-mono text-cyan-300">
          {summary.qualifiedRate === null ? 'N/A' : `${formatPercent(summary.qualifiedRate)}%`}
        </div>
      </div>
    </div>
  );
}

function MetaBlock({ meta }: { meta: SurfaceSectionMeta }) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400 md:grid-cols-[1fr_1fr_1.35fr] md:items-start">
      <div>
        <div className="mb-1 font-semibold uppercase tracking-[0.24em] text-slate-500">Section</div>
        <div className="text-sm text-slate-200">{meta.title}</div>
      </div>
      <div>
        <div className="mb-1 font-semibold uppercase tracking-[0.24em] text-slate-500">Standard</div>
        <div className="text-sm text-slate-200">{meta.standard}</div>
      </div>
      <div>
        <div className="mb-1 font-semibold uppercase tracking-[0.24em] text-slate-500">Placement</div>
        <div className="pr-2 text-sm leading-7 text-slate-200 md:pr-4">{meta.placement}</div>
      </div>
    </div>
  );
}

function RoughnessTable({ rows }: { rows: RoughnessRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="max-h-[360px] overflow-auto">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-950 text-xs font-semibold tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-3 text-left">模具穴号</th>
              <th className="px-3 py-3 text-left">开口朝前 Ra</th>
              <th className="px-3 py-3 text-left">开口朝前 Rpc</th>
              <th className="px-3 py-3 text-left">侧面1判定</th>
              <th className="px-3 py-3 text-left">开口朝后 Ra</th>
              <th className="px-3 py-3 text-left">开口朝后 Rpc</th>
              <th className="px-3 py-3 text-left">侧面2判定</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.cavity}
                className={`border-t transition-colors ${
                  row.isNG
                    ? 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/15'
                    : 'border-slate-800/80 bg-slate-900/30 hover:bg-slate-900/60'
                }`}
              >
                <td className={`px-3 py-3 font-mono text-xs font-semibold ${row.isNG ? 'text-red-300' : 'text-slate-100'}`}>
                  {row.cavity}
                </td>
                <td className={`px-3 py-3 font-mono text-xs ${row.isNG ? 'text-red-300' : 'text-slate-200'}`}>{formatNumber(row.frontRa)}</td>
                <td className={`px-3 py-3 font-mono text-xs ${row.isNG ? 'text-red-300' : 'text-slate-200'}`}>{formatNumber(row.frontRpc)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs ${getJudgeBadgeClass(row.frontJudge)}`}>
                    {row.frontJudge || '--'}
                  </span>
                </td>
                <td className={`px-3 py-3 font-mono text-xs ${row.isNG ? 'text-red-300' : 'text-slate-200'}`}>{formatNumber(row.backRa)}</td>
                <td className={`px-3 py-3 font-mono text-xs ${row.isNG ? 'text-red-300' : 'text-slate-200'}`}>{formatNumber(row.backRpc)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs ${getJudgeBadgeClass(row.backJudge)}`}>
                    {row.backJudge || '--'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ValueTable({
  rows,
  frontLabel,
  side1Label,
  backLabel,
  side2Label,
}: {
  rows: SurfaceValueRow[];
  frontLabel: string;
  side1Label: string;
  backLabel: string;
  side2Label: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="max-h-[360px] overflow-auto">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-950 text-xs font-semibold tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-3 text-left">模具穴号</th>
              <th className="px-3 py-3 text-left">{frontLabel}</th>
              <th className="px-3 py-3 text-left">{side1Label}</th>
              <th className="px-3 py-3 text-left">{backLabel}</th>
              <th className="px-3 py-3 text-left">{side2Label}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.cavity}
                className={`border-t transition-colors ${
                  row.isNG
                    ? 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/15'
                    : 'border-slate-800/80 bg-slate-900/30 hover:bg-slate-900/60'
                }`}
              >
                <td className={`px-3 py-3 font-mono text-xs font-semibold ${row.isNG ? 'text-red-300' : 'text-slate-100'}`}>
                  {row.cavity}
                </td>
                <td className={`px-3 py-3 font-mono text-xs ${row.isNG ? 'text-red-300' : 'text-slate-200'}`}>{formatNumber(row.frontVal)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs ${getJudgeBadgeClass(row.frontJudge)}`}>
                    {row.frontJudge || '--'}
                  </span>
                </td>
                <td className={`px-3 py-3 font-mono text-xs ${row.isNG ? 'text-red-300' : 'text-slate-200'}`}>{formatNumber(row.backVal)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex min-w-[74px] items-center justify-center rounded-md px-2.5 py-1.5 font-mono text-xs ${getJudgeBadgeClass(row.backJudge)}`}>
                    {row.backJudge || '--'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SurfaceSection({
  stage,
  title,
  meta,
  summary,
  children,
}: {
  stage: string;
  title: string;
  meta: SurfaceSectionMeta;
  summary: SurfaceParseSummary;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-500/0 via-cyan-400/50 to-cyan-500/0" />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex min-w-[74px] items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">
            {stage}
          </span>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-slate-200">{title}</h3>
          </div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500">
          Missile Slice Ready
        </div>
      </div>
      <div className="space-y-4">
        <MetaBlock meta={meta} />
        <SummaryCards summary={summary} />
        {children}
      </div>
    </section>
  );
}

interface SurfaceParserSectionProps {
  moldId: string;
  moldNo?: string;
  trialStage?: string;
}

export default function SurfaceParserSection({
  moldId,
  moldNo,
  trialStage,
}: SurfaceParserSectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [roughnessData, setRoughnessData] = useState<RoughnessRow[]>([]);
  const [glossData, setGlossData] = useState<SurfaceValueRow[]>([]);
  const [colorData, setColorData] = useState<SurfaceValueRow[]>([]);
  const [roughnessMeta, setRoughnessMeta] = useState<SurfaceSectionMeta>(EMPTY_META);
  const [glossMeta, setGlossMeta] = useState<SurfaceSectionMeta>(EMPTY_META);
  const [colorMeta, setColorMeta] = useState<SurfaceSectionMeta>(EMPTY_META);
  const [roughnessSummary, setRoughnessSummary] = useState<SurfaceParseSummary>(EMPTY_SUMMARY);
  const [glossSummary, setGlossSummary] = useState<SurfaceParseSummary>(EMPTY_SUMMARY);
  const [colorSummary, setColorSummary] = useState<SurfaceParseSummary>(EMPTY_SUMMARY);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydratedStorageKey, setHydratedStorageKey] = useState('');
  const storageKey = buildSurfaceParserStorageKey(moldId, moldNo, trialStage);

  const hasParsedData = roughnessData.length > 0 || glossData.length > 0 || colorData.length > 0;

  const clearParsedData = () => {
    setRoughnessData([]);
    setGlossData([]);
    setColorData([]);
    setRoughnessMeta(EMPTY_META);
    setGlossMeta(EMPTY_META);
    setColorMeta(EMPTY_META);
    setRoughnessSummary(EMPTY_SUMMARY);
    setGlossSummary(EMPTY_SUMMARY);
    setColorSummary(EMPTY_SUMMARY);
    setFileName('');
    setError('');
    setIsDragging(false);

    if (inputRef.current) {
      inputRef.current.value = '';
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
  };

  useEffect(() => {
    setIsHydrated(false);

    const storedState = readStoredSurfaceState(storageKey);

    if (storedState) {
      setFileName(storedState.fileName);
      setRoughnessData(storedState.roughnessData);
      setGlossData(storedState.glossData);
      setColorData(storedState.colorData);
      setRoughnessMeta(storedState.roughnessMeta);
      setGlossMeta(storedState.glossMeta);
      setColorMeta(storedState.colorMeta);
      setRoughnessSummary(storedState.roughnessSummary);
      setGlossSummary(storedState.glossSummary);
      setColorSummary(storedState.colorSummary);
    } else {
      setFileName('');
      setRoughnessData([]);
      setGlossData([]);
      setColorData([]);
      setRoughnessMeta(EMPTY_META);
      setGlossMeta(EMPTY_META);
      setColorMeta(EMPTY_META);
      setRoughnessSummary(EMPTY_SUMMARY);
      setGlossSummary(EMPTY_SUMMARY);
      setColorSummary(EMPTY_SUMMARY);
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

    if (!fileName && !hasParsedData) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          fileName,
          roughnessData,
          glossData,
          colorData,
          roughnessMeta,
          glossMeta,
          colorMeta,
          roughnessSummary,
          glossSummary,
          colorSummary,
        }),
      );
    } catch {
      // Ignore storage write failures and keep the parser usable.
    }
  }, [
    colorData,
    colorMeta,
    colorSummary,
    fileName,
    glossData,
    glossMeta,
    glossSummary,
    hasParsedData,
    hydratedStorageKey,
    isHydrated,
    roughnessData,
    roughnessMeta,
    roughnessSummary,
    storageKey,
  ]);

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
      const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        raw: true,
        defval: '',
      });

      const parsed = parseSurfaceSheetRows(sheetRows);

      setRoughnessData(parsed.roughnessData);
      setGlossData(parsed.glossData);
      setColorData(parsed.colorData);
      setRoughnessMeta(parsed.roughnessMeta);
      setGlossMeta(parsed.glossMeta);
      setColorMeta(parsed.colorMeta);
      setRoughnessSummary(parsed.roughnessSummary);
      setGlossSummary(parsed.glossSummary);
      setColorSummary(parsed.colorSummary);
      setFileName(file.name);
    } catch (err) {
      clearParsedData();
      setError(err instanceof Error ? err.message : 'Failed to parse the surface workbook.');
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
              Surface Validation Parsing / 表面验证解析
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
              3 Stacked Blocks
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
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={!hasParsedData && !fileName}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors ${
                hasParsedData || fileName
                  ? 'border border-red-500/30 bg-red-500/10 text-red-200 hover:border-red-400/50 hover:bg-red-500/15'
                  : 'border border-slate-700 bg-slate-950 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Trash2 className="h-3 w-3" />
              Clear Data
            </button>
          </div>
        </div>

        {!hasParsedData ? (
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
                Upload Surface Excel
                <span className="ml-1 text-slate-500">(.xlsx / .xls)</span>
              </div>
              <p className="text-xs leading-6 text-slate-500">
                Scans the whole sheet for all 3 &quot;模具穴号&quot; anchors, slices Roughness, Glossiness, and
                Color Difference into discrete blocks, and renders explicit OK/NG judgement columns.
              </p>
              {isParsing ? (
                <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-cyan-400">
                  Parsing stacked surface blocks...
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
                    Surface File Loaded
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

        {hasParsedData ? (
          <div className="space-y-5">
            <SurfaceSection
              stage="Stage 1"
              title="Roughness Audit"
              meta={roughnessMeta}
              summary={roughnessSummary}
            >
              <RoughnessTable rows={roughnessData} />
            </SurfaceSection>

            <SurfaceSection
              stage="Stage 2"
              title="Glossiness Audit"
              meta={glossMeta}
              summary={glossSummary}
            >
              <ValueTable
                rows={glossData}
                frontLabel="开口朝前"
                side1Label="侧面1判定"
                backLabel="开口朝后"
                side2Label="侧面2判定"
              />
            </SurfaceSection>

            <SurfaceSection
              stage="Stage 3"
              title="Color Difference Audit"
              meta={colorMeta}
              summary={colorSummary}
            >
              <ValueTable
                rows={colorData}
                frontLabel="开口朝前"
                side1Label="面1判定"
                backLabel="开口朝后"
                side2Label="面2判定"
              />
            </SurfaceSection>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span>Rows turn red when either explicit judgement column contains NG</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Qualified rows are counted only when both judgement columns are OK</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <CyberConfirmDialog
        open={showClearConfirm}
        title="确认删除表面验证数据"
        message={`确定要删除当前 ${trialStage || 'T0'} 轮次下已上传的表面验证文件和解析结果吗？此操作会清空本地保存的数据，且无法撤销。`}
        onConfirm={() => {
          setShowClearConfirm(false);
          clearParsedData();
        }}
        onCancel={() => setShowClearConfirm(false)}
        confirmText="确认删除"
        cancelText="取消"
      />
    </section>
  );
}
