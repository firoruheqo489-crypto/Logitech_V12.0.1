"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Upload,
  AlertTriangle,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface InspectionItem {
  id: string;
  sequence: number;
  inspectionItem: string;
  specification: string;
  lsl: string;
  usl: string;
  measurementTool: string;
  defectLevel: "CR" | "MA" | "MI" | "";
  aqlLevel: string;
  imageUrl: string;
}

interface InspectionTableProps {
  items: InspectionItem[];
  onUpdate: (items: InspectionItem[]) => void;
}

const defectLevelConfig = {
  CR: {
    label: "CR",
    labelEn: "Critical",
    description: "严重缺陷",
    className: "bg-destructive text-destructive-foreground font-bold",
    selectClass: "bg-destructive/20 text-destructive border-destructive/30",
  },
  MA: {
    label: "MA",
    labelEn: "Major",
    description: "主要缺陷",
    className: "bg-warning text-warning-foreground font-medium",
    selectClass: "bg-warning/20 text-warning border-warning/30",
  },
  MI: {
    label: "MI",
    labelEn: "Minor",
    description: "次要缺陷",
    className: "bg-muted text-muted-foreground",
    selectClass: "bg-muted text-muted-foreground border-border",
  },
  "": {
    label: "—",
    labelEn: "",
    description: "未设定",
    className: "text-muted-foreground",
    selectClass: "text-muted-foreground border-border",
  },
};

const aqlLevels = ["0", "0.065", "0.1", "0.15", "0.25", "0.4", "0.65", "1.0", "1.5", "2.5", "4.0", "6.5"];

export function InspectionTable({ items, onUpdate }: InspectionTableProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const updateItem = (id: string, field: keyof InspectionItem, value: string | number) => {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onUpdate(newItems);
  };

  const addItem = () => {
    const newItem: InspectionItem = {
      id: crypto.randomUUID(),
      sequence: items.length + 1,
      inspectionItem: "",
      specification: "",
      lsl: "",
      usl: "",
      measurementTool: "",
      defectLevel: "",
      aqlLevel: "",
      imageUrl: "",
    };
    onUpdate([...items, newItem]);
  };

  const deleteItem = (id: string) => {
    const newItems = items
      .filter((item) => item.id !== id)
      .map((item, index) => ({ ...item, sequence: index + 1 }));
    onUpdate(newItems);
  };

  const moveItem = (id: string, direction: "up" | "down") => {
    const index = items.findIndex((item) => item.id === id);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === items.length - 1)
    ) {
      return;
    }

    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    
    const resequenced = newItems.map((item, i) => ({ ...item, sequence: i + 1 }));
    onUpdate(resequenced);
  };

  const handleImageUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      updateItem(id, "imageUrl", result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <TooltipProvider>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Section 标题 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium tracking-widest text-primary uppercase">
              SECTION B
            </span>
            <span className="text-muted-foreground/50">|</span>
            <h2 className="text-sm font-medium text-foreground">
              检验项目清单
            </h2>
            <span className="text-xs text-muted-foreground">
              Inspection Items List
            </span>
          </div>
          <Button
            onClick={addItem}
            size="sm"
            className="h-8 px-4 text-xs gap-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            新增检验项
            <span className="text-[10px] text-primary/60 ml-1">Add Item</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50 border-b border-border">
                <TableHead className="w-[70px] text-center">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    序号
                    <div className="text-[9px] text-muted-foreground/60 normal-case">No.</div>
                  </div>
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    检验项目
                    <div className="text-[9px] text-muted-foreground/60 normal-case">Item</div>
                  </div>
                </TableHead>
                <TableHead className="min-w-[160px]">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    规格标准
                    <div className="text-[9px] text-muted-foreground/60 normal-case">Spec</div>
                  </div>
                </TableHead>
                <TableHead className="w-[85px] text-center">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    下限
                    <div className="text-[9px] text-muted-foreground/60 normal-case">LSL</div>
                  </div>
                </TableHead>
                <TableHead className="w-[85px] text-center">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    上限
                    <div className="text-[9px] text-muted-foreground/60 normal-case">USL</div>
                  </div>
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    测量工具
                    <div className="text-[9px] text-muted-foreground/60 normal-case">Tool</div>
                  </div>
                </TableHead>
                <TableHead className="w-[100px] text-center">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    缺陷等级
                    <div className="text-[9px] text-muted-foreground/60 normal-case">Level</div>
                  </div>
                </TableHead>
                <TableHead className="w-[90px] text-center">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    AQL
                    <div className="text-[9px] text-muted-foreground/60 normal-case">Sampling</div>
                  </div>
                </TableHead>
                <TableHead className="w-[100px] text-center">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    图示
                    <div className="text-[9px] text-muted-foreground/60 normal-case">Image</div>
                  </div>
                </TableHead>
                <TableHead className="w-[100px] text-center">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    操作
                    <div className="text-[9px] text-muted-foreground/60 normal-case">Actions</div>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">暂无检验项目</p>
                        <p className="text-xs text-muted-foreground/70">No Inspection Items</p>
                      </div>
                      <Button
                        onClick={addItem}
                        variant="outline"
                        size="sm"
                        className="mt-2 h-8 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        添加第一项
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "group border-b border-border/50 transition-colors",
                      item.defectLevel === "CR" && "bg-destructive/5 hover:bg-destructive/10 border-l-2 border-l-destructive"
                    )}
                  >
                    {/* 序号 */}
                    <TableCell className="text-center">
                      <div className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-mono font-bold",
                        item.defectLevel === "CR" 
                          ? "bg-destructive/20 text-destructive border border-destructive/30"
                          : "bg-primary/10 text-primary border border-primary/20"
                      )}>
                        {item.sequence}
                      </div>
                    </TableCell>

                    {/* 检验项目 */}
                    <TableCell>
                      <Input
                        value={item.inspectionItem}
                        onChange={(e) =>
                          updateItem(item.id, "inspectionItem", e.target.value)
                        }
                        placeholder="输入检验项目"
                        className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-primary focus:bg-input"
                      />
                    </TableCell>

                    {/* 规格标准 */}
                    <TableCell>
                      <Input
                        value={item.specification}
                        onChange={(e) =>
                          updateItem(item.id, "specification", e.target.value)
                        }
                        placeholder="输入规格标准"
                        className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-primary focus:bg-input"
                      />
                    </TableCell>

                    {/* 下限 LSL */}
                    <TableCell>
                      <Input
                        value={item.lsl}
                        onChange={(e) =>
                          updateItem(item.id, "lsl", e.target.value)
                        }
                        placeholder="—"
                        className="h-8 text-sm text-center font-mono bg-transparent border-transparent hover:border-border focus:border-primary focus:bg-input"
                      />
                    </TableCell>

                    {/* 上限 USL */}
                    <TableCell>
                      <Input
                        value={item.usl}
                        onChange={(e) =>
                          updateItem(item.id, "usl", e.target.value)
                        }
                        placeholder="—"
                        className="h-8 text-sm text-center font-mono bg-transparent border-transparent hover:border-border focus:border-primary focus:bg-input"
                      />
                    </TableCell>

                    {/* 测量工具 */}
                    <TableCell>
                      <Input
                        value={item.measurementTool}
                        onChange={(e) =>
                          updateItem(item.id, "measurementTool", e.target.value)
                        }
                        placeholder="输入工具名称"
                        className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-primary focus:bg-input"
                      />
                    </TableCell>

                    {/* 缺陷等级 */}
                    <TableCell>
                      <Select
                        value={item.defectLevel}
                        onValueChange={(value: "CR" | "MA" | "MI" | "") =>
                          updateItem(item.id, "defectLevel", value)
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-8 text-xs w-full justify-center border",
                            item.defectLevel && defectLevelConfig[item.defectLevel].selectClass
                          )}
                        >
                          <SelectValue placeholder="选择" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="CR">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-destructive" />
                              <span className="font-bold text-destructive">CR</span>
                              <span className="text-xs text-muted-foreground">严重</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="MA">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-warning" />
                              <span className="font-medium text-warning">MA</span>
                              <span className="text-xs text-muted-foreground">主要</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="MI">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                              <span className="text-muted-foreground">MI</span>
                              <span className="text-xs text-muted-foreground">次要</span>
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* AQL 抽样水准 */}
                    <TableCell>
                      <Select
                        value={item.aqlLevel}
                        onValueChange={(value) =>
                          updateItem(item.id, "aqlLevel", value)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs w-full justify-center font-mono border-border bg-transparent hover:bg-input">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {aqlLevels.map((level) => (
                            <SelectItem key={level} value={level} className="font-mono">
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* 图示 */}
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {item.imageUrl ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button
                                className="relative group/img w-10 h-10 rounded-lg border border-border overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
                                onClick={() => setPreviewImage(item.imageUrl)}
                              >
                                <img
                                  src={item.imageUrl}
                                  alt="检验图示"
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl bg-card border-border">
                              <DialogHeader>
                                <DialogTitle>检验图示预览</DialogTitle>
                              </DialogHeader>
                              <div className="flex items-center justify-center p-4">
                                <img
                                  src={item.imageUrl}
                                  alt="检验图示"
                                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <div className="w-10 h-10 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground bg-secondary/30">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={(el) => { fileInputRefs.current[item.id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(item.id, file);
                          }}
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => fileInputRefs.current[item.id]?.click()}
                            >
                              <Upload className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover border-border">上传图片</TooltipContent>
                        </Tooltip>
                        {item.imageUrl && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => updateItem(item.id, "imageUrl", "")}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-popover border-border">删除图片</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>

                    {/* 操作 */}
                    <TableCell>
                      <div className="flex items-center justify-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
                              onClick={() => moveItem(item.id, "up")}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover border-border">上移</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
                              onClick={() => moveItem(item.id, "down")}
                              disabled={index === items.length - 1}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover border-border">下移</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteItem(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover border-border">删除</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 底部添加按钮 */}
        {items.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-secondary/20">
            <Button
              onClick={addItem}
              variant="outline"
              size="sm"
              className="w-full h-9 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5"
            >
              <Plus className="h-4 w-4 mr-2" />
              添加检验项
              <span className="text-[10px] text-muted-foreground/60 ml-2">Add New Item</span>
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
