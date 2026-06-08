import type { Request, Response } from "express";

import { sql as dbSql } from "../db.js";
import {
  buildAssetProxyUrl,
  deleteOssObject,
  getOssObjectBuffer,
  parseOssObjectKeyFromUrl,
  putOssObject,
} from "../lib/oss.js";

type Report8DStatus = "completed" | "in-progress" | "pending";
type EightDStage = "D0" | "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8";
type EightDCaseStatus = "Open" | "Pending" | "Closed";

type Report8DHeaderFields = {
  reportNo: string;
  finishedPartNumber: string;
  finishedPartName: string;
  finishedPartSpec: string;
  replyTo: string;
  abnormalPart: string;
  reportSubject: string;
  reportDate: string;
  projectModule: string;
  moldNumber: string;
  customer: string;
  product: string;
  defectIssue: string;
  dateOpened: string;
  currentStatus: string;
  champion: string;
};

type Report8DTeamMember = {
  id: string;
  name: string;
  department: string;
  role: string;
};

type Report8DProblemItem = {
  id: string;
  label: string;
  value: string;
};

type Report8DContainmentAction = {
  id: string;
  action: string;
  owner: string;
  date: string;
  status: Report8DStatus;
};

type Report8DCorrectiveAction = {
  id: string;
  action: string;
  type: string;
  owner: string;
  targetDate: string;
};

type Report8DVerificationRound = {
  id: string;
  verification: string;
  images: string[];
};

type Report8DCorrectionRound = {
  id: string;
  correction: string;
  images: string[];
};

type Report8DImplementationRound = {
  id: string;
  implementation: string;
  images: string[];
};

export type Report8DWorkspaceState = {
  module: "report-8d";
  workspaceKey: string;
  headerFields: Report8DHeaderFields;
  d0: {
    severityLabel: string;
    summary: string;
    containment: string;
  };
  teamMembers: Report8DTeamMember[];
  problemItems: Report8DProblemItem[];
  containmentActions: Report8DContainmentAction[];
  d4: {
    rootCauseAnalysis: string;
    verificationRounds: Report8DVerificationRound[];
  };
  d5: {
    correctivePlan: string;
    correctionRounds: Report8DCorrectionRound[];
  };
  correctiveActions: Report8DCorrectiveAction[];
  d6: {
    summary: string;
    implementationRounds: Report8DImplementationRound[];
    verificationItems: string[];
    verifiedStatus: string;
    verifiedAt: string;
  };
  d7: {
    systemUpdates: string[];
    rolloutNotes: string;
  };
  d8: {
    customerClosureDate: string;
    internalClosureDate: string;
    closureSummary: string;
    recognition: string;
  };
  updatedAt?: string;
};

export type EightDReport = {
  reportId: string;
  issueSubject: string;
  currentStage: EightDStage;
  status: EightDCaseStatus;
  owner: string;
  lastUpdatedAt: string;
  archiveMonth: string;
  ossUrl: string;
};

type Report8DRouteErrorCode =
  | "DATABASE_NOT_CONFIGURED"
  | "INVALID_REPORT_8D_ARCHIVE"
  | "REPORT_8D_ARCHIVE_LOAD_FAILED"
  | "INVALID_REPORT_8D_MODULE"
  | "REPORT_8D_SUBMIT_FAILED"
  | "REPORT_8D_STATE_DELETE_FAILED"
  | "REPORT_8D_STATE_LOAD_FAILED"
  | "REPORT_8D_STATE_SAVE_FAILED"
  | "UPLOADS_NOT_CONFIGURED";

const REPORT_8D_ROUTE_ERROR_MESSAGES: Record<Report8DRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: "Database not configured",
  INVALID_REPORT_8D_ARCHIVE: "Invalid 8D archive request",
  INVALID_REPORT_8D_MODULE: "module must be report-8d",
  REPORT_8D_ARCHIVE_LOAD_FAILED: "Failed to load 8D archive index",
  REPORT_8D_SUBMIT_FAILED: "Failed to submit 8D report",
  REPORT_8D_STATE_DELETE_FAILED: "Failed to delete 8D report state",
  REPORT_8D_STATE_LOAD_FAILED: "Failed to load 8D report state",
  REPORT_8D_STATE_SAVE_FAILED: "Failed to save 8D report state",
  UPLOADS_NOT_CONFIGURED: "Aliyun OSS is not configured",
};

const REPORT_8D_STATE_OBJECT_PREFIX = "files/dashboard-report-8d-states/v1";
const REPORT_8D_SUBMISSION_TABLE = "dashboard_report_8d_submissions";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ARCHIVE_MONTH_PATTERN = /^\d{4}-\d{2}$/;
const REPORT_8D_ARCHIVE_MONTH_LIMIT = 500;
const STATUS_SET = new Set<Report8DStatus>(["completed", "in-progress", "pending"]);
const EIGHT_D_STAGE_SET = new Set<EightDStage>(["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"]);
const EIGHT_D_CASE_STATUS_SET = new Set<EightDCaseStatus>(["Open", "Pending", "Closed"]);
export const DEFAULT_REPORT_8D_WORKSPACE_KEY = "dashboard-report-8d-workspace";

let dashboardReport8DSubmissionTableReady: Promise<void> | null = null;

function applyNoStoreHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function sendReport8DRouteError(res: Response, status: number, code: Report8DRouteErrorCode): void {
  res.status(status).json({
    error: REPORT_8D_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

export function ensureDashboardReport8DSubmissionTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardReport8DSubmissionTableReady) {
    dashboardReport8DSubmissionTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${REPORT_8D_SUBMISSION_TABLE} (
          id BIGSERIAL PRIMARY KEY,
          workspace_key VARCHAR(160) NOT NULL,
          report_id VARCHAR(160) NOT NULL,
          project_name VARCHAR(255) NOT NULL DEFAULT '',
          issue_subject TEXT NOT NULL DEFAULT '',
          current_stage VARCHAR(8) NOT NULL DEFAULT 'D0',
          status VARCHAR(20) NOT NULL DEFAULT 'Pending',
          owner VARCHAR(160) NOT NULL DEFAULT '',
          archive_month VARCHAR(7) NOT NULL DEFAULT '',
          oss_url TEXT NOT NULL DEFAULT '',
          payload_json JSONB NOT NULL,
          submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (workspace_key, report_id)
        )
      `);
      await dbSql.unsafe(`
        CREATE INDEX IF NOT EXISTS ${REPORT_8D_SUBMISSION_TABLE}_workspace_month_idx
        ON ${REPORT_8D_SUBMISSION_TABLE} (workspace_key, archive_month, updated_at DESC)
      `);
    })();
  }
  return dashboardReport8DSubmissionTableReady;
}

function normalizeText(value: unknown, maxLength: number, fallback = ""): string {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function normalizeWorkspaceSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 120);

  return sanitized || "workspace";
}

function normalizeIsoDate(value: unknown): string {
  const text = normalizeText(value, 10);
  return ISO_DATE_PATTERN.test(text) ? text : "";
}

function formatArchiveMonth(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeArchiveMonth(value: unknown, fallback = formatArchiveMonth()): string {
  const text = normalizeText(value, 7);
  return ARCHIVE_MONTH_PATTERN.test(text) ? text : fallback;
}

function readWorkspaceKey(source: Request["query"] | Record<string, unknown>): string {
  return normalizeText(source.workspaceKey, 120, DEFAULT_REPORT_8D_WORKSPACE_KEY);
}

function buildStateObjectKey(workspaceKey: string, reportId?: string): string {
  const workspaceSegment = normalizeWorkspaceSegment(workspaceKey);
  if (reportId) {
    return `${REPORT_8D_STATE_OBJECT_PREFIX}/${workspaceSegment}/drafts/${normalizeWorkspaceSegment(reportId)}.json`;
  }

  return `${REPORT_8D_STATE_OBJECT_PREFIX}/${workspaceSegment}.json`;
}

function buildArchiveIndexObjectKey(workspaceKey: string, archiveMonth: string): string {
  return `${REPORT_8D_STATE_OBJECT_PREFIX}/${normalizeWorkspaceSegment(workspaceKey)}/${normalizeArchiveMonth(archiveMonth)}/index.json`;
}

function buildArchiveCaseObjectKey(workspaceKey: string, archiveMonth: string, reportId: string): string {
  return `${REPORT_8D_STATE_OBJECT_PREFIX}/${normalizeWorkspaceSegment(workspaceKey)}/${normalizeArchiveMonth(archiveMonth)}/cases/${normalizeWorkspaceSegment(reportId)}.json`;
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

function sanitizeStatus(value: unknown): Report8DStatus {
  const normalized = normalizeText(value, 20, "pending").toLowerCase() as Report8DStatus;
  return STATUS_SET.has(normalized) ? normalized : "pending";
}

function sanitizeEightDStage(value: unknown): EightDStage {
  const normalized = normalizeText(value, 2, "D0").toUpperCase() as EightDStage;
  return EIGHT_D_STAGE_SET.has(normalized) ? normalized : "D0";
}

function sanitizeEightDCaseStatus(value: unknown): EightDCaseStatus {
  const normalized = normalizeText(value, 20, "Open");
  return EIGHT_D_CASE_STATUS_SET.has(normalized as EightDCaseStatus)
    ? (normalized as EightDCaseStatus)
    : "Open";
}

function readReportId(source: Request["query"] | Record<string, unknown>): string {
  return normalizeText(source.reportId, 120);
}

function readOssUrl(source: Request["query"] | Record<string, unknown>): string {
  return normalizeText(source.ossUrl, 1024);
}

function readArchiveMonth(source: Request["query"] | Record<string, unknown>): string {
  return normalizeArchiveMonth(source.archiveMonth);
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeHeaderFields(value: unknown): Report8DHeaderFields {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return {
    reportNo: normalizeText(record.reportNo, 120),
    finishedPartNumber: normalizeText(record.finishedPartNumber, 255, normalizeText(record.moldNumber, 255)),
    finishedPartName: normalizeText(record.finishedPartName, 255, normalizeText(record.product, 255)),
    finishedPartSpec: normalizeText(record.finishedPartSpec, 255),
    replyTo: normalizeText(record.replyTo, 255, normalizeText(record.customer, 255)),
    abnormalPart: normalizeText(record.abnormalPart, 255, normalizeText(record.moldNumber, 255)),
    reportSubject: normalizeText(record.reportSubject, 4000, normalizeText(record.defectIssue, 4000)),
    reportDate: normalizeIsoDate(record.reportDate) || normalizeIsoDate(record.dateOpened),
    projectModule: normalizeText(record.projectModule, 255),
    moldNumber: normalizeText(record.moldNumber, 255),
    customer: normalizeText(record.customer, 255),
    product: normalizeText(record.product, 255),
    defectIssue: normalizeText(record.defectIssue, 4000),
    dateOpened: normalizeIsoDate(record.dateOpened),
    currentStatus: normalizeText(record.currentStatus, 255),
    champion: normalizeText(record.champion, 255),
  };
}

function sanitizeTeamMembers(value: unknown): Report8DTeamMember[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 20).map((item, index) => {
    const record = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};

    return {
      id: normalizeText(record.id, 120, `team-member-${index + 1}`),
      name: normalizeText(record.name, 120),
      department: normalizeText(record.department, 120),
      role: normalizeText(record.role, 255),
    };
  });
}

function sanitizeProblemItems(value: unknown): Report8DProblemItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 20).map((item, index) => {
    const record = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};

    return {
      id: normalizeText(record.id, 120, `problem-item-${index + 1}`),
      label: normalizeText(record.label, 120),
      value: normalizeText(record.value, 4000),
    };
  });
}

function sanitizeContainmentActions(value: unknown): Report8DContainmentAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 40).map((item, index) => {
    const record = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};

    return {
      id: normalizeText(record.id, 120, `containment-action-${index + 1}`),
      action: normalizeText(record.action, 4000),
      owner: normalizeText(record.owner, 120),
      date: normalizeIsoDate(record.date),
      status: sanitizeStatus(record.status),
    };
  });
}

function sanitizeCorrectiveActions(value: unknown): Report8DCorrectiveAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 40).map((item, index) => {
    const record = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};

    return {
      id: normalizeText(record.id, 120, `corrective-action-${index + 1}`),
      action: normalizeText(record.action, 4000),
      type: normalizeText(record.type, 255),
      owner: normalizeText(record.owner, 120),
      targetDate: normalizeIsoDate(record.targetDate),
    };
  });
}

function sanitizeVerificationRounds(
  value: unknown,
  legacyRootCauses?: unknown,
  legacyVerification?: unknown,
): Report8DVerificationRound[] {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item, index) => {
      const record = item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};

      return {
        id: normalizeText(record.id, 120, `verification-round-${index + 1}`),
        verification: normalizeText(record.verification, 4000),
        images: sanitizeStringArray(record.images, 10, 2048),
      };
    });
  }

  if (Array.isArray(legacyRootCauses)) {
    return legacyRootCauses.slice(0, 20).map((item, index) => {
      const record = item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};

      return {
        id: normalizeText(record.id, 120, `verification-round-${index + 1}`),
        verification: normalizeText(record.verification, 4000),
        images: sanitizeStringArray(record.images, 10, 2048),
      };
    }).filter((item) => item.verification || item.images.length > 0);
  }

  const verification = normalizeText(legacyVerification, 4000);
  if (!verification) {
    return [];
  }

  return [{
    id: "verification-round-1",
    verification,
    images: [],
  }];
}

function formatLegacyCorrectivePlan(value: unknown): string {
  const legacyActions = sanitizeCorrectiveActions(value);
  if (legacyActions.length === 0) {
    return "";
  }

  return legacyActions
    .map((item, index) => {
      const parts = [
        item.action,
        item.type ? `类型：${item.type}` : "",
        item.owner ? `责任人：${item.owner}` : "",
        item.targetDate ? `目标日期：${item.targetDate}` : "",
      ].filter(Boolean);
      return `${index + 1}. ${parts.join("；")}`;
    })
    .join("\n");
}

function sanitizeCorrectionRounds(value: unknown): Report8DCorrectionRound[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 20).map((item, index) => {
    const record = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};

    return {
      id: normalizeText(record.id, 120, `correction-round-${index + 1}`),
      correction: normalizeText(record.correction, 4000),
      images: sanitizeStringArray(record.images, 10, 2048),
    };
  });
}

function sanitizeImplementationRounds(value: unknown, legacyVerificationItems?: unknown): Report8DImplementationRound[] {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item, index) => {
      const record = item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};

      return {
        id: normalizeText(record.id, 120, `implementation-round-${index + 1}`),
        implementation: normalizeText(record.implementation, 4000),
        images: sanitizeStringArray(record.images, 10, 2048),
      };
    });
  }

  return sanitizeStringArray(legacyVerificationItems, 20, 4000).map((item, index) => ({
    id: `implementation-round-${index + 1}`,
    implementation: item,
    images: [],
  }));
}

function sanitizeWorkspaceState(value: unknown, workspaceKey: string): Report8DWorkspaceState {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const d0 = record.d0 && typeof record.d0 === "object" && !Array.isArray(record.d0)
    ? (record.d0 as Record<string, unknown>)
    : {};
  const d4 = record.d4 && typeof record.d4 === "object" && !Array.isArray(record.d4)
    ? (record.d4 as Record<string, unknown>)
    : {};
  const d5 = record.d5 && typeof record.d5 === "object" && !Array.isArray(record.d5)
    ? (record.d5 as Record<string, unknown>)
    : {};
  const d6 = record.d6 && typeof record.d6 === "object" && !Array.isArray(record.d6)
    ? (record.d6 as Record<string, unknown>)
    : {};
  const d7 = record.d7 && typeof record.d7 === "object" && !Array.isArray(record.d7)
    ? (record.d7 as Record<string, unknown>)
    : {};
  const d8 = record.d8 && typeof record.d8 === "object" && !Array.isArray(record.d8)
    ? (record.d8 as Record<string, unknown>)
    : {};

  return {
    module: "report-8d",
    workspaceKey,
    headerFields: sanitizeHeaderFields(record.headerFields),
    d0: {
      severityLabel: normalizeText(d0.severityLabel, 120),
      summary: normalizeText(d0.summary, 4000),
      containment: normalizeText(d0.containment, 4000),
    },
    teamMembers: sanitizeTeamMembers(record.teamMembers),
    problemItems: sanitizeProblemItems(record.problemItems),
    containmentActions: sanitizeContainmentActions(record.containmentActions),
    d4: {
      rootCauseAnalysis: normalizeText(
        d4.rootCauseAnalysis,
        12000,
        Array.isArray(d4.rootCauses)
          ? d4.rootCauses
            .map((item) => {
              const record = item && typeof item === "object" && !Array.isArray(item)
                ? (item as Record<string, unknown>)
                : {};
              return normalizeText(record.cause, 4000);
            })
            .filter(Boolean)
            .join("\n\n")
          : normalizeText(d4.occurrence, 12000),
      ),
      verificationRounds: sanitizeVerificationRounds(d4.verificationRounds, d4.rootCauses, d4.escape),
    },
    d5: {
      correctivePlan: normalizeText(d5.correctivePlan, 12000, formatLegacyCorrectivePlan(record.correctiveActions)),
      correctionRounds: sanitizeCorrectionRounds(d5.correctionRounds),
    },
    correctiveActions: sanitizeCorrectiveActions(record.correctiveActions),
    d6: {
      summary: normalizeText(d6.summary, 4000),
      implementationRounds: sanitizeImplementationRounds(d6.implementationRounds, d6.verificationItems),
      verificationItems: sanitizeStringArray(d6.verificationItems, 20, 4000),
      verifiedStatus: normalizeText(d6.verifiedStatus, 255),
      verifiedAt: normalizeIsoDate(d6.verifiedAt),
    },
    d7: {
      systemUpdates: sanitizeStringArray(d7.systemUpdates, 20, 255),
      rolloutNotes: normalizeText(d7.rolloutNotes, 4000),
    },
    d8: {
      customerClosureDate: normalizeIsoDate(d8.customerClosureDate),
      internalClosureDate: normalizeIsoDate(d8.internalClosureDate),
      closureSummary: normalizeText(d8.closureSummary, 4000),
      recognition: normalizeText(d8.recognition, 4000),
    },
  };
}

function readStoredState(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as { state?: unknown };
  return record.state ?? payload;
}

function readStoredUpdatedAt(payload: unknown): string {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? normalizeText((payload as Record<string, unknown>).updatedAt, 64)
    : "";
}

function extractStageFromState(state: Report8DWorkspaceState): EightDStage {
  const rawStage = [state.headerFields.currentStatus, state.d6.verifiedStatus, state.d8.closureSummary]
    .join(" ")
    .match(/\bD[0-8]\b/i)?.[0]
    .toUpperCase();

  return sanitizeEightDStage(rawStage);
}

function extractCaseStatusFromState(state: Report8DWorkspaceState): EightDCaseStatus {
  const text = [
    state.headerFields.currentStatus,
    state.d6.verifiedStatus,
  ].join(" ").toLowerCase();

  if (extractStageFromState(state) === "D8" || text.includes("closed") || text.includes("已关闭")) {
    return "Closed";
  }

  if (text.includes("pending") || text.includes("待")) {
    return "Pending";
  }

  return "Open";
}

function extractArchiveMonthFromState(state: Report8DWorkspaceState): string {
  const openedMonth = normalizeText(state.headerFields.reportDate || state.headerFields.dateOpened, 7);
  if (ARCHIVE_MONTH_PATTERN.test(openedMonth)) {
    return openedMonth;
  }

  const reportMonth = normalizeText(state.headerFields.reportNo, 20).match(/20\d{2}[-]?\d{2}/)?.[0];
  if (reportMonth) {
    const normalized = reportMonth.includes("-")
      ? reportMonth
      : `${reportMonth.slice(0, 4)}-${reportMonth.slice(4, 6)}`;
    return normalizeArchiveMonth(normalized);
  }

  return formatArchiveMonth();
}

function sanitizeArchiveReport(value: unknown): EightDReport | null {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const reportId = normalizeText(record.reportId, 120);
  const ossUrl = normalizeText(record.ossUrl, 1024);

  if (!reportId || !ossUrl) {
    return null;
  }

  return {
    reportId,
    issueSubject: normalizeText(record.issueSubject, 400, reportId),
    currentStage: sanitizeEightDStage(record.currentStage),
    status: sanitizeEightDCaseStatus(record.status),
    owner: normalizeText(record.owner, 120, "未指定"),
    lastUpdatedAt: normalizeText(record.lastUpdatedAt, 64),
    archiveMonth: normalizeArchiveMonth(record.archiveMonth),
    ossUrl,
  };
}

function buildArchiveReportFromState(
  state: Report8DWorkspaceState,
  workspaceKey: string,
  updatedAt: string,
): EightDReport {
  const reportId = normalizeText(state.headerFields.reportNo, 120, `8D-${Date.now()}`);
  const archiveMonth = extractArchiveMonthFromState(state);
  const objectKey = buildArchiveCaseObjectKey(workspaceKey, archiveMonth, reportId);

  return {
    reportId,
    issueSubject: normalizeText(state.headerFields.reportSubject || state.headerFields.defectIssue, 400, reportId),
    currentStage: extractStageFromState(state),
    status: extractCaseStatusFromState(state),
    owner: normalizeText(state.headerFields.champion, 120, "未指定"),
    lastUpdatedAt: updatedAt,
    archiveMonth,
    ossUrl: buildAssetProxyUrl(objectKey),
  };
}

function sortArchiveReports(reports: EightDReport[]): EightDReport[] {
  return [...reports].sort((left, right) => {
    const leftTime = Date.parse(left.lastUpdatedAt);
    const rightTime = Date.parse(right.lastUpdatedAt);
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

async function readArchiveIndex(workspaceKey: string, archiveMonth: string): Promise<EightDReport[]> {
  try {
    const buffer = await getOssObjectBuffer(buildArchiveIndexObjectKey(workspaceKey, archiveMonth));
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const reports = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).reports
      : parsed;

    if (!Array.isArray(reports)) {
      return [];
    }

    return sortArchiveReports(reports.map(sanitizeArchiveReport).filter(Boolean) as EightDReport[]);
  } catch (error) {
    if (isOssNotFoundError(error)) {
      return [];
    }

    throw error;
  }
}

async function writeArchiveIndex(workspaceKey: string, archiveMonth: string, reports: EightDReport[]): Promise<void> {
  await putOssObject({
    objectKey: buildArchiveIndexObjectKey(workspaceKey, archiveMonth),
    body: Buffer.from(
      JSON.stringify({
        reports: sortArchiveReports(reports).slice(0, REPORT_8D_ARCHIVE_MONTH_LIMIT),
        archiveMonth,
        limit: REPORT_8D_ARCHIVE_MONTH_LIMIT,
        updatedAt: new Date().toISOString(),
      }, null, 2),
      "utf8",
    ),
    mimeType: "application/json; charset=utf-8",
  });
}

async function upsertArchiveIndexReport(workspaceKey: string, report: EightDReport): Promise<EightDReport[]> {
  const archiveMonth = normalizeArchiveMonth(report.archiveMonth);
  const reports = await readArchiveIndex(workspaceKey, archiveMonth);
  const nextReports = [
    report,
    ...reports.filter((item) => item.reportId !== report.reportId),
  ];
  const limitedReports = sortArchiveReports(nextReports).slice(0, REPORT_8D_ARCHIVE_MONTH_LIMIT);
  await writeArchiveIndex(workspaceKey, archiveMonth, limitedReports);
  return limitedReports;
}

function resolveArchiveObjectKey(workspaceKey: string, archiveMonth: string, reportId: string, ossUrl: string): string {
  const workspaceSegment = normalizeWorkspaceSegment(workspaceKey);

  const parsedObjectKey = parseOssObjectKeyFromUrl(ossUrl);
  const allowedPrefix = `${REPORT_8D_STATE_OBJECT_PREFIX}/${workspaceSegment}/`;
  if (parsedObjectKey) {
    if (!parsedObjectKey.startsWith(allowedPrefix)) {
      throw new Error("Invalid 8D archive object key");
    }
    return parsedObjectKey;
  }

  if (reportId) {
    return buildArchiveCaseObjectKey(workspaceKey, archiveMonth, reportId);
  }

  throw new Error("Invalid 8D archive object key");
}

async function persistReport8DStateToOss(
  workspaceKey: string,
  state: Report8DWorkspaceState,
): Promise<{ updatedAt: string; archiveReport: EightDReport; serializedState: Buffer }> {
  const updatedAt = new Date().toISOString();
  const archiveReport = buildArchiveReportFromState(state, workspaceKey, updatedAt);
  const serializedState = Buffer.from(
    JSON.stringify({
      state,
      updatedAt,
    }, null, 2),
    "utf8",
  );

  await Promise.all([
    putOssObject({
      objectKey: buildStateObjectKey(workspaceKey),
      body: serializedState,
      mimeType: "application/json; charset=utf-8",
    }),
    putOssObject({
      objectKey: buildStateObjectKey(workspaceKey, archiveReport.reportId),
      body: serializedState,
      mimeType: "application/json; charset=utf-8",
    }),
    putOssObject({
      objectKey: buildArchiveCaseObjectKey(workspaceKey, archiveReport.archiveMonth, archiveReport.reportId),
      body: serializedState,
      mimeType: "application/json; charset=utf-8",
    }),
  ]);
  await upsertArchiveIndexReport(workspaceKey, archiveReport);

  return { updatedAt, archiveReport, serializedState };
}

export async function getDashboardReport8DState(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);
  const workspaceKey = readWorkspaceKey(req.query);
  const reportId = readReportId(req.query);
  const ossUrl = readOssUrl(req.query);
  const archiveMonth = readArchiveMonth(req.query);

  try {
    let objectKey = buildStateObjectKey(workspaceKey);
    if (reportId) {
      objectKey = buildStateObjectKey(workspaceKey, reportId);
      try {
        const draftBuffer = await getOssObjectBuffer(objectKey);
        const parsedDraft = JSON.parse(draftBuffer.toString("utf8")) as unknown;
        const storedDraft = sanitizeWorkspaceState(readStoredState(parsedDraft), workspaceKey);
        res.status(200).json({
          state: {
            ...storedDraft,
            updatedAt: readStoredUpdatedAt(parsedDraft),
          },
        });
        return;
      } catch (draftError) {
        if (!isOssNotFoundError(draftError)) {
          throw draftError;
        }

        objectKey = resolveArchiveObjectKey(workspaceKey, archiveMonth, reportId, ossUrl);
      }
    } else if (ossUrl) {
      objectKey = resolveArchiveObjectKey(workspaceKey, archiveMonth, reportId, ossUrl);
    }

    const buffer = await getOssObjectBuffer(objectKey);
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const storedState = sanitizeWorkspaceState(readStoredState(parsed), workspaceKey);
    res.status(200).json({
      state: {
        ...storedState,
        updatedAt: readStoredUpdatedAt(parsed),
      },
    });
  } catch (error) {
    if (isOssNotFoundError(error)) {
      res.status(200).json({ state: null });
      return;
    }

    sendReport8DRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "REPORT_8D_STATE_LOAD_FAILED",
    );
  }
}

export async function upsertDashboardReport8DState(req: Request, res: Response): Promise<void> {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {};

  if (body.module !== "report-8d") {
    sendReport8DRouteError(res, 400, "INVALID_REPORT_8D_MODULE");
    return;
  }

  const workspaceKey = readWorkspaceKey(body);
  const sanitizedState = sanitizeWorkspaceState(body, workspaceKey);

  try {
    const { updatedAt, archiveReport } = await persistReport8DStateToOss(workspaceKey, sanitizedState);

    res.status(200).json({ ok: true, updatedAt, report: archiveReport });
  } catch (error) {
    sendReport8DRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "REPORT_8D_STATE_SAVE_FAILED",
    );
  }
}

export async function listDashboardReport8DArchive(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);
  const workspaceKey = readWorkspaceKey(req.query);
  const archiveMonth = readArchiveMonth(req.query);

  try {
    const reports = await readArchiveIndex(workspaceKey, archiveMonth);
    res.status(200).json({ reports, archiveMonth, limit: REPORT_8D_ARCHIVE_MONTH_LIMIT });
  } catch (error) {
    sendReport8DRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "REPORT_8D_ARCHIVE_LOAD_FAILED",
    );
  }
}

export async function submitDashboardReport8DState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendReport8DRouteError(res, 503, "DATABASE_NOT_CONFIGURED");
    return;
  }

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {};
  const rawState = body.state && typeof body.state === "object" && !Array.isArray(body.state)
    ? (body.state as Record<string, unknown>)
    : body;

  if (rawState.module !== "report-8d") {
    sendReport8DRouteError(res, 400, "INVALID_REPORT_8D_MODULE");
    return;
  }

  const workspaceKey = readWorkspaceKey(rawState);
  const projectName = normalizeText(body.projectName, 255);
  const sanitizedState = sanitizeWorkspaceState(rawState, workspaceKey);

  try {
    await ensureDashboardReport8DSubmissionTable();
    const { archiveReport } = await persistReport8DStateToOss(workspaceKey, sanitizedState);
    const submittedAt = new Date().toISOString();

    await dbSql.unsafe(
      `
        INSERT INTO ${REPORT_8D_SUBMISSION_TABLE} (
          workspace_key,
          report_id,
          project_name,
          issue_subject,
          current_stage,
          status,
          owner,
          archive_month,
          oss_url,
          payload_json,
          submitted_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW(), NOW())
        ON CONFLICT (workspace_key, report_id)
        DO UPDATE SET
          project_name = EXCLUDED.project_name,
          issue_subject = EXCLUDED.issue_subject,
          current_stage = EXCLUDED.current_stage,
          status = EXCLUDED.status,
          owner = EXCLUDED.owner,
          archive_month = EXCLUDED.archive_month,
          oss_url = EXCLUDED.oss_url,
          payload_json = EXCLUDED.payload_json,
          submitted_at = NOW(),
          updated_at = NOW()
      `,
      [
        workspaceKey,
        archiveReport.reportId,
        projectName,
        archiveReport.issueSubject,
        archiveReport.currentStage,
        archiveReport.status,
        archiveReport.owner,
        archiveReport.archiveMonth,
        archiveReport.ossUrl,
        JSON.stringify(sanitizedState),
      ],
    );

    res.status(200).json({
      ok: true,
      submittedAt,
      report: archiveReport,
    });
  } catch (error) {
    console.error("POST /api/dashboard/report-8d-submit error:", error);
    sendReport8DRouteError(res, 500, "REPORT_8D_SUBMIT_FAILED");
  }
}

export async function deleteDashboardReport8DState(req: Request, res: Response): Promise<void> {
  const workspaceKey = readWorkspaceKey(req.query);

  try {
    await deleteOssObject(buildStateObjectKey(workspaceKey));
    res.status(200).json({ ok: true });
  } catch (error) {
    if (isOssNotFoundError(error)) {
      res.status(200).json({ ok: true });
      return;
    }

    sendReport8DRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? "UPLOADS_NOT_CONFIGURED" : "REPORT_8D_STATE_DELETE_FAILED",
    );
  }
}
