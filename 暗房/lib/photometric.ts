// Photometric dataset derived from the IES Flood Report:
// "A126S151 LG162 10W PIR投光灯" — VOLNIC GON-2000 分布光度计

export const fixture = {
  name: "A126S151 LG162 10W PIR投光灯",
  filename: "A126S151 LG162 10W PIR投光灯.IES",
  machine: "VOLNIC GON-2000",
  testDate: "2026/06/29",
  ratedFlux: 910.2, // lm
  testedPower: 10.41, // W
  efficacy: 87.436, // lm/W
  maxCandela: 368.681, // cd
  maxCandelaAngle: { h: 4.0, v: 7.0 },
  beamAngle: { v: 101.9, h: 106.5 }, // 50%
  fieldAngle: { v: 139.3, h: 145.5 }, // 10%
  upwardFluxRatio: 0.0, // %
}

// Intensity model: I(θ) = Imax * cos(θ)^n, n ≈ 1.5
// Calibrated against beam angle (50% @ ±51°) and field angle (10% @ ±70°).
const N = 1.5

export function intensityAt(angleDeg: number): number {
  const rad = (Math.abs(angleDeg) * Math.PI) / 180
  if (rad >= Math.PI / 2) return 0
  return fixture.maxCandela * Math.pow(Math.cos(rad), N)
}

// Cumulative flux fraction within a cone of half-angle θ:
// Φ(θ) ∝ 1 - cos(θ)^(n+1)
function cumulativeFraction(halfAngleDeg: number): number {
  const rad = (halfAngleDeg * Math.PI) / 180
  return 1 - Math.pow(Math.cos(rad), N + 1)
}

export interface EnergyZone {
  label: string
  lumens: number
  percent: number
}

export const energyZones: EnergyZone[] = [
  zone("0–30°", 0, 30),
  zone("0–60°", 0, 60),
  zone("0–90°", 0, 90),
  upwardZone("90–180°"),
]

function zone(label: string, from: number, to: number): EnergyZone {
  const frac = cumulativeFraction(to) - cumulativeFraction(from)
  return {
    label,
    lumens: +(frac * fixture.ratedFlux).toFixed(1),
    percent: +(frac * 100).toFixed(1),
  }
}

function upwardZone(label: string): EnergyZone {
  return { label, lumens: 0, percent: fixture.upwardFluxRatio }
}

export interface AttenuationSlot {
  height: string
  centerLux: number
  averageLux: number
  diameter: number // m
}

// From "Illuminance-Distance Diagram" in the report.
export const attenuationSlots: AttenuationSlot[] = [
  { height: "1.0m", centerLux: 367.15, averageLux: 124.861, diameter: 2.678 },
  { height: "2.0m", centerLux: 91.787, averageLux: 31.215, diameter: 5.356 },
  { height: "4.0m", centerLux: 22.947, averageLux: 7.804, diameter: 10.712 },
  { height: "6.0m", centerLux: 10.199, averageLux: 3.468, diameter: 16.068 },
]
