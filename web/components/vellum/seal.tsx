import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SealGlyph({ className, children = "▓▓▓▓" }: { className?: string; children?: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-cipher-500/25 bg-cipher-500/15 px-2 py-1 font-mono text-[12px] text-cipher-400 [font-variant-numeric:tabular-nums]",
        className,
      )}
    >
      <LockKeyhole className="size-3 stroke-[1.7]" />
      <span className="seal-text leading-none">{children}</span>
    </span>
  );
}

export function MachineValue({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("font-mono [font-variant-numeric:tabular-nums]", className)}>{children}</span>;
}

export function StateDot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-1.5 rounded-full", className)} />;
}
