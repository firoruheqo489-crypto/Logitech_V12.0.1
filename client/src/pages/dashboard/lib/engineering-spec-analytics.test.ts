import { describe, expect, it } from "vitest";

import type { EngineeringSpecLedgerRecord } from "@/lib/engineering-spec-ledger-api";
import {
  buildEngineeringSpecDailyStats,
  buildEngineeringSpecMonthlyStats,
} from "./engineering-spec-analytics";

function createRecord(
  id: string,
  createdAt: string,
  overrides: Partial<EngineeringSpecLedgerRecord> = {}
): EngineeringSpecLedgerRecord {
  return {
    id,
    projectId: "1",
    sequence: Number(id.replace(/\D/g, "")) || 1,
    sku: `SKU-${id}`,
    spu: `SPU-${id}`,
    type: "投光灯",
    category: "投光灯",
    description: "测试规格书",
    department: "研发",
    productGroup: "照明",
    sampleQty: "1",
    testDate: "2026-01-15",
    sampleType: "送样测试",
    result: "合格",
    pendingCount: 0,
    createdAt,
    ossUrl: "https://example.com/spec.json",
    ...overrides,
  };
}

describe("buildEngineeringSpecMonthlyStats", () => {
  it("builds a continuous cross-year window and aggregates the current month", () => {
    const result = buildEngineeringSpecMonthlyStats(
      [
        createRecord("1", "2026-01-02T08:00:00+08:00"),
        createRecord("2", "2026-01-08T08:00:00+08:00", {
          sampleType: "终样测试",
        }),
        createRecord("3", "2026-01-12T08:00:00+08:00", {
          sampleType: "其他测试",
          result: "待完善",
        }),
      ],
      new Date(2026, 0, 15)
    );

    expect(result).toHaveLength(12);
    expect(result[0]?.monthKey).toBe("2025-02");
    expect(result.at(-1)).toMatchObject({
      monthKey: "2026-01",
      monthLabel: "01月",
      specCount: 3,
      sampleCount: 1,
      finalSampleCount: 1,
      completedCount: 2,
      completionRate: 67,
    });
  });

  it("keeps empty months stable and ignores invalid or out-of-window dates", () => {
    const result = buildEngineeringSpecMonthlyStats(
      [
        createRecord("1", "2026-01-10T08:00:00+08:00", {
          testDate: "invalid-date",
        }),
        createRecord("2", "2026-01-10T08:00:00+08:00", {
          testDate: "2024-12-31",
        }),
      ],
      new Date(2026, 0, 15)
    );

    expect(result.every(month => month.specCount === 0)).toBe(true);
    expect(result.every(month => month.completionRate === 0)).toBe(true);
  });

  it("uses the sample delivery date and only counts the current calendar month", () => {
    const archives = [
      createRecord("1", "2026-07-10T08:00:00+08:00", {
        testDate: "2026-06-30",
      }),
      createRecord("2", "2026-07-10T08:00:00+08:00", {
        testDate: "2026-07-01",
      }),
      createRecord("3", "2026-07-10T08:00:00+08:00", {
        testDate: "2026-07-31",
        sampleType: "终样测试",
      }),
      createRecord("4", "2026-07-10T08:00:00+08:00", {
        testDate: "2026-08-01",
      }),
    ];

    const result = buildEngineeringSpecMonthlyStats(
      archives,
      new Date(2026, 6, 15)
    );

    expect(result.at(-2)).toMatchObject({ monthKey: "2026-06", specCount: 1 });
    expect(result.at(-1)).toMatchObject({
      monthKey: "2026-07",
      specCount: 2,
      sampleCount: 1,
      finalSampleCount: 1,
    });
    expect(result.some(month => month.monthKey === "2026-08")).toBe(false);
  });
});

describe("buildEngineeringSpecDailyStats", () => {
  it("returns every day in the current month and buckets by sample delivery date", () => {
    const archives = [
      createRecord("1", "2026-04-10T08:00:00+08:00", {
        testDate: "2026-04-01",
      }),
      createRecord("2", "2026-04-10T08:00:00+08:00", {
        testDate: "2026-04-30",
      }),
      createRecord("3", "2026-04-10T08:00:00+08:00", {
        testDate: "2026-03-31",
      }),
      createRecord("4", "2026-04-10T08:00:00+08:00", {
        testDate: "2026-05-01",
      }),
    ];

    const april = buildEngineeringSpecDailyStats(
      archives,
      new Date(2026, 3, 15)
    );
    const july = buildEngineeringSpecDailyStats([], new Date(2026, 6, 15));

    expect(april).toHaveLength(30);
    expect(april[0]).toMatchObject({ day: "1号", count: 1 });
    expect(april.at(-1)).toMatchObject({ day: "30号", count: 1 });
    expect(april.reduce((total, item) => total + item.count, 0)).toBe(2);
    expect(july).toHaveLength(31);
    expect(july.at(-1)?.day).toBe("31号");
  });
});
