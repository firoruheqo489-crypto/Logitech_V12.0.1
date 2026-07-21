import { describe, expect, it } from "vitest"

import {
  sortLaboratoryArchivesBySpecSequenceDescending,
  type LaboratoryArchiveRecord,
} from "./laboratory-archive-api"

function createRecord(specSequence: number | undefined, createdAt: string): LaboratoryArchiveRecord {
  return {
    id: `${specSequence ?? "none"}-${createdAt}`,
    projectId: "1",
    sequence: 1,
    reportNo: "LAB-001",
    projectName: "LG273",
    sampleName: "Sample",
    sampleNo: "SKU",
    specSequence,
    testDate: "2026-07-10",
    verdict: "PASS",
    moduleCount: 1,
    printableModuleCount: 1,
    createdAt,
    ossUrl: "/archive.json",
  }
}

describe("laboratory archive ordering", () => {
  it("sorts by specification ledger sequence descending instead of creation order", () => {
    const result = sortLaboratoryArchivesBySpecSequenceDescending([
      createRecord(43, "2026-07-21T06:19:06.683Z"),
      createRecord(45, "2026-07-21T03:45:30.112Z"),
      createRecord(41, "2026-07-21T07:00:00.000Z"),
      createRecord(44, "2026-07-21T02:00:00.000Z"),
    ])

    expect(result.map((record) => record.specSequence)).toEqual([45, 44, 43, 41])
  })
})
