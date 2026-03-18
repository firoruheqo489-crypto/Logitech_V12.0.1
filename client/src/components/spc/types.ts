export interface SPCSubgroup {
  id: string;
  shift: string;
  x1: number;
  x2: number;
  x3: number;
  x4: number;
  x5: number;
  xBar: number;
  r: number;
  isOOC?: boolean;
}

export interface CTQMetrics {
  target: number;
  usl: number;
  lsl: number;
  grandMean: number;
  avgRange: number;
  estSigma: number;
  cp: number;
  cpk: number;
  pp: number;
  ppk: number;
  nelsonRuleViolation: string | null;
}

export interface CTQControlChartDataset {
  title: string;
  metrics: CTQMetrics;
  subgroups: SPCSubgroup[];
}
