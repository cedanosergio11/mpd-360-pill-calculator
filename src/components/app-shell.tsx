import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { jobLabel, loadPreset, restoreSaved, type PresetId } from "@/contract";
import { DisplacementScreen, ExportScreen, FitBanner, FluidsScreen, KpiScreen, StrokesScreen, TripScreen, WellScreen } from "@/components/screens";
import { EmwScreen } from "@/components/emw";
import { seeds } from "@/lib/seeds";
import { useEdited, useOutOfDate, useStore, worst } from "@/lib/store";
import { APP_VERSION } from "@/lib/version";

const tabs = [
  { id: "well", label: "1 Well setup", C: WellScreen },
  { id: "fluids", label: "2 Fluids", C: FluidsScreen },
  { id: "displacement", label: "3 Displacement & pill", C: DisplacementScreen },
  { id: "strokes", label: "4 Strokes", C: StrokesScreen },
  { id: "kpi", label: "5 KPI & volumes", C: KpiScreen },
  { id: "emw", label: "6 EMW profile", C: EmwScreen },
  { id: "trip", label: "7 Trip schedule", C: TripScreen },
  { id: "export", label: "8 Export", C: ExportScreen },
] as const;
type TabId = (typeof tabs)[number]["id"];

export function AppShell() {
  const { job, result, saved, loaded, load, save, run, replace } = useStore();
  const outOfDate = useOutOfDate();
  const edited = useEdited();
  const [tab, setTab] = useState<TabId>("well");
  const fileRef = useRef<HTMLInputElement>(null);
  /* Measured action-bar height → --action-bar-h, so main's bottom padding always clears the fixed bar (it wraps on narrow phones). */
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = barRef.current; if (!el) return;
    const setH = () => document.documentElement.style.setProperty("--action-bar-h", `${el.getBoundingClientRect().height}px`);
    setH(); const ro = new ResizeObserver(setH); ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);
  useEffect(() => {
    load();
    const t = new URLSearchParams(window.location.search).get("tab");
    if (tabs.some((x) => x.id === t)) setTab(t as TabId);
  }, [load]);
  const go = (t: TabId) => { setTab(t); const u = new URL(window.location.href); u.searchParams.set("tab", t); history.replaceState(null, "", u); };
  const w = worst(result?.issues);
  const Active = tabs.find((t) => t.id === tab)!.C;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(job, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${job.name.replace(/\W+/g, "_")}.pillview.json`; a.click();
  };
  const importJson = async (f: File) => {
    try {
      const restored = restoreSaved(await f.text());
      if (!restored) throw new Error("schemaVersion must be 1");
      if (!restored.ok) throw new Error("A tapered string cannot be restored on this branch.");
      replace(restored.job);
    } catch (e) { alert(`Import failed: ${(e as Error).message}`); }
  };
  if (!loaded) return <main className="p-4 text-sm text-muted-foreground">Loading…</main>;

  return (
    <main className="app-main min-h-screen">
      <div className="bg-danger px-3 py-1 text-center text-xs font-bold tracking-wide text-white print:hidden" role="alert">EXAMPLE inputs, math checked against API RP 13D examples, pending Sergio's field review</div>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs">
          <span className="font-semibold text-primary">PillView 2.0</span>
          <span className="font-mono text-muted-foreground">{APP_VERSION}</span>
          <span className="truncate font-semibold" data-testid="job-label">{jobLabel(job)}{edited && <span data-testid="edited-marker"> (edited)</span>}</span>
          <span className={`rounded px-1.5 py-0.5 ${saved ? "bg-backfill/20 text-backfill" : "bg-warn/20 text-warn"}`}>{saved ? "Saved" : "Unsaved"}</span>
          {outOfDate && <button onClick={run} className="rounded bg-warn px-1.5 py-0.5 font-semibold text-black">Out of date · recalc</button>}
          <span data-testid="worst-issue" className={`ml-auto truncate ${w?.level === "error" ? "text-danger" : w ? "text-warn" : "text-backfill"}`}>
            {w ? `${w.level === "error" ? "✖" : "▲"} ${w.message}` : "✓ No issues"}</span>
        </div>
        <nav className="tabs-scroll flex gap-1 overflow-x-auto px-2 pb-2">
          {tabs.map((t) => (
            <button key={t.id} data-tab={t.id} onClick={() => go(t.id)} className={`shrink-0 rounded-full border px-3 py-1 text-xs ${tab === t.id ? "border-primary bg-primary/25 text-foreground" : "text-muted-foreground"}`}>{t.label}</button>))}
        </nav>
      </header>
      <div className="mx-auto max-w-6xl space-y-3 p-3 sm:p-4">{tab !== "export" && <div className="print:hidden"><FitBanner /></div>}<Active /></div>
      <footer ref={barRef} data-testid="action-bar" className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-2 border-t bg-card px-3 py-2 text-xs print:hidden">
        <button onClick={save} className="rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground">Save</button>
        <button onClick={run} className="rounded-md border px-3 py-1.5">Calculate</button>
        <button onClick={exportJson} className="rounded-md border px-3 py-1.5">Export JSON</button>
        <button onClick={() => fileRef.current?.click()} className="rounded-md border px-3 py-1.5">Import JSON</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        <select data-testid="seed" aria-label="Load EXAMPLE seed" value="" onChange={(e) => { const id = e.target.value; if (id === "b" || id === "c") { replace(loadPreset(id.toUpperCase() as PresetId)); return; } const s = seeds.find((x) => x.id === id); if (s) replace(structuredClone(s.job)); }} className="rounded-md border bg-card px-2 py-1.5 text-muted-foreground">
          <option value="">Load EXAMPLE…</option>{seeds.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <Drawer.Root>
          <Drawer.Trigger className="ml-auto rounded-md border border-primary px-3 py-1.5 sm:hidden">Inputs</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
            <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t bg-background p-3">
              <Drawer.Title className="mb-2 text-sm font-semibold">Well inputs</Drawer.Title>
              <WellScreen />
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
        <span className="hidden font-mono text-muted-foreground sm:inline">{APP_VERSION} · calc {result?.calcVersion} · #{result?.inputHash}</span>
      </footer>
    </main>
  );
}
