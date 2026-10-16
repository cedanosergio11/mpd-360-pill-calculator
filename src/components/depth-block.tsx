import { OctagonAlert } from "lucide-react";
import { dFt } from "@/components/fmt";
import type { DepthField } from "@/lib/calc/types";

/** One blocked field in plain words with units and the fix. Never a raw field path. */
export function depthFieldSentence(field: DepthField): string {
  const value = `${dFt(field.value)} ft`;
  const limit = `${dFt(field.limit)} ft`;
  switch (field.limitLabel) {
    case "TD":
      return `${field.label} ${value} is past TD ${limit}. Enter a depth at or above ${limit}, or correct TD.`;
    case "bit MD":
      return `${field.label} ${value} is below the bit at ${limit} MD. Enter a depth at or above the bit, or correct the current well depth.`;
    case "bit TVD":
      return `${field.label} ${value} is below the bit at ${limit} TVD. Enter a depth at or above the bit TVD.`;
    default:
      return `${field.label} ${value} is past ${field.limitLabel} ${limit}.`;
  }
}

export function DepthBlockPanel({
  fields,
  title = "Depth block — the sheet is not calculated",
  note,
}: {
  fields: DepthField[];
  title?: string;
  note?: string;
}) {
  if (!fields.length) return null;
  return (
    <div
      role="alert"
      data-depth-block
      className="rounded-xl border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm break-words"
    >
      <p className="flex items-center gap-2 font-semibold text-destructive">
        <OctagonAlert className="size-4 shrink-0" />
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground">
        {fields.map((field, i) => (
          <li key={`${field.label}-${field.limitLabel}-${i}`}>{depthFieldSentence(field)}</li>
        ))}
      </ul>
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
