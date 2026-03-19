import type { WeibullParameters } from "./toolingLifecycleModel";

export const ZONE_1_END = 0.15;
export const ZONE_2_END = 0.85;
export const SVG_WIDTH = 1000;
export const SVG_HEIGHT = 256;

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

export function hazardRate(t: number, maxShots: number): number {
  const x = t / maxShots;
  const infant = 0.8 * Math.exp(-12 * x);
  const wearout = x > 0.75 ? 0.9 * Math.pow((x - 0.75) / 0.25, 3) : 0;
  const baseline = 0.05;
  return infant + baseline + wearout;
}

export function getReliabilityRatio(shots: number, maxShots: number): number {
  const steps = 500;
  let integral = 0;
  for (let i = 1; i <= steps; i += 1) {
    const t0 = ((i - 1) / steps) * shots;
    const t1 = (i / steps) * shots;
    integral +=
      ((hazardRate(t0, maxShots) + hazardRate(t1, maxShots)) / 2) *
      ((t1 - t0) / maxShots);
  }
  return Math.exp(-integral * 5);
}

export function getMaxHazard(maxShots: number): number {
  let maxH = 0;
  for (let i = 0; i <= 200; i += 1) {
    const t = (i / 200) * maxShots;
    const h = hazardRate(t, maxShots);
    if (h > maxH) maxH = h;
  }
  return maxH;
}

export function generateCurvePath(maxShots: number): string {
  const points: Array<{ x: number; y: number }> = [];
  const steps = 200;
  const maxH = getMaxHazard(maxShots);

  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * maxShots;
    const h = hazardRate(t, maxShots);
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

export function generateFillPath(maxShots: number): string {
  const curvePath = generateCurvePath(maxShots);
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
