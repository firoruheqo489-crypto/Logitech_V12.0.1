import { describe, expect, it } from 'vitest';
import {
  buildActiveFactors,
  generateTaguchiMatrix,
  selectTaguchiArrayName,
  type TaguchiFactorLevels,
} from './taguchiEngine';

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

describe('taguchiEngine', () => {
  it('maps 4 active factors to L9 and hydrates level values', () => {
    const activeFactors = buildActiveFactors(
      { sliderTemp: false, stage2Hold: false, stage3Hold: false },
      levels,
    );
    const matrix = generateTaguchiMatrix(activeFactors);

    expect(selectTaguchiArrayName(activeFactors.length)).toBe('L9');
    expect(activeFactors.map((factor) => factor.key)).toEqual(['frontTemp', 'backTemp', 'p1', 't1']);
    expect(matrix).toHaveLength(9);
    expect(matrix[0]).toMatchObject({
      run: 1,
      frontTemp: 75,
      backTemp: 70,
      p1: 55,
      t1: 2,
      maxDeviation: null,
      scanImage: null,
    });
    expect(matrix[1]).toMatchObject({
      run: 2,
      frontTemp: 75,
      backTemp: 75,
      p1: 60,
      t1: 2.5,
    });
  });

  it('maps 5-9 active factors to L27 while preserving active factor order', () => {
    const activeFactors = buildActiveFactors(
      { sliderTemp: true, stage2Hold: true, stage3Hold: false },
      levels,
    );
    const matrix = generateTaguchiMatrix(activeFactors);

    expect(selectTaguchiArrayName(activeFactors.length)).toBe('L27');
    expect(activeFactors.map((factor) => factor.key)).toEqual([
      'frontTemp',
      'backTemp',
      'sliderTemp',
      'p1',
      't1',
      'p2',
      't2',
    ]);
    expect(matrix).toHaveLength(27);
    expect(matrix[1]).toMatchObject({
      run: 2,
      frontTemp: 75,
      backTemp: 70,
      sliderTemp: 70,
      p1: 55,
      t1: 2,
      p2: 50,
      t2: 3.5,
    });
  });
});
