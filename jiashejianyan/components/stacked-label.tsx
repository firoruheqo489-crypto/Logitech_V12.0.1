import { cn } from "@/lib/utils"

interface StackedLabelProps {
  zh: string
  en: string
  className?: string
  align?: "left" | "center" | "right"
  size?: "sm" | "md" | "lg"
}

export function StackedLabel({
  zh,
  en,
  className,
  align = "left",
  size = "md",
}: StackedLabelProps) {
  const zhSize =
    size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm"
  return (
    <div
      className={cn(
        "flex flex-col leading-tight",
        align === "center" && "items-center text-center",
        align === "right" && "items-end text-right",
        className,
      )}
    >
      <span className={cn("font-semibold tracking-wide text-foreground", zhSize)}>
        {zh}
      </span>
      <span className="font-num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {en}
      </span>
    </div>
  )
}
