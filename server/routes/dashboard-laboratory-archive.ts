import { randomUUID } from "node:crypto";

import type { Request, Response } from "express";

import {
  deleteOssObject,
  getOssObjectBuffer,
  putOssObject,
} from "../lib/oss.js";
import {
  isOssConfigError,
  isOssNotFoundError,
} from "./dashboard-fmea-state.js";

type LaboratoryArchiveModuleSummary = {
  nodeId: number;
  type: string;
  label: string;
  printTitle: string;
  category: string;
  status: string;
  verdict: string;
  sourceFiles: string[];
  keyMetrics: Array<{ label: string; value: string }>;
  warnings: string[];
};

type LaboratoryArchiveReportMeta = {
  reportNo: string;
  projectName: string;
  sampleName: string;
  sampleNo: string;
  customer: string;
  stage: string;
  testDate: string;
  operator: string;
  reviewer: string;
};

type LaboratoryArchiveSpecHeader = {
  productManager: string;
  structuralEngineer: string;
  electronicEngineer: string;
  testType: string;
  sampleDeliveryDate: string;
};

type LaboratoryArchiveState = {
  reportMeta: LaboratoryArchiveReportMeta;
  specHeader?: LaboratoryArchiveSpecHeader;
  selectedSpecId?: string;
  selectedSpecLabel?: string;
  moduleSummaries: LaboratoryArchiveModuleSummary[];
  overallAdjudication?: {
    verdict: string;
    summary: string;
    passCount: number;
    watchCount: number;
    failCount: number;
    pendingCount: number;
    blockingModules: string[];
    watchModules: string[];
    pendingModules: string[];
  };
  exportGate?: {
    canExport: boolean;
    level: string;
    label: string;
    reasons: string[];
  };
};

type LaboratoryArchiveRecord = {
  id: string;
  projectId: string;
  sequence: number;
  reportNo: string;
  projectName: string;
  sampleName: string;
  sampleNo: string;
  testDate: string;
  verdict: string;
  moduleCount: number;
  printableModuleCount: number;
  selectedSpecLabel?: string;
  createdAt: string;
  ossUrl: string;
};

type LaboratoryArchiveManifest = {
  schemaVersion: 1;
  projectId: string;
  updatedAt: string;
  documents: LaboratoryArchiveRecord[];
};

type LaboratoryArchiveSnapshot = {
  schemaVersion: 1;
  projectId: string;
  document: LaboratoryArchiveRecord;
  state: LaboratoryArchiveState;
};

type LaboratoryArchiveRouteErrorCode =
  | "LABORATORY_ARCHIVE_CREATE_FAILED"
  | "LABORATORY_ARCHIVE_DELETE_FAILED"
  | "LABORATORY_ARCHIVE_DOCUMENT_LOAD_FAILED"
  | "LABORATORY_ARCHIVE_DOCUMENT_NOT_FOUND"
  | "LABORATORY_ARCHIVE_LIST_FAILED"
  | "INVALID_LABORATORY_ARCHIVE_DOCUMENT_ID"
  | "INVALID_LABORATORY_ARCHIVE_PROJECT_ID"
  | "UPLOADS_NOT_CONFIGURED";

const ROUTE_ERROR_MESSAGES: Record<LaboratoryArchiveRouteErrorCode, string> = {
  LABORATORY_ARCHIVE_CREATE_FAILED: "Failed to create laboratory archive",
  LABORATORY_ARCHIVE_DELETE_FAILED: "Failed to delete laboratory archive",
  LABORATORY_ARCHIVE_DOCUMENT_LOAD_FAILED: "Failed to load laboratory archive",
  LABORATORY_ARCHIVE_DOCUMENT_NOT_FOUND: "Laboratory archive not found",
  LABORATORY_ARCHIVE_LIST_FAILED: "Failed to list laboratory archives",
  INVALID_LABORATORY_ARCHIVE_DOCUMENT_ID: "documentId is required",
  INVALID_LABORATORY_ARCHIVE_PROJECT_ID: "projectId is required",
  UPLOADS_NOT_CONFIGURED: "Aliyun OSS is not configured",
};

const LABORATORY_ARCHIVE_OBJECT_PREFIX = "files/dashboard-laboratory-archives/v1";
const projectArchiveLocks = new Map<string, Promise<void>>();

function applyNoStoreHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function sendRouteError(
  res: Response,
  status: number,
  code: LaboratoryArchiveRouteErrorCode
): void {
  res.status(status).json({
    error: ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

async function withProjectArchiveLock<T>(
  projectId: string,
  task: () => Promise<T>
): Promise<T> {
  const previous = projectArchiveLocks.get(projectId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  projectArchiveLocks.set(
    projectId,
    previous.then(() => current).catch(() => current)
  );

  await previous.catch(() => undefined);

  try {
    return await task();
  } finally {
    release();
    if (projectArchiveLocks.get(projectId) === current) {
      projectArchiveLocks.delete(projectId);
    }
  }
}

function normalizeText(value: unknown, maxLength = 255, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function normalizeSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_.]+|[-_.]+$/g, "")
      .slice(0, 120) || "default"
  );
}

function buildBasePrefix(projectId: string): string {
  return `${LABORATORY_ARCHIVE_OBJECT_PREFIX}/${normalizeSegment(projectId)}`;
}

function buildManifestObjectKey(projectId: string): string {
  return `${buildBasePrefix(projectId)}/manifest.json`;
}

function buildDocumentObjectKey(projectId: string, documentId: string): string {
  return `${buildBasePrefix(projectId)}/documents/${normalizeSegment(documentId)}.json`;
}

function readDocumentId(source: Request["query"] | Record<string, unknown>): string {
  return normalizeText(source.documentId, 120);
}

function sortDocumentsDescending(
  documents: LaboratoryArchiveRecord[]
): LaboratoryArchiveRecord[] {
  return [...documents].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function sanitizeRecord(
  value: unknown,
  projectIdFallback: string,
  createdAtFallback: string
): LaboratoryArchiveRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const id = normalizeText(record.id, 120);
  const ossUrl = normalizeText(record.ossUrl, 4000);
  if (!id || !ossUrl) return null;

  return {
    id,
    projectId: normalizeText(record.projectId, 255, projectIdFallback),
    sequence: Number(record.sequence) || 0,
    reportNo: normalizeText(record.reportNo, 160, "LAB-ARCHIVE"),
    projectName: normalizeText(record.projectName, 255),
    sampleName: normalizeText(record.sampleName, 255),
    sampleNo: normalizeText(record.sampleNo, 255),
    testDate: normalizeText(record.testDate, 64),
    verdict: normalizeText(record.verdict, 32, "待完成"),
    moduleCount: Number(record.moduleCount) || 0,
    printableModuleCount: Number(record.printableModuleCount) || 0,
    selectedSpecLabel: normalizeText(record.selectedSpecLabel, 400) || undefined,
    createdAt: normalizeText(record.createdAt, 64, createdAtFallback),
    ossUrl,
  };
}

async function readManifest(projectId: string): Promise<LaboratoryArchiveManifest | null> {
  try {
    const buffer = await getOssObjectBuffer(buildManifestObjectKey(projectId));
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const record =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const updatedAt = normalizeText(record.updatedAt, 64, new Date(0).toISOString());
    const documents = Array.isArray(record.documents)
      ? record.documents
          .map(item => sanitizeRecord(item, projectId, updatedAt))
          .filter((item): item is LaboratoryArchiveRecord => Boolean(item))
      : [];

    return {
      schemaVersion: 1,
      projectId: normalizeText(record.projectId, 255, projectId),
      updatedAt,
      documents: sortDocumentsDescending(documents),
    };
  } catch (error) {
    if (isOssNotFoundError(error)) return null;
    throw error;
  }
}

async function writeManifest(projectId: string, documents: LaboratoryArchiveRecord[]): Promise<void> {
  const manifest: LaboratoryArchiveManifest = {
    schemaVersion: 1,
    projectId,
    updatedAt: new Date().toISOString(),
    documents: sortDocumentsDescending(documents),
  };

  await putOssObject({
    objectKey: buildManifestObjectKey(projectId),
    body: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    mimeType: "application/json",
    cacheControl: "no-cache",
  });
}

async function readArchiveSnapshot(
  projectId: string,
  documentId: string
): Promise<LaboratoryArchiveSnapshot | null> {
  try {
    const buffer = await getOssObjectBuffer(buildDocumentObjectKey(projectId, documentId));
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const record =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const createdAt = normalizeText(record.createdAt, 64, new Date(0).toISOString());
    const document = sanitizeRecord(record.document, projectId, createdAt);
    if (!document) return null;

    return {
      schemaVersion: 1,
      projectId: normalizeText(record.projectId, 255, projectId),
      document,
      state: (record.state ?? {}) as LaboratoryArchiveState,
    };
  } catch (error) {
    if (isOssNotFoundError(error)) return null;
    throw error;
  }
}

function compactLedgerSequences(
  documents: LaboratoryArchiveRecord[]
): { documents: LaboratoryArchiveRecord[]; changed: boolean } {
  let changed = false;
  const compacted = [...documents]
    .sort((left, right) => {
      const leftSequence = Number(left.sequence) || 0;
      const rightSequence = Number(right.sequence) || 0;
      if (leftSequence !== rightSequence) return leftSequence - rightSequence;
      return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
    })
    .map((document, index) => {
      const nextSequence = index + 1;
      if (document.sequence === nextSequence) return document;
      changed = true;
      return {
        ...document,
        sequence: nextSequence,
      };
    });

  return {
    documents: sortDocumentsDescending(compacted),
    changed,
  };
}

export async function listDashboardLaboratoryArchives(
  req: Request,
  res: Response
): Promise<void> {
  applyNoStoreHeaders(res);

  const projectId = normalizeText(req.query.projectId, 255);
  if (!projectId) {
    sendRouteError(res, 400, "INVALID_LABORATORY_ARCHIVE_PROJECT_ID");
    return;
  }

  try {
    const manifest = await readManifest(projectId);
    const compacted = compactLedgerSequences(manifest?.documents ?? []);
    const documents = compacted.documents;
    if (manifest && compacted.changed) {
      await writeManifest(projectId, documents);
    }

    res.status(200).json({ documents });
  } catch (error) {
    console.error("GET /api/dashboard/laboratory-archives error:", error);
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error)
        ? "UPLOADS_NOT_CONFIGURED"
        : "LABORATORY_ARCHIVE_LIST_FAILED"
    );
  }
}

export async function createDashboardLaboratoryArchive(
  req: Request,
  res: Response
): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const projectId = normalizeText(body.projectId, 255);
  if (!projectId) {
    sendRouteError(res, 400, "INVALID_LABORATORY_ARCHIVE_PROJECT_ID");
    return;
  }

  const state = (body.state || {}) as LaboratoryArchiveState;
  const createdAt = new Date().toISOString();
  const documentId = randomUUID();
  const documentObjectKey = buildDocumentObjectKey(projectId, documentId);

  try {
    await withProjectArchiveLock(projectId, async () => {
      const existingDocuments = (await readManifest(projectId))?.documents ?? [];
      const sequence =
        existingDocuments.reduce(
          (maxSequence, document) => Math.max(maxSequence, Number(document.sequence) || 0),
          0
        ) + 1;
      const moduleSummaries = Array.isArray(state.moduleSummaries)
        ? state.moduleSummaries
        : [];
      const provisionalRecord: LaboratoryArchiveRecord = {
        id: documentId,
        projectId,
        sequence,
        reportNo: normalizeText(state.reportMeta?.reportNo, 160, `LAB-${sequence}`),
        projectName: normalizeText(state.reportMeta?.projectName, 255),
        sampleName: normalizeText(state.reportMeta?.sampleName, 255),
        sampleNo: normalizeText(state.reportMeta?.sampleNo, 255),
        testDate: normalizeText(state.reportMeta?.testDate, 64),
        verdict: normalizeText(state.overallAdjudication?.verdict, 32, "待完成"),
        moduleCount: moduleSummaries.length,
        printableModuleCount: moduleSummaries.filter((summary) => summary?.type !== "PRODUCT_ILLUSTRATION").length,
        selectedSpecLabel: normalizeText(state.selectedSpecLabel, 400) || undefined,
        createdAt,
        ossUrl: "",
      };

      const upload = await putOssObject({
        objectKey: documentObjectKey,
        body: Buffer.from(
          JSON.stringify(
            {
              schemaVersion: 1,
              projectId,
              document: provisionalRecord,
              state,
            } satisfies LaboratoryArchiveSnapshot,
            null,
            2
          ),
          "utf8"
        ),
        mimeType: "application/json",
        cacheControl: "no-cache",
      });

      const storedRecord: LaboratoryArchiveRecord = {
        ...provisionalRecord,
        ossUrl: upload.url,
      };

      await putOssObject({
        objectKey: documentObjectKey,
        body: Buffer.from(
          JSON.stringify(
            {
              schemaVersion: 1,
              projectId,
              document: storedRecord,
              state,
            } satisfies LaboratoryArchiveSnapshot,
            null,
            2
          ),
          "utf8"
        ),
        mimeType: "application/json",
        cacheControl: "no-cache",
      });

      await writeManifest(projectId, [
        storedRecord,
        ...existingDocuments.filter(item => item.id !== documentId),
      ]);

      res.status(200).json({ document: storedRecord });
    });
  } catch (error) {
    console.error("POST /api/dashboard/laboratory-archives error:", error);
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error)
        ? "UPLOADS_NOT_CONFIGURED"
        : "LABORATORY_ARCHIVE_CREATE_FAILED"
    );
  }
}

export async function getDashboardLaboratoryArchiveDocument(
  req: Request,
  res: Response
): Promise<void> {
  applyNoStoreHeaders(res);

  const projectId = normalizeText(req.query.projectId, 255);
  const documentId = readDocumentId(req.query);
  if (!projectId) {
    sendRouteError(res, 400, "INVALID_LABORATORY_ARCHIVE_PROJECT_ID");
    return;
  }
  if (!documentId) {
    sendRouteError(res, 400, "INVALID_LABORATORY_ARCHIVE_DOCUMENT_ID");
    return;
  }

  try {
    const snapshot = await readArchiveSnapshot(projectId, documentId);
    if (!snapshot) {
      sendRouteError(res, 404, "LABORATORY_ARCHIVE_DOCUMENT_NOT_FOUND");
      return;
    }

    res.status(200).json({
      document: snapshot.document,
      state: snapshot.state,
    });
  } catch (error) {
    console.error("GET /api/dashboard/laboratory-archives/document error:", error);
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error)
        ? "UPLOADS_NOT_CONFIGURED"
        : "LABORATORY_ARCHIVE_DOCUMENT_LOAD_FAILED"
    );
  }
}

export async function deleteDashboardLaboratoryArchive(
  req: Request,
  res: Response
): Promise<void> {
  const projectId = normalizeText(req.query.projectId, 255);
  const documentId = readDocumentId(req.query);
  if (!projectId) {
    sendRouteError(res, 400, "INVALID_LABORATORY_ARCHIVE_PROJECT_ID");
    return;
  }
  if (!documentId) {
    sendRouteError(res, 400, "INVALID_LABORATORY_ARCHIVE_DOCUMENT_ID");
    return;
  }

  try {
    await withProjectArchiveLock(projectId, async () => {
      const existingDocuments = (await readManifest(projectId))?.documents ?? [];
      const compacted = compactLedgerSequences(existingDocuments.filter(item => item.id !== documentId));
      await writeManifest(projectId, compacted.documents);
      await deleteOssObject(buildDocumentObjectKey(projectId, documentId)).catch(() => undefined);
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("DELETE /api/dashboard/laboratory-archives error:", error);
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error)
        ? "UPLOADS_NOT_CONFIGURED"
        : "LABORATORY_ARCHIVE_DELETE_FAILED"
    );
  }
}
