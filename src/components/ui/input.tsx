import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "field-control h-11 w-full rounded-2xl px-4 text-sm",
        className,
      )}
      {...props}
    />
  );
}
