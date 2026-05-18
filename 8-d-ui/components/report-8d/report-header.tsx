"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileDown, SendHorizontal } from "lucide-react"

interface ReportHeaderProps {
  reportNo: string
  customer: string
  product: string
  defectIssue: string
  dateOpened: string
  currentStatus: string
  statusVariant: "default" | "secondary" | "destructive" | "outline"
  champion: string
}

export function ReportHeader({
  reportNo,
  customer,
  product,
  defectIssue,
  dateOpened,
  currentStatus,
  statusVariant,
  champion,
}: ReportHeaderProps) {
  return (
    <div className="bg-card border border-border rounded-md p-5 mb-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <h1 className="text-xl lg:text-2xl font-bold tracking-widest text-foreground">
          8D 纠正措施报告
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <FileDown className="h-4 w-4" />
            导出 PDF
          </Button>
          <Button size="sm" className="gap-2">
            <SendHorizontal className="h-4 w-4" />
            提交审批
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            报告编号
          </span>
          <p className="font-mono font-medium text-foreground">{reportNo}</p>
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            客户
          </span>
          <p className="font-medium text-foreground">{customer}</p>
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            产品
          </span>
          <p className="font-medium text-foreground">{product}</p>
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            缺陷问题
          </span>
          <p className="font-medium text-destructive">{defectIssue}</p>
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            开案日期
          </span>
          <p className="font-mono font-medium text-foreground">{dateOpened}</p>
        </div>
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            当前状态
          </span>
          <Badge variant={statusVariant} className="mt-1">
            {currentStatus}
          </Badge>
        </div>
        <div className="space-y-1 lg:col-span-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            责任人/负责人
          </span>
          <p className="font-medium text-foreground">{champion}</p>
        </div>
      </div>
    </div>
  )
}
