import React, { forwardRef } from "react";
import { AlertTriangle, QrCode } from "lucide-react";

import {
  SIP_PRINT_TEMPLATE_LAYOUT,
  type InspectionItem,
  type SIPManualPanelContent,
  type SIPMetaData,
} from "./types";
import { SIPIllustrationCalibrationOverlay } from "./SIPIllustrationCalibrationOverlay";
import { SIPIllustrationPrintSurface } from "./SIPIllustrationPrintSurface";

interface SIPPrintLandscapeViewProps {
  metaData: SIPMetaData;
  items: InspectionItem[];
  illustrationImageUrl?: string;
  manualPanel?: SIPManualPanelContent;
}

const LANDSCAPE_LAYOUT = SIP_PRINT_TEMPLATE_LAYOUT.landscape;
const PAGE_WIDTH_MM = LANDSCAPE_LAYOUT.pageWidthMm;
const PAGE_HEIGHT_MM = LANDSCAPE_LAYOUT.pageHeightMm;
const PAGE_PADDING_MM = LANDSCAPE_LAYOUT.pagePaddingMm;
const SECTION_GAP_MM = 1.5;
const HEADER_HEIGHT_MM = 24;
const VISUAL_HEIGHT_MM = LANDSCAPE_LAYOUT.visualHeightMm;
const TABLE_HEIGHT_MM = 72;
const FOOTER_HEIGHT_MM = 23.5;
const TABLE_HEADER_HEIGHT_MM = 7.2;
const PRINT_ROW_COUNT = 8;
const MIN_DISPLAY_ROWS = 5;
const CR_PANEL_WIDTH_MM = LANDSCAPE_LAYOUT.criticalPanelWidthMm;

const tableBorder = "1px solid #000";
const sectionBorder = "2px solid #000";
const blankDate = "____\u5e74__\u6708__\u65e5";

const headerCellStyle = {
  border: tableBorder,
  padding: "1mm 1.4mm",
  fontSize: "7.2pt",
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

export const SIPPrintLandscapeView = forwardRef<HTMLDivElement, SIPPrintLandscapeViewProps>(
  function SIPPrintLandscapeView({ metaData, items, illustrationImageUrl, manualPanel }, ref) {
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
        className="sip-print-container sip-print-landscape mx-auto bg-white"
        style={{
          width: `${PAGE_WIDTH_MM}mm`,
          height: `${PAGE_HEIGHT_MM}mm`,
          padding: `${PAGE_PADDING_MM}mm`,
          boxSizing: "border-box",
          overflow: "hidden",
          color: "#000",
          fontFamily: "Arial, 'Microsoft YaHei', sans-serif",
          fontSize: "8.6pt",
          lineHeight: 1.15,
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
                <td style={{ width: "30%", border: tableBorder, padding: "2mm", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "3mm" }}>
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.8mm" }}>
                      <div style={{ fontSize: "12pt", fontWeight: "bold", letterSpacing: "0.22mm" }}>
                        {"\u6807\u51c6\u68c0\u9a8c\u7a0b\u5e8f SIP"}
                      </div>
                      <div style={{ color: "#666", fontSize: "6.8pt" }}>Landscape A4 Template</div>
                    </div>
                  </div>
                </td>

                <td style={{ width: "46%", border: tableBorder, padding: 0, verticalAlign: "top" }}>
                  <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...headerCellStyle, width: "18%" }}>
                          {"\u4ea7\u54c1\u7f16\u53f7"}
                        </td>
                        <td
                          style={{
                            borderBottom: tableBorder,
                            padding: "1mm 1.5mm",
                            fontFamily: "Consolas, monospace",
                            fontWeight: "bold",
                            fontSize: "8pt",
                          }}
                        >
                          {metaData.productCode}
                        </td>
                        <td style={{ ...headerCellStyle, width: "18%" }}>
                          {"\u7248\u672c"}
                        </td>
                        <td
                          style={{
                            borderBottom: tableBorder,
                            padding: "1mm 1.5mm",
                            fontFamily: "Consolas, monospace",
                            fontWeight: "bold",
                            fontSize: "8pt",
                          }}
                        >
                          {versionLabel}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ ...headerCellStyle, width: "18%" }}>
                          {"\u4ea7\u54c1\u540d\u79f0"}
                        </td>
                        <td style={{ borderBottom: tableBorder, padding: "1mm 1.5mm", fontSize: "8pt" }}>
                          {metaData.productName}
                        </td>
                        <td style={{ ...headerCellStyle, width: "18%" }}>
                          {"\u7f16\u5236\u4eba"}
                        </td>
                        <td style={{ borderBottom: tableBorder, padding: "1mm 1.5mm", fontSize: "8pt" }}>
                          {metaData.author}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ ...headerCellStyle, width: "18%" }}>
                          {"\u9002\u7528\u673a\u79cd"}
                        </td>
                        <td style={{ padding: "1mm 1.5mm", fontSize: "7.8pt" }}>
                          {"\u7167\u660e\u7ec4\u4ef6 / Lighting Assembly"}
                        </td>
                        <td style={{ ...headerCellStyle, width: "18%" }}>
                          {"\u751f\u6548\u65e5\u671f"}
                        </td>
                        <td style={{ padding: "1mm 1.5mm", fontSize: "8pt" }}>{effectiveDateLabel}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>

                <td style={{ width: "24%", border: tableBorder, padding: 0, verticalAlign: "top" }}>
                  <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: "42%",
                            borderRight: tableBorder,
                            borderBottom: tableBorder,
                            padding: "1.4mm",
                            textAlign: "center",
                          }}
                          rowSpan={2}
                        >
                          <div
                            style={{
                              display: "flex",
                              width: "14mm",
                              height: "14mm",
                              alignItems: "center",
                              justifyContent: "center",
                              margin: "0 auto",
                              border: "1px dashed #666",
                            }}
                          >
                            <QrCode style={{ width: "10mm", height: "10mm", color: "#333" }} />
                          </div>
                          <div style={{ marginTop: "0.8mm", fontSize: "5.5pt", color: "#666" }}>
                            {"\u6587\u4ef6\u8ffd\u6eaf\u7801"}
                          </div>
                        </td>
                        <td style={{ borderBottom: tableBorder, padding: "1mm 1.4mm", textAlign: "center" }}>
                          <div style={{ fontSize: "6.2pt", color: "#666" }}>
                            {"\u6a21\u677f"}
                          </div>
                          <div style={{ fontSize: "8.3pt", fontWeight: "bold" }}>
                            {"\u6a2a\u5411 A4"}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "1mm 1.4mm", textAlign: "center", backgroundColor: "#fafafa" }}>
                          <div style={{ fontSize: "6.2pt", color: "#666", marginBottom: "0.8mm" }}>
                            {"\u7b7e\u6838\u680f"}
                          </div>
                          <div style={{ width: "22mm", height: "7mm", margin: "0 auto", border: "1px dashed #ccc" }} />
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fafafa",
              overflow: "hidden",
            }}
          >
            {illustrationImageUrl ? (
              <SIPIllustrationPrintSurface
                imageUrl={illustrationImageUrl}
                template="landscape"
              />
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
                <div style={{ marginBottom: "2mm", fontSize: "14pt" }}>
                  {"\u4ea7\u54c1\u793a\u610f\u56fe"}
                </div>
                <div style={{ fontSize: "7.6pt", lineHeight: 1.3 }}>
                  {"\u53ef\u5728\u7f16\u8f91\u754c\u9762\u4e0a\u4f20\u56fe\u793a\uff0c\u6253\u5370\u65f6\u4f1a\u76f4\u63a5\u6620\u5c04\u5230\u6b64\u533a\u57df"}
                </div>
              </div>
            )}

            <SIPIllustrationCalibrationOverlay
              widthMm={LANDSCAPE_LAYOUT.pageWidthMm - LANDSCAPE_LAYOUT.pagePaddingMm * 2 - CR_PANEL_WIDTH_MM}
              heightMm={VISUAL_HEIGHT_MM}
              mode="print"
            />
          </div>

        <div
          style={{
            width: `${CR_PANEL_WIDTH_MM}mm`,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#fff7f7",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "1.6mm",
                padding: "1.5mm 2mm",
                backgroundColor: "#dc2626",
                color: "#fff",
                fontSize: "8.5pt",
                fontWeight: "bold",
              }}
            >
              <AlertTriangle style={{ width: "3.3mm", height: "3.3mm" }} />
              {panelTitle}
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.6mm 2mm 0 2mm" }}>
              {panelSections.length > 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.6mm" }}>
                  {panelSections.map((section, index) => (
                    <div
                      key={`landscape-manual-section-${index}`}
                      style={{
                        paddingBottom: "1.3mm",
                        borderBottom: "1px solid #f5b4b4",
                      }}
                    >
                      <div
                        style={{
                          color: "#7f1d1d",
                          fontSize: "7.2pt",
                          lineHeight: 1.15,
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
                    fontSize: "7.4pt",
                  }}
                >
                  {"\u53ef\u5728\u7f16\u8f91\u9875\u624b\u5de5\u586b\u5199\u53f3\u4fa7\u8bf4\u660e\u533a"}
                </div>
              )}

              <div
                style={{
                  marginTop: "2mm",
                  borderTop: "1px solid #f5b4b4",
                  paddingTop: "1.6mm",
                  color: "#7f1d1d",
                  fontSize: "6.8pt",
                  fontWeight: "bold",
                  lineHeight: 1.25,
                  whiteSpace: "pre-wrap",
                  textAlign: "center",
                }}
              >
                {panelFooter || "\u53ef\u5728\u7f16\u8f91\u9875\u4e3a\u6b64\u533a\u57df\u8bbe\u7f6e\u5e95\u90e8\u5907\u6ce8"}
              </div>
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
                <th style={{ ...headerCellStyle, width: "7%", textAlign: "center" }}>
                  {"\u5e8f\u53f7"}
                </th>
                <th style={{ ...headerCellStyle, width: "22%", textAlign: "left" }}>
                  {"\u68c0\u9a8c\u9879\u76ee"}
                </th>
                <th style={{ ...headerCellStyle, width: "34%", textAlign: "left" }}>
                  {"\u89c4\u683c / \u5224\u5b9a\u6807\u51c6"}
                </th>
                <th style={{ ...headerCellStyle, width: "22%", textAlign: "left" }}>
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
                        padding: "0.8mm 1.1mm",
                        textAlign: "center",
                        verticalAlign: "middle",
                        lineHeight: 1,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          minWidth: "5mm",
                          color: item.defectLevel === "CR" ? "#dc2626" : "#666",
                          fontSize: "8.8pt",
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
                    <td style={{ border: tableBorder, padding: "0.8mm 1.3mm", fontSize: "7.6pt", verticalAlign: "middle" }}>
                      <div style={{ whiteSpace: "normal", lineHeight: 1.14, wordBreak: "break-word" }}>
                        {item.specification}
                      </div>
                      {limitText ? (
                        <div
                          style={{
                            marginTop: "0.3mm",
                            color: "#666",
                            fontFamily: "Consolas, monospace",
                            fontSize: "6pt",
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
                        fontSize: "7.6pt",
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
                        width={item.defectLevel ? "12mm" : "10mm"}
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
                  <td style={{ border: tableBorder, padding: "0.8mm 1.1mm" }}>&nbsp;</td>
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
                <td style={{ width: "68%", border: tableBorder, padding: 0, verticalAlign: "top" }}>
                  <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...headerCellStyle, width: "11%" }}>
                          {"\u7f16\u5236\u4eba"}
                        </td>
                        <td style={{ borderBottom: tableBorder, padding: "0.9mm 1.4mm", fontSize: "7.8pt" }}>
                          {metaData.author}
                        </td>
                        <td style={{ ...headerCellStyle, width: "11%" }}>
                          {"\u7f16\u5236\u65e5\u671f"}
                        </td>
                        <td style={{ borderBottom: tableBorder, padding: "0.9mm 1.4mm", fontSize: "7.8pt" }}>
                          {effectiveDateLabel}
                        </td>
                        <td style={{ ...headerCellStyle, width: "11%" }}>
                          {"\u5ba1\u6838\u4eba"}
                        </td>
                        <td style={{ borderBottom: tableBorder, padding: "0.9mm 1.4mm" }}>&nbsp;</td>
                        <td style={{ ...headerCellStyle, width: "11%" }}>
                          {"\u5ba1\u6838\u65e5\u671f"}
                        </td>
                        <td style={{ borderBottom: tableBorder, padding: "0.9mm 1.4mm", fontSize: "7.8pt" }}>
                          {blankDate}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ ...headerCellStyle, width: "11%" }}>
                          {"\u6279\u51c6\u4eba"}
                        </td>
                        <td style={{ padding: "0.9mm 1.4mm" }}>&nbsp;</td>
                        <td style={{ ...headerCellStyle, width: "11%" }}>
                          {"\u6279\u51c6\u65e5\u671f"}
                        </td>
                        <td style={{ padding: "0.9mm 1.4mm", fontSize: "7.8pt" }}>{blankDate}</td>
                        <td style={{ ...headerCellStyle, width: "11%" }}>
                          {"\u6587\u4ef6\u7f16\u53f7"}
                        </td>
                        <td style={{ padding: "0.9mm 1.4mm", fontSize: "7.6pt" }}>{`SIP-${metaData.productCode}-${versionLabel}`}</td>
                        <td style={{ ...headerCellStyle, width: "11%" }}>
                          {"\u751f\u6548\u65e5\u671f"}
                        </td>
                        <td style={{ padding: "0.9mm 1.4mm", fontSize: "7.8pt" }}>
                          {metaData.effectiveDate || "\u5f85\u586b\u5199"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td style={{ width: "32%", border: tableBorder, padding: "1.4mm 1.8mm", backgroundColor: "#fef2f2" }}>
                  <div style={{ color: "#991b1b", fontSize: "7pt", fontWeight: "bold", lineHeight: 1.2 }}>
                    {"\u672c\u6587\u4ef6\u53d7\u63a7\u53d1\u653e\uff0c\u6253\u5370\u4ef6\u9ed8\u8ba4\u4e3a\u975e\u53d7\u63a7\u526f\u672c\u3002"}
                  </div>
                  <div style={{ marginTop: "1mm", color: "#7f1d1d", fontSize: "6.4pt", lineHeight: 1.2 }}>
                    {"\u5982\u6709\u7248\u672c\u66f4\u65b0\uff0c\u8bf7\u4ee5\u7cfb\u7edf\u4e2d\u6700\u65b0\u751f\u6548\u7248\u672c\u4e3a\u51c6\u3002"}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <style>{`
          @media print {
            @page {
              size: A4 landscape;
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

            .sip-print-landscape {
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
            .sip-print-landscape {
              box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
              margin: 20px auto;
            }
          }
        `}</style>
      </div>
    );
  },
);
