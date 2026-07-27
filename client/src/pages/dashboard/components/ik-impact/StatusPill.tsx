import { Check, MinusCircle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StatusValue } from "./ik-test-data";

interface StatusPillProps {
  label: string;
  // value 表示“是否存在该缺陷”。false = 无缺陷，true = 有缺陷，null = 未勾选。
  value: StatusValue;
  className?: string;
}

export function StatusPill({ label, value, className }: StatusPillProps) {
  const isGood = value === false;
  const isBad = value === true;
  const isUnchecked = value === null;
  const stateLabel = isGood ? "正常" : isBad ? "异常" : "未勾选";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3",
        isGood && "border-success/30 bg-success/5",
        isBad && "border-destructive/30 bg-destructive/5",
        isUnchecked && "border-dashed border-border bg-muted/30",
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium",
          isGood && "text-success",
          isBad && "text-destructive",
          isUnchecked && "text-muted-foreground",
        )}
      >
        {isGood && <Check className="size-4" aria-hidden="true" />}
        {isBad && <X className="size-4" aria-hidden="true" />}
        {isUnchecked && <MinusCircle className="size-4" aria-hidden="true" />}
        {stateLabel}
      </span>
    </div>
  );
}
