import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { EngineeringSpecLedgerRecord } from "@/lib/engineering-spec-ledger-api";
import { EngineeringSpecAnalyticsDashboard } from "./EngineeringSpecAnalyticsDashboard";

function createRecord(
  id: string,
  sampleType: string,
  result: EngineeringSpecLedgerRecord["result"]
): EngineeringSpecLedgerRecord {
  return {
    id,
    projectId: "1",
    sequence: Number(id),
    sku: `SKU-${id}`,
    spu: `SPU-${id}`,
    type: "投光灯",
    category: "投光灯",
    description: "测试规格书",
    department: "研发",
    productGroup: "照明",
    sampleQty: "1",
    testDate: "2026-07-28",
    sampleType,
    result,
    pendingCount: result === "合格" ? 0 : 1,
    createdAt: new Date().toISOString(),
    ossUrl: "https://example.com/spec.json",
  };
}

describe("EngineeringSpecAnalyticsDashboard", () => {
  it("renders monthly KPIs and trend without removing the existing detail panels", () => {
    const html = renderToStaticMarkup(
      <EngineeringSpecAnalyticsDashboard
        archives={[
          createRecord("1", "送样测试", "合格"),
          createRecord("2", "终样测试", "待完善"),
        ]}
      />
    );

    expect(html).toContain("规格书统计看板");
    expect(html).toContain("本月规格书");
    expect(html).toContain("本月样品单");
    expect(html).toContain("本月终样单");
    expect(html).toContain("本月完成率");
    expect(html).toContain("月度处理趋势");
    expect(html).toContain("每日处理量");
    expect(html).toContain("Current Month · Daily");
    expect(html).toContain("样品分布");
    expect(html).toContain("最近归档记录");
    expect(html).not.toContain("Recent 7 Days");
    expect(html).not.toContain("lg:col-span-2");
    expect(html).not.toContain("lg:grid-cols-3");
  });
});
