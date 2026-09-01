import { useMemo, useState } from "react";
import {
  ChevronDown,
  Download,
  FileText,
  Menu,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InputPanel } from "@/components/input-panel";
import { KpiBar } from "@/components/kpi-bar";
import { ProcedureDoc } from "@/components/procedure-doc";
import { ScheduleView } from "@/components/schedule-view";
import { DisplacementView } from "@/components/displacement-view";
import { CementView } from "@/components/cement-view";
import { AuditView } from "@/components/audit-view";
import { PressureWindow } from "@/components/pressure-window";
import { SimulatorView } from "@/components/simulator-view";
import { ExcelPasteButton } from "@/components/excel-paste";
import { BrandGlyph, BrandWordmark } from "@/components/brand-mark";
import { calculate, collectWarnings, buildSchedule, scheduleToCsv } from "@/lib/calc";
import { PRESETS } from "@/lib/calc/examples";
import { useAppStore, type WorkspaceTab } from "@/lib/store";
import { useSimulator } from "@/lib/pill/store";
import { slugify } from "@/lib/utils";
import { RELEASES, formatVersion } from "@/lib/version";

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "simulator", label: "Simulator" },
  { id: "procedure", label: "Procedure" },
  { id: "schedule", label: "Schedule" },
  { id: "displacement", label: "Displacement" },
  { id: "cement", label: "Cement" },
  { id: "audit", label: "Audit" },
];

export function AppShell() {
  const inputs = useAppStore((s) => s.inputs);
  const tabRaw = useAppStore((s) => s.tab);
  const tab = TABS.some((t) => t.id === tabRaw) ? tabRaw : "simulator";
  const setTab = useAppStore((s) => s.setTab);
  const setField = useAppStore((s) => s.setField);
  const loadPreset = useAppStore((s) => s.loadPreset);
  const reset = useAppStore((s) => s.reset);
  const saveScenario = useAppStore((s) => s.saveScenario);
  const loadScenario = useAppStore((s) => s.loadScenario);
  const deleteScenario = useAppStore((s) => s.deleteScenario);
  const scenarios = useAppStore((s) => s.scenarios);
  const [drawer, setDrawer] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);

  const results = useMemo(() => calculate(inputs), [inputs]);
  const schedule = useMemo(() => buildSchedule(inputs, results), [inputs, results]);
  const warnings = useMemo(() => collectWarnings(inputs, results), [inputs, results]);
  const errorCount = warnings.filter((w) => w.level === "error").length;
  const simDirty = useSimulator((s) => s.dirty);

  function exportCsv() {
    if (!schedule.rows.length) {
      toast.error("Nothing to export yet.");
      return;
    }
    const csv = scheduleToCsv(schedule.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const well = slugify(inputs.wellName || "mpd-360");
    a.href = url;
    a.download = `PILLVIEW-${well}-${inputs.pillMode === "withSlug" ? "with-slug" : "no-slug"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Schedule exported.");
  }

  function printProcedure() {
    const prev = document.title;
    const well = slugify(inputs.wellName || "procedure");
    document.title = `PILLVIEW-${well}-${inputs.pillMode === "withSlug" ? "with-slug" : "no-slug"}`;
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{ className: "border-border bg-card text-card-foreground" }}
      />
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <header className="print:hidden sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawer(true)} aria-label="Open inputs">
              <Menu />
            </Button>
            <div className="flex min-w-0 items-center gap-2.5">
              <BrandGlyph className="size-8 shrink-0" />
              <div className="min-w-0">
                <BrandWordmark className="text-sm sm:text-base" />
                <div className="truncate text-[11px] text-muted-foreground">
                  Procedure & simulator
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <div className="hidden rounded-full border border-border p-0.5 md:inline-flex">
                {(["noSlug", "withSlug"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setField("pillMode", mode)}
                    className={
                      inputs.pillMode === mode
                        ? "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                        : "rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    }
                    data-pill-mode={mode}
                  >
                    {mode === "noSlug" ? "No slug" : "With slug"}
                  </button>
                ))}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="hidden sm:inline-flex">
                    Load well
                    <ChevronDown className="opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[16rem]">
                  {scenarios.length > 0 ? (
                    <>
                      <DropdownMenuLabel>Saved wells</DropdownMenuLabel>
                      {scenarios.map((s) => (
                        <DropdownMenuItem
                          key={s.id}
                          className="items-start justify-between gap-2"
                          onSelect={() => {
                            loadScenario(s.id);
                            toast.success(`Loaded ${s.name}`);
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{s.name}</span>
                            <span className="block text-[10px] text-muted-foreground">
                              {new Date(s.savedAt).toLocaleString()}
                            </span>
                          </span>
                          <button
                            type="button"
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                            aria-label={`Delete ${s.name}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteScenario(s.id);
                              toast("Deleted saved well");
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuLabel>Workbook examples</DropdownMenuLabel>
                  {PRESETS.map((p) => (
                    <DropdownMenuItem key={p.id} onClick={() => { loadPreset(p.inputs); toast.success(`Loaded ${p.label}`); }}>
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { reset(); toast("Inputs cleared"); }}>
                    <RotateCcw /> Reset blank
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <ExcelPasteButton compact />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Save well"
                    onClick={() => {
                      setSaveName(inputs.wellName || "Untitled well");
                      setSaveOpen(true);
                    }}
                  >
                    <Save />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save well</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="icon" aria-label="Export CSV" onClick={exportCsv}>
                    <Download />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export schedule CSV</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="default" size="sm" onClick={printProcedure}>
                    <Printer />
                    <span className="hidden sm:inline">Print</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Print field procedure</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex gap-2 px-3 pb-2 md:hidden">
            {(["noSlug", "withSlug"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setField("pillMode", mode)}
                className={
                  inputs.pillMode === mode
                    ? "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    : "rounded-full border border-border px-3 py-1.5 text-xs font-medium"
                }
              >
                {mode === "noSlug" ? "No slug" : "With slug"}
              </button>
            ))}
          </div>
          {simDirty ? (
            <div className="print:hidden flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm sm:px-4">
              <p>
                <span className="font-medium text-foreground">Sim ≠ procedure.</span>{" "}
                <span className="text-muted-foreground">
                  Pipe or pill on the schematic is off the field sheet. Print still uses the procedure.
                </span>
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  useSimulator.getState().placeFromProcedure(inputs, results);
                  toast.success("Simulator reset from procedure");
                }}
              >
                <RotateCcw className="size-4" />
                From procedure
              </Button>
            </div>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="print:hidden hidden w-[22rem] shrink-0 overflow-y-auto border-r border-border bg-card lg:block">
            <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Inputs</div>
              <div className="mt-0.5 truncate text-sm font-medium">{inputs.wellName || "New well"}</div>
            </div>
            <InputPanel />
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="print:hidden mx-auto max-w-[92rem] space-y-4 px-3 py-4 sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {inputs.client || "Client"} · {inputs.date}
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                    {inputs.wellName || "Pill procedure"}
                  </h1>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                  <button
                    type="button"
                    className="font-mono tabular-nums tracking-wide hover:text-foreground"
                    onClick={() => setNotesOpen(true)}
                    aria-label="Open release notes"
                  >
                    {formatVersion()}
                  </button>
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5" />
                    {errorCount ? `${errorCount} issue${errorCount === 1 ? "" : "s"} to review` : "Ready for review"}
                  </div>
                </div>
              </div>

              {tab === "simulator" ? null : <KpiBar inputs={inputs} results={results} />}

              <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    data-workspace-tab={t.id}
                    className={
                      tab === t.id
                        ? "rounded-lg bg-background px-3 py-2 text-sm font-medium shadow-sm"
                        : "rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "simulator" ? (
                <SimulatorView inputs={inputs} results={results} />
              ) : null}
              {tab === "procedure" ? (
                <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
                  <ProcedureDoc inputs={inputs} results={results} schedule={schedule} />
                  <div className="print:hidden space-y-4">
                    <PressureWindow inputs={inputs} results={results} />
                    <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Before PDF</p>
                      <ul className="mt-2 list-disc space-y-1 pl-4">
                        <li>Confirm well name, client, date, and author.</li>
                        <li>Spot depth in step 4 matches the request.</li>
                        <li>Last KMW rate stays under FIT at the shoe — pump it in SafeVision.</li>
                        <li>Hide leftover schedule rows (already trimmed here).</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
              {tab === "schedule" ? <ScheduleView inputs={inputs} results={results} schedule={schedule} /> : null}
              {tab === "displacement" ? <DisplacementView inputs={inputs} results={results} /> : null}
              {tab === "cement" ? <CementView inputs={inputs} results={results} /> : null}
              {tab === "audit" ? <AuditView inputs={inputs} results={results} warnings={warnings} /> : null}
            </div>

            <div className="hidden print:block">
              <ProcedureDoc inputs={inputs} results={results} schedule={schedule} />
            </div>
          </main>
        </div>

        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent side="left" className="overflow-y-auto pt-12">
            <InputPanel />
          </SheetContent>
        </Sheet>

        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save well</DialogTitle>
              <DialogDescription>
                Stored on this device. Saving with the same name overwrites that well.
              </DialogDescription>
            </DialogHeader>
            <label className="mt-2 block text-xs font-medium text-muted-foreground" htmlFor="save-well-name">
              Name
            </label>
            <Input
              id="save-well-name"
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const label = saveName.trim() || inputs.wellName || "Untitled well";
                  saveScenario(label);
                  setSaveOpen(false);
                  toast.success(`Saved ${label}`);
                }
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const label = saveName.trim() || inputs.wellName || "Untitled well";
                  saveScenario(label);
                  setSaveOpen(false);
                  toast.success(`Saved ${label}`);
                }}
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
          <DialogContent className="max-h-[min(80vh,36rem)] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Release notes</DialogTitle>
              <DialogDescription>
                PillView {formatVersion()} · {RELEASES.length} releases
              </DialogDescription>
            </DialogHeader>
            <ol className="mt-3 space-y-4">
              {RELEASES.map((rel) => (
                <li key={rel.version} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-medium tabular-nums">v {rel.version}</span>
                    <span className="text-[11px] text-muted-foreground">{rel.date}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium">{rel.title}</div>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {rel.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
