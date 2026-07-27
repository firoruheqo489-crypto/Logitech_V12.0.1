import { describe, expect, it } from "vitest";

import { ikTestData } from "../../client/src/pages/dashboard/components/ik-impact/ik-test-data";
import { parseAndValidateIkOutput, validateIkUpload } from "./dashboard-ik-pdf";

function uploadFile(overrides: Partial<Express.MulterFile> = {}): Express.MulterFile {
  return {
    fieldname: "file",
    originalname: "ik-report.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    size: 4,
    destination: "",
    filename: "",
    path: "",
    buffer: Buffer.from("%PDF"),
    ...overrides,
  };
}

describe("dashboard IK PDF route", () => {
  it("rejects missing, invalid, empty, and oversized uploads", () => {
    expect(validateIkUpload(undefined)).toMatchObject({
      ok: false,
      status: 400,
      code: "IK_PDF_FILE_REQUIRED",
      error: "请选择要解析的 PDF 文件",
    });
    expect(validateIkUpload(uploadFile({ originalname: "data.txt", mimetype: "text/plain" }))).toMatchObject({
      ok: false,
      status: 400,
      code: "IK_PDF_INVALID_FILE_TYPE",
      error: "仅支持 PDF 文件",
    });
    expect(validateIkUpload(uploadFile({ size: 0, buffer: Buffer.alloc(0) }))).toMatchObject({
      ok: false,
      status: 400,
      code: "IK_PDF_EMPTY_FILE",
      error: "PDF 文件为空",
    });
    expect(validateIkUpload(uploadFile({ size: 15 * 1024 * 1024 + 1 }))).toMatchObject({
      ok: false,
      status: 400,
      code: "IK_PDF_FILE_TOO_LARGE",
      error: "PDF 文件不能超过 15 MB",
    });
  });

  it("accepts a valid PDF and applies the original schema and energy validation", () => {
    expect(validateIkUpload(uploadFile())).toMatchObject({ ok: true });
    expect(parseAndValidateIkOutput(ikTestData)).toEqual(ikTestData);
    expect(() =>
      parseAndValidateIkOutput({
        ...ikTestData,
        energy: { ...ikTestData.energy, impactEnergyJ: 10 },
      }),
    ).toThrow("IK08 应对应 5.0 J");
  });
});
