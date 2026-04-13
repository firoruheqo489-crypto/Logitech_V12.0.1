import { describe, expect, it } from 'vitest';

import { parseToolingFaiSheetRows } from './components/tooling-fai-parser';

describe('parseToolingFaiSheetRows', () => {
  it('calculates qualified rate by SUM(P score) / COUNT(K:N shots)', () => {
    const rows: unknown[][] = [
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      ['FAI 1', '1-1', 0.05, 0.025, 0.025, 55.91, 55.91, 0.01, 0.01, 'EDM', 55.911, 55.917, 55.92, 55.919, 4, 4],
      ['FAI 2', '2-1', 0.05, 0.025, 0.025, 10, 10, 0.01, 0.01, 'EDM', 9.99, 10.005, 10.03, 10.04, 2, 2],
    ];

    const parsed = parseToolingFaiSheetRows(rows);

    expect(parsed.summary.totalRows).toBe(2);
    expect(parsed.summary.qualifiedRows).toBe(1);
    expect(parsed.summary.ngRows).toBe(1);
    expect(parsed.summary.totalMeasurements).toBe(8);
    expect(parsed.summary.qualifiedMeasurements).toBe(6);
    expect(parsed.summary.ngMeasurements).toBe(2);
    expect(parsed.summary.qualifiedRate).toBe(75);
  });

  it('marks a zero-score row as unqualified', () => {
    const rows: unknown[][] = [
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      ['FAI 9', '9-1', 0.05, 0.025, 0.025, 4.23, 4.23, 0.01, 0.01, 'EDM', 4.3, 4.3, 4.31, 4.32, 0, 0],
    ];

    const parsed = parseToolingFaiSheetRows(rows);

    expect(parsed.data[0]?.toolingScore).toBe(0);
    expect(parsed.data[0]?.isNG).toBe(true);
    expect(parsed.summary.ngRows).toBe(1);
  });
});
