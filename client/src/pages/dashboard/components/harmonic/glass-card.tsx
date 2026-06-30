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
        "bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.9)] rounded-2xl p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}
