import { evaluateFlickerEvidence } from "./flicker-rules";

export type TelemetryNodeType =
  | "INTEGRATING_SPHERE"
  | "DARKROOM"
  | "FLICKER"
  | "EMISSION"
  | "HARMONIC"
  | "FINAL_SAMPLE_REPORT"
  | "PRODUCT_ILLUSTRATION"
  | "RELIABILITY_LIFE"
  | "TIME_SERIES"
  | "BATTERY_CYCLE"
  | "IK_IMPACT";

export type LaboratoryModuleStatus = "not_started" | "mounted" | "parsed" | "watch" | "fail";

export type LaboratoryModuleDefinition = {
  type: TelemetryNodeType;
  label: string;
  printTitle: string;
  category: "光学" | "电性能" | "可靠性" | "热测试" | "综合";
  uploadMode: "single-pdf" | "three-variant-pdf" | "multi-pdf" | "single-excel" | "manual";
  supportsPrint: boolean;
  parserEndpoint?: string;
};

export type LaboratoryModuleSummary = {
  nodeId: number;
  type: TelemetryNodeType;
  label: string;
  printTitle: string;
  category: LaboratoryModuleDefinition["category"];
  status: LaboratoryModuleStatus;
  verdict: "待解析" | "PASS" | "WATCH" | "FAIL";
  sourceFiles: string[];
  keyMetrics: Array<{ label: string; value: string }>;
  warnings: string[];
  imageUrl?: string;
  moduleData?: unknown;
};

export type LaboratoryReportMeta = {
  reportNo: string;
  projectName: string;
  sampleName: string;
  sampleNo: string;
  customer: string;
  stage: string;
  testDate: string;
  operator: string;
  reviewer: string;
};

export type LaboratoryOverallVerdict = "待完成" | "PASS" | "WATCH" | "FAIL";
export type LaboratoryFinalVerdict = "PASS" | "FAIL";

export type LaboratoryOverallAdjudication = {
  verdict: LaboratoryOverallVerdict;
  summary: string;
  passCount: number;
  watchCount: number;
  failCount: number;
  pendingCount: number;
  blockingModules: string[];
  watchModules: string[];
  pendingModules: string[];
};

export type LaboratoryExportGate = {
  canExport: boolean;
  level: "pass" | "watch" | "block";
  label: "允许导出" | "带风险导出" | "阻断导出";
  reasons: string[];
};

const REQUIRED_REPORT_META_FIELDS: Array<{ key: keyof LaboratoryReportMeta; label: string }> = [
  { key: "reportNo", label: "报告编号" },
  { key: "projectName", label: "项目名称" },
  { key: "sampleName", label: "样品名称" },
  { key: "testDate", label: "测试日期" },
  { key: "operator", label: "测试人员" },
];

export const LABORATORY_MODULES: LaboratoryModuleDefinition[] = [
  {
    type: "INTEGRATING_SPHERE",
    label: "积分球解析",
    printTitle: "积分球光色电报告",
    category: "光学",
    uploadMode: "three-variant-pdf",
    supportsPrint: true,
    parserEndpoint: "/api/dashboard/laboratory-pdf/parse-upload",
  },
  {
    type: "DARKROOM",
    label: "暗房解析",
    printTitle: "暗房配光测试报告",
    category: "光学",
    uploadMode: "multi-pdf",
    supportsPrint: true,
    parserEndpoint: "/api/dashboard/darkroom-pdf/parse-upload",
  },
  {
    type: "FLICKER",
    label: "频闪解析",
    printTitle: "频闪测试报告",
    category: "电性能",
    uploadMode: "multi-pdf",
    supportsPrint: true,
    parserEndpoint: "/api/dashboard/flicker-pdf/parse-upload",
  },
  {
    type: "EMISSION",
    label: "传导 / 辐射解析",
    printTitle: "传导与辐射测试报告",
    category: "电性能",
    uploadMode: "single-pdf",
    supportsPrint: true,
    parserEndpoint: "/api/dashboard/emc-pdf/parse-upload",
  },
  {
    type: "HARMONIC",
    label: "谐波解析",
    printTitle: "谐波功率测试报告",
    category: "电性能",
    uploadMode: "single-pdf",
    supportsPrint: true,
    parserEndpoint: "/api/dashboard/harmonic-pdf/parse-upload",
  },
  {
    type: "FINAL_SAMPLE_REPORT",
    label: "终样报告",
    printTitle: "终样测试报告",
    category: "综合",
    uploadMode: "single-excel",
    supportsPrint: true,
  },
  {
    type: "PRODUCT_ILLUSTRATION",
    label: "产品图示区",
    printTitle: "产品图示资料",
    category: "综合",
    uploadMode: "manual",
    supportsPrint: false,
  },
  {
    type: "RELIABILITY_LIFE",
    label: "可靠性寿命测试",
    printTitle: "可靠性寿命测算报告",
    category: "可靠性",
    uploadMode: "manual",
    supportsPrint: true,
  },
  {
    type: "TIME_SERIES",
    label: "温升测试",
    printTitle: "温升测试报告",
    category: "热测试",
    uploadMode: "manual",
    supportsPrint: true,
  },
  {
    type: "BATTERY_CYCLE",
    label: "电池充放电",
    printTitle: "电池充放电循环测试报告",
    category: "可靠性",
    uploadMode: "single-excel",
    supportsPrint: true,
  },
  {
    type: "IK_IMPACT",
    label: "IK 冲击试验",
    printTitle: "IK 冲击试验报告",
    category: "可靠性",
    uploadMode: "single-pdf",
    supportsPrint: true,
    parserEndpoint: "/api/dashboard/ik-pdf/parse-upload",
  },
];

export function getLaboratoryModuleDefinition(type: TelemetryNodeType) {
  return LABORATORY_MODULES.find((module) => module.type === type) ?? null;
}

export function buildMountedModuleSummary(nodeId: number, type: TelemetryNodeType): LaboratoryModuleSummary {
  const definition = getLaboratoryModuleDefinition(type);
  return {
    nodeId,
    type,
    label: definition?.label ?? type,
    printTitle: definition?.printTitle ?? type,
    category: definition?.category ?? "电性能",
    status: "mounted",
    verdict: "待解析",
    sourceFiles: [],
    keyMetrics: [
      { label: "接入状态", value: "已挂载" },
      { label: "数据契约", value: "等待子模块标准摘要接入" },
    ],
    warnings: ["当前模块仍使用交互视图数据，后续将接入标准化解析摘要。"],
  };
}

function formatMetricValue(value: string, unit?: string) {
  if (!unit) return value;
  return value === "--" ? value : `${value} ${unit}`;
}

export function buildIntegratingSphereModuleSummary(
  nodeId: number,
  payload: {
    verdict: "PASS" | "WATCH" | "FAIL";
    sourceFiles: string[];
    activeVariantLabel: string;
    activeMetrics: {
      productModel: string;
      testDate: string;
      flux: { value: string; unit?: string };
      efficacy: { value: string; unit?: string };
      cct: { value: string; unit?: string };
      raR9: { value: string; unit?: string };
      power: { value: string; unit?: string };
    };
    parsedCount: number;
    expectedCount: number;
  },
): LaboratoryModuleSummary {
  const definition = getLaboratoryModuleDefinition("INTEGRATING_SPHERE");
  const isComplete = payload.parsedCount >= payload.expectedCount;

  return {
    nodeId,
    type: "INTEGRATING_SPHERE",
    label: definition?.label ?? "积分球解析",
    printTitle: definition?.printTitle ?? "积分球光色电报告",
    category: definition?.category ?? "光学",
    status: payload.verdict === "FAIL" ? "fail" : "parsed",
    verdict: payload.verdict,
    sourceFiles: payload.sourceFiles,
    keyMetrics: [
      { label: "当前光色", value: payload.activeVariantLabel },
      { label: "产品型号", value: payload.activeMetrics.productModel },
      { label: "测试日期", value: payload.activeMetrics.testDate },
      { label: "光通量", value: formatMetricValue(payload.activeMetrics.flux.value, payload.activeMetrics.flux.unit) },
      { label: "光效", value: formatMetricValue(payload.activeMetrics.efficacy.value, payload.activeMetrics.efficacy.unit) },
      { label: "色温", value: formatMetricValue(payload.activeMetrics.cct.value, payload.activeMetrics.cct.unit) },
      { label: "显指/R9", value: formatMetricValue(payload.activeMetrics.raR9.value, payload.activeMetrics.raR9.unit) },
      { label: "功率", value: formatMetricValue(payload.activeMetrics.power.value, payload.activeMetrics.power.unit) },
    ],
    warnings: [
      ...(isComplete ? [] : [`三色报告未齐套：已解析 ${payload.parsedCount}/${payload.expectedCount}。`]),
      ...(payload.verdict === "FAIL" ? ["至少一份积分球报告缺少核心光色电字段，综合判定为 FAIL。"] : []),
    ],
  };
}

export function buildDarkroomModuleSummary(
  nodeId: number,
  payload: {
    sourceFiles: string[];
    activeVariantLabel: string;
    parsedCount: number;
    expectedCount: number;
    activeMetrics: {
      name: string;
      testDate: string;
      ratedFlux: number | null;
      testedPower: number | null;
      efficacy: number | null;
      maxCandela: number | null;
      beamAngleV: number | null;
      beamAngleH: number | null;
      fieldAngleV: number | null;
      fieldAngleH: number | null;
      workingPlaneEMax: number | null;
    };
    batchConsistency?: {
      sampleCount: number;
      worstMetric: string;
      worstSpread: string;
      watchCount: number;
      driftCount: number;
    };
  },
): LaboratoryModuleSummary {
  const definition = getLaboratoryModuleDefinition("DARKROOM");
  const isComplete = payload.parsedCount >= payload.expectedCount;
  const hasCoreMetrics = [
    payload.activeMetrics.ratedFlux,
    payload.activeMetrics.testedPower,
    payload.activeMetrics.efficacy,
    payload.activeMetrics.maxCandela,
  ].every((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
  const formatDarkroomMetric = (value: number | null, digits: number, unit: string) =>
    value == null || !Number.isFinite(value) ? "--" : `${value.toFixed(digits)} ${unit}`;
  const formatAnglePair = (v: number | null, h: number | null) =>
    v == null || h == null || !Number.isFinite(v) || !Number.isFinite(h)
      ? "--"
      : `${v.toFixed(1)}° / ${h.toFixed(1)}°`;
  const hasBatchWatch = Boolean(
    payload.batchConsistency &&
      payload.batchConsistency.sampleCount > 1 &&
      (payload.batchConsistency.watchCount > 0 || payload.batchConsistency.driftCount > 0),
  );

  return {
    nodeId,
    type: "DARKROOM",
    label: definition?.label ?? "暗房解析",
    printTitle: definition?.printTitle ?? "暗房配光测试报告",
    category: definition?.category ?? "光学",
    status: !hasCoreMetrics ? "fail" : hasBatchWatch || !isComplete ? "watch" : "parsed",
    verdict: !hasCoreMetrics ? "FAIL" : hasBatchWatch || !isComplete ? "WATCH" : "PASS",
    sourceFiles: payload.sourceFiles,
    keyMetrics: [
      { label: "当前光色", value: payload.activeVariantLabel },
      { label: "样品名称", value: payload.activeMetrics.name },
      { label: "测试日期", value: payload.activeMetrics.testDate },
      { label: "光通量", value: formatDarkroomMetric(payload.activeMetrics.ratedFlux, 1, "lm") },
      { label: "功率", value: formatDarkroomMetric(payload.activeMetrics.testedPower, 2, "W") },
      { label: "光效", value: formatDarkroomMetric(payload.activeMetrics.efficacy, 2, "lm/W") },
      { label: "最大光强", value: formatDarkroomMetric(payload.activeMetrics.maxCandela, 1, "cd") },
      { label: "光束角", value: formatAnglePair(payload.activeMetrics.beamAngleV, payload.activeMetrics.beamAngleH) },
      { label: "场角", value: formatAnglePair(payload.activeMetrics.fieldAngleV, payload.activeMetrics.fieldAngleH) },
      { label: "工作面最大照度", value: formatDarkroomMetric(payload.activeMetrics.workingPlaneEMax, 2, "lx") },
      ...(payload.batchConsistency
        ? [
            { label: "批次报告数", value: String(payload.batchConsistency.sampleCount) },
            {
              label: "最大复测偏差",
              value:
                payload.batchConsistency.worstMetric === "--"
                  ? "--"
                  : `${payload.batchConsistency.worstMetric} / ${payload.batchConsistency.worstSpread}`,
            },
            {
              label: "复测观察项",
              value: `${payload.batchConsistency.watchCount} WATCH / ${payload.batchConsistency.driftCount} DRIFT`,
            },
          ]
        : []),
    ],
    warnings: [
      ...(isComplete ? [] : [`三色暗房报告未齐套：已解析 ${payload.parsedCount}/${payload.expectedCount}。`]),
      ...(hasCoreMetrics ? [] : ["暗房报告缺少核心配光指标，综合判定为 FAIL。"]),
      ...(payload.batchConsistency?.watchCount
        ? [`暗房复测一致性存在 ${payload.batchConsistency.watchCount} 项 WATCH，建议结合样品状态和测试设定复核。`]
        : []),
      ...(payload.batchConsistency?.driftCount
        ? [`暗房复测一致性存在 ${payload.batchConsistency.driftCount} 项 DRIFT，建议优先复核 ${payload.batchConsistency.worstMetric}。`]
        : []),
    ],
  };
}

export function buildFlickerModuleSummary(
  nodeId: number,
  payload: {
    sourceFiles: string[];
    sampleCount: number;
    worstSample: string;
    worstFlickerPercent: number | null;
    worstFlickerIndex: number | null;
    worstFrequencyHz: number | null;
    flickerPercentDelta: number | null;
    flickerIndexDelta: number | null;
    frequencyDelta: number | null;
    pst?: number | null;
    pstResult?: string | null;
    pstStandard?: string | null;
    svm?: number | null;
    svmVisibility?: string | null;
    svmErp?: string | null;
    svmStandard?: string | null;
    flickerStandard?: string | null;
  },
): LaboratoryModuleSummary {
  const definition = getLaboratoryModuleDefinition("FLICKER");
  const evaluation = evaluateFlickerEvidence({
    flickerPercent: payload.worstFlickerPercent,
    pstResult: payload.pstResult,
    svmErp: payload.svmErp,
  });
  const formatNumber = (value: number | null | undefined, digits = 3, unit = "") =>
    value == null ? "--" : `${value.toFixed(digits)}${unit}`;

  return {
    nodeId,
    type: "FLICKER",
    label: definition?.label ?? "频闪解析",
    printTitle: definition?.printTitle ?? "频闪测试报告",
    category: definition?.category ?? "电性能",
    status: evaluation.status,
    verdict: evaluation.verdict,
    sourceFiles: payload.sourceFiles,
    keyMetrics: [
      { label: "样本数量", value: String(payload.sampleCount) },
      { label: "最差样本", value: payload.worstSample || "--" },
      { label: "最差频闪率", value: formatNumber(payload.worstFlickerPercent, 3, "%") },
      { label: "最差频闪指数", value: formatNumber(payload.worstFlickerIndex) },
      { label: "Pst", value: `${formatNumber(payload.pst)}${payload.pstResult ? ` / ${payload.pstResult}` : ""}` },
      { label: "SVM", value: `${formatNumber(payload.svm)}${payload.svmErp ? ` / ERP ${payload.svmErp}` : ""}` },
      { label: "SVM可见性", value: payload.svmVisibility || "--" },
      { label: "最差频率", value: formatNumber(payload.worstFrequencyHz, 3, " Hz") },
      { label: "频闪标准", value: payload.flickerStandard || "--" },
      { label: "Pst标准", value: payload.pstStandard || "--" },
      { label: "SVM标准", value: payload.svmStandard || "--" },
      { label: "频闪率偏差", value: payload.flickerPercentDelta == null ? "--" : `Δ ${payload.flickerPercentDelta.toFixed(3)}%` },
      { label: "频闪指数偏差", value: payload.flickerIndexDelta == null ? "--" : `Δ ${payload.flickerIndexDelta.toFixed(3)}` },
      { label: "频率偏差", value: payload.frequencyDelta == null ? "--" : `Δ ${payload.frequencyDelta.toFixed(3)} Hz` },
    ],
    warnings: [
      ...(payload.sampleCount > 0 ? [] : ["未解析到频闪样本。"]),
      ...(evaluation.flickerFail ? ["最差频闪率超过 8% 低风险阈值，建议复核驱动批次与关键元件。"] : []),
      ...(evaluation.pstFail ? ["Pst 报告结论不是可接受状态，请复核实验室报告。"] : []),
      ...(evaluation.svmFail ? ["SVM 报告 ERP 结论不是 PASS，请复核实验室报告。"] : []),
      ...(evaluation.lowRisk ? ["频闪率超过 1% 无风险阈值，但未超过 8% 低风险阈值，建议保持关注。"] : []),
    ],
  };
}

export function buildHarmonicModuleSummary(
  nodeId: number,
  payload: {
    sourceFile: string;
    verdict: "PASS" | "WATCH" | "FAIL";
    productName: string;
    standard: string;
    testDate: string;
    ithdPercent: number | null;
    thcMa: number | null;
    powerFactor: number | null;
    powerW: number | null;
    frequencyHz: number | null;
    worstMargin: number | null;
    failHarmonics: string[];
    phaseFailCount: number;
    structuralFailCount: number;
    observationCount?: number;
  },
): LaboratoryModuleSummary {
  const definition = getLaboratoryModuleDefinition("HARMONIC");

  return {
    nodeId,
    type: "HARMONIC",
    label: definition?.label ?? "谐波解析",
    printTitle: definition?.printTitle ?? "谐波功率测试报告",
    category: definition?.category ?? "电性能",
    status: payload.verdict === "FAIL" ? "fail" : payload.verdict === "WATCH" ? "watch" : "parsed",
    verdict: payload.verdict,
    sourceFiles: payload.sourceFile ? [payload.sourceFile] : [],
    keyMetrics: [
      { label: "产品名称", value: payload.productName || "--" },
      { label: "测试标准", value: payload.standard || "--" },
      { label: "测试日期", value: payload.testDate || "--" },
      { label: "THDi", value: payload.ithdPercent == null ? "--" : `${payload.ithdPercent.toFixed(2)}%` },
      { label: "THC", value: payload.thcMa == null ? "--" : `${payload.thcMa.toFixed(2)} mA` },
      { label: "功率因数", value: payload.powerFactor == null ? "--" : payload.powerFactor.toFixed(3) },
      { label: "功率", value: payload.powerW == null ? "--" : `${payload.powerW.toFixed(2)} W` },
      { label: "频率", value: payload.frequencyHz == null ? "--" : `${payload.frequencyHz.toFixed(2)} Hz` },
      { label: "最小余量", value: payload.worstMargin == null ? "--" : `${payload.worstMargin.toFixed(2)}%` },
      { label: "超标谐波", value: payload.failHarmonics.length ? payload.failHarmonics.join("、") : "无" },
    ],
    warnings: [
      ...(payload.verdict === "FAIL" ? ["谐波报告存在超限或结构检查失败项。"] : []),
      ...(payload.phaseFailCount > 0 ? [`相位角检查失败 ${payload.phaseFailCount} 项。`] : []),
      ...(payload.structuralFailCount > 0 ? [`结构硬伤检查失败 ${payload.structuralFailCount} 项。`] : []),
    ],
  };
}

export function buildEmcModuleSummary(
  nodeId: number,
  payload: {
    sourceFiles: string[];
    verdict: "PASS" | "FAIL";
    channelCount: number;
    pointCount: number;
    worstRecord: {
      channel: string;
      band: string;
      detector: string;
      freq: number;
      reading: number;
      limit: number;
      margin: number;
    } | null;
    counts: {
      high: number;
      mid: number;
      safe: number;
      overLimit: number;
    };
  },
): LaboratoryModuleSummary {
  const definition = getLaboratoryModuleDefinition("EMISSION");
  const watch = payload.verdict === "PASS" && (payload.counts.high > 0 || payload.counts.mid > 0);

  return {
    nodeId,
    type: "EMISSION",
    label: definition?.label ?? "传导 / 辐射解析",
    printTitle: definition?.printTitle ?? "传导与辐射测试报告",
    category: definition?.category ?? "电性能",
    status: payload.verdict === "FAIL" ? "fail" : watch ? "watch" : "parsed",
    verdict: payload.verdict === "FAIL" ? "FAIL" : watch ? "WATCH" : "PASS",
    sourceFiles: payload.sourceFiles,
    keyMetrics: [
      { label: "通道数", value: String(payload.channelCount) },
      { label: "频点数", value: String(payload.pointCount) },
      { label: "超标频点", value: String(payload.counts.overLimit) },
      { label: "高风险点", value: String(payload.counts.high) },
      { label: "需审查点", value: String(payload.counts.mid) },
      { label: "安全点", value: String(payload.counts.safe) },
      { label: "最差频点", value: payload.worstRecord ? `${payload.worstRecord.freq.toFixed(3)} MHz` : "--" },
      { label: "最小余量", value: payload.worstRecord ? `${payload.worstRecord.margin.toFixed(1)} dB` : "--" },
      { label: "最差通道", value: payload.worstRecord ? `${payload.worstRecord.channel} / ${payload.worstRecord.detector}` : "--" },
    ],
    warnings: [
      ...(payload.counts.overLimit > 0 ? [`存在 ${payload.counts.overLimit} 个 EMC 超标频点。`] : []),
      ...(watch ? ["当前无超标频点，但存在小余量频点，建议保留整改余量。"] : []),
      ...(payload.channelCount < 2 ? ["当前接入通道较少，综合判定覆盖不足。"] : []),
    ],
  };
}

export function buildReliabilityLifeModuleSummary(
  nodeId: number,
  payload: {
    tUse: number;
    tOven: number;
    ea: number;
    duration: number;
    targetYears: number;
    dailyHours: number;
    af: number;
    projectedLife: number;
    survivalYears: number;
    targetLifeHours: number;
    requiredTestHours: number;
    valid: boolean;
  },
): LaboratoryModuleSummary {
  const definition = getLaboratoryModuleDefinition("RELIABILITY_LIFE");
  const lifeRatio = payload.targetLifeHours > 0 ? payload.projectedLife / payload.targetLifeHours : 0;
  const fail = !payload.valid || lifeRatio < 1;
  const watch = !fail && lifeRatio < 1.1;

  return {
    nodeId,
    type: "RELIABILITY_LIFE",
    label: definition?.label ?? "可靠性寿命测试",
    printTitle: definition?.printTitle ?? "可靠性寿命测算报告",
    category: definition?.category ?? "可靠性",
    status: fail ? "fail" : watch ? "watch" : "parsed",
    verdict: fail ? "FAIL" : watch ? "WATCH" : "PASS",
    sourceFiles: ["手工参数 / 阿伦尼乌斯模型"],
    keyMetrics: [
      { label: "工作温度", value: `${payload.tUse.toFixed(0)} °C` },
      { label: "烤箱温度", value: `${payload.tOven.toFixed(0)} °C` },
      { label: "激活能", value: `${payload.ea.toFixed(2)} eV` },
      { label: "测试工时", value: `${payload.duration.toFixed(0)} h` },
      { label: "加速倍率", value: `${payload.af.toFixed(2)}x` },
      { label: "等效寿命", value: `${payload.projectedLife.toLocaleString("en-US", { maximumFractionDigits: 0 })} h` },
      { label: "设计寿命", value: `${payload.targetYears.toFixed(0)} 年` },
      { label: "寿命余量", value: `${((lifeRatio - 1) * 100).toFixed(1)}%` },
      { label: "达标所需工时", value: `${payload.requiredTestHours.toLocaleString("en-US", { maximumFractionDigits: 0 })} h` },
    ],
    warnings: [
      ...(!payload.valid ? ["测试结温未高于工作结温，阿伦尼乌斯加速模型无效。"] : []),
      ...(fail && payload.valid ? ["等效寿命未达到设计寿命目标，需要提高测试工时或复核加速条件。"] : []),
      ...(watch ? ["等效寿命已达标但余量低于 10%，建议复核激活能假设与测试边界。"] : []),
    ],
  };
}

export function buildTimeSeriesModuleSummary(
  nodeId: number,
  payload: {
    sourceName: string;
    updatedAt: string;
    timeHeader: string;
    rowCount: number;
    columnCount: number;
    visibleColumnLabels: string[];
    minValue: number;
    maxValue: number;
    averageValue: number;
    maxSpread: number;
  },
): LaboratoryModuleSummary {
  const definition = getLaboratoryModuleDefinition("TIME_SERIES");
  const hasData = payload.rowCount > 0 && payload.columnCount > 0;
  const isSampleData = payload.sourceName === "内置示例数据";
  const highSpread = payload.maxSpread > 20;
  const fail = !hasData;
  const watch = !fail && (isSampleData || highSpread);

  return {
    nodeId,
    type: "TIME_SERIES",
    label: definition?.label ?? "温升测试",
    printTitle: definition?.printTitle ?? "温升测试报告",
    category: definition?.category ?? "热测试",
    status: fail ? "fail" : watch ? "watch" : "parsed",
    verdict: fail ? "FAIL" : watch ? "WATCH" : "PASS",
    sourceFiles: payload.sourceName ? [payload.sourceName] : [],
    keyMetrics: [
      { label: "数据源", value: payload.sourceName || "--" },
      { label: "时间轴", value: payload.timeHeader || "--" },
      { label: "记录数", value: String(payload.rowCount) },
      { label: "数据列", value: String(payload.columnCount) },
      { label: "可视列", value: payload.visibleColumnLabels.join("、") || "--" },
      { label: "最小值", value: Number.isFinite(payload.minValue) ? payload.minValue.toFixed(2) : "--" },
      { label: "最大值", value: Number.isFinite(payload.maxValue) ? payload.maxValue.toFixed(2) : "--" },
      { label: "均值", value: Number.isFinite(payload.averageValue) ? payload.averageValue.toFixed(2) : "--" },
      { label: "最大列差", value: Number.isFinite(payload.maxSpread) ? payload.maxSpread.toFixed(2) : "--" },
      { label: "更新时间", value: payload.updatedAt || "--" },
    ],
    warnings: [
      ...(fail ? ["温升测试未读取到有效时间序列数据。"] : []),
      ...(isSampleData ? ["当前仍为内置示例数据，导出前建议上传真实温升 Excel。"] : []),
      ...(highSpread ? ["可视测点最大差值超过 20，建议复核测点一致性或异常点。"] : []),
    ],
  };
}

export function buildBatteryCycleModuleSummary(
  nodeId: number,
  payload: {
    sourceFile: string;
    deviceLabel: string;
    overallLevel: "Pass" | "Watch" | "Fail";
    statusText: string;
    cycleCount: number;
    targetCycles: number;
    sampleCount: number;
    initialCap: number;
    retention: number;
    maxIr: number;
    finalMedianVoltage: number;
    avgEfficiency: number;
    templateGrade: string;
    templateScore: number;
    failedRuleNames: string[];
    watchRuleNames: string[];
  },
): LaboratoryModuleSummary {
  const definition = getLaboratoryModuleDefinition("BATTERY_CYCLE");
  const verdict = payload.overallLevel === "Fail" ? "FAIL" : payload.overallLevel === "Watch" ? "WATCH" : "PASS";

  return {
    nodeId,
    type: "BATTERY_CYCLE",
    label: definition?.label ?? "电池充放电",
    printTitle: definition?.printTitle ?? "电池充放电循环测试报告",
    category: definition?.category ?? "可靠性",
    status: verdict === "FAIL" ? "fail" : verdict === "WATCH" ? "watch" : "parsed",
    verdict,
    sourceFiles: payload.sourceFile ? [payload.sourceFile] : [],
    keyMetrics: [
      { label: "样品/设备", value: payload.deviceLabel || "--" },
      { label: "综合状态", value: payload.statusText || verdict },
      { label: "循环覆盖", value: `${payload.cycleCount}/${payload.targetCycles}` },
      { label: "采样点", value: payload.sampleCount.toLocaleString("en-US") },
      { label: "初始放电容量", value: `${payload.initialCap.toFixed(4)} Ah` },
      { label: "最终 SOH", value: `${payload.retention.toFixed(2)}%` },
      { label: "最大 DCIR", value: `${payload.maxIr.toFixed(2)} mΩ` },
      { label: "最终中值电压", value: `${payload.finalMedianVoltage.toFixed(3)} V` },
      { label: "平均效率", value: `${payload.avgEfficiency.toFixed(2)}%` },
      { label: "模板质量", value: `${payload.templateGrade} / ${payload.templateScore}` },
    ],
    warnings: [
      ...(payload.failedRuleNames.length ? [`失败规则：${payload.failedRuleNames.join("、")}。`] : []),
      ...(payload.watchRuleNames.length ? [`观察规则：${payload.watchRuleNames.join("、")}。`] : []),
      ...(payload.cycleCount < payload.targetCycles ? ["循环覆盖未达到流程目标，建议补齐测试周期或复核流程信息。"] : []),
    ],
  };
}

export function buildLaboratoryOverallAdjudication(
  summaries: LaboratoryModuleSummary[],
): LaboratoryOverallAdjudication {
  const passCount = summaries.filter((summary) => summary.verdict === "PASS").length;
  const watchModules = summaries.filter((summary) => summary.verdict === "WATCH").map((summary) => summary.label);
  const blockingModules = summaries.filter((summary) => summary.verdict === "FAIL").map((summary) => summary.label);
  const pendingModules = summaries.filter((summary) => summary.verdict === "待解析").map((summary) => summary.label);

  const verdict: LaboratoryOverallVerdict =
    summaries.length === 0 || pendingModules.length > 0
      ? "待完成"
      : blockingModules.length > 0
        ? "FAIL"
        : watchModules.length > 0
          ? "WATCH"
          : "PASS";

  const summary =
    verdict === "PASS"
      ? "已接入模块均完成解析且未发现风险项，可进入综合报告归档。"
      : verdict === "WATCH"
        ? `存在 ${watchModules.length} 个观察项，建议复核风险模块后再归档。`
        : verdict === "FAIL"
          ? `存在 ${blockingModules.length} 个失败模块，需要整改或复测后再关闭。`
          : pendingModules.length > 0
            ? `仍有 ${pendingModules.length} 个模块未完成解析，综合结论暂不关闭。`
            : "请先挂载并解析至少一个实验室测试模块。";

  return {
    verdict,
    summary,
    passCount,
    watchCount: watchModules.length,
    failCount: blockingModules.length,
    pendingCount: pendingModules.length,
    blockingModules,
    watchModules,
    pendingModules,
  };
}

export function buildLaboratoryExportGate(
  summaries: LaboratoryModuleSummary[],
  reportMeta?: LaboratoryReportMeta,
): LaboratoryExportGate {
  const reasons: string[] = [];
  const pendingModules = summaries.filter((summary) => summary.verdict === "待解析").map((summary) => summary.label);
  const watchModules = summaries.filter((summary) => summary.verdict === "WATCH").map((summary) => summary.label);
  const failModules = summaries.filter((summary) => summary.verdict === "FAIL").map((summary) => summary.label);

  if (summaries.length === 0) {
    reasons.push("当前没有已挂载测试模块。");
  }

  if (reportMeta) {
    const missingMeta = REQUIRED_REPORT_META_FIELDS
      .filter((field) => !reportMeta[field.key]?.trim())
      .map((field) => field.label);
    if (missingMeta.length > 0) {
      reasons.push(`报告元信息缺失：${missingMeta.join("、")}。`);
    }
  }

  if (pendingModules.length > 0) {
    reasons.push(`仍有模块未完成解析：${pendingModules.join("、")}。`);
  }

  if (reasons.length > 0) {
    return {
      canExport: false,
      level: "block",
      label: "阻断导出",
      reasons,
    };
  }

  const riskReasons = [
    ...(failModules.length > 0 ? [`存在 FAIL 模块：${failModules.join("、")}。`] : []),
    ...(watchModules.length > 0 ? [`存在 WATCH 模块：${watchModules.join("、")}。`] : []),
  ];

  if (riskReasons.length > 0) {
    return {
      canExport: true,
      level: "watch",
      label: "带风险导出",
      reasons: riskReasons,
    };
  }

  return {
    canExport: true,
    level: "pass",
    label: "允许导出",
    reasons: ["报告元信息完整，所有已挂载模块均完成解析。"],
  };
}
