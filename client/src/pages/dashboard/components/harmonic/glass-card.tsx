import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HarmonicGlassCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-white/[0.06] bg-white/[0.025] p-4 shadow-[0_6px_24px_rgba(0,0,0,0.65)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}
