"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-accent px-4 py-2 text-accent-foreground shadow-[var(--shadow-inset)] hover:-translate-y-0.5 hover:bg-[var(--cta-hover-bg)] hover:text-[var(--cta-hover-text)]",
        secondary:
          "surface-muted border border-border px-4 py-2 text-foreground hover:-translate-y-0.5 hover:bg-[var(--panel-bg)]",
        ghost:
          "px-3 py-2 text-muted-foreground hover:bg-[var(--muted-surface)] hover:text-foreground",
        danger:
          "border border-transparent bg-danger px-4 py-2 text-background shadow-[var(--shadow-inset)] hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--danger)_82%,black_18%)]",
      },
      size: {
        default: "h-10",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}
