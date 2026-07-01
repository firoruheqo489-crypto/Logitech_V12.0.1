// ─────────────────────────────────────────────────────────────────────────
// DARKROOM TELEMETRY — INGESTION
// ─────────────────────────────────────────────────────────────────────────
// This module no longer returns flat, scraped key-values. It drives the IES
// photometric engine (lib/ies-engine.ts) to COMPUTE a fully-populated
// DarkroomTelemetry object from the raw candela distribution:
//   Level 1 — flat scalar metrics
//   Level 2 — spatial energy accumulation (solid-angle integrated zonal flux)
//   Level 3 — conical attenuation (inverse-square illuminance vs distance)
//
// Source: "A126S151 LG162 10W PIR投光灯.IES" — VOLNIC GON-2000 分布光度计.
// ─────────────────────────────────────────────────────────────────────────

import {
  candelaPlane,
  intensityAt as engineIntensityAt,
  maxCandela,
  zonalFlux,
  coneAngle,
  centerIlluminance,
  averageIlluminance,
  beamDiameter,
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

export interface DarkroomTelemetry {
  // Level 1 — flat metrics
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
  // Level 2 & 3
  energyZones: EnergyZone[]
  attenuationSlots: AttenuationSlot[]
}

// ── Engine-derived intermediate quantities ─────────────────────────────────
const beamFull = coneAngle(0.5) // 50% Imax full beam angle
const fieldFull = coneAngle(0.1) // 10% Imax full field angle
const beamHalf = beamFull / 2
const fieldHalf = fieldFull / 2

const totalFlux = zonalFlux(90)
const beamFlux = zonalFlux(beamHalf)
const erpFlux = zonalFlux(60) // ErP useful flux: 120° cone (±60°)
const fieldFlux = zonalFlux(fieldHalf)

// ── Level 2: spatial energy accumulation (computed) ─────────────────────────
const energyZones: EnergyZone[] = [
  {
    label: "光束区 BEAM 50%",
    sub: `≤ ±${beamHalf.toFixed(2)}°`,
    lumens: beamFlux,
    percent: (beamFlux / totalFlux) * 100,
  },
  {
    label: "有效区 ErP φuse",
    sub: "120° CONE",
    lumens: erpFlux,
    percent: (erpFlux / totalFlux) * 100,
  },
  {
    label: "场角区 FIELD 10%",
    sub: `≤ ±${fieldHalf.toFixed(2)}°`,
    lumens: fieldFlux,
    percent: (fieldFlux / totalFlux) * 100,
  },
  {
    label: "全光通 TOTAL",
    sub: "0–180°",
    lumens: totalFlux,
    percent: 100,
  },
]

// ── Level 3: conical attenuation (computed via inverse-square law) ──────────
const attenuationSlots: AttenuationSlot[] = Array.from({ length: 8 }, (_, i) => {
  const d = i + 1
  return {
    height: `${d.toFixed(1)}m`,
    centerLux: centerIlluminance(d),
    averageLux: averageIlluminance(d),
    diameter: beamDiameter(d, beamFull),
  }
})

// ── Fully-populated DarkroomTelemetry object ────────────────────────────────
export const fixture: DarkroomTelemetry = {
  name: "A126S151 LG162 10W PIR投光灯",
  filename: "A126S151 LG162 10W PIR投光灯.IES",
  machine: "VOLNIC GON-2000",
  testDate: "2026/06/29",

  ratedFlux: 910.204, // lm — published Luminary Flux (rated)
  testedPower: 10.41, // W
  efficacy: 87.436, // lm/W
  maxCandela, // 368.681 cd (engine)
  maxCandelaAngle: { b: 7.0, beta: 4.0 },
  beamAngle: { v: 101.9, h: Math.round(beamFull * 10) / 10 }, // H computed
  fieldAngle: { v: 139.3, h: Math.round(fieldFull * 10) / 10 }, // H computed
  spaceEMax: 367.449,
  workingPlaneEMax: 40.85,
  upwardFluxRatio: 0.0,

  energyZones,
  attenuationSlots,
}

export const intensityAt = engineIntensityAt
export { candelaPlane, energyZones, attenuationSlots }
