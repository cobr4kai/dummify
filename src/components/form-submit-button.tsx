"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function FormSubmitButton({
  idleLabel,
  pendingLabel,
  disabled,
  ...props
}: Omit<ButtonProps, "children"> & {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      disabled={disabled || pending}
      {...props}
    >
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
