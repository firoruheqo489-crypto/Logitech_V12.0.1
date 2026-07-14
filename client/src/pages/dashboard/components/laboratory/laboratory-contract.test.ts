import { describe, expect, it } from "vitest";

import {
  LABORATORY_MODULES,
  buildBatteryCycleModuleSummary,
  buildDarkroomModuleSummary,
  buildEmcModuleSummary,
  buildFlickerModuleSummary,
  buildHarmonicModuleSummary,
  buildIntegratingSphereModuleSummary,
  buildLaboratoryExportGate,
  buildLaboratoryOverallAdjudication,
  buildMountedModuleSummary,
  buildReliabilityLifeModuleSummary,
  buildTimeSeriesModuleSummary,
  getLaboratoryModuleDefinition,
  type LaboratoryReportMeta,
} from "./laboratory-contract";
import { evaluateFlickerEvidence } from "./flicker-rules";

describe("laboratory module contract", () => {
  it("keeps module ids unique and printable modules explicit", () => {
    const ids = LABORATORY_MODULES.map((module) => module.type);

    expect(new Set(ids).size).toBe(ids.length);
    expect(LABORATORY_MODULES.length).toBeGreaterThanOrEqual(6);
    expect(LABORATORY_MODULES.every((module) => module.label && module.printTitle)).toBe(true);
    expect(LABORATORY_MODULES.every((module) => typeof module.supportsPrint === "boolean")).toBe(true);
  });

  it("builds a stable mounted summary for the print surface", () => {
    const summary = buildMountedModuleSummary(7, "HARMONIC");

    expect(summary).toMatchObject({
      nodeId: 7,
      type: "HARMONIC",
      label: "谐波解析",
      printTitle: "谐波功率测试报告",
      verdict: "待解析",
    });
    expect(summary.keyMetrics.length).toBeGreaterThan(0);
  });

  it("resolves module definitions by id", () => {
    expect(getLaboratoryModuleDefinition("TIME_SERIES")).toMatchObject({
      label: "温升测试",
      category: "热测试",
    });
    expect(getLaboratoryModuleDefinition("BATTERY_CYCLE")).toMatchObject({
      label: "电池充放电",
      uploadMode: "single-excel",
    });
  });

  it("builds a parsed integrating-sphere summary for consolidated PDF", () => {
    const summary = buildIntegratingSphereModuleSummary(3, {
      verdict: "PASS",
      sourceFiles: ["白光:white.pdf", "暖光:warm.pdf", "中性光:neutral.pdf"],
      activeVariantLabel: "白光",
      parsedCount: 3,
      expectedCount: 3,
      activeMetrics: {
        productModel: "MR16",
        testDate: "2026-07-12",
        flux: { value: "520.1", unit: "lm" },
        efficacy: { value: "88.2", unit: "lm/W" },
        cct: { value: "6500", unit: "K" },
        raR9: { value: "82.1 / 12.0", unit: "CRI" },
        power: { value: "5.902", unit: "W" },
      },
    });

    expect(summary).toMatchObject({
      nodeId: 3,
      type: "INTEGRATING_SPHERE",
      status: "parsed",
      verdict: "PASS",
      sourceFiles: ["白光:white.pdf", "暖光:warm.pdf", "中性光:neutral.pdf"],
    });
    expect(summary.keyMetrics).toEqual(
      expect.arrayContaining([
        { label: "光通量", value: "520.1 lm" },
        { label: "功率", value: "5.902 W" },
      ]),
    );
    expect(summary.warnings).toEqual([]);
  });

  it("builds a darkroom summary with optical evidence", () => {
    const summary = buildDarkroomModuleSummary(4, {
      sourceFiles: ["白光:white-darkroom.pdf", "暖光:warm-darkroom.pdf", "中性光:neutral-darkroom.pdf"],
      activeVariantLabel: "白光",
      parsedCount: 3,
      expectedCount: 3,
      activeMetrics: {
        name: "MR16",
        testDate: "2026-07-12",
        ratedFlux: 910.2,
        testedPower: 10.41,
        efficacy: 87.44,
        maxCandela: 368.68,
        beamAngleV: 101.9,
        beamAngleH: 106.5,
        fieldAngleV: 139.3,
        fieldAngleH: 145.5,
        workingPlaneEMax: 40.85,
      },
    });

    expect(summary).toMatchObject({
      nodeId: 4,
      type: "DARKROOM",
      status: "parsed",
      verdict: "PASS",
    });
    expect(summary.keyMetrics).toEqual(
      expect.arrayContaining([
        { label: "光通量", value: "910.2 lm" },
        { label: "最大光强", value: "368.7 cd" },
      ]),
    );
  });

  it("allows a single darkroom light-source report when the fixture only has one source", () => {
    const summary = buildDarkroomModuleSummary(14, {
      sourceFiles: ["白光:white-darkroom.pdf"],
      activeVariantLabel: "白光",
      parsedCount: 1,
      expectedCount: 1,
      activeMetrics: {
        name: "A126S151",
        testDate: "2026-07-13",
        ratedFlux: 910.2,
        testedPower: 10.41,
        efficacy: 87.44,
        maxCandela: 368.68,
        beamAngleV: 101.9,
        beamAngleH: 106.5,
        fieldAngleV: 139.3,
        fieldAngleH: 145.5,
        workingPlaneEMax: 40.85,
      },
    });

    expect(summary).toMatchObject({
      nodeId: 14,
      type: "DARKROOM",
      status: "parsed",
      verdict: "PASS",
      sourceFiles: ["白光:white-darkroom.pdf"],
    });
    expect(summary.warnings).toEqual([]);
  });

  it("adds darkroom batch consistency watch evidence without failing the PDF conclusion", () => {
    const summary = buildDarkroomModuleSummary(16, {
      sourceFiles: ["报告 1:HL222-1.pdf", "报告 2:HL222-2.pdf"],
      activeVariantLabel: "报告 1",
      parsedCount: 2,
      expectedCount: 2,
      activeMetrics: {
        name: "HL222C",
        testDate: "2026-07-13",
        ratedFlux: 26682.0,
        testedPower: 191.8,
        efficacy: 139.11,
        maxCandela: 14829.7,
        beamAngleV: 82.0,
        beamAngleH: 81.1,
        fieldAngleV: 123.9,
        fieldAngleH: 125.4,
        workingPlaneEMax: 1646.99,
      },
      batchConsistency: {
        sampleCount: 2,
        worstMetric: "IRF",
        worstSpread: "3.23 pp",
        watchCount: 1,
        driftCount: 0,
      },
    });

    expect(summary).toMatchObject({
      nodeId: 16,
      type: "DARKROOM",
      status: "watch",
      verdict: "WATCH",
    });
    expect(summary.keyMetrics).toEqual(
      expect.arrayContaining([
        { label: "批次报告数", value: "2" },
        { label: "最大复测偏差", value: "IRF / 3.23 pp" },
        { label: "复测观察项", value: "1 WATCH / 0 DRIFT" },
      ]),
    );
    expect(summary.warnings).toContain("暗房复测一致性存在 1 项 WATCH，建议结合样品状态和测试设定复核。");
  });

  it("builds a flicker summary with worst-sample adjudication", () => {
    const summary = buildFlickerModuleSummary(5, {
      sourceFiles: ["a.pdf", "b.pdf"],
      sampleCount: 2,
      worstSample: "样本2",
      worstFlickerPercent: 8.5,
      worstFlickerIndex: 0.21,
      worstFrequencyHz: 100.1,
      flickerPercentDelta: 7.2,
      flickerIndexDelta: 0.18,
      frequencyDelta: 0.4,
    });

    expect(summary).toMatchObject({
      nodeId: 5,
      type: "FLICKER",
      status: "fail",
      verdict: "FAIL",
    });
    expect(summary.warnings).toContain("最差频闪率超过 8% 低风险阈值，建议复核驱动批次与关键元件。");
  });

  it("keeps BL212 flicker/Pst/SVM PDF conclusions as pass evidence", () => {
    const summary = buildFlickerModuleSummary(15, {
      sourceFiles: ["BL212SA-10W2.pdf", "BL212SA-10W2 PST.pdf", "BL212SA-10W2 SVM.pdf"],
      sampleCount: 3,
      worstSample: "样本3",
      worstFlickerPercent: 2.793,
      worstFlickerIndex: 0.003,
      worstFrequencyHz: 200,
      flickerPercentDelta: null,
      flickerIndexDelta: null,
      frequencyDelta: 100.005,
      pst: 0.008,
      pstResult: "可接受",
      pstStandard: "IEC TR 61547-1:2015",
      svm: 0.034,
      svmVisibility: "频闪不可见",
      svmErp: "PASS",
      svmStandard: "CIE TN:006-2016",
      flickerStandard: "IESNA 2000,CIE TN 006",
    });

    expect(summary).toMatchObject({
      nodeId: 15,
      type: "FLICKER",
      status: "parsed",
      verdict: "PASS",
    });
    expect(summary.keyMetrics).toEqual(
      expect.arrayContaining([
        { label: "Pst", value: "0.008 / 可接受" },
        { label: "SVM", value: "0.034 / ERP PASS" },
        { label: "SVM可见性", value: "频闪不可见" },
        { label: "频闪标准", value: "IESNA 2000,CIE TN 006" },
        { label: "Pst标准", value: "IEC TR 61547-1:2015" },
        { label: "SVM标准", value: "CIE TN:006-2016" },
      ]),
    );
    expect(summary.warnings).toContain("频闪率超过 1% 无风险阈值，但未超过 8% 低风险阈值，建议保持关注。");
  });

  it("evaluates flicker evidence from the shared rule table", () => {
    expect(
      evaluateFlickerEvidence({
        flickerPercent: 2.793,
        pstResult: "可接受",
        svmErp: "PASS",
      }),
    ).toMatchObject({
      verdict: "PASS",
      status: "parsed",
      fail: false,
      lowRisk: true,
    });

    expect(evaluateFlickerEvidence({ flickerPercent: 8.5 })).toMatchObject({
      verdict: "FAIL",
      flickerFail: true,
    });
  });

  it("builds a harmonic summary with failure evidence", () => {
    const summary = buildHarmonicModuleSummary(6, {
      sourceFile: "harmonic.pdf",
      verdict: "FAIL",
      productName: "MR16",
      standard: "IEC 61000-3-2",
      testDate: "2026-07-12",
      ithdPercent: 113.21,
      thcMa: 88.4,
      powerFactor: 0.62,
      powerW: 5.82,
      frequencyHz: 50.01,
      worstMargin: -2.4,
      failHarmonics: ["K3", "K5"],
      phaseFailCount: 1,
      structuralFailCount: 1,
    });

    expect(summary).toMatchObject({
      nodeId: 6,
      type: "HARMONIC",
      status: "fail",
      verdict: "FAIL",
      sourceFiles: ["harmonic.pdf"],
    });
    expect(summary.keyMetrics).toEqual(
      expect.arrayContaining([
        { label: "THDi", value: "113.21%" },
        { label: "超标谐波", value: "K3、K5" },
      ]),
    );
    expect(summary.warnings).toEqual(
      expect.arrayContaining(["相位角检查失败 1 项。", "结构硬伤检查失败 1 项。"]),
    );
  });

  it("builds an EMC summary with watch-level small-margin evidence", () => {
    const summary = buildEmcModuleSummary(8, {
      sourceFiles: ["L.pdf", "N.pdf"],
      verdict: "PASS",
      channelCount: 2,
      pointCount: 320,
      worstRecord: {
        channel: "L",
        band: "conducted",
        detector: "QP",
        freq: 0.45,
        reading: 60.1,
        limit: 62,
        margin: 1.9,
      },
      counts: {
        high: 1,
        mid: 0,
        safe: 20,
        overLimit: 0,
      },
    });

    expect(summary).toMatchObject({
      nodeId: 8,
      type: "EMISSION",
      status: "watch",
      verdict: "WATCH",
    });
    expect(summary.keyMetrics).toEqual(
      expect.arrayContaining([
        { label: "最差频点", value: "0.450 MHz" },
        { label: "最小余量", value: "1.9 dB" },
      ]),
    );
    expect(summary.warnings).toContain("当前无超标频点，但存在小余量频点，建议保留整改余量。");
  });

  it("rolls module results into a deterministic overall adjudication", () => {
    const passSummary = buildDarkroomModuleSummary(4, {
      sourceFiles: ["white-darkroom.pdf", "warm-darkroom.pdf", "neutral-darkroom.pdf"],
      activeVariantLabel: "白光",
      parsedCount: 3,
      expectedCount: 3,
      activeMetrics: {
        name: "MR16",
        testDate: "2026-07-12",
        ratedFlux: 910.2,
        testedPower: 10.41,
        efficacy: 87.44,
        maxCandela: 368.68,
        beamAngleV: 101.9,
        beamAngleH: 106.5,
        fieldAngleV: 139.3,
        fieldAngleH: 145.5,
        workingPlaneEMax: 40.85,
      },
    });
    const watchSummary = buildEmcModuleSummary(8, {
      sourceFiles: ["L.pdf", "N.pdf"],
      verdict: "PASS",
      channelCount: 2,
      pointCount: 320,
      worstRecord: null,
      counts: {
        high: 1,
        mid: 0,
        safe: 20,
        overLimit: 0,
      },
    });

    const overall = buildLaboratoryOverallAdjudication([passSummary, watchSummary]);

    expect(overall).toMatchObject({
      verdict: "WATCH",
      passCount: 1,
      watchCount: 1,
      failCount: 0,
      pendingCount: 0,
      watchModules: ["传导 / 辐射解析"],
    });
  });

  it("blocks export when report metadata or module parsing is incomplete", () => {
    const meta: LaboratoryReportMeta = {
      reportNo: "LAB-20260712-001",
      projectName: "",
      sampleName: "MR16",
      sampleNo: "S-01",
      customer: "研发",
      stage: "DVT",
      testDate: "2026-07-12",
      operator: "",
      reviewer: "QA",
    };

    const gate = buildLaboratoryExportGate([buildMountedModuleSummary(9, "HARMONIC")], meta);

    expect(gate).toMatchObject({
      canExport: false,
      level: "block",
      label: "阻断导出",
    });
    expect(gate.reasons).toEqual(
      expect.arrayContaining([
        "报告元信息缺失：项目名称、测试人员。",
        "仍有模块未完成解析：谐波解析。",
      ]),
    );
  });

  it("allows risk export when parsing is complete but watch items exist", () => {
    const meta: LaboratoryReportMeta = {
      reportNo: "LAB-20260712-001",
      projectName: "MR16 验证",
      sampleName: "MR16",
      sampleNo: "S-01",
      customer: "研发",
      stage: "DVT",
      testDate: "2026-07-12",
      operator: "LAB",
      reviewer: "QA",
    };
    const watchSummary = buildEmcModuleSummary(8, {
      sourceFiles: ["L.pdf", "N.pdf"],
      verdict: "PASS",
      channelCount: 2,
      pointCount: 320,
      worstRecord: null,
      counts: {
        high: 1,
        mid: 0,
        safe: 20,
        overLimit: 0,
      },
    });

    const gate = buildLaboratoryExportGate([watchSummary], meta);

    expect(gate).toMatchObject({
      canExport: true,
      level: "watch",
      label: "带风险导出",
    });
    expect(gate.reasons).toContain("存在 WATCH 模块：传导 / 辐射解析。");
  });

  it("builds reliability-life summaries from Arrhenius projection margins", () => {
    const summary = buildReliabilityLifeModuleSummary(10, {
      tUse: 127,
      tOven: 45,
      ea: 0.9,
      duration: 500,
      targetYears: 3,
      dailyHours: 24,
      af: 3.46,
      projectedLife: 1730,
      survivalYears: 0.2,
      targetLifeHours: 26280,
      requiredTestHours: 7595,
      valid: true,
    });

    expect(summary).toMatchObject({
      nodeId: 10,
      type: "RELIABILITY_LIFE",
      verdict: "FAIL",
      status: "fail",
    });
    expect(summary.keyMetrics).toEqual(
      expect.arrayContaining([
        { label: "加速倍率", value: "3.46x" },
        { label: "设计寿命", value: "3 年" },
      ]),
    );
    expect(summary.warnings).toContain("等效寿命未达到设计寿命目标，需要提高测试工时或复核加速条件。");
  });

  it("builds time-series summaries and flags built-in sample data", () => {
    const summary = buildTimeSeriesModuleSummary(11, {
      sourceName: "内置示例数据",
      updatedAt: "2026-07-12 10:00:00",
      timeHeader: "时间",
      rowCount: 18,
      columnCount: 5,
      visibleColumnLabels: ["A点", "B点"],
      minValue: 4,
      maxValue: 8,
      averageValue: 6.2,
      maxSpread: 3,
    });

    expect(summary).toMatchObject({
      nodeId: 11,
      type: "TIME_SERIES",
      verdict: "WATCH",
      status: "watch",
    });
    expect(summary.keyMetrics).toEqual(
      expect.arrayContaining([
        { label: "记录数", value: "18" },
        { label: "可视列", value: "A点、B点" },
      ]),
    );
    expect(summary.warnings).toContain("当前仍为内置示例数据，导出前建议上传真实温升 Excel。");
  });

  it("builds battery-cycle summaries from battery adjudication outputs", () => {
    const summary = buildBatteryCycleModuleSummary(12, {
      sourceFile: "EL2600 电池循环1#.xlsx",
      deviceLabel: "EL2600 电池循环 1#",
      overallLevel: "Watch",
      statusText: "容量衰减在容差内",
      cycleCount: 18,
      targetCycles: 18,
      sampleCount: 10358,
      initialCap: 1.7206,
      retention: 98.2,
      maxIr: 7.39,
      finalMedianVoltage: 6.74,
      avgEfficiency: 99.82,
      templateGrade: "A",
      templateScore: 96,
      failedRuleNames: [],
      watchRuleNames: ["DCIR 趋势观察"],
    });

    expect(summary).toMatchObject({
      nodeId: 12,
      type: "BATTERY_CYCLE",
      verdict: "WATCH",
      status: "watch",
      sourceFiles: ["EL2600 电池循环1#.xlsx"],
    });
    expect(summary.keyMetrics).toEqual(
      expect.arrayContaining([
        { label: "循环覆盖", value: "18/18" },
        { label: "最终 SOH", value: "98.20%" },
        { label: "最大 DCIR", value: "7.39 mΩ" },
      ]),
    );
    expect(summary.warnings).toContain("观察规则：DCIR 趋势观察。");
  });
});
