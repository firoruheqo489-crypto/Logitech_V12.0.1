import { forwardRef } from "react";
import { AlertTriangle, QrCode } from "lucide-react";

import {
  SIP_PRINT_TEMPLATE_LAYOUT,
  type InspectionItem,
  type SIPManualPanelContent,
  type SIPMetaData,
  type SIPPrintTemplate,
} from "./types";
import { SIPIllustrationCalibrationOverlay } from "./SIPIllustrationCalibrationOverlay";
import { SIPIllustrationPrintSurface } from "./SIPIllustrationPrintSurface";
import { SIPPrintLandscapeView } from "./SIPPrintLandscapeView";

interface SIPPrintViewProps {
  metaData: SIPMetaData;
  items: InspectionItem[];
  illustrationImageUrl?: string;
  manualPanel?: SIPManualPanelContent;
  template?: SIPPrintTemplate;
}

const PORTRAIT_LAYOUT = SIP_PRINT_TEMPLATE_LAYOUT.portrait;
const PAGE_WIDTH_MM = PORTRAIT_LAYOUT.pageWidthMm;
const PAGE_HEIGHT_MM = PORTRAIT_LAYOUT.pageHeightMm;
const PAGE_PADDING_MM = PORTRAIT_LAYOUT.pagePaddingMm;
const SECTION_GAP_MM = 1.5;
const HEADER_HEIGHT_MM = 28;
const VISUAL_HEIGHT_MM = PORTRAIT_LAYOUT.visualHeightMm;
const TABLE_HEIGHT_MM = 84;
const FOOTER_HEIGHT_MM = 58;
const TABLE_HEADER_HEIGHT_MM = 7.2;
const PRINT_ROW_COUNT = 8;
const MIN_DISPLAY_ROWS = 5;
const ILLUSTRATION_PADDING_MM = PORTRAIT_LAYOUT.illustrationPaddingMm;
const CR_PANEL_WIDTH_MM = PORTRAIT_LAYOUT.criticalPanelWidthMm;

const tableBorder = "1px solid #000";
const sectionBorder = "2px solid #000";
const blankDate = "____\u5e74__\u6708__\u65e5";

const headerCellStyle = {
  border: tableBorder,
  padding: "1.1mm 1.5mm",
  fontSize: "7.6pt",
  fontWeight: "bold",
  backgroundColor: "#e5e7eb",
} as const;

function formatVersionLabel(value: string): string {
  const normalized = value.trim() || "1.0";
  return normalized.startsWith("V") ? normalized : `V${normalized}`;
}

function formatLimitText(item: InspectionItem): string {
  if (item.lsl && item.usl) {
    return `LSL: ${item.lsl} / USL: ${item.usl}`;
  }
  if (item.lsl) {
    return `LSL: ${item.lsl}`;
  }
  if (item.usl) {
    return `USL: ${item.usl}`;
  }
  return "";
}

function splitManualPanelSections(content: string) {
  return content
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);
}

function SvgPillBadge({
  label,
  width,
  fill,
}: {
  label: string;
  width: string;
  fill: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height="5mm"
      viewBox="0 0 110 50"
      preserveAspectRatio="none"
      style={{ display: "block" }}
      shapeRendering="geometricPrecision"
    >
      <rect x="0" y="0" width="110" height="50" rx="10" ry="10" fill={fill} />
      <text
        x="55"
        y="25"
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Arial, 'Microsoft YaHei', sans-serif"
        fontSize="24"
        fontWeight="700"
        dy="0.05em"
      >
        {label}
      </text>
    </svg>
  );
}

export const SIPPrintView = forwardRef<HTMLDivElement, SIPPrintViewProps>(function SIPPrintView(
  { metaData, items, illustrationImageUrl, manualPanel, template = "portrait" },
  ref,
) {
  if (template === "landscape") {
    return (
      <SIPPrintLandscapeView
        ref={ref}
        metaData={metaData}
        items={items}
        illustrationImageUrl={illustrationImageUrl}
        manualPanel={manualPanel}
      />
    );
  }

  const visibleItems = items.slice(0, PRINT_ROW_COUNT);
  const displayRowCount = Math.max(visibleItems.length, MIN_DISPLAY_ROWS);
  const dataRowHeightMm = (TABLE_HEIGHT_MM - TABLE_HEADER_HEIGHT_MM) / displayRowCount;
  const emptyRowCount = Math.max(0, displayRowCount - visibleItems.length);
  const versionLabel = formatVersionLabel(metaData.version);
  const effectiveDateLabel = metaData.effectiveDate || blankDate;
  const panelTitle = (manualPanel?.title || "").trim() || "CR 项目 100% 全检";
  const panelSections = splitManualPanelSections(manualPanel?.content || "");
  const panelFooter = (manualPanel?.footer || "").trim();

  return (
    <div
      ref={ref}
      className="sip-print-container mx-auto bg-white"
      style={{
        width: `${PAGE_WIDTH_MM}mm`,
        height: `${PAGE_HEIGHT_MM}mm`,
        padding: `${PAGE_PADDING_MM}mm`,
        boxSizing: "border-box",
        overflow: "hidden",
        color: "#000",
        fontFamily: "Arial, 'Microsoft YaHei', sans-serif",
        fontSize: "9pt",
        lineHeight: 1.18,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="sip-print-section"
        style={{
          height: `${HEADER_HEIGHT_MM}mm`,
          marginBottom: `${SECTION_GAP_MM}mm`,
          flex: "0 0 auto",
        }}
      >
        <table
          style={{
            width: "100%",
            height: "100%",
            borderCollapse: "collapse",
            border: sectionBorder,
            tableLayout: "fixed",
          }}
        >
          <tbody>
            <tr>
              <td style={{ width: "30%", border: tableBorder, padding: "2.2mm", verticalAlign: "middle" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.2mm" }}>
                  <div
                    style={{
                      display: "flex",
                      width: "22mm",
                      height: "8mm",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px dashed #666",
                      color: "#666",
                      fontSize: "6.5pt",
                    }}
                  >
                    Company Logo
                  </div>
                  <div style={{ fontSize: "11.5pt", fontWeight: "bold", letterSpacing: "0.25mm" }}>
                    {"\u6807\u51c6\u68c0\u9a8c\u7a0b\u5e8f SIP"}
                  </div>
                </div>
              </td>

              <td style={{ width: "40%", border: tableBorder, padding: 0, verticalAlign: "top" }}>
                <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <tbody>
                    <tr>
                      <td style={{ ...headerCellStyle, width: "30%" }}>
                        {"\u4ea7\u54c1\u7f16\u53f7"}
                      </td>
                      <td
                        style={{
                          borderBottom: tableBorder,
                          padding: "1.2mm 1.6mm",
                          fontFamily: "Consolas, monospace",
                          fontWeight: "bold",
                          fontSize: "8.3pt",
                        }}
                      >
                        {metaData.productCode}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...headerCellStyle, width: "30%" }}>
                        {"\u4ea7\u54c1\u540d\u79f0"}
                      </td>
                      <td style={{ borderBottom: tableBorder, padding: "1.2mm 1.6mm", fontSize: "8.3pt" }}>
                        {metaData.productName}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...headerCellStyle, width: "30%" }}>
                        {"\u9002\u7528\u673a\u79cd"}
                      </td>
                      <td style={{ padding: "1.2mm 1.6mm", fontSize: "8.1pt" }}>
                        {"\u7167\u660e\u7ec4\u4ef6 / Lighting Assembly"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              <td style={{ width: "30%", border: tableBorder, padding: 0, verticalAlign: "top" }}>
                <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          width: "50%",
                          borderRight: tableBorder,
                          borderBottom: tableBorder,
                          padding: "1.3mm",
                          textAlign: "center",
                        }}
                        rowSpan={2}
                      >
                        <div
                          style={{
                            display: "flex",
                            width: "15mm",
                            height: "15mm",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto",
                            border: "1px dashed #666",
                          }}
                        >
                          <QrCode style={{ width: "11mm", height: "11mm", color: "#333" }} />
                        </div>
                        <div style={{ marginTop: "0.8mm", fontSize: "5.5pt", color: "#666" }}>
                          {"\u6587\u4ef6\u8ffd\u6eaf\u7801"}
                        </div>
                      </td>
                      <td style={{ borderBottom: tableBorder, padding: "1.2mm 1.6mm", textAlign: "center" }}>
                        <div style={{ fontSize: "6.5pt", color: "#666" }}>
                          {"\u7248\u672c"}
                        </div>
                        <div style={{ fontFamily: "Consolas, monospace", fontSize: "11pt", fontWeight: "bold" }}>
                          {versionLabel}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "1.3mm", textAlign: "center", backgroundColor: "#fafafa" }}>
                        <div style={{ marginBottom: "0.8mm", fontSize: "6.5pt", color: "#666" }}>
                          {"\u7b7e\u6838\u680f"}
                        </div>
                        <div style={{ width: "18mm", height: "9mm", margin: "0 auto", border: "1px dashed #ccc" }} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        className="sip-print-section"
        style={{
          display: "flex",
          height: `${VISUAL_HEIGHT_MM}mm`,
          marginBottom: `${SECTION_GAP_MM}mm`,
          border: sectionBorder,
          overflow: "hidden",
          flex: "0 0 auto",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            borderRight: tableBorder,
            padding: `${ILLUSTRATION_PADDING_MM}mm`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fafafa",
            overflow: "hidden",
          }}
        >
          {illustrationImageUrl ? (
            <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
              <SIPIllustrationPrintSurface imageUrl={illustrationImageUrl} template="portrait" />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: "2px dashed #ccc",
                color: "#999",
                textAlign: "center",
                padding: "3mm",
              }}
            >
              <div style={{ marginBottom: "2mm", fontSize: "15pt" }}>
                {"\u4ea7\u54c1\u793a\u610f\u56fe"}
              </div>
              <div style={{ fontSize: "8pt", lineHeight: 1.3 }}>
                {"\u53ef\u5728\u7f16\u8f91\u754c\u9762\u4e0a\u4f20\u56fe\u793a\uff0c\u6253\u5370\u65f6\u4f1a\u76f4\u63a5\u6620\u5c04\u5230\u6b64\u533a\u57df"}
              </div>
            </div>
          )}

          <div
            style={{
              position: "absolute",
              top: `${ILLUSTRATION_PADDING_MM}mm`,
              right: `${ILLUSTRATION_PADDING_MM}mm`,
              bottom: `${ILLUSTRATION_PADDING_MM}mm`,
              left: `${ILLUSTRATION_PADDING_MM}mm`,
            }}
          >
            <SIPIllustrationCalibrationOverlay
              widthMm={PORTRAIT_LAYOUT.pageWidthMm - PORTRAIT_LAYOUT.pagePaddingMm * 2 - CR_PANEL_WIDTH_MM - ILLUSTRATION_PADDING_MM * 2}
              heightMm={VISUAL_HEIGHT_MM - ILLUSTRATION_PADDING_MM * 2}
              mode="print"
            />
          </div>
        </div>

        <div
          style={{
            width: `${CR_PANEL_WIDTH_MM}mm`,
            padding: "2mm",
            backgroundColor: "#fef2f2",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1.5mm",
              marginBottom: "2mm",
              padding: "1.3mm 2mm",
              backgroundColor: "#dc2626",
              color: "#fff",
              fontSize: "9pt",
              fontWeight: "bold",
            }}
          >
            <AlertTriangle style={{ width: "3.5mm", height: "3.5mm" }} />
            {panelTitle}
          </div>

          {panelSections.length > 0 ? (
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
              }}
            >
              {panelSections.map((section, index) => (
                <div
                  key={`manual-section-${index}`}
                  style={{
                    marginBottom: "1.2mm",
                    borderBottom: "1px solid #fca5a5",
                    padding: "1.4mm 1.2mm",
                  }}
                >
                  <div
                    style={{
                      color: "#7f1d1d",
                      fontSize: "7.6pt",
                      lineHeight: 1.2,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {section}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
                fontSize: "7.5pt",
              }}
            >
              {"\u53ef\u5728\u7f16\u8f91\u9875\u624b\u5de5\u586b\u5199\u53f3\u4fa7\u8bf4\u660e\u533a"}
            </div>
          )}

          <div
            style={{
              borderTop: "1px solid #fca5a5",
              paddingTop: "1.5mm",
              textAlign: "center",
              fontSize: "6.6pt",
              color: "#991b1b",
              fontWeight: "bold",
              lineHeight: 1.2,
              whiteSpace: "pre-wrap",
            }}
          >
            {panelFooter || "\u53ef\u5728\u7f16\u8f91\u9875\u4e3a\u6b64\u533a\u57df\u8bbe\u7f6e\u5e95\u90e8\u5907\u6ce8"}
          </div>
        </div>
      </div>

      <div
        className="sip-print-section"
        style={{
          height: `${TABLE_HEIGHT_MM}mm`,
          marginBottom: `${SECTION_GAP_MM}mm`,
          overflow: "hidden",
          flex: "0 0 auto",
        }}
      >
        <table
          style={{
            width: "100%",
            height: "100%",
            borderCollapse: "collapse",
            border: sectionBorder,
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ height: `${TABLE_HEADER_HEIGHT_MM}mm` }}>
              <th style={{ ...headerCellStyle, width: "8%", textAlign: "center" }}>
                {"\u5e8f\u53f7"}
              </th>
              <th style={{ ...headerCellStyle, width: "20%", textAlign: "left" }}>
                {"\u68c0\u9a8c\u9879\u76ee"}
              </th>
              <th style={{ ...headerCellStyle, width: "37%", textAlign: "left" }}>
                {"\u89c4\u683c / \u5224\u5b9a\u6807\u51c6"}
              </th>
              <th style={{ ...headerCellStyle, width: "20%", textAlign: "left" }}>
                {"\u91cf\u6d4b\u5de5\u5177"}
              </th>
              <th style={{ ...headerCellStyle, width: "15%", textAlign: "center" }}>
                {"\u7f3a\u9677\u7b49\u7ea7"}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
              const limitText = formatLimitText(item);

              return (
                <tr
                  key={item.id}
                  style={{
                    height: `${dataRowHeightMm}mm`,
                    backgroundColor: item.defectLevel === "CR" ? "#fef2f2" : "transparent",
                  }}
                >
                  <td
                    style={{
                      border: tableBorder,
                      padding: "0.8mm 1.2mm",
                      textAlign: "center",
                      fontSize: "8.1pt",
                      fontWeight: "bold",
                      verticalAlign: "middle",
                      lineHeight: 1,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        minWidth: "5mm",
                        color: item.defectLevel === "CR" ? "#dc2626" : "#666",
                        fontSize: "9pt",
                        fontWeight: "bold",
                        lineHeight: 1,
                        textAlign: "center",
                      }}
                    >
                      {item.sequence}
                    </span>
                  </td>
                  <td
                    style={{
                      border: tableBorder,
                      padding: "0.8mm 1.3mm",
                      fontSize: "7.8pt",
                      fontWeight: item.defectLevel === "CR" ? "bold" : "normal",
                      color: item.defectLevel === "CR" ? "#991b1b" : "#000",
                      verticalAlign: "middle",
                      whiteSpace: "normal",
                      lineHeight: 1.14,
                      wordBreak: "break-word",
                    }}
                  >
                    {item.inspectionItem}
                  </td>
                  <td style={{ border: tableBorder, padding: "0.8mm 1.3mm", fontSize: "7.7pt", verticalAlign: "middle" }}>
                    <div style={{ whiteSpace: "normal", lineHeight: 1.14, wordBreak: "break-word" }}>
                      {item.specification}
                    </div>
                    {limitText ? (
                      <div
                        style={{
                          marginTop: "0.3mm",
                          color: "#666",
                          fontFamily: "Consolas, monospace",
                          fontSize: "6.2pt",
                          lineHeight: 1.05,
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                        }}
                      >
                        {limitText}
                      </div>
                    ) : null}
                  </td>
                  <td
                    style={{
                      border: tableBorder,
                      padding: "0.8mm 1.3mm",
                      fontSize: "7.7pt",
                      verticalAlign: "middle",
                      whiteSpace: "normal",
                      lineHeight: 1.14,
                      wordBreak: "break-word",
                    }}
                  >
                    {item.measurementTool}
                  </td>
                  <td
                    style={{
                      border: tableBorder,
                      padding: "0.8mm 1.3mm",
                      textAlign: "center",
                      verticalAlign: "middle",
                      lineHeight: 1,
                    }}
                  >
                    <SvgPillBadge
                      label={item.defectLevel || "--"}
                      width={item.defectLevel ? "11mm" : "9mm"}
                      fill={
                        item.defectLevel === "CR"
                          ? "#dc2626"
                          : item.defectLevel === "MA"
                            ? "#f59e0b"
                            : item.defectLevel === "MI"
                              ? "#6b7280"
                              : "#9ca3af"
                      }
                    />
                  </td>
                </tr>
              );
            })}

            {Array.from({ length: emptyRowCount }).map((_, index) => (
              <tr key={`empty-${index}`} style={{ height: `${dataRowHeightMm}mm` }}>
                <td style={{ border: tableBorder, padding: "0.8mm 1.2mm" }}>&nbsp;</td>
                <td style={{ border: tableBorder, padding: "0.8mm 1.3mm" }}>&nbsp;</td>
                <td style={{ border: tableBorder, padding: "0.8mm 1.3mm" }}>&nbsp;</td>
                <td style={{ border: tableBorder, padding: "0.8mm 1.3mm" }}>&nbsp;</td>
                <td style={{ border: tableBorder, padding: "0.8mm 1.3mm" }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="sip-print-section"
        style={{
          height: `${FOOTER_HEIGHT_MM}mm`,
          flex: "0 0 auto",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            height: "100%",
            borderCollapse: "collapse",
            border: sectionBorder,
            tableLayout: "fixed",
          }}
        >
          <tbody>
            <tr>
              <td style={{ width: "33.33%", border: tableBorder, padding: 0, verticalAlign: "top" }}>
                <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <tbody>
                    <tr>
                      <td style={{ ...headerCellStyle, width: "35%" }}>
                        {"\u7f16\u5236\u4eba"}
                      </td>
                      <td style={{ borderBottom: tableBorder, padding: "1mm 1.5mm", fontSize: "8pt" }}>
                        {metaData.author}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...headerCellStyle, width: "35%" }}>
                        {"\u7f16\u5236\u65e5\u671f"}
                      </td>
                      <td style={{ padding: "1mm 1.5mm", fontSize: "8pt" }}>
                        {effectiveDateLabel}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style={{ width: "33.33%", border: tableBorder, padding: 0, verticalAlign: "top" }}>
                <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <tbody>
                    <tr>
                      <td style={{ ...headerCellStyle, width: "35%" }}>
                        {"\u5ba1\u6838\u4eba"}
                      </td>
                      <td style={{ borderBottom: tableBorder, padding: "1mm 1.5mm" }}>&nbsp;</td>
                    </tr>
                    <tr>
                      <td style={{ ...headerCellStyle, width: "35%" }}>
                        {"\u5ba1\u6838\u65e5\u671f"}
                      </td>
                      <td style={{ padding: "1mm 1.5mm", fontSize: "8pt" }}>
                        {blankDate}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style={{ width: "33.34%", border: tableBorder, padding: 0, verticalAlign: "top" }}>
                <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <tbody>
                    <tr>
                      <td style={{ ...headerCellStyle, width: "35%" }}>
                        {"\u6279\u51c6\u4eba"}
                      </td>
                      <td style={{ borderBottom: tableBorder, padding: "1mm 1.5mm" }}>&nbsp;</td>
                    </tr>
                    <tr>
                      <td style={{ ...headerCellStyle, width: "35%" }}>
                        {"\u6279\u51c6\u65e5\u671f"}
                      </td>
                      <td style={{ padding: "1mm 1.5mm", fontSize: "8pt" }}>
                        {blankDate}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            <tr>
              <td colSpan={3} style={{ border: tableBorder, padding: "1.2mm 2mm", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4mm" }}>
                  <span style={{ color: "#666", fontSize: "6.8pt" }}>
                    {`\u6587\u4ef6\u7f16\u53f7: SIP-${metaData.productCode}-${versionLabel}`}
                  </span>
                  <span style={{ color: "#666", fontSize: "6.8pt" }}>
                    {`\u751f\u6548\u65e5\u671f: ${metaData.effectiveDate || "\u5f85\u586b\u5199"}`}
                  </span>
                </div>
              </td>
            </tr>

            <tr>
              <td colSpan={3} style={{ border: tableBorder, padding: "1.4mm 2.1mm", textAlign: "center", backgroundColor: "#fef2f2" }}>
                <span style={{ color: "#991b1b", fontSize: "7.1pt", fontWeight: "bold", lineHeight: 1.15 }}>
                  {"\u672c\u6587\u4ef6\u53d7\u63a7\u53d1\u653e\uff0c\u6253\u5370\u4ef6\u9ed8\u8ba4\u4e3a\u975e\u53d7\u63a7\u526f\u672c\uff1b\u5982\u6709\u7248\u672c\u66f4\u65b0\uff0c\u8bf7\u4ee5\u7cfb\u7edf\u6700\u65b0\u751f\u6548\u7248\u672c\u4e3a\u51c6\u3002"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          html,
          body {
            width: ${PAGE_WIDTH_MM}mm;
            height: ${PAGE_HEIGHT_MM}mm;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .sip-print-container {
            width: ${PAGE_WIDTH_MM}mm !important;
            height: ${PAGE_HEIGHT_MM}mm !important;
            margin: 0 !important;
            padding: ${PAGE_PADDING_MM}mm !important;
            box-shadow: none !important;
            overflow: hidden !important;
            break-after: avoid-page;
            page-break-after: avoid;
          }

          .sip-print-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }

        @media screen {
          .sip-print-container {
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
            margin: 20px auto;
          }
        }
      `}</style>
    </div>
  );
});
