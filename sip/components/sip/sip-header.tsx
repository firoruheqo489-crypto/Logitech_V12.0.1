"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Save, X, Hash, Package, GitBranch, User, Calendar, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SIPMetaData {
  productCode: string;
  productName: string;
  version: string;
  status: "draft" | "active" | "obsolete";
  author: string;
  effectiveDate: string;
}

interface SIPHeaderProps {
  data: SIPMetaData;
  onUpdate: (data: SIPMetaData) => void;
}

const statusConfig = {
  draft: {
    label: "草稿",
    labelEn: "DRAFT",
    className: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  },
  active: {
    label: "生效",
    labelEn: "ACTIVE",
    className: "bg-success/10 text-success border-success/30",
    dotClass: "bg-success animate-pulse",
  },
  obsolete: {
    label: "作废",
    labelEn: "OBSOLETE",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    dotClass: "bg-destructive",
  },
};

export function SIPHeader({ data, onUpdate }: SIPHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(data);

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(data);
    setIsEditing(false);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Section 标题 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium tracking-widest text-primary uppercase">
            SECTION A
          </span>
          <span className="text-muted-foreground/50">|</span>
          <h2 className="text-sm font-medium text-foreground">
            SIP 元数据
          </h2>
          <span className="text-xs text-muted-foreground">
            Meta Information
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="h-7 px-2.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                保存
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              编辑
            </Button>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="grid grid-cols-6 gap-4 p-4">
        {/* 产品编号 */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Hash className="h-3 w-3" />
            产品编号
            <span className="text-muted-foreground/50">Product Code</span>
          </Label>
          {isEditing ? (
            <Input
              value={editData.productCode}
              onChange={(e) =>
                setEditData({ ...editData, productCode: e.target.value })
              }
              className="h-9 text-sm bg-input border-border focus:border-primary focus:ring-primary"
            />
          ) : (
            <div className="h-9 flex items-center">
              <code className="text-sm font-mono font-medium text-primary bg-primary/10 px-2.5 py-1 rounded">
                {data.productCode}
              </code>
            </div>
          )}
        </div>

        {/* 产品名称 */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3 w-3" />
            产品名称
            <span className="text-muted-foreground/50">Product Name</span>
          </Label>
          {isEditing ? (
            <Input
              value={editData.productName}
              onChange={(e) =>
                setEditData({ ...editData, productName: e.target.value })
              }
              className="h-9 text-sm bg-input border-border focus:border-primary focus:ring-primary"
            />
          ) : (
            <div className="h-9 flex items-center">
              <p className="text-sm font-medium text-foreground">{data.productName}</p>
            </div>
          )}
        </div>

        {/* 版本号 */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" />
            版本号
            <span className="text-muted-foreground/50">Version</span>
          </Label>
          {isEditing ? (
            <Input
              value={editData.version}
              onChange={(e) =>
                setEditData({ ...editData, version: e.target.value })
              }
              className="h-9 text-sm bg-input border-border focus:border-primary focus:ring-primary"
            />
          ) : (
            <div className="h-9 flex items-center">
              <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-primary/5">
                v{data.version}
              </Badge>
            </div>
          )}
        </div>

        {/* 状态 */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            状态
            <span className="text-muted-foreground/50">Status</span>
          </Label>
          {isEditing ? (
            <Select
              value={editData.status}
              onValueChange={(value: "draft" | "active" | "obsolete") =>
                setEditData({ ...editData, status: value })
              }
            >
              <SelectTrigger className="h-9 text-sm bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="active">生效</SelectItem>
                <SelectItem value="obsolete">作废</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="h-9 flex items-center">
              <Badge className={cn("flex items-center gap-1.5 border", statusConfig[data.status].className)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig[data.status].dotClass)} />
                {statusConfig[data.status].label}
                <span className="text-[9px] opacity-60 ml-0.5">
                  {statusConfig[data.status].labelEn}
                </span>
              </Badge>
            </div>
          )}
        </div>

        {/* 编制人 */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <User className="h-3 w-3" />
            编制人
            <span className="text-muted-foreground/50">Author</span>
          </Label>
          {isEditing ? (
            <Input
              value={editData.author}
              onChange={(e) =>
                setEditData({ ...editData, author: e.target.value })
              }
              className="h-9 text-sm bg-input border-border focus:border-primary focus:ring-primary"
            />
          ) : (
            <div className="h-9 flex items-center">
              <p className="text-sm font-medium text-foreground">{data.author}</p>
            </div>
          )}
        </div>

        {/* 生效日期 */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            生效日期
            <span className="text-muted-foreground/50">Effective Date</span>
          </Label>
          {isEditing ? (
            <Input
              type="date"
              value={editData.effectiveDate}
              onChange={(e) =>
                setEditData({ ...editData, effectiveDate: e.target.value })
              }
              className="h-9 text-sm bg-input border-border focus:border-primary focus:ring-primary"
            />
          ) : (
            <div className="h-9 flex items-center">
              <p className="text-sm font-mono text-muted-foreground">
                {data.effectiveDate || "—"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
