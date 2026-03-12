"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type AdminSubmitButtonProps = Omit<ButtonProps, "children"> & {
  idleLabel: ReactNode;
  pendingLabel: ReactNode;
};

export function AdminSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  disabled,
  ...props
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      className={cn("min-w-[10rem]", className)}
      disabled={disabled || pending}
      {...props}
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      <span>{pending ? pendingLabel : idleLabel}</span>
    </Button>
  );
}
