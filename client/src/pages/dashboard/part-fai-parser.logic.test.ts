import { describe, expect, it } from "vitest";

import {
  parseSheetJsonRowsToContract,
  parseSheetRows,
  parseSheetRowsToContract,
} from "./components/part-fai-parser";

function buildHeaderRow(): unknown[] {
  return [
    "Dim. #", // A
    "Location", // B
    "Dim. Type", // C
    "Tolerance Type", // D
    "Cavity #", // E
    "Datum System", // F
    "FOS", // G
    "Plus Tol (+)", // H
    "Minus Tol (-)", // I
    "Measurement Tool", // J
    "Judge FOS", // K
    "Shot 1", // L
    "Shot 2", // M
    "Shot 3", // N
    "G-Tol Range", // O
    "Measurement Tool", // P
    "Judge G-Tol", // Q
    "Shot 1", // R
    "Shot 2", // S
    "Shot 3", // T
  ];
}

describe("Part FAI SPC parser", () => {
  it("uses Dim.# as the unique parent key and aggregates FAI5A/FAI5B rows under FAI5", () => {
    const rows: unknown[][] = [
      buildHeaderRow(),
      [
        "FAI5",
        "",
        "FAI5A",
        "",
        "CAV1",
        "",
        6.0,
        0.05,
        -0.05,
        "",
        "OK",
        6.02,
        6.0,
        6.01,
        0.08,
        "",
        "OK",
        0.03,
        0.04,
        0.05,
      ],
      [
        "",
        "",
        "FAI5B",
        "",
        "CAV2",
        "",
        "",
        "",
        "",
        "",
        "OK",
        6.01,
        6.0,
        6.02,
        "",
        "",
        "OK",
        0.02,
        0.04,
        0.06,
      ],
      [
        "FAI6",
        "",
        "PROFILE",
        "",
        "CAV1",
        "",
        8.0,
        0.1,
        -0.1,
        "",
        "OK",
        8.0,
        8.02,
        8.01,
        0.1,
        "",
        "OK",
        0.03,
        0.04,
        0.05,
      ],
    ];

    const parsed = parseSheetRowsToContract(rows);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.faiId).toBe("FAI5");
    expect(parsed[1]?.faiId).toBe("FAI6");

    const fai5 = parsed.find(item => item.faiId === "FAI5");
    expect(fai5).toBeDefined();
    expect(fai5?.measurements.FOS.rawData).toHaveLength(6);
    expect(fai5?.measurements.GTol?.rawData).toHaveLength(6);
    expect(
      new Set(fai5?.measurements.FOS.rawData.map(point => point.cavity))
    ).toEqual(new Set(["CAV1", "CAV2"]));
  });

  it("builds independent 16x3=48 flat arrays for FOS and G-Tol under one FAI", () => {
    const rows: unknown[][] = [buildHeaderRow()];

    rows.push([
      "FAI1",
      "",
      "PROFILE",
      "",
      "CAV1",
      "",
      12.5,
      0.15,
      -0.15,
      "",
      "OK",
      12.49,
      12.5,
      12.51,
      0.12,
      "",
      "OK",
      0.03,
      0.05,
      0.04,
    ]);

    for (let index = 2; index <= 16; index += 1) {
      rows.push([
        "",
        "",
        "PROFILE",
        "",
        `CAV${index}`,
        "",
        "",
        "",
        "",
        "",
        "OK",
        12.49 + index * 0.001,
        12.5 + index * 0.001,
        12.51 + index * 0.001,
        "",
        "",
        "OK",
        0.03 + index * 0.001,
        0.05 + index * 0.001,
        0.04 + index * 0.001,
      ]);
    }

    const parsed = parseSheetRowsToContract(rows);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.faiId).toBe("FAI1");
    expect(parsed[0]?.measurements.FOS.flatValues).toHaveLength(48);
    expect(parsed[0]?.measurements.FOS.rawData).toHaveLength(48);
    expect(parsed[0]?.measurements.GTol?.flatValues).toHaveLength(48);
    expect(parsed[0]?.measurements.GTol?.rawData).toHaveLength(48);
  });

  it("skips blank / '-' / 'N/A' cells instead of polluting flat arrays with 0 or NaN", () => {
    const rows: unknown[][] = [
      buildHeaderRow(),
      [
        "FAI2",
        "",
        "PROFILE",
        "",
        "CAV1",
        "",
        6.0,
        0.05,
        -0.05,
        "",
        "OK",
        6.0,
        "-",
        "N/A",
        0.1,
        "",
        "OK",
        0.03,
        "",
        "-",
      ],
    ];

    const parsed = parseSheetRowsToContract(rows);
    const fai2 = parsed.find(item => item.faiId === "FAI2");
    expect(fai2).toBeDefined();
    expect(fai2?.measurements.FOS.flatValues).toEqual([6]);
    expect(fai2?.measurements.FOS.flatValues.some(Number.isNaN)).toBe(false);
    expect(fai2?.measurements.GTol?.flatValues).toEqual([0.03]);
  });

  it("locks parsed numeric precision to 3 decimals", () => {
    const rows: unknown[][] = [
      buildHeaderRow(),
      [
        "FAI3",
        "",
        "PROFILE",
        "",
        "CAV1",
        "",
        6.00000000001,
        0.05555,
        -0.05555,
        "",
        "OK",
        "6.00000000001",
        "6.12349",
        "6.12351",
        0.1234567,
        "",
        "OK",
        "0.00349",
        "0.00351",
        "0.00350001",
      ],
    ];

    const parsed = parseSheetRowsToContract(rows);
    const fai3 = parsed[0];

    expect(fai3?.measurements.FOS.nominal).toBe(6);
    expect(fai3?.measurements.FOS.flatValues).toEqual([6, 6.123, 6.124]);
    expect(fai3?.measurements.GTol?.usl).toBe(0.123);
    expect(fai3?.measurements.GTol?.flatValues).toEqual([0.003, 0.004, 0.004]);
  });

  it("exposes contractData on parseSheetRows while preserving legacy row rendering payload", () => {
    const rows: unknown[][] = [
      buildHeaderRow(),
      [
        "FAI7",
        "",
        "PROFILE",
        "",
        "CAV1",
        "",
        8.0,
        0.1,
        -0.1,
        "",
        "OK",
        8.02,
        8.01,
        8.0,
        0.06,
        "",
        "OK",
        0.02,
        0.03,
        0.04,
      ],
    ];

    const parsed = parseSheetRows(rows);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.contractData).toHaveLength(1);
    expect(parsed.contractData[0]?.faiId).toBe("FAI7");
    expect(parsed.contractData[0]?.measurements.FOS.flatValues).toEqual([8.02, 8.01, 8]);
  });

  it("applies fill-down on sheet_to_json rows so merged Dim.# blanks stay under one FAI key", () => {
    const jsonRows: Record<string, unknown>[] = [
      {
        "Dim. #": "FAI6",
        "Dim. Type": "PROFILE",
        "Cavity #": "CAV1",
        FOS: 8,
        "Plus Tol (+)": 0.1,
        "Minus Tol (-)": -0.1,
        "Shot 1": 8.0,
        "Shot 2": 8.01,
        "Shot 3": 8.02,
        "G-Tol Range": 0.08,
        "Shot 1_1": 0.03,
        "Shot 2_1": 0.04,
        "Shot 3_1": 0.05,
      },
      {
        "Dim. #": "",
        "Dim. Type": "PROFILE",
        "Cavity #": "CAV2",
        FOS: "",
        "Plus Tol (+)": "",
        "Minus Tol (-)": "",
        "Shot 1": 8.03,
        "Shot 2": 8.04,
        "Shot 3": 8.05,
        "G-Tol Range": "",
        "Shot 1_1": "-",
        "Shot 2_1": "N/A",
        "Shot 3_1": 0.06,
      },
    ];

    const parsed = parseSheetJsonRowsToContract(jsonRows);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.faiId).toBe("FAI6");
    expect(parsed[0]?.measurements.FOS.flatValues).toHaveLength(6);
    expect(parsed[0]?.measurements.GTol?.flatValues).toEqual([0.03, 0.04, 0.05, 0.06]);
  });

  it("rejects non-numeric shot strings from json rows instead of coercing them into numbers", () => {
    const jsonRows: Record<string, unknown>[] = [
      {
        "Dim. #": "FAI3",
        "Dim. Type": "PROFILE",
        "Cavity #": "CAV1",
        FOS: 6,
        "Plus Tol (+)": 0.05,
        "Minus Tol (-)": -0.05,
        "Shot 1": "6.01abc",
        "Shot 2": "6.020",
        "Shot 3": "",
        "G-Tol Range": 0.05,
        "Shot 1_1": "0.030x",
        "Shot 2_1": "0.031",
        "Shot 3_1": "",
      },
    ];

    const parsed = parseSheetJsonRowsToContract(jsonRows);
    expect(parsed[0]?.measurements.FOS.flatValues).toEqual([6.02]);
    expect(parsed[0]?.measurements.GTol?.flatValues).toEqual([0.031]);
  });
});
