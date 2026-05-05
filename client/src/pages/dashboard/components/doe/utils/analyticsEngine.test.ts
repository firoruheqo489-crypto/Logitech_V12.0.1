import { describe, expect, it } from 'vitest';
import {
  analyzeTaguchiMatrix,
  calculateSmallerTheBetterSnRatio,
  validateDeviationInputs,
} from './analyticsEngine';
import {
  buildActiveFactors,
  generateTaguchiMatrix,
  type TaguchiFactorLevels,
} from '../taguchiEngine';

const levels: TaguchiFactorLevels = {
  frontTemp: ['75', '80', '85'],
  backTemp: ['70', '75', '80'],
  sliderTemp: ['65', '70', '75'],
  p1: ['55', '60', '65'],
  t1: ['2.0', '2.5', '3.0'],
  p2: ['45', '50', '55'],
  t2: ['2.5', '3.0', '3.5'],
  p3: ['35', '40', '45'],
  t3: ['1.5', '2.0', '2.5'],
};

describe('analyticsEngine', () => {
  it('calculates smaller-the-better S/N with the safe zero floor', () => {
    expect(calculateSmallerTheBetterSnRatio([0])).toBeCloseTo(100, 8);
    expect(calculateSmallerTheBetterSnRatio([0.1])).toBeCloseTo(20, 8);
  });

  it('validates empty, non-numeric, and negative max deviation inputs', () => {
    const activeFactors = buildActiveFactors(
      { stage1Hold: true, sliderTemp: false, stage2Hold: false, stage3Hold: false },
      levels,
    );
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
    const activeFactors = buildActiveFactors(
      { stage1Hold: true, sliderTemp: false, stage2Hold: false, stage3Hold: false },
      levels,
    );
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
    expect(result.optimalSet.map((item) => item.factorKey)).toEqual(['frontTemp', 'backTemp', 'p1', 't1']);
    result.optimalSet.forEach((item) => {
      expect([1, 2, 3]).toContain(item.level);
      expect(item.value).not.toBe('');
    });
  });
});
