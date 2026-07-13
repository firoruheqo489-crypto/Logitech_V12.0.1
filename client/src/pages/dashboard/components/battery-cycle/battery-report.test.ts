import { describe, expect, it } from "vitest";

import type { BatteryDataset } from "./battery-data";
import type { BatteryAdjudication } from "./battery-rules";
import { buildBatteryAuditReportHtml, makeBatteryReportFileName } from "./battery-report";

const dataset: BatteryDataset = {
  timeSeries: [],
  cycleStats: [
    { cycle: 1, chargeCap: 1.8, dischargeCap: 1.72, efficiency: 96.7, avgV: 6.8, medianV: 6.74, ir: 7.1, retention: 100 },
    { cycle: 2, chargeCap: 1.7, dischargeCap: 1.62, efficiency: 95.8, avgV: 6.7, medianV: 6.62, ir: 7.9, retention: 94.2 },
  ],
  parseSummary: {
    sourceFile: "EL2600 电池循环1#.xlsx",
    sheets: [],
    validation: {
      requiredSheets: ["测试数据", "循环统计", "流程信息"],
      missingSheets: [],
      missingColumns: [],
      templateFingerprint: {
        version: "EL2600-cycle-template-v1",
        compatibility: "模板匹配",
        expectedSheets: ["测试数据", "循环统计", "流程信息"],
        receivedSheets: ["测试数据", "循环统计", "运行日志", "流程信息"],
        requiredColumnCount: 11,
        matchedRequiredColumnCount: 11,
        columnOrderWarnings: [],
        reasons: ["上传文件符合当前 EL2600 循环测试模板契约。"],
      },
      quality: {
        score: 96,
        grade: "A",
        issues: ["模板结构完整，关键数据通道可追溯。"],
      },
    },
    testData: {
      startTime: "-",
      endTime: "-",
      sampleCount: 2,
      cycleCount: 2,
      stepTypes: ["充电", "放电"],
      voltageMin: 5.5,
      voltageMax: 8.4,
      currentMin: -5,
      currentMax: 2.5,
      capacityMax: 1.72,
      energyMax: 11.5,
    },
    cycleStats: {
      rowCount: 2,
      firstCycle: 1,
      lastCycle: 2,
      avgEfficiency: 96.25,
      maxTemperature: 28,
      maxIr: 7.9,
      finalRetention: 94.2,
    },
    logs: {
      rowCount: 1,
      firstEventTime: "-",
      lastEventTime: "-",
      eventTypes: [],
    },
    flow: {
      rowCount: 3,
      targetCycles: 2,
      steps: [],
    },
  },
  meta: {
    deviceLabel: "EL2600 电池循环 1#",
    cycleCount: 2,
    targetCycles: 2,
    initialCap: 1.72,
    retention: 94.2,
    maxIr: 7.9,
    sampleCount: 2,
  },
};

const adjudication: BatteryAdjudication = {
  overallLevel: "Watch",
  statusText: "[ 总判定：Watch / 有条件进入下一阶段 ]",
  summary: "存在需关注项。",
  counts: { Pass: 1, Watch: 1, Fail: 0 },
  cycleHighlights: {
    2: { level: "Watch", reasons: ["SOH 容量保持率"] },
  },
  rules: [
    {
      id: "soh-retention",
      name: "SOH 容量保持率",
      level: "Watch",
      metric: "94.2%",
      basis: "SOH<95% 进入 Watch。",
      source: "循环统计.总放电容量(Ah)",
      sourceType: "工程阈值",
      blockLevel: "阻断项",
      failAction: "建议复核。",
      triggerCycles: [2],
    },
  ],
};

describe("battery audit report", () => {
  it("includes template status, rule status and abnormal cycle evidence", () => {
    const html = buildBatteryAuditReportHtml(dataset, adjudication);

    expect(html).toContain("模板状态：模板匹配");
    expect(html).toContain("SOH 容量保持率");
    expect(html).toContain("94.2%");
    expect(html).toContain("循环");
  });

  it("creates a safe html report filename", () => {
    expect(makeBatteryReportFileName(dataset)).toBe("EL2600 电池循环1#-audit-report.html");
  });
});
