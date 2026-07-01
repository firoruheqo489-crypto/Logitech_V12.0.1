import { apiFetch } from "@/lib/api";

export interface EngineeringSpecArchiveProductInfo {
  sku: string;
  spu: string;
  type: string;
  description: string;
  department: string;
  productGroup: string;
  sampleQty: string;
  testDate: string;
}

export interface EngineeringSpecArchiveState {
  fileName: string;
  fileFingerprint?: string;
  contentFingerprint?: string;
  imageUrl?: string;
  qeConclusion?: string;
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
  productInfo: EngineeringSpecArchiveProductInfo;
  packaging: Array<{ label: string; value: string }>;
  businessMeta: Array<{ label: string; value: string }>;
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
}

export interface EngineeringSpecLedgerRecord {
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
  result: "合格" | "待完善";
  pendingCount: number;
  createdAt: string;
  ossUrl: string;
}

export interface EngineeringSpecArchiveDocumentSnapshot {
  document: EngineeringSpecLedgerRecord;
  state: EngineeringSpecArchiveState;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const message = (payload as { error?: unknown }).error;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function formatLedgerDateTime(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export async function listEngineeringSpecArchives(
  projectId: string
): Promise<EngineeringSpecLedgerRecord[]> {
  const params = new URLSearchParams({
    projectId: projectId.trim() || "default-engineering-spec-workspace",
  });
  const response = await apiFetch(
    `/api/dashboard/engineering-spec-archives?${params.toString()}`
  );
  const payload = (await response.json().catch(() => null)) as {
    documents?: EngineeringSpecLedgerRecord[];
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(
      readErrorMessage(payload, "Failed to load engineering spec ledger")
    );
  }

  return Array.isArray(payload?.documents) ? payload.documents : [];
}

export async function createEngineeringSpecArchive({
  projectId,
  state,
}: {
  projectId: string;
  state: EngineeringSpecArchiveState;
}): Promise<EngineeringSpecLedgerRecord> {
  const response = await apiFetch("/api/dashboard/engineering-spec-archives", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: projectId.trim() || "default-engineering-spec-workspace",
      state,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    document?: EngineeringSpecLedgerRecord;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(
      readErrorMessage(payload, "Failed to archive engineering spec")
    );
  }

  if (!payload?.document) {
    throw new Error(
      "Engineering spec archive response did not return a document"
    );
  }

  return payload.document;
}

export async function getEngineeringSpecArchiveDocumentState({
  projectId,
  documentId,
}: {
  projectId: string;
  documentId: string;
}): Promise<EngineeringSpecArchiveDocumentSnapshot> {
  const params = new URLSearchParams({
    projectId: projectId.trim() || "default-engineering-spec-workspace",
    documentId: documentId.trim(),
  });
  const response = await apiFetch(
    `/api/dashboard/engineering-spec-archives/document?${params.toString()}`
  );
  const payload = (await response.json().catch(() => null)) as {
    document?: EngineeringSpecLedgerRecord;
    state?: EngineeringSpecArchiveState;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(
      readErrorMessage(
        payload,
        "Failed to load engineering spec archive detail"
      )
    );
  }

  if (!payload?.document || !payload?.state) {
    throw new Error("Engineering spec archive detail response was incomplete");
  }

  return {
    document: payload.document,
    state: payload.state,
  };
}

export async function updateEngineeringSpecArchive({
  projectId,
  documentId,
  state,
}: {
  projectId: string;
  documentId: string;
  state: EngineeringSpecArchiveState;
}): Promise<EngineeringSpecLedgerRecord> {
  const response = await apiFetch("/api/dashboard/engineering-spec-archives", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: projectId.trim() || "default-engineering-spec-workspace",
      documentId: documentId.trim(),
      state,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    document?: EngineeringSpecLedgerRecord;
    error?: string;
  } | null;

  if (!response.ok || !payload?.document) {
    throw new Error(
      readErrorMessage(payload, "Failed to update engineering spec archive")
    );
  }

  return payload.document;
}

export async function deleteEngineeringSpecArchive({
  projectId,
  documentId,
}: {
  projectId: string;
  documentId: string;
}): Promise<void> {
  const params = new URLSearchParams({
    projectId: projectId.trim() || "default-engineering-spec-workspace",
    documentId: documentId.trim(),
  });
  const response = await apiFetch(
    `/api/dashboard/engineering-spec-archives?${params.toString()}`,
    {
      method: "DELETE",
    }
  );

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok) {
    throw new Error(
      readErrorMessage(payload, "Failed to delete engineering spec archive")
    );
  }
}
