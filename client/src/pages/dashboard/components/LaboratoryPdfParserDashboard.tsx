import { useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { DarkroomTelemetryWorkspace } from "./DarkroomTelemetryWorkspace";
import EmcRadiationWorkspace from "./EmcRadiationWorkspace";
import { FlickerTelemetryWorkspace } from "./FlickerTelemetryWorkspace";
import { CieDiagram } from "./jifenqiu/cie-diagram";
import { buildReportViewModel, type IntegratingSphereParseResult } from "./jifenqiu/report-data";
import { SpectrumChart } from "./jifenqiu/spectrum-chart";
import { SummaryBanner } from "./jifenqiu/summary-banner";
import { TelemetryVector } from "./jifenqiu/telemetry-vector";
import { glassPanel } from "./jifenqiu/ui";

type ParseResponse = {
  ok: boolean;
  sourceType: "upload";
  fileName?: string;
  result: IntegratingSphereParseResult;
};

async function parseByUpload(file: File): Promise<ParseResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch("/api/dashboard/laboratory-pdf/parse-upload", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.details || payload?.error || "PDF 解析失败");
  }

  return payload as ParseResponse;
}

function ModuleSection({
  index,
  title,
  children,
}: {
  index: "一" | "二" | "三" | "四";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-[28px] border border-white/[0.06] bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] md:p-6">
      {children}
    </section>
  );
}

export default function LaboratoryPdfParserDashboard() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);

  const viewModel = useMemo(
    () => buildReportViewModel(result?.fileName || selectedFile?.name || "--", result?.result || null),
    [result, selectedFile],
  );

  const handleUploadParse = async () => {
    if (!selectedFile) {
      toast.error("请先选择 PDF 文件");
      return;
    }

    setIsParsing(true);
    try {
      const payload = await parseByUpload(selectedFile);
      setResult(payload);
      toast.success("PDF 解析完成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF 解析失败");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020406] bg-[radial-gradient(circle_at_50%_20%,_rgba(0,243,255,0.06),_transparent_50%)] px-6 py-8 text-zinc-50 md:px-10 lg:px-14">
      <div className="mx-auto w-full max-w-7xl">
        <ModuleSection
          index="一"
          title="积分球报告解析"
        >
          <section className={`${glassPanel} mb-6 p-5`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <Input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="border-white/[0.06] bg-black/40 text-white file:text-white"
              />
              <Button
                onClick={handleUploadParse}
                disabled={isParsing}
                className="min-w-[200px] bg-white text-black hover:bg-white/90"
              >
                {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isParsing ? "PARSING..." : "UPLOAD PDF / PARSE"}
              </Button>
            </div>
          </section>

          <SummaryBanner reportMeta={viewModel.reportMeta} />

          <div className="mb-6 grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
            <SpectrumChart spectrumStats={viewModel.spectrumStats} />
            <CieDiagram chromaticity={viewModel.chromaticity} />
          </div>

          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
            <TelemetryVector title="// ELECTRICAL INPUT TELEMETRY" fields={viewModel.electricalInput} />
            <TelemetryVector title="// LUMINOUS OUTPUT TELEMETRY" fields={viewModel.luminousOutput} />
            <TelemetryVector title="// COLOR QUALITY TELEMETRY" fields={viewModel.colorQuality} />
          </div>

          <footer className="mt-8 flex items-center justify-between border-t border-white/[0.04] pt-4">
            <span className="font-mono text-[10px] tracking-widest text-slate-600">
              INTEGRATING SPHERE DIAGNOSTIC WORKSPACE v1
            </span>
            <span className="font-mono text-[10px] tracking-widest text-slate-600">
              CIE 1931 / IES TM-30 / CIE 13.3 Ra
            </span>
          </footer>
        </ModuleSection>

        <ModuleSection
          index="二"
          title="暗房配光报告解析"
        >
          <DarkroomTelemetryWorkspace />
        </ModuleSection>

        <ModuleSection
          index="三"
          title="频闪报告解析"
        >
          <FlickerTelemetryWorkspace />
        </ModuleSection>

        <ModuleSection
          index="四"
          title="EMC 传导辐射解析"
        >
          <EmcRadiationWorkspace />
        </ModuleSection>
      </div>
    </main>
  );
}
