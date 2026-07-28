import { describe, expect, it } from "vitest";

import type { EngineeringSpecLedgerRecord } from "@/lib/engineering-spec-ledger-api";
import { buildEngineeringSpecMonthlyStats } from "./engineering-spec-analytics";

function createRecord(
  id: string,
  createdAt: string,
  overrides: Partial<EngineeringSpecLedgerRecord> = {},
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
      new Date(2026, 0, 15),
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
        createRecord("1", "invalid-date"),
        createRecord("2", "2024-12-31T23:59:59+08:00"),
      ],
      new Date(2026, 0, 15),
    );

    expect(result.every((month) => month.specCount === 0)).toBe(true);
    expect(result.every((month) => month.completionRate === 0)).toBe(true);
  });
});
