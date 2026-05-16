"use client";

import { forwardRef } from "react";
import { QrCode, AlertTriangle } from "lucide-react";
import type { InspectionItem } from "./inspection-table";
import type { SIPMetaData } from "./sip-header";

interface SIPPrintViewProps {
  metaData: SIPMetaData;
  items: InspectionItem[];
  productImageUrl?: string;
}

export const SIPPrintView = forwardRef<HTMLDivElement, SIPPrintViewProps>(
  function SIPPrintView({ metaData, items, productImageUrl }, ref) {
    // 获取CR严重缺陷项目
    const crItems = items.filter((item) => item.defectLevel === "CR");

    return (
      <div
        ref={ref}
        className="sip-print-container bg-white mx-auto"
        style={{
          width: "210mm",
          minHeight: "297mm",
          padding: "8mm",
          fontFamily: "Arial, 'Microsoft YaHei', sans-serif",
          fontSize: "10pt",
          lineHeight: "1.4",
          color: "#000",
        }}
      >
        {/* ===== 区域一：受控表头区 (Header - 10%) ===== */}
        <div
          className="header-section"
          style={{
            height: "10%",
            minHeight: "28mm",
            marginBottom: "3mm",
          }}
        >
          <table
            style={{
              width: "100%",
              height: "100%",
              borderCollapse: "collapse",
              border: "2px solid #000",
            }}
          >
            <tbody>
              <tr>
                {/* 左侧：Logo与文件名称 */}
                <td
                  style={{
                    width: "30%",
                    border: "1px solid #000",
                    padding: "3mm",
                    verticalAlign: "middle",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2mm" }}>
                    <div
                      style={{
                        width: "24mm",
                        height: "10mm",
                        border: "1px dashed #666",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "7pt",
                        color: "#666",
                      }}
                    >
                      公司LOGO
                    </div>
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "12pt",
                        letterSpacing: "0.5mm",
                      }}
                    >
                      标准检验指导书 SIP
                    </div>
                  </div>
                </td>

                {/* 中间：产品信息 */}
                <td
                  style={{
                    width: "40%",
                    border: "1px solid #000",
                    padding: "0",
                    verticalAlign: "top",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      height: "100%",
                      borderCollapse: "collapse",
                    }}
                  >
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: "30%",
                            borderRight: "1px solid #000",
                            borderBottom: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontWeight: "bold",
                            fontSize: "8pt",
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          产品编号
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontFamily: "Consolas, monospace",
                            fontSize: "10pt",
                            fontWeight: "bold",
                          }}
                        >
                          {metaData.productCode}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            borderRight: "1px solid #000",
                            borderBottom: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontWeight: "bold",
                            fontSize: "8pt",
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          产品名称
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontSize: "9pt",
                          }}
                        >
                          {metaData.productName}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            borderRight: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontWeight: "bold",
                            fontSize: "8pt",
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          工序名称
                        </td>
                        <td
                          style={{
                            padding: "1.5mm 2mm",
                            fontSize: "9pt",
                          }}
                        >
                          成品外观检验
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>

                {/* 右侧：二维码、版本号、受控状态 */}
                <td
                  style={{
                    width: "30%",
                    border: "1px solid #000",
                    padding: "0",
                    verticalAlign: "top",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      height: "100%",
                      borderCollapse: "collapse",
                    }}
                  >
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: "50%",
                            borderRight: "1px solid #000",
                            borderBottom: "1px solid #000",
                            padding: "2mm",
                            textAlign: "center",
                          }}
                          rowSpan={2}
                        >
                          <div
                            style={{
                              width: "18mm",
                              height: "18mm",
                              border: "1px dashed #666",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              margin: "0 auto",
                            }}
                          >
                            <QrCode style={{ width: "14mm", height: "14mm", color: "#333" }} />
                          </div>
                          <div style={{ fontSize: "6pt", color: "#666", marginTop: "1mm" }}>
                            扫码核验
                          </div>
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #000",
                            padding: "1.5mm 2mm",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: "7pt", color: "#666" }}>版本号</div>
                          <div
                            style={{
                              fontSize: "14pt",
                              fontWeight: "bold",
                              fontFamily: "Consolas, monospace",
                            }}
                          >
                            V{metaData.version}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: "2mm",
                            textAlign: "center",
                            backgroundColor: "#fafafa",
                          }}
                        >
                          <div style={{ fontSize: "7pt", color: "#666", marginBottom: "1mm" }}>
                            受控印章
                          </div>
                          <div
                            style={{
                              width: "20mm",
                              height: "12mm",
                              border: "1px dashed #ccc",
                              margin: "0 auto",
                            }}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===== 区域二：视觉化防呆区 (Visual Standard - 45%) ===== */}
        <div
          className="visual-section"
          style={{
            height: "45%",
            minHeight: "126mm",
            marginBottom: "3mm",
            border: "2px solid #000",
            display: "flex",
          }}
        >
          {/* 主图区域 */}
          <div
            style={{
              flex: "1",
              position: "relative",
              borderRight: "1px solid #000",
              padding: "3mm",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fafafa",
            }}
          >
            {productImageUrl ? (
              <img
                src={productImageUrl}
                alt="产品检验示意图"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  border: "2px dashed #ccc",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#999",
                }}
              >
                <div style={{ fontSize: "24pt", marginBottom: "3mm" }}>产品检验示意图</div>
                <div style={{ fontSize: "9pt" }}>请在系统中上传产品图片</div>
              </div>
            )}

            {/* 模拟检验点指示箭头 */}
            <div
              style={{
                position: "absolute",
                top: "20%",
                left: "25%",
                display: "flex",
                alignItems: "center",
                gap: "2mm",
              }}
            >
              <div
                style={{
                  width: "6mm",
                  height: "6mm",
                  borderRadius: "50%",
                  backgroundColor: "#dc2626",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10pt",
                  fontWeight: "bold",
                }}
              >
                1
              </div>
              <div
                style={{
                  width: "12mm",
                  height: "0",
                  borderTop: "2px solid #dc2626",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                top: "45%",
                right: "20%",
                display: "flex",
                alignItems: "center",
                gap: "2mm",
              }}
            >
              <div
                style={{
                  width: "12mm",
                  height: "0",
                  borderTop: "2px solid #dc2626",
                }}
              />
              <div
                style={{
                  width: "6mm",
                  height: "6mm",
                  borderRadius: "50%",
                  backgroundColor: "#dc2626",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10pt",
                  fontWeight: "bold",
                }}
              >
                2
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "25%",
                left: "40%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1mm",
              }}
            >
              <div
                style={{
                  width: "6mm",
                  height: "6mm",
                  borderRadius: "50%",
                  backgroundColor: "#dc2626",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10pt",
                  fontWeight: "bold",
                }}
              >
                3
              </div>
              <div
                style={{
                  width: "0",
                  height: "10mm",
                  borderLeft: "2px solid #dc2626",
                }}
              />
            </div>
          </div>

          {/* CR严重缺陷预警区 */}
          <div
            style={{
              width: "55mm",
              backgroundColor: "#fef2f2",
              padding: "3mm",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                backgroundColor: "#dc2626",
                color: "#fff",
                padding: "2mm 3mm",
                fontWeight: "bold",
                fontSize: "11pt",
                textAlign: "center",
                marginBottom: "3mm",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "2mm",
              }}
            >
              <AlertTriangle style={{ width: "4mm", height: "4mm" }} />
              CR 严重缺陷
            </div>

            {crItems.length > 0 ? (
              <div style={{ flex: 1, overflow: "hidden" }}>
                {crItems.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "2mm",
                      borderBottom: "1px solid #fca5a5",
                      marginBottom: "2mm",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "2mm",
                        marginBottom: "1mm",
                      }}
                    >
                      <span
                        style={{
                          width: "5mm",
                          height: "5mm",
                          borderRadius: "50%",
                          backgroundColor: "#dc2626",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "8pt",
                          fontWeight: "bold",
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span
                        style={{
                          fontWeight: "bold",
                          fontSize: "9pt",
                          color: "#991b1b",
                        }}
                      >
                        {item.inspectionItem}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "8pt",
                        color: "#7f1d1d",
                        paddingLeft: "7mm",
                        lineHeight: "1.3",
                      }}
                    >
                      {item.specification}
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
                  fontSize: "8pt",
                }}
              >
                无CR级缺陷项目
              </div>
            )}

            <div
              style={{
                borderTop: "1px solid #fca5a5",
                paddingTop: "2mm",
                fontSize: "7pt",
                color: "#991b1b",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              CR缺陷需100%全检
              <br />
              发现立即停线上报
            </div>
          </div>
        </div>

        {/* ===== 区域三：检验参数明细区 (Inspection Parameters - 35%) ===== */}
        <div
          className="parameters-section"
          style={{
            height: "35%",
            minHeight: "98mm",
            marginBottom: "3mm",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "2px solid #000",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#e5e5e5" }}>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2mm",
                    fontSize: "9pt",
                    fontWeight: "bold",
                    width: "8%",
                    textAlign: "center",
                  }}
                >
                  序号
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2mm",
                    fontSize: "9pt",
                    fontWeight: "bold",
                    width: "20%",
                    textAlign: "left",
                  }}
                >
                  检验项目
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2mm",
                    fontSize: "9pt",
                    fontWeight: "bold",
                    width: "37%",
                    textAlign: "left",
                  }}
                >
                  规格与公差范围
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2mm",
                    fontSize: "9pt",
                    fontWeight: "bold",
                    width: "20%",
                    textAlign: "left",
                  }}
                >
                  测量工具
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "2mm",
                    fontSize: "9pt",
                    fontWeight: "bold",
                    width: "15%",
                    textAlign: "center",
                  }}
                >
                  缺陷等级
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  style={{
                    backgroundColor: item.defectLevel === "CR" ? "#fef2f2" : "transparent",
                  }}
                >
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "2.5mm 2mm",
                      textAlign: "center",
                      fontSize: "10pt",
                      fontWeight: "bold",
                    }}
                  >
                    <div
                      style={{
                        width: "6mm",
                        height: "6mm",
                        borderRadius: "50%",
                        backgroundColor: item.defectLevel === "CR" ? "#dc2626" : "#666",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto",
                        fontSize: "9pt",
                      }}
                    >
                      {item.sequence}
                    </div>
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "2.5mm 2mm",
                      fontSize: "9pt",
                      fontWeight: item.defectLevel === "CR" ? "bold" : "normal",
                      color: item.defectLevel === "CR" ? "#991b1b" : "#000",
                    }}
                  >
                    {item.inspectionItem}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "2.5mm 2mm",
                      fontSize: "9pt",
                    }}
                  >
                    <div>{item.specification}</div>
                    {(item.lsl || item.usl) && (
                      <div
                        style={{
                          marginTop: "1mm",
                          fontSize: "8pt",
                          color: "#666",
                          fontFamily: "Consolas, monospace",
                        }}
                      >
                        {item.lsl && `LSL: ${item.lsl}`}
                        {item.lsl && item.usl && " / "}
                        {item.usl && `USL: ${item.usl}`}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "2.5mm 2mm",
                      fontSize: "9pt",
                    }}
                  >
                    {item.measurementTool}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "2.5mm 2mm",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "1mm 3mm",
                        borderRadius: "1mm",
                        fontSize: "9pt",
                        fontWeight: "bold",
                        backgroundColor:
                          item.defectLevel === "CR"
                            ? "#dc2626"
                            : item.defectLevel === "MA"
                            ? "#f59e0b"
                            : "#6b7280",
                        color: "#fff",
                      }}
                    >
                      {item.defectLevel || "—"}
                    </span>
                  </td>
                </tr>
              ))}
              {/* 填充空行确保表格高度 */}
              {items.length < 8 &&
                Array.from({ length: 8 - items.length }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "2.5mm 2mm",
                        height: "8mm",
                      }}
                    >
                      &nbsp;
                    </td>
                    <td style={{ border: "1px solid #000", padding: "2.5mm 2mm" }}>&nbsp;</td>
                    <td style={{ border: "1px solid #000", padding: "2.5mm 2mm" }}>&nbsp;</td>
                    <td style={{ border: "1px solid #000", padding: "2.5mm 2mm" }}>&nbsp;</td>
                    <td style={{ border: "1px solid #000", padding: "2.5mm 2mm" }}>&nbsp;</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* ===== 区域四：权责签名与发行区 (Footer & Signatures - 10%) ===== */}
        <div
          className="footer-section"
          style={{
            height: "10%",
            minHeight: "28mm",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "2px solid #000",
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    width: "33.33%",
                    border: "1px solid #000",
                    padding: "0",
                    verticalAlign: "top",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: "35%",
                            borderRight: "1px solid #000",
                            borderBottom: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontSize: "8pt",
                            fontWeight: "bold",
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          编制人
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontSize: "9pt",
                          }}
                        >
                          {metaData.author}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            borderRight: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontSize: "8pt",
                            fontWeight: "bold",
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          编制日期
                        </td>
                        <td
                          style={{
                            padding: "1.5mm 2mm",
                            fontSize: "9pt",
                          }}
                        >
                          {metaData.effectiveDate || "____年__月__日"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td
                  style={{
                    width: "33.33%",
                    border: "1px solid #000",
                    padding: "0",
                    verticalAlign: "top",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: "35%",
                            borderRight: "1px solid #000",
                            borderBottom: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontSize: "8pt",
                            fontWeight: "bold",
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          审核人
                        </td>
                        <td style={{ borderBottom: "1px solid #000", padding: "1.5mm 2mm" }}>
                          &nbsp;
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            borderRight: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontSize: "8pt",
                            fontWeight: "bold",
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          审核日期
                        </td>
                        <td style={{ padding: "1.5mm 2mm", fontSize: "9pt" }}>
                          ____年__月__日
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td
                  style={{
                    width: "33.34%",
                    border: "1px solid #000",
                    padding: "0",
                    verticalAlign: "top",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: "35%",
                            borderRight: "1px solid #000",
                            borderBottom: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontSize: "8pt",
                            fontWeight: "bold",
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          批准人
                        </td>
                        <td style={{ borderBottom: "1px solid #000", padding: "1.5mm 2mm" }}>
                          &nbsp;
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            borderRight: "1px solid #000",
                            padding: "1.5mm 2mm",
                            fontSize: "8pt",
                            fontWeight: "bold",
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          批准日期
                        </td>
                        <td style={{ padding: "1.5mm 2mm", fontSize: "9pt" }}>
                          ____年__月__日
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td
                  colSpan={3}
                  style={{
                    border: "1px solid #000",
                    padding: "2mm 3mm",
                    textAlign: "center",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "8pt", color: "#666" }}>
                      文件编号：SIP-{metaData.productCode}-{metaData.version}
                    </span>
                    <span style={{ fontSize: "8pt", color: "#666" }}>
                      生效日期：{metaData.effectiveDate || "待定"}
                    </span>
                  </div>
                </td>
              </tr>
              <tr>
                <td
                  colSpan={3}
                  style={{
                    border: "1px solid #000",
                    padding: "2mm 3mm",
                    textAlign: "center",
                    backgroundColor: "#fef2f2",
                  }}
                >
                  <span
                    style={{
                      fontSize: "8pt",
                      color: "#991b1b",
                      fontWeight: "bold",
                    }}
                  >
                    本文件由系统直接生成，未经受控印章批准，严禁作为检验依据。
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 打印样式 */}
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 0;
            }
            
            body {
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            .sip-print-container {
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              padding: 8mm !important;
              box-shadow: none !important;
              page-break-after: always;
            }
            
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            table {
              border-collapse: collapse !important;
            }
            
            th, td {
              border-color: #000 !important;
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
  }
);
