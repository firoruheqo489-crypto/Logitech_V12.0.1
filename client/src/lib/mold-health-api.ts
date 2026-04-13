import { apiFetch } from "./api"
import {
  DIAGNOSIS_CONFIG,
  type Diagnosis,
  type EventType,
  type MoldAssetInfo,
  type MoldHealthEvent,
} from "./mold-health-types"

export type MoldRepairAction =
  | "WEAR_PART_CLEAN_POLISH"
  | "INSERT_REPLACEMENT_LOCAL_REFIT"
  | "WELDING_MAJOR_MACHINING"

export interface MoldMaintenanceCreateInput {
  moldNo?: string | null
  type: EventType
  repairAction: MoldRepairAction
  occurredAt?: string | Date | null
  currentShots: number
  symptom: string
  diagnosis: string
  procedure: string
  downtimeHours: number
  recoveryRating: number
  operator: string
  cost: number
  imageUrl?: string | null
  estimatedCompletion?: string | Date | null
}

export interface MoldTelemetryTimelineEntry {
  id: string
  type: EventType
  currentShots: number
}

export interface MoldTelemetryStats {
  sicknessCount: number
  surgeryCount: number
  checkupCount: number
  totalDowntimeHours: number
  totalCostCny: number
  avgRecoveryRating: number
  mtbfDays: number
}

export interface MoldTelemetrySnapshot {
  asset: MoldAssetInfo
  stats: MoldTelemetryStats
  events: MoldHealthEvent[]
  timeline: MoldTelemetryTimelineEntry[]
}

type RawTelemetryAsset = {
  moldId?: unknown
  moldNo?: unknown
  designLife?: unknown
  currentShots?: unknown
}

type RawTelemetryStats = {
  healthScore?: unknown
  currentReliability?: unknown
  nextPmDate?: unknown
  sicknessCount?: unknown
  surgeryCount?: unknown
  checkupCount?: unknown
  totalDowntimeHours?: unknown
  totalCost?: unknown
  avgRecoveryRating?: unknown
  mtbfDays?: unknown
}

type RawTelemetryEvent = {
  id?: unknown
  type?: unknown
  repairAction?: unknown
  occurredAt?: unknown
  currentShots?: unknown
  symptom?: unknown
  diagnosis?: unknown
  procedure?: unknown
  operator?: unknown
  downtimeHours?: unknown
  recoveryRating?: unknown
  cost?: unknown
}

type RawTelemetryPayload = {
  asset?: RawTelemetryAsset
  stats?: RawTelemetryStats
  events?: RawTelemetryEvent[]
}

const DIAGNOSIS_VALUES = Object.keys(DIAGNOSIS_CONFIG) as Diagnosis[]
const DEFAULT_DIAGNOSIS = DIAGNOSIS_VALUES[0]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function toTrimmedString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function toDate(value: unknown, fallback: Date): Date {
  const parsed = new Date(String(value ?? ""))
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function normalizeEventType(value: unknown): EventType {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
  if (normalized === "SURGERY") return "SURGERY"
  if (normalized === "CHECKUP") return "CHECKUP"
  return "SICKNESS"
}

function normalizeDiagnosis(value: unknown): Diagnosis {
  const normalized = toTrimmedString(value)
  const matched = DIAGNOSIS_VALUES.find(item => item === normalized)
  return matched ?? DEFAULT_DIAGNOSIS
}

function computeRiskLevel(score: number): MoldAssetInfo["riskLevel"] {
  if (score >= 85) return "LOW"
  if (score >= 70) return "MODERATE"
  if (score >= 50) return "HIGH"
  return "CRITICAL"
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback
  const body = payload as {
    error?: unknown
    code?: unknown
    details?: {
      fieldErrors?: Record<string, string[] | undefined>
      formErrors?: string[]
    }
  }
  const message = typeof body.error === "string" && body.error.trim() ? body.error : fallback
  const formErrors = Array.isArray(body.details?.formErrors)
    ? body.details?.formErrors.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []
  const fieldErrors = body.details?.fieldErrors && typeof body.details.fieldErrors === "object"
    ? Object.entries(body.details.fieldErrors)
        .flatMap(([field, values]) =>
          Array.isArray(values)
            ? values
                .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
                .map((item) => `${field}: ${item}`)
            : []
        )
    : []
  const detailText = [...formErrors, ...fieldErrors].join("; ")

  if (detailText) {
    return `${message} - ${detailText}`
  }

  const code = typeof body.code === "string" && body.code.trim() ? body.code : ""
  return code ? `${message} (${code})` : message
}

function normalizeCreateInput(
  input: MoldMaintenanceCreateInput
): MoldMaintenanceCreateInput {
  const normalized: MoldMaintenanceCreateInput = {
    type: input.type,
    repairAction: input.repairAction,
    currentShots: Math.max(0, Math.trunc(input.currentShots)),
    symptom: input.symptom.trim(),
    diagnosis: input.diagnosis.trim(),
    procedure: input.procedure.trim(),
    downtimeHours: Math.max(0, input.downtimeHours),
    recoveryRating: clamp(input.recoveryRating, 0, 1),
    operator: input.operator.trim(),
    cost: Math.max(0, input.cost),
  }

  const moldNo = typeof input.moldNo === "string" ? input.moldNo.trim() : ""
  if (moldNo) {
    normalized.moldNo = moldNo
  }

  const imageUrl = typeof input.imageUrl === "string" ? input.imageUrl.trim() : ""
  if (imageUrl) {
    normalized.imageUrl = imageUrl
  }

  if (input.estimatedCompletion) {
    normalized.estimatedCompletion = new Date(input.estimatedCompletion).toISOString()
  }

  if (input.occurredAt) {
    normalized.occurredAt = new Date(input.occurredAt).toISOString()
  }

  return normalized
}

export async function fetchMoldTelemetry(
  moldId: string,
  moldNoHint?: string
): Promise<MoldTelemetrySnapshot> {
  const response = await apiFetch(`/api/mold/${encodeURIComponent(moldId)}/telemetry`)
  const payload = (await response.json().catch(() => null)) as
    | RawTelemetryPayload
    | { error?: string }
    | null

  if (!response.ok) {
    throw new Error(
      readErrorMessage(payload, "Failed to load mold telemetry")
    )
  }

  const telemetry: RawTelemetryPayload =
    payload && typeof payload === "object" ? (payload as RawTelemetryPayload) : {}
  const rawEvents: RawTelemetryEvent[] = Array.isArray(telemetry.events)
    ? telemetry.events
    : []
  const now = new Date()

  const events = rawEvents.map((event, index): MoldHealthEvent => {
    const currentShots = Math.max(0, Math.trunc(toFiniteNumber(event.currentShots, 0)))
    return {
      id: toTrimmedString(event.id, `event-${index + 1}`),
      timestamp: toDate(event.occurredAt, now),
      type: normalizeEventType(event.type),
      repairAction: toTrimmedString(event.repairAction, "") || null,
      symptom: toTrimmedString(event.symptom, "N/A"),
      diagnosis: normalizeDiagnosis(event.diagnosis),
      procedure: toTrimmedString(event.procedure, "N/A"),
      operator: toTrimmedString(event.operator, "SYSTEM"),
      downtimeHours: Math.max(0, toFiniteNumber(event.downtimeHours, 0)),
      recoveryRating: clamp(toFiniteNumber(event.recoveryRating, 0), 0, 1),
      cost: Math.max(0, toFiniteNumber(event.cost, 0)),
    }
  })

  const latestEvent = [...events].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime()
  )[0]

  const asset = telemetry.asset ?? {}
  const stats = telemetry.stats ?? {}

  const designLife = Math.max(1, Math.trunc(toFiniteNumber(asset.designLife, 1_000_000)))
  const totalShots = Math.max(0, Math.trunc(toFiniteNumber(asset.currentShots, 0)))
  const reliabilityRatio = clamp(
    toFiniteNumber(stats.currentReliability, 0) / 100,
    0,
    1
  )
  const healthScore = clamp(
    toFiniteNumber(stats.healthScore, reliabilityRatio * 100),
    0,
    100
  )
  const moldNo = toTrimmedString(asset.moldNo, moldNoHint || "NO. 1")
  const nextPmDate = toDate(
    stats.nextPmDate,
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  )

  const normalizedAsset: MoldAssetInfo = {
    moldId: toTrimmedString(asset.moldId, moldId),
    moldName: `Mold ${moldNo}`,
    material: "P20 / NAK80",
    cavityCount: 1,
    totalShots,
    designLife,
    currentReliability: reliabilityRatio,
    weibullBeta: 1.85,
    weibullEta: designLife,
    lastMaintenanceDate: latestEvent?.timestamp ?? now,
    nextScheduledMaintenance: nextPmDate,
    healthScore: Math.round(healthScore),
    riskLevel: computeRiskLevel(healthScore),
  }

  const timeline = rawEvents.map((event, index): MoldTelemetryTimelineEntry => ({
    id: toTrimmedString(event.id, `event-${index + 1}`),
    type: normalizeEventType(event.type),
    currentShots: Math.max(0, Math.trunc(toFiniteNumber(event.currentShots, 0))),
  }))

  const normalizedStats: MoldTelemetryStats = {
    sicknessCount: Math.max(0, Math.trunc(toFiniteNumber(stats.sicknessCount, 0))),
    surgeryCount: Math.max(0, Math.trunc(toFiniteNumber(stats.surgeryCount, 0))),
    checkupCount: Math.max(0, Math.trunc(toFiniteNumber(stats.checkupCount, 0))),
    totalDowntimeHours: Math.max(0, toFiniteNumber(stats.totalDowntimeHours, 0)),
    totalCostCny: Math.max(0, toFiniteNumber(stats.totalCost, 0)),
    avgRecoveryRating: clamp(toFiniteNumber(stats.avgRecoveryRating, 0), 0, 1),
    mtbfDays: Math.max(0, toFiniteNumber(stats.mtbfDays, 0)),
  }

  return {
    asset: normalizedAsset,
    stats: normalizedStats,
    events,
    timeline,
  }
}

export async function createMaintenanceLog(
  moldId: string,
  input: MoldMaintenanceCreateInput
): Promise<void> {
  const payload = normalizeCreateInput(input)
  const response = await apiFetch(
    `/api/mold/${encodeURIComponent(moldId)}/maintenance-logs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  )
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Failed to create maintenance log"))
  }
}

export async function deleteMaintenanceLog(
  moldId: string,
  eventId: string
): Promise<void> {
  const response = await apiFetch(
    `/api/mold/${encodeURIComponent(moldId)}/maintenance-logs/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  )
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Failed to delete maintenance log"))
  }
}
