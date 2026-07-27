import type { LaboratoryModuleSummary } from "../laboratory/laboratory-contract";
import type { IKTestData } from "./ik-test-data";

export function buildIkImpactModuleSummary(
  nodeId: number,
  data: IKTestData,
  sourceName: string,
): LaboratoryModuleSummary {
  const pass = data.result.finalResult === "PASS";
  return {
    nodeId,
    type: "IK_IMPACT",
    label: "IK 冲击试验",
    printTitle: "IK 冲击试验报告",
    category: "可靠性",
    status: pass ? "parsed" : "fail",
    verdict: data.result.finalResult,
    sourceFiles: sourceName === "示例记录" ? [] : [sourceName],
    keyMetrics: [
      { label: "样品", value: data.target.sampleName },
      { label: "型号", value: data.target.model },
      { label: "试验部位", value: data.target.testPart },
      { label: "IK 等级", value: data.target.selectedIKLevel },
      { label: "冲击能量", value: `${data.energy.impactEnergyJ.toFixed(1)} J` },
      { label: "试验人", value: data.result.tester },
      { label: "审核人", value: data.result.reviewer },
    ],
    warnings: pass ? [] : ["IK 冲击试验最终判定为 FAIL。"],
    moduleData: data,
  };
}
