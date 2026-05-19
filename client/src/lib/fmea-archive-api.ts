import { apiFetch } from "./api"
import type {
  FmeaRemoteModule,
  FmeaRemoteWorkspaceState,
} from "./fmea-remote-state-api"

export interface FmeaDocument {
  id: string
  projectId: string
  version: string
  createdAt: string
  ossUrl: string
  isCurrent: boolean
}

type FmeaArchiveIdentity = {
  module: FmeaRemoteModule
  projectId: string
  workspaceKey?: string
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback
  }

  const message = (payload as { error?: unknown }).error
  return typeof message === "string" && message.trim() ? message : fallback
}

function buildArchiveUrl(identity: FmeaArchiveIdentity & { documentId?: string }): string {
  const params = new URLSearchParams({
    module: identity.module,
    projectId: identity.projectId,
  })

  if (identity.workspaceKey) {
    params.set("workspaceKey", identity.workspaceKey)
  }

  if (identity.documentId) {
    params.set("documentId", identity.documentId)
  }

  return `/api/dashboard/fmea-archives?${params.toString()}`
}

function buildArchiveDocumentUrl(identity: FmeaArchiveIdentity & { documentId: string }): string {
  const params = new URLSearchParams({
    module: identity.module,
    projectId: identity.projectId,
    documentId: identity.documentId,
  })

  return `/api/dashboard/fmea-archives/document?${params.toString()}`
}

export async function listFmeaArchiveDocuments(
  identity: FmeaArchiveIdentity,
): Promise<FmeaDocument[]> {
  const response = await apiFetch(buildArchiveUrl(identity), {
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as
    | { documents?: FmeaDocument[]; error?: string }
    | null

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to load FMEA archive versions"))
  }

  return Array.isArray(payload?.documents) ? payload.documents : []
}

export async function getFmeaArchiveDocumentState<TState extends FmeaRemoteWorkspaceState>(
  identity: FmeaArchiveIdentity & { documentId: string },
): Promise<{ document: FmeaDocument; state: TState }> {
  const response = await apiFetch(buildArchiveDocumentUrl(identity), {
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as
    | { document?: FmeaDocument; state?: TState; error?: string }
    | null

  if (!response.ok || !payload?.document || !payload?.state) {
    throw new Error(readErrorMessage(payload, "Failed to load FMEA archive content"))
  }

  return {
    document: payload.document,
    state: payload.state,
  }
}

export async function saveFmeaArchiveVersion<TState extends FmeaRemoteWorkspaceState>(
  input: FmeaArchiveIdentity & {
    version: string
    state: TState
  },
): Promise<FmeaDocument> {
  const response = await apiFetch("/api/dashboard/fmea-archives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => null)) as
    | { document?: FmeaDocument; error?: string }
    | null

  if (!response.ok || !payload?.document) {
    throw new Error(readErrorMessage(payload, "Failed to save FMEA archive version"))
  }

  return payload.document
}

export async function deleteFmeaArchiveVersion(
  identity: FmeaArchiveIdentity & { documentId: string },
): Promise<void> {
  const response = await apiFetch(buildArchiveUrl(identity), {
    method: "DELETE",
  })
  const payload = (await response.json().catch(() => null)) as { error?: string } | null

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to delete FMEA archive version"))
  }
}
