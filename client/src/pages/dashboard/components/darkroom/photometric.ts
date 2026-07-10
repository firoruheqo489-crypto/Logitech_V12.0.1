import {
  averageIlluminance,
  beamDiameter,
  candelaPlane,
  centerIlluminance,
  coneAngle,
  intensityAt as engineIntensityAt,
  type CandelaSample,
  zonalFlux,
} from "./ies-engine"

export interface EnergyZone {
  label: string
  sub: string
  lumens: number
  percent: number
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
  irf_percent: number | null
  plane_max_illuminance_lx: number | null
  plane_max_position_h: number | null
  plane_max_position_v: number | null
  space_max_illuminance_lx: number | null
  space_max_angle_deg: number | null
  plane_max_intensity_cd: number | null
  plane_max_intensity_angle_deg: number | null
  attenuation_slots: AttenuationSlot[]
  raw_pages: string[]
}

export interface DarkroomTelemetry {
  name: string
  filename: string
  machine: string
  testDate: string
  ratedFlux: number
  testedPower: number
  efficacy: number
  maxCandela: number
  maxCandelaAngle: { b: number; beta: number }
  beamAngle: { v: number; h: number }
  fieldAngle: { v: number; h: number }
  spaceEMax: number
  workingPlaneEMax: number
  upwardFluxRatio: number
  energyZones: EnergyZone[]
  attenuationSlots: AttenuationSlot[]
  candelaPlane: CandelaSample[]
}

const defaultTelemetry: DarkroomTelemetry = {
  name: "A126S151 LG162 10W PIR投光灯",
  filename: "A126S151 LG162 10W PIR投光灯.IES",
  machine: "VOLNIC GON-2000",
  testDate: "2026/06/29",
  ratedFlux: 910.204,
  testedPower: 10.41,
  efficacy: 87.436,
  maxCandela: 368.681,
  maxCandelaAngle: { b: 7.0, beta: 4.0 },
  beamAngle: { v: 101.9, h: 106.5 },
  fieldAngle: { v: 139.3, h: 145.5 },
  spaceEMax: 367.449,
  workingPlaneEMax: 40.85,
  upwardFluxRatio: 0.0,
  energyZones: [],
  attenuationSlots: [],
  candelaPlane,
}

function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits))
}

function buildEnergyZones(
  telemetry: Pick<DarkroomTelemetry, "ratedFlux" | "candelaPlane" | "beamAngle" | "fieldAngle">,
  result: DarkroomParseResult | null,
): EnergyZone[] {
  const totalFlux = telemetry.ratedFlux > 0 ? telemetry.ratedFlux : zonalFlux(90, telemetry.candelaPlane)

  if (
    result &&
    (result.beam_lumens_lm != null ||
      result.field_lumens_lm != null ||
      result.erp_phiuse_lm != null ||
      result.beam_efficiency_percent != null ||
      result.field_efficiency_percent != null ||
      result.irf_percent != null)
  ) {
    const beamFlux =
      result.beam_lumens_lm ??
      zonalFlux((telemetry.beamAngle.h + telemetry.beamAngle.v) / 4, telemetry.candelaPlane)
    const beamPercent =
      result.beam_efficiency_percent ?? (totalFlux > 0 ? (beamFlux / totalFlux) * 100 : 0)
    const erpFlux = result.erp_phiuse_lm ?? zonalFlux(60, telemetry.candelaPlane)
    const erpPercent =
      result.irf_percent ?? (totalFlux > 0 ? (erpFlux / totalFlux) * 100 : 0)
    const fieldFlux =
      result.field_lumens_lm ??
      zonalFlux((telemetry.fieldAngle.h + telemetry.fieldAngle.v) / 4, telemetry.candelaPlane)
    const fieldPercent =
      result.field_efficiency_percent ?? (totalFlux > 0 ? (fieldFlux / totalFlux) * 100 : 0)
    const beamHalf = (telemetry.beamAngle.h + telemetry.beamAngle.v) / 4
    const fieldHalf = (telemetry.fieldAngle.h + telemetry.fieldAngle.v) / 4

    return [
      {
        label: "光束区 BEAM 50%",
        sub: `≤ ±${beamHalf.toFixed(2)}°`,
        lumens: round(beamFlux, 1),
        percent: round(beamPercent, 1),
      },
      {
        label: "有效区 ErP φuse",
        sub: "120° CONE",
        lumens: round(erpFlux, 1),
        percent: round(erpPercent, 1),
      },
      {
        label: "场角区 FIELD 10%",
        sub: `≤ ±${fieldHalf.toFixed(2)}°`,
        lumens: round(fieldFlux, 1),
        percent: round(fieldPercent, 1),
      },
      {
        label: "全光通 TOTAL",
        sub: "0-180°",
        lumens: round(totalFlux, 1),
        percent: 100,
      },
    ]
  }

  const beamFull = coneAngle(0.5, telemetry.candelaPlane)
  const fieldFull = coneAngle(0.1, telemetry.candelaPlane)
  const beamHalf = beamFull / 2
  const fieldHalf = fieldFull / 2
  const beamFlux = zonalFlux(beamHalf, telemetry.candelaPlane)
  const erpFlux = zonalFlux(60, telemetry.candelaPlane)
  const fieldFlux = zonalFlux(fieldHalf, telemetry.candelaPlane)

  return [
    {
      label: "光束区 BEAM 50%",
      sub: `≤ ±${beamHalf.toFixed(2)}°`,
      lumens: round(beamFlux, 1),
      percent: round((beamFlux / totalFlux) * 100, 1),
    },
    {
      label: "有效区 ErP φuse",
      sub: "120° CONE",
      lumens: round(erpFlux, 1),
      percent: round((erpFlux / totalFlux) * 100, 1),
    },
    {
      label: "场角区 FIELD 10%",
      sub: `≤ ±${fieldHalf.toFixed(2)}°`,
      lumens: round(fieldFlux, 1),
      percent: round((fieldFlux / totalFlux) * 100, 1),
    },
    {
      label: "全光通 TOTAL",
      sub: "0-180°",
      lumens: round(totalFlux, 1),
      percent: 100,
    },
  ]
}

function buildAttenuationSlots(
  telemetry: Pick<DarkroomTelemetry, "candelaPlane" | "maxCandela">,
  parsedSlots: AttenuationSlot[] | null,
): AttenuationSlot[] {
  if (parsedSlots && parsedSlots.length > 0) {
    return parsedSlots
  }

  const beamFull = coneAngle(0.5, telemetry.candelaPlane)
  const axialIntensity = telemetry.maxCandela

  return Array.from({ length: 8 }, (_, i) => {
    const distanceM = i + 1
    return {
      height: `${distanceM.toFixed(1)}m`,
      centerLux: round(centerIlluminance(distanceM, axialIntensity), 2),
      averageLux: round(averageIlluminance(distanceM, axialIntensity), 3),
      diameter: round(beamDiameter(distanceM, beamFull), 3),
    }
  })
}

export function buildDarkroomTelemetry(result: DarkroomParseResult | null): DarkroomTelemetry {
  const telemetry: DarkroomTelemetry = result
    ? {
        ...defaultTelemetry,
        name: result.name || defaultTelemetry.name,
        filename: result.filename || defaultTelemetry.filename,
        machine: result.machine || defaultTelemetry.machine,
        testDate: result.test_date || defaultTelemetry.testDate,
        ratedFlux: result.luminaire_flux_lm ?? result.rated_flux_lm ?? defaultTelemetry.ratedFlux,
        testedPower: result.tested_power_w ?? defaultTelemetry.testedPower,
        efficacy: result.luminaire_eer_lm_per_w ?? defaultTelemetry.efficacy,
        maxCandela: result.max_candela_cd ?? defaultTelemetry.maxCandela,
        maxCandelaAngle: {
          b: result.max_candela_angle_h ?? defaultTelemetry.maxCandelaAngle.b,
          beta: result.max_candela_angle_v ?? defaultTelemetry.maxCandelaAngle.beta,
        },
        beamAngle: {
          v: result.beam_angle_v_deg ?? defaultTelemetry.beamAngle.v,
          h: result.beam_angle_h_deg ?? defaultTelemetry.beamAngle.h,
        },
        fieldAngle: {
          v: result.field_angle_v_deg ?? defaultTelemetry.fieldAngle.v,
          h: result.field_angle_h_deg ?? defaultTelemetry.fieldAngle.h,
        },
        spaceEMax: result.space_max_illuminance_lx ?? defaultTelemetry.spaceEMax,
        workingPlaneEMax: result.plane_max_illuminance_lx ?? defaultTelemetry.workingPlaneEMax,
        upwardFluxRatio: result.irf_percent ?? defaultTelemetry.upwardFluxRatio,
      }
    : { ...defaultTelemetry }

  telemetry.energyZones = buildEnergyZones(telemetry, result)
  telemetry.attenuationSlots = buildAttenuationSlots(telemetry, result?.attenuation_slots ?? null)
  return telemetry
}

export function intensityAt(angleDeg: number, telemetry: DarkroomTelemetry): number {
  return engineIntensityAt(angleDeg, telemetry.candelaPlane)
}
