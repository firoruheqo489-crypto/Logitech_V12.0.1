export type EventType = "SICKNESS" | "SURGERY" | "CHECKUP"

export type Diagnosis =
  | "拉伤"
  | "开裂"
  | "尺寸超差"
  | "顶针折断"
  | "正常损耗"

export interface MoldHealthEvent {
  id: string
  timestamp: Date
  type: EventType
  repairAction?: string | null
  symptom: string
  diagnosis: Diagnosis
  procedure: string
  operator: string
  downtimeHours: number
  recoveryRating: number // 0.0 to 1.0
  cost: number // Estimated parts + labor cost in CNY
}

export interface MoldAssetInfo {
  moldId: string
  moldName: string
  material: string
  cavityCount: number
  totalShots: number
  designLife: number // Total designed shot count
  currentReliability: number // 0.0 to 1.0
  weibullBeta: number
  weibullEta: number
  lastMaintenanceDate: Date
  nextScheduledMaintenance: Date
  healthScore: number // 0-100
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
}

interface EventTypeVisualConfig {
  label: string
  labelZh: string
  color: string
  bgColor: string
  filterActiveClassName: string
  filterActiveTextClassName: string
  statsColor: string
  statsBgColor: string
}

export const EVENT_TYPE_CONFIG: Record<
  EventType,
  EventTypeVisualConfig
> = {
  SICKNESS: {
    label: "Corrective",
    labelZh: "纠正性维护",
    color: "text-amber-400",
    bgColor: "bg-amber-950/40",
    filterActiveClassName:
      "border-amber-700/50 bg-amber-950/20 text-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_0_18px_rgba(180,83,9,0.08)]",
    filterActiveTextClassName: "text-amber-300",
    statsColor: "text-amber-400",
    statsBgColor: "bg-amber-500/16",
  },
  SURGERY: {
    label: "Major Repair",
    labelZh: "大修 / 改造",
    color: "text-red-400",
    bgColor: "bg-red-950/40",
    filterActiveClassName:
      "border-red-700/50 bg-red-950/20 text-red-300 shadow-[0_0_0_1px_rgba(239,68,68,0.08),0_0_18px_rgba(127,29,29,0.08)]",
    filterActiveTextClassName: "text-red-300",
    statsColor: "text-red-400",
    statsBgColor: "bg-red-500/16",
  },
  CHECKUP: {
    label: "Preventive",
    labelZh: "预防性维护",
    color: "text-success",
    bgColor: "bg-success/15",
    filterActiveClassName:
      "border-emerald-700/50 bg-emerald-950/20 text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_0_18px_rgba(6,95,70,0.08)]",
    filterActiveTextClassName: "text-emerald-300",
    statsColor: "text-emerald-400",
    statsBgColor: "bg-emerald-500/16",
  },
}

export const DELETE_RECORD_BUTTON_CLASS =
  "inline-flex size-7 items-center justify-center rounded-md border border-red-700/50 bg-red-950/35 text-red-400 transition-colors hover:border-red-600/60 hover:bg-red-950/55 hover:text-red-300"

export const DIAGNOSIS_CONFIG: Record<
  Diagnosis,
  { labelZh: string; labelEn: string; severity: number }
> = {
  拉伤: { labelZh: "拉伤", labelEn: "Abrasion", severity: 0.6 },
  开裂: { labelZh: "开裂", labelEn: "Cracking", severity: 0.9 },
  尺寸超差: {
    labelZh: "尺寸超差",
    labelEn: "Out of Tolerance",
    severity: 0.7,
  },
  顶针折断: {
    labelZh: "顶针折断",
    labelEn: "Ejector Pin Break",
    severity: 0.8,
  },
  正常损耗: { labelZh: "正常损耗", labelEn: "Normal Wear", severity: 0.3 },
}
