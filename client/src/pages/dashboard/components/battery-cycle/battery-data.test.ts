import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";

import { parseBatteryDatasetFromArrayBuffer } from "./battery-data";

function makeWorkbookBuffer({ omitMedianVoltage = false, shiftCycleColumnOrder = false } = {}) {
  const workbook = utils.book_new();

  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet([
      ["真实时间", "采样电压(V)", "采样电流(A)", "工步类型", "循环次数", "容量(Ah)", "能量(Wh)"],
      ["2026-01-01 00:00:00", 6.8, 2.5, "充电", 1, 0.1, 0.7],
      ["2026-01-01 00:01:00", 7.2, -5, "放电", 1, 0.8, 5.6],
      ["2026-01-01 00:02:00", 6.9, -5, "放电", 2, 0.7, 4.8],
    ]),
    "测试数据",
  );

  const cycleHeader = shiftCycleColumnOrder
    ? ["循环号", "总充电容量(Ah)", "中值电压(V)", "总放电容量(Ah)", "充放电效率(%)", "放电均压(V)", "直流内阻(mΩ)", "最高温度(℃)"]
    : [
        "循环号",
        "总充电容量(Ah)",
        "总放电容量(Ah)",
        "充放电效率(%)",
        "放电均压(V)",
        ...(omitMedianVoltage ? [] : ["中值电压(V)"]),
        "直流内阻(mΩ)",
        "最高温度(℃)",
      ];
  const cycleRows = shiftCycleColumnOrder
    ? [
        [1, 2.0, 6.72, 1.5, 96, 6.7, 7.1, 26],
        [2, 1.9, 6.65, 1.35, 95, 6.6, 7.2, 27],
      ]
    : omitMedianVoltage
      ? [
          [1, 2.0, 1.5, 96, 6.7, 7.1, 26],
          [2, 1.9, 1.35, 95, 6.6, 7.2, 27],
        ]
      : [
          [1, 2.0, 1.5, 96, 6.7, 6.72, 7.1, 26],
          [2, 1.9, 1.35, 95, 6.6, 6.65, 7.2, 27],
        ];
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([cycleHeader, ...cycleRows]), "循环统计");

  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet([
      ["发生时间", "事件类型"],
      ["2026-01-01 00:00:01", "达到电压限制条件进行工步跳转"],
    ]),
    "运行日志",
  );

  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet([
      ["工步类型", "恒流(A)/恒功率(W)", "恒压(V)", "电压限制(V)", "电流限制(A)", "容量限制(Ah)", "时间限制(hh:mm:ss)", "跳转次数"],
      ["充电", 2.5, 8.4, 8.4, 0.25, null, null, null],
      ["放电", 5.0, null, 5.5, null, null, null, null],
      ["静置", null, null, null, null, null, "00:06:00", 1],
    ]),
    "流程信息",
  );

  return write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

describe("battery xlsx parser", () => {
  it("uses first-cycle discharge capacity as initial capacity", () => {
    const dataset = parseBatteryDatasetFromArrayBuffer(makeWorkbookBuffer(), "unit.xlsx");

    expect(dataset.meta.initialCap).toBe(1.5);
    expect(dataset.cycleStats[0]).toMatchObject({
      dischargeCap: 1.5,
      medianV: 6.72,
      retention: 100,
    });
    expect(dataset.meta.retention).toBe(90);
    expect(dataset.parseSummary.validation.templateFingerprint).toMatchObject({
      version: "EL2600-cycle-template-v1",
      compatibility: "模板匹配",
      requiredColumnCount: 11,
      matchedRequiredColumnCount: 11,
    });
    expect(dataset.parseSummary.validation.quality.grade).toBe("B");
  });

  it("reports missing required columns without hiding the parsed dataset", () => {
    const dataset = parseBatteryDatasetFromArrayBuffer(makeWorkbookBuffer({ omitMedianVoltage: true }), "missing.xlsx");

    expect(dataset.parseSummary.validation.missingColumns).toEqual(
      expect.arrayContaining([
        {
          sheet: "循环统计",
          columns: ["中值电压(V)"],
        },
      ]),
    );
    expect(dataset.cycleStats).toHaveLength(2);
    expect(dataset.parseSummary.validation.templateFingerprint.compatibility).toBe("模板不兼容");
    expect(dataset.parseSummary.validation.quality.score).toBeLessThan(90);
  });

  it("marks reordered template columns as a template drift", () => {
    const dataset = parseBatteryDatasetFromArrayBuffer(makeWorkbookBuffer({ shiftCycleColumnOrder: true }), "shifted.xlsx");

    expect(dataset.parseSummary.validation.missingColumns).toEqual([]);
    expect(dataset.parseSummary.validation.templateFingerprint.compatibility).toBe("模板偏移");
    expect(dataset.parseSummary.validation.templateFingerprint.columnOrderWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheet: "循环统计",
        }),
      ]),
    );
  });
});
