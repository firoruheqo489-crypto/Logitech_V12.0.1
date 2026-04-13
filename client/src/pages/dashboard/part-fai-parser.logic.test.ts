import { describe, expect, it } from 'vitest';

import { parseSheetRows, summarizeDimensionRowsByDimTypes, summarizeWorkbookSheetRows } from './components/part-fai-parser';

describe('parseSheetRows', () => {
  it('parses and preserves the Cavity # column from the source sheet', () => {
    const rows: unknown[][] = [
      ['Dim. #', 'Location', 'Dim. Type', 'Tolerance Type', 'Cavity #', 'Datum System', 'FOS', 'Plus Tol (+)', 'Minus Tol (-)', 'Measurement Tool', 'Judge FOS', 'Shot 1', 'Shot 2', 'Shot 3', 'Judge G-Tol', 'Shot 1', 'Shot 2', 'Shot 3'],
      ['FAI1', 'CZ', 'Profile', 'Profile', 'CAV1', '', 0.7, 0.05, -0.05, 'OMM', 'OK', 0.66, 0.67, 0.66, 'NG', 0.098, 0.096, 0.12],
    ];

    const parsed = parseSheetRows(rows);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]?.dim).toBe('FAI1');
    expect(parsed.data[0]?.dimType).toBe('Profile');
    expect(parsed.data[0]?.cavity).toBe('CAV1');
    expect(parsed.data[0]?.judgeFos).toBe('OK');
  });

  it('counts total, qualified, and unqualified summary values from all OK and NG judge cells', () => {
    const rows: unknown[][] = [
      ['Dim. #', 'Location', 'Dim. Type', 'Tolerance Type', 'Cavity #', 'Datum System', 'FOS', 'Plus Tol (+)', 'Minus Tol (-)', 'Measurement Tool', 'Judge FOS', 'Shot 1', 'Shot 2', 'Shot 3', 'Judge G-Tol', 'Shot 1', 'Shot 2', 'Shot 3'],
      ['FAI1', 'CZ', 'Profile', 'Profile', 'CAV1', '', 0.7, 0.05, -0.05, 'OMM', 'OK', 0.66, 0.67, 0.66, 'NG', 0.098, 0.096, 0.12],
      ['FAI2', 'CZ', 'Profile', 'Profile', 'CAV2', '', 0.8, 0.05, -0.05, 'OMM', 'OK', 0.76, 0.77, 0.78, 'OK', 0.1, 0.11, 0.12],
      ['FAI3', 'CZ', 'Profile', 'Profile', 'CAV3', '', 0.9, 0.05, -0.05, 'OMM', '', 0.86, 0.87, 0.88, 'HOLD', 0.13, 0.14, 0.15],
    ];

    const parsed = parseSheetRows(rows);

    expect(parsed.summary).toEqual({
      totalRows: 4,
      qualifiedRows: 3,
      ngRows: 1,
      qualifiedRate: 75,
    });
  });

  it('ignores rows without OK or NG when building the summary counts', () => {
    const rows: unknown[][] = [
      ['Dim. #', 'Location', 'Dim. Type', 'Tolerance Type', 'Cavity #', 'Datum System', 'FOS', 'Plus Tol (+)', 'Minus Tol (-)', 'Measurement Tool', 'Judge FOS', 'Shot 1', 'Shot 2', 'Shot 3', 'Judge G-Tol', 'Shot 1', 'Shot 2', 'Shot 3'],
      ['FAI1', 'CZ', 'Profile', 'Profile', 'CAV1', '', 0.7, 0.05, -0.05, 'OMM', '', 0.66, 0.67, 0.66, '', 0.098, 0.096, 0.12],
    ];

    const parsed = parseSheetRows(rows);

    expect(parsed.summary).toEqual({
      totalRows: 0,
      qualifiedRows: 0,
      ngRows: 0,
      qualifiedRate: null,
    });
  });

  it('builds summary cards from Dimension report K/Q and Profile_Scan report C', () => {
    const summary = summarizeWorkbookSheetRows({
      'Dimension report ': [
        ['Project'],
        ['Dim. #', 'Location', 'Dim. Type', 'Tolerance Type', 'Cavity #', 'Datum System', 'FOS', 'Plus Tol (+)', 'Minus Tol (-)', 'Measurement Tool', 'Judge FOS', 'Shot 1', 'Shot 2', 'Shot 3', 'G-Tol Range', 'Measurement Tool', 'Judge G-Tol', 'Shot 1', 'Shot 2', 'Shot 3'],
        ['FAI1', '', 'Profile', 'Profile', 'CAV1', '', 0.7, 0.05, -0.05, 'OMM', 'OK', 0.66, 0.67, 0.66, 0.08, '3D', 'NG', 0.098, 0.096, 0.12],
        ['FAI2', '', 'Profile', 'Profile', 'CAV2', '', 0.8, 0.05, -0.05, 'OMM', 'NG', 0.76, 0.77, 0.78, 0.08, '3D', 'OK', 0.1, 0.11, 0.12],
        ['FAI3', '', 'Profile', 'Profile', 'CAV3', '', 0.9, 0.05, -0.05, 'OMM', 'HOLD', 0.86, 0.87, 0.88, 0.08, '3D', 'OK', 0.13, 0.14, 0.15],
      ],
      Profile_Scan_report: [
        ['header'],
        [null, null, 'OK'],
        [null, null, 'NG'],
        [null, null, 'WAIT'],
      ],
    });

    expect(summary).toEqual({
      totalRows: 7,
      qualifiedRows: 4,
      ngRows: 3,
      qualifiedRate: 57.1429,
    });
  });

  it('does not double count profile scan rows when a mirrored block appears at the bottom of the dimension sheet', () => {
    const summary = summarizeWorkbookSheetRows({
      'Dimension report ': [
        ['Project'],
        ['Dim. #', 'Location', 'Dim. Type', 'Tolerance Type', 'Cavity #', 'Datum System', 'FOS', 'Plus Tol (+)', 'Minus Tol (-)', 'Measurement Tool', 'Judge FOS', 'Shot 1', 'Shot 2', 'Shot 3', 'G-Tol Range', 'Measurement Tool', 'Judge G-Tol', 'Shot 1', 'Shot 2', 'Shot 3'],
        ['FAI1', '', 'Profile', 'Profile', 'CAV1', '', 0.7, 0.05, -0.05, 'OMM', 'OK', 0.66, 0.67, 0.66, 0.08, '3D', 'NG', 0.098, 0.096, 0.12],
        ['FAI2', '', 'Profile', 'Profile', 'CAV2', '', 0.8, 0.05, -0.05, 'OMM', 'OK', 0.76, 0.77, 0.78, 0.08, '3D', 'OK', 0.1, 0.11, 0.12],
        ['', '', '', '', 'CAV1', '', '', '', '', '', '', '', '', '', 0.4, '', 'OK', 0.112, 0.124, 0.244],
        ['', '', '', '', 'CAV2', '', '', '', '', '', '', '', '', '', 0.4, '', 'OK', 0.13, 0.11, 0.282],
      ],
      'Profile_Scan report ': [
        ['Title'],
        ['Cavity', 'Spec', 'Judgement', 'Shot 1', 'Shot 2', 'Shot 3'],
        ['CAV1', 0.4, 'OK', 0.112, 0.124, 0.244],
        ['CAV2', 0.4, 'OK', 0.13, 0.11, 0.282],
      ],
    });

    expect(summary).toEqual({
      totalRows: 6,
      qualifiedRows: 5,
      ngRows: 1,
      qualifiedRate: 83.3333,
    });
  });

  it('builds a combined HCF+CP + HCF subset summary from the dimension type column', () => {
    const parsed = parseSheetRows([
      ['Dim. #', 'Location', 'Dim. Type', 'Tolerance Type', 'Cavity #', 'Datum System', 'FOS', 'Plus Tol (+)', 'Minus Tol (-)', 'Measurement Tool', 'Judge FOS', 'Shot 1', 'Shot 2', 'Shot 3', 'Judge G-Tol', 'Shot 1', 'Shot 2', 'Shot 3'],
      ['FAI1', '', 'HCF+CP', 'FOS', 'CAV1', '', 6, 0.05, -0.05, 'C', 'OK', 6, 6.02, 6, 'OK', 0.045, 0.041, 0.053],
      ['FAI2', '', 'HCF+CP', 'FOS', 'CAV2', '', 6, 0.05, -0.05, 'C', 'OK', 6, 6.02, 6, 'NG', 0.045, 0.041, 0.153],
      ['FAI3', '', 'HCF', 'FOS', 'CAV3', '', 6, 0.05, -0.05, 'C', 'OK', 6, 6.02, 6, '', 0.045, 0.041, 0.053],
      ['FAI4', '', 'HCF', 'FOS', 'CAV4', '', 6, 0.05, -0.05, 'C', 'OK', 6, 6.02, 6, '', 0.045, 0.041, 0.053],
      ['FAI5', '', '', 'FOS', 'CAV5', '', 6, 0.05, -0.05, 'C', 'OK', 6, 6.02, 6, 'OK', 0.045, 0.041, 0.053],
    ]);

    expect(summarizeDimensionRowsByDimTypes(parsed.data, ['HCF+CP', 'HCF'])).toEqual({
      totalRows: 6,
      qualifiedRows: 5,
      ngRows: 1,
      qualifiedRate: 83.3333,
    });
  });
});
