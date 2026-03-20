import { describe, expect, it } from 'vitest';

import {
  deriveColorDifferenceJudge,
  normalizeColorDifferenceRows,
  normalizeColorSectionMeta,
  type SurfaceValueRow,
} from './surface-parser-core';

describe('surface parser color difference threshold', () => {
  it('marks values above 1.2 as NG and keeps 1.2 or below as OK', () => {
    expect(deriveColorDifferenceJudge(1.1)).toBe('OK');
    expect(deriveColorDifferenceJudge(1.2)).toBe('OK');
    expect(deriveColorDifferenceJudge(1.2001)).toBe('NG');
  });

  it('recomputes row judgements from color-difference values', () => {
    const rows: SurfaceValueRow[] = [
      {
        cavity: 'Cav14',
        frontVal: 0.9,
        frontJudge: 'OK',
        backVal: 1.1,
        backJudge: 'NG',
        isNG: true,
      },
      {
        cavity: 'Cav15',
        frontVal: 1,
        frontJudge: 'OK',
        backVal: 1.21,
        backJudge: 'OK',
        isNG: false,
      },
    ];

    expect(normalizeColorDifferenceRows(rows)).toEqual([
      {
        cavity: 'Cav14',
        frontVal: 0.9,
        frontJudge: 'OK',
        backVal: 1.1,
        backJudge: 'OK',
        isNG: false,
      },
      {
        cavity: 'Cav15',
        frontVal: 1,
        frontJudge: 'OK',
        backVal: 1.21,
        backJudge: 'NG',
        isNG: true,
      },
    ]);
  });

  it('forces the displayed color-difference standard to <=1.2', () => {
    expect(
      normalizeColorSectionMeta({
        title: '三、色差测试',
        standard: '#标准： <=1.0',
        placement: '#产品测试摆放： 俯视，穴号在右侧，测侧边左右长度面',
      }),
    ).toEqual({
      title: '三、色差测试',
      standard: '#标准： <=1.2',
      placement: '#产品测试摆放： 俯视，穴号在右侧，测侧边左右长度面',
    });
  });
});
