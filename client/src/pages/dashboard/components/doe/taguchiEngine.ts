export type TaguchiArrayName = 'L9' | 'L27';
export type TaguchiLevel = 1 | 2 | 3;

export type TaguchiFactorKey =
  | 'factor1'
  | 'factor2'
  | 'factor3'
  | 'factor4'
  | 'factor5'
  | 'factor6'
  | 'factor7'
  | 'factor8'
  | 'factor9';

export const TAGUCHI_FACTOR_KEYS: readonly TaguchiFactorKey[] = [
  'factor1',
  'factor2',
  'factor3',
  'factor4',
  'factor5',
  'factor6',
  'factor7',
  'factor8',
  'factor9',
];

export type TaguchiLevelValues = readonly [string, string, string];

export type TaguchiFactorDefinition = {
  enabled: boolean;
  label: string;
  shortLabel: string;
  unit: string;
  levels: TaguchiLevelValues;
};

export type TaguchiFactorDefinitions = Record<TaguchiFactorKey, TaguchiFactorDefinition>;

export type TaguchiActiveFactor = {
  key: TaguchiFactorKey;
  label: string;
  shortLabel: string;
  unit: string;
  levels: TaguchiLevelValues;
};

export type EngineeringValue = number | string;

export type HydratedExperimentRow = {
  run: number;
  maxDeviation: string | null;
  scanImage: string | null;
  levelCodes: Partial<Record<TaguchiFactorKey, TaguchiLevel>>;
} & Partial<Record<TaguchiFactorKey, EngineeringValue>>;

export const L9_ARRAY: readonly (readonly TaguchiLevel[])[] = [
  [1, 1, 1, 1],
  [1, 2, 2, 2],
  [1, 3, 3, 3],
  [2, 1, 2, 3],
  [2, 2, 3, 1],
  [2, 3, 1, 2],
  [3, 1, 3, 2],
  [3, 2, 1, 3],
  [3, 3, 2, 1],
];

export const L27_ARRAY: readonly (readonly TaguchiLevel[])[] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 2, 1, 1, 2, 3, 2, 3],
  [1, 1, 3, 1, 1, 3, 2, 3, 2],
  [1, 2, 1, 2, 3, 1, 1, 2, 2],
  [1, 2, 2, 2, 3, 2, 3, 3, 1],
  [1, 2, 3, 2, 3, 3, 2, 1, 3],
  [1, 3, 1, 3, 2, 1, 1, 3, 3],
  [1, 3, 2, 3, 2, 2, 3, 1, 2],
  [1, 3, 3, 3, 2, 3, 2, 2, 1],
  [2, 1, 1, 2, 2, 2, 2, 1, 1],
  [2, 1, 2, 2, 2, 3, 1, 2, 3],
  [2, 1, 3, 2, 2, 1, 3, 3, 2],
  [2, 2, 1, 3, 1, 2, 2, 2, 2],
  [2, 2, 2, 3, 1, 3, 1, 3, 1],
  [2, 2, 3, 3, 1, 1, 3, 1, 3],
  [2, 3, 1, 1, 3, 2, 2, 3, 3],
  [2, 3, 2, 1, 3, 3, 1, 1, 2],
  [2, 3, 3, 1, 3, 1, 3, 2, 1],
  [3, 1, 1, 3, 3, 3, 3, 1, 1],
  [3, 1, 2, 3, 3, 1, 2, 2, 3],
  [3, 1, 3, 3, 3, 2, 1, 3, 2],
  [3, 2, 1, 1, 2, 3, 3, 2, 2],
  [3, 2, 2, 1, 2, 1, 2, 3, 1],
  [3, 2, 3, 1, 2, 2, 1, 1, 3],
  [3, 3, 1, 2, 1, 3, 3, 3, 3],
  [3, 3, 2, 2, 1, 1, 2, 1, 2],
  [3, 3, 3, 2, 1, 2, 1, 2, 1],
];

const TAGUCHI_ARRAYS: Record<TaguchiArrayName, readonly (readonly TaguchiLevel[])[]> = {
  L9: L9_ARRAY,
  L27: L27_ARRAY,
};

const TAGUCHI_LEVEL_VALIDATION_ERROR =
  '\u751f\u6210\u77e9\u9635\u524d\uff0c\u6bcf\u4e2a\u542f\u7528\u7684 DOE \u56e0\u5b50\u90fd\u5fc5\u987b\u63d0\u4f9b 3 \u4e2a\u4e92\u4e0d\u91cd\u590d\u4e14\u975e 0 \u7684\u6c34\u5e73\u503c\u3002';

export function selectTaguchiArrayName(factorCount: number): TaguchiArrayName {
  if (factorCount < 1) {
    throw new Error('\u8bf7\u81f3\u5c11\u542f\u7528 1 \u4e2a\u56e0\u5b50\u540e\u518d\u751f\u6210 Taguchi \u77e9\u9635\u3002');
  }

  if (factorCount <= 4) return 'L9';
  if (factorCount <= 9) return 'L27';

  throw new Error(`Taguchi DOE \u6700\u591a\u652f\u6301 9 \u4e2a\u542f\u7528\u7684 3 \u6c34\u5e73\u56e0\u5b50\uff0c\u5f53\u524d\u4e3a ${factorCount} \u4e2a\u3002`);
}

export function buildActiveFactors(definitions: TaguchiFactorDefinitions): TaguchiActiveFactor[] {
  return TAGUCHI_FACTOR_KEYS
    .filter((key) => definitions[key].enabled)
    .map((key) => ({
      key,
      label: definitions[key].label.trim() || definitions[key].shortLabel,
      shortLabel: definitions[key].shortLabel.trim() || definitions[key].label.trim() || key.toUpperCase(),
      unit: definitions[key].unit.trim(),
      levels: definitions[key].levels,
    }));
}

export function generateTaguchiMatrix(activeFactors: readonly TaguchiActiveFactor[]): HydratedExperimentRow[] {
  validateActiveFactors(activeFactors);

  const arrayName = selectTaguchiArrayName(activeFactors.length);
  const selectedArray = TAGUCHI_ARRAYS[arrayName];

  return selectedArray.map((arrayRow, rowIndex) => {
    const hydrated: HydratedExperimentRow = {
      run: rowIndex + 1,
      maxDeviation: null,
      scanImage: null,
      levelCodes: {},
    };

    activeFactors.forEach((factor, columnIndex) => {
      const levelCode = arrayRow[columnIndex];
      hydrated.levelCodes[factor.key] = levelCode;
      hydrated[factor.key] = coerceEngineeringValue(factor.levels[levelCode - 1]);
    });

    return hydrated;
  });
}

function validateActiveFactors(activeFactors: readonly TaguchiActiveFactor[]): void {
  activeFactors.forEach((factor) => {
    const normalizedLevels = factor.levels.map(normalizeLevelValue);

    if (normalizedLevels.some((level) => !level || level === '0')) {
      throw new Error(TAGUCHI_LEVEL_VALIDATION_ERROR);
    }

    if (new Set(normalizedLevels).size !== normalizedLevels.length) {
      throw new Error(TAGUCHI_LEVEL_VALIDATION_ERROR);
    }
  });
}

function coerceEngineeringValue(value: string): EngineeringValue {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : trimmed;
}

function normalizeLevelValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) {
    return trimmed;
  }

  return String(numericValue);
}
