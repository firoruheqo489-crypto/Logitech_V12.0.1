import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { read, utils } from "xlsx"
import { getOverallStats, parseFinalSampleReportMatrix } from "./report-data"

function loadWorkbookRows() {
  const workbookPath = path.resolve(process.cwd(), "client/public/final-sample-report/A1-c1dc8d.xlsx")
  const buffer = fs.readFileSync(workbookPath)
  const workbook = read(buffer, { type: "buffer", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    dateNF: "yyyy-mm-dd",
  })
}

describe("parseFinalSampleReportMatrix", () => {
  it("maps the real final sample workbook into dashboard meta and module stats", () => {
    const rows = loadWorkbookRows()
    const parsed = parseFinalSampleReportMatrix(rows)
    const overall = getOverallStats(parsed.modules)

    expect(parsed.meta.oaNumber).toBe("CPCESRZ-202606263269")
    expect(parsed.meta.productModel).toContain("TL3006-GLR-16W")
    expect(parsed.meta.environment.temp).toBe("25℃")
    expect(parsed.meta.environment.humidity).toBe("55%RH")

    expect(parsed.modules.map((module) => module.items.length)).toEqual([22, 5, 9, 17])
    expect(parsed.modules.map((module) => module.summaryStatus)).toEqual(["F", "P", "F", "F"])

    expect(overall.total).toBe(53)
    expect(overall.executed).toBe(1)
    expect(overall.fail).toBe(1)
    expect(overall.riskCount).toBe(12)
  })

  it("extracts appendix tables from the real workbook", () => {
    const rows = loadWorkbookRows()
    const parsed = parseFinalSampleReportMatrix(rows)

    expect(parsed.appendixTemperature.rows[0]).toEqual(["Q1", "69.28", "82.83", "74.07"])
    expect(parsed.appendixPhotometric.rows[1]).toEqual(["TL3006-GLR-12W", "40", "12.4", "998.53", "92.1", "2746"])
    expect(parsed.appendixDimension.rows[2]).toEqual(["TL3006-GLR-16W", "210", "327.48 × 25.46 × 27.33"])
  })
})
