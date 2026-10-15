import { useMemo, useState } from "react";
import type { EmwError, EmwLineName, EmwPillState, EmwPoint, EmwProfileResult, EmwStation } from "@/contract";
import { emwProfile } from "@/contract";
import { Card } from "@/components/fields";
import { useStore } from "@/lib/store";

/* ---------- EMW profile: display only. Every number comes from emwProfile(calcJob).
   The only arithmetic here is mapping contract values to SVG pixels (axis scaling). ---------- */

type EmwNote = { code: string; field: string; message: string };
type Ok = Extract<EmwProfileResult, { ok: true }> & { notes?: EmwNote[] };

function useEmw(): EmwProfileResult | null {
  const job = useStore((s) => s.calcJob);
  return useMemo(() => (job ? emwProfile(job) : null), [job]);
}

const LINES: { k: EmwLineName; label: string; color: string }[] = [
  { k: "static", label: "Static", color: "var(--color-muted-foreground)" },
  { k: "staticSbp", label: "Static + SBP", color: "var(--color-pill)" },
  { k: "ecd", label: "ECD", color: "var(--color-kmw)" },
];
const STATE_LABEL: Record<EmwPillState, string> = { inPlace: "In place", spotted: "Spotted" };
const STATION_LABEL = { shoe: "Shoe", anchor: "Anchor", bit: "Bit" } as const;
type View = "inPlace" | "spotted" | "both";
const f = (v: number | null | undefined, d: number) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d));

const EmwErr = ({ e }: { e: EmwError }) => (
  <p data-emw-error={e.code} role="alert" className="text-xs text-danger">✖ {e.message} <span className="font-mono opacity-70">[{e.code} · {e.field}]</span></p>);

/** Notes from the contract; until `notes` ships, the pore note is shown from `limits.pore_ppg === null` (no calculation). */
function notesOf(p: Ok): EmwNote[] {
  if (p.notes) return p.notes;
  return p.limits.pore_ppg == null ? [{ code: "NO_PORE", field: "well.porePressure_ppg", message: "Pore line not shown: no pore value entered." }] : [];
}

/** Station labels for the chart: anchor + bit at the same TVD merge to one label (chart only). */
function chartStations(st: EmwStation[]): { label: string; tvd_ft: number }[] {
  const out: { label: string; tvd_ft: number }[] = [];
  for (const s of st) {
    const same = out.find((o) => o.tvd_ft === s.tvd_ft && /Anchor|Bit/.test(o.label) && s.label !== "shoe");
    if (same) same.label = "Anchor / bit";
    else out.push({ label: STATION_LABEL[s.label], tvd_ft: s.tvd_ft });
  }
  return out;
}

function Chart({ p, view, print }: { p: Ok; view: View; print?: boolean }) {
  const W = 640, H = 560, L = 70, R = 16, T = 32, B = 46;
  const states: EmwPillState[] = view === "both" ? ["inPlace", "spotted"] : [view];
  const all: EmwPoint[] = states.flatMap((s) => LINES.flatMap((l) => p[s].lines[l.k]));
  /* Axis window from station EMWs and limits only. Static+SBP EMW grows without bound toward surface,
     so lines are clipped to this window instead of stretching the axis. */
  const xs = [...p.stations.flatMap((s) => states.flatMap((st) => LINES.map((l) => s.emw[st][l.k]))), p.limits.fit_ppg, ...(p.limits.pore_ppg != null ? [p.limits.pore_ppg] : [])];
  const xMin = Math.floor(Math.min(...xs) * 2) / 2 - 0.5, xMax = Math.ceil(Math.max(...xs) * 2) / 2 + 0.5;
  const yMax = Math.max(...all.map((q) => q.tvd_ft), ...p.stations.map((s) => s.tvd_ft));
  const yTop = Math.ceil(yMax / 1000) * 1000;
  const X = (v: number) => L + ((v - xMin) / (xMax - xMin)) * (W - L - R);
  const Y = (v: number) => T + (v / yTop) * (H - T - B);
  const xt: number[] = []; for (let v = Math.ceil(xMin * 2) / 2; v <= xMax + 1e-9; v += 0.5) xt.push(v);
  const clipId = `emw-clip-${print ? "p" : "s"}`;
  const yt: number[] = []; for (let v = 0; v <= yTop; v += 1000) yt.push(v);
  const path = (pts: EmwPoint[]) => pts.map((q, i) => `${i ? "L" : "M"}${X(q.emw_ppg).toFixed(1)},${Y(q.tvd_ft).toFixed(1)}`).join("");
  const crossings = p.crossings.filter((c) => states.includes(c.pillState));
  return (
    <svg data-testid="emw-chart" viewBox={`0 0 ${W} ${H}`} className={`mx-auto w-full max-w-[760px]`} role="img" aria-label="EMW versus TVD">
      {yt.map((v) => <g key={`y${v}`}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--color-border)" /><text x={L - 6} y={Y(v) + 3} textAnchor="end" fontSize="13" fill="var(--color-muted-foreground)">{v.toLocaleString("en-US")}</text></g>)}
      {xt.map((v) => <g key={`x${v}`}><line x1={X(v)} x2={X(v)} y1={T} y2={H - B} stroke="var(--color-border)" strokeOpacity={v % 1 ? 0.4 : 1} /><text x={X(v)} y={H - B + 14} textAnchor="middle" fontSize="13" fill="var(--color-muted-foreground)">{v % 1 ? "" : v.toFixed(0)}</text></g>)}
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize="14" fill="var(--color-muted-foreground)">EMW (ppg)</text>
      <text x={14} y={(T + H - B) / 2} textAnchor="middle" fontSize="14" fill="var(--color-muted-foreground)" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>TVD (ft)</text>
      <line data-emw-limit="fit" x1={X(p.limits.fit_ppg)} x2={X(p.limits.fit_ppg)} y1={T} y2={H - B} stroke="var(--color-danger)" strokeWidth="2" />
      <text x={X(p.limits.fit_ppg) + 4} y={T - 8} fontSize="13" fill="var(--color-danger)">FIT {f(p.limits.fit_ppg, 2)}</text>
      {p.limits.pore_ppg != null && <><line data-emw-limit="pore" x1={X(p.limits.pore_ppg)} x2={X(p.limits.pore_ppg)} y1={T} y2={H - B} stroke="var(--color-warn)" strokeWidth="2" strokeDasharray="2 3" />
        <text x={X(p.limits.pore_ppg) - 4} y={T - 8} textAnchor="end" fontSize="13" fill="var(--color-warn)">Pore {f(p.limits.pore_ppg, 2)}</text></>}
      <defs><clipPath id={clipId}><rect x={L} y={T} width={W - L - R} height={H - T - B} /></clipPath></defs>
      {states.map((s) => LINES.map((l) => <path clipPath={`url(#${clipId})`} key={s + l.k} data-emw-line={`${s}.${l.k}`} d={path(p[s].lines[l.k])} fill="none" stroke={l.color} strokeWidth="2" strokeDasharray={s === "spotted" && view === "both" ? "6 4" : undefined} />))}
      {chartStations(p.stations).map((s) => <g key={s.label} data-emw-station={s.label}><line x1={L} x2={W - R} y1={Y(s.tvd_ft)} y2={Y(s.tvd_ft)} stroke="var(--color-foreground)" strokeOpacity="0.35" strokeDasharray="3 3" />
        <text x={W - R - 4} y={Y(s.tvd_ft) - 4} textAnchor="end" fontSize="13" fill="var(--color-foreground)">{s.label} · {s.tvd_ft.toLocaleString("en-US")} ft</text></g>)}
      {crossings.map((c, i) => <g key={i} data-emw-crossing={i}><circle cx={X(c.limit === "fit" ? p.limits.fit_ppg : p.limits.pore_ppg ?? 0)} cy={Y(c.tvd_ft)} r="5" fill="none" stroke="var(--color-danger)" strokeWidth="2" />
        <text x={X(c.limit === "fit" ? p.limits.fit_ppg : p.limits.pore_ppg ?? 0) + 7} y={Y(c.tvd_ft) + 3} fontSize="13" fontWeight="700" fill="var(--color-danger)">{i + 1}</text></g>)}
      {notesOf(p).map((n, i) => <text key={n.code} data-emw-note={n.code} x={L + 6} y={H - B - 8 - i * 14} fontSize="13" fontStyle="italic" fill="var(--color-muted-foreground)">{n.message}</text>)}
    </svg>);
}

function Legend({ view }: { view: View }) {
  return (<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
    {LINES.map((l) => <span key={l.k} className="inline-flex items-center gap-1"><svg width="22" height="6"><line x1="0" x2="22" y1="3" y2="3" stroke={l.color} strokeWidth="2" /></svg>{l.label}</span>)}
    {view === "both" && <span className="inline-flex items-center gap-1"><svg width="22" height="6"><line x1="0" x2="22" y1="3" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" /></svg>Spotted (dashed)</span>}
    <span className="inline-flex items-center gap-1 text-danger"><svg width="22" height="6"><line x1="11" x2="11" y1="0" y2="6" stroke="currentColor" strokeWidth="2" /></svg>FIT</span>
    <span className="inline-flex items-center gap-1 text-danger">○ crossing</span>
  </div>);
}

function Crossings({ p }: { p: Ok }) {
  if (!p.crossings.length) return <p data-testid="emw-crossings" className="text-xs text-muted-foreground">No line crosses the FIT or pore limit.</p>;
  return (<ol data-testid="emw-crossings" className="list-decimal space-y-0.5 pl-5 text-xs">{p.crossings.map((c, i) => (
    <li key={i} data-emw-crossing-row={i} className="text-danger">{LINES.find((l) => l.k === c.line)?.label} ({STATE_LABEL[c.pillState]}) crosses {c.limit === "fit" ? "FIT" : "pore"} at <span className="font-mono">{c.tvd_ft.toLocaleString("en-US")} ft TVD</span></li>))}</ol>);
}

function StationTable({ p }: { p: Ok }) {
  const cols: [EmwPillState, EmwLineName][] = (["inPlace", "spotted"] as const).flatMap((s) => LINES.map((l): [EmwPillState, EmwLineName] => [s, l.k]));
  return (<div className="overflow-x-auto"><table data-testid="emw-stations" className="procedure-table w-full min-w-[560px] text-right font-mono text-xs">
    <thead className="text-muted-foreground">
      <tr><th className="px-2 text-left font-normal" rowSpan={2}>Station</th><th className="px-2 font-normal" rowSpan={2}>MD (ft)</th><th className="px-2 font-normal" rowSpan={2}>TVD (ft)</th>
        <th className="border-b px-2 text-center font-normal" colSpan={3}>In place (ppg)</th><th className="border-b px-2 text-center font-normal" colSpan={3}>Spotted (ppg)</th></tr>
      <tr>{cols.map(([s, k]) => <th key={s + k} className="border-b px-2 font-normal">{LINES.find((l) => l.k === k)?.label}</th>)}</tr>
    </thead>
    <tbody>{p.stations.map((st) => (
      <tr key={st.label} data-emw-station-row={st.label} className="border-b border-border/50 [&>td]:px-2 [&>td]:py-1">
        <td className="text-left">{STATION_LABEL[st.label]}</td><td>{st.md_ft.toLocaleString("en-US")}</td><td>{st.tvd_ft.toLocaleString("en-US")}</td>
        {cols.map(([s, k]) => <td key={s + k} data-emw-cell={`${st.label}.${s}.${k}`}>{f(st.emw[s][k], 6)}</td>)}</tr>))}</tbody>
  </table></div>);
}

function ViewToggle({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (<div className="flex gap-1 print:hidden">{(["inPlace", "spotted", "both"] as const).map((v) => (
    <button key={v} data-emw-view={v} onClick={() => setView(v)} className={`rounded-md border px-2 py-1 text-xs ${view === v ? "border-primary bg-primary/20" : ""}`}>{v === "both" ? "Both" : STATE_LABEL[v]}</button>))}</div>);
}

export function EmwScreen() {
  const r = useEmw();
  const [view, setView] = useState<View>("both");
  if (!r) return null;
  if (!r.ok) return <Card title="EMW profile"><EmwErr e={r.error} /><p className="mt-2 text-xs text-muted-foreground">No profile until this input is fixed, then Calculate.</p></Card>;
  const p = r as Ok;
  return (<div className="space-y-3">
    <Card title="EMW vs TVD" right={<ViewToggle view={view} setView={setView} />}>
      <div className="overflow-x-auto"><Chart p={p} view={view} /></div>
      <Legend view={view} />
    </Card>
    <Card title="Limit crossings"><Crossings p={p} /></Card>
    <Card title="Stations"><StationTable p={p} /></Card>
  </div>);
}

export function EmwPrint() {
  const r = useEmw();
  if (!r) return null;
  return (<section className="emw-print kpi-print mb-3">
    <h3 className="mb-1 font-semibold">EMW profile{r.ok ? " · in place solid, spotted dashed" : " · not available"}</h3>
    {r.ok ? <><div className="print-avoid"><Chart p={r as Ok} view="both" print /><Legend view="both" /></div>
      <h4 className="kpi-print-h mt-2 text-xs font-semibold">Limit crossings</h4><Crossings p={r as Ok} />
      <h4 className="kpi-print-h mt-2 text-xs font-semibold">Stations</h4><StationTable p={r as Ok} /></> : <EmwErr e={r.error} />}
  </section>);
}
