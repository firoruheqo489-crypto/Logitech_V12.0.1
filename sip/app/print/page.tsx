"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { SIPPrintView } from "@/components/sip/sip-print-view";
import { ArrowLeft, Printer, Download } from "lucide-react";
import Link from "next/link";
import type { SIPMetaData } from "@/components/sip/sip-header";
import type { InspectionItem } from "@/components/sip/inspection-table";

// 示例数据
const metaData: SIPMetaData = {
  productCode: "PCB-2024-001",
  productName: "多层印制电路板 A型",
  version: "2.1",
  status: "active",
  author: "张工",
  effectiveDate: "2024-01-15",
};

const items: InspectionItem[] = [
  {
    id: "1",
    sequence: 1,
    inspectionItem: "外观检验",
    specification: "无明显划痕、变形、污渍",
    lsl: "",
    usl: "",
    measurementTool: "目视检查",
    defectLevel: "MA",
    aqlLevel: "1.0",
    imageUrl: "",
  },
  {
    id: "2",
    sequence: 2,
    inspectionItem: "板厚测量",
    specification: "1.6mm ±0.1mm",
    lsl: "1.5",
    usl: "1.7",
    measurementTool: "千分尺",
    defectLevel: "CR",
    aqlLevel: "0.065",
    imageUrl: "",
  },
  {
    id: "3",
    sequence: 3,
    inspectionItem: "孔径检测",
    specification: "Φ0.8mm ±0.05mm",
    lsl: "0.75",
    usl: "0.85",
    measurementTool: "针规",
    defectLevel: "MA",
    aqlLevel: "0.25",
    imageUrl: "",
  },
  {
    id: "4",
    sequence: 4,
    inspectionItem: "铜厚测量",
    specification: "≥35μm",
    lsl: "35",
    usl: "",
    measurementTool: "铜厚测试仪",
    defectLevel: "CR",
    aqlLevel: "0.1",
    imageUrl: "",
  },
  {
    id: "5",
    sequence: 5,
    inspectionItem: "阻焊层检验",
    specification: "颜色均匀，无露铜",
    lsl: "",
    usl: "",
    measurementTool: "目视+10X放大镜",
    defectLevel: "MI",
    aqlLevel: "2.5",
    imageUrl: "",
  },
];

export default function PrintPreviewPage() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-muted/50">
      {/* 工具栏 - 打印时隐藏 */}
      <div className="sticky top-0 z-50 bg-card border-b border-border print:hidden">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                  <ArrowLeft className="h-4 w-4" />
                  返回编辑
                </Button>
              </Link>
              <span className="text-muted-foreground text-sm">|</span>
              <h1 className="text-sm font-semibold text-foreground">
                A4 打印预览
              </h1>
              <span className="text-xs text-muted-foreground font-mono">
                {metaData.productCode} V{metaData.version}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
                打印文档
              </Button>
              <Button size="sm" className="h-8 gap-1.5">
                <Download className="h-4 w-4" />
                导出PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 打印内容区域 */}
      <div className="py-6 print:py-0">
        <SIPPrintView
          ref={printRef}
          metaData={metaData}
          items={items}
        />
      </div>

      {/* 页脚提示 - 打印时隐藏 */}
      <div className="text-center pb-6 print:hidden">
        <p className="text-xs text-muted-foreground">
          提示：点击"打印文档"按钮或使用 Ctrl+P / Cmd+P 进行打印
        </p>
      </div>
    </div>
  );
}
