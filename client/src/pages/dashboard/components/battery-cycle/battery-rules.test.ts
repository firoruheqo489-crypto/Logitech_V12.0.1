import { describe, expect, it } from "vitest";

import type { BatteryDataset, CycleStat } from "./battery-data";
import { BATTERY_RULES, evaluateBatteryRules } from "./battery-rules";

function makeCycleStats(overrides: Partial<CycleStat>[] = []): CycleStat[] {
  const base: CycleStat[] = [
    { cycle: 1, chargeCap: 1.78, dischargeCap: 1.72, efficiency: 96.7, avgV: 6.78, medianV: 6.74, ir: 7.1, retention: 100 },
    { cycle: 2, chargeCap: 1.79, dischargeCap: 1.71, efficiency: 96.6, avgV: 6.77, medianV: 6.74, ir: 7.11, retention: 99.4 },
    { cycle: 3, chargeCap: 1.79, dischargeCap: 1.7, efficiency: 96.5, avgV: 6.76, medianV: 6.73, ir: 7.11, retention: 98.8 },
    { cycle: 4, chargeCap: 1.78, dischargeCap: 1.7, efficiency: 96.4, avgV: 6.76, medianV: 6.73, ir: 7.1, retention: 98.8 },
    { cycle: 5, chargeCap: 1.78, dischargeCap: 1.69, efficiency: 96.4, avgV: 6.75, medianV: 6.73, ir: 7.11, retention: 98.3 },
  ];

  return base.map((row, index) => ({ ...row, ...overrides[index] }));
}

function makeDataset(cycleStats = makeCycleStats()): BatteryDataset {
  return {
    timeSeries: [],
    cycleStats,
    parseSummary: {
      sourceFile: "unit.xlsx",
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
          score: 100,
          grade: "A",
          issues: ["模板结构完整，关键数据通道可追溯。"],
        },
      },
      testData: {
        startTime: "-",
        endTime: "-",
        sampleCount: 0,
        cycleCount: cycleStats.length,
        stepTypes: ["充电", "放电"],
        voltageMin: 5.5,
        voltageMax: 8.4,
        currentMin: -5,
        currentMax: 2.5,
        capacityMax: 1.72,
        energyMax: 11.5,
      },
      cycleStats: {
        rowCount: cycleStats.length,
        firstCycle: cycleStats[0]?.cycle ?? 0,
        lastCycle: cycleStats[cycleStats.length - 1]?.cycle ?? 0,
        avgEfficiency: 96.5,
        maxTemperature: 28,
        maxIr: Math.max(...cycleStats.map((row) => row.ir)),
        finalRetention: cycleStats[cycleStats.length - 1]?.retention ?? 0,
      },
      logs: {
        rowCount: 1,
        firstEventTime: "-",
        lastEventTime: "-",
        eventTypes: [{ label: "达到电压限制条件进行工步跳转", count: 1 }],
      },
      flow: {
        rowCount: 3,
        targetCycles: cycleStats.length,
        steps: [
          {
            step: "充电",
            currentOrPower: 2.5,
            constantVoltage: 8.4,
            voltageLimit: 8.4,
            currentLimit: 0.25,
            capacityLimit: null,
            timeLimit: null,
            jumpCount: null,
          },
          {
            step: "放电",
            currentOrPower: 5,
            constantVoltage: null,
            voltageLimit: 5.5,
            currentLimit: null,
            capacityLimit: null,
            timeLimit: null,
            jumpCount: null,
          },
          {
            step: "静置",
            currentOrPower: null,
            constantVoltage: null,
            voltageLimit: null,
            currentLimit: null,
            capacityLimit: null,
            timeLimit: "00:06:00",
            jumpCount: null,
          },
        ],
      },
    },
    meta: {
      deviceLabel: "Unit Cell",
      cycleCount: cycleStats.length,
      targetCycles: cycleStats.length,
      initialCap: cycleStats[0]?.dischargeCap ?? 0,
      retention: cycleStats[cycleStats.length - 1]?.retention ?? 0,
      maxIr: Math.max(...cycleStats.map((row) => row.ir)),
      sampleCount: 0,
    },
  };
}

describe("battery adjudication rules", () => {
  it("attaches source and blocking metadata to every rule", () => {
    const adjudication = evaluateBatteryRules(makeDataset());

    expect(adjudication.rules.every((rule) => rule.sourceType && rule.blockLevel && rule.failAction)).toBe(true);
    expect(adjudication.rules.find((rule) => rule.id === "data-integrity")).toMatchObject({
      level: "Pass",
      blockLevel: "阻断项",
      sourceType: "数据完整性",
    });
    expect(adjudication.rules.find((rule) => rule.id === "protocol-match")).toMatchObject({
      level: "Pass",
      blockLevel: "复核项",
    });
  });

  it("flags DCIR spikes and median-voltage depression with cycle highlights", () => {
    const cycleStats = makeCycleStats([
      {},
      {},
      { ir: 8.75, medianV: 6.72 },
      { medianV: 6.4 },
      { ir: 8.25, medianV: 6.38 },
    ]);
    const adjudication = evaluateBatteryRules(makeDataset(cycleStats));

    expect(adjudication.rules.find((rule) => rule.id === "dcir-trend")).toMatchObject({
      level: "Fail",
    });
    expect(adjudication.rules.find((rule) => rule.id === "median-voltage")).toMatchObject({
      level: "Fail",
    });
    expect(adjudication.cycleHighlights[3]?.level).toBe("Fail");
    expect(adjudication.cycleHighlights[5]?.level).toBe("Fail");
  });

  it("allows protocol thresholds to be supplied as a rule configuration", () => {
    const adjudication = evaluateBatteryRules(makeDataset(), {
      ...BATTERY_RULES,
      expectedProtocol: {
        ...BATTERY_RULES.expectedProtocol,
        dischargeCurrentA: 4,
      },
    });

    expect(adjudication.rules.find((rule) => rule.id === "protocol-match")).toMatchObject({
      level: "Watch",
      sourceType: "试验协议",
    });
  });
});
