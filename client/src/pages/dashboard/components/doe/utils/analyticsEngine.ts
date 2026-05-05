import type {
  EngineeringValue,
  HydratedExperimentRow,
  TaguchiActiveFactor,
  TaguchiFactorKey,
  TaguchiLevel,
} from '../taguchiEngine';

const SAFE_DEVIATION_FLOOR = 1e-5;
const TAGUCHI_LEVELS: readonly TaguchiLevel[] = [1, 2, 3];

export type SnRatioRow = {
  run: number;
  maxDeviation: number;
  snRatio: number;
};

export type FactorMainEffect = {
  factorKey: TaguchiFactorKey;
  factor: string;
  shortLabel: string;
  unit: string;
  L1: number;
  L2: number;
  L3: number;
  delta: number;
  bestLevel: TaguchiLevel;
  bestValue: EngineeringValue;
};

export type MainEffectsLinePoint = {
  level: 'L1' | 'L2' | 'L3';
} & Partial<Record<TaguchiFactorKey, number>>;

export type DeltaChartRow = {
  factorKey: TaguchiFactorKey;
  factor: string;
  shortLabel: string;
  delta: number;
};

export type OptimalParameter = {
  factorKey: TaguchiFactorKey;
  factor: string;
  shortLabel: string;
  unit: string;
  level: TaguchiLevel;
  value: EngineeringValue;
  snRatioMean: number;
};

export type TaguchiAnalyticsResult = {
  rowSnRatios: SnRatioRow[];
  mainEffects: FactorMainEffect[];
  lineChartData: MainEffectsLinePoint[];
  deltaChartData: DeltaChartRow[];
  optimalSet: OptimalParameter[];
};

export type InvalidDeviationRow = {
  run: number;
  reason: 'empty' | 'non_numeric' | 'negative';
};

export class TaguchiAnalyticsInputError extends Error {
  invalidRows: InvalidDeviationRow[];

  constructor(invalidRows: InvalidDeviationRow[]) {
    super('Invalid maxDeviation values for Taguchi S/N analysis.');
    this.name = 'TaguchiAnalyticsInputError';
    this.invalidRows = invalidRows;
  }
}

export function calculateSmallerTheBetterSnRatio(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error('At least one deviation value is required for S/N calculation.');
  }

  const meanSquare =
    values.reduce((sum, value) => {
      const safeY = Math.max(value, SAFE_DEVIATION_FLOOR);
      return sum + safeY ** 2;
    }, 0) / values.length;

  return -10 * Math.log10(meanSquare);
}

export function validateDeviationInputs(rows: readonly HydratedExperimentRow[]): InvalidDeviationRow[] {
  return rows.flatMap((row) => {
    const parsed = parseDeviation(row.maxDeviation);

    if (parsed.status === 'ok') return [];
    return [{ run: row.run, reason: parsed.status }];
  });
}

export function analyzeTaguchiMatrix(
  rows: readonly HydratedExperimentRow[],
  activeFactors: readonly TaguchiActiveFactor[],
): TaguchiAnalyticsResult {
  const invalidRows = validateDeviationInputs(rows);

  if (invalidRows.length > 0) {
    throw new TaguchiAnalyticsInputError(invalidRows);
  }

  const rowSnRatios = rows.map((row) => {
    const parsed = parseDeviation(row.maxDeviation);

    if (parsed.status !== 'ok') {
      throw new TaguchiAnalyticsInputError([{ run: row.run, reason: parsed.status }]);
    }

    return {
      run: row.run,
      maxDeviation: parsed.value,
      snRatio: calculateSmallerTheBetterSnRatio([parsed.value]),
    };
  });

  const snRatioByRun = new Map(rowSnRatios.map((row) => [row.run, row.snRatio]));

  const mainEffects = activeFactors.map((factor) => {
    const levelMeans = TAGUCHI_LEVELS.map((level) => {
      const ratios = rows
        .filter((row) => row.levelCodes[factor.key] === level)
        .map((row) => snRatioByRun.get(row.run))
        .filter((value): value is number => typeof value === 'number');

      return mean(ratios);
    }) as [number, number, number];

    const bestLevelIndex = indexOfMax(levelMeans);
    const delta = Math.max(...levelMeans) - Math.min(...levelMeans);
    const bestLevel = TAGUCHI_LEVELS[bestLevelIndex];

    return {
      factorKey: factor.key,
      factor: factor.label,
      shortLabel: factor.shortLabel,
      unit: factor.unit,
      L1: levelMeans[0],
      L2: levelMeans[1],
      L3: levelMeans[2],
      delta,
      bestLevel,
      bestValue: coerceEngineeringValue(factor.levels[bestLevel - 1]),
    } satisfies FactorMainEffect;
  });

  return {
    rowSnRatios,
    mainEffects,
    lineChartData: buildLineChartData(mainEffects),
    deltaChartData: mainEffects
      .map((effect) => ({
        factorKey: effect.factorKey,
        factor: effect.factor,
        shortLabel: effect.shortLabel,
        delta: effect.delta,
      }))
      .sort((a, b) => b.delta - a.delta),
    optimalSet: mainEffects.map((effect) => ({
      factorKey: effect.factorKey,
      factor: effect.factor,
      shortLabel: effect.shortLabel,
      unit: effect.unit,
      level: effect.bestLevel,
      value: effect.bestValue,
      snRatioMean: effect[`L${effect.bestLevel}`],
    })),
  };
}

function buildLineChartData(mainEffects: readonly FactorMainEffect[]): MainEffectsLinePoint[] {
  return TAGUCHI_LEVELS.map((level) => {
    const point: MainEffectsLinePoint = { level: `L${level}` };

    mainEffects.forEach((effect) => {
      point[effect.factorKey] = effect[`L${level}`];
    });

    return point;
  });
}

function parseDeviation(value: string | null): { status: 'ok'; value: number } | { status: InvalidDeviationRow['reason'] } {
  if (value === null || value.trim() === '') {
    return { status: 'empty' };
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return { status: 'non_numeric' };
  }

  if (numericValue < 0) {
    return { status: 'negative' };
  }

  return { status: 'ok', value: numericValue };
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function indexOfMax(values: readonly number[]): number {
  return values.reduce((bestIndex, value, index) => (value > values[bestIndex] ? index : bestIndex), 0);
}

function coerceEngineeringValue(value: string): EngineeringValue {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : trimmed;
}
