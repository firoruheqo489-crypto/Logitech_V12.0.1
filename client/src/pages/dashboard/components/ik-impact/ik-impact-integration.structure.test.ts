import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const laboratorySource = readFileSync(
  "client/src/pages/dashboard/components/LaboratoryPdfParserDashboard.tsx",
  "utf8",
);

describe("IK impact laboratory workspace structure", () => {
  it("mounts the IK workspace from the laboratory module dispatcher", () => {
    expect(laboratorySource).toContain('import { IkImpactWorkspace } from "./ik-impact/IkImpactWorkspace"');
    expect(laboratorySource).toContain('case "IK_IMPACT"');
    expect(laboratorySource).toContain("<IkImpactWorkspace");
    expect(laboratorySource).toContain("onSummaryChange={onSummaryChange}");
  });

  it("uses the dashboard IK parsing endpoint", () => {
    const uploadSource = readFileSync(
      "client/src/pages/dashboard/components/ik-impact/PdfUploadPanel.tsx",
      "utf8",
    );
    expect(uploadSource).toContain('fetch("/api/dashboard/ik-pdf/parse-upload"');
  });
});
