import { cn } from "@/lib/utils";

/** Two letter-stems with a wellbore, pipe, and KMW pill between them. */
export function WellboreLl({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 76 100"
      className={cn("inline-block overflow-visible", className)}
      aria-hidden="true"
    >
      <rect x="14" y="2" width="48" height="96" className="fill-fluid" />
      <rect x="14" y="40" width="48" height="22" className="fill-pill" />
      <rect x="34" y="2" width="8" height="80" className="fill-pipe" />
      <path d="M34 82 H42 L38 94 Z" className="fill-pipe" />
      <rect x="0" y="0" width="14" height="100" className="fill-current" />
      <rect x="62" y="0" width="14" height="100" className="fill-current" />
    </svg>
  );
}

export function BrandWordmark({
  className,
  wordmarkClassName,
}: {
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-semibold tracking-tight text-foreground",
        className,
      )}
      aria-label="PillView"
      role="img"
    >
      <span aria-hidden="true">Pi</span>
      <WellboreLl
        className={cn(
          "mx-[0.03em] h-[0.70em] w-[0.532em] self-baseline",
          wordmarkClassName,
        )}
      />
      <span aria-hidden="true">View</span>
    </span>
  );
}

export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" className="fill-background" />
      <rect x="11" y="4" width="10" height="24" className="fill-fluid" />
      <rect x="11" y="13" width="10" height="6" className="fill-pill" />
      <rect x="14.5" y="4" width="3" height="20" className="fill-pipe" />
      <path d="M14.5 24 H17.5 L16 28 Z" className="fill-pipe" />
      <rect x="7" y="4" width="4" height="24" className="fill-foreground" />
      <rect x="21" y="4" width="4" height="24" className="fill-foreground" />
    </svg>
  );
}
