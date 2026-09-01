import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-[border-color,box-shadow] duration-150",
        "placeholder:text-muted-foreground/70 file:border-0 file:bg-transparent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "tabular-nums",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
