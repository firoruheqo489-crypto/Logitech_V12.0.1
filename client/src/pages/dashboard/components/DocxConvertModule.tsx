import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, FileSpreadsheet, ImageIcon, Loader2, Trash2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CyberConfirmDialog from '@/components/ui/CyberConfirmDialog';
import { deleteAssetViaServer, uploadAssetViaServer } from '@/lib/ossUpload';
import AssetDrawerWorkspace, { buildAssetPanelKey, type AssetPanelItem } from './AssetDrawerWorkspace';
import {
  deleteDashboardDocxConverterState,
  fetchDashboardDocxConverterState,
  saveDashboardDocxConverterState,
  type DocxConverterRemoteStageState,
} from '../lib/docx-converter-state-api';
import {
  parseDocxReport,
  type ParseProgress,
  type ParseResult,
  type ParsedImage,
} from '../lib/docxConvertParser';
import { exportDocxParseResultToXlsx } from '../lib/docxConvertExporter';

interface DocxConvertModuleProps {
  panels: AssetPanelItem[];
}

type TrialStage = string;

interface TrialStageViewState {
  fileName: string | null;
  fileUrl: string | null;
  progress: ParseProgress | null;
  result: ParseResult | null;
  error: string | null;
  isParsing: boolean;
}

type StatusDisplayMode = 'all' | 'open' | 'close';
type StatusToken = {
  raw: string;
  state: 'open' | 'close';
  stage: number;
  index: number;
};

const DEFAULT_TRIAL_STAGES: TrialStage[] = ['T0', 'T1', 'T2', 'T3'];
const TRIAL_STAGE_PATTERN = /^T\d+$/;
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_CONVERTER_LOCAL_CACHE_PREFIX = 'dashboard-docx-converter-state:v1:';
const DOCX_CONVERTER_IDB_NAME = 'dashboard-docx-converter-cache-v1';
const DOCX_CONVERTER_IDB_STORE = 'stage-results';

const STAGE_LABELS: Record<ParseProgress['stage'], string> = {
  unzipping: '解压 DOCX',
  'parsing-xml': '解析 XML',
  'extracting-images': '提取图片',
  rendering: '渲染预览',
  done: '完成',
};

const COLUMN_WIDTH_CLASSES: Record<number, string> = {
  0: 'w-[5%]',
  1: 'w-[18%]',
  2: 'w-[7%]',
  3: 'w-[15%]',
  4: 'w-[15%]',
  5: 'w-[5%]',
  6: 'w-[18%]',
  7: 'w-[8%]',
  8: 'w-[9%]',
};

function trimDocxName(fileName: string): string {
  return fileName.replace(/\.docx$/i, '') || 'qe-report';
}

function isDocxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.docx');
}

function createTrialStageLabel(index: number): TrialStage {
  return `T${index}`;
}

function createEmptyTrialStageState(): TrialStageViewState {
  return {
    fileName: null,
    fileUrl: null,
    progress: null,
    result: null,
    error: null,
    isParsing: false,
  };
}

function normalizeTrialStages(value: unknown): TrialStage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((stage) => String(stage ?? '').trim().toUpperCase())
        .filter((stage): stage is TrialStage => TRIAL_STAGE_PATTERN.test(stage)),
    ),
  ).sort((a, b) => Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10));
}

function createStageStateMap(
  trialStages: TrialStage[],
  remoteStageStateByTrial?: Record<string, DocxConverterRemoteStageState>,
): Record<TrialStage, TrialStageViewState> {
  const normalizedTrialStages = normalizeTrialStages(trialStages);
  const normalizedRemoteStageState = remoteStageStateByTrial || {};

  const result = normalizedTrialStages.reduce(
    (acc, stage) => {
      const remoteState = normalizedRemoteStageState[stage];
      acc[stage] = {
        ...createEmptyTrialStageState(),
        fileName: remoteState?.fileName || null,
        fileUrl: remoteState?.fileUrl || null,
        result: remoteState?.result ?? null,
      };
      return acc;
    },
    {} as Record<TrialStage, TrialStageViewState>,
  );

  return result;
}

type DocxConverterLocalSnapshot = {
  moldId: string;
  moldNo?: string;
  trialStages: string[];
  activeTrial: string;
  stageStateByTrial: Record<string, DocxConverterRemoteStageState>;
  updatedAt?: string;
};

type PersistedTrialStageStateLike = {
  fileName?: string | null;
  fileUrl?: string | null;
  result?: ParseResult | null;
};

type StageResultCacheRecord = {
  key: string;
  result: ParseResult;
  updatedAt: string;
};

function buildLocalSnapshotKey(identity: { moldId: string; moldNo?: string }): string {
  return `${DOCX_CONVERTER_LOCAL_CACHE_PREFIX}${identity.moldId}::${identity.moldNo || ''}`;
}

function deleteLocalSnapshot(identity: { moldId: string; moldNo?: string }): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(buildLocalSnapshotKey(identity));
  } catch {
    // Ignore localStorage quota or browser restrictions.
  }
}

function hasPersistedStageContent(stageState?: PersistedTrialStageStateLike | null): boolean {
  if (!stageState) {
    return false;
  }

  const fileName = String(stageState.fileName || '').trim();
  const fileUrl = String(stageState.fileUrl || '').trim();
  return Boolean(fileName || fileUrl || stageState.result);
}

function trimTrailingEmptyTrialStages<T extends PersistedTrialStageStateLike>(
  trialStages: TrialStage[],
  stageStateByTrial: Record<string, T>,
): TrialStage[] {
  const normalizedTrialStages = normalizeTrialStages(trialStages);
  if (normalizedTrialStages.length === 0) {
    return [...DEFAULT_TRIAL_STAGES];
  }

  const trimmedTrialStages = [...normalizedTrialStages];
  while (trimmedTrialStages.length > DEFAULT_TRIAL_STAGES.length) {
    const lastStage = trimmedTrialStages[trimmedTrialStages.length - 1];
    if (hasPersistedStageContent(stageStateByTrial[lastStage])) {
      break;
    }
    trimmedTrialStages.pop();
  }

  return trimmedTrialStages.length > 0 ? trimmedTrialStages : [...DEFAULT_TRIAL_STAGES];
}

function buildStageResultCacheKey(identity: { moldId: string; moldNo?: string }, stage: string): string {
  return `${identity.moldId}::${identity.moldNo || ''}::${stage}`;
}

function openDocxConverterCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DOCX_CONVERTER_IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCX_CONVERTER_IDB_STORE)) {
        db.createObjectStore(DOCX_CONVERTER_IDB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function setStageResultCache(
  identity: { moldId: string; moldNo?: string },
  stage: string,
  result: ParseResult,
): Promise<void> {
  const db = await openDocxConverterCacheDb();
  if (!db) {
    return;
  }

  await new Promise<void>((resolve) => {
    const tx = db.transaction(DOCX_CONVERTER_IDB_STORE, 'readwrite');
    const store = tx.objectStore(DOCX_CONVERTER_IDB_STORE);
    const key = buildStageResultCacheKey(identity, stage);
    const value: StageResultCacheRecord = {
      key,
      result,
      updatedAt: new Date().toISOString(),
    };
    store.put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

async function getStageResultCache(
  identity: { moldId: string; moldNo?: string },
  stage: string,
): Promise<ParseResult | null> {
  const db = await openDocxConverterCacheDb();
  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(DOCX_CONVERTER_IDB_STORE, 'readonly');
    const store = tx.objectStore(DOCX_CONVERTER_IDB_STORE);
    const key = buildStageResultCacheKey(identity, stage);
    const request = store.get(key);
    request.onsuccess = () => {
      const record = request.result as StageResultCacheRecord | undefined;
      resolve(record?.result || null);
    };
    request.onerror = () => resolve(null);
  });
}

async function deleteStageResultCache(identity: { moldId: string; moldNo?: string }, stage: string): Promise<void> {
  const db = await openDocxConverterCacheDb();
  if (!db) {
    return;
  }

  await new Promise<void>((resolve) => {
    const tx = db.transaction(DOCX_CONVERTER_IDB_STORE, 'readwrite');
    const store = tx.objectStore(DOCX_CONVERTER_IDB_STORE);
    const key = buildStageResultCacheKey(identity, stage);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

function readLocalSnapshot(identity: { moldId: string; moldNo?: string }): DocxConverterLocalSnapshot | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const key = buildLocalSnapshotKey(identity);
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DocxConverterLocalSnapshot>;
    const stageStateByTrial =
      parsed.stageStateByTrial && typeof parsed.stageStateByTrial === 'object'
        ? (parsed.stageStateByTrial as Record<string, DocxConverterRemoteStageState>)
        : {};
    const trialStages = trimTrailingEmptyTrialStages(normalizeTrialStages(parsed.trialStages), stageStateByTrial);
    const fallbackTrialStages = trialStages.length > 0 ? trialStages : [...DEFAULT_TRIAL_STAGES];
    const activeTrialRaw = String(parsed.activeTrial || '').trim();
    const activeTrial = fallbackTrialStages.includes(activeTrialRaw) ? activeTrialRaw : fallbackTrialStages[0];

    return {
      moldId: identity.moldId,
      moldNo: identity.moldNo,
      trialStages: fallbackTrialStages,
      activeTrial,
      stageStateByTrial,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

function writeLocalSnapshot(snapshot: DocxConverterLocalSnapshot): void {
  if (typeof window === 'undefined') {
    return;
  }

  const trialStages = trimTrailingEmptyTrialStages(snapshot.trialStages, snapshot.stageStateByTrial);
  const activeTrial =
    trialStages.includes(snapshot.activeTrial) && snapshot.activeTrial
      ? snapshot.activeTrial
      : trialStages[0] || DEFAULT_TRIAL_STAGES[0];
  const key = buildLocalSnapshotKey({ moldId: snapshot.moldId, moldNo: snapshot.moldNo });
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...snapshot,
        trialStages,
        activeTrial,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Ignore localStorage quota or browser restrictions.
  }
}

function hasSnapshotContent(snapshot: DocxConverterLocalSnapshot | null | undefined): boolean {
  if (!snapshot) {
    return false;
  }
  return Object.keys(snapshot.stageStateByTrial || {}).length > 0;
}

function hasParseResultImages(result: ParseResult | null | undefined): boolean {
  if (!result) {
    return false;
  }

  return result.rows.some((row) => row.some((cell) => cell.images.length > 0));
}

function sanitizeParseResultForRemote(result: ParseResult | null): ParseResult | null {
  if (!result) {
    return null;
  }

  const sanitizedRows = result.rows.map((row) =>
    row.map((cell) => ({
      text: cell.text,
      images: [],
    })),
  );

  const hasAnyContent = sanitizedRows.some((row) => row.some((cell) => cell.text.trim().length > 0));
  if (!hasAnyContent) {
    return null;
  }

  return {
    headers: result.headers.slice(0, 9),
    rows: sanitizedRows,
    columnCount: 9,
  };
}

async function fetchDocxFileFromUrl(fileUrl: string, fallbackName: string): Promise<File> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`下载 DOCX 失败 (${response.status})`);
  }

  const blob = await response.blob();
  const name = fallbackName.toLowerCase().endsWith('.docx') ? fallbackName : `${fallbackName}.docx`;
  return new File([blob], name, {
    type: blob.type || DOCX_MIME_TYPE,
  });
}

function sanitizeStageStateByTrial(
  trialStages: TrialStage[],
  stageStateByTrial: Record<TrialStage, TrialStageViewState>,
): Record<TrialStage, DocxConverterRemoteStageState> {
  return trialStages.reduce((acc, stage) => {
    const stageState = stageStateByTrial[stage];
    if (!stageState) {
      return acc;
    }

    const fileName = (stageState.fileName || '').trim();
    const fileUrl = (stageState.fileUrl || '').trim();
    const result = stageState.result;
    if (!fileName && !fileUrl && !result) {
      return acc;
    }

    acc[stage] = {
      fileName: fileName || undefined,
      fileUrl: fileUrl || undefined,
      result: sanitizeParseResultForRemote(result),
    };
    return acc;
  }, {} as Record<TrialStage, DocxConverterRemoteStageState>);
}

function buildLocalStageStateByTrial(
  trialStages: TrialStage[],
  stageStateByTrial: Record<TrialStage, TrialStageViewState>,
): Record<TrialStage, DocxConverterRemoteStageState> {
  return trialStages.reduce((acc, stage) => {
    const stageState = stageStateByTrial[stage];
    if (!stageState) {
      return acc;
    }

    const fileName = (stageState.fileName || '').trim();
    const fileUrl = (stageState.fileUrl || '').trim();
    const result = stageState.result;
    if (!fileName && !fileUrl && !result) {
      return acc;
    }

    acc[stage] = {
      fileName: fileName || undefined,
      fileUrl: fileUrl || undefined,
      result,
    };
    return acc;
  }, {} as Record<TrialStage, DocxConverterRemoteStageState>);
}

function computeParseResultScore(result: ParseResult | null | undefined): number {
  if (!result) {
    return 0;
  }

  let score = 0;
  for (const row of result.rows) {
    for (const cell of row) {
      if (cell.text.trim()) {
        score += 1;
      }
      score += cell.images.length * 10;
    }
  }
  return score;
}

function pickPreferredResult(
  localResult: ParseResult | null | undefined,
  remoteResult: ParseResult | null | undefined,
): ParseResult | null {
  if (!localResult && !remoteResult) {
    return null;
  }
  if (!localResult) {
    return remoteResult || null;
  }
  if (!remoteResult) {
    return localResult;
  }

  const localHasImages = hasParseResultImages(localResult);
  const remoteHasImages = hasParseResultImages(remoteResult);
  if (localHasImages && !remoteHasImages) {
    return localResult;
  }
  if (!localHasImages && remoteHasImages) {
    return remoteResult;
  }

  return computeParseResultScore(localResult) >= computeParseResultScore(remoteResult) ? localResult : remoteResult;
}

function mergeStageStateByTrial(
  localStageStateByTrial: Record<string, DocxConverterRemoteStageState>,
  remoteStageStateByTrial: Record<string, DocxConverterRemoteStageState>,
): Record<string, DocxConverterRemoteStageState> {
  const stages = Array.from(new Set([...Object.keys(localStageStateByTrial), ...Object.keys(remoteStageStateByTrial)]));

  return stages.reduce((acc, stage) => {
    const local = localStageStateByTrial[stage];
    const remote = remoteStageStateByTrial[stage];
    const mergedFileName = (remote?.fileName || local?.fileName || '').trim();
    const mergedFileUrl = (remote?.fileUrl || local?.fileUrl || '').trim();
    const mergedResult = pickPreferredResult(local?.result, remote?.result);

    if (!mergedFileName && !mergedFileUrl && !mergedResult) {
      return acc;
    }

    acc[stage] = {
      fileName: mergedFileName || undefined,
      fileUrl: mergedFileUrl || undefined,
      result: mergedResult,
    };
    return acc;
  }, {} as Record<string, DocxConverterRemoteStageState>);
}

function readSnapshotTime(value?: string): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isLocalSnapshotNewerThanRemote(
  localSnapshot: DocxConverterLocalSnapshot | null,
  remoteSnapshot: { updatedAt?: string } | null,
): boolean {
  if (!localSnapshot) {
    return false;
  }

  return readSnapshotTime(localSnapshot.updatedAt) > readSnapshotTime(remoteSnapshot?.updatedAt);
}

function filterStageStateByTrial(
  stageStateByTrial: Record<string, DocxConverterRemoteStageState>,
  trialStages: TrialStage[],
): Record<string, DocxConverterRemoteStageState> {
  const allowedStages = new Set(normalizeTrialStages(trialStages));
  if (allowedStages.size === 0) {
    return {};
  }

  return Object.entries(stageStateByTrial).reduce((acc, [stage, stageState]) => {
    if (allowedStages.has(stage)) {
      acc[stage] = stageState;
    }
    return acc;
  }, {} as Record<string, DocxConverterRemoteStageState>);
}

function filterViewStageStateByTrial<T>(
  stageStateByTrial: Record<string, T>,
  trialStages: TrialStage[],
): Record<TrialStage, T> {
  const allowedStages = new Set(normalizeTrialStages(trialStages));
  if (allowedStages.size === 0) {
    return {} as Record<TrialStage, T>;
  }

  return Object.entries(stageStateByTrial).reduce((acc, [stage, stageState]) => {
    if (allowedStages.has(stage)) {
      acc[stage] = stageState;
    }
    return acc;
  }, {} as Record<TrialStage, T>);
}

function normalizeDueDateLines(text: string): string[] {
  const normalized = text.replace(/[，；]/g, ' ').replace(/\s+/g, ' ').trim();
  const dateMatches = normalized.match(/\d{4}-\d{1,2}-\d{1,2}/g);
  if (dateMatches && dateMatches.length > 0) {
    return dateMatches;
  }
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeStatusLines(text: string): string[] {
  const normalized = text.replace(/[，；]/g, ' ').replace(/\s+/g, ' ').trim();
  const taggedMatches = normalized.match(/[A-Za-z0-9_-]+:(?:open|close)/gi);
  if (taggedMatches && taggedMatches.length > 0) {
    return taggedMatches;
  }
  return text
    .split(/\r?\n+|\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseStatusTokens(text: string): StatusToken[] {
  const lines = normalizeStatusLines(text);
  const tokens: StatusToken[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const match = raw.match(/(?:[A-Za-z_-]*?)(\d+)?:(open|close)\b/i);
    if (!match || !match[2]) {
      continue;
    }
    const state = match[2].toLowerCase() as 'open' | 'close';
    const stage = match[1] ? Number.parseInt(match[1], 10) : 0;
    tokens.push({ raw, state, stage: Number.isFinite(stage) ? stage : 0, index });
  }
  return tokens;
}

function getDisplayStatusLines(text: string, mode: StatusDisplayMode): string[] {
  const lines = normalizeStatusLines(text);
  if (mode === 'all') {
    return lines;
  }

  const tokens = parseStatusTokens(text)
    .filter((token) => token.state === mode)
    .sort((left, right) => {
      if (left.stage !== right.stage) {
        return right.stage - left.stage;
      }
      return left.index - right.index;
    });

  return tokens.map((token) => token.raw);
}

function resolveRowFinalStatus(text: string): 'open' | 'close' | null {
  const normalized = text.replace(/[锛岋紱]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const tagged = [...normalized.matchAll(/(?:[A-Za-z_-]*?)(\d+)?:(open|close)\b/gi)];
  if (tagged.length > 0) {
    let bestMatch: RegExpMatchArray | null = null;
    let bestStage = Number.NEGATIVE_INFINITY;
    for (const match of tagged) {
      const stage = match[1] ? Number.parseInt(match[1], 10) : Number.NEGATIVE_INFINITY;
      if (!bestMatch || stage >= bestStage) {
        bestMatch = match;
        bestStage = stage;
      }
    }
    if (bestMatch && bestMatch[2]) {
      const status = bestMatch[2].toLowerCase();
      return status === 'open' || status === 'close' ? status : null;
    }
  }

  const lower = normalized.toLowerCase();
  const openIndex = lower.lastIndexOf('open');
  const closeIndex = lower.lastIndexOf('close');
  if (openIndex === -1 && closeIndex === -1) {
    return null;
  }
  return openIndex > closeIndex ? 'open' : 'close';
}

function TAxisButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-4 py-1.5 text-xs font-mono whitespace-nowrap transition-colors ${
        active
          ? 'border-cyan-500/80 bg-cyan-950/30 text-cyan-300'
          : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300'
      }`}
    >
      {label}
    </button>
  );
}

function DocxConvertPanel({ panel }: { panel: AssetPanelItem }) {
  const [trialStagesState, setTrialStagesState] = useState<TrialStage[]>(DEFAULT_TRIAL_STAGES);
  const [activeTrial, setActiveTrial] = useState<TrialStage>(DEFAULT_TRIAL_STAGES[0]);
  const [stageStateByTrial, setStageStateByTrial] = useState<Record<TrialStage, TrialStageViewState>>(() =>
    createStageStateMap(DEFAULT_TRIAL_STAGES),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewImage, setPreviewImage] = useState<ParsedImage | null>(null);
  const [isRemoteSyncing, setIsRemoteSyncing] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOfflineFallbackMode, setIsOfflineFallbackMode] = useState(false);
  const [showDeleteTrialConfirm, setShowDeleteTrialConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [statusDisplayMode, setStatusDisplayMode] = useState<StatusDisplayMode>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canPersistRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const hydratedByStageUrlRef = useRef<Record<string, string>>({});
  const trialStagesStateRef = useRef<TrialStage[]>(DEFAULT_TRIAL_STAGES);
  const stageStateByTrialRef = useRef<Record<TrialStage, TrialStageViewState>>(
    createStageStateMap(DEFAULT_TRIAL_STAGES),
  );

  const currentStageState = stageStateByTrial[activeTrial] || createEmptyTrialStageState();
  const fileName = currentStageState.fileName;
  const progress = currentStageState.progress;
  const result = currentStageState.result;
  const error = currentStageState.error;
  const isParsing = currentStageState.isParsing;

  const panelIdentity = useMemo(
    () => ({
      moldId: panel.moldId.trim(),
      moldNo: panel.moldNo.trim(),
    }),
    [panel.moldId, panel.moldNo],
  );
  const assetEntityId = useMemo(
    () => (panelIdentity.moldNo ? `${panelIdentity.moldId}__${panelIdentity.moldNo}` : panelIdentity.moldId),
    [panelIdentity.moldId, panelIdentity.moldNo],
  );

  const patchTrialState = useCallback((trialStage: TrialStage, patch: Partial<TrialStageViewState>) => {
    setStageStateByTrial((prev) => {
      const current = prev[trialStage] || createEmptyTrialStageState();
      const nextFileUrl =
        Object.prototype.hasOwnProperty.call(patch, 'fileUrl') && typeof patch.fileUrl === 'string'
          ? patch.fileUrl
          : current.fileUrl;
      if (nextFileUrl && current.fileUrl !== nextFileUrl) {
        delete hydratedByStageUrlRef.current[trialStage];
      }
      const next = {
        ...prev,
        [trialStage]: {
          ...current,
          ...patch,
        },
      };
      stageStateByTrialRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    trialStagesStateRef.current = trialStagesState;
  }, [trialStagesState]);

  useEffect(() => {
    stageStateByTrialRef.current = stageStateByTrial;
  }, [stageStateByTrial]);

  const stats = useMemo(() => {
    if (!result) {
      return {
        openCount: 0,
        closeCount: 0,
        unresolvedOpenCount: 0,
        openRatePercent: "0.0%",
      };
    }

    let openCount = 0;
    let closeCount = 0;
    let unresolvedOpenCount = 0;
    for (const row of result.rows) {
      const finalStatus = resolveRowFinalStatus(row[7]?.text || '');
      if (finalStatus === 'open') {
        openCount += 1;
        unresolvedOpenCount += 1;
      } else if (finalStatus === 'close') {
        closeCount += 1;
      }
    }

    const totalTagged = openCount + closeCount;
    const openRatePercent =
      totalTagged > 0 ? `${((openCount / totalTagged) * 100).toFixed(1)}%` : "0.0%";

    return {
      openCount,
      closeCount,
      unresolvedOpenCount,
      openRatePercent,
    };
  }, [result]);

  const displayRows = useMemo(() => {
    if (!result) {
      return [] as ParseResult['rows'];
    }

    if (statusDisplayMode === 'all') {
      return result.rows;
    }

    const ranked = result.rows
      .map((row, originalIndex) => {
        const statusText = row[7]?.text || '';
        const finalStatus = resolveRowFinalStatus(statusText);
        if (finalStatus !== statusDisplayMode) {
          return null;
        }
        const tokens = parseStatusTokens(statusText).filter((token) => token.state === statusDisplayMode);
        const maxStage = tokens.reduce((max, token) => Math.max(max, token.stage), 0);
        return {
          row,
          originalIndex,
          maxStage,
          tokenCount: tokens.length,
        };
      })
      .filter((item): item is { row: ParseResult['rows'][number]; originalIndex: number; maxStage: number; tokenCount: number } => item !== null)
      .sort((left, right) => {
        if (left.maxStage !== right.maxStage) {
          return right.maxStage - left.maxStage;
        }
        if (left.tokenCount !== right.tokenCount) {
          return right.tokenCount - left.tokenCount;
        }
        return left.originalIndex - right.originalIndex;
      });

    return ranked.map((item) => item.row);
  }, [result, statusDisplayMode]);

  const lastTrialStage = trialStagesState[trialStagesState.length - 1] || '';
  const canDeleteActiveTrial =
    trialStagesState.length > 1 && activeTrial === lastTrialStage && !isParsing;

  const persistPayloadJson = useMemo(() => {
    const rawTrialStages = normalizeTrialStages(trialStagesState);
    const stageState = sanitizeStageStateByTrial(rawTrialStages, stageStateByTrial);
    const trialStages = trimTrailingEmptyTrialStages(rawTrialStages, stageState);
    const filteredStageState = filterStageStateByTrial(stageState, trialStages);
    const normalizedActiveTrial =
      trialStages.includes(activeTrial) && activeTrial ? activeTrial : trialStages[0] || DEFAULT_TRIAL_STAGES[0];

    return JSON.stringify({
      moldId: panelIdentity.moldId,
      moldNo: panelIdentity.moldNo,
      trialStages,
      activeTrial: normalizedActiveTrial,
      stageStateByTrial: filteredStageState,
    });
  }, [activeTrial, panelIdentity.moldId, panelIdentity.moldNo, stageStateByTrial, trialStagesState]);

  useEffect(() => {
    let cancelled = false;
    setIsRemoteSyncing(true);
    setIsHydrated(false);
    canPersistRef.current = false;
    hydratedByStageUrlRef.current = {};

    const applySnapshot = (snapshot: {
      trialStages: TrialStage[];
      activeTrial: TrialStage;
      stageStateByTrial: Record<TrialStage, TrialStageViewState>;
    }) => {
      trialStagesStateRef.current = snapshot.trialStages;
      stageStateByTrialRef.current = snapshot.stageStateByTrial;
      setTrialStagesState(snapshot.trialStages);
      setActiveTrial(snapshot.activeTrial);
      setStageStateByTrial(snapshot.stageStateByTrial);
    };

    void (async () => {
      const localSnapshot = readLocalSnapshot(panelIdentity);
      try {
        const remote = await fetchDashboardDocxConverterState(panelIdentity);
        if (cancelled) {
          return;
        }

        if (!remote) {
          if (localSnapshot) {
            const localTrialStages = trimTrailingEmptyTrialStages(
              normalizeTrialStages(localSnapshot.trialStages),
              localSnapshot.stageStateByTrial || {},
            );
            const trialStages = localTrialStages.length > 0 ? localTrialStages : [...DEFAULT_TRIAL_STAGES];
            const active =
              trialStages.includes(localSnapshot.activeTrial) && localSnapshot.activeTrial
                ? localSnapshot.activeTrial
                : trialStages[0] || DEFAULT_TRIAL_STAGES[0];
            applySnapshot({
              trialStages,
              activeTrial: active,
              stageStateByTrial: createStageStateMap(trialStages, localSnapshot.stageStateByTrial),
            });
            setIsOfflineFallbackMode(hasSnapshotContent(localSnapshot));
            return;
          }

          const trialStages = [...DEFAULT_TRIAL_STAGES];
          applySnapshot({
            trialStages,
            activeTrial: trialStages[0],
            stageStateByTrial: createStageStateMap(trialStages),
          });
          setIsOfflineFallbackMode(false);
          return;
        }

        const remoteHasContent = Object.keys(remote.stageStateByTrial || {}).length > 0;
        const localHasContent = hasSnapshotContent(localSnapshot);
        const localIsNewer = isLocalSnapshotNewerThanRemote(localSnapshot, remote);
        const remoteTrialStages = normalizeTrialStages(remote.trialStages || []);
        const localTrialStages = normalizeTrialStages(localSnapshot?.trialStages || []);
        const localStageStateByTrial = filterStageStateByTrial(localSnapshot?.stageStateByTrial || {}, localTrialStages);
        const localStageStateByRemoteTrial = filterStageStateByTrial(localStageStateByTrial, remoteTrialStages);
        const localCanOverrideRemote = !remoteHasContent && localIsNewer && localTrialStages.length > 0;
        const mergedStageStateByTrial = localCanOverrideRemote
          ? localStageStateByTrial
          : mergeStageStateByTrial(localStageStateByRemoteTrial, remote.stageStateByTrial || {});
        const mergedTrialStages = trimTrailingEmptyTrialStages(
          localCanOverrideRemote
            ? localTrialStages
            : normalizeTrialStages([
                ...(remote.trialStages || []),
                ...Object.keys(mergedStageStateByTrial),
              ]),
          mergedStageStateByTrial,
        );
        const trialStages = mergedTrialStages.length > 0 ? mergedTrialStages : [...DEFAULT_TRIAL_STAGES];
        const preferredActiveTrial = localCanOverrideRemote && localSnapshot
          ? localSnapshot.activeTrial
          : remoteHasContent
          ? remote.activeTrial
          : localSnapshot?.activeTrial || remote.activeTrial;
        const active =
          trialStages.includes(preferredActiveTrial) && preferredActiveTrial
            ? preferredActiveTrial
            : trialStages[0] || DEFAULT_TRIAL_STAGES[0];

        applySnapshot({
          trialStages,
          activeTrial: active,
          stageStateByTrial: createStageStateMap(trialStages, mergedStageStateByTrial),
        });
        writeLocalSnapshot({
          moldId: panelIdentity.moldId,
          moldNo: panelIdentity.moldNo,
          trialStages,
          activeTrial: active,
          stageStateByTrial: mergedStageStateByTrial,
        });
        setIsOfflineFallbackMode(!remoteHasContent && localHasContent);

        // Hydrate full image results from IndexedDB when OSS is unavailable.
        void Promise.all(
          trialStages.map(async (stage) => ({
            stage,
            result: await getStageResultCache(panelIdentity, stage),
          })),
        ).then((items) => {
          if (cancelled) {
            return;
          }

          setStageStateByTrial((prev) => {
            let changed = false;
            const next = { ...prev };

            for (const item of items) {
              if (!item.result) {
                continue;
              }

              const current = next[item.stage] || createEmptyTrialStageState();
              const preferred = pickPreferredResult(current.result, item.result);
              if (preferred !== current.result) {
                next[item.stage] = {
                  ...current,
                  result: preferred,
                };
                changed = true;
              }
            }

            if (changed) {
              stageStateByTrialRef.current = next;
            }
            return changed ? next : prev;
          });
        });
      } catch {
        if (cancelled) {
          return;
      }

        if (localSnapshot) {
          const localTrialStages = trimTrailingEmptyTrialStages(
            normalizeTrialStages(localSnapshot.trialStages),
            localSnapshot.stageStateByTrial || {},
          );
          const trialStages = localTrialStages.length > 0 ? localTrialStages : [...DEFAULT_TRIAL_STAGES];
          const active =
            trialStages.includes(localSnapshot.activeTrial) && localSnapshot.activeTrial
              ? localSnapshot.activeTrial
              : trialStages[0] || DEFAULT_TRIAL_STAGES[0];
          applySnapshot({
            trialStages,
            activeTrial: active,
            stageStateByTrial: createStageStateMap(trialStages, localSnapshot.stageStateByTrial),
          });
          setIsOfflineFallbackMode(true);

          void Promise.all(
            trialStages.map(async (stage) => ({
              stage,
              result: await getStageResultCache(panelIdentity, stage),
            })),
          ).then((items) => {
            if (cancelled) {
              return;
            }

            setStageStateByTrial((prev) => {
              let changed = false;
              const next = { ...prev };

              for (const item of items) {
                if (!item.result) {
                  continue;
                }

                const current = next[item.stage] || createEmptyTrialStageState();
                const preferred = pickPreferredResult(current.result, item.result);
                if (preferred !== current.result) {
                  next[item.stage] = {
                    ...current,
                    result: preferred,
                  };
                  changed = true;
                }
              }

              if (changed) {
                stageStateByTrialRef.current = next;
              }
              return changed ? next : prev;
            });
          });
          return;
        }

        const trialStages = [...DEFAULT_TRIAL_STAGES];
        applySnapshot({
          trialStages,
          activeTrial: trialStages[0],
          stageStateByTrial: createStageStateMap(trialStages),
        });
        setIsOfflineFallbackMode(true);
      } finally {
        if (cancelled) {
          return;
        }

        setIsHydrated(true);
        setIsRemoteSyncing(false);
        window.setTimeout(() => {
          canPersistRef.current = true;
        }, 0);
      }
    })();

    return () => {
      cancelled = true;
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [panelIdentity]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const current = stageStateByTrial[activeTrial];
    if (!current || current.isParsing) {
      return;
    }

    const fileUrl = (current.fileUrl || '').trim();
    if (!fileUrl) {
      return;
    }

    const shouldHydrate = !current.result || !hasParseResultImages(current.result);
    if (!shouldHydrate) {
      return;
    }

    if (hydratedByStageUrlRef.current[activeTrial] === fileUrl) {
      return;
    }
    hydratedByStageUrlRef.current[activeTrial] = fileUrl;

    const fallbackName = current.fileName || `${activeTrial}.docx`;
    patchTrialState(activeTrial, {
      isParsing: true,
      progress: { stage: 'unzipping', message: '正在从 OSS 回填解析...', progress: 0 },
    });

    void (async () => {
      try {
        const remoteFile = await fetchDocxFileFromUrl(fileUrl, fallbackName);
        const parsed = await parseDocxReport(remoteFile, (next) => {
          patchTrialState(activeTrial, { progress: next });
        });
        await setStageResultCache(panelIdentity, activeTrial, parsed);
        patchTrialState(activeTrial, {
          result: parsed,
          error: null,
          progress: { stage: 'done', message: '远端回填完成', progress: 100 },
        });
      } catch (hydrateError) {
        const message = hydrateError instanceof Error ? hydrateError.message : '远端回填失败';
        patchTrialState(activeTrial, {
          error: `远端回填失败: ${message}`,
          progress: null,
        });
      } finally {
        patchTrialState(activeTrial, { isParsing: false });
      }
    })();
  }, [activeTrial, isHydrated, panelIdentity, patchTrialState, stageStateByTrial]);

  useEffect(() => {
    if (trialStagesState.length === 0) {
      return;
    }

    if (trialStagesState.includes(activeTrial)) {
      return;
    }

    setActiveTrial(trialStagesState[0]);
  }, [activeTrial, trialStagesState]);

  useEffect(() => {
    if (!isHydrated || !canPersistRef.current) {
      return;
    }

    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const payload = JSON.parse(persistPayloadJson) as {
            moldId: string;
            moldNo?: string;
            trialStages: string[];
            activeTrial: string;
            stageStateByTrial: Record<string, DocxConverterRemoteStageState>;
          };
          const localTrialStages = normalizeTrialStages(trialStagesState);
          const localStageStateByTrial = buildLocalStageStateByTrial(localTrialStages, stageStateByTrial);
          const normalizedLocalTrialStages = trimTrailingEmptyTrialStages(localTrialStages, localStageStateByTrial);
          const normalizedLocalActiveTrial =
            normalizedLocalTrialStages.includes(activeTrial) && activeTrial
              ? activeTrial
              : normalizedLocalTrialStages[0] || DEFAULT_TRIAL_STAGES[0];
          const filteredLocalStageStateByTrial = filterStageStateByTrial(
            localStageStateByTrial,
            normalizedLocalTrialStages,
          );

          const hasAnyStageData = Object.keys(payload.stageStateByTrial || {}).length > 0;
          if (!hasAnyStageData) {
            deleteLocalSnapshot({
              moldId: payload.moldId,
              moldNo: payload.moldNo,
            });

            await deleteDashboardDocxConverterState({
              moldId: payload.moldId,
              moldNo: payload.moldNo,
            });
            setIsOfflineFallbackMode(false);
            return;
          }

          writeLocalSnapshot({
            moldId: payload.moldId,
            moldNo: payload.moldNo,
            trialStages: normalizedLocalTrialStages,
            activeTrial: normalizedLocalActiveTrial,
            stageStateByTrial: filteredLocalStageStateByTrial,
          });

          await saveDashboardDocxConverterState({
            moldId: payload.moldId,
            moldNo: payload.moldNo,
            trialStages: payload.trialStages,
            activeTrial: payload.activeTrial,
            stageStateByTrial: payload.stageStateByTrial,
          });
          setIsOfflineFallbackMode(false);
        } catch {
          setIsOfflineFallbackMode(true);
        }
      })();
    }, 500);

    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [activeTrial, isHydrated, persistPayloadJson, stageStateByTrial, trialStagesState]);

  const persistDocxSnapshotNow = useCallback(
    async (
      nextTrialStages: TrialStage[],
      nextActiveTrial: TrialStage,
      nextStageStateByTrial: Record<TrialStage, TrialStageViewState>,
    ) => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }

      const normalizedTrialStages = normalizeTrialStages(nextTrialStages);
      const baseTrialStages = normalizedTrialStages.length > 0 ? normalizedTrialStages : [...DEFAULT_TRIAL_STAGES];
      const remoteStageStateByTrial = sanitizeStageStateByTrial(baseTrialStages, nextStageStateByTrial);
      const localStageStateByTrial = buildLocalStageStateByTrial(baseTrialStages, nextStageStateByTrial);
      const finalTrialStages = trimTrailingEmptyTrialStages(baseTrialStages, remoteStageStateByTrial);
      const filteredRemoteStageStateByTrial = filterStageStateByTrial(remoteStageStateByTrial, finalTrialStages);
      const filteredLocalStageStateByTrial = filterStageStateByTrial(localStageStateByTrial, finalTrialStages);
      const normalizedActiveTrial =
        finalTrialStages.includes(nextActiveTrial) && nextActiveTrial
          ? nextActiveTrial
          : finalTrialStages[0] || DEFAULT_TRIAL_STAGES[0];

      if (Object.keys(filteredLocalStageStateByTrial).length === 0) {
        deleteLocalSnapshot(panelIdentity);
      } else {
        writeLocalSnapshot({
          moldId: panelIdentity.moldId,
          moldNo: panelIdentity.moldNo,
          trialStages: finalTrialStages,
          activeTrial: normalizedActiveTrial,
          stageStateByTrial: filteredLocalStageStateByTrial,
        });
      }

      if (!isHydrated || !canPersistRef.current) {
        return;
      }

      try {
        if (Object.keys(filteredRemoteStageStateByTrial).length === 0) {
          await deleteDashboardDocxConverterState(panelIdentity);
        } else {
          await saveDashboardDocxConverterState({
            moldId: panelIdentity.moldId,
            moldNo: panelIdentity.moldNo,
            trialStages: finalTrialStages,
            activeTrial: normalizedActiveTrial,
            stageStateByTrial: filteredRemoteStageStateByTrial,
          });
        }
        setIsOfflineFallbackMode(false);
      } catch {
        setIsOfflineFallbackMode(true);
      }
    },
    [isHydrated, panelIdentity],
  );

  const handleParse = useCallback(
    async (nextFile: File) => {
      const trialStage = activeTrial;
      const getCurrentTrialStages = () => {
        const current = normalizeTrialStages(trialStagesStateRef.current);
        return current.length > 0 ? current : [...DEFAULT_TRIAL_STAGES];
      };
      const isTrialStageStillAvailable = () => getCurrentTrialStages().includes(trialStage);
      if (!isDocxFile(nextFile)) {
        patchTrialState(trialStage, { error: '只支持 .docx 文件' });
        return;
      }

      const previousFileUrl = stageStateByTrialRef.current[trialStage]?.fileUrl || null;

      patchTrialState(trialStage, {
        fileName: nextFile.name,
        result: null,
        error: null,
        isParsing: true,
        progress: { stage: 'unzipping', message: '开始处理...', progress: 0 },
      });

      try {
        const parsed = await parseDocxReport(nextFile, (next) => {
          patchTrialState(trialStage, { progress: next });
        });
        await setStageResultCache(panelIdentity, trialStage, parsed);

        if (!isTrialStageStillAvailable()) {
          return;
        }

        const parsedTrialStages = getCurrentTrialStages();
        const parsedStageState: TrialStageViewState = {
          ...(stageStateByTrialRef.current[trialStage] || createEmptyTrialStageState()),
          fileName: nextFile.name,
          fileUrl: null,
          result: parsed,
          error: null,
          isParsing: true,
        };
        const parsedStageStateByTrial = {
          ...stageStateByTrialRef.current,
          [trialStage]: parsedStageState,
        };
        void persistDocxSnapshotNow(parsedTrialStages, trialStage, parsedStageStateByTrial);

        let uploadedUrl: string | null = null;
        let uploadFailureMessage: string | null = null;
        try {
          const uploaded = await uploadAssetViaServer({
            file: nextFile,
            category: 'docx-converter',
            entityId: assetEntityId,
            slot: trialStage,
          });
          uploadedUrl = uploaded.url;
        } catch (uploadError) {
          uploadFailureMessage = uploadError instanceof Error ? uploadError.message : 'OSS 上传失败';
          toast.error('DOCX 上传 OSS 失败', {
            description: `${trialStage} 已保留解析结果，但文件未同步到远端 OSS。${uploadFailureMessage ? ` ${uploadFailureMessage}` : ''}`,
            position: 'bottom-right',
          });
        }

        if (!isTrialStageStillAvailable()) {
          if (uploadedUrl) {
            void deleteAssetViaServer(uploadedUrl).catch(() => undefined);
          }
          return;
        }

        const finalTrialStages = getCurrentTrialStages();
        const finalStageState: TrialStageViewState = {
          ...(stageStateByTrialRef.current[trialStage] || createEmptyTrialStageState()),
          fileName: nextFile.name,
          fileUrl: uploadedUrl,
          result: parsed,
          progress: null,
          error: uploadedUrl ? null : uploadFailureMessage || 'OSS upload failed',
          isParsing: false,
        };
        const finalStageStateByTrial = {
          ...stageStateByTrialRef.current,
          [trialStage]: finalStageState,
        };
        patchTrialState(trialStage, {
          fileName: nextFile.name,
          fileUrl: uploadedUrl,
          result: parsed,
          progress: { stage: 'done', message: '解析完成', progress: 100 },
          error: uploadedUrl ? null : `OSS 上传失败：${uploadFailureMessage || '仅本地显示解析结果'}`,
        });

        void persistDocxSnapshotNow(finalTrialStages, trialStage, finalStageStateByTrial);

        if (previousFileUrl && uploadedUrl && previousFileUrl !== uploadedUrl) {
          void deleteAssetViaServer(previousFileUrl).catch(() => undefined);
        }
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : '解析失败';
        if (isTrialStageStillAvailable()) {
          patchTrialState(trialStage, { error: message, progress: null });
        }
      } finally {
        if (isTrialStageStillAvailable()) {
          patchTrialState(trialStage, { isParsing: false });
        }
      }
    },
    [activeTrial, assetEntityId, panelIdentity, patchTrialState, persistDocxSnapshotNow],
  );

  const handleClear = useCallback(() => {
      const trialStage = activeTrial;
      const currentStageStateByTrial = stageStateByTrialRef.current;
      const nextTrialStages = normalizeTrialStages(trialStagesStateRef.current);
      const previousFileUrl = currentStageStateByTrial[trialStage]?.fileUrl || null;
      const rawNextStageStateByTrial = {
        ...currentStageStateByTrial,
        [trialStage]: createEmptyTrialStageState(),
      };
      const trimmedTrialStages = trimTrailingEmptyTrialStages(
        nextTrialStages,
        sanitizeStageStateByTrial(nextTrialStages, rawNextStageStateByTrial),
      );
      const nextActiveTrial =
        trimmedTrialStages.includes(trialStage)
          ? trialStage
          : trimmedTrialStages[trimmedTrialStages.length - 1] || DEFAULT_TRIAL_STAGES[0];
      const nextStageStateByTrial = filterViewStageStateByTrial(rawNextStageStateByTrial, trimmedTrialStages);

      trialStagesStateRef.current = trimmedTrialStages;
      stageStateByTrialRef.current = nextStageStateByTrial;
      delete hydratedByStageUrlRef.current[trialStage];
      setTrialStagesState(trimmedTrialStages);
      setStageStateByTrial(nextStageStateByTrial);
      setActiveTrial(nextActiveTrial);
      void deleteStageResultCache(panelIdentity, trialStage);
      void persistDocxSnapshotNow(trimmedTrialStages, nextActiveTrial, nextStageStateByTrial);
      if (previousFileUrl) {
        void deleteAssetViaServer(previousFileUrl).catch(() => undefined);
      }
      setShowClearConfirm(false);
  }, [activeTrial, panelIdentity, persistDocxSnapshotNow]);

  const handleRequestClear = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const handleExport = useCallback(async () => {
    if (!result) {
      return;
    }

    setIsExporting(true);
    try {
      const fallbackName = fileName || `${activeTrial}-qe-report.docx`;
      const filename = `${trimDocxName(fallbackName)}.xlsx`;
      await exportDocxParseResultToXlsx(result, filename);
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : '导出失败';
      patchTrialState(activeTrial, { error: message });
    } finally {
      setIsExporting(false);
    }
  }, [activeTrial, fileName, patchTrialState, result]);

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0];
      if (nextFile) {
        void handleParse(nextFile);
      }
      event.target.value = '';
    },
    [handleParse],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (isParsing) {
        return;
      }
      const nextFile = event.dataTransfer.files?.[0];
      if (nextFile) {
        void handleParse(nextFile);
      }
    },
    [handleParse, isParsing],
  );

  const handleAddTrialStage = useCallback(() => {
    const currentTrialStages = normalizeTrialStages(trialStagesStateRef.current);
    const baseTrialStages = currentTrialStages.length > 0 ? currentTrialStages : [...DEFAULT_TRIAL_STAGES];
    const maxStageIndex = baseTrialStages.reduce((maxValue, stage) => {
      const parsed = Number.parseInt(stage.replace(/^T/, ''), 10);
      return Number.isFinite(parsed) ? Math.max(maxValue, parsed) : maxValue;
    }, 0);
    const nextStage = createTrialStageLabel(maxStageIndex + 1);
    const nextTrialStages = [...baseTrialStages, nextStage];
    const nextStageStateByTrial = {
      ...stageStateByTrialRef.current,
      [nextStage]: createEmptyTrialStageState(),
    };

    trialStagesStateRef.current = nextTrialStages;
    stageStateByTrialRef.current = nextStageStateByTrial;
    setTrialStagesState(nextTrialStages);
    setStageStateByTrial(nextStageStateByTrial);
    setActiveTrial(nextStage);
    void persistDocxSnapshotNow(nextTrialStages, nextStage, nextStageStateByTrial);
  }, [persistDocxSnapshotNow]);

  const handleRequestDeleteTrialStage = useCallback(() => {
    if (trialStagesState.length <= 1) {
      toast.warning('至少保留一个轮次');
      return;
    }
    if (activeTrial !== lastTrialStage) {
      toast.warning(`仅允许从最后轮次开始删除，请先切换到 ${lastTrialStage}`);
      return;
    }
    setShowDeleteTrialConfirm(true);
  }, [activeTrial, lastTrialStage, trialStagesState.length]);

  const deleteCurrentTrialStage = useCallback(() => {
    const currentTrialStages = normalizeTrialStages(trialStagesStateRef.current);
    const baseTrialStages = currentTrialStages.length > 0 ? currentTrialStages : [...DEFAULT_TRIAL_STAGES];
    if (baseTrialStages.length <= 1) {
      setShowDeleteTrialConfirm(false);
      return;
    }
    const currentLastTrialStage = baseTrialStages[baseTrialStages.length - 1] || '';
    if (activeTrial !== currentLastTrialStage) {
      setShowDeleteTrialConfirm(false);
      return;
    }

    const deletingTrial = activeTrial;
    const currentIndex = baseTrialStages.indexOf(deletingTrial);
    const nextTrialStages = baseTrialStages.filter((stage) => stage !== deletingTrial);
    const nextActiveTrial =
      baseTrialStages[currentIndex - 1] ||
      baseTrialStages[currentIndex + 1] ||
      nextTrialStages[0] ||
      DEFAULT_TRIAL_STAGES[0];
    const deletedFileUrl = stageStateByTrialRef.current[deletingTrial]?.fileUrl || null;
    const nextStageStateByTrial = { ...stageStateByTrialRef.current };
    delete nextStageStateByTrial[deletingTrial];

    trialStagesStateRef.current = nextTrialStages;
    stageStateByTrialRef.current = nextStageStateByTrial;
    setTrialStagesState(nextTrialStages);
    setStageStateByTrial(nextStageStateByTrial);
    delete hydratedByStageUrlRef.current[deletingTrial];
    void deleteStageResultCache(panelIdentity, deletingTrial);
    void persistDocxSnapshotNow(nextTrialStages, nextActiveTrial, nextStageStateByTrial);

    if (deletedFileUrl) {
      void deleteAssetViaServer(deletedFileUrl).catch(() => undefined);
    }

    setActiveTrial(nextActiveTrial);
    setShowDeleteTrialConfirm(false);
  }, [activeTrial, panelIdentity, persistDocxSnapshotNow]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/[0.06] bg-[#0b1220] p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-cyan-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-mono tracking-[0.22em] text-cyan-400/80">
                {panel.moldId} / {panel.moldNo}
              </div>
              <h2 className="text-lg font-bold text-white">问题解析</h2>
              <p className="text-xs text-slate-400">上传 DOCX，自动解析 9 列问题表并导出带图片的 Excel。</p>
            </div>
          </div>
          {(fileName || result) && (
            <Button
              variant="ghost"
              size="sm"
              className="border border-white/20 bg-white/5 font-bold text-slate-100 backdrop-blur-md hover:border-white/35 hover:bg-white/10 hover:text-white"
              onClick={handleRequestClear}
            >
              <X className="mr-1 h-4 w-4" />
              清空
            </Button>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="rounded border border-slate-700 px-2 py-0.5">
            远端状态: {isRemoteSyncing ? '同步中' : isOfflineFallbackMode ? '离线兜底' : '已连接'}
          </span>
          <span className="rounded border border-slate-700 px-2 py-0.5">当前轮次: {activeTrial}</span>
          <span className="rounded border border-slate-700 px-2 py-0.5">OSS 文件: {currentStageState.fileUrl ? '已上传' : '未上传'}</span>
        </div>

        <div className="border-b border-slate-800/80 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {trialStagesState.map((stage) => (
              <TAxisButton key={stage} label={stage} active={stage === activeTrial} onClick={() => setActiveTrial(stage)} />
            ))}
            <button
              type="button"
              onClick={handleAddTrialStage}
              className="rounded-md border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs font-mono text-cyan-400 transition-colors hover:border-cyan-500/50"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleRequestDeleteTrialStage}
              disabled={!canDeleteActiveTrial}
              className={`rounded-md border px-3 py-1.5 text-xs font-mono transition-colors ${
                canDeleteActiveTrial
                  ? 'border-rose-500/60 bg-rose-950/20 text-rose-300 hover:border-rose-400 hover:text-rose-200'
                  : 'cursor-not-allowed border-slate-700 bg-slate-900 text-slate-600'
              }`}
              title={
                canDeleteActiveTrial
                  ? `删除当前轮次 ${activeTrial}`
                  : `仅支持删除最后轮次（当前最后为 ${lastTrialStage || 'T0'}）`
              }
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onDrop={onDrop}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!isParsing) {
              setIsDragging(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(false);
          }}
          onClick={() => {
            if (!isParsing) {
              fileInputRef.current?.click();
            }
          }}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && !isParsing) {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`mt-4 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
            isDragging
              ? 'border-cyan-300 bg-cyan-500/10'
              : 'border-white/10 bg-slate-900/60 hover:border-white/20 hover:bg-slate-900/80'
          } ${isParsing ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
        >
          <UploadCloud className="mx-auto mb-3 h-9 w-9 text-slate-300" />
          <p className="text-sm font-medium text-white">
            {fileName ? `当前文件: ${fileName}` : `拖拽 DOCX 到此处，或点击选择文件（${activeTrial}）`}
          </p>
          <p className="mt-1 text-xs text-slate-400">仅支持 .docx，解析成功后会自动上传 OSS 并保存远端状态。</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </section>

      {(progress || error) && (
        <section className="rounded-2xl border border-white/[0.06] bg-[#0b1220] p-4">
          {progress && (
            <>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                <span>
                  处理进度: {STAGE_LABELS[progress.stage]}
                </span>
                <span>{progress.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress.progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">{progress.message}</p>
            </>
          )}
          {error && <p className="mt-2 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
        </section>
      )}

      {result && (
        <section className="rounded-2xl border border-white/[0.06] bg-[#0b1220] p-4">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300">
              <span>轮次: {activeTrial}</span>
              <span>总数: {stats.openCount + stats.closeCount}</span>
              <span>Close: {stats.closeCount}</span>
              <span>Open待关闭: {stats.unresolvedOpenCount}</span>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 p-1">
              <button
                type="button"
                onClick={() => setStatusDisplayMode('all')}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  statusDisplayMode === 'all'
                    ? 'bg-cyan-900/50 text-cyan-200'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                全部
              </button>
              <button
                type="button"
                onClick={() => setStatusDisplayMode('open')}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  statusDisplayMode === 'open'
                    ? 'bg-rose-900/50 text-rose-200'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                只看红色
              </button>
              <button
                type="button"
                onClick={() => setStatusDisplayMode('close')}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  statusDisplayMode === 'close'
                    ? 'bg-emerald-900/50 text-emerald-200'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                只看绿色
              </button>
            </div>
            <Button onClick={handleExport} disabled={isExporting} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              导出 XLSX
            </Button>
          </div>

          <div className="rounded-xl border border-white/[0.08]">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900">
                <tr>
                  {result.headers.map((header, index) => (
                    <th
                      key={`${header}-${index}`}
                      className={`border-b border-r border-white/[0.08] px-3 py-2 text-left text-xs font-semibold text-slate-200 last:border-r-0 ${
                        index === 6 ? 'whitespace-nowrap' : ''
                      } ${
                        index === 0 ? 'text-center whitespace-nowrap' : ''
                      } ${COLUMN_WIDTH_CLASSES[index] || ''}`}
                    >
                      {header || `Col ${index + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className={rowIndex % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-900/20'}>
                    {row.map((cell, cellIndex) => {
                      const isDueDate = cellIndex === 6;
                      const isStatus = cellIndex === 7;
                      const statusValue = (cell.text || '').trim();
                      const visibleStatusLines = getDisplayStatusLines(statusValue, 'all');
                      const isLink = cellIndex === 8 && /^https?:\/\//i.test(statusValue);

                      return (
                        <td
                          key={`cell-${rowIndex}-${cellIndex}`}
                          className={`border-r border-t border-white/[0.08] px-3 py-2 align-top text-slate-200 last:border-r-0 ${
                            cellIndex === 0 ? 'text-center align-middle whitespace-nowrap font-semibold tabular-nums' : ''
                          } ${COLUMN_WIDTH_CLASSES[cellIndex] || ''}`}
                        >
                          {cellIndex === 0 ? (
                            <span className="text-sm text-slate-100">{rowIndex + 1}</span>
                          ) : cellIndex === 2 ? (
                            cell.images.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {cell.images.map((image, imageIndex) => (
                                  <button
                                    key={`img-${rowIndex}-${imageIndex}`}
                                    type="button"
                                    className="h-14 w-14 overflow-hidden rounded-md border border-white/20"
                                    onClick={() => setPreviewImage(image)}
                                    aria-label={`预览图片 ${imageIndex + 1}`}
                                  >
                                    <img
                                      src={`data:${image.mimeType};base64,${image.base64}`}
                                      alt={`图片 ${imageIndex + 1}`}
                                      className="h-full w-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                <ImageIcon className="h-3.5 w-3.5" />
                                无
                              </span>
                            )
                          ) : isStatus ? (
                            <div className="space-y-1.5">
                              {(visibleStatusLines.length > 0 ? visibleStatusLines : ['-']).map(
                                (statusLine, statusIndex) => {
                                  const lower = statusLine.toLowerCase();
                                  const isCloseLine = lower.includes('close');
                                  const isOpenLine = lower.includes('open');
                                  const statusClass = isCloseLine
                                    ? 'bg-emerald-600 text-white'
                                    : isOpenLine
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-slate-700 text-slate-100';
                                  return (
                                    <div key={`status-${rowIndex}-${statusIndex}`}>
                                      <Badge className={`whitespace-nowrap ${statusClass}`}>{statusLine}</Badge>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          ) : isDueDate ? (
                            <div className="space-y-1">
                              {(normalizeDueDateLines(statusValue).length > 0 ? normalizeDueDateLines(statusValue) : ['-']).map(
                                (dateValue, dateIndex) => (
                                  <div key={`due-${rowIndex}-${dateIndex}`} className="whitespace-nowrap text-sm text-slate-200">
                                    {dateValue}
                                  </div>
                                ),
                              )}
                            </div>
                          ) : isLink ? (
                            <a
                              href={statusValue}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-300 underline decoration-dotted hover:decoration-solid"
                            >
                              <span className="max-w-[160px] truncate">{statusValue}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="whitespace-pre-wrap break-words text-sm text-slate-200">{statusValue || '-'}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>图片预览</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img
              src={`data:${previewImage.mimeType};base64,${previewImage.base64}`}
              alt="图片预览"
              className="w-full rounded-md border border-white/10"
            />
          )}
        </DialogContent>
      </Dialog>

      <CyberConfirmDialog
        open={showClearConfirm}
        title="清除当前轮次确认"
        message={`这将清除 ${activeTrial} 的全部解析数据，包括本地缓存和关联的 OSS 文件引用。\n此操作不可撤销，是否继续？`}
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={handleClear}
        confirmText="立即清除"
        cancelText="取消"
      />

      <CyberConfirmDialog
        open={showDeleteTrialConfirm}
        title="删除轮次确认"
        message={`将删除当前轮次 ${activeTrial} 的数据（含本地缓存与 OSS 文件引用）。\n该操作不可撤销，是否继续？`}
        onCancel={() => setShowDeleteTrialConfirm(false)}
        onConfirm={deleteCurrentTrialStage}
        confirmText="确认删除"
        cancelText="取消"
      />
    </div>
  );
}

export default function DocxConvertModule({ panels }: DocxConvertModuleProps) {
  return (
    <AssetDrawerWorkspace
      panels={panels}
      badgeLabel="问题解析"
      drawerTitle="问题解析"
      drawerDescription="选择 mold/no 后在当前区域上传 DOCX 并导出带图片的 Excel。"
      emptyMessage="暂无可用于 DOCX 转换的模具面板。"
      icon={FileSpreadsheet}
      renderPanel={(panel) => <DocxConvertPanel key={buildAssetPanelKey(panel)} panel={panel} />}
    />
  );
}
