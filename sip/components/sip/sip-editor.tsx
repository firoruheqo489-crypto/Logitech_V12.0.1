"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { SIPHeader, type SIPMetaData } from "./sip-header";
import { InspectionTable, type InspectionItem } from "./inspection-table";
import {
  Save,
  Send,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// 示例数据
const initialMetaData: SIPMetaData = {
  productCode: "PCB-2024-001",
  productName: "多层印制电路板 A型",
  version: "2.1",
  status: "draft",
  author: "张工",
  effectiveDate: "",
};

const initialItems: InspectionItem[] = [
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

export function SIPEditor() {
  const [metaData, setMetaData] = useState<SIPMetaData>(initialMetaData);
  const [items, setItems] = useState<InspectionItem[]>(initialItems);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const handleSaveDraft = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLastSaved(new Date());
    setIsSaving(false);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setMetaData({ ...metaData, status: "active" });
    setIsSaving(false);
  };

  // 统计信息
  const stats = {
    total: items.length,
    cr: items.filter((i) => i.defectLevel === "CR").length,
    ma: items.filter((i) => i.defectLevel === "MA").length,
    mi: items.filter((i) => i.defectLevel === "MI").length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            {/* 左侧标题 */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-foreground">
                    SIP 编辑控制台
                  </h1>
                  <p className="text-[10px] text-muted-foreground">
                    Standard Inspection Procedure Editor
                  </p>
                </div>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">文件编号:</span>
                <code className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {metaData.productCode}
                </code>
              </div>
            </div>

            {/* 右侧操作区 */}
            <div className="flex items-center gap-3">
              {lastSaved && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  上次保存: {lastSaved.toLocaleTimeString("zh-CN")}
                </span>
              )}
              <Link href="/print">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-border hover:bg-secondary hover:text-foreground"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  打印预览
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="h-8 text-xs border-border hover:bg-secondary hover:text-foreground"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {isSaving ? "保存中..." : "保存草稿"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={isSaving || metaData.status === "active"}
                    className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    提交审批
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认提交审批？</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      提交后，本检验指导书将进入审批流程。审批通过后自动生效。
                      <br />
                      <span className="text-destructive">
                        注意：生效后将无法再编辑内容。
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit} className="bg-primary text-primary-foreground">
                      确认提交
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-[1600px] mx-auto px-4 lg:px-6 py-5">
        <div className="space-y-5">
          {/* 状态统计条 */}
          <div className="flex items-center justify-between">
            {/* 左侧统计 */}
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-medium tracking-widest text-primary uppercase">
                  INSPECTION ITEMS
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="text-xs text-muted-foreground">
                  检验项目统计
                </span>
              </div>
              <div className="flex items-center gap-4">
                {/* 总数 */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">总计</span>
                  <span className="text-lg font-semibold font-mono text-foreground">
                    {stats.total}
                  </span>
                </div>
                
                {/* CR */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                  stats.cr > 0 
                    ? "bg-destructive/10 border-destructive/30" 
                    : "bg-card border-border"
                )}>
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-xs text-muted-foreground">CR 严重</span>
                  <span className={cn(
                    "text-lg font-semibold font-mono",
                    stats.cr > 0 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {stats.cr}
                  </span>
                </div>

                {/* MA */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-xs text-muted-foreground">MA 主要</span>
                  <span className="text-lg font-semibold font-mono text-warning">
                    {stats.ma}
                  </span>
                </div>

                {/* MI */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-xs text-muted-foreground">MI 次要</span>
                  <span className="text-lg font-semibold font-mono text-muted-foreground">
                    {stats.mi}
                  </span>
                </div>
              </div>
            </div>

            {/* 右侧状态指示器 */}
            <div className="flex items-center gap-3">
              {metaData.status === "active" ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/30 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-xs font-medium text-success">已生效</span>
                  <span className="text-[10px] tracking-wider text-success/70 ml-1">ACTIVE</span>
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                </div>
              ) : metaData.status === "obsolete" ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-medium text-destructive">已作废</span>
                  <span className="text-[10px] tracking-wider text-destructive/70 ml-1">OBSOLETE</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">草稿状态</span>
                  <span className="text-[10px] tracking-wider text-muted-foreground/70 ml-1">DRAFT</span>
                </div>
              )}
            </div>
          </div>

          {/* 元数据区域 */}
          <SIPHeader data={metaData} onUpdate={setMetaData} />

          {/* 检验项目表格 */}
          <InspectionTable items={items} onUpdate={setItems} />

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-medium tracking-widest text-primary uppercase">
                SIP DOCUMENT
              </span>
              <span className="text-muted-foreground">/</span>
              <p className="text-xs text-muted-foreground">
                标准检验指导书 v{metaData.version} • {metaData.productName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/print">
                <Button variant="outline" size="sm" className="h-8 border-border hover:bg-secondary">
                  <Printer className="h-4 w-4 mr-1.5" />
                  打印预览
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="h-8 border-border hover:bg-secondary"
              >
                <Save className="h-4 w-4 mr-1.5" />
                保存草稿
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={isSaving || metaData.status === "active"}
                    className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    提交审批
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认提交审批？</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      提交后，本检验指导书将进入审批流程。审批通过后自动生效。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit} className="bg-primary text-primary-foreground">
                      确认提交
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
