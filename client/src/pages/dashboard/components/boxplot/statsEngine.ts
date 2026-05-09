/**
 * Statistical Math Engine for Boxplot Analysis
 * Computes five-number summary, mean, sigma, Tukey outliers, Cp/Cpk
 */

export interface BoxplotStats {
  label: string;
  labelEn: string;
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  sigma: number;
  iqr: number;
  outliers: number[];
  whiskerLow: number;
  whiskerHigh: number;
}

export interface ProcessCapability {
  cp: number;
  cpk: number;
}

export interface GlobalStats {
  totalSamples: number;
  globalMean: number;
  globalSigma: number;
  avgDeviation: number;
  totalOutliers: number;
  outOfSpecCount: number;
  overUslCount: number;
  underLslCount: number;
  cp: number;
  cpk: number;
  stability: number;
  // Per-station anomaly details for root cause analysis
  anomalyDetails: AnomalyDetail[];
}

export interface AnomalyDetail {
  station: string;
  value: number;
  type: 'over-usl' | 'under-lsl' | 'tukey-outlier';
}

function sortedCopy(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function stdDev(arr: number[], avg: number): number {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function computeBoxplotStats(label: string, labelEn: string, rawValues: number[]): BoxplotStats {
  if (rawValues.length === 0) {
    return { label, labelEn, n: 0, min: 0, q1: 0, median: 0, q3: 0, max: 0, mean: 0, sigma: 0, iqr: 0, outliers: [], whiskerLow: 0, whiskerHigh: 0 };
  }

  const sorted = sortedCopy(rawValues);
  const n = sorted.length;
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const med = percentile(sorted, 50);
  const iqr = q3 - q1;
  const avg = mean(rawValues);
  const sigma = stdDev(rawValues, avg);

  // Tukey's fences
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const outliers: number[] = [];
  const inliers: number[] = [];

  for (const v of sorted) {
    if (v < lowerFence || v > upperFence) {
      outliers.push(v);
    } else {
      inliers.push(v);
    }
  }

  // Whiskers are min/max of inliers (non-outlier values)
  const whiskerLow = inliers.length > 0 ? inliers[0] : sorted[0];
  const whiskerHigh = inliers.length > 0 ? inliers[inliers.length - 1] : sorted[n - 1];

  return {
    label,
    labelEn,
    n,
    min: sorted[0],
    q1,
    median: med,
    q3,
    max: sorted[n - 1],
    mean: avg,
    sigma,
    iqr,
    outliers,
    whiskerLow,
    whiskerHigh,
  };
}

export function computeProcessCapability(avg: number, sigma: number, usl: number, lsl: number): ProcessCapability {
  if (sigma <= 0) return { cp: 0, cpk: 0 };
  const cp = (usl - lsl) / (6 * sigma);
  const cpk = Math.min((usl - avg) / (3 * sigma), (avg - lsl) / (3 * sigma));
  return { cp: Math.max(0, cp), cpk: Math.max(0, cpk) };
}

export function computeGlobalStats(stations: BoxplotStats[], usl: number, lsl: number, rawDataset?: Record<string, number[]>): GlobalStats {
  const totalSamples = stations.reduce((sum, s) => sum + s.n, 0);
  const totalOutliers = stations.reduce((sum, s) => sum + s.outliers.length, 0);

  if (totalSamples === 0) {
    return { totalSamples: 0, globalMean: 0, globalSigma: 0, avgDeviation: 0, totalOutliers: 0, outOfSpecCount: 0, overUslCount: 0, underLslCount: 0, cp: 0, cpk: 0, stability: 0, anomalyDetails: [] };
  }

  // Collect all raw values for precise global calculations
  const allValues: number[] = rawDataset
    ? Object.values(rawDataset).flat()
    : [];

  // Global mean from all raw values
  const globalMean = allValues.length > 0
    ? allValues.reduce((sum, v) => sum + v, 0) / allValues.length
    : stations.reduce((sum, s) => sum + s.mean * s.n, 0) / totalSamples;

  // Global sigma from all raw values
  const globalSigma = allValues.length > 1
    ? Math.sqrt(allValues.reduce((sum, v) => sum + (v - globalMean) ** 2, 0) / (allValues.length - 1))
    : Math.sqrt(stations.reduce((sum, s) => sum + (s.n - 1) * s.sigma ** 2, 0) / Math.max(1, totalSamples - stations.length));

  // Average deviation from nominal (midpoint of spec)
  const nominal = (usl + lsl) / 2;
  const avgDeviation = Math.abs(globalMean - nominal);

  const { cp, cpk } = computeProcessCapability(globalMean, globalSigma, usl, lsl);

  // Out-of-spec counts and anomaly details
  let overUslCount = 0;
  let underLslCount = 0;
  const anomalyDetails: AnomalyDetail[] = [];

  if (rawDataset) {
    for (const [station, values] of Object.entries(rawDataset)) {
      for (const v of values) {
        if (v > usl) {
          overUslCount++;
          anomalyDetails.push({ station, value: v, type: 'over-usl' });
        } else if (v < lsl) {
          underLslCount++;
          anomalyDetails.push({ station, value: v, type: 'under-lsl' });
        }
      }
    }
    // Add Tukey outliers that are within spec (not already counted)
    for (const s of stations) {
      for (const outlier of s.outliers) {
        if (outlier <= usl && outlier >= lsl) {
          anomalyDetails.push({ station: s.label, value: outlier, type: 'tukey-outlier' });
        }
      }
    }
  } else {
    for (const s of stations) {
      for (const outlier of s.outliers) {
        if (outlier > usl) { overUslCount++; anomalyDetails.push({ station: s.label, value: outlier, type: 'over-usl' }); }
        else if (outlier < lsl) { underLslCount++; anomalyDetails.push({ station: s.label, value: outlier, type: 'under-lsl' }); }
        else { anomalyDetails.push({ station: s.label, value: outlier, type: 'tukey-outlier' }); }
      }
    }
  }

  const outOfSpecCount = overUslCount + underLslCount;
  const stability = totalSamples > 0 ? ((totalSamples - outOfSpecCount) / totalSamples) * 100 : 0;

  return { totalSamples, globalMean, globalSigma, avgDeviation, totalOutliers, outOfSpecCount, overUslCount, underLslCount, cp, cpk, stability, anomalyDetails };
}
