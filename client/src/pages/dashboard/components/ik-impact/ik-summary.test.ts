import { describe, expect, it } from "vitest";

import { buildIkImpactModuleSummary } from "./ik-summary";
import { ikTestData, validateEnergyMapping } from "./ik-test-data";

describe("IK impact laboratory integration", () => {
  it("keeps the original IK level and energy mapping validation", () => {
    expect(validateEnergyMapping(ikTestData)).toBe(ikTestData);
    expect(() =>
      validateEnergyMapping({
        ...ikTestData,
        energy: { ...ikTestData.energy, impactEnergyJ: 10 },
      }),
    ).toThrow("IK08 应对应 5.0 J");
    expect(() =>
      validateEnergyMapping({
        ...ikTestData,
        energy: { ...ikTestData.energy, ikLevel: "IK09" },
      }),
    ).toThrow("IK 等级不一致");
  });

  it("maps a passing IK result into a printable laboratory summary", () => {
    expect(buildIkImpactModuleSummary(3, ikTestData, "sample.pdf")).toMatchObject({
      nodeId: 3,
      type: "IK_IMPACT",
      label: "IK 冲击试验",
      printTitle: "IK 冲击试验报告",
      category: "可靠性",
      verdict: "PASS",
      status: "parsed",
      sourceFiles: ["sample.pdf"],
      moduleData: ikTestData,
    });
  });

  it("maps a failed IK result without changing the original verdict", () => {
    const failed = {
      ...ikTestData,
      result: { ...ikTestData.result, finalResult: "FAIL" as const },
    };
    expect(buildIkImpactModuleSummary(4, failed, "示例记录")).toMatchObject({
      status: "fail",
      verdict: "FAIL",
      sourceFiles: [],
      warnings: ["IK 冲击试验最终判定为 FAIL。"],
    });
  });
});
