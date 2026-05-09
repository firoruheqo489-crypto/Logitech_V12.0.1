import { describe, expect, it } from "vitest";

import { FISHBONE_TEMPLATES } from "./fishboneDiagramData";
import {
  FISHBONE_CAUSE_WRAP,
  FISHBONE_CATEGORY_WRAP,
  FISHBONE_IMPACT_WRAP,
  FISHBONE_PROBLEM_WRAP,
  measureFishboneTextUnits,
  tokenizeFishboneText,
  wrapFishboneText,
} from "./fishboneTextLayout";

function expectLinesToFit(lines: string[], maxUnitsPerLine: number) {
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    expect(line.trim().length).toBeGreaterThan(0);
    expect(measureFishboneTextUnits(line)).toBeLessThanOrEqual(maxUnitsPerLine + 0.001);
  }
}

describe("fishboneTextLayout", () => {
  it("keeps every default cause label within the configured line budget", () => {
    for (const template of FISHBONE_TEMPLATES) {
      for (const category of template.categories) {
        const titleLines = wrapFishboneText(category.title, FISHBONE_CATEGORY_WRAP);
        expect(titleLines.length).toBeLessThanOrEqual(FISHBONE_CATEGORY_WRAP.maxLines);
        expectLinesToFit(titleLines, FISHBONE_CATEGORY_WRAP.maxUnitsPerLine);

        for (const cause of category.causes) {
          const causeLines = wrapFishboneText(cause, FISHBONE_CAUSE_WRAP);
          expect(causeLines.length).toBeLessThanOrEqual(FISHBONE_CAUSE_WRAP.maxLines);
          expectLinesToFit(causeLines, FISHBONE_CAUSE_WRAP.maxUnitsPerLine);
        }
      }
    }
  });

  it("keeps every default problem and impact line readable inside the problem card", () => {
    for (const template of FISHBONE_TEMPLATES) {
      const problemLines = wrapFishboneText(template.problem, FISHBONE_PROBLEM_WRAP);
      const impactLines = wrapFishboneText(template.impact, FISHBONE_IMPACT_WRAP);

      expect(problemLines.length).toBeLessThanOrEqual(FISHBONE_PROBLEM_WRAP.maxLines);
      expect(impactLines.length).toBeLessThanOrEqual(FISHBONE_IMPACT_WRAP.maxLines);
      expectLinesToFit(problemLines, FISHBONE_PROBLEM_WRAP.maxUnitsPerLine);
      expectLinesToFit(impactLines, FISHBONE_IMPACT_WRAP.maxUnitsPerLine);
    }
  });

  it("preserves Latin words as tokens when wrapping mixed text", () => {
    expect(tokenizeFishboneText("SPC monitor 阈值 漂移")).toEqual([
      "SPC",
      " ",
      "monitor",
      " ",
      "阈",
      "值",
      " ",
      "漂",
      "移",
    ]);
  });

  it("adds an ellipsis when the content exceeds the allowed line count", () => {
    const lines = wrapFishboneText(
      "这是一个非常长的鱼骨图原因描述，用来验证超出最大行数以后会被安全截断并追加省略号。",
      {
        maxUnitsPerLine: 8,
        maxLines: 2,
      }
    );

    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith("…")).toBe(true);
    expectLinesToFit(lines, 8);
  });
});
