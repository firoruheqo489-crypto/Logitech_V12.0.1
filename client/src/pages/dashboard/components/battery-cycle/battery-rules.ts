import type { BatteryDataset } from "./battery-data";

export type BatteryRuleLevel = "Pass" | "Watch" | "Fail";
export type BatteryRuleSourceType = "Excel解析" | "试验协议" | "工程阈值" | "数据完整性";
export type BatteryRuleBlockLevel = "阻断项" | "复核项" | "提示项";

export type BatteryRuleResult = {
  id: string;
  name: string;
  level: BatteryRuleLevel;
  metric: string;
  basis: string;
  source: string;
  sourceType: BatteryRuleSourceType;
  blockLevel: BatteryRuleBlockLevel;
  failAction: string;
  triggerCycles: number[];
};

export type CycleHighlight = {
  level: BatteryRuleLevel;
  reasons: string[];
};

export type BatteryAdjudication = {
  overallLevel: BatteryRuleLevel;
  statusText: string;
  summary: string;
  rules: BatteryRuleResult[];
  counts: Record<BatteryRuleLevel, number>;
  cycleHighlights: Record<number, CycleHighlight>;
};

export const BATTERY_RULES = {
  version: "Battery-Cycle-v1.1",
  expectedProtocol: {
    chargeCurrentA: 2.5,
    chargeVoltageV: 8.4,
    chargeCutoffA: 0.25,
    dischargeCurrentA: 5,
    dischargeVoltageV: 5.5,
    restMinutes: 6,
    currentToleranceA: 0.05,
    voltageToleranceV: 0.05,
    cutoffToleranceA: 0.03,
    restToleranceMinutes: 0.5,
  },
  soh: {
    watchBelowPercent: 95,
    failBelowPercent: 80,
    watchSingleDropPercent: 3,
    failSingleDropPercent: 10,
    watchWindowDropPercent: 2,
    failWindowDropPercent: 8,
  },
  dcir: {
    watchDeltaMOhm: 0.5,
    failDeltaMOhm: 1,
    watchSpikeMOhm: 0.8,
    failSpikeMOhm: 1.5,
  },
  medianVoltage: {
    watchDropV: 0.05,
    failDropV: 0.2,
  },
  efficiency: {
    minPercent: 95,
    watchSpreadPercent: 4,
    failSpreadPercent: 8,
  },
} as const;

type WidenConfig<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends object
      ? { -readonly [K in keyof T]: WidenConfig<T[K]> }
      : T;

export type BatteryRuleConfig = WidenConfig<typeof BATTERY_RULES>;

const RULE_META = {
  "data-integrity": {
    name: "数据完整性",
    sourceType: "数据完整性",
    blockLevel: "阻断项",
    failAction: "缺少必需 Sheet 或关键列时，不允许输出最终放行结论。",
  },
  "protocol-match": {
    name: "试验协议边界",
    sourceType: "试验协议",
    blockLevel: "复核项",
    failAction: "协议参数不匹配时，需要人工复核工步设置后再使用判定。",
  },
  "soh-retention": {
    name: "SOH 容量保持率",
    sourceType: "工程阈值",
    blockLevel: "阻断项",
    failAction: "容量低于 EOL 80% 或发生异常单点跌落时，建议暂停放行并复测。",
  },
  "soh-window": {
    name: "SOH 趋势窗口",
    sourceType: "工程阈值",
    blockLevel: "复核项",
    failAction: "趋势窗口快速衰减时，需要扩大循环数或复核异常循环。",
  },
  "dcir-trend": {
    name: "DCIR 趋势与尖峰",
    sourceType: "工程阈值",
    blockLevel: "复核项",
    failAction: "内阻跃升时，需要检查连接、夹具接触和样品极化状态。",
  },
  "median-voltage": {
    name: "中值电压下沉",
    sourceType: "工程阈值",
    blockLevel: "复核项",
    failAction: "中值电压明显下沉时，需要关联容量曲线和负载平台确认衰退机制。",
  },
  "efficiency-stability": {
    name: "效率稳定性",
    sourceType: "工程阈值",
    blockLevel: "复核项",
    failAction: "效率异常时，需要排查循环统计、能量积分和工步切换边界。",
  },
  "runtime-events": {
    name: "运行日志分级",
    sourceType: "Excel解析",
    blockLevel: "阻断项",
    failAction: "日志出现保护、故障或中断事件时，必须先完成异常归因。",
  },
  "temperature-channel": {
    name: "温度通道",
    sourceType: "Excel解析",
    blockLevel: "提示项",
    failAction: "温度通道缺失时，结论只能覆盖电性能，不能覆盖热风险。",
  },
} as const satisfies Record<
  string,
  {
    name: string;
    sourceType: BatteryRuleSourceType;
    blockLevel: BatteryRuleBlockLevel;
    failAction: string;
  }
>;

type RuleId = keyof typeof RULE_META;

const severity: Record<BatteryRuleLevel, number> = {
  Pass: 0,
  Watch: 1,
  Fail: 2,
};

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function closeTo(value: number | null | undefined, expected: number, tolerance: number) {
  return value != null && Math.abs(value - expected) <= tolerance;
}

function parseRestMinutes(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/(\d+)\s*:\s*(\d+)\s*:\s*(\d+)/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]) + Number(match[3]) / 60;
}

function pushHighlight(
  highlights: Record<number, CycleHighlight>,
  cycles: number[],
  level: BatteryRuleLevel,
  reason: string,
) {
  if (level === "Pass") return;

  cycles.forEach((cycle) => {
    if (!Number.isFinite(cycle) || cycle <= 0) return;
    const existing = highlights[cycle] ?? { level, reasons: [] };
    existing.level = severity[level] > severity[existing.level] ? level : existing.level;
    if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    highlights[cycle] = existing;
  });
}

function getEventProfile(dataset: BatteryDataset) {
  return dataset.parseSummary.logs.eventTypes.reduce(
    (acc, event) => {
      const label = event.label;
      const isNormalJump = /达到.+限制条件进行工步跳转/.test(label);
      const isCritical = /异常|故障|错误|保护|过压|过流|过温|温度|通讯|中断|终止|停止|急停/.test(label);
      if (isCritical) acc.critical += event.count;
      else if (isNormalJump) acc.normal += event.count;
      else acc.unknown += event.count;
      return acc;
    },
    { critical: 0, normal: 0, unknown: 0 },
  );
}

function pickCycleByValue(
  dataset: BatteryDataset,
  selector: (index: number) => number,
  mode: "min" | "max",
) {
  if (dataset.cycleStats.length === 0) return [];
  let selectedIndex = 0;
  dataset.cycleStats.forEach((_row, index) => {
    const value = selector(index);
    const current = selector(selectedIndex);
    if (mode === "min" ? value < current : value > current) {
      selectedIndex = index;
    }
  });
  return [dataset.cycleStats[selectedIndex].cycle];
}

function makeRule(
  id: RuleId,
  payload: Omit<BatteryRuleResult, "id" | "name" | "sourceType" | "blockLevel" | "failAction">,
): BatteryRuleResult {
  const meta = RULE_META[id];
  return {
    id,
    name: meta.name,
    sourceType: meta.sourceType,
    blockLevel: meta.blockLevel,
    failAction: meta.failAction,
    ...payload,
  };
}

export function evaluateBatteryRules(dataset: BatteryDataset, config: BatteryRuleConfig = BATTERY_RULES): BatteryAdjudication {
  const firstCycle = dataset.cycleStats[0];
  const lastCycle = dataset.cycleStats[dataset.cycleStats.length - 1];
  const firstWindow = dataset.cycleStats.slice(0, 3);
  const lastWindow = dataset.cycleStats.slice(-3);
  const soh = dataset.meta.retention;
  const dcirDelta = firstCycle && lastCycle ? lastCycle.ir - firstCycle.ir : 0;
  const dcirSpike = firstCycle ? dataset.meta.maxIr - firstCycle.ir : 0;
  const firstWindowSoh = avg(firstWindow.map((row) => row.retention));
  const lastWindowSoh = avg(lastWindow.map((row) => row.retention));
  const sohWindowDrop = Math.max(0, firstWindowSoh - lastWindowSoh);
  const sohDrops = dataset.cycleStats.slice(1).map((row, index) => ({
    cycle: row.cycle,
    drop: dataset.cycleStats[index].retention - row.retention,
  }));
  const largestSohDropEntry = sohDrops.reduce(
    (best, entry) => (entry.drop > best.drop ? entry : best),
    { cycle: 0, drop: 0 },
  );
  const largestSohDrop = Math.max(0, largestSohDropEntry.drop);
  const firstWindowMedianV = avg(firstWindow.map((row) => row.medianV));
  const lastWindowMedianV = avg(lastWindow.map((row) => row.medianV));
  const voltageDrop = Math.max(0, firstWindowMedianV - lastWindowMedianV);
  const efficiencyValues = dataset.cycleStats.map((row) => row.efficiency);
  const minEfficiency = efficiencyValues.length ? Math.min(...efficiencyValues) : 0;
  const maxEfficiency = efficiencyValues.length ? Math.max(...efficiencyValues) : 0;
  const efficiencySpread = maxEfficiency - minEfficiency;
  const eventProfile = getEventProfile(dataset);
  const validation = dataset.parseSummary.validation;
  const missingRequiredSheets = validation.missingSheets;
  const missingColumnLabels = validation.missingColumns.map((item) => `${item.sheet}:${item.columns.join("/")}`);
  const cycleCoverageRatio = dataset.meta.targetCycles > 0 ? dataset.meta.cycleCount / dataset.meta.targetCycles : 1;
  const hasTemperatureData = dataset.parseSummary.cycleStats.maxTemperature > 0;
  const charge = dataset.parseSummary.flow.steps.find((step) => step.step.includes("充电"));
  const discharge = dataset.parseSummary.flow.steps.find((step) => step.step.includes("放电"));
  const rest = dataset.parseSummary.flow.steps.find((step) => step.step.includes("静置"));
  const restMinutes = parseRestMinutes(rest?.timeLimit);
  const protocolMatches =
    closeTo(charge?.currentOrPower, config.expectedProtocol.chargeCurrentA, config.expectedProtocol.currentToleranceA) &&
    closeTo(charge?.constantVoltage ?? charge?.voltageLimit, config.expectedProtocol.chargeVoltageV, config.expectedProtocol.voltageToleranceV) &&
    closeTo(charge?.currentLimit, config.expectedProtocol.chargeCutoffA, config.expectedProtocol.cutoffToleranceA) &&
    closeTo(discharge?.currentOrPower, config.expectedProtocol.dischargeCurrentA, config.expectedProtocol.currentToleranceA) &&
    closeTo(discharge?.voltageLimit, config.expectedProtocol.dischargeVoltageV, config.expectedProtocol.voltageToleranceV) &&
    restMinutes != null &&
    Math.abs(restMinutes - config.expectedProtocol.restMinutes) <= config.expectedProtocol.restToleranceMinutes;
  const cycleRange = firstCycle && lastCycle ? `${firstCycle.cycle}-${lastCycle.cycle} 循环` : "已解析循环";
  const maxIrCycles = dataset.cycleStats.filter((row) => row.ir === dataset.meta.maxIr).map((row) => row.cycle);
  const lastWindowCycles = lastWindow.map((row) => row.cycle);
  const lowEfficiencyCycles = dataset.cycleStats.filter((row) => row.efficiency < config.efficiency.minPercent).map((row) => row.cycle);
  const efficiencyEdgeCycles = [
    ...pickCycleByValue(dataset, (index) => dataset.cycleStats[index].efficiency, "min"),
    ...pickCycleByValue(dataset, (index) => dataset.cycleStats[index].efficiency, "max"),
  ];

  const rules: BatteryRuleResult[] = [
    makeRule("data-integrity", {
      level: missingRequiredSheets.length > 0 || missingColumnLabels.length > 0 ? "Fail" : cycleCoverageRatio < 1 ? "Watch" : "Pass",
      metric:
        missingRequiredSheets.length > 0
          ? `缺失 ${missingRequiredSheets.join("、")}`
          : missingColumnLabels.length > 0
            ? `缺列 ${missingColumnLabels.join("、")}`
            : `${dataset.meta.cycleCount}/${dataset.meta.targetCycles} 循环`,
      basis: "测试数据、循环统计、流程信息为必需；循环数低于目标值时进入 Watch。",
      source: "Sheet 存在性与循环统计行数",
      triggerCycles: cycleCoverageRatio < 1 ? [lastCycle?.cycle ?? 0] : [],
    }),
    makeRule("protocol-match", {
      level: protocolMatches ? "Pass" : "Watch",
      metric: protocolMatches ? "匹配" : "需复核",
      basis: "期望：2.5A CC-CV 至 8.4V，0.25A 截止；5A 放电至 5.5V；静置 6 分钟。",
      source: "流程信息.csv / 流程信息 Sheet",
      triggerCycles: [],
    }),
    makeRule("soh-retention", {
      level:
        soh < config.soh.failBelowPercent || largestSohDrop >= config.soh.failSingleDropPercent
          ? "Fail"
          : soh < config.soh.watchBelowPercent || largestSohDrop >= config.soh.watchSingleDropPercent
            ? "Watch"
            : "Pass",
      metric: `${soh.toFixed(1)}% / 最大单跌 ${largestSohDrop.toFixed(1)}%`,
      basis: "Fail：SOH<80% 或单循环跌幅≥10%；Watch：SOH<95% 或单循环跌幅≥3%。",
      source: "循环统计.总放电容量(Ah)",
      triggerCycles: [
        ...(soh < config.soh.watchBelowPercent ? [lastCycle?.cycle ?? 0] : []),
        ...(largestSohDrop >= config.soh.watchSingleDropPercent ? [largestSohDropEntry.cycle] : []),
      ],
    }),
    makeRule("soh-window", {
      level: sohWindowDrop >= config.soh.failWindowDropPercent ? "Fail" : sohWindowDrop >= config.soh.watchWindowDropPercent ? "Watch" : "Pass",
      metric: `前/后窗口下降 ${sohWindowDrop.toFixed(1)}%`,
      basis: "用前 3 循环均值对比后 3 循环均值，降低单点噪声影响。",
      source: "循环统计.总放电容量(Ah)",
      triggerCycles: sohWindowDrop >= config.soh.watchWindowDropPercent ? lastWindowCycles : [],
    }),
    makeRule("dcir-trend", {
      level:
        Math.abs(dcirDelta) >= config.dcir.failDeltaMOhm || dcirSpike >= config.dcir.failSpikeMOhm
          ? "Fail"
          : Math.abs(dcirDelta) >= config.dcir.watchDeltaMOhm || dcirSpike >= config.dcir.watchSpikeMOhm
            ? "Watch"
            : "Pass",
      metric: `末首 Δ ${dcirDelta >= 0 ? "+" : ""}${dcirDelta.toFixed(2)} / 尖峰 +${dcirSpike.toFixed(2)} mΩ`,
      basis: "同时检查末首趋势和全周期最大尖峰；Watch：Δ≥0.5mΩ 或尖峰≥0.8mΩ；Fail：Δ≥1.0mΩ 或尖峰≥1.5mΩ。",
      source: "循环统计.直流内阻(mΩ)",
      triggerCycles: [
        ...(Math.abs(dcirDelta) >= config.dcir.watchDeltaMOhm ? [lastCycle?.cycle ?? 0] : []),
        ...(dcirSpike >= config.dcir.watchSpikeMOhm ? maxIrCycles : []),
      ],
    }),
    makeRule("median-voltage", {
      level: voltageDrop >= config.medianVoltage.failDropV ? "Fail" : voltageDrop >= config.medianVoltage.watchDropV ? "Watch" : "Pass",
      metric: `${voltageDrop.toFixed(2)}V`,
      basis: `基于 ${cycleRange} 前/后 3 循环中值电压均值；Watch：下降≥0.05V；Fail：下降≥0.20V。`,
      source: "循环统计.中值电压(V)",
      triggerCycles: voltageDrop >= config.medianVoltage.watchDropV ? lastWindowCycles : [],
    }),
    makeRule("efficiency-stability", {
      level:
        minEfficiency < config.efficiency.minPercent || efficiencySpread >= config.efficiency.failSpreadPercent
          ? "Fail"
          : efficiencySpread >= config.efficiency.watchSpreadPercent
            ? "Watch"
            : "Pass",
      metric: `${minEfficiency.toFixed(2)}-${maxEfficiency.toFixed(2)}%`,
      basis: "Pass：效率波动<4%；Watch：4-8%；Fail：≥8% 或最低效率<95%。",
      source: "循环统计.充放电效率(%)",
      triggerCycles:
        minEfficiency < config.efficiency.minPercent
          ? lowEfficiencyCycles
          : efficiencySpread >= config.efficiency.watchSpreadPercent
            ? efficiencyEdgeCycles
            : [],
    }),
    makeRule("runtime-events", {
      level: eventProfile.critical > 0 ? "Fail" : eventProfile.unknown > 0 ? "Watch" : "Pass",
      metric: `正常 ${eventProfile.normal} / 未知 ${eventProfile.unknown} / 异常 ${eventProfile.critical}`,
      basis: "正常工步跳转不扣分；未知事件 Watch；保护、故障、中断类事件 Fail。",
      source: "运行日志.事件类型",
      triggerCycles: [],
    }),
    makeRule("temperature-channel", {
      level: hasTemperatureData ? "Pass" : "Watch",
      metric: hasTemperatureData ? `${dataset.parseSummary.cycleStats.maxTemperature.toFixed(1)}℃` : "无有效温度",
      basis: "最高温度全为 0 时视为温度通道缺失，需要人工确认。",
      source: "循环统计.最高温度(℃)",
      triggerCycles: [],
    }),
  ];

  const cycleHighlights: Record<number, CycleHighlight> = {};
  rules.forEach((rule) => pushHighlight(cycleHighlights, rule.triggerCycles, rule.level, rule.name));

  const counts = rules.reduce<Record<BatteryRuleLevel, number>>(
    (acc, rule) => {
      acc[rule.level] += 1;
      return acc;
    },
    { Pass: 0, Watch: 0, Fail: 0 },
  );
  const blockingFailCount = rules.filter((rule) => rule.level === "Fail" && rule.blockLevel === "阻断项").length;
  const overallLevel: BatteryRuleLevel = blockingFailCount > 0 || counts.Fail > 0 ? "Fail" : counts.Watch > 0 ? "Watch" : "Pass";
  const statusText =
    overallLevel === "Fail"
      ? "[ 总判定：Fail / 存在阻断或失效风险 ]"
      : overallLevel === "Watch"
        ? "[ 总判定：Watch / 有条件进入下一阶段 ]"
        : "[ 总判定：Pass / 可进入下一阶段 ]";
  const summary =
    overallLevel === "Fail"
      ? "至少一项关键规则触发 Fail，建议暂停放行，并结合原始曲线、样品状态和测试夹具进行复核。"
      : overallLevel === "Watch"
        ? "未触发失效边界，但存在需关注项；建议带条件进入下一阶段，并持续跟踪容量、内阻、电压平台和日志事件。"
        : "各项规则均通过，样品在当前高倍率放电协议下未显示明显容量、内阻或电压异常。";

  return {
    overallLevel,
    statusText,
    summary,
    rules,
    counts,
    cycleHighlights,
  };
}
