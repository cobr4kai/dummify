import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-accent-soft text-accent",
        muted: "bg-muted text-muted-foreground",
        highlight: "bg-highlight-soft text-highlight",
        success: "bg-success-soft text-success",
        danger: "bg-danger-soft text-danger",
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
