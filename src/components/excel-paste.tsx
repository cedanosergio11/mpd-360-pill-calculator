import { useState } from "react";
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
import { applyWellPaste, parseWellPaste } from "@/lib/calc/paste";
import { useAppStore } from "@/lib/store";

export function ExcelPasteButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputs = useAppStore((s) => s.inputs);
  const setInputs = useAppStore((s) => s.setInputs);

  function apply(raw: string) {
    const { patch, matched } = parseWellPaste(raw);
    if (matched.length === 0) {
      toast.error("Nothing mapped. Copy the Well Information block (labels + values) from the Inputs sheet.");
      return false;
    }
    setInputs(applyWellPaste(inputs, patch));
    toast.success(`Pasted ${matched.length} field${matched.length === 1 ? "" : "s"} from Excel`);
    setText("");
    setOpen(false);
    return true;
  }

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste from Excel</DialogTitle>
            <DialogDescription>
              Copy the Well Information block on the Inputs sheet (Well name through FIT / SafeVision ECD)
              and paste it here. Tab-separated rows from Excel work as-is.
            </DialogDescription>
          </DialogHeader>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const html = e.clipboardData.getData("text/html");
              const plain = e.clipboardData.getData("text/plain");
              const clip = /<t[rdh]/i.test(html) ? html : plain;
              if (clip.trim()) {
                e.preventDefault();
                apply(clip);
              }
            }}
            placeholder={"Well name\tMomentum 5-12-12 HU2\nClient\tPaloma/Apex\nSpot Depth (MD)\t11527"}
            className="mt-1 min-h-40 w-full rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => apply(text)} disabled={!text.trim()}>
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
