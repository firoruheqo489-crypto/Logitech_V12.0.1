"use client"

import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface DisciplineCardProps {
  disciplineNumber: string
  title: string
  children: ReactNode
  className?: string
}

export function DisciplineCard({
  disciplineNumber,
  title,
  children,
  className,
}: DisciplineCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-md p-5 mb-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-border pb-3 mb-4">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded bg-primary/10 text-primary font-mono font-bold text-lg">
          {disciplineNumber}
        </span>
        <h2 className="text-primary font-bold text-lg tracking-wide">
          {title}
        </h2>
      </div>
      <div className="text-card-foreground leading-relaxed">{children}</div>
    </div>
  )
}
