"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SIPHeader } from "./sip/SIPHeader";
import { InspectionTable } from "./sip/InspectionTable";
import {
  SIPIllustrationWorkspace,
  type SIPIllustrationWorkspaceHandle,
} from "./sip/SIPIllustrationWorkspace";
import { SIPPrintView } from "./sip/SIPPrintView";
import {
  Save,
  Send,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer,
  Layers,
  ArrowLeft,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  initialInspectionItems,
  initialSipIllustration,
  initialSipManualPanels,
  initialSipMetaData,
  type InspectionItem,
  type SIPIllustration,
  type SIPManualPanelContent,
  type SIPManualPanels,
  type SIPIllustrationScene,
  type SIPMetaData,
  type SIPPrintTemplate,
} from "./sip/types";
import { toast } from "sonner";
import "./sip/sip-theme.css";

function formatVersionLabel(value: string) {
  const normalized = value.trim() || "1.0";
  return normalized.startsWith("V") ? normalized : `V${normalized}`;
}

function getPrintTemplateLabel(template: SIPPrintTemplate) {
  return template === "landscape" ? "横向 A4" : "竖向 A4";
}

function buildSipFileBaseName(metaData: SIPMetaData, template: SIPPrintTemplate) {
  const rawParts = ["SIP", metaData.productCode || "document", metaData.version || "V1.0", template];
  return rawParts
    .join("-")
    .replace(/[<>:"/\\|?*\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildPrintDocumentTitle(metaData: SIPMetaData, template: SIPPrintTemplate) {
  return `${metaData.productCode || "SIP"} ${formatVersionLabel(metaData.version)} ${getPrintTemplateLabel(template)}`;
}

function getPageMetrics(template: SIPPrintTemplate) {
  return template === "landscape"
    ? { width: 297, height: 210, orientation: "landscape" as const }
    : { width: 210, height: 297, orientation: "portrait" as const };
}

function getTemplateSummaryLabel(template: SIPPrintTemplate) {
  return template === "landscape" ? "横向图示编辑区" : "竖向图示编辑区";
}

function SubmitApprovalDialog({
  disabled,
  isSaving,
  onConfirm,
  triggerClassName,
}: {
  disabled: boolean;
  isSaving: boolean;
  onConfirm: () => void;
  triggerClassName: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={disabled} className={triggerClassName}>
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {"\u63d0\u4ea4\u5ba1\u6279"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {"\u786e\u8ba4\u63d0\u4ea4\u5ba1\u6279\uff1f"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {"\u63d0\u4ea4\u540e\uff0c\u68c0\u9a8c\u6307\u5bfc\u4e66\u5c06\u8fdb\u5165\u5ba1\u6279\u6d41\u7a0b\u3002\u5ba1\u6279\u901a\u8fc7\u540e\u81ea\u52a8\u751f\u6548\u3002"}
            <br />
            <span className="text-destructive">
              {"\u6ce8\u610f\uff1a\u751f\u6548\u540e\u5c06\u65e0\u6cd5\u518d\u7f16\u8f91\u5185\u5bb9\u3002"}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border">
            {"\u53d6\u6d88"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSaving}
            className="bg-primary text-primary-foreground"
          >
            {"\u786e\u8ba4\u63d0\u4ea4"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PrintTemplateSelector({
  value,
  onChange,
}: {
  value: SIPPrintTemplate;
  onChange: (value: SIPPrintTemplate) => void;
}) {
  const options: Array<{ value: SIPPrintTemplate; label: string }> = [
    { value: "portrait", label: "竖向 A4" },
    { value: "landscape", label: "横向 A4" },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/80 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 rounded-md px-2.5 text-[11px]",
              active
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function SidePanelEditor({
  template,
  value,
  onChange,
}: {
  template: SIPPrintTemplate;
  value: SIPManualPanelContent;
  onChange: (value: SIPManualPanelContent) => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-foreground">{"\u53f3\u4fa7\u8bf4\u660e\u533a"}</p>
          <p className="text-[10px] text-muted-foreground">
            {template === "landscape"
              ? "\u6253\u5370\u6a21\u677f\u53f3\u4fa7\u5185\u5bb9\u6539\u4e3a\u624b\u5de5\u7f16\u8f91"
              : "\u7ad6\u5411\u6a21\u677f\u53f3\u4fa7\u5185\u5bb9\u6539\u4e3a\u624b\u5de5\u7f16\u8f91"}
          </p>
        </div>
        <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground">
          {template === "landscape" ? "\u6a2a\u5411\u53f3\u4fa7\u533a" : "\u7ad6\u5411\u53f3\u4fa7\u533a"}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[10px] font-medium text-muted-foreground">{"\u6807\u9898\u680f"}</div>
          <Textarea
            value={value.title}
            onChange={(event) => onChange({ ...value, title: event.target.value })}
            className="min-h-[44px] resize-none bg-background/70 text-[12px]"
            placeholder={"\u8bf7\u8f93\u5165\u53f3\u4fa7\u6807\u9898"}
          />
        </div>

        <div>
          <div className="mb-1 text-[10px] font-medium text-muted-foreground">
            {"\u5185\u5bb9\u533a"}
          </div>
          <Textarea
            value={value.content}
            onChange={(event) => onChange({ ...value, content: event.target.value })}
            className="min-h-[180px] bg-background/70 font-mono text-[12px] leading-5"
            placeholder={"\u6bcf\u6bb5\u5185\u5bb9\u4e4b\u95f4\u7a7a\u4e00\u884c\uff0c\u6253\u5370\u65f6\u4f1a\u6309\u6bb5\u843d\u5206\u9694"}
          />
        </div>

        <div>
          <div className="mb-1 text-[10px] font-medium text-muted-foreground">{"\u5e95\u90e8\u5907\u6ce8"}</div>
          <Textarea
            value={value.footer}
            onChange={(event) => onChange({ ...value, footer: event.target.value })}
            className="min-h-[72px] bg-background/70 text-[12px]"
            placeholder={"\u8bf7\u8f93\u5165\u5e95\u90e8\u5907\u6ce8"}
          />
        </div>
      </div>
    </div>
  );
}

export default function SipWorkspace() {
  const [metaData, setMetaData] = useState<SIPMetaData>(initialSipMetaData);
  const [illustration, setIllustration] = useState<SIPIllustration>(initialSipIllustration);
  const [manualPanels, setManualPanels] = useState<SIPManualPanels>(initialSipManualPanels);
  const [items, setItems] = useState<InspectionItem[]>(initialInspectionItems);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const [isPrintingDocument, setIsPrintingDocument] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [printTemplate, setPrintTemplate] = useState<SIPPrintTemplate>("portrait");
  const [previewIllustration, setPreviewIllustration] = useState<SIPIllustration>(initialSipIllustration);
  const portraitIllustrationWorkspaceRef = useRef<SIPIllustrationWorkspaceHandle | null>(null);
  const landscapeIllustrationWorkspaceRef = useRef<SIPIllustrationWorkspaceHandle | null>(null);
  const printContentRef = useRef<HTMLDivElement | null>(null);

  const versionLabel = formatVersionLabel(metaData.version);
  const printTemplateLabel = getPrintTemplateLabel(printTemplate);
  const activeIllustration = isPrintPreview ? previewIllustration : illustration;
  const currentIllustrationImageUrl = activeIllustration.scenes[printTemplate]?.previewImageUrl || "";

  const getIllustrationWorkspaceRef = (template: SIPPrintTemplate) =>
    template === "portrait"
      ? portraitIllustrationWorkspaceRef
      : landscapeIllustrationWorkspaceRef;

  const handleIllustrationSceneUpdate = (
    template: SIPPrintTemplate,
    nextScene: SIPIllustrationScene,
  ) => {
    setIllustration((current) => ({
      ...current,
      scenes: {
        ...current.scenes,
        [template]: nextScene,
      },
    }));
  };

  const handleManualPanelUpdate = (
    template: SIPPrintTemplate,
    nextPanel: SIPManualPanelContent,
  ) => {
    setManualPanels((current) => ({
      ...current,
      [template]: nextPanel,
    }));
  };

  const activateIllustrationTemplate = (template: SIPPrintTemplate) => {
    setPrintTemplate((current) => (current === template ? current : template));
  };

  const commitSceneSnapshot = (template: SIPPrintTemplate) => {
    const nextScene = getIllustrationWorkspaceRef(template).current?.flushSceneSnapshot();
    if (!nextScene) return illustration.scenes[template] ?? null;

    flushSync(() => {
      setIllustration((current) => ({
        ...current,
        scenes: {
          ...current.scenes,
          [template]: nextScene,
        },
      }));
    });

    return nextScene;
  };

  const commitAllSceneSnapshots = () => {
    commitSceneSnapshot("portrait");
    commitSceneSnapshot("landscape");
  };

  const collectAllSceneSnapshots = (): SIPIllustration => {
    const portraitScene =
      portraitIllustrationWorkspaceRef.current?.flushSceneSnapshot() ??
      illustration.scenes.portrait;
    const landscapeScene =
      landscapeIllustrationWorkspaceRef.current?.flushSceneSnapshot() ??
      illustration.scenes.landscape;

    const nextIllustration: SIPIllustration = {
      scenes: {
        portrait: portraitScene,
        landscape: landscapeScene,
      },
    };

    flushSync(() => {
      setIllustration(nextIllustration);
      setPreviewIllustration(nextIllustration);
    });

    return nextIllustration;
  };

  const handleSaveDraft = async () => {
    commitAllSceneSnapshots();
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setLastSaved(new Date());
      toast.success("\u8349\u7a3f\u5df2\u4fdd\u5b58");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    commitAllSceneSnapshots();
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setMetaData((current) => ({ ...current, status: "active" }));
      setLastSaved(new Date());
      toast.success("\u5df2\u63d0\u4ea4\u5ba1\u6279");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintDocument = async () => {
    const printNode = printContentRef.current;
    if (!printNode) {
      toast.error("\u6253\u5370\u6a21\u677f\u5c1a\u672a\u6e32\u67d3\u5b8c\u6210\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5");
      return;
    }

    const windowFeatures =
      printTemplate === "landscape" ? "width=1440,height=920" : "width=1100,height=900";
    const printWindow = window.open("", "_blank", windowFeatures);
    if (!printWindow) {
      toast.error("\u6d4f\u89c8\u5668\u62e6\u622a\u4e86\u6253\u5370\u7a97\u53e3\uff0c\u8bf7\u5141\u8bb8\u5f39\u7a97\u540e\u91cd\u8bd5");
      return;
    }

    setIsPrintingDocument(true);

    try {
      const title = buildPrintDocumentTitle(metaData, printTemplate);
      const markup = printNode.outerHTML;

      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }

      body {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }
    </style>
  </head>
  <body>
    ${markup}
    <script>
      (function () {
        const waitForImages = function () {
          const images = Array.from(document.images || []);
          if (!images.length) return Promise.resolve();

          return Promise.all(images.map(function (img) {
            if (img.complete) return Promise.resolve();
            return new Promise(function (resolve) {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            });
          }));
        };

        const triggerPrint = function () {
          waitForImages().then(function () {
            setTimeout(function () {
              window.focus();
              window.print();
            }, 150);
          });
        };

        window.addEventListener('load', triggerPrint, { once: true });
        window.addEventListener('afterprint', function () {
          setTimeout(function () { window.close(); }, 120);
        }, { once: true });
      })();
    </script>
  </body>
</html>`);
      printWindow.document.close();
      toast.success("\u6253\u5370\u6a21\u677f\u5df2\u6253\u5f00");
    } catch (error) {
      printWindow.close();
      toast.error(error instanceof Error ? error.message : "\u6253\u5370\u521d\u59cb\u5316\u5931\u8d25");
    } finally {
      setIsPrintingDocument(false);
    }
  };

  const handleExportPdf = async () => {
    const printNode = printContentRef.current;
    if (!printNode) {
      toast.error("PDF \u6a21\u677f\u5c1a\u672a\u6e32\u67d3\u5b8c\u6210\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5");
      return;
    }

    setIsExportingPdf(true);

    try {
      const [{ default: html2canvas }, jspdfModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
      const { width: pageWidth, height: pageHeight, orientation } = getPageMetrics(printTemplate);
      const targetDpi = 300;
      const a4WidthPx = Math.round((pageWidth / 25.4) * targetDpi);
      const renderScale = Math.max(2.5, Math.min(4, a4WidthPx / printNode.offsetWidth));

      const canvas = await html2canvas(printNode, {
        scale: renderScale,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: printNode.offsetWidth,
        height: printNode.offsetHeight,
        windowWidth: printNode.offsetWidth,
        windowHeight: printNode.offsetHeight,
        imageTimeout: 0,
        onclone: (clonedDocument) => {
          const clonedPrintNode = clonedDocument.querySelector(".sip-print-container") as HTMLElement | null;
          if (clonedPrintNode) {
            clonedPrintNode.style.margin = "0";
            clonedPrintNode.style.boxShadow = "none";
          }
        },
      });

      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: "a4",
        compress: false,
      });

      const widthLimitedHeight = (canvas.height * pageWidth) / canvas.width;
      const imageWidth =
        widthLimitedHeight <= pageHeight ? pageWidth : (canvas.width * pageHeight) / canvas.height;
      const imageHeight = widthLimitedHeight <= pageHeight ? widthLimitedHeight : pageHeight;
      const offsetX = (pageWidth - imageWidth) / 2;
      const offsetY = (pageHeight - imageHeight) / 2;
      const imageData = canvas.toDataURL("image/png", 1);

      pdf.addImage(imageData, "PNG", offsetX, offsetY, imageWidth, imageHeight, undefined, "FAST");

      while (pdf.getNumberOfPages() > 1) {
        pdf.deletePage(pdf.getNumberOfPages());
      }

      pdf.save(`${buildSipFileBaseName(metaData, printTemplate)}.pdf`);
      toast.success("PDF \u5df2\u5bfc\u51fa");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF \u5bfc\u51fa\u5931\u8d25");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const stats = {
    total: items.length,
    cr: items.filter((item) => item.defectLevel === "CR").length,
    ma: items.filter((item) => item.defectLevel === "MA").length,
    mi: items.filter((item) => item.defectLevel === "MI").length,
  };

  const openPrintPreview = () => {
    collectAllSceneSnapshots();
    setIsPrintPreview(true);
  };

  if (isPrintPreview) {
    return (
      <div className="sip-theme dark sip-fullbleed min-h-screen bg-muted/50 text-foreground">
        <div className="sticky top-0 z-50 bg-card border-b border-border print:hidden sip-topbar">
          <div className="sip-page-shell">
            <div className="flex items-center justify-between h-11">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setIsPrintPreview(false)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {"\u8fd4\u56de\u7f16\u8f91"}
                </Button>
                <span className="text-muted-foreground text-sm">|</span>
                <h1 className="text-[13px] font-semibold text-foreground">
                  {`${printTemplateLabel} 打印预览`}
                </h1>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {metaData.productCode} {versionLabel}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <PrintTemplateSelector value={printTemplate} onChange={setPrintTemplate} />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5"
                  disabled={isPrintingDocument || isExportingPdf}
                  onClick={handlePrintDocument}
                >
                  <Printer className="h-4 w-4" />
                  {"\u6253\u5370\u6587\u6863"}
                </Button>
                <Button
                  size="sm"
                  className="h-7 gap-1.5"
                  onClick={handleExportPdf}
                  disabled={isPrintingDocument || isExportingPdf}
                >
                  <Download className="h-4 w-4" />
                  {"\u5bfc\u51fa PDF"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto py-6 print:py-0">
          <SIPPrintView
            ref={printContentRef}
            metaData={metaData}
            items={items}
            illustrationImageUrl={currentIllustrationImageUrl}
            manualPanel={manualPanels[printTemplate]}
            template={printTemplate}
          />
        </div>

        <div className="text-center pb-6 print:hidden">
          <p className="text-[11px] text-muted-foreground">
            {"\u63d0\u793a\uff1a\u70b9\u51fb\u201c\u6253\u5370\u6587\u6863\u201d\u6309\u94ae\uff0c\u6216\u4f7f\u7528 Ctrl+P / Cmd+P \u8fdb\u884c\u6253\u5370"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sip-theme dark sip-fullbleed min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border sip-topbar">
        <div className="sip-page-shell">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-[13px] font-semibold text-foreground">
                    {"SIP \u7f16\u8f91\u63a7\u5236\u53f0"}
                  </h1>
                  <p className="text-[9px] text-muted-foreground">
                    Standard Inspection Procedure Editor
                  </p>
                </div>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {"\u6587\u4ef6\u7f16\u53f7:"}
                </span>
                <code className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {metaData.productCode}
                </code>
                <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {printTemplateLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {lastSaved && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {"\u4e0a\u6b21\u4fdd\u5b58: "}
                  {lastSaved.toLocaleTimeString("zh-CN", { hour12: false })}
                </span>
              )}
              <PrintTemplateSelector value={printTemplate} onChange={setPrintTemplate} />
              <Button
                variant="outline"
                size="sm"
                onClick={openPrintPreview}
                className="sip-toolbar-btn text-xs border-border hover:bg-secondary hover:text-foreground"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                {"\u6253\u5370\u9884\u89c8"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="sip-toolbar-btn text-xs border-border hover:bg-secondary hover:text-foreground"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {isSaving ? "\u4fdd\u5b58\u4e2d..." : "\u4fdd\u5b58\u8349\u7a3f"}
              </Button>
              <SubmitApprovalDialog
                disabled={isSaving || metaData.status === "active"}
                isSaving={isSaving}
                onConfirm={handleSubmit}
                triggerClassName="sip-toolbar-btn text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="sip-page-shell py-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <span className="text-[9px] font-medium tracking-widest text-primary uppercase">
                  INSPECTION ITEMS
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="text-[11px] text-muted-foreground">
                  {"\u68c0\u9a8c\u9879\u76ee\u7edf\u8ba1"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="sip-stat-chip flex items-center gap-2 px-2.5 py-1 bg-card border border-border rounded-lg">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    {"\u603b\u8ba1"}
                  </span>
                  <span className="text-base font-semibold font-mono text-foreground">
                    {stats.total}
                  </span>
                </div>

                <div
                  className={cn(
                    "sip-stat-chip flex items-center gap-2 px-2.5 py-1 rounded-lg border",
                    stats.cr > 0 ? "bg-destructive/10 border-destructive/30" : "bg-card border-border",
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-[11px] text-muted-foreground">CR {"\u4e25\u91cd"}</span>
                  <span
                    className={cn(
                      "text-base font-semibold font-mono",
                      stats.cr > 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {stats.cr}
                  </span>
                </div>

                <div className="sip-stat-chip flex items-center gap-2 px-2.5 py-1 bg-card border border-border rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-[11px] text-muted-foreground">MA {"\u4e3b\u8981"}</span>
                  <span className="text-base font-semibold font-mono text-warning">{stats.ma}</span>
                </div>

                <div className="sip-stat-chip flex items-center gap-2 px-2.5 py-1 bg-card border border-border rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">MI {"\u6b21\u8981"}</span>
                  <span className="text-base font-semibold font-mono text-muted-foreground">
                    {stats.mi}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {metaData.status === "active" ? (
                <div className="sip-stat-chip flex items-center gap-2 px-2.5 py-1 bg-success/10 border border-success/30 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-[11px] font-medium text-success">
                    {"\u5df2\u751f\u6548"}
                  </span>
                  <span className="text-[9px] tracking-wider text-success/70 ml-1">ACTIVE</span>
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                </div>
              ) : metaData.status === "obsolete" ? (
                <div className="sip-stat-chip flex items-center gap-2 px-2.5 py-1 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-[11px] font-medium text-destructive">
                    {"\u5df2\u4f5c\u5e9f"}
                  </span>
                  <span className="text-[9px] tracking-wider text-destructive/70 ml-1">OBSOLETE</span>
                </div>
              ) : (
                <div className="sip-stat-chip flex items-center gap-2 px-2.5 py-1 bg-card border border-border rounded-lg">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {"\u8349\u7a3f\u72b6\u6001"}
                  </span>
                  <span className="text-[9px] tracking-wider text-muted-foreground/70 ml-1">DRAFT</span>
                </div>
              )}
            </div>
          </div>

          <SIPHeader data={metaData} onUpdate={setMetaData} />

          <InspectionTable items={items} onUpdate={setItems} />

          <section className="sip-panel overflow-hidden">
            <div className="space-y-4 p-4">
              <div
                className={cn(
                  "rounded-[18px] border border-border/70 bg-black/10 p-1.5 transition-colors",
                  printTemplate === "portrait" && "border-primary/40 bg-primary/5",
                )}
                onMouseDown={() => activateIllustrationTemplate("portrait")}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border bg-card/80 px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {"\u7ad6\u5411 A4"}
                    </span>
                    {printTemplate === "portrait" ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {"\u5f53\u524d\u6253\u5370 / PDF \u8f93\u51fa\u6765\u6e90"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {"\u70b9\u51fb\u6b64\u533a\u57df\u540e\uff0c\u6253\u5370\u4f1a\u8ddf\u968f\u7ad6\u5411\u6a21\u677f"}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      printTemplate === "portrait" ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {getTemplateSummaryLabel("portrait")}
                  </span>
                </div>
                <SIPIllustrationWorkspace
                  ref={portraitIllustrationWorkspaceRef}
                  data={illustration}
                  template="portrait"
                  onSceneUpdate={(scene) => handleIllustrationSceneUpdate("portrait", scene)}
                  onActivate={() => activateIllustrationTemplate("portrait")}
                />
                <div className="px-3 pb-3">
                  <SidePanelEditor
                    template="portrait"
                    value={manualPanels.portrait}
                    onChange={(nextValue) => handleManualPanelUpdate("portrait", nextValue)}
                  />
                </div>
              </div>

              <div
                className={cn(
                  "rounded-[18px] border border-border/70 bg-black/10 p-1.5 transition-colors",
                  printTemplate === "landscape" && "border-primary/40 bg-primary/5",
                )}
                onMouseDown={() => activateIllustrationTemplate("landscape")}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border bg-card/80 px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {"\u6a2a\u5411 A4"}
                    </span>
                    {printTemplate === "landscape" ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {"\u5f53\u524d\u6253\u5370 / PDF \u8f93\u51fa\u6765\u6e90"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {"\u70b9\u51fb\u6b64\u533a\u57df\u540e\uff0c\u6253\u5370\u4f1a\u8ddf\u968f\u6a2a\u5411\u6a21\u677f"}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      printTemplate === "landscape" ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {getTemplateSummaryLabel("landscape")}
                  </span>
                </div>
                <SIPIllustrationWorkspace
                  ref={landscapeIllustrationWorkspaceRef}
                  data={illustration}
                  template="landscape"
                  onSceneUpdate={(scene) => handleIllustrationSceneUpdate("landscape", scene)}
                  onActivate={() => activateIllustrationTemplate("landscape")}
                />
                <div className="px-3 pb-3">
                  <SidePanelEditor
                    template="landscape"
                    value={manualPanels.landscape}
                    onChange={(nextValue) => handleManualPanelUpdate("landscape", nextValue)}
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="sip-panel sip-footerbar flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-medium tracking-widest text-primary uppercase">
                SIP DOCUMENT
              </span>
              <span className="text-muted-foreground">/</span>
              <p className="text-[11px] text-muted-foreground">
                {`\u6807\u51c6\u68c0\u9a8c\u6307\u5bfc\u4e66 ${versionLabel} - ${metaData.productName} / ${printTemplateLabel}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="sip-toolbar-btn border-border hover:bg-secondary"
                onClick={openPrintPreview}
              >
                <Printer className="h-4 w-4 mr-1.5" />
                {"\u6253\u5370\u9884\u89c8"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="sip-toolbar-btn border-border hover:bg-secondary"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {"\u4fdd\u5b58\u8349\u7a3f"}
              </Button>
              <SubmitApprovalDialog
                disabled={isSaving || metaData.status === "active"}
                isSaving={isSaving}
                onConfirm={handleSubmit}
                triggerClassName="sip-toolbar-btn bg-primary text-primary-foreground hover:bg-primary/90"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
