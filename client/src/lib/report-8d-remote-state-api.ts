import { apiFetch } from "./api";

export type EightDStage = "D0" | "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8";
export type Report8DOutputCutoff = EightDStage | "SIGNOFF";

export type EightDCaseStatus = "Open" | "Pending" | "Closed";

export type EightDReport = {
  reportId: string;
  reportTitle: string;
  issueSubject: string;
  currentStage: EightDStage;
  status: EightDCaseStatus;
  owner: string;
  lastUpdatedAt: string;
  archiveMonth: string;
  ossUrl: string;
};

export type Report8DHeaderFields = {
  reportTitle: string;
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

export type Report8DTeamMember = {
  id: string;
  name: string;
  department: string;
  role: string;
};

export type Report8DProblemItem = {
  id: string;
  label: string;
  value: string;
};

export type Report8DContainmentAction = {
  id: string;
  action: string;
  owner: string;
  date: string;
  status: "completed" | "in-progress" | "pending";
};

export type Report8DCorrectiveAction = {
  id: string;
  action: string;
  type: string;
  owner: string;
  targetDate: string;
};

export type Report8DVerificationRound = {
  id: string;
  verification: string;
  images: string[];
};

export type Report8DCorrectionRound = {
  id: string;
  correction: string;
  images: string[];
};

export type Report8DImplementationRound = {
  id: string;
  implementation: string;
  images: string[];
};

export type Report8DWorkspaceState = {
  module: "report-8d";
  workspaceKey: string;
  outputCutoff: Report8DOutputCutoff;
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

export const DEFAULT_REPORT_8D_WORKSPACE_KEY = "dashboard-report-8d-workspace";

type Report8DRemoteStateIdentity = {
  workspaceKey?: string;
  reportId?: string;
  ossUrl?: string;
  archiveMonth?: string;
};

function buildReport8DStateUrl({
  workspaceKey = DEFAULT_REPORT_8D_WORKSPACE_KEY,
  reportId,
  ossUrl,
  archiveMonth,
}: Report8DRemoteStateIdentity): string {
  const params = new URLSearchParams({ workspaceKey });
  if (reportId) {
    params.set("reportId", reportId);
  }
  if (ossUrl) {
    params.set("ossUrl", ossUrl);
  }
  if (archiveMonth) {
    params.set("archiveMonth", archiveMonth);
  }
  return `/api/dashboard/report-8d-state?${params.toString()}`;
}

function buildReport8DArchiveUrl({
  workspaceKey = DEFAULT_REPORT_8D_WORKSPACE_KEY,
  archiveMonth,
}: Report8DRemoteStateIdentity): string {
  const params = new URLSearchParams({ workspaceKey });
  if (archiveMonth) {
    params.set("archiveMonth", archiveMonth);
  }
  return `/api/dashboard/report-8d-archive?${params.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const message = (payload as { error?: unknown }).error;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export async function fetchReport8DRemoteWorkspaceState(
  identity: Report8DRemoteStateIdentity,
): Promise<Report8DWorkspaceState | null> {
  const response = await apiFetch(buildReport8DStateUrl(identity), {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { state?: Report8DWorkspaceState | null; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to load 8D report state"));
  }

  return payload?.state ?? null;
}

export async function saveReport8DRemoteWorkspaceState(
  state: Report8DWorkspaceState,
): Promise<{ updatedAt?: string; report?: EightDReport }> {
  const response = await apiFetch("/api/dashboard/report-8d-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  const payload = (await response.json().catch(() => null)) as
    | { updatedAt?: string; report?: EightDReport; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to save 8D report state"));
  }

  return {
    updatedAt: typeof payload?.updatedAt === "string" ? payload.updatedAt : undefined,
    report: payload?.report,
  };
}

export async function fetchReport8DArchiveReports(
  identity: Report8DRemoteStateIdentity,
): Promise<{ reports: EightDReport[]; archiveMonth?: string; limit?: number }> {
  const response = await apiFetch(buildReport8DArchiveUrl(identity), {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { reports?: EightDReport[]; archiveMonth?: string; limit?: number; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to load 8D archive reports"));
  }

  return {
    reports: Array.isArray(payload?.reports) ? payload.reports : [],
    archiveMonth: typeof payload?.archiveMonth === "string" ? payload.archiveMonth : undefined,
    limit: typeof payload?.limit === "number" ? payload.limit : undefined,
  };
}

export async function submitReport8DWorkspaceState({
  state,
  projectName,
}: {
  state: Report8DWorkspaceState;
  projectName: string;
}): Promise<{ submittedAt?: string; report?: EightDReport }> {
  const response = await apiFetch("/api/dashboard/report-8d-submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, projectName }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { submittedAt?: string; report?: EightDReport; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to submit 8D report"));
  }

  return {
    submittedAt: typeof payload?.submittedAt === "string" ? payload.submittedAt : undefined,
    report: payload?.report,
  };
}
