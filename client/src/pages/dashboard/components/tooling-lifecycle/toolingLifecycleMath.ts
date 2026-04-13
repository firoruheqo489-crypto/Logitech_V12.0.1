import type { MaintenanceEvent, WeibullParameters } from "./toolingLifecycleModel";

export const ZONE_1_END = 0.15;
export const ZONE_2_END = 0.85;
export const SVG_WIDTH = 1000;
export const SVG_HEIGHT = 256;
export const BASE_BETA = 1.8;
export const NATURAL_AGING_COEF = 1.2;
export const DAMAGE_MULTIPLIER = 2.5;
export const MAX_BETA_LIMIT = 4.8;

export type ToolingLifecycleZoneId =
  | "early_failure"
  | "useful_life"
  | "wear_out";

export interface ToolingLifecycleZoneMeta {
  zone: 1 | 2 | 3;
  zoneId: ToolingLifecycleZoneId;
  color: string;
}

export function getActiveEta(
  parameters: WeibullParameters,
  isCalibrated: boolean
): number {
  return isCalibrated ? parameters.etaDegraded : parameters.etaNormal;
}

export function getWearOutThreshold(activeEta: number): number {
  return Math.floor(activeEta * ZONE_2_END);
}

export function getLivingWeibullBeta(
  currentShots: number,
  maxCapacity: number,
  repairHistory: Array<Pick<MaintenanceEvent, "recoveryRate" | "shots">> = []
): number {
  const safeCapacity = Math.max(1, maxCapacity);
  const safeShots = Math.max(0, currentShots);
  const agingRatio = safeShots / safeCapacity;
  const timeAgingBeta = NATURAL_AGING_COEF * Math.pow(agingRatio, 2);

  let structuralDamageBeta = 0;
  for (const repair of repairHistory) {
    if ((repair.shots ?? 0) > safeShots) {
      continue;
    }

    const normalizedRecoveryRate = Math.max(
      0,
      Math.min(1, repair.recoveryRate ?? 1)
    );
    const damageValue = 1 - normalizedRecoveryRate;
    structuralDamageBeta += damageValue * DAMAGE_MULTIPLIER;
  }

  const livingBeta = BASE_BETA + timeAgingBeta + structuralDamageBeta;
  return Math.min(livingBeta, MAX_BETA_LIMIT);
}

export function hazardRate(
  t: number,
  maxShots: number,
  repairHistory: MaintenanceEvent[] = []
): number {
  const safeMaxShots = Math.max(1, maxShots);
  const effectiveShots = Math.max(safeMaxShots * 0.001, t);
  const beta = getLivingWeibullBeta(effectiveShots, safeMaxShots, repairHistory);
  const normalizedShots = effectiveShots / safeMaxShots;

  return (beta / safeMaxShots) * Math.pow(normalizedShots, beta - 1);
}

export function getReliabilityRatio(
  shots: number,
  maxShots: number,
  repairHistory: MaintenanceEvent[] = []
): number {
  const safeShots = Math.max(0, shots);
  const safeMaxShots = Math.max(1, maxShots);
  const steps = 800;
  let integral = 0;
  for (let i = 1; i <= steps; i += 1) {
    const t0 = ((i - 1) / steps) * safeShots;
    const t1 = (i / steps) * safeShots;
    integral +=
      ((hazardRate(t0, safeMaxShots, repairHistory) +
        hazardRate(t1, safeMaxShots, repairHistory)) / 2) *
      (t1 - t0);
  }
  return Math.exp(-integral);
}

export function getRenderedBathtubHazard(t: number, maxShots: number): number {
  const safeMaxShots = Math.max(1, maxShots);
  const x = Math.max(0, Math.min(1, t / safeMaxShots));
  const infant = 0.8 * Math.exp(-12 * x);
  const wearout = x > 0.75 ? 0.9 * Math.pow((x - 0.75) / 0.25, 3) : 0;
  const baseline = 0.05;

  return infant + baseline + wearout;
}

export function formatHazardValue(value: number): string {
  const safeValue = Math.max(0, value);

  if (safeValue === 0) {
    return "0.0000";
  }

  if (safeValue < 0.0001) {
    return `${(safeValue * 1_000_000).toFixed(3)} μ`;
  }

  if (safeValue < 0.01) {
    return safeValue.toFixed(6);
  }

  return safeValue.toFixed(4);
}

export function getMaxHazard(
  maxShots: number,
  _repairHistory: MaintenanceEvent[] = []
): number {
  let maxH = 0;
  for (let i = 0; i <= 200; i += 1) {
    const t = (i / 200) * maxShots;
    const h = getRenderedBathtubHazard(t, maxShots);
    if (h > maxH) maxH = h;
  }
  return maxH;
}

export function generateCurvePath(
  maxShots: number,
  repairHistory: MaintenanceEvent[] = []
): string {
  const points: Array<{ x: number; y: number }> = [];
  const steps = 200;
  const maxH = getMaxHazard(maxShots, repairHistory);

  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * maxShots;
    const h = getRenderedBathtubHazard(t, maxShots);
    const x = (i / steps) * SVG_WIDTH;
    const y = SVG_HEIGHT - (h / maxH) * (SVG_HEIGHT * 0.85) - SVG_HEIGHT * 0.05;
    points.push({ x, y });
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.5;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.5;
    d += ` C ${cpx1} ${prev.y} ${cpx2} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

export function generateFillPath(
  maxShots: number,
  repairHistory: MaintenanceEvent[] = []
): string {
  const curvePath = generateCurvePath(maxShots, repairHistory);
  return `${curvePath} L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z`;
}

export function buildQuickJumpPoints(isCalibrated: boolean): number[] {
  if (isCalibrated) {
    return [
      0, 50_000, 150_000, 250_000, 400_000, 600_000, 680_000, 750_000, 800_000,
    ];
  }
  return [
    0, 50_000, 150_000, 250_000, 500_000, 750_000, 850_000, 950_000, 1_000_000,
  ];
}

export function getXAxisLabels(isCalibrated: boolean): string[] {
  if (isCalibrated) {
    return ["0", "200K", "400K", "600K", "800K"];
  }
  return ["0", "250K", "500K", "750K", "1,000K"];
}

export function getZoneMeta(
  shots: number,
  maxShots: number
): ToolingLifecycleZoneMeta {
  const pct = shots / maxShots;
  if (pct < ZONE_1_END) {
    return { zone: 1, zoneId: "early_failure", color: "text-cyan-400" };
  }
  if (pct < ZONE_2_END) {
    return { zone: 2, zoneId: "useful_life", color: "text-emerald-400" };
  }
  return { zone: 3, zoneId: "wear_out", color: "text-rose-400" };
}
