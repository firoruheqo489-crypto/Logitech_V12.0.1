import {
  candelaPlane as fallbackCandelaPlane,
  intensityAt as engineIntensityAt,
  type CandelaSample,
} from "./ies-engine"

export type EvidenceSource = "pdf" | "reconstructed" | "missing"

export interface EnergyZone {
  label: string
  sub: string
  lumens: number | null
  percent: number | null
  source: EvidenceSource
}

export interface AttenuationSlot {
  height: string
  centerLux: number
  averageLux: number
  diameter: number
}

export interface DarkroomParseResult {
  name: string | null
  filename: string | null
  machine: string | null
  test_date: string | null
  rated_flux_lm: number | null
  luminaire_flux_lm: number | null
  beam_lumens_lm: number | null
  beam_efficiency_percent: number | null
  field_lumens_lm: number | null
  field_efficiency_percent: number | null
  tested_power_w: number | null
  luminaire_eer_lm_per_w: number | null
  max_candela_cd: number | null
  max_candela_angle_h: number | null
  max_candela_angle_v: number | null
  tested_voltage_v: number | null
  tested_current_a: number | null
  tested_pf: number | null
  beam_angle_v_deg: number | null
  beam_angle_h_deg: number | null
  field_angle_v_deg: number | null
  field_angle_h_deg: number | null
  erp_phiuse_lm: number | null
  erp_phiuse_angle_deg?: number | null
  irf_percent: number | null
  mounting_height_m?: number | null
  plane_max_illuminance_lx: number | null
  plane_max_position_h: number | null
  plane_max_position_v: number | null
  space_max_illuminance_lx: number | null
  space_max_angle_deg: number | null
  plane_max_intensity_cd: number | null
  plane_max_intensity_angle_deg: number | null
  attenuation_slots: AttenuationSlot[]
  candela_plane?: CandelaSample[]
  raw_pages: string[]
}

export interface DarkroomTelemetry {
  name: string
  filename: string
  machine: string
  testDate: string
  ratedFlux: number | null
  testedPower: number | null
  efficacy: number | null
  maxCandela: number | null
  maxCandelaAngle: { b: number | null; beta: number | null }
  beamAngle: { v: number | null; h: number | null }
  fieldAngle: { v: number | null; h: number | null }
  spaceEMax: number | null
  workingPlaneEMax: number | null
  workingPlanePosition: { h: number | null; v: number | null }
  planeMaxIntensity: { cd: number | null; angle: number | null }
  erpPhiuse: { lumens: number | null; angle: number | null }
  irfPercent: number | null
  mountingHeight: number | null
  energyZones: EnergyZone[]
  attenuationSlots: AttenuationSlot[]
  candelaPlane: CandelaSample[]
  candelaSource: EvidenceSource
  evidenceWarnings: string[]
}

function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits))
}

function isFinitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function buildCandelaEvidence(result: DarkroomParseResult | null): {
  plane: CandelaSample[]
  source: EvidenceSource
} {
  const parsedPlane = result?.candela_plane?.filter((sample) =>
    Number.isFinite(sample.theta) && Number.isFinite(sample.cd),
  )

  if (parsedPlane && parsedPlane.length >= 5) {
    return {
      plane: [...parsedPlane].sort((a, b) => a.theta - b.theta),
      source: "pdf",
    }
  }

  if (isFinitePositive(result?.max_candela_cd)) {
    const fallbackMax = fallbackCandelaPlane[0]?.cd || 1
    const scale = result.max_candela_cd / fallbackMax
    return {
      plane: fallbackCandelaPlane.map((sample) => ({
        theta: sample.theta,
        cd: round(sample.cd * scale, 3),
      })),
      source: "reconstructed",
    }
  }

  return { plane: [], source: "missing" }
}

function zoneSource(lumens: number | null | undefined, percent: number | null | undefined): EvidenceSource {
  return lumens != null || percent != null ? "pdf" : "missing"
}

function buildEnergyZones(result: DarkroomParseResult | null): EnergyZone[] {
  const totalFlux = result?.luminaire_flux_lm ?? result?.rated_flux_lm ?? null
  const erpAngle = result?.erp_phiuse_angle_deg ?? null

  return [
    {
      label: "光束区 BEAM 50%",
      sub:
        result?.beam_angle_h_deg != null && result.beam_angle_v_deg != null
          ? `H ${result.beam_angle_h_deg.toFixed(1)}° / V ${result.beam_angle_v_deg.toFixed(1)}°`
          : "PDF未给出角度",
      lumens: result?.beam_lumens_lm ?? null,
      percent: result?.beam_efficiency_percent ?? null,
      source: zoneSource(result?.beam_lumens_lm, result?.beam_efficiency_percent),
    },
    {
      label: "ErP φuse",
      sub: erpAngle == null ? "PDF未给出角度" : `${erpAngle.toFixed(0)}° CONE`,
      lumens: result?.erp_phiuse_lm ?? null,
      percent: result?.irf_percent ?? null,
      source: zoneSource(result?.erp_phiuse_lm, result?.irf_percent),
    },
    {
      label: "场角区 FIELD 10%",
      sub:
        result?.field_angle_h_deg != null && result.field_angle_v_deg != null
          ? `H ${result.field_angle_h_deg.toFixed(1)}° / V ${result.field_angle_v_deg.toFixed(1)}°`
          : "PDF未给出角度",
      lumens: result?.field_lumens_lm ?? null,
      percent: result?.field_efficiency_percent ?? null,
      source: zoneSource(result?.field_lumens_lm, result?.field_efficiency_percent),
    },
    {
      label: "全光通 TOTAL",
      sub: "PDF Luminary Flux",
      lumens: totalFlux,
      percent: totalFlux == null ? null : 100,
      source: totalFlux == null ? "missing" : "pdf",
    },
  ]
}

function buildEvidenceWarnings(result: DarkroomParseResult | null, candelaSource: EvidenceSource): string[] {
  if (!result) return ["尚未解析暗房 PDF，当前页面不展示样品证据。"]

  const warnings: string[] = []
  if (result.erp_phiuse_lm == null) warnings.push("PDF ErP φuse 未解析到，已按缺失处理。")
  if (result.irf_percent == null) warnings.push("PDF IRF(%) 未解析到，已按缺失处理。")
  if (!result.attenuation_slots?.length) warnings.push("照度距离衰减表未解析到，未使用推算值补齐。")
  if (candelaSource === "reconstructed") warnings.push("未解析到 Candela Tabulation，配光曲线为参数重建示意。")
  if (candelaSource === "missing") warnings.push("未解析到 Candela Tabulation 或最大光强，配光曲线暂不可用。")
  return warnings
}

export function buildDarkroomTelemetry(result: DarkroomParseResult | null): DarkroomTelemetry {
  const candelaEvidence = buildCandelaEvidence(result)

  return {
    name: result?.name || "--",
    filename: result?.filename || "--",
    machine: result?.machine || "--",
    testDate: result?.test_date || "--",
    ratedFlux: result?.luminaire_flux_lm ?? result?.rated_flux_lm ?? null,
    testedPower: result?.tested_power_w ?? null,
    efficacy: result?.luminaire_eer_lm_per_w ?? null,
    maxCandela: result?.max_candela_cd ?? null,
    maxCandelaAngle: {
      b: result?.max_candela_angle_h ?? null,
      beta: result?.max_candela_angle_v ?? null,
    },
    beamAngle: {
      v: result?.beam_angle_v_deg ?? null,
      h: result?.beam_angle_h_deg ?? null,
    },
    fieldAngle: {
      v: result?.field_angle_v_deg ?? null,
      h: result?.field_angle_h_deg ?? null,
    },
    spaceEMax: result?.space_max_illuminance_lx ?? null,
    workingPlaneEMax: result?.plane_max_illuminance_lx ?? null,
    workingPlanePosition: {
      h: result?.plane_max_position_h ?? null,
      v: result?.plane_max_position_v ?? null,
    },
    planeMaxIntensity: {
      cd: result?.plane_max_intensity_cd ?? null,
      angle: result?.plane_max_intensity_angle_deg ?? null,
    },
    erpPhiuse: {
      lumens: result?.erp_phiuse_lm ?? null,
      angle: result?.erp_phiuse_angle_deg ?? null,
    },
    irfPercent: result?.irf_percent ?? null,
    mountingHeight: result?.mounting_height_m ?? null,
    energyZones: buildEnergyZones(result),
    attenuationSlots: result?.attenuation_slots ?? [],
    candelaPlane: candelaEvidence.plane,
    candelaSource: candelaEvidence.source,
    evidenceWarnings: buildEvidenceWarnings(result, candelaEvidence.source),
  }
}

export function formatDarkroomNumber(
  value: number | null | undefined,
  digits: number,
  unit = "",
): string {
  if (value == null || !Number.isFinite(value)) return "--"
  if (!unit) return value.toFixed(digits)
  if (unit === "%" || unit === "°") return `${value.toFixed(digits)}${unit}`
  return `${value.toFixed(digits)} ${unit}`
}

export function intensityAt(angleDeg: number, telemetry: DarkroomTelemetry): number {
  if (!telemetry.candelaPlane.length) return 0
  const sorted = telemetry.candelaPlane
  const minTheta = sorted[0]?.theta ?? 0
  const maxTheta = sorted[sorted.length - 1]?.theta ?? 0

  if (minTheta < 0 && maxTheta > 0) {
    if (angleDeg <= minTheta || angleDeg >= maxTheta) {
      const edge = angleDeg <= minTheta ? sorted[0] : sorted[sorted.length - 1]
      return edge?.cd ?? 0
    }

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const lo = sorted[index]
      const hi = sorted[index + 1]
      if (angleDeg >= lo.theta && angleDeg <= hi.theta) {
        const t = (angleDeg - lo.theta) / (hi.theta - lo.theta)
        return lo.cd + t * (hi.cd - lo.cd)
      }
    }

    return 0
  }

  return engineIntensityAt(angleDeg, telemetry.candelaPlane)
}
