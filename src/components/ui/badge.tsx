import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-border bg-border text-[var(--deep)]",
        muted: "border-border bg-border text-[var(--deep)]/85",
        highlight: "border-accent/30 bg-accent-soft text-foreground",
        success: "border-success/25 bg-success-soft/85 text-success",
        danger: "border-danger/25 bg-danger-soft/85 text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  children,
}: React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>{children}</span>
  );
}
