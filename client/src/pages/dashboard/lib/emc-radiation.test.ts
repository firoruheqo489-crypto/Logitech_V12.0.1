import { describe, expect, it } from "vitest";

import { parseEmcBinaryFile } from "./emc-radiation";

function createConductedEmcBuffer(pointCount = 240): ArrayBuffer {
  const valuesPerPoint = 4;
  const buffer = new ArrayBuffer(pointCount * valuesPerPoint * Float32Array.BYTES_PER_ELEMENT);
  const view = new DataView(buffer);

  for (let index = 0; index < pointCount; index += 1) {
    view.setFloat32(index * 4, 0.009 + index * 0.0002, true);
    view.setFloat32((pointCount + index) * 4, 30 + (index % 5), true);
    view.setFloat32((pointCount * 2 + index) * 4, 0, true);
    view.setFloat32((pointCount * 3 + index) * 4, 20 + (index % 3), true);
  }

  return buffer;
}

describe("parseEmcBinaryFile channel detection", () => {
  it.each([
    ["LG172L-100W2 L.emc", "L"],
    ["LG172L-100W2 N.emc", "N"],
    ["LG172L-100W2 F.emc", "F"],
  ] as const)("uses the explicit trailing channel in %s", (fileName, expectedChannel) => {
    const parsed = parseEmcBinaryFile(fileName, createConductedEmcBuffer());

    expect(parsed.channel).toBe(expectedChannel);
    expect(parsed.points).toHaveLength(240);
  });
});
