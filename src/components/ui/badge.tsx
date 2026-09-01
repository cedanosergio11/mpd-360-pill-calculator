import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary",
        muted: "border-border bg-muted text-muted-foreground",
        warn: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
        danger: "border-transparent bg-destructive/15 text-destructive",
        ok: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
