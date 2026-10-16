import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  digits?: number;
  suffix?: string;
};

export function SimNumberField({
  id,
  label,
  hint,
  value,
  onCommit,
  min,
  max,
  step = 1,
  digits = 0,
  suffix,
}: Props) {
  const format = (n: number) => (Number.isFinite(n) ? n.toFixed(digits) : "");
  const [text, setText] = useState(format(value));

  useEffect(() => {
    setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, digits]);

  function commit() {
    const next = Number(text);
    if (!Number.isFinite(next)) {
      setText(format(value));
      return;
    }
    let bounded = next;
    if (min != null) bounded = Math.max(min, bounded);
    if (max != null) bounded = Math.min(max, bounded);
    onCommit(bounded);
    setText(format(bounded));
  }

  return (
    <div className="min-w-0">
      <Label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {suffix ? <span className="font-normal text-muted-foreground">{suffix}</span> : null}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className={cn("font-mono")}
      />
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
