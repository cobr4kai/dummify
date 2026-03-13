import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "field-control min-h-[120px] w-full rounded-2xl px-4 py-3 text-sm",
        className,
      )}
      {...props}
    />
  );
}
