import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("FAI dimension direct state persistence", () => {
  it("saves parsed workbook payloads through the dimension state API instead of OSS uploads", async () => {
    const dashboardSource = await loadSource("./components/fai/fai-dashboard.tsx");
    const apiSource = await loadSource("./lib/fai-dimension-state-api.ts");

    expect(apiSource).toContain("payload?: unknown;");
    expect(dashboardSource).toContain("payload,");
    expect(dashboardSource).toContain("persistedState?.payload");
    expect(dashboardSource).not.toContain("uploadAssetViaServer");
    expect(dashboardSource).not.toContain("new File([payloadBlob]");
  });
});
