import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  unit,
  hint,
  children,
  className,
}: {
  label: string;
  unit?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-pretty">{label}</Label>
        {unit ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function NumberField({
  label,
  unit,
  value,
  onChange,
  hint,
  step = "any",
  disabled,
}: {
  label: string;
  unit?: string;
  value: number | "";
  onChange: (v: number | "") => void;
  hint?: string;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} unit={unit} hint={hint}>
      <Input
        type="number"
        step={step}
        inputMode="decimal"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") onChange("");
          else {
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : "");
          }
        }}
        className={cn(disabled && "bg-muted text-muted-foreground")}
      />
    </Field>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <Field label={label}>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="group border-b border-border last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        {title}
        <span className="inline-block text-muted-foreground transition-transform duration-150 group-open:rotate-180">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </summary>
      <div className="grid gap-3 px-4 pb-4">{children}</div>
    </details>
  );
}
