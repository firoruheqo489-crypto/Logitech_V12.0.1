import { read, utils } from "xlsx";

export interface TimeSeriesPoint {
  sec: number;
  v: number;
  i: number;
  step: string;
  cycle: number;
}

export interface CycleStat {
  cycle: number;
  chargeCap: number;
  dischargeCap: number;
  efficiency: number;
  avgV: number;
  medianV: number;
  ir: number;
  retention: number;
}

export interface SheetParseSummary {
  name: string;
  ref: string;
  rowCount: number;
  columnCount: number;
  status: "empty" | "parsed";
  columns: string[];
}

export interface FlowStepSummary {
  step: string;
  currentOrPower: number | null;
  constantVoltage: number | null;
  voltageLimit: number | null;
  currentLimit: number | null;
  capacityLimit: number | null;
  timeLimit: string | null;
  jumpCount: number | null;
}

export interface BatteryParseSummary {
  sourceFile: string;
  sheets: SheetParseSummary[];
  validation: {
    requiredSheets: string[];
    missingSheets: string[];
    missingColumns: Array<{ sheet: string; columns: string[] }>;
    templateFingerprint: {
      version: string;
      compatibility: "模板匹配" | "模板偏移" | "模板不兼容";
      expectedSheets: string[];
      receivedSheets: string[];
      requiredColumnCount: number;
      matchedRequiredColumnCount: number;
      columnOrderWarnings: Array<{ sheet: string; expectedOrder: string[]; receivedOrder: string[] }>;
      reasons: string[];
    };
    quality: {
      score: number;
      grade: "A" | "B" | "C" | "D";
      issues: string[];
    };
  };
  testData: {
    startTime: string;
    endTime: string;
    sampleCount: number;
    cycleCount: number;
    stepTypes: string[];
    voltageMin: number;
    voltageMax: number;
    currentMin: number;
    currentMax: number;
    capacityMax: number;
    energyMax: number;
  };
  cycleStats: {
    rowCount: number;
    firstCycle: number;
    lastCycle: number;
    avgEfficiency: number;
    maxTemperature: number;
    maxIr: number;
    finalRetention: number;
  };
  logs: {
    rowCount: number;
    firstEventTime: string;
    lastEventTime: string;
    eventTypes: Array<{ label: string; count: number }>;
  };
  flow: {
    rowCount: number;
    targetCycles: number;
    steps: FlowStepSummary[];
  };
}

export interface BatteryDataset {
  timeSeries: TimeSeriesPoint[];
  cycleStats: CycleStat[];
  parseSummary: BatteryParseSummary;
  meta: {
    deviceLabel: string;
    cycleCount: number;
    targetCycles: number;
    initialCap: number;
    retention: number;
    maxIr: number;
    sampleCount: number;
  };
}

const BATTERY_DATASET_URL = "/battery-cycle/EL2600-1-453a4c.xlsx";
const BATTERY_SOURCE_FILE = "EL2600 电池循环1#.xlsx";
const TEMPLATE_VERSION = "EL2600-cycle-template-v1";

const round = (n: number, d: number) => {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
};

function readNumber(row: Record<string, unknown>, key: string, fallback = 0) {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readText(row: Record<string, unknown>, key: string, fallback = "") {
  const value = row[key];
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function readNullableNumber(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readNullableText(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value === "string" && value.trim()) return value;
  if (value == null || value === "") return null;
  return String(value);
}

function parseTimestamp(value: unknown) {
  if (typeof value === "number") {
    const parsed = utils.format_cell({ t: "n", v: value, z: "yyyy-mm-dd hh:mm:ss" });
    const epoch = Date.parse(parsed.replace(" ", "T"));
    return Number.isFinite(epoch) ? epoch : 0;
  }

  const epoch = Date.parse(String(value ?? "").replace(" ", "T"));
  return Number.isFinite(epoch) ? epoch : 0;
}

function minOf(values: number[]) {
  return values.length > 0 ? Math.min(...values) : 0;
}

function maxOf(values: number[]) {
  return values.length > 0 ? Math.max(...values) : 0;
}

function averageOf(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function buildSheetSummary(workbook: ReturnType<typeof read>): SheetParseSummary[] {
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = utils.sheet_to_json<unknown[]>(sheet ?? {}, { header: 1, blankrows: false, defval: null });
    const columns = (rows[0] ?? []).map((value) => String(value ?? "")).filter(Boolean);
    return {
      name,
      ref: sheet?.["!ref"] ?? "空",
      rowCount: Math.max(rows.length - 1, 0),
      columnCount: columns.length,
      status: rows.length > 0 ? "parsed" : "empty",
      columns,
    };
  });
}

const REQUIRED_COLUMNS: Record<string, string[]> = {
  测试数据: ["真实时间", "采样电压(V)", "采样电流(A)", "工步类型", "循环次数"],
  循环统计: ["循环号", "总放电容量(Ah)", "充放电效率(%)", "中值电压(V)", "直流内阻(mΩ)"],
  流程信息: ["工步类型"],
};

function buildValidation(
  sheets: SheetParseSummary[],
  context: {
    rawLogsCount: number;
    maxTemperature: number;
    cycleCount: number;
    targetCycles: number;
  },
) {
  const requiredSheets = Object.keys(REQUIRED_COLUMNS);
  const missingSheets = requiredSheets.filter((name) => {
    const sheet = sheets.find((item) => item.name === name);
    return !sheet || sheet.rowCount <= 0;
  });
  const missingColumns = requiredSheets
    .map((sheetName) => {
      const sheet = sheets.find((item) => item.name === sheetName);
      const columns = REQUIRED_COLUMNS[sheetName].filter((column) => !sheet?.columns.includes(column));
      return { sheet: sheetName, columns };
    })
    .filter((item) => item.columns.length > 0);
  const columnOrderWarnings = requiredSheets
    .map((sheetName) => {
      const expectedOrder = REQUIRED_COLUMNS[sheetName];
      const sheet = sheets.find((item) => item.name === sheetName);
      const receivedOrder = expectedOrder.filter((column) => sheet?.columns.includes(column));
      const positions = receivedOrder.map((column) => sheet?.columns.indexOf(column) ?? -1);
      const isOrdered = positions.every((position, index) => index === 0 || position > positions[index - 1]);
      return {
        sheet: sheetName,
        expectedOrder,
        receivedOrder,
        isOrdered,
      };
    })
    .filter((item) => item.receivedOrder.length === item.expectedOrder.length && !item.isOrdered)
    .map(({ sheet, expectedOrder, receivedOrder }) => ({ sheet, expectedOrder, receivedOrder }));
  const requiredColumnCount = Object.values(REQUIRED_COLUMNS).reduce((sum, columns) => sum + columns.length, 0);
  const missingColumnCount = missingColumns.reduce((sum, item) => sum + item.columns.length, 0);
  const issues: string[] = [];
  const templateReasons: string[] = [];

  if (missingSheets.length > 0) {
    const message = `缺少必需工作表：${missingSheets.join("、")}`;
    issues.push(message);
    templateReasons.push(message);
  }
  if (missingColumns.length > 0) {
    const message = `缺少模板关键列：${missingColumns.map((item) => `${item.sheet}.${item.columns.join("/")}`).join("、")}`;
    issues.push(message);
    templateReasons.push(message);
  }
  if (columnOrderWarnings.length > 0) {
    templateReasons.push(`关键列顺序发生偏移：${columnOrderWarnings.map((item) => item.sheet).join("、")}`);
  }
  if (context.rawLogsCount === 0) issues.push("运行日志为空，无法追溯保护/中断类事件。");
  if (context.maxTemperature <= 0) issues.push("最高温度全为 0 或缺失，热风险覆盖不足。");
  if (context.targetCycles > 0 && context.cycleCount < context.targetCycles) {
    issues.push(`循环覆盖不足：已解析 ${context.cycleCount}/${context.targetCycles}。`);
  }

  const cycleCoverageRatio = context.targetCycles > 0 ? Math.min(context.cycleCount / context.targetCycles, 1) : 1;
  const score = Math.max(
    0,
    Math.round(
      100 -
        missingSheets.length * 25 -
        missingColumnCount * 8 -
        (context.rawLogsCount === 0 ? 8 : 0) -
        (context.maxTemperature <= 0 ? 6 : 0) -
        Math.max(0, 1 - cycleCoverageRatio) * 20,
    ),
  );
  const grade: "A" | "B" | "C" | "D" = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
  const compatibility: "模板匹配" | "模板偏移" | "模板不兼容" =
    missingSheets.length > 0 || missingColumns.length > 0
      ? "模板不兼容"
      : columnOrderWarnings.length > 0
        ? "模板偏移"
        : "模板匹配";

  return {
    requiredSheets,
    missingSheets,
    missingColumns,
    templateFingerprint: {
      version: TEMPLATE_VERSION,
      compatibility,
      expectedSheets: requiredSheets,
      receivedSheets: sheets.map((sheet) => sheet.name),
      requiredColumnCount,
      matchedRequiredColumnCount: requiredColumnCount - missingColumnCount,
      columnOrderWarnings,
      reasons: templateReasons.length ? templateReasons : ["上传文件符合当前 EL2600 循环测试模板契约。"],
    },
    quality: {
      score,
      grade,
      issues: issues.length ? issues : ["模板结构完整，关键数据通道可追溯。"],
    },
  };
}

function buildEventTypes(rawLogs: Array<Record<string, unknown>>) {
  const counts = new Map<string, number>();
  rawLogs.forEach((row) => {
    const label = readText(row, "事件类型", "未知事件");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function buildFlowSteps(rawFlow: Array<Record<string, unknown>>): FlowStepSummary[] {
  return rawFlow.map((row) => ({
    step: readText(row, "工步类型", "-"),
    currentOrPower: readNullableNumber(row, "恒流(A)/恒功率(W)"),
    constantVoltage: readNullableNumber(row, "恒压(V)"),
    voltageLimit: readNullableNumber(row, "电压限制(V)"),
    currentLimit: readNullableNumber(row, "电流限制(A)"),
    capacityLimit: readNullableNumber(row, "容量限制(Ah)"),
    timeLimit: readNullableText(row, "时间限制(hh:mm:ss)"),
    jumpCount: readNullableNumber(row, "跳转次数"),
  }));
}

export function parseBatteryDatasetFromArrayBuffer(
  buffer: ArrayBuffer,
  sourceFile = BATTERY_SOURCE_FILE,
): BatteryDataset {
  const workbook = read(buffer, { type: "array" });
  const rawTs = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["测试数据"] ?? {});
  const rawCs = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["循环统计"] ?? {});
  const rawLogs = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["运行日志"] ?? {});
  const rawFlow = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["流程信息"] ?? {});

  if (rawTs.length === 0 || rawCs.length === 0) {
    throw new Error("电池充放电数据缺少测试数据或循环统计 sheet");
  }

  const cycleStart = new Map<number, number>();
  for (const row of rawTs) {
    const cycle = readNumber(row, "循环次数", 1);
    const epoch = parseTimestamp(row["真实时间"]);
    if (!cycleStart.has(cycle) || epoch < (cycleStart.get(cycle) as number)) {
      cycleStart.set(cycle, epoch);
    }
  }

  const timeSeries: TimeSeriesPoint[] = rawTs.map((row) => {
    const cycle = readNumber(row, "循环次数", 1);
    const epoch = parseTimestamp(row["真实时间"]);
    const start = cycleStart.get(cycle) ?? epoch;
    return {
      sec: Math.max(0, Math.round((epoch - start) / 1000)),
      v: round(readNumber(row, "采样电压(V)"), 3),
      i: round(readNumber(row, "采样电流(A)"), 3),
      step: readText(row, "工步类型"),
      cycle,
    };
  });

  const initialCap = readNumber(rawCs[0], "总放电容量(Ah)");
  const cycleStats: CycleStat[] = rawCs.map((row) => {
    const dischargeCap = round(readNumber(row, "总放电容量(Ah)"), 4);
    return {
      cycle: readNumber(row, "循环号"),
      chargeCap: round(readNumber(row, "总充电容量(Ah)"), 4),
      dischargeCap,
      efficiency: round(readNumber(row, "充放电效率(%)"), 2),
      avgV: round(readNumber(row, "放电均压(V)"), 3),
      medianV: round(readNumber(row, "中值电压(V)"), 3),
      ir: round(readNumber(row, "直流内阻(mΩ)"), 2),
      retention: round((dischargeCap / initialCap) * 100, 1),
    };
  });

  const completeCycles = cycleStats.filter((c) => c.dischargeCap >= initialCap * 0.5);
  const lastComplete = completeCycles[completeCycles.length - 1] ?? cycleStats[cycleStats.length - 1];
  const targetCycles =
    Math.max(
      50,
      ...rawFlow
        .map((row) => readNumber(row, "跳转次数", 0))
        .filter((value) => value > 0)
        .map((value) => value + 1),
    ) || 50;
  const timeValues = rawTs.map((row) => parseTimestamp(row["真实时间"])).filter((value) => value > 0);
  const voltages = rawTs.map((row) => readNumber(row, "采样电压(V)"));
  const currents = rawTs.map((row) => readNumber(row, "采样电流(A)"));
  const capacities = rawTs.map((row) => readNumber(row, "容量(Ah)"));
  const energies = rawTs.map((row) => readNumber(row, "能量(Wh)"));
  const logTimes = rawLogs.map((row) => parseTimestamp(row["发生时间"])).filter((value) => value > 0);
  const flowSteps = buildFlowSteps(rawFlow);
  const sheetSummary = buildSheetSummary(workbook);
  const maxTemperature = round(maxOf(rawCs.map((row) => readNumber(row, "最高温度(℃)"))), 2);
  const parseSummary: BatteryParseSummary = {
    sourceFile,
    sheets: sheetSummary,
    validation: buildValidation(sheetSummary, {
      rawLogsCount: rawLogs.length,
      maxTemperature,
      cycleCount: rawCs.length,
      targetCycles,
    }),
    testData: {
      startTime: timeValues.length ? new Date(minOf(timeValues)).toLocaleString("zh-CN") : "-",
      endTime: timeValues.length ? new Date(maxOf(timeValues)).toLocaleString("zh-CN") : "-",
      sampleCount: rawTs.length,
      cycleCount: new Set(rawTs.map((row) => readNumber(row, "循环次数", 0))).size,
      stepTypes: Array.from(new Set(rawTs.map((row) => readText(row, "工步类型")).filter(Boolean))),
      voltageMin: round(minOf(voltages), 3),
      voltageMax: round(maxOf(voltages), 3),
      currentMin: round(minOf(currents), 3),
      currentMax: round(maxOf(currents), 3),
      capacityMax: round(maxOf(capacities), 4),
      energyMax: round(maxOf(energies), 4),
    },
    cycleStats: {
      rowCount: rawCs.length,
      firstCycle: cycleStats[0]?.cycle ?? 0,
      lastCycle: cycleStats[cycleStats.length - 1]?.cycle ?? 0,
      avgEfficiency: round(averageOf(cycleStats.map((row) => row.efficiency)), 2),
      maxTemperature,
      maxIr: round(Math.max(...cycleStats.map((c) => c.ir)), 2),
      finalRetention: lastComplete.retention,
    },
    logs: {
      rowCount: rawLogs.length,
      firstEventTime: logTimes.length ? new Date(minOf(logTimes)).toLocaleString("zh-CN") : "-",
      lastEventTime: logTimes.length ? new Date(maxOf(logTimes)).toLocaleString("zh-CN") : "-",
      eventTypes: buildEventTypes(rawLogs),
    },
    flow: {
      rowCount: rawFlow.length,
      targetCycles,
      steps: flowSteps,
    },
  };

  return {
    timeSeries,
    cycleStats,
    parseSummary,
    meta: {
      deviceLabel: "EL2600 电池循环 1#",
      cycleCount: cycleStats.length,
      targetCycles,
      initialCap: round(initialCap, 3),
      retention: lastComplete.retention,
      maxIr: round(Math.max(...cycleStats.map((c) => c.ir)), 2),
      sampleCount: timeSeries.length,
    },
  };
}

export async function loadBatteryDataset(): Promise<BatteryDataset> {
  const response = await fetch(BATTERY_DATASET_URL);
  if (!response.ok) {
    throw new Error("电池充放电数据文件读取失败");
  }

  return parseBatteryDatasetFromArrayBuffer(await response.arrayBuffer(), BATTERY_SOURCE_FILE);
}
