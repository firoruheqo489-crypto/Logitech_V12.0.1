import { useEffect, useState } from "react";

import type { LaboratoryModuleSummary } from "../laboratory/laboratory-contract";
import { IkDashboard } from "./IkDashboard";
import { PdfUploadPanel } from "./PdfUploadPanel";
import { buildIkImpactModuleSummary } from "./ik-summary";
import { ikTestData, ikTestDataSchema, type IKTestData } from "./ik-test-data";

export function IkImpactWorkspace({
  nodeId,
  onSummaryChange,
  initialSummary,
}: {
  nodeId: number;
  onSummaryChange: (summary: LaboratoryModuleSummary | null) => void;
  initialSummary?: LaboratoryModuleSummary;
}) {
  const restoredData = ikTestDataSchema.safeParse(initialSummary?.moduleData);
  const [data, setData] = useState<IKTestData>(() =>
    restoredData.success ? restoredData.data : ikTestData,
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState(() => initialSummary?.sourceFiles[0] ?? "示例记录");

  useEffect(() => {
    onSummaryChange(buildIkImpactModuleSummary(nodeId, data, sourceName));
  }, [data, nodeId, onSummaryChange, sourceName]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  function handleParsed(nextData: IKTestData, file: File) {
    setPdfUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return URL.createObjectURL(file);
    });
    setData(nextData);
    setSourceName(file.name);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
        <PdfUploadPanel onParsed={handleParsed} />
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>当前数据来源：{sourceName}</span>
          <span>数据仅保留在当前页面，不会保存上传文件</span>
        </div>
      </div>
      <IkDashboard data={data} pdfUrl={pdfUrl} />
    </main>
  );
}
