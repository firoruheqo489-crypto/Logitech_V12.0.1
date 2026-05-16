"use client";

import { AlertTriangle, ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from "lucide-react";

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createClientId } from "@/lib/create-client-id";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import type { InspectionItem } from "./types";

interface InspectionTableProps {
  items: InspectionItem[];
  onUpdate: (items: InspectionItem[]) => void;
}

const UNSET_DEFECT_LEVEL = "__unset_defect_level__";
const UNSET_AQL_LEVEL = "__unset_aql_level__";
const MAX_INSPECTION_ITEMS = 8;

const defectLevelConfig = {
  CR: {
    selectClass: "bg-destructive/20 text-destructive border-destructive/30",
  },
  MA: {
    selectClass: "bg-warning/20 text-warning border-warning/30",
  },
  MI: {
    selectClass: "bg-muted text-muted-foreground border-border",
  },
  "": {
    selectClass: "text-muted-foreground border-border",
  },
} as const;

const aqlLevels = ["0", "0.065", "0.1", "0.15", "0.25", "0.4", "0.65", "1.0", "1.5", "2.5", "4.0", "6.5"];

export function InspectionTable({ items, onUpdate }: InspectionTableProps) {
  const updateItem = (id: string, field: keyof InspectionItem, value: string | number) => {
    onUpdate(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const addItem = () => {
    if (items.length >= MAX_INSPECTION_ITEMS) {
      toast.error(`SIP \u6700\u591a\u53ea\u80fd\u7ef4\u62a4 ${MAX_INSPECTION_ITEMS} \u6761\u68c0\u9a8c\u9879\u76ee`);
      return;
    }

    const newItem: InspectionItem = {
      id: createClientId("sip"),
      sequence: items.length + 1,
      inspectionItem: "",
      specification: "",
      lsl: "",
      usl: "",
      measurementTool: "",
      defectLevel: "",
      aqlLevel: "",
    };

    onUpdate([...items, newItem]);
  };

  const deleteItem = (id: string) => {
    onUpdate(
      items
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sequence: index + 1 })),
    );
  };

  const moveItem = (id: string, direction: "up" | "down") => {
    const index = items.findIndex((item) => item.id === id);
    if ((direction === "up" && index === 0) || (direction === "down" && index === items.length - 1)) {
      return;
    }

    const nextItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];

    onUpdate(nextItems.map((item, itemIndex) => ({ ...item, sequence: itemIndex + 1 })));
  };

  return (
    <TooltipProvider>
      <div className="sip-panel overflow-hidden border border-border bg-card">
        <div className="sip-panel-header flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-2">
          <div className="flex items-center gap-2.5">
            <span className="text-[9px] font-medium uppercase tracking-widest text-primary">
              SECTION B
            </span>
            <span className="text-muted-foreground/50">|</span>
            <h2 className="text-[13px] font-medium text-foreground">
              {"\u68c0\u9a8c\u9879\u76ee\u6e05\u5355"}
            </h2>
            <span className="text-[11px] text-muted-foreground">Inspection Items List</span>
            <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] text-muted-foreground">
              {"\u6700\u591a 8 \u9879"}
            </span>
          </div>

          <Button
            onClick={addItem}
            size="sm"
            disabled={items.length >= MAX_INSPECTION_ITEMS}
            className="sip-toolbar-btn gap-1.5 border border-primary/20 bg-primary/10 px-3.5 text-xs text-primary hover:bg-primary/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {"\u65b0\u589e\u68c0\u9a8c\u9879"}
            <span className="ml-1 text-[9px] text-primary/60">Add Item</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-secondary/50 hover:bg-secondary/50">
                <TableHead className="w-[64px] px-2 text-center">
                  <div className="sip-table-head">
                    {"\u5e8f\u53f7"}
                    <span className="sip-table-sub">No.</span>
                  </div>
                </TableHead>
                <TableHead className="min-w-[132px]">
                  <div className="sip-table-head">
                    {"\u68c0\u9a8c\u9879\u76ee"}
                    <span className="sip-table-sub">Item</span>
                  </div>
                </TableHead>
                <TableHead className="min-w-[152px]">
                  <div className="sip-table-head">
                    {"\u89c4\u683c\u6807\u51c6"}
                    <span className="sip-table-sub">Spec</span>
                  </div>
                </TableHead>
                <TableHead className="w-[80px] px-2 text-center">
                  <div className="sip-table-head">
                    LSL
                    <span className="sip-table-sub">Lower</span>
                  </div>
                </TableHead>
                <TableHead className="w-[80px] px-2 text-center">
                  <div className="sip-table-head">
                    USL
                    <span className="sip-table-sub">Upper</span>
                  </div>
                </TableHead>
                <TableHead className="min-w-[116px]">
                  <div className="sip-table-head">
                    {"\u6d4b\u91cf\u5de5\u5177"}
                    <span className="sip-table-sub">Tool</span>
                  </div>
                </TableHead>
                <TableHead className="w-[96px] px-2 text-center">
                  <div className="sip-table-head">
                    {"\u7f3a\u9677\u7b49\u7ea7"}
                    <span className="sip-table-sub">Level</span>
                  </div>
                </TableHead>
                <TableHead className="w-[88px] px-2 text-center">
                  <div className="sip-table-head">
                    AQL
                    <span className="sip-table-sub">Sampling</span>
                  </div>
                </TableHead>
                <TableHead className="w-[96px] px-2 text-center">
                  <div className="sip-table-head">
                    {"\u64cd\u4f5c"}
                    <span className="sip-table-sub">Actions</span>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-28 text-center">
                    <div className="flex flex-col items-center gap-2.5 text-muted-foreground">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/50">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium">
                          {"\u6682\u65e0\u68c0\u9a8c\u9879\u76ee"}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">No Inspection Items</p>
                      </div>
                      <Button
                        onClick={addItem}
                        variant="outline"
                        size="sm"
                        className="mt-1.5 h-7 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        {"\u65b0\u589e\u7b2c\u4e00\u9879"}
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
                      item.defectLevel === "CR" &&
                        "border-l-2 border-l-destructive bg-destructive/5 hover:bg-destructive/10",
                    )}
                  >
                    <TableCell className="sip-row-cell-tight text-center">
                      <div
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-mono font-bold",
                          item.defectLevel === "CR"
                            ? "border border-destructive/30 bg-destructive/20 text-destructive"
                            : "border border-primary/20 bg-primary/10 text-primary",
                        )}
                      >
                        {item.sequence}
                      </div>
                    </TableCell>

                    <TableCell className="sip-row-cell">
                      <Input
                        value={item.inspectionItem}
                        onChange={(event) => updateItem(item.id, "inspectionItem", event.target.value)}
                        placeholder="\u8bf7\u8f93\u5165\u68c0\u9a8c\u9879\u76ee"
                        className="sip-field sip-field-compact border-transparent bg-transparent text-[12px] hover:border-border focus:border-primary focus:bg-input"
                      />
                    </TableCell>

                    <TableCell className="sip-row-cell">
                      <Input
                        value={item.specification}
                        onChange={(event) => updateItem(item.id, "specification", event.target.value)}
                        placeholder="\u8bf7\u8f93\u5165\u89c4\u683c\u6807\u51c6"
                        className="sip-field sip-field-compact border-transparent bg-transparent text-[12px] hover:border-border focus:border-primary focus:bg-input"
                      />
                    </TableCell>

                    <TableCell className="sip-row-cell-tight">
                      <Input
                        value={item.lsl}
                        onChange={(event) => updateItem(item.id, "lsl", event.target.value)}
                        placeholder="--"
                        className="sip-field sip-field-compact border-transparent bg-transparent text-center font-mono text-[12px] hover:border-border focus:border-primary focus:bg-input"
                      />
                    </TableCell>

                    <TableCell className="sip-row-cell-tight">
                      <Input
                        value={item.usl}
                        onChange={(event) => updateItem(item.id, "usl", event.target.value)}
                        placeholder="--"
                        className="sip-field sip-field-compact border-transparent bg-transparent text-center font-mono text-[12px] hover:border-border focus:border-primary focus:bg-input"
                      />
                    </TableCell>

                    <TableCell className="sip-row-cell">
                      <Input
                        value={item.measurementTool}
                        onChange={(event) => updateItem(item.id, "measurementTool", event.target.value)}
                        placeholder="\u8bf7\u8f93\u5165\u6d4b\u91cf\u5de5\u5177"
                        className="sip-field sip-field-compact border-transparent bg-transparent text-[12px] hover:border-border focus:border-primary focus:bg-input"
                      />
                    </TableCell>

                    <TableCell className="sip-row-cell-tight">
                      <Select
                        value={item.defectLevel || UNSET_DEFECT_LEVEL}
                        onValueChange={(value: "CR" | "MA" | "MI" | typeof UNSET_DEFECT_LEVEL) =>
                          updateItem(item.id, "defectLevel", value === UNSET_DEFECT_LEVEL ? "" : value)
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "sip-field sip-field-compact w-full justify-center border text-[11px]",
                            item.defectLevel
                              ? defectLevelConfig[item.defectLevel].selectClass
                              : defectLevelConfig[""].selectClass,
                          )}
                        >
                          <SelectValue placeholder="\u7b49\u7ea7" />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-popover">
                          <SelectItem value={UNSET_DEFECT_LEVEL}>{"\u672a\u8bbe\u7f6e"}</SelectItem>
                          <SelectItem value="CR">
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-destructive" />
                              <span className="font-bold text-destructive">CR</span>
                              <span className="text-[11px] text-muted-foreground">
                                {"\u4e25\u91cd"}
                              </span>
                            </span>
                          </SelectItem>
                          <SelectItem value="MA">
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-warning" />
                              <span className="font-medium text-warning">MA</span>
                              <span className="text-[11px] text-muted-foreground">
                                {"\u4e3b\u8981"}
                              </span>
                            </span>
                          </SelectItem>
                          <SelectItem value="MI">
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                              <span className="text-muted-foreground">MI</span>
                              <span className="text-[11px] text-muted-foreground">
                                {"\u6b21\u8981"}
                              </span>
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="sip-row-cell-tight">
                      <Select
                        value={item.aqlLevel || UNSET_AQL_LEVEL}
                        onValueChange={(value) =>
                          updateItem(item.id, "aqlLevel", value === UNSET_AQL_LEVEL ? "" : value)
                        }
                      >
                        <SelectTrigger className="sip-field sip-field-compact w-full justify-center border-border bg-transparent font-mono text-[11px] hover:bg-input">
                          <SelectValue placeholder="--" />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-popover">
                          <SelectItem value={UNSET_AQL_LEVEL}>{"\u672a\u8bbe\u7f6e"}</SelectItem>
                          {aqlLevels.map((level) => (
                            <SelectItem key={level} value={level} className="font-mono">
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="sip-row-cell-tight">
                      <div className="flex items-center justify-center gap-0.5 opacity-50 transition-opacity group-hover:opacity-100">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="sip-action-btn p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                              onClick={() => moveItem(item.id, "up")}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="border-border bg-popover">
                            {"\u4e0a\u79fb"}
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="sip-action-btn p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
                              onClick={() => moveItem(item.id, "down")}
                              disabled={index === items.length - 1}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="border-border bg-popover">
                            {"\u4e0b\u79fb"}
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="sip-action-btn p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => deleteItem(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="border-border bg-popover">
                            {"\u5220\u9664"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {items.length > 0 ? (
          <div className="border-t border-border bg-secondary/20 px-4 py-2.5">
            <Button
              onClick={addItem}
              variant="outline"
              size="sm"
              disabled={items.length >= MAX_INSPECTION_ITEMS}
              className="sip-toolbar-btn w-full border-dashed border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              {"\u7ee7\u7eed\u65b0\u589e\u68c0\u9a8c\u9879"}
              <span className="ml-2 text-[9px] text-muted-foreground/60">Add New Item</span>
            </Button>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
