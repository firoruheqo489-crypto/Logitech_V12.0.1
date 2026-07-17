import { apiFetch } from "@/lib/api"
import type {
  LaboratoryExportGate,
  LaboratoryModuleSummary,
  LaboratoryOverallAdjudication,
  LaboratoryReportMeta,
} from "@/pages/dashboard/components/laboratory/laboratory-contract"

export type LaboratoryArchiveSpecHeader = {
  productManager: string
  structuralEngineer: string
  electronicEngineer: string
  testType: string
  sampleDeliveryDate: string
}

export type LaboratoryArchiveState = {
  reportMeta: LaboratoryReportMeta
  specHeader?: LaboratoryArchiveSpecHeader
  selectedSpecId?: string
  selectedSpecSequence?: number
  selectedSpecLabel?: string
  moduleSummaries: LaboratoryModuleSummary[]
  overallAdjudication?: LaboratoryOverallAdjudication
  exportGate?: LaboratoryExportGate
  workspaceDraft?: {
    nodes: Array<{ id: number; type: string | null; isConfirmed: boolean }>
    draftSelections: Record<number, string>
    nodeSummaries: Record<number, LaboratoryModuleSummary>
  }
  imageUrl?: string
}

export type LaboratoryArchiveRecord = {
  id: string
  projectId: string
  sequence: number
  reportNo: string
  projectName: string
  sampleName: string
  sampleNo: string
  sampleType?: string
  specSequence?: number
  testDate: string
  verdict: string
  moduleCount: number
  printableModuleCount: number
  selectedSpecLabel?: string
  createdAt: string
  ossUrl: string
  imageUrl?: string
}

export type LaboratoryArchiveSnapshot = {
  document: LaboratoryArchiveRecord
  state: LaboratoryArchiveState
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback
  const message = (payload as { error?: unknown }).error
  return typeof message === "string" && message.trim() ? message : fallback
}

export function formatLaboratoryArchiveDateTime(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return ""

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export async function listLaboratoryArchives(projectId: string): Promise<LaboratoryArchiveRecord[]> {
  const params = new URLSearchParams({
    projectId: projectId.trim() || "default-laboratory-workspace",
  })
  const response = await apiFetch(`/api/dashboard/laboratory-archives?${params.toString()}`)
  const payload = (await response.json().catch(() => null)) as {
    documents?: LaboratoryArchiveRecord[]
    error?: string
  } | null

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to load laboratory archives"))
  }

  return Array.isArray(payload?.documents) ? payload.documents : []
}

export async function createLaboratoryArchive({
  projectId,
  state,
}: {
  projectId: string
  state: LaboratoryArchiveState
}): Promise<LaboratoryArchiveRecord> {
  const response = await apiFetch("/api/dashboard/laboratory-archives", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: projectId.trim() || "default-laboratory-workspace",
      state,
    }),
  })
  const payload = (await response.json().catch(() => null)) as {
    document?: LaboratoryArchiveRecord
    error?: string
  } | null

  if (!response.ok || !payload?.document) {
    throw new Error(readErrorMessage(payload, "Failed to create laboratory archive"))
  }

  return payload.document
}

export async function getLaboratoryArchiveDocument({
  projectId,
  documentId,
}: {
  projectId: string
  documentId: string
}): Promise<LaboratoryArchiveSnapshot> {
  const params = new URLSearchParams({
    projectId: projectId.trim() || "default-laboratory-workspace",
    documentId: documentId.trim(),
  })
  const response = await apiFetch(`/api/dashboard/laboratory-archives/document?${params.toString()}`)
  const payload = (await response.json().catch(() => null)) as {
    document?: LaboratoryArchiveRecord
    state?: LaboratoryArchiveState
    error?: string
  } | null

  if (!response.ok || !payload?.document || !payload?.state) {
    throw new Error(readErrorMessage(payload, "Failed to load laboratory archive detail"))
  }

  return {
    document: payload.document,
    state: payload.state,
  }
}

export async function deleteLaboratoryArchive({
  projectId,
  documentId,
}: {
  projectId: string
  documentId: string
}): Promise<void> {
  const params = new URLSearchParams({
    projectId: projectId.trim() || "default-laboratory-workspace",
    documentId: documentId.trim(),
  })
  const response = await apiFetch(`/api/dashboard/laboratory-archives?${params.toString()}`, {
    method: "DELETE",
  })
  const payload = (await response.json().catch(() => null)) as { error?: string } | null

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Failed to delete laboratory archive"))
  }
}
