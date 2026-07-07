import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-none",
  {
    variants: {
      variant: {
        default: "border-border-hairline bg-surface-raised text-text-secondary",
        cipher: "border-cipher-500/30 bg-cipher-500/15 text-cipher-300",
        reveal: "border-reveal-500/30 bg-reveal-500/10 text-reveal-300",
        settle: "border-settle-500/30 bg-settle-500/10 text-settle-400",
        flow: "border-flow-500/30 bg-flow-500/10 text-flow-400",
        danger: "border-danger-500/30 bg-danger-500/10 text-danger-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
