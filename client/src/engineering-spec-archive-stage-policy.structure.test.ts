import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function loadSource(relativePath: string): Promise<string> {
  return readFile(path.resolve(__dirname, relativePath), "utf8")
}

describe("engineering specification sample and final-sample archive policy", () => {
  it("allows duplicate uploads and defers the duplicate gate to archive time", async () => {
    const source = await loadSource("./pages/dashboard/components/ProductSpecExcelParserDashboard.tsx")

    expect(source).not.toContain("已阻止重复导入")
    expect(source).not.toContain("禁止重复上传")
    expect(source).toContain("const duplicateStageRecord = sanitizedLedgerRecords.find(")
    expect(source).toContain("同一测试类别已存在归档")
    expect(source).toContain("归档前必须选择“送样测试”或“终样测试”")
  })

  it("enforces SKU plus test type as the authoritative server-side key", async () => {
    const source = await loadSource("../../server/routes/dashboard-engineering-spec-archive.ts")

    expect(source).toContain("function hasDuplicateSkuTestType(")
    expect(source).toContain("normalizeTestType(document.sampleType) === testType")
    expect(source).toContain("hasDuplicateSkuTestType(hydratedDocuments, sku, testType)")
    expect(source).toContain("hasDuplicateSkuTestType(hydratedDocuments, updatedSku, updatedTestType, documentId)")
    expect(source).not.toContain("hasDuplicateFileFingerprint(")
  })

  it("keeps the archive scope independent from the main dashboard project name", async () => {
    const source = await loadSource("./pages/dashboard/components/ProductSpecExcelParserDashboard.tsx")

    expect(source).toContain("const ENGINEERING_SPEC_ARCHIVE_PROJECT_ID = '1';")
    expect(source).toContain("const projectId = ENGINEERING_SPEC_ARCHIVE_PROJECT_ID;")
    expect(source).not.toContain("const projectId = projectName.trim() || 'default-engineering-spec-workspace';")
  })
})
