export type Measurements = number[][][];

export interface StudyConfig {
  operators: number;
  parts: number;
  trials: number;
  operatorNames: string[];
  partNames: string[];
  usl: number;
  lsl: number;
  historicalSigma?: number;
  alpha: number;
  measurements: Measurements;
}

export interface GrrStudyMeta {
  partName: string;
  characteristic: string;
  gageId: string;
  date: string;
}

export interface GrrWorkspaceState {
  version: 1;
  meta: GrrStudyMeta;
  cfg: StudyConfig;
}

export const toleranceOf = (cfg: { usl: number; lsl: number }) => Math.max(0, cfg.usl - cfg.lsl);

const A2: Record<number, number> = { 2: 1.88, 3: 1.023, 4: 0.729, 5: 0.577, 6: 0.483, 7: 0.419 };
const D4: Record<number, number> = { 2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114, 6: 2.004, 7: 1.924 };
const D3: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0.076 };
const SIGMA = 6;
const NOMINAL = 25;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const mean = (xs: number[]) => xs.reduce((sum, value) => sum + value, 0) / xs.length;
const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

function logGamma(x: number): number {
  const g = 7;
  const coefficients = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }

  let shifted = x - 1;
  let sum = coefficients[0];
  const t = shifted + g + 0.5;
  for (let index = 1; index < g + 2; index += 1) {
    sum += coefficients[index] / (shifted + index);
  }
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum);
}

function betacf(a: number, b: number, x: number): number {
  const minimum = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < minimum) d = minimum;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= 200; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + aa / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + aa / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-7) break;
  }

  return h;
}

function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

export function fPValue(f: number, d1: number, d2: number): number {
  if (!Number.isFinite(f) || f <= 0 || d1 <= 0 || d2 <= 0) return 1;
  const x = d2 / (d2 + d1 * f);
  return betai(d2 / 2, d1 / 2, x);
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const operatorName = (index: number) => `APPRAISER ${LETTERS[index] ?? index + 1}`;
export const partName = (index: number) => `P${String(index + 1).padStart(2, '0')}`;

function genMeasurements(operators: number, parts: number, trials: number): Measurements {
  const random = mulberry32(42);
  const partTrue = Array.from({ length: parts }, (_, part) => NOMINAL + (part - parts / 2) * 0.42);
  const operatorBias = Array.from(
    { length: operators },
    (_, operator) => (operator - (operators - 1) / 2) * 0.045,
  );

  return Array.from({ length: operators }, (_, operator) =>
    Array.from({ length: parts }, (_, part) =>
      Array.from({ length: trials }, () => {
        const noise = (random() - 0.5) * 0.12;
        return +(partTrue[part] + operatorBias[operator] + noise).toFixed(3);
      }),
    ),
  );
}

export function buildDefaultStudy(): StudyConfig {
  const operators = 3;
  const parts = 10;
  const trials = 3;

  return {
    operators,
    parts,
    trials,
    operatorNames: Array.from({ length: operators }, (_, index) => operatorName(index)),
    partNames: Array.from({ length: parts }, (_, index) => partName(index)),
    usl: NOMINAL + 2,
    lsl: NOMINAL - 2,
    historicalSigma: 0,
    alpha: 0.05,
    measurements: genMeasurements(operators, parts, trials),
  };
}

export function buildDefaultGrrMeta(): GrrStudyMeta {
  return {
    partName: '',
    characteristic: '',
    gageId: '',
    date: new Date().toISOString().slice(0, 10),
  };
}

export function resizeStudy(
  cfg: StudyConfig,
  dims: { operators?: number; parts?: number; trials?: number },
): StudyConfig {
  const operators = Math.max(2, Math.min(8, dims.operators ?? cfg.operators));
  const parts = Math.max(2, Math.min(20, dims.parts ?? cfg.parts));
  const trials = Math.max(2, Math.min(7, dims.trials ?? cfg.trials));
  const seed = genMeasurements(operators, parts, trials);

  const measurements: Measurements = seed.map((operatorRows, operatorIndex) =>
    operatorRows.map((trialValues, partIndex) =>
      trialValues.map(
        (seedValue, trialIndex) => cfg.measurements[operatorIndex]?.[partIndex]?.[trialIndex] ?? seedValue,
      ),
    ),
  );

  return {
    ...cfg,
    operators,
    parts,
    trials,
    operatorNames: Array.from({ length: operators }, (_, index) => operatorName(index)),
    partNames: Array.from({ length: parts }, (_, index) => partName(index)),
    measurements,
  };
}

export type Verdict = 'acceptable' | 'marginal' | 'unacceptable';
export type DiagnosisTone = 'good' | 'warn' | 'fail';

export interface VariationComponent {
  key: string;
  label: string;
  stdDev: number;
  studyVar: number;
  pctStudyVar: number;
  pctContribution: number;
  pctTolerance: number;
}

export interface ControlPoint {
  index: number;
  operator: number;
  part: number;
  value: number;
  outOfControl: boolean;
}

export interface ControlChart {
  points: ControlPoint[];
  centerLine: number;
  ucl: number;
  lcl: number;
  operatorStarts: number[];
}

export interface Diagnosis {
  code: string;
  title: string;
  detail: string;
  tone: DiagnosisTone;
}

export interface RunPoint {
  operator: number;
  part: number;
  trial: number;
  value: number;
}

export interface AppraiserStat {
  operator: number;
  min: number;
  max: number;
  avg: number;
  spread: number;
}

export interface AnovaRow {
  key: string;
  label: string;
  df: number;
  ss: number;
  ms: number | null;
  f: number | null;
  p: number | null;
}

export interface AnovaTable {
  rows: AnovaRow[];
  pooled: boolean;
  alpha: number;
  interactionP: number;
}

export interface InteractionSeries {
  operator: number;
  points: { part: number; avg: number }[];
}

export interface GrrResults {
  components: VariationComponent[];
  grr: VariationComponent;
  totalVariation: number;
  ndc: number;
  tolerance: number;
  pctGrrStudyVar: number;
  pctGrrTolerance: number;
  verdict: Verdict;
  diagnosis: Diagnosis;
  anova: AnovaTable;
  interactionSeries: InteractionSeries[];
  usingHistoricalSigma: boolean;
  xbarChart: ControlChart;
  rChart: ControlChart;
  runPoints: RunPoint[];
  appraiserStats: AppraiserStat[];
  grandMean: number;
  operatorAverages: number[];
  operatorRanges: number[];
  partAverages: number[];
}

export function computeGrr(cfg: StudyConfig): GrrResults {
  const { operators, parts, trials, measurements } = cfg;
  const tolerance = toleranceOf(cfg);

  const cellMean: number[][] = [];
  const cellRange: number[][] = [];
  for (let operator = 0; operator < operators; operator += 1) {
    cellMean[operator] = [];
    cellRange[operator] = [];
    for (let part = 0; part < parts; part += 1) {
      const values = measurements[operator][part];
      cellMean[operator][part] = mean(values);
      cellRange[operator][part] = range(values);
    }
  }

  const operatorAverages = cellMean.map((row) => mean(row));
  const operatorRanges = cellRange.map((row) => mean(row));
  const rDoubleBar = mean(operatorRanges);
  const grandMean = mean(operatorAverages);

  const partAverages = Array.from({ length: parts }, (_, part) => {
    const values: number[] = [];
    for (let operator = 0; operator < operators; operator += 1) {
      values.push(...measurements[operator][part]);
    }
    return mean(values);
  });

  const p = parts;
  const k = operators;
  const n = trials;
  const totalObservations = p * k * n;

  let ssTotal = 0;
  for (let operator = 0; operator < k; operator += 1) {
    for (let part = 0; part < p; part += 1) {
      for (let trial = 0; trial < n; trial += 1) {
        ssTotal += Math.pow(measurements[operator][part][trial] - grandMean, 2);
      }
    }
  }

  let ssPart = 0;
  for (let part = 0; part < p; part += 1) ssPart += Math.pow(partAverages[part] - grandMean, 2);
  ssPart *= k * n;

  let ssOper = 0;
  for (let operator = 0; operator < k; operator += 1) {
    ssOper += Math.pow(operatorAverages[operator] - grandMean, 2);
  }
  ssOper *= p * n;

  let ssInter = 0;
  for (let operator = 0; operator < k; operator += 1) {
    for (let part = 0; part < p; part += 1) {
      ssInter += Math.pow(cellMean[operator][part] - partAverages[part] - operatorAverages[operator] + grandMean, 2);
    }
  }
  ssInter *= n;

  const ssError = Math.max(0, ssTotal - ssPart - ssOper - ssInter);

  const dfPart = p - 1;
  const dfOper = k - 1;
  const dfInter = (p - 1) * (k - 1);
  const dfError = p * k * (n - 1);
  const dfTotal = totalObservations - 1;

  const msPart = ssPart / dfPart;
  const msOper = ssOper / dfOper;
  const msInter = dfInter > 0 ? ssInter / dfInter : 0;
  const msError = dfError > 0 ? ssError / dfError : 0;

  const fInter = msError > 0 ? msInter / msError : 0;
  const interactionP = dfInter > 0 ? fPValue(fInter, dfInter, dfError) : 1;
  const alpha = cfg.alpha ?? 0.05;
  const pooled = interactionP >= alpha || dfInter <= 0;

  const ssErrEff = pooled ? ssInter + ssError : ssError;
  const dfErrEff = pooled ? dfInter + dfError : dfError;
  const msErrEff = dfErrEff > 0 ? ssErrEff / dfErrEff : 0;

  const denomMs = pooled ? msErrEff : msInter;
  const denomDf = pooled ? dfErrEff : dfInter;
  const fPart = denomMs > 0 ? msPart / denomMs : 0;
  const fOper = denomMs > 0 ? msOper / denomMs : 0;
  const pPart = fPValue(fPart, dfPart, denomDf);
  const pOper = fPValue(fOper, dfOper, denomDf);

  const varEquip = msErrEff;
  const varInter = pooled ? 0 : Math.max(0, (msInter - msError) / n);
  const varOper = pooled
    ? Math.max(0, (msOper - msErrEff) / (p * n))
    : Math.max(0, (msOper - msInter) / (p * n));
  const varPartAnova = pooled
    ? Math.max(0, (msPart - msErrEff) / (k * n))
    : Math.max(0, (msPart - msInter) / (k * n));

  const evSd = Math.sqrt(varEquip);
  const avSd = Math.sqrt(varOper + varInter);
  const grrSd = Math.sqrt(varEquip + varOper + varInter);

  const historicalSigma = cfg.historicalSigma && cfg.historicalSigma > 0 ? cfg.historicalSigma : 0;
  const usingHistoricalSigma = historicalSigma > 0;
  const tvSd = usingHistoricalSigma ? historicalSigma : Math.sqrt(grrSd * grrSd + varPartAnova);
  const pvSd = usingHistoricalSigma ? Math.sqrt(Math.max(0, tvSd * tvSd - grrSd * grrSd)) : Math.sqrt(varPartAnova);

  const anova: AnovaTable = {
    pooled,
    alpha,
    interactionP,
    rows: pooled
      ? [
          { key: 'PART', label: 'Part / Part variation', df: dfPart, ss: ssPart, ms: msPart, f: fPart, p: pPart },
          {
            key: 'OPER',
            label: 'Appraiser / Reproducibility',
            df: dfOper,
            ss: ssOper,
            ms: msOper,
            f: fOper,
            p: pOper,
          },
          {
            key: 'REPEAT',
            label: 'Repeatability (pooled)',
            df: dfErrEff,
            ss: ssErrEff,
            ms: msErrEff,
            f: null,
            p: null,
          },
          { key: 'TOTAL', label: 'Total', df: dfTotal, ss: ssTotal, ms: null, f: null, p: null },
        ]
      : [
          { key: 'PART', label: 'Part / Part variation', df: dfPart, ss: ssPart, ms: msPart, f: fPart, p: pPart },
          {
            key: 'OPER',
            label: 'Appraiser / Reproducibility',
            df: dfOper,
            ss: ssOper,
            ms: msOper,
            f: fOper,
            p: pOper,
          },
          {
            key: 'INTER',
            label: 'Part x Appraiser interaction',
            df: dfInter,
            ss: ssInter,
            ms: msInter,
            f: fInter,
            p: interactionP,
          },
          {
            key: 'REPEAT',
            label: 'Repeatability',
            df: dfError,
            ss: ssError,
            ms: msError,
            f: null,
            p: null,
          },
          { key: 'TOTAL', label: 'Total', df: dfTotal, ss: ssTotal, ms: null, f: null, p: null },
        ],
  };

  const interactionSeries: InteractionSeries[] = [];
  for (let operator = 0; operator < k; operator += 1) {
    interactionSeries.push({
      operator,
      points: Array.from({ length: p }, (_, part) => ({ part, avg: cellMean[operator][part] })),
    });
  }

  const createComponent = (key: string, label: string, sd: number): VariationComponent => ({
    key,
    label,
    stdDev: sd,
    studyVar: SIGMA * sd,
    pctStudyVar: tvSd ? (sd / tvSd) * 100 : 0,
    pctContribution: tvSd ? (Math.pow(sd, 2) / Math.pow(tvSd, 2)) * 100 : 0,
    pctTolerance: tolerance ? ((SIGMA * sd) / tolerance) * 100 : 0,
  });

  const ev = createComponent('EV', 'Repeatability (EV)', evSd);
  const av = createComponent('AV', 'Reproducibility (AV)', avSd);
  const pv = createComponent('PV', 'Part Variation (PV)', pvSd);
  const grr = createComponent('GRR', 'Gage R&R', grrSd);

  const ndc = Math.max(1, Math.floor(1.41 * (pvSd / (grrSd || 1e-9))));
  const pctGrrStudyVar = grr.pctStudyVar;
  const pctGrrTolerance = grr.pctTolerance;

  let verdict: Verdict = 'acceptable';
  if (pctGrrStudyVar > 30) verdict = 'unacceptable';
  else if (pctGrrStudyVar >= 10) verdict = 'marginal';

  const evVar = evSd * evSd;
  const avVar = avSd * avSd;
  const grrVar = evVar + avVar || 1e-12;
  const avShare = (avVar / grrVar) * 100;
  const evShare = (evVar / grrVar) * 100;
  const tone: DiagnosisTone = verdict === 'acceptable' ? 'good' : verdict === 'marginal' ? 'warn' : 'fail';

  let diagnosis: Diagnosis;
  if (verdict === 'acceptable') {
    diagnosis = {
      code: 'OPTIMAL',
      title: 'System acceptable',
      detail: `Gage R&R accounts for ${pctGrrStudyVar.toFixed(1)}% of total study variation. The study resolves ${ndc} distinct categories, and part-to-part variation remains the dominant signal.`,
      tone,
    };
  } else if (avShare >= evShare) {
    diagnosis = {
      code: 'AV_DOMINANT',
      title: 'Appraiser variation is dominant',
      detail: `Reproducibility contributes about ${avShare.toFixed(0)}% of the gage error. Operators are reading the same parts differently, so standard work, fixturing, and measurement training should be reviewed first.`,
      tone,
    };
  } else {
    diagnosis = {
      code: 'EV_DOMINANT',
      title: 'Equipment variation is dominant',
      detail: `Repeatability contributes about ${evShare.toFixed(0)}% of the gage error. The same operator is not reproducing the same reading consistently, so the instrument, resolution, calibration, and setup stability should be checked first.`,
      tone,
    };
  }

  const runPoints: RunPoint[] = [];
  for (let operator = 0; operator < operators; operator += 1) {
    for (let part = 0; part < parts; part += 1) {
      for (let trial = 0; trial < trials; trial += 1) {
        runPoints.push({ operator, part, trial, value: measurements[operator][part][trial] });
      }
    }
  }

  const appraiserStats: AppraiserStat[] = [];
  for (let operator = 0; operator < operators; operator += 1) {
    const values: number[] = [];
    for (let part = 0; part < parts; part += 1) {
      values.push(...measurements[operator][part]);
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    appraiserStats.push({ operator, min, max, avg: mean(values), spread: max - min });
  }

  const a2 = A2[trials] ?? A2[7];
  const d4 = D4[trials] ?? D4[7];
  const d3 = D3[trials] ?? D3[7];
  const xUcl = grandMean + a2 * rDoubleBar;
  const xLcl = grandMean - a2 * rDoubleBar;
  const rUcl = d4 * rDoubleBar;
  const rLcl = d3 * rDoubleBar;

  const xPoints: ControlPoint[] = [];
  const rPoints: ControlPoint[] = [];
  const operatorStarts: number[] = [];
  let index = 0;

  for (let operator = 0; operator < operators; operator += 1) {
    operatorStarts.push(index);
    for (let part = 0; part < parts; part += 1) {
      const xValue = cellMean[operator][part];
      const rValue = cellRange[operator][part];
      xPoints.push({
        index,
        operator,
        part,
        value: xValue,
        outOfControl: xValue > xUcl || xValue < xLcl,
      });
      rPoints.push({
        index,
        operator,
        part,
        value: rValue,
        outOfControl: rValue > rUcl || rValue < rLcl,
      });
      index += 1;
    }
  }

  return {
    components: [ev, av, pv],
    grr,
    totalVariation: SIGMA * tvSd,
    ndc,
    tolerance,
    pctGrrStudyVar,
    pctGrrTolerance,
    verdict,
    diagnosis,
    anova,
    interactionSeries,
    usingHistoricalSigma,
    xbarChart: { points: xPoints, centerLine: grandMean, ucl: xUcl, lcl: xLcl, operatorStarts },
    rChart: { points: rPoints, centerLine: rDoubleBar, ucl: rUcl, lcl: rLcl, operatorStarts },
    runPoints,
    appraiserStats,
    grandMean,
    operatorAverages,
    operatorRanges,
    partAverages,
  };
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeGrrStudyConfig(value: unknown): StudyConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const fallback = buildDefaultStudy();
  const operators = Math.max(2, Math.min(8, Math.trunc(normalizeNumber(record.operators, fallback.operators))));
  const parts = Math.max(2, Math.min(20, Math.trunc(normalizeNumber(record.parts, fallback.parts))));
  const trials = Math.max(2, Math.min(7, Math.trunc(normalizeNumber(record.trials, fallback.trials))));
  const resized = resizeStudy(fallback, { operators, parts, trials });
  const measurementsInput = Array.isArray(record.measurements) ? record.measurements : [];

  const measurements: Measurements = Array.from({ length: operators }, (_, operator) =>
    Array.from({ length: parts }, (_, part) =>
      Array.from({ length: trials }, (_, trial) => {
        const candidate = (measurementsInput[operator] as unknown[] | undefined)?.[part];
        const value = (candidate as unknown[] | undefined)?.[trial];
        return normalizeNumber(value, resized.measurements[operator][part][trial]);
      }),
    ),
  );

  return {
    operators,
    parts,
    trials,
    operatorNames: Array.from({ length: operators }, (_, index) => operatorName(index)),
    partNames: Array.from({ length: parts }, (_, index) => partName(index)),
    usl: normalizeNumber(record.usl, resized.usl),
    lsl: normalizeNumber(record.lsl, resized.lsl),
    historicalSigma: Math.max(0, normalizeNumber(record.historicalSigma, resized.historicalSigma ?? 0)),
    alpha: Math.min(0.5, Math.max(0.01, normalizeNumber(record.alpha, resized.alpha))),
    measurements,
  };
}

export function normalizeGrrStudyMeta(value: unknown): GrrStudyMeta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return buildDefaultGrrMeta();
  }

  const record = value as Record<string, unknown>;
  const fallback = buildDefaultGrrMeta();
  return {
    partName: normalizeText(record.partName),
    characteristic: normalizeText(record.characteristic),
    gageId: normalizeText(record.gageId),
    date: normalizeText(record.date, fallback.date),
  };
}

export function normalizeGrrWorkspaceState(value: unknown): GrrWorkspaceState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const cfg = normalizeGrrStudyConfig(record.cfg);
  if (!cfg) return null;

  return {
    version: 1,
    meta: normalizeGrrStudyMeta(record.meta),
    cfg,
  };
}
