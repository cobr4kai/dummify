import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-accent/35 bg-accent-soft/80 text-highlight",
        muted: "border-border/70 bg-muted/70 text-muted-foreground",
        highlight: "border-highlight/25 bg-highlight-soft/85 text-highlight",
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
