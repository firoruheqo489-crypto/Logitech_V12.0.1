import { describe, expect, it } from 'vitest';
import {
  analyzeTaguchiMatrix,
  calculateSmallerTheBetterSnRatio,
  validateDeviationInputs,
} from './analyticsEngine';
import {
  buildActiveFactors,
  generateTaguchiMatrix,
  type TaguchiFactorDefinitions,
} from '../taguchiEngine';

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

describe('analyticsEngine', () => {
  it('calculates smaller-the-better S/N with the safe zero floor', () => {
    expect(calculateSmallerTheBetterSnRatio([0])).toBeCloseTo(100, 8);
    expect(calculateSmallerTheBetterSnRatio([0.1])).toBeCloseTo(20, 8);
  });

  it('validates empty, non-numeric, and negative max deviation inputs', () => {
    const activeFactors = buildActiveFactors(factorDefinitions);
    const matrix = generateTaguchiMatrix(activeFactors);

    matrix[0].maxDeviation = '';
    matrix[1].maxDeviation = 'abc';
    matrix[2].maxDeviation = '-0.1';
    matrix.slice(3).forEach((row) => {
      row.maxDeviation = '0.1';
    });

    expect(validateDeviationInputs(matrix)).toEqual([
      { run: 1, reason: 'empty' },
      { run: 2, reason: 'non_numeric' },
      { run: 3, reason: 'negative' },
    ]);
  });

  it('returns row S/N, main effects, delta ranking, and theoretical optimum', () => {
    const activeFactors = buildActiveFactors(factorDefinitions);
    const matrix = generateTaguchiMatrix(activeFactors);

    const deviationsByRun = ['0.30', '0.10', '0.20', '0.24', '0.18', '0.16', '0.32', '0.12', '0.22'];
    matrix.forEach((row, index) => {
      row.maxDeviation = deviationsByRun[index];
    });

    const result = analyzeTaguchiMatrix(matrix, activeFactors);

    expect(result.rowSnRatios).toHaveLength(9);
    expect(result.mainEffects).toHaveLength(4);
    expect(result.lineChartData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'L1' }),
        expect.objectContaining({ level: 'L2' }),
        expect.objectContaining({ level: 'L3' }),
      ]),
    );
    expect(result.deltaChartData[0].delta).toBeGreaterThanOrEqual(result.deltaChartData[1].delta);
    expect(result.optimalSet.map((item) => item.factorKey)).toEqual(['factor1', 'factor2', 'factor4', 'factor5']);
    result.optimalSet.forEach((item) => {
      expect([1, 2, 3]).toContain(item.level);
      expect(item.value).not.toBe('');
    });
  });
});
