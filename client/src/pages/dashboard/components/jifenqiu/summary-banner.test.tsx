import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SummaryBanner } from "./summary-banner";

describe("SummaryBanner", () => {
  it("shows report metadata without exposing the generated judgment", () => {
    const html = renderToStaticMarkup(
      <SummaryBanner
        reportMeta={{
          fileName: "sample-report.pdf",
          productModel: "MR16",
          testDate: "2026-07-28",
          equipmentId: "HAAS-1200",
          operator: "Lab",
          judgment: "FAIL",
        }}
      />
    );

    expect(html).toContain("sample-report.pdf");
    expect(html).toContain("MR16");
    expect(html).not.toContain("综合判定");
    expect(html).not.toContain("FAIL");
  });
});
