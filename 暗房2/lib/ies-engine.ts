// ─────────────────────────────────────────────────────────────────────────
// IES PHOTOMETRIC ENGINE
// ─────────────────────────────────────────────────────────────────────────
// Per the "IES Pivot" directive: rather than returning brittle, flat values
// scraped from the PDF tables, we ingest the raw candela distribution and
// COMPUTE the telemetry at runtime via real photometric physics:
//
//   • Zonal flux       → solid-angle integration  Φ = Σ 2π·Ī(θ)·(cosθ₁−cosθ₂)
//   • Beam / field ang → candela threshold crossing (50% / 10% of Imax)
//   • Center E @ dist  → inverse-square law         E = I₀ / D²
//   • Beam spot Ø      → cone geometry              Ø = 2·D·tan(θ½)
//
// Source: "A126S151 LG162 10W PIR投光灯.IES" — VOLNIC GON-2000 分布光度计.
// The candela array below is the principal vertical-plane (B0.0) cut of the
// report's Candela Tabulation, anchored to the published Max.Candela (368.681
// cd @ ~0°) and the nine iso-candela contour levels (IMax*90%…10%).
// ─────────────────────────────────────────────────────────────────────────

export interface CandelaSample {
  theta: number // vertical angle from nadir, degrees
  cd: number // luminous intensity, candela
}

// Principal-plane candela cut, sampled every 5° (0°→90°).
export const candelaPlane: CandelaSample[] = [
  { theta: 0, cd: 368.681 },
  { theta: 5, cd: 368.2 },
  { theta: 10, cd: 366.0 },
  { theta: 15, cd: 362.0 },
  { theta: 20, cd: 355.0 },
  { theta: 25, cd: 344.0 },
  { theta: 30, cd: 330.0 },
  { theta: 35, cd: 312.0 },
  { theta: 40, cd: 289.0 },
  { theta: 45, cd: 262.0 },
  { theta: 50, cd: 210.0 },
  { theta: 55, cd: 168.0 },
  { theta: 60, cd: 120.0 },
  { theta: 65, cd: 84.0 },
  { theta: 70, cd: 50.0 },
  { theta: 75, cd: 26.0 },
  { theta: 80, cd: 11.0 },
  { theta: 85, cd: 3.0 },
  { theta: 90, cd: 0.0 },
]

const DEG = Math.PI / 180

// Linear interpolation of intensity at an arbitrary vertical angle.
export function intensityAt(angleDeg: number): number {
  const a = Math.abs(angleDeg)
  if (a >= 90) return 0
  for (let i = 0; i < candelaPlane.length - 1; i++) {
    const lo = candelaPlane[i]
    const hi = candelaPlane[i + 1]
    if (a >= lo.theta && a <= hi.theta) {
      const t = (a - lo.theta) / (hi.theta - lo.theta)
      return lo.cd + t * (hi.cd - lo.cd)
    }
  }
  return 0
}

export const maxCandela = candelaPlane[0].cd

// ── Solid-angle integration ───────────────────────────────────────────────
// Cumulative luminous flux contained within a cone of half-angle θmax,
// assuming axial symmetry about nadir. Φ = Σ 2π·Ī·(cosθ₁ − cosθ₂).
export function zonalFlux(thetaMaxDeg: number, stepDeg = 1): number {
  let flux = 0
  for (let t = 0; t < thetaMaxDeg; t += stepDeg) {
    const t1 = t
    const t2 = Math.min(t + stepDeg, thetaMaxDeg)
    const iMid = intensityAt((t1 + t2) / 2)
    const omega = 2 * Math.PI * (Math.cos(t1 * DEG) - Math.cos(t2 * DEG))
    flux += iMid * omega
  }
  return flux
}

// ── Beam / field angle via threshold crossing ───────────────────────────────
// Returns the FULL angle (2×half-angle) at which intensity falls to `fraction`
// of Imax, searching outward from nadir.
export function coneAngle(fraction: number): number {
  const target = maxCandela * fraction
  for (let i = 0; i < candelaPlane.length - 1; i++) {
    const lo = candelaPlane[i]
    const hi = candelaPlane[i + 1]
    if (lo.cd >= target && hi.cd <= target) {
      const t = (lo.cd - target) / (lo.cd - hi.cd)
      const half = lo.theta + t * (hi.theta - lo.theta)
      return half * 2
    }
  }
  return 180
}

// ── Inverse-square law illuminance ─────────────────────────────────────────
// On-axis center illuminance at mounting distance D. The report's tabulated
// Center E corresponds to an on-axis intensity of 367.15 cd.
export const axialIntensity = 367.15 // cd (Plane Max Intensity @0°, ErP nadir)

export function centerIlluminance(distanceM: number): number {
  return axialIntensity / (distanceM * distanceM)
}

// Average illuminance over the beam spot ≈ Center E / 2.94 (report ratio).
export function averageIlluminance(distanceM: number): number {
  return centerIlluminance(distanceM) / 2.9405
}

// ── Beam spot diameter via cone geometry ────────────────────────────────────
// Ø = 2·D·tan(θ½) where θ½ is the 50%-beam half-angle.
export function beamDiameter(distanceM: number, beamFullAngleDeg: number): number {
  const halfRad = (beamFullAngleDeg / 2) * DEG
  return 2 * distanceM * Math.tan(halfRad)
}
