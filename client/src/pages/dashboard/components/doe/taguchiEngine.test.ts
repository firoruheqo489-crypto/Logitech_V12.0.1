import { describe, expect, it } from 'vitest';
import {
  buildActiveFactors,
  generateTaguchiMatrix,
  selectTaguchiArrayName,
  type TaguchiFactorDefinitions,
} from './taguchiEngine';

const factorDefinitions: TaguchiFactorDefinitions = {
  factor1: { enabled: true, label: 'Factor 1', shortLabel: 'F1', unit: '', levels: ['75', '80', '85'] },
  factor2: { enabled: true, label: 'Factor 2', shortLabel: 'F2', unit: '', levels: ['70', '75', '80'] },
  factor3: { enabled: false, label: 'Factor 3', shortLabel: 'F3', unit: '', levels: ['65', '70', '75'] },
  factor4: { enabled: true, label: 'Factor 4', shortLabel: 'F4', unit: '', levels: ['55', '60', '65'] },
  factor5: { enabled: true, label: 'Factor 5', shortLabel: 'F5', unit: '', levels: ['2.0', '2.5', '3.0'] },
  factor6: { enabled: false, label: 'Factor 6', shortLabel: 'F6', unit: '', levels: ['45', '50', '55'] },
  factor7: { enabled: false, label: 'Factor 7', shortLabel: 'F7', unit: '', levels: ['2.5', '3.0', '3.5'] },
  factor8: { enabled: false, label: 'Factor 8', shortLabel: 'F8', unit: '', levels: ['35', '40', '45'] },
  factor9: { enabled: false, label: 'Factor 9', shortLabel: 'F9', unit: '', levels: ['1.5', '2.0', '2.5'] },
};

describe('taguchiEngine', () => {
  it('maps 1-4 active factors to L9 and hydrates level values', () => {
    const activeFactors = buildActiveFactors(factorDefinitions);
    const matrix = generateTaguchiMatrix(activeFactors);

    expect(selectTaguchiArrayName(activeFactors.length)).toBe('L9');
    expect(activeFactors.map((factor) => factor.key)).toEqual(['factor1', 'factor2', 'factor4', 'factor5']);
    expect(matrix).toHaveLength(9);
    expect(matrix[0]).toMatchObject({
      run: 1,
      factor1: 75,
      factor2: 70,
      factor4: 55,
      factor5: 2,
      maxDeviation: null,
      scanImage: null,
    });
    expect(matrix[1]).toMatchObject({
      run: 2,
      factor1: 75,
      factor2: 75,
      factor4: 60,
      factor5: 2.5,
    });
  });

  it('maps 5-9 active factors to L27 while preserving active factor order', () => {
    const activeFactors = buildActiveFactors({
      ...factorDefinitions,
      factor3: { ...factorDefinitions.factor3, enabled: true },
      factor6: { ...factorDefinitions.factor6, enabled: true },
      factor7: { ...factorDefinitions.factor7, enabled: true },
    });
    const matrix = generateTaguchiMatrix(activeFactors);

    expect(selectTaguchiArrayName(activeFactors.length)).toBe('L27');
    expect(activeFactors.map((factor) => factor.key)).toEqual([
      'factor1',
      'factor2',
      'factor3',
      'factor4',
      'factor5',
      'factor6',
      'factor7',
    ]);
    expect(matrix).toHaveLength(27);
    expect(matrix[1]).toMatchObject({
      run: 2,
      factor1: 75,
      factor2: 70,
      factor3: 70,
      factor4: 55,
      factor5: 2,
      factor6: 50,
      factor7: 3.5,
    });
  });

  it('only includes enabled factors in the generated order', () => {
    const activeFactors = buildActiveFactors({
      ...factorDefinitions,
      factor4: { ...factorDefinitions.factor4, enabled: false },
      factor5: { ...factorDefinitions.factor5, enabled: false },
      factor6: { ...factorDefinitions.factor6, enabled: true },
      factor8: { ...factorDefinitions.factor8, enabled: true },
    });

    expect(activeFactors.map((factor) => factor.key)).toEqual(['factor1', 'factor2', 'factor6', 'factor8']);
  });

  it('rejects zero, empty, and duplicate active factor levels before matrix generation', () => {
    const duplicatedLevels: TaguchiFactorDefinitions = {
      ...factorDefinitions,
      factor4: { ...factorDefinitions.factor4, levels: ['55', '55', '60'] },
    };
    const zeroLevels: TaguchiFactorDefinitions = {
      ...factorDefinitions,
      factor5: { ...factorDefinitions.factor5, levels: ['0', '2.5', '3.0'] },
    };

    expect(() => generateTaguchiMatrix(buildActiveFactors(duplicatedLevels))).toThrow(
      '生成矩阵前，每个启用的 DOE 因子都必须提供 3 个互不重复且非 0 的水平值。',
    );

    expect(() => generateTaguchiMatrix(buildActiveFactors(zeroLevels))).toThrow(
      '生成矩阵前，每个启用的 DOE 因子都必须提供 3 个互不重复且非 0 的水平值。',
    );
  });
});
