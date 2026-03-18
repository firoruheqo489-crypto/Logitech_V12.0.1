import type { CTQControlChartDataset, CTQMetrics, SPCSubgroup } from './types';

function createSubgroup(id: number, shift: string, values: [number, number, number, number, number], isOOC = false): SPCSubgroup {
  const [x1, x2, x3, x4, x5] = values;
  const xBar = Number(((x1 + x2 + x3 + x4 + x5) / 5).toFixed(4));
  const r = Number((Math.max(x1, x2, x3, x4, x5) - Math.min(x1, x2, x3, x4, x5)).toFixed(4));

  return {
    id: String(id).padStart(2, '0'),
    shift,
    x1,
    x2,
    x3,
    x4,
    x5,
    xBar,
    r,
    isOOC,
  };
}

const ctq1Metrics: CTQMetrics = {
  target: 12.5,
  usl: 12.65,
  lsl: 12.35,
  grandMean: 12.5006,
  avgRange: 0.0318,
  estSigma: 0.0137,
  cp: 3.66,
  cpk: 2.84,
  pp: 3.42,
  ppk: 2.71,
  nelsonRuleViolation: null,
};

const ctq2Metrics: CTQMetrics = {
  target: 0.85,
  usl: 1.0,
  lsl: 0.7,
  grandMean: 0.8872,
  avgRange: 0.0396,
  estSigma: 0.017,
  cp: 2.94,
  cpk: 0.85,
  pp: 1.72,
  ppk: 0.81,
  nelsonRuleViolation: 'Rule 1 Violation - 03-22 (N)',
};

const ctq1Subgroups: SPCSubgroup[] = [
  createSubgroup(1, '03-10 (D)', [12.51, 12.49, 12.52, 12.5, 12.48]),
  createSubgroup(2, '03-10 (N)', [12.53, 12.5, 12.51, 12.49, 12.52]),
  createSubgroup(3, '03-11 (D)', [12.5, 12.52, 12.48, 12.51, 12.5]),
  createSubgroup(4, '03-11 (N)', [12.49, 12.51, 12.53, 12.5, 12.52]),
  createSubgroup(5, '03-12 (D)', [12.52, 12.5, 12.49, 12.51, 12.48]),
  createSubgroup(6, '03-12 (N)', [12.51, 12.53, 12.5, 12.49, 12.52]),
  createSubgroup(7, '03-13 (D)', [12.48, 12.5, 12.52, 12.51, 12.49]),
  createSubgroup(8, '03-13 (N)', [12.5, 12.51, 12.49, 12.53, 12.5]),
  createSubgroup(9, '03-14 (D)', [12.52, 12.49, 12.51, 12.5, 12.48]),
  createSubgroup(10, '03-14 (N)', [12.51, 12.5, 12.52, 12.49, 12.53]),
  createSubgroup(11, '03-15 (D)', [12.49, 12.52, 12.5, 12.51, 12.48]),
  createSubgroup(12, '03-15 (N)', [12.53, 12.5, 12.49, 12.52, 12.51]),
  createSubgroup(13, '03-16 (D)', [12.5, 12.48, 12.52, 12.51, 12.49]),
  createSubgroup(14, '03-16 (N)', [12.51, 12.52, 12.5, 12.49, 12.53]),
  createSubgroup(15, '03-17 (D)', [12.49, 12.5, 12.51, 12.52, 12.48]),
  createSubgroup(16, '03-17 (N)', [12.52, 12.51, 12.49, 12.5, 12.53]),
  createSubgroup(17, '03-18 (D)', [12.5, 12.49, 12.53, 12.51, 12.52]),
  createSubgroup(18, '03-18 (N)', [12.48, 12.52, 12.5, 12.51, 12.49]),
  createSubgroup(19, '03-19 (D)', [12.53, 12.51, 12.5, 12.49, 12.52]),
  createSubgroup(20, '03-19 (N)', [12.5, 12.52, 12.51, 12.48, 12.49]),
  createSubgroup(21, '03-20 (D)', [12.51, 12.49, 12.5, 12.48, 12.52]),
  createSubgroup(22, '03-20 (N)', [12.49, 12.51, 12.5, 12.52, 12.48]),
  createSubgroup(23, '03-21 (D)', [12.5, 12.51, 12.49, 12.52, 12.5]),
  createSubgroup(24, '03-21 (N)', [12.52, 12.5, 12.48, 12.51, 12.49]),
  createSubgroup(25, '03-22 (D)', [12.49, 12.5, 12.51, 12.5, 12.48]),
  createSubgroup(26, '03-22 (N)', [12.51, 12.5, 12.49, 12.52, 12.5]),
];

const ctq2Subgroups: SPCSubgroup[] = [
  createSubgroup(1, '03-10 (D)', [0.82, 0.85, 0.8, 0.83, 0.84]),
  createSubgroup(2, '03-10 (N)', [0.84, 0.81, 0.86, 0.83, 0.82]),
  createSubgroup(3, '03-11 (D)', [0.83, 0.85, 0.82, 0.86, 0.84]),
  createSubgroup(4, '03-11 (N)', [0.85, 0.83, 0.87, 0.84, 0.86]),
  createSubgroup(5, '03-12 (D)', [0.86, 0.84, 0.88, 0.85, 0.83]),
  createSubgroup(6, '03-12 (N)', [0.84, 0.87, 0.83, 0.86, 0.85]),
  createSubgroup(7, '03-13 (D)', [0.87, 0.85, 0.89, 0.86, 0.84]),
  createSubgroup(8, '03-13 (N)', [0.85, 0.88, 0.84, 0.87, 0.86]),
  createSubgroup(9, '03-14 (D)', [0.88, 0.86, 0.84, 0.87, 0.85]),
  createSubgroup(10, '03-14 (N)', [0.86, 0.89, 0.85, 0.88, 0.87]),
  createSubgroup(11, '03-15 (D)', [0.89, 0.87, 0.85, 0.88, 0.86]),
  createSubgroup(12, '03-15 (N)', [0.87, 0.9, 0.86, 0.89, 0.88]),
  createSubgroup(13, '03-16 (D)', [0.88, 0.86, 0.9, 0.87, 0.89]),
  createSubgroup(14, '03-16 (N)', [0.9, 0.88, 0.86, 0.89, 0.87]),
  createSubgroup(15, '03-17 (D)', [0.89, 0.91, 0.87, 0.9, 0.88]),
  createSubgroup(16, '03-17 (N)', [0.91, 0.89, 0.87, 0.9, 0.88]),
  createSubgroup(17, '03-18 (D)', [0.9, 0.92, 0.88, 0.91, 0.89]),
  createSubgroup(18, '03-18 (N)', [0.88, 0.91, 0.89, 0.92, 0.9]),
  createSubgroup(19, '03-19 (D)', [0.92, 0.9, 0.88, 0.91, 0.89]),
  createSubgroup(20, '03-19 (N)', [0.91, 0.93, 0.89, 0.92, 0.9]),
  createSubgroup(21, '03-20 (D)', [0.9, 0.91, 0.88, 0.9, 0.89]),
  createSubgroup(22, '03-20 (N)', [0.89, 0.91, 0.87, 0.9, 0.88]),
  createSubgroup(23, '03-21 (D)', [0.9, 0.88, 0.92, 0.89, 0.91]),
  createSubgroup(24, '03-21 (N)', [0.91, 0.89, 0.93, 0.9, 0.92]),
  createSubgroup(25, '03-22 (D)', [0.89, 0.9, 0.88, 0.91, 0.89]),
  createSubgroup(26, '03-22 (N)', [0.95, 0.96, 0.94, 0.97, 0.93], true),
];

export const ctq1Dataset: CTQControlChartDataset = {
  title: 'CTQ-1: 前端内孔直径 / INNER BORE DIA',
  metrics: ctq1Metrics,
  subgroups: ctq1Subgroups,
};

export const ctq2Dataset: CTQControlChartDataset = {
  title: 'CTQ-2: 卡扣间隙 / SNAP-FIT GAP',
  metrics: ctq2Metrics,
  subgroups: ctq2Subgroups,
};
