import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8");
}

describe("tooling FAI storage version", () => {
  it("uses the v2 namespace so stale server/browser cache is ignored", async () => {
    const source = await loadSource("./pages/dashboard/components/tooling-fai-parser.tsx");

    expect(source).toContain("dashboard_tooling_fai_parser_state_v2");
  });
});
