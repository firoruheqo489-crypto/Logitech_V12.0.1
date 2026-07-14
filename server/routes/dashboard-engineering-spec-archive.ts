import { createHash } from "node:crypto";

import type { Request, Response } from "express";

import {
  deleteAssetsFromOssUrls,
  deleteOssObject,
  getOssObjectBuffer,
  putOssObject,
} from "../lib/oss.js";
import {
  isOssConfigError,
  isOssNotFoundError,
} from "./dashboard-fmea-state.js";

type EngineeringSpecArchiveProductInfo = {
  sku: string;
  spu: string;
  type: string;
  description: string;
  department: string;
  productGroup: string;
  sampleQty: string;
  testDate: string;
};

type EngineeringSpecArchiveState = {
  fileName: string;
  fileFingerprint?: string;
  contentFingerprint?: string;
  imageUrl?: string;
  qeConclusion?: string;
  inspectionTestProject?: {
    testType?: string;
    sampleDeliveryDate?: string;
    testItemCount?: string;
    remark?: string;
  };
  oaInfo?: {
    workflowName?: string;
    workflowNo?: string;
    reportStatus?: string;
  };
  laboratoryTests?: Array<{
    id?: string;
    testItem: string;
    testQuantity?: string;
    testConclusion?: string;
    remarks?: string;
  }>;
  laboratoryTestItems?: string[];
  images?: Array<{
    id: string;
    label: string;
    url: string;
  }>;
  packaging: Array<{ label: string; value: string }>;
  businessMeta: Array<{ label: string; value: string }>;
  productInfo: EngineeringSpecArchiveProductInfo;
  sections: Array<{
    label: string;
    groups: Array<{
      label: string;
      rows: Array<{
        item: string;
        label: string;
        value: string;
        pending: boolean;
        status?: "pass" | "fail" | "untested";
      }>;
    }>;
  }>;
};

type EngineeringSpecLedgerRecord = {
  id: string;
  projectId: string;
  sequence: number;
  fileFingerprint?: string;
  contentFingerprint?: string;
  sku: string;
  spu: string;
  type: string;
  category: string;
  imageUrl?: string;
  description: string;
  department: string;
  productGroup: string;
  sampleQty: string;
  testDate: string;
  sampleType?: string;
  reportStatus?: string;
  result: "合格" | "待完善";
  pendingCount: number;
  createdAt: string;
  ossUrl: string;
};

type EngineeringSpecArchiveManifest = {
  schemaVersion: 1;
  projectId: string;
  updatedAt: string;
  documents: EngineeringSpecLedgerRecord[];
};

type EngineeringSpecArchiveSnapshot = {
  schemaVersion: 1;
  projectId: string;
  document: EngineeringSpecLedgerRecord;
  state: EngineeringSpecArchiveState;
};

type EngineeringSpecArchiveRouteErrorCode =
  | "ENGINEERING_SPEC_ARCHIVE_CREATE_FAILED"
  | "ENGINEERING_SPEC_ARCHIVE_DUPLICATE_FILE"
  | "ENGINEERING_SPEC_ARCHIVE_DUPLICATE_SKU"
  | "ENGINEERING_SPEC_ARCHIVE_INVALID_SKU"
  | "ENGINEERING_SPEC_ARCHIVE_DELETE_FAILED"
  | "ENGINEERING_SPEC_ARCHIVE_DOCUMENT_LOAD_FAILED"
  | "ENGINEERING_SPEC_ARCHIVE_DOCUMENT_NOT_FOUND"
  | "ENGINEERING_SPEC_ARCHIVE_LIST_FAILED"
  | "INVALID_ENGINEERING_SPEC_DOCUMENT_ID"
  | "INVALID_ENGINEERING_SPEC_PROJECT_ID"
  | "UPLOADS_NOT_CONFIGURED";

const ROUTE_ERROR_MESSAGES: Record<
  EngineeringSpecArchiveRouteErrorCode,
  string
> = {
  ENGINEERING_SPEC_ARCHIVE_CREATE_FAILED:
    "Failed to create engineering spec archive",
  ENGINEERING_SPEC_ARCHIVE_DUPLICATE_FILE:
    "This engineering spec file has already been uploaded",
  ENGINEERING_SPEC_ARCHIVE_DUPLICATE_SKU:
    "This SKU already exists in the engineering spec ledger",
  ENGINEERING_SPEC_ARCHIVE_INVALID_SKU:
    "A valid SKU could not be parsed from the engineering spec file",
  ENGINEERING_SPEC_ARCHIVE_DELETE_FAILED:
    "Failed to delete engineering spec archive",
  ENGINEERING_SPEC_ARCHIVE_DOCUMENT_LOAD_FAILED:
    "Failed to load engineering spec archive",
  ENGINEERING_SPEC_ARCHIVE_DOCUMENT_NOT_FOUND:
    "Engineering spec archive not found",
  ENGINEERING_SPEC_ARCHIVE_LIST_FAILED:
    "Failed to list engineering spec archives",
  INVALID_ENGINEERING_SPEC_DOCUMENT_ID: "documentId is required",
  INVALID_ENGINEERING_SPEC_PROJECT_ID: "projectId is required",
  UPLOADS_NOT_CONFIGURED: "Aliyun OSS is not configured",
};

const ENGINEERING_SPEC_ARCHIVE_OBJECT_PREFIX =
  "files/dashboard-engineering-spec-archives/v1";
const projectArchiveLocks = new Map<string, Promise<void>>();

function applyNoStoreHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function sendRouteError(
  res: Response,
  status: number,
  code: EngineeringSpecArchiveRouteErrorCode
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

function normalizeEngineeringSpecComparable(value: string): string {
  return value
    .replace(/\s+/g, "")
    .replace(/[()（）:：]/g, "")
    .toLowerCase();
}

function isInvalidEngineeringSpecSkuValue(value: string): boolean {
  const normalized = normalizeEngineeringSpecComparable(value || "");
  if (!normalized) return true;
  if (
    normalized === "sku" ||
    normalized === "产品编号" ||
    normalized === "产品编号sku"
  ) {
    return true;
  }
  return normalized.startsWith("产品编号");
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
  return `${ENGINEERING_SPEC_ARCHIVE_OBJECT_PREFIX}/${normalizeSegment(projectId)}`;
}

function buildManifestObjectKey(projectId: string): string {
  return `${buildBasePrefix(projectId)}/manifest.json`;
}

function buildDocumentObjectKey(projectId: string, documentId: string): string {
  return `${buildBasePrefix(projectId)}/documents/${normalizeSegment(documentId)}.json`;
}

function readDocumentId(
  source: Request["query"] | Record<string, unknown>
): string {
  return normalizeText(source.documentId, 120);
}

function sanitizeRecord(
  value: unknown,
  projectIdFallback: string,
  createdAtFallback: string
): EngineeringSpecLedgerRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const id = normalizeText(record.id, 120);
  const sku = normalizeText(record.sku, 160);
  const ossUrl = normalizeText(record.ossUrl, 4000);
  const fileFingerprint = normalizeText(record.fileFingerprint, 128);
  const contentFingerprint = normalizeText(record.contentFingerprint, 128);
  if (!id || !sku || !ossUrl) return null;

  return {
    id,
    projectId: normalizeText(record.projectId, 255, projectIdFallback),
    sequence: Number(record.sequence) || 0,
    fileFingerprint: fileFingerprint || undefined,
    contentFingerprint: contentFingerprint || undefined,
    sku,
    spu: normalizeText(record.spu, 160),
    type: normalizeText(record.type, 255),
    category: normalizeText(record.category, 255),
    imageUrl: normalizeText(record.imageUrl, 4000) || undefined,
    description: normalizeText(record.description, 4000),
    department: normalizeText(record.department, 255),
    productGroup: normalizeText(record.productGroup, 255),
    sampleQty: normalizeText(record.sampleQty, 64),
    testDate: normalizeText(record.testDate, 64),
    sampleType: normalizeText(record.sampleType, 32) || undefined,
    reportStatus: normalizeText(record.reportStatus, 64) || undefined,
    result: normalizeText(record.result, 16) === "待完善" ? "待完善" : "合格",
    pendingCount: Number(record.pendingCount) || 0,
    createdAt: normalizeText(record.createdAt, 64, createdAtFallback),
    ossUrl,
  };
}

function sortDocumentsDescending(
  documents: EngineeringSpecLedgerRecord[]
): EngineeringSpecLedgerRecord[] {
  return [...documents].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

function collectArchiveAssetUrls(
  state: EngineeringSpecArchiveState | null | undefined
): string[] {
  const urls = new Set<string>();

  if (typeof state?.imageUrl === "string" && state.imageUrl.trim()) {
    urls.add(state.imageUrl.trim());
  }

  for (const image of state?.images ?? []) {
    if (typeof image?.url === "string" && image.url.trim()) {
      urls.add(image.url.trim());
    }
  }

  return [...urls];
}

function buildArchiveContentFingerprint(
  state: EngineeringSpecArchiveState
): string {
  const payload = {
    version: 1,
    productInfo: {
      sku: normalizeText(state.productInfo?.sku, 255),
      spu: normalizeText(state.productInfo?.spu, 255),
      type: normalizeText(state.productInfo?.type, 255),
      description: normalizeText(state.productInfo?.description, 4000),
      department: normalizeText(state.productInfo?.department, 255),
      productGroup: normalizeText(state.productInfo?.productGroup, 255),
      sampleQty: normalizeText(state.productInfo?.sampleQty, 255),
      testDate: normalizeText(state.productInfo?.testDate, 255),
    },
    packaging: (state.packaging ?? []).map(item => ({
      label: normalizeText(item?.label, 255),
      value: normalizeText(item?.value, 4000),
    })),
    businessMeta: (state.businessMeta ?? []).map(item => ({
      label: normalizeText(item?.label, 255),
      value: normalizeText(item?.value, 4000),
    })),
    sections: (state.sections ?? []).map(section => ({
      label: normalizeText(section?.label, 255),
      groups: (section?.groups ?? []).map(group => ({
        label: normalizeText(group?.label, 255),
        rows: (group?.rows ?? []).map(row => ({
          item: normalizeText(row?.item, 255),
          label: normalizeText(row?.label, 255),
          value: normalizeText(row?.value, 4000),
          pending: Boolean(row?.pending),
          status:
            row?.status === "pass" || row?.status === "fail"
              ? row.status
              : "untested",
        })),
      })),
    })),
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function hasDuplicateFileFingerprint(
  documents: EngineeringSpecLedgerRecord[],
  fileFingerprint: string
): boolean {
  const normalizedFingerprint = normalizeText(fileFingerprint, 128);
  if (!normalizedFingerprint) return false;

  return documents.some(
    document => normalizeText(document.fileFingerprint, 128) === normalizedFingerprint
  );
}

function hasDuplicateSku(
  documents: EngineeringSpecLedgerRecord[],
  sku: string
): boolean {
  const normalizedSku = normalizeEngineeringSpecComparable(sku);
  if (isInvalidEngineeringSpecSkuValue(sku)) return false;

  return documents.some((document) => {
    if (isInvalidEngineeringSpecSkuValue(document.sku || "")) {
      return false;
    }
    return (
      normalizeEngineeringSpecComparable(document.sku || "") === normalizedSku
    );
  });
}

function findBusinessMetaValue(
  entries: Array<{ label: string; value: string }> | null | undefined,
  label: string | string[]
): string {
  const normalizedLabels = (Array.isArray(label) ? label : [label]).map((item) =>
    normalizeEngineeringSpecComparable(item)
  );
  for (const entry of entries ?? []) {
    const normalizedEntryLabel = normalizeEngineeringSpecComparable(
      normalizeText(entry?.label, 255)
    );
    if (normalizedLabels.includes(normalizedEntryLabel)) {
      return normalizeText(entry?.value, 255);
    }
  }

  return "";
}

function extractProductCategory(
  entries: Array<{ label: string; value: string }> | null | undefined
): string {
  return findBusinessMetaValue(entries, ["报关中文品名", "产品类别", "报关中文名"]);
}

function extractProductManager(
  entries: Array<{ label: string; value: string }> | null | undefined
): string {
  return findBusinessMetaValue(entries, "产品经理");
}

function selectLedgerImageUrl(state: EngineeringSpecArchiveState): string {
  const primaryImage = normalizeText(state?.imageUrl, 400000);
  if (primaryImage && !primaryImage.startsWith("data:")) {
    return primaryImage;
  }

  const firstEvidenceImage = Array.isArray(state?.images)
    ? state.images.find((item) => normalizeText(item?.url, 4000))
    : null;
  return normalizeText(firstEvidenceImage?.url, 4000);
}

function selectLedgerTestDate(
  state: EngineeringSpecArchiveState,
  fallback = ""
): string {
  return (
    normalizeText(state?.inspectionTestProject?.sampleDeliveryDate, 64) ||
    normalizeText(state?.productInfo?.testDate, 64) ||
    normalizeText(fallback, 64)
  );
}

async function hydrateManifestDocuments(
  projectId: string,
  documents: EngineeringSpecLedgerRecord[]
): Promise<EngineeringSpecLedgerRecord[]> {
  return Promise.all(
    documents.map(async (document) => {
      const snapshot = await readArchiveSnapshot(projectId, document.id);
      if (!snapshot) {
        return document;
      }

      return {
        ...document,
        contentFingerprint:
          normalizeText(document.contentFingerprint, 128) ||
          buildArchiveContentFingerprint(snapshot.state),
        category:
          normalizeText(document.category, 255) ||
          extractProductCategory(snapshot.state.businessMeta),
        imageUrl:
          normalizeText(document.imageUrl, 4000) ||
          selectLedgerImageUrl(snapshot.state) ||
          undefined,
        productGroup: extractProductManager(snapshot.state.businessMeta),
        testDate: selectLedgerTestDate(snapshot.state, document.testDate),
        sampleType:
          normalizeText(document.sampleType, 32) ||
          normalizeText(snapshot.state.inspectionTestProject?.testType, 32) ||
          undefined,
        reportStatus:
          normalizeText(document.reportStatus, 64) ||
          normalizeText(snapshot.state.oaInfo?.reportStatus, 64) ||
          undefined,
      };
    })
  );
}

async function readManifest(
  projectId: string
): Promise<EngineeringSpecArchiveManifest | null> {
  try {
    const buffer = await getOssObjectBuffer(buildManifestObjectKey(projectId));
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const record =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};

    const updatedAt = normalizeText(
      record.updatedAt,
      64,
      new Date(0).toISOString()
    );
    const documents = Array.isArray(record.documents)
      ? record.documents
          .map(item => sanitizeRecord(item, projectId, updatedAt))
          .filter((item): item is EngineeringSpecLedgerRecord => Boolean(item))
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

async function writeManifest(
  projectId: string,
  documents: EngineeringSpecLedgerRecord[]
): Promise<void> {
  const manifest: EngineeringSpecArchiveManifest = {
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
): Promise<EngineeringSpecArchiveSnapshot | null> {
  try {
    const buffer = await getOssObjectBuffer(
      buildDocumentObjectKey(projectId, documentId)
    );
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const record =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const createdAt = normalizeText(
      record.createdAt,
      64,
      new Date(0).toISOString()
    );
    const document = sanitizeRecord(record.document, projectId, createdAt);
    if (!document) return null;

    return {
      schemaVersion: 1,
      projectId: normalizeText(record.projectId, 255, projectId),
      document,
      state: (record.state ?? {}) as EngineeringSpecArchiveState,
    };
  } catch (error) {
    if (isOssNotFoundError(error)) return null;
    throw error;
  }
}

async function writeArchiveSnapshot(
  projectId: string,
  snapshot: EngineeringSpecArchiveSnapshot
): Promise<void> {
  await putOssObject({
    objectKey: buildDocumentObjectKey(projectId, snapshot.document.id),
    body: Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"),
    mimeType: "application/json",
    cacheControl: "no-cache",
  });
}

function compactLedgerSequences(
  documents: EngineeringSpecLedgerRecord[]
): { documents: EngineeringSpecLedgerRecord[]; changed: boolean } {
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

async function syncArchiveSnapshotSequences(
  projectId: string,
  documents: EngineeringSpecLedgerRecord[]
): Promise<void> {
  await Promise.all(
    documents.map(async (document) => {
      const snapshot = await readArchiveSnapshot(projectId, document.id);
      if (!snapshot || snapshot.document.sequence === document.sequence) return;

      await writeArchiveSnapshot(projectId, {
        ...snapshot,
        document: {
          ...snapshot.document,
          sequence: document.sequence,
        },
      });
    })
  );
}

export async function listDashboardEngineeringSpecArchives(
  req: Request,
  res: Response
): Promise<void> {
  applyNoStoreHeaders(res);

  const projectId = normalizeText(req.query.projectId, 255);
  if (!projectId) {
    sendRouteError(res, 400, "INVALID_ENGINEERING_SPEC_PROJECT_ID");
    return;
  }

  try {
    const manifest = await readManifest(projectId);
    const hydratedDocuments = manifest
      ? await hydrateManifestDocuments(projectId, manifest.documents)
      : [];
    const compacted = compactLedgerSequences(hydratedDocuments);
    const documents = compacted.documents;
    if (
      manifest &&
      (compacted.changed ||
        documents.some((document) => {
        const existing = manifest.documents.find((item) => item.id === document.id);
        return (
          existing &&
          (existing.sequence !== document.sequence ||
            existing.category !== document.category ||
            existing.contentFingerprint !== document.contentFingerprint ||
            existing.imageUrl !== document.imageUrl ||
            existing.productGroup !== document.productGroup ||
            existing.testDate !== document.testDate ||
            existing.sampleType !== document.sampleType ||
            existing.reportStatus !== document.reportStatus)
        );
      }))
    ) {
      await writeManifest(projectId, documents);
      if (compacted.changed) {
        await syncArchiveSnapshotSequences(projectId, documents);
      }
    }
    res.status(200).json({
      documents,
    });
  } catch (error) {
    console.error("GET /api/dashboard/engineering-spec-archives error:", error);
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error)
        ? "UPLOADS_NOT_CONFIGURED"
        : "ENGINEERING_SPEC_ARCHIVE_LIST_FAILED"
    );
  }
}

export async function getDashboardEngineeringSpecArchiveDocument(
  req: Request,
  res: Response
): Promise<void> {
  applyNoStoreHeaders(res);

  const projectId = normalizeText(req.query.projectId, 255);
  const documentId = readDocumentId(req.query);
  if (!projectId) {
    sendRouteError(res, 400, "INVALID_ENGINEERING_SPEC_PROJECT_ID");
    return;
  }
  if (!documentId) {
    sendRouteError(res, 400, "INVALID_ENGINEERING_SPEC_DOCUMENT_ID");
    return;
  }

  try {
    const snapshot = await readArchiveSnapshot(projectId, documentId);
    if (!snapshot) {
      sendRouteError(res, 404, "ENGINEERING_SPEC_ARCHIVE_DOCUMENT_NOT_FOUND");
      return;
    }

    res.status(200).json({
      document: snapshot.document,
      state: snapshot.state,
    });
  } catch (error) {
    console.error(
      "GET /api/dashboard/engineering-spec-archives/document error:",
      error
    );
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error)
        ? "UPLOADS_NOT_CONFIGURED"
        : "ENGINEERING_SPEC_ARCHIVE_DOCUMENT_LOAD_FAILED"
    );
  }
}

export async function createDashboardEngineeringSpecArchive(
  req: Request,
  res: Response
): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const projectId = normalizeText(body.projectId, 255);
  if (!projectId) {
    sendRouteError(res, 400, "INVALID_ENGINEERING_SPEC_PROJECT_ID");
    return;
  }

  const state = (body.state || {}) as EngineeringSpecArchiveState;
  const createdAt = new Date().toISOString();
  const documentId = crypto.randomUUID();
  const documentObjectKey = buildDocumentObjectKey(projectId, documentId);
  let existingDocuments = (await readManifest(projectId))?.documents ?? [];
  const compactedExistingDocuments = compactLedgerSequences(existingDocuments);
  if (compactedExistingDocuments.changed) {
    existingDocuments = compactedExistingDocuments.documents;
    await writeManifest(projectId, existingDocuments);
    await syncArchiveSnapshotSequences(projectId, existingDocuments);
  }
  const hydratedDocuments = await hydrateManifestDocuments(
    projectId,
    existingDocuments
  );
  const fileFingerprint = normalizeText(state.fileFingerprint, 128);
  const contentFingerprint = buildArchiveContentFingerprint(state);
  const sku = normalizeText(state?.productInfo?.sku, 160);
  const normalizedState: EngineeringSpecArchiveState = {
    ...state,
    fileFingerprint: fileFingerprint || undefined,
    contentFingerprint,
  };
  const sequence =
    existingDocuments.reduce(
      (maxSequence, document) =>
        Math.max(maxSequence, Number(document.sequence) || 0),
      0
    ) + 1;

  if (fileFingerprint && hasDuplicateFileFingerprint(existingDocuments, fileFingerprint)) {
    sendRouteError(res, 409, "ENGINEERING_SPEC_ARCHIVE_DUPLICATE_FILE");
    return;
  }
  if (isInvalidEngineeringSpecSkuValue(sku)) {
    sendRouteError(res, 409, "ENGINEERING_SPEC_ARCHIVE_INVALID_SKU");
    return;
  }
  if (hasDuplicateSku(existingDocuments, sku)) {
    sendRouteError(res, 409, "ENGINEERING_SPEC_ARCHIVE_DUPLICATE_SKU");
    return;
  }
  if (
    hydratedDocuments.some(
      document =>
        normalizeText(document.contentFingerprint, 128) === contentFingerprint
    )
  ) {
    sendRouteError(res, 409, "ENGINEERING_SPEC_ARCHIVE_DUPLICATE_FILE");
    return;
  }

  const pendingCount = (normalizedState.sections || []).reduce(
    (sectionTotal, section) =>
      sectionTotal +
      (section.groups || []).reduce(
        (groupTotal, group) =>
          groupTotal +
          (group.rows || []).filter(
            row => (row.status || "untested") === "untested"
          ).length,
        0
      ),
    0
  );
  const failCount = (normalizedState.sections || []).reduce(
    (sectionTotal, section) =>
      sectionTotal +
      (section.groups || []).reduce(
        (groupTotal, group) =>
          groupTotal +
          (group.rows || []).filter(
            row => (row.status || "untested") === "fail"
          ).length,
        0
      ),
    0
  );

  try {
    const provisionalRecord: EngineeringSpecLedgerRecord = {
      id: documentId,
      projectId,
      sequence,
      fileFingerprint: fileFingerprint || undefined,
      contentFingerprint,
      sku: normalizeText(normalizedState?.productInfo?.sku, 160, "UNKNOWN-SKU"),
      spu: normalizeText(normalizedState?.productInfo?.spu, 160),
      type: normalizeText(normalizedState?.productInfo?.type, 255),
      category: extractProductCategory(normalizedState?.businessMeta),
      imageUrl: selectLedgerImageUrl(normalizedState) || undefined,
      description: normalizeText(normalizedState?.productInfo?.description, 4000),
      department: normalizeText(normalizedState?.productInfo?.department, 255),
      productGroup: extractProductManager(normalizedState?.businessMeta),
      sampleQty: normalizeText(normalizedState?.productInfo?.sampleQty, 64),
      testDate: selectLedgerTestDate(normalizedState),
      sampleType: normalizeText(normalizedState?.inspectionTestProject?.testType, 32) || undefined,
      reportStatus: normalizeText(normalizedState?.oaInfo?.reportStatus, 64) || undefined,
      result: failCount > 0 || pendingCount > 0 ? "待完善" : "合格",
      pendingCount,
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
            state: normalizedState,
          } satisfies EngineeringSpecArchiveSnapshot,
          null,
          2
        ),
        "utf8"
      ),
      mimeType: "application/json",
      cacheControl: "no-cache",
    });

    const storedRecord: EngineeringSpecLedgerRecord = {
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
            state: normalizedState,
          } satisfies EngineeringSpecArchiveSnapshot,
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

    res.status(200).json({
      document: storedRecord,
    });
  } catch (error) {
    console.error(
      "POST /api/dashboard/engineering-spec-archives error:",
      error
    );
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error)
        ? "UPLOADS_NOT_CONFIGURED"
        : "ENGINEERING_SPEC_ARCHIVE_CREATE_FAILED"
    );
  }
}

export async function updateDashboardEngineeringSpecArchive(
  req: Request,
  res: Response
): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const projectId = normalizeText(body.projectId, 255);
  const documentId = normalizeText(body.documentId, 120);
  if (!projectId) {
    sendRouteError(res, 400, "INVALID_ENGINEERING_SPEC_PROJECT_ID");
    return;
  }
  if (!documentId) {
    sendRouteError(res, 400, "INVALID_ENGINEERING_SPEC_DOCUMENT_ID");
    return;
  }

  const state = (body.state || {}) as EngineeringSpecArchiveState;
  const existingSnapshot = await readArchiveSnapshot(projectId, documentId);
  if (!existingSnapshot) {
    sendRouteError(res, 404, "ENGINEERING_SPEC_ARCHIVE_DOCUMENT_NOT_FOUND");
    return;
  }
  const normalizedState: EngineeringSpecArchiveState = {
    ...state,
    fileFingerprint:
      normalizeText(state?.fileFingerprint, 128) ||
      existingSnapshot.document.fileFingerprint,
    contentFingerprint: buildArchiveContentFingerprint(state),
  };

  const pendingCount = (normalizedState.sections || []).reduce(
    (sectionTotal, section) =>
      sectionTotal +
      (section.groups || []).reduce(
        (groupTotal, group) =>
          groupTotal +
          (group.rows || []).filter(
            row => (row.status || "untested") === "untested"
          ).length,
        0
      ),
    0
  );
  const failCount = (normalizedState.sections || []).reduce(
    (sectionTotal, section) =>
      sectionTotal +
      (section.groups || []).reduce(
        (groupTotal, group) =>
          groupTotal +
          (group.rows || []).filter(
            row => (row.status || "untested") === "fail"
          ).length,
        0
      ),
    0
  );

  try {
    const updatedRecord: EngineeringSpecLedgerRecord = {
      ...existingSnapshot.document,
      fileFingerprint: normalizedState.fileFingerprint,
      contentFingerprint: normalizedState.contentFingerprint,
      sku: normalizeText(
        normalizedState?.productInfo?.sku,
        160,
        existingSnapshot.document.sku
      ),
      spu: normalizeText(
        normalizedState?.productInfo?.spu,
        160,
        existingSnapshot.document.spu
      ),
      type: normalizeText(
        normalizedState?.productInfo?.type,
        255,
        existingSnapshot.document.type
      ),
      category: normalizeText(
        extractProductCategory(normalizedState?.businessMeta),
        255,
        existingSnapshot.document.category
      ),
      imageUrl: selectLedgerImageUrl(normalizedState) || existingSnapshot.document.imageUrl,
      description: normalizeText(
        normalizedState?.productInfo?.description,
        4000,
        existingSnapshot.document.description
      ),
      department: normalizeText(
        normalizedState?.productInfo?.department,
        255,
        existingSnapshot.document.department
      ),
      productGroup: normalizeText(extractProductManager(normalizedState?.businessMeta), 255),
      sampleQty: normalizeText(
        normalizedState?.productInfo?.sampleQty,
        64,
        existingSnapshot.document.sampleQty
      ),
      testDate: selectLedgerTestDate(normalizedState, existingSnapshot.document.testDate),
      sampleType:
        normalizeText(normalizedState?.inspectionTestProject?.testType, 32) ||
        existingSnapshot.document.sampleType,
      reportStatus:
        normalizeText(normalizedState?.oaInfo?.reportStatus, 64) ||
        existingSnapshot.document.reportStatus,
      result: failCount > 0 || pendingCount > 0 ? "待完善" : "合格",
      pendingCount,
    };

    await putOssObject({
      objectKey: buildDocumentObjectKey(projectId, documentId),
      body: Buffer.from(
        JSON.stringify(
          {
            schemaVersion: 1,
            projectId,
            document: updatedRecord,
            state: normalizedState,
          } satisfies EngineeringSpecArchiveSnapshot,
          null,
          2
        ),
        "utf8"
      ),
      mimeType: "application/json",
      cacheControl: "no-cache",
    });

    const existingDocuments = (await readManifest(projectId))?.documents ?? [];
    await writeManifest(
      projectId,
      existingDocuments.map(item =>
        item.id === documentId ? updatedRecord : item
      )
    );

    res.status(200).json({
      document: updatedRecord,
    });
  } catch (error) {
    console.error(
      "PATCH /api/dashboard/engineering-spec-archives error:",
      error
    );
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error)
        ? "UPLOADS_NOT_CONFIGURED"
        : "ENGINEERING_SPEC_ARCHIVE_CREATE_FAILED"
    );
  }
}

export async function deleteDashboardEngineeringSpecArchive(
  req: Request,
  res: Response
): Promise<void> {
  const projectId = normalizeText(req.query.projectId, 255);
  const documentId = readDocumentId(req.query);
  if (!projectId) {
    sendRouteError(res, 400, "INVALID_ENGINEERING_SPEC_PROJECT_ID");
    return;
  }
  if (!documentId) {
    sendRouteError(res, 400, "INVALID_ENGINEERING_SPEC_DOCUMENT_ID");
    return;
  }

  try {
    const snapshot = await readArchiveSnapshot(projectId, documentId);
    const existingDocuments = (await readManifest(projectId))?.documents ?? [];
    const compactedDocuments = compactLedgerSequences(
      existingDocuments.filter(item => item.id !== documentId)
    );
    await writeManifest(projectId, compactedDocuments.documents);
    if (compactedDocuments.changed) {
      await syncArchiveSnapshotSequences(projectId, compactedDocuments.documents);
    }
    await deleteOssObject(buildDocumentObjectKey(projectId, documentId)).catch(
      () => undefined
    );
    const assetUrls = collectArchiveAssetUrls(snapshot?.state);
    if (assetUrls.length > 0) {
      await deleteAssetsFromOssUrls(assetUrls).catch((error) => {
        console.error(
          "DELETE /api/dashboard/engineering-spec-archives asset cleanup error:",
          error
        );
      });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(
      "DELETE /api/dashboard/engineering-spec-archives error:",
      error
    );
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error)
        ? "UPLOADS_NOT_CONFIGURED"
        : "ENGINEERING_SPEC_ARCHIVE_DELETE_FAILED"
    );
  }
}
