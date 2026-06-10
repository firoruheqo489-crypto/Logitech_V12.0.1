import type { Request, Response } from "express";

import { deleteOssObject, getOssObjectBuffer, putOssObject } from "../lib/oss.js";

type TimeSeriesRouteErrorCode =
  | "TIME_SERIES_ARCHIVE_CREATE_FAILED"
  | "TIME_SERIES_ARCHIVE_DELETE_FAILED"
  | "TIME_SERIES_ARCHIVE_LIST_FAILED"
  | "TIME_SERIES_ARCHIVE_LOAD_FAILED"
  | "TIME_SERIES_ARCHIVE_RENAME_FAILED"
  | "TIME_SERIES_STATE_DELETE_FAILED"
  | "TIME_SERIES_STATE_LOAD_FAILED"
  | "TIME_SERIES_STATE_SAVE_FAILED"
  | "UPLOADS_NOT_CONFIGURED";

type TimeSeriesColumnState = {
  id: string;
  label: string;
  color: string;
};

type TimeSeriesRowState = {
  id: string;
  timeLabel: string;
  values: Record<string, number>;
};

type TimeSeriesDatasetState = {
  timeHeader: string;
  columns: TimeSeriesColumnState[];
  rows: TimeSeriesRowState[];
  sourceName: string;
  updatedAt: string;
};

type TimeSeriesWorkspaceState = {
  scope: string;
  dataset: TimeSeriesDatasetState;
  selectedRowId: string | null;
  updatedAt?: string;
};

type TimeSeriesArchiveRecord = {
  id: string;
  scope: string;
  title: string;
  sourceName: string;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  updatedAt: string;
};

type TimeSeriesArchiveDocument = {
  schemaVersion: number;
  archiveId: string;
  scope: string;
  createdAt: string;
  state: TimeSeriesWorkspaceState;
};

const TIME_SERIES_ROUTE_ERROR_MESSAGES: Record<TimeSeriesRouteErrorCode, string> = {
  TIME_SERIES_ARCHIVE_CREATE_FAILED: "Failed to create time series archive",
  TIME_SERIES_ARCHIVE_DELETE_FAILED: "Failed to delete time series archive",
  TIME_SERIES_ARCHIVE_LIST_FAILED: "Failed to list time series archives",
  TIME_SERIES_ARCHIVE_LOAD_FAILED: "Failed to load time series archive",
  TIME_SERIES_ARCHIVE_RENAME_FAILED: "Failed to rename time series archive",
  TIME_SERIES_STATE_DELETE_FAILED: "Failed to delete time series state",
  TIME_SERIES_STATE_LOAD_FAILED: "Failed to load time series state",
  TIME_SERIES_STATE_SAVE_FAILED: "Failed to save time series state",
  UPLOADS_NOT_CONFIGURED: "Aliyun OSS is not configured",
};

const DEFAULT_SCOPE = "dashboard-time-series-workspace";
const TIME_SERIES_STATE_OBJECT_PREFIX = "files/dashboard-time-series-states/v1";
const TIME_SERIES_ARCHIVE_OBJECT_PREFIX = "files/dashboard-time-series-archives/v1";

function applyNoStoreHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function sendTimeSeriesRouteError(res: Response, status: number, code: TimeSeriesRouteErrorCode): void {
  res.status(status).json({
    error: TIME_SERIES_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeText(value: unknown, maxLength: number, fallback = ""): string {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function normalizeScope(value: unknown): string {
  const normalized = normalizeText(value, 120, DEFAULT_SCOPE)
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  return normalized || DEFAULT_SCOPE;
}

function normalizeNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeColumnId(value: unknown, index: number): string {
  return normalizeText(value, 120, `column_${index + 1}`);
}

function sanitizeColumns(value: unknown): TimeSeriesColumnState[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const record = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};

    return {
      id: normalizeColumnId(record.id, index),
      label: normalizeText(record.label, 255, `数据列${String.fromCharCode(65 + index)}`),
      color: normalizeText(record.color, 32, "#00f3ff"),
    };
  });
}

function sanitizeRows(value: unknown, columns: TimeSeriesColumnState[]): TimeSeriesRowState[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const record = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
    const rawValues =
      record.values && typeof record.values === "object" && !Array.isArray(record.values)
        ? (record.values as Record<string, unknown>)
        : {};

    return {
      id: normalizeText(record.id, 120, `row_${index + 1}`),
      timeLabel: normalizeText(record.timeLabel, 255, "-"),
      values: Object.fromEntries(
        columns.map((column) => [column.id, normalizeNumber(rawValues[column.id])]),
      ),
    };
  });
}

function sanitizeDataset(value: unknown): TimeSeriesDatasetState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const columns = sanitizeColumns(record.columns);
  const rows = sanitizeRows(record.rows, columns);

  if (columns.length === 0 || rows.length === 0) {
    return null;
  }

  return {
    timeHeader: normalizeText(record.timeHeader, 120, "时间"),
    columns,
    rows,
    sourceName: normalizeText(record.sourceName, 255, "时间序列数据"),
    updatedAt: normalizeText(record.updatedAt, 32, new Date().toISOString()),
  };
}

function sanitizeWorkspaceState(value: unknown, fallbackScope: string): TimeSeriesWorkspaceState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const dataset = sanitizeDataset(record.dataset);
  if (!dataset) {
    return null;
  }

  const selectedRowId = normalizeText(record.selectedRowId, 120);

  return {
    scope: normalizeScope(record.scope ?? fallbackScope),
    dataset,
    selectedRowId: selectedRowId || null,
    updatedAt: normalizeText(record.updatedAt, 32, dataset.updatedAt),
  };
}

function readStoredState(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  return "state" in record ? record.state : payload;
}

function readScope(source: Request["query"] | Record<string, unknown>): string {
  return normalizeScope(source.scope);
}

function readArchiveId(source: Request["query"] | Record<string, unknown>): string {
  return normalizeText(source.archiveId, 120);
}

function buildStateObjectKey(scope: string): string {
  return `${TIME_SERIES_STATE_OBJECT_PREFIX}/${normalizeScope(scope)}.json`;
}

function buildArchiveIndexObjectKey(scope: string): string {
  return `${TIME_SERIES_ARCHIVE_OBJECT_PREFIX}/${normalizeScope(scope)}/index.json`;
}

function buildArchiveDocumentObjectKey(scope: string, archiveId: string): string {
  return `${TIME_SERIES_ARCHIVE_OBJECT_PREFIX}/${normalizeScope(scope)}/${normalizeText(archiveId, 120)}.json`;
}

function isOssNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const record = error as { code?: unknown; status?: unknown; statusCode?: unknown; name?: unknown };
  return (
    record.code === "NoSuchKey" ||
    record.name === "NoSuchKeyError" ||
    record.status === 404 ||
    record.statusCode === 404
  );
}

function isOssConfigError(error: unknown): boolean {
  return String(error ?? "").includes("ALIYUN_OSS_");
}

function sanitizeArchiveRecord(value: unknown, scope: string): TimeSeriesArchiveRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeText(record.id, 120);
  if (!id) return null;

  return {
    id,
    scope: normalizeScope(record.scope ?? scope),
    title: normalizeText(record.title, 255, "时间序列档案"),
    sourceName: normalizeText(record.sourceName, 255, "时间序列数据"),
    rowCount: Math.max(0, Number(record.rowCount) || 0),
    columnCount: Math.max(0, Number(record.columnCount) || 0),
    createdAt: normalizeText(record.createdAt, 32, new Date().toISOString()),
    updatedAt: normalizeText(record.updatedAt, 32, new Date().toISOString()),
  };
}

function sanitizeArchiveIndex(value: unknown, scope: string): TimeSeriesArchiveRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => sanitizeArchiveRecord(item, scope))
    .filter((item): item is TimeSeriesArchiveRecord => Boolean(item));
}

async function readArchiveIndex(scope: string): Promise<TimeSeriesArchiveRecord[]> {
  try {
    const buffer = await getOssObjectBuffer(buildArchiveIndexObjectKey(scope));
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const value =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>).archives
        : parsed;
    return sanitizeArchiveIndex(value, scope);
  } catch (error) {
    if (isOssNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

async function writeArchiveIndex(scope: string, archives: TimeSeriesArchiveRecord[]): Promise<void> {
  await putOssObject({
    objectKey: buildArchiveIndexObjectKey(scope),
    body: Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        scope,
        updatedAt: new Date().toISOString(),
        archives,
      }),
      "utf8",
    ),
    mimeType: "application/json",
    cacheControl: "no-cache",
  });
}

export async function getDashboardTimeSeriesState(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);
  const scope = readScope(req.query);

  try {
    const objectKey = buildStateObjectKey(scope);
    const buffer = await getOssObjectBuffer(objectKey);
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const state = sanitizeWorkspaceState(readStoredState(parsed), scope);

    if (!state) {
      res.status(200).json({ state: null });
      return;
    }

    res.status(200).json({ state });
  } catch (error) {
    if (isOssNotFoundError(error)) {
      res.status(200).json({ state: null });
      return;
    }

    console.error("GET /api/dashboard/time-series-state error:", error);
    sendTimeSeriesRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "TIME_SERIES_STATE_LOAD_FAILED",
    );
  }
}

export async function upsertDashboardTimeSeriesState(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const scope = readScope(body);
  const state = sanitizeWorkspaceState(body, scope);

  if (!state) {
    sendTimeSeriesRouteError(res, 400, "TIME_SERIES_STATE_SAVE_FAILED");
    return;
  }

  const updatedAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    scope,
    updatedAt,
    state: {
      ...state,
      scope,
      updatedAt,
      dataset: {
        ...state.dataset,
        updatedAt,
      },
    },
  };

  try {
    await putOssObject({
      objectKey: buildStateObjectKey(scope),
      body: Buffer.from(JSON.stringify(snapshot), "utf8"),
      mimeType: "application/json",
      cacheControl: "no-cache",
    });

    res.status(200).json({ success: true, updatedAt });
  } catch (error) {
    console.error("PUT /api/dashboard/time-series-state error:", error);
    sendTimeSeriesRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "TIME_SERIES_STATE_SAVE_FAILED",
    );
  }
}

export async function deleteDashboardTimeSeriesState(req: Request, res: Response): Promise<void> {
  const scope = readScope(req.query);

  try {
    await deleteOssObject(buildStateObjectKey(scope));
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("DELETE /api/dashboard/time-series-state error:", error);
    sendTimeSeriesRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "TIME_SERIES_STATE_DELETE_FAILED",
    );
  }
}

export async function listDashboardTimeSeriesArchives(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);
  const scope = readScope(req.query);

  try {
    const archives = await readArchiveIndex(scope);
    res.status(200).json({ archives });
  } catch (error) {
    console.error("GET /api/dashboard/time-series-archives error:", error);
    sendTimeSeriesRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "TIME_SERIES_ARCHIVE_LIST_FAILED",
    );
  }
}

export async function createDashboardTimeSeriesArchive(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const scope = readScope(body);
  const state = sanitizeWorkspaceState(body, scope);

  if (!state) {
    sendTimeSeriesRouteError(res, 400, "TIME_SERIES_ARCHIVE_CREATE_FAILED");
    return;
  }

  const createdAt = new Date().toISOString();
  const archiveId = `archive_${Date.now()}`;
  const document: TimeSeriesArchiveDocument = {
    schemaVersion: 1,
    archiveId,
    scope,
    createdAt,
    state: {
      ...state,
      scope,
      updatedAt: createdAt,
      dataset: {
        ...state.dataset,
        updatedAt: createdAt,
      },
    },
  };

  const archiveRecord: TimeSeriesArchiveRecord = {
    id: archiveId,
    scope,
    title: normalizeText(body.title, 255, state.dataset.sourceName || "时间序列档案"),
    sourceName: state.dataset.sourceName,
    rowCount: state.dataset.rows.length,
    columnCount: state.dataset.columns.length,
    createdAt,
    updatedAt: createdAt,
  };

  try {
    const archives = await readArchiveIndex(scope);
    await putOssObject({
      objectKey: buildArchiveDocumentObjectKey(scope, archiveId),
      body: Buffer.from(JSON.stringify(document), "utf8"),
      mimeType: "application/json",
      cacheControl: "no-cache",
    });

    await writeArchiveIndex(scope, [archiveRecord, ...archives].slice(0, 100));

    res.status(200).json({ success: true, archive: archiveRecord });
  } catch (error) {
    console.error("POST /api/dashboard/time-series-archives error:", error);
    sendTimeSeriesRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "TIME_SERIES_ARCHIVE_CREATE_FAILED",
    );
  }
}

export async function getDashboardTimeSeriesArchive(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);
  const scope = readScope(req.query);
  const archiveId = readArchiveId(req.query);

  if (!archiveId) {
    sendTimeSeriesRouteError(res, 400, "TIME_SERIES_ARCHIVE_LOAD_FAILED");
    return;
  }

  try {
    const buffer = await getOssObjectBuffer(buildArchiveDocumentObjectKey(scope, archiveId));
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const record =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const state = sanitizeWorkspaceState(record.state, scope);

    if (!state) {
      sendTimeSeriesRouteError(res, 404, "TIME_SERIES_ARCHIVE_LOAD_FAILED");
      return;
    }

    res.status(200).json({
      archive: {
        id: archiveId,
        state,
      },
    });
  } catch (error) {
    if (isOssNotFoundError(error)) {
      sendTimeSeriesRouteError(res, 404, "TIME_SERIES_ARCHIVE_LOAD_FAILED");
      return;
    }

    console.error("GET /api/dashboard/time-series-archives/document error:", error);
    sendTimeSeriesRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "TIME_SERIES_ARCHIVE_LOAD_FAILED",
    );
  }
}

export async function deleteDashboardTimeSeriesArchive(req: Request, res: Response): Promise<void> {
  const scope = readScope(req.query);
  const archiveId = readArchiveId(req.query);

  if (!archiveId) {
    sendTimeSeriesRouteError(res, 400, "TIME_SERIES_ARCHIVE_DELETE_FAILED");
    return;
  }

  try {
    const archives = await readArchiveIndex(scope);
    const nextArchives = archives.filter((archive) => archive.id !== archiveId);

    await deleteOssObject(buildArchiveDocumentObjectKey(scope, archiveId)).catch((error) => {
      if (!isOssNotFoundError(error)) {
        throw error;
      }
    });

    await writeArchiveIndex(scope, nextArchives);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("DELETE /api/dashboard/time-series-archives error:", error);
    sendTimeSeriesRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "TIME_SERIES_ARCHIVE_DELETE_FAILED",
    );
  }
}

export async function renameDashboardTimeSeriesArchive(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const scope = readScope(body);
  const archiveId = readArchiveId(body);
  const nextTitle = normalizeText(body.title, 255);

  if (!archiveId || !nextTitle) {
    sendTimeSeriesRouteError(res, 400, "TIME_SERIES_ARCHIVE_RENAME_FAILED");
    return;
  }

  try {
    const archives = await readArchiveIndex(scope);
    const archiveExists = archives.some((archive) => archive.id === archiveId);
    if (!archiveExists) {
      sendTimeSeriesRouteError(res, 404, "TIME_SERIES_ARCHIVE_RENAME_FAILED");
      return;
    }

    const updatedAt = new Date().toISOString();
    const nextArchives = archives.map((archive) =>
      archive.id === archiveId
        ? {
            ...archive,
            title: nextTitle,
            updatedAt,
          }
        : archive,
    );

    await writeArchiveIndex(scope, nextArchives);

    res.status(200).json({
      success: true,
      archive: nextArchives.find((archive) => archive.id === archiveId) ?? null,
    });
  } catch (error) {
    console.error("PATCH /api/dashboard/time-series-archives error:", error);
    sendTimeSeriesRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "TIME_SERIES_ARCHIVE_RENAME_FAILED",
    );
  }
}
