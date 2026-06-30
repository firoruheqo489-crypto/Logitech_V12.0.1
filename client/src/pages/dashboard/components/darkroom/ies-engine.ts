export interface CandelaSample {
  theta: number
  cd: number
}

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

export function intensityAt(angleDeg: number, plane: CandelaSample[]): number {
  const a = Math.abs(angleDeg)
  if (a >= 90) return 0
  for (let i = 0; i < plane.length - 1; i++) {
    const lo = plane[i]
    const hi = plane[i + 1]
    if (a >= lo.theta && a <= hi.theta) {
      const t = (a - lo.theta) / (hi.theta - lo.theta)
      return lo.cd + t * (hi.cd - lo.cd)
    }
  }
  return 0
}

export function zonalFlux(thetaMaxDeg: number, plane: CandelaSample[], stepDeg = 1): number {
  let flux = 0
  for (let t = 0; t < thetaMaxDeg; t += stepDeg) {
    const t1 = t
    const t2 = Math.min(t + stepDeg, thetaMaxDeg)
    const iMid = intensityAt((t1 + t2) / 2, plane)
    const omega = 2 * Math.PI * (Math.cos(t1 * DEG) - Math.cos(t2 * DEG))
    flux += iMid * omega
  }
  return flux
}

export function coneAngle(fraction: number, plane: CandelaSample[]): number {
  const maxCandela = plane[0]?.cd ?? 0
  const target = maxCandela * fraction
  for (let i = 0; i < plane.length - 1; i++) {
    const lo = plane[i]
    const hi = plane[i + 1]
    if (lo.cd >= target && hi.cd <= target) {
      const t = (lo.cd - target) / (lo.cd - hi.cd)
      const half = lo.theta + t * (hi.theta - lo.theta)
      return half * 2
    }
  }
  return 180
}

export function centerIlluminance(distanceM: number, axialIntensity: number): number {
  return axialIntensity / (distanceM * distanceM)
}

export function averageIlluminance(distanceM: number, axialIntensity: number): number {
  return centerIlluminance(distanceM, axialIntensity) / 2.9405
}

export function beamDiameter(distanceM: number, beamFullAngleDeg: number): number {
  const halfRad = (beamFullAngleDeg / 2) * DEG
  return 2 * distanceM * Math.tan(halfRad)
}
