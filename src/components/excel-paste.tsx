import { useRef, useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toUiErrors } from "@/components/paste-errors";
import { applyPaste, previewPaste, type PastePreview, type PastePreviewError } from "@/lib/calc/paste";
import { useAppStore } from "@/lib/store";

/** Title before the line. The TVD codes have none: their sentence is the whole message. */
const CODE_TITLE: Partial<Record<PastePreviewError["code"], string>> = {
  BAD_NUMBER: "Not a number",
  DEPTH_BEYOND_TD: "Depth past TD or below the bit",
};

function show(value: unknown): string {
  if (value === "" || value == null) return "(blank)";
  if (typeof value === "boolean") return value ? "On" : "Off";
  return String(value);
}


/** The TVD fields the 1.0.7.1 paste carries (Code Ninja's contract). */
const PASTE_TVDS = [
  ["anchorTvd", "Anchor point TVD"],
  ["casingTvd", "Casing shoe TVD"],
  ["spotTvd", "Spot depth TVD"],
] as const;

export function ExcelPasteButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PastePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const applying = useRef(false);
  const inputs = useAppStore((s) => s.inputs);
  const setInputs = useAppStore((s) => s.setInputs);

  function runPreview(raw: string) {
    setPreview(raw.trim() ? previewPaste(inputs, raw) : null);
  }

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setText("");
      setPreview(null);
    }
  }

  function apply() {
    if (applying.current || !preview || !preview.canApply || preview.rows.length === 0) return;
    applying.current = true;
    setBusy(true);
    try {
      // Re-preview against the current store so a stale preview is never applied.
      const fresh = previewPaste(useAppStore.getState().inputs, text);
      if (!fresh.canApply) {
        setPreview(fresh);
        return;
      }
      setInputs(applyPaste(useAppStore.getState().inputs, fresh));
      const count = fresh.rows.length;
      toast.success(`Pasted ${count} field${count === 1 ? "" : "s"} from Excel`);
      close(false);
    } finally {
      applying.current = false;
      setBusy(false);
    }
  }

  const refused = !!preview && !preview.canApply;
  const uiErrors = toUiErrors(preview?.errors);
  const flagged = new Set<string>(uiErrors.flatMap((e) => e.highlight));
  const empty = !!preview && preview.canApply && preview.rows.length === 0;
  const canApply = !!preview && preview.canApply && preview.rows.length > 0 && !busy;

  return (
    <>
      <Button
        type="button"
        variant={compact ? "secondary" : "outline"}
        size={compact ? "icon" : "sm"}
        className={compact ? undefined : "h-9 w-full justify-start gap-2"}
        aria-label="Paste from Excel"
        onClick={() => setOpen(true)}
      >
        <ClipboardPaste className="size-4" />
        {compact ? null : <span>Paste from Excel</span>}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Paste from Excel</DialogTitle>
            <DialogDescription>
              Copy the Well Information block on the Inputs sheet (Well name through FIT / SafeVision ECD)
              and paste it here. Review the preview, then Apply. Nothing changes until you Apply.
            </DialogDescription>
          </DialogHeader>
          <textarea
            autoFocus
            value={text}
            data-paste-text
            onChange={(e) => {
              setText(e.target.value);
              runPreview(e.target.value);
            }}
            onPaste={(e) => {
              const html = e.clipboardData.getData("text/html");
              const plain = e.clipboardData.getData("text/plain");
              const clip = /<t[rdh]/i.test(html) ? html : plain;
              if (clip.trim()) {
                e.preventDefault();
                setText(clip);
                runPreview(clip);
              }
            }}
            placeholder={"Well name\tEXAMPLE\nSpot Depth (MD)\t11527\nAnchor point MD\t10480"}
            className="mt-1 min-h-32 w-full rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring"
          />

          {refused ? (
            <div role="alert" data-paste-refused className="mt-3 rounded-xl border border-destructive/60 bg-destructive/15 px-3 py-2 text-sm break-words">
              <p className="font-semibold text-destructive">Paste refused — nothing was applied</p>
              {uiErrors.length > 1 ? <p className="text-xs text-muted-foreground">{uiErrors.length} problems</p> : null}
              <ul id="paste-errors" className="mt-1 list-disc space-y-1 pl-5">
                {uiErrors.flatMap((error, i) =>
                  error.lines.map((line, j) => (
                    <li key={`${i}-${j}`} data-paste-error={error.code}>
                      {CODE_TITLE[error.code as PastePreviewError["code"]] ? <span className="font-medium">{CODE_TITLE[error.code as PastePreviewError["code"]]}: </span> : null}
                      {line}
                    </li>
                  )),
                )}
              </ul>
            </div>
          ) : null}
          {empty ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing mapped. Copy the Well Information block (labels + values) from the Inputs sheet.
            </p>
          ) : null}

          {preview ? (
            <div data-paste-tvds className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs">
              <p className="font-medium">TVDs in this paste</p>
              <ul className="mt-1 grid gap-0.5">
                {PASTE_TVDS.map(([field, label]) => {
                  const found = preview.foundTvds[field];
                  const bad = flagged.has(field);
                  return (
                    <li
                      key={field}
                      data-paste-tvd={field}
                      data-found={found ? "yes" : "no"}
                      data-invalid={bad ? "true" : undefined}
                      aria-invalid={bad || undefined}
                      aria-describedby={bad ? "paste-errors" : undefined}
                      className={`flex flex-wrap gap-x-2 rounded ${bad ? "-mx-1 bg-destructive/15 px-1 ring-1 ring-destructive" : ""}`}
                    >
                      <span className={found ? "font-semibold text-foreground" : "font-semibold text-destructive"}>{found ? "Found" : "Missing"}</span>
                      <span>{label}</span>
                      {bad ? <span className="font-semibold text-destructive">Error</span> : null}
                    </li>
                  );
                })}
                <li data-paste-tvd="bitTvd" data-found="no" className="flex flex-wrap gap-x-2 text-muted-foreground">
                  <span className="font-semibold">Not in sheet</span>
                  <span>Bit TVD (the 1.0.7.1 paste has none)</span>
                </li>
              </ul>
            </div>
          ) : null}

          {preview && preview.rows.length ? (
            <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-border">
              <table className="w-full table-fixed text-xs">
                <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="w-[44%] px-2 py-1.5 font-medium">Field</th>
                    <th className="px-2 py-1.5 font-medium">Now</th>
                    <th className="px-2 py-1.5 font-medium">Pasted</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr
                      key={String(row.field)}
                      data-invalid={flagged.has(row.field) ? "true" : undefined}
                      aria-invalid={flagged.has(row.field) || undefined}
                      aria-describedby={flagged.has(row.field) ? "paste-errors" : undefined}
                      className={`border-t border-border ${flagged.has(row.field) ? "bg-destructive/15 outline outline-1 -outline-offset-1 outline-destructive" : ""}`}
                    >
                      <td className="px-2 py-1 break-words">{row.label}</td>
                      <td className="px-2 py-1 font-mono break-all text-muted-foreground">{show(row.oldValue)}</td>
                      <td className={`px-2 py-1 font-mono break-all ${row.changed ? "font-semibold" : "text-muted-foreground"}`}>
                        {show(row.newValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="button" data-paste-apply onClick={apply} disabled={!canApply} aria-disabled={!canApply}>
              {busy ? "Applying…" : refused ? "Apply (refused)" : "Apply"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
