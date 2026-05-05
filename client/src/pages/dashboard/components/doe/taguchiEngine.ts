export type TaguchiArrayName = 'L9' | 'L27';
export type TaguchiLevel = 1 | 2 | 3;

export type TaguchiFactorKey =
  | 'frontTemp'
  | 'backTemp'
  | 'sliderTemp'
  | 'p1'
  | 't1'
  | 'p2'
  | 't2'
  | 'p3'
  | 't3';

export type TaguchiLevelValues = readonly [string, string, string];
export type TaguchiFactorLevels = Record<TaguchiFactorKey, TaguchiLevelValues>;

export type TaguchiFactorToggles = {
  sliderTemp: boolean;
  stage2Hold: boolean;
  stage3Hold: boolean;
};

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

const FACTOR_META: Record<
  TaguchiFactorKey,
  Omit<TaguchiActiveFactor, 'key' | 'levels'>
> = {
  frontTemp: { label: '前模温度', shortLabel: '前模', unit: 'degC' },
  backTemp: { label: '后模温度', shortLabel: '后模', unit: 'degC' },
  sliderTemp: { label: '滑块模温', shortLabel: '滑块', unit: 'degC' },
  p1: { label: '第一段压力', shortLabel: 'P1', unit: 'MPa' },
  t1: { label: '第一段时间', shortLabel: 'T1', unit: 's' },
  p2: { label: '第二段压力', shortLabel: 'P2', unit: 'MPa' },
  t2: { label: '第二段时间', shortLabel: 'T2', unit: 's' },
  p3: { label: '第三段压力', shortLabel: 'P3', unit: 'MPa' },
  t3: { label: '第三段时间', shortLabel: 'T3', unit: 's' },
};

export function selectTaguchiArrayName(factorCount: number): TaguchiArrayName {
  if (factorCount <= 4) return 'L9';
  if (factorCount <= 9) return 'L27';
  throw new Error(`Taguchi DOE supports at most 9 active 3-level factors. Received ${factorCount}.`);
}

export function buildActiveFactors(
  toggles: TaguchiFactorToggles,
  factorLevels: TaguchiFactorLevels,
): TaguchiActiveFactor[] {
  const orderedKeys: TaguchiFactorKey[] = ['frontTemp', 'backTemp'];

  if (toggles.sliderTemp) {
    orderedKeys.push('sliderTemp');
  }

  orderedKeys.push('p1', 't1');

  if (toggles.stage2Hold) {
    orderedKeys.push('p2', 't2');
  }

  if (toggles.stage3Hold) {
    orderedKeys.push('p3', 't3');
  }

  return orderedKeys.map((key) => ({
    key,
    levels: factorLevels[key],
    ...FACTOR_META[key],
  }));
}

export function generateTaguchiMatrix(
  activeFactors: readonly TaguchiActiveFactor[],
): HydratedExperimentRow[] {
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

function coerceEngineeringValue(value: string): EngineeringValue {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : trimmed;
}
