"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Calendar as CalendarIcon,
  GitBranch,
  Hash,
  Package,
  Pencil,
  Save,
  User,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { SIPMetaData, SIPStatus } from "./types";

interface SIPHeaderProps {
  data: SIPMetaData;
  onUpdate: (data: SIPMetaData) => void;
}

const statusConfig: Record<
  SIPStatus,
  {
    label: string;
    labelEn: string;
    className: string;
    dotClass: string;
  }
> = {
  draft: {
    label: "\u8349\u7a3f",
    labelEn: "DRAFT",
    className: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  },
  active: {
    label: "\u751f\u6548",
    labelEn: "ACTIVE",
    className: "bg-success/10 text-success border-success/30",
    dotClass: "bg-success animate-pulse",
  },
  obsolete: {
    label: "\u4f5c\u5e9f",
    labelEn: "OBSOLETE",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    dotClass: "bg-destructive",
  },
};

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value: string): string {
  if (!value) return "yyyy/mm/dd";
  return value.replace(/-/g, "/");
}

function formatVersionLabel(value: string): string {
  const normalized = value.trim() || "1.0";
  return normalized.startsWith("V") ? normalized : `V${normalized}`;
}

export function SIPHeader({ data, onUpdate }: SIPHeaderProps) {
  const [isEditing, setIsEditing] = useState(true);
  const [editData, setEditData] = useState(data);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  useEffect(() => {
    setEditData(data);
  }, [data]);

  const handleSave = () => {
    onUpdate(editData);
    setDatePopoverOpen(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(data);
    setDatePopoverOpen(false);
    setIsEditing(false);
  };

  return (
    <div className="sip-panel overflow-hidden rounded-lg border border-border bg-card">
      <div className="sip-panel-header flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[9px] font-medium uppercase tracking-widest text-primary">
            SECTION A
          </span>
          <span className="text-muted-foreground/50">|</span>
          <h2 className="text-[13px] font-medium text-foreground">
            {"\u0053\u0049\u0050 \u5143\u6570\u636e"}
          </h2>
          <span className="text-[11px] text-muted-foreground">Meta Information</span>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="sip-toolbar-btn h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                {"\u53d6\u6d88"}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="sip-toolbar-btn h-7 px-2.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="mr-1 h-3.5 w-3.5" />
                {"\u4fdd\u5b58"}
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="sip-toolbar-btn h-7 px-2.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {"\u7f16\u8f91"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3 px-4 py-3">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            <Hash className="h-3 w-3" />
            {"\u4ea7\u54c1\u7f16\u53f7"}
            <span className="text-muted-foreground/50">Product Code</span>
          </Label>
          {isEditing ? (
            <Input
              value={editData.productCode}
              onChange={(event) => setEditData({ ...editData, productCode: event.target.value })}
              className="sip-field bg-input text-[13px] border-border focus:border-primary focus:ring-primary"
            />
          ) : (
            <div className="flex h-8 items-center">
              <code className="rounded bg-primary/10 px-2.5 py-1 font-mono text-[13px] font-medium text-primary">
                {data.productCode}
              </code>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            <Package className="h-3 w-3" />
            {"\u4ea7\u54c1\u540d\u79f0"}
            <span className="text-muted-foreground/50">Product Name</span>
          </Label>
          {isEditing ? (
            <Input
              value={editData.productName}
              onChange={(event) => setEditData({ ...editData, productName: event.target.value })}
              className="sip-field bg-input text-[13px] border-border focus:border-primary focus:ring-primary"
            />
          ) : (
            <div className="flex h-8 items-center">
              <p className="text-[13px] font-medium text-foreground">{data.productName}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            {"\u7248\u672c\u53f7"}
            <span className="text-muted-foreground/50">Version</span>
          </Label>
          {isEditing ? (
            <Input
              value={editData.version}
              onChange={(event) => setEditData({ ...editData, version: event.target.value })}
              className="sip-field bg-input text-[13px] border-border focus:border-primary focus:ring-primary"
            />
          ) : (
            <div className="flex h-8 items-center">
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/5 font-mono text-[11px] text-primary"
              >
                {formatVersionLabel(data.version)}
              </Badge>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3 w-3" />
            {"\u72b6\u6001"}
            <span className="text-muted-foreground/50">Status</span>
          </Label>
          {isEditing ? (
            <Select
              value={editData.status}
              onValueChange={(value: SIPStatus) => setEditData({ ...editData, status: value })}
            >
              <SelectTrigger className="sip-field border-border bg-input text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover">
                <SelectItem value="draft">{"\u8349\u7a3f"}</SelectItem>
                <SelectItem value="active">{"\u751f\u6548"}</SelectItem>
                <SelectItem value="obsolete">{"\u4f5c\u5e9f"}</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-8 items-center">
              <Badge className={cn("flex items-center gap-1.5 border", statusConfig[data.status].className)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig[data.status].dotClass)} />
                {statusConfig[data.status].label}
                <span className="ml-0.5 text-[8px] opacity-60">{statusConfig[data.status].labelEn}</span>
              </Badge>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            <User className="h-3 w-3" />
            {"\u7f16\u5236\u4eba"}
            <span className="text-muted-foreground/50">Author</span>
          </Label>
          {isEditing ? (
            <Input
              value={editData.author}
              onChange={(event) => setEditData({ ...editData, author: event.target.value })}
              className="sip-field bg-input text-[13px] border-border focus:border-primary focus:ring-primary"
            />
          ) : (
            <div className="flex h-8 items-center">
              <p className="text-[13px] font-medium text-foreground">{data.author}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
            <CalendarIcon className="h-3 w-3" />
            {"\u751f\u6548\u65e5\u671f"}
            <span className="text-muted-foreground/50">Effective Date</span>
          </Label>
          {isEditing ? (
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "sip-field w-full justify-between border-border bg-input px-3 text-[13px] font-medium hover:bg-input",
                    !editData.effectiveDate && "text-muted-foreground",
                  )}
                >
                  <span>{formatDateDisplay(editData.effectiveDate)}</span>
                  <CalendarIcon className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-auto rounded-xl border-border bg-card p-0 shadow-2xl"
              >
                <DateCalendar
                  mode="single"
                  selected={parseDateValue(editData.effectiveDate)}
                  onSelect={(date) => {
                    if (!date) return;
                    setEditData({ ...editData, effectiveDate: formatDateValue(date) });
                    setDatePopoverOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="flex h-8 items-center">
              <p className="font-mono text-[13px] text-muted-foreground">{data.effectiveDate || "--"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
