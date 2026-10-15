import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo, useState, type ReactNode } from "react";
import type { KpiError, KpiVolumesResult, PoohFillValue, DepthKey, PumpError, Result, StageCount, StrokesScheduleResult, TripLimit, TripScheduleRow } from "@/contract";
import { HAS_PIPE_COLUMN, isCalcRefusal, jobLabel, kpiVolumes, strokesSchedule } from "@/contract";
import { getPath } from "@/lib/paths";
import { Card, fmt, Grid, IssueList, NumField } from "@/components/fields";
import { issuesFor, useCalcEdited, useStore } from "@/lib/store";
import { APP_VERSION } from "@/lib/version";
import { EmwPrint, rihShoeNote, useEmwProfile } from "@/components/emw";

export function WellScreen() {
  const job = useStore((s) => s.job);
  const set = useStore((s) => s.set);
  const issues = useStore((s) => s.result?.issues);
  return (
    <div className="space-y-3">
      <Card title="Job">
        <Grid>
          <label className="col-span-2 block"><span className="text-[11px] uppercase tracking-wide text-muted-foreground">Job name</span>
            <input data-path="name" className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={job.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="col-span-2 block"><span className="text-[11px] uppercase tracking-wide text-muted-foreground">Displacement mode</span>
            <div className="mt-0.5 flex gap-1">{(["withDP", "noDP"] as const).map((m) => (
              <button key={m} onClick={() => set("mode", m)} className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${job.mode === m ? "border-primary bg-primary/20" : ""}`}>{m === "withDP" ? "With DP" : "No DP"}</button>))}</div></label>
        </Grid>
      </Card>
      <Card title="Depths">
        <Grid>
          <NumField path="well.mdTd_ft" label="TD MD" unit="ft" /><NumField path="well.tvdTd_ft" label="TD TVD" unit="ft" />
          <NumField path="well.bitMd_ft" label="Bit MD" unit="ft" />
          <NumField path="well.shoeMd_ft" label="Shoe MD" unit="ft" /><NumField path="well.shoeTvd_ft" label="Shoe TVD" unit="ft" />
          <NumField path="well.anchorMd_ft" label="Anchor MD" unit="ft" /><NumField path="well.anchorTvd_ft" label="Anchor TVD" unit="ft" optional />
        </Grid>
      </Card>
      <Card title="Pressure window">
        <Grid>
          <NumField path="well.fit_ppg" label="FIT" unit="ppg" /><NumField path="well.porePressure_ppg" label="Pore pressure" unit="ppg" optional />
          <NumField path="well.targetEmw_ppg" label="Anchor target EMW" unit="ppg" optional />
        </Grid>
      </Card>
      <Card title="Geometry" right={<button className="rounded border px-2 py-0.5 text-xs" onClick={() => set(`well.casing[${job.well.casing.length}]`, { topMd_ft: 0, bottomMd_ft: 0, id_in: 0, liner: true })}>+ section</button>}>
        <Grid>
          <NumField path="well.openHoleId_in" label="Open hole ID" unit="in" />
          <NumField path="well.stringOd_in" label="String OD" unit="in" /><NumField path="well.stringId_in" label="String ID" unit="in" />
        </Grid>
        <div className="mt-3 space-y-2">{job.well.casing.map((c, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 rounded-md border p-2">
            <div className="col-span-3 text-[11px] text-muted-foreground">Section {i + 1}{c.liner ? " (liner)" : ""}</div>
            <NumField path={`well.casing[${i}].topMd_ft`} label="Top MD" unit="ft" />
            <NumField path={`well.casing[${i}].bottomMd_ft`} label="Bottom MD" unit="ft" />
            <NumField path={`well.casing[${i}].id_in`} label="ID" unit="in" />
          </div>))}</div>
        <p className="mt-2 text-[11px] text-muted-foreground">Survey: {job.well.survey?.length ? `${job.well.survey.length} points` : "none (TVD interpolated)"}</p>
        <IssueList issues={issuesFor(issues, "well.survey")} />
      </Card>
    </div>
  );
}

function ColumnEditor({ path, title }: { path: "column" | "pipeColumn"; title: string }) {
  const job = useStore((s) => s.job);
  const set = useStore((s) => s.set);
  const issues = useStore((s) => s.result?.issues);
  const rows = job[path] ?? [];
  const add = () => { const last = rows[rows.length - 1]; set(`${path}[${rows.length}]`, { fluidId: job.fluids[0]?.id ?? "", topMd_ft: last?.bottomMd_ft ?? 0, bottomMd_ft: last?.bottomMd_ft ?? 0 }); };
  const remove = (i: number) => set(path, rows.filter((_, k) => k !== i));
  return (
    <Card title={title} right={<button data-add={path} className="rounded border px-2 py-0.5 text-xs" onClick={add}>+ interval</button>}>
      <div className="space-y-2">{rows.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2">
          <label className="block"><span className="text-[11px] uppercase tracking-wide text-muted-foreground">Fluid</span>
            <select data-path={`${path}[${i}].fluidId`} className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={c.fluidId} onChange={(e) => set(`${path}[${i}].fluidId`, e.target.value)}>
              {job.fluids.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
            <IssueList issues={issuesFor(issues, `${path}[${i}].fluidId`)} /></label>
          <NumField path={`${path}[${i}].topMd_ft`} label="Top MD" unit="ft" />
          <NumField path={`${path}[${i}].bottomMd_ft`} label="Bottom MD" unit="ft" />
          <button aria-label="Remove interval" onClick={() => remove(i)} className="mt-5 rounded border px-2 py-1.5 text-xs text-muted-foreground">✕</button>
        </div>))}
        {!rows.length && <p className="text-xs text-muted-foreground">No intervals.</p>}
      </div>
      <IssueList issues={issuesFor(issues, path)} />
    </Card>
  );
}

const fannKeys = ["r600", "r300", "r200", "r100", "r6", "r3"] as const;
export function FluidsScreen() {
  const job = useStore((s) => s.job);
  const set = useStore((s) => s.set);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        {job.fluids.map((f, i) => (
          <Card key={f.id} title={f.label} right={<span className="font-mono text-[11px] text-muted-foreground">fluids[{i}]</span>}>
            <div className="grid grid-cols-2 gap-3">
              <NumField path={`fluids[${i}].density_ppg`} label="Density" unit="ppg" />
              <NumField path={`fluids[${i}].gel10m_lbf100ft2`} label="10-min gel" unit="lbf/100ft²" optional />
              {fannKeys.map((k) => <NumField key={k} path={`fluids[${i}].fann.${k}`} label={`Fann ${k.slice(1)} rpm`} unit="°" />)}
            </div>
          </Card>))}
      </div>
      <ColumnEditor path="column" title="Annulus column (surface → TD, MD)" />
      {HAS_PIPE_COLUMN && <ColumnEditor path="pipeColumn" title="Pipe column (inside string, surface → bit, MD)" />}
    </div>
  );
}

type Lbl = { key: string; y: number; text: string; fill: string; ly?: number };
/** Label layout only: push labels apart by >= 11 px so close depths don't overlap. */
function declutter(ls: Lbl[]): Lbl[] {
  const out = [...ls].sort((a, b) => a.y - b.y).map((l) => ({ ...l, ly: l.y }));
  for (let i = 1; i < out.length; i++) if (out[i].ly - out[i - 1].ly < 11) out[i].ly = out[i - 1].ly + 11;
  return out;
}
function Label({ l, x, anchorX }: { l: Lbl; x: number; anchorX: number }) {
  const moved = Math.abs((l.ly ?? l.y) - l.y) > 0.5;
  return (<g>
    {moved && <line x1={anchorX} y1={l.y} x2={x < anchorX ? anchorX - 4 : x - 2} y2={l.ly} stroke={l.fill} strokeWidth="0.6" />}
    <text x={x} y={(l.ly ?? l.y) + 3} fontSize="9" fill={l.fill}>{l.text}</text>
  </g>);
}

function Ladder({ r }: { r: Result }) {
  const d = r.displacement, td = r.depths.td.md_ft || 1;
  const y = (md: number) => 20 + (md / td) * 400; // display scale only
  const shoe = r.depths.shoe.md_ft;
  return (
    <svg viewBox="0 0 220 440" className="mx-auto h-[380px] w-full max-w-[260px]" role="img" aria-label="Wellbore RIH ladder (EXAMPLE)">
      <rect x="70" y="20" width="80" height={y(shoe) - 20} fill="none" stroke="#93a09a" strokeWidth="3" />
      <rect x="78" y={y(shoe)} width="64" height={y(td) - y(shoe)} fill="var(--color-formation)" />
      {d.pillTopMd_ft != null && d.pillBottomMd_ft != null && <rect x="78" y={y(d.pillTopMd_ft)} width="64" height={y(d.pillBottomMd_ft) - y(d.pillTopMd_ft)} fill="var(--color-pill)" opacity="0.7" />}
      <line x1="60" x2="160" y1={y(shoe)} y2={y(shoe)} stroke="#e8ebe6" strokeDasharray="3 3" />
      {declutter([{ key: "shoe", y: y(shoe), text: `Shoe ${shoe} ft`, fill: "#e8ebe6" },
        ...(d.pillTopMd_ft != null ? [{ key: "pill", y: y(d.pillTopMd_ft), text: `Pill top ${d.pillTopMd_ft} ft`, fill: "var(--color-pill)" }] : [])])
        .map((l) => <Label key={l.key} l={l} x={162} anchorX={152} />)}
      {d.stages.map((s) => (
        <g key={s.n}>
          <line x1="104" x2="116" y1={y(s.bitMd_ft)} y2={y(s.bitMd_ft)} stroke="var(--color-pipe)" strokeWidth="3" />
        </g>))}
      {declutter(d.stages.map((s) => ({ key: `s${s.n}`, y: y(s.bitMd_ft), text: `#${s.n} ${s.bitMd_ft} ft`, fill: "var(--color-pipe)" })))
        .map((l) => <Label key={l.key} l={l} x={10} anchorX={68} />)}
      <rect x="107" y="20" width="6" height={y(d.stages[0]?.bitMd_ft ?? 0) - 20} fill="var(--color-pipe)" />
    </svg>
  );
}

function rihStageTitle(count: StageCount): string {
  return count.stages == null ? `RIH stages not available: ${count.reason}` : `RIH - minimum ${count.stages} stages needed`;
}

export function DisplacementScreen() {
  const r = useStore((s) => s.result);
  if (!r) return null;
  const d = r.displacement;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{rihStageTitle(d.minStagesRih)}</h2>
      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <Card title="Wellbore ladder"><Ladder r={r} /></Card>
        <div className="space-y-3">
          <Card title="Pill">
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {[["Pill volume", fmt(d.pillVolume_bbl, "bbl", 1)], ["Slug volume", fmt(d.slugVolume_bbl, "bbl", 1)],
                ["Pill top MD / TVD", `${num(d.pillTopMd_ft, 0)} / ${num(d.pillTopTvd_ft, 0)} ft`], ["Pill bottom MD / TVD", `${num(d.pillBottomMd_ft, 0)} / ${num(d.pillBottomTvd_ft, 0)} ft`]].map(([k, v]) => (
                <div key={k}><dt className="text-[11px] uppercase text-muted-foreground">{k}</dt><dd className="font-mono">{v}</dd></div>))}
            </dl>
          </Card>
          <Card title="Stages">
            <div className="overflow-x-auto">
              <table className="procedure-table w-full min-w-[720px] text-right font-mono text-xs">
                <thead className="text-muted-foreground"><tr>{["#", "Bit MD (ft)", "Pumped (bbl)", "SBP (psi)", "Shoe ESD hydrostatic (ppg)", "Shoe EMW incl. SBP (ppg)", `vs FIT ${num(r.depths.shoe.fit_ppg)} ppg`, "Anchor ESD (ppg)", "TD ESD (ppg)"].map((h) => <th key={h} className="border-b px-2 py-1 font-normal">{h}</th>)}</tr></thead>
                <tbody>{d.stages.map((s) => (
                  <tr key={s.n} className="border-b border-border/50"><td className="px-2 py-1">{s.n}</td><td className="px-2 py-1">{s.bitMd_ft}</td><td className="px-2 py-1"><Pumped v={s.pumped_bbl} /></td><td className="px-2 py-1">{num(s.sbp_psi, 0)}</td><td className="px-2 py-1">{num(s.shoeEsd_ppg)}</td><td className="px-2 py-1 font-semibold">{num(s.shoeEmw_ppg, 3)}</td><td className="px-2 py-1"><FitCmp n={s.n} /></td>{[num(s.anchorEsd_ppg), num(s.tdEsd_ppg)].map((v, k) => <td key={k} className="px-2 py-1">{v}</td>)}</tr>))}</tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Null-safe display: "—" for null, never 0. Formatting only. */
const num = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d));
const Pumped = ({ v }: { v: number | null }) => v == null ? <span className="text-warn">pending</span> : <span>{v.toFixed(1)}</span>;

/** EMW vs FIT per stage, decided by core: SHOE_ESD_AT_FIT.stages lists the stages at/above FIT. */
function FitCmp({ n }: { n: number }) {
  const issues = useStore((s) => s.result?.issues);
  const hit = (issues ?? []).some((i) => i.code === "SHOE_ESD_AT_FIT" && (i.stages ?? []).includes(n));
  return hit ? <span className="font-semibold text-danger">≥ FIT</span> : <span className="text-backfill">&lt; FIT</span>;
}

/** Red SDS-FRM-087 banner, driven only by core issue code SHOE_ESD_AT_FIT. */
export function FitBanner() {
  const issues = useStore((s) => s.result?.issues);
  const hits = (issues ?? []).filter((i) => i.code === "SHOE_ESD_AT_FIT");
  if (!hits.length) return null;
  return (
    <div data-testid="fit-banner" className="rounded-md border-2 border-danger bg-danger/20 p-2 text-sm text-danger" role="alert">
      <div className="font-bold">SDS-FRM-087 NOT ISSUABLE: shoe EMW (ESD + SBP) at or above FIT. Print locked.</div>
      <ul className="mt-1 list-disc pl-5 text-xs">{hits.map((h, i) => <li key={i}>{h.message}{h.stages?.length ? <span className="font-semibold"> · stages: {h.stages.join(", ")}</span> : null} <span className="font-mono opacity-70">[{h.field}]</span>{h.jobFields?.length ? <span className="font-mono opacity-70"> · inputs: {h.jobFields.join(", ")}</span> : null}</li>)}</ul>
    </div>);
}

const depthLabel: Record<DepthKey, string> = { shoe: "Shoe", anchor: "Anchor", td: "TD" };
const limitLabel: Record<TripLimit, string> = { FIT: "FIT", targetEmw: "Target EMW", pore: "Pore", none: "None" };
const limitColor: Record<TripLimit, string> = { FIT: "#c45c4a", targetEmw: "#6aa882", pore: "#c4a05a", none: "#93a09a" };
const LimitTag = ({ l }: { l: TripLimit }) => (
  <span className="rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold" style={{ color: l === "pore" ? "#0e1116" : limitColor[l], background: l === "pore" ? limitColor[l] : undefined, border: `1px solid ${limitColor[l]}` }}>{limitLabel[l]}</span>);
/** Depth display: whole feet with thousands separator (format only). */
const ft = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const Speed = ({ v }: { v: number | null }) => v == null
  ? <span className="font-semibold text-danger">no passing speed</span> : <span>{v} ft/min</span>;
const emw = (r: TripScheduleRow, k: "shoe" | "anchor" | "bit") => `${num(r.emwAt[k].surge_ppg)} / ${num(r.emwAt[k].swab_ppg)}`;

function TripTable({ rows: all, only, sel, onSel }: { rows: TripScheduleRow[]; only: number[]; sel: number; onSel: (i: number) => void }) {
  const rows = only.map((i) => all[i]);
  const head = ["Stage", "Dir", "From bit MD (ft)", "To bit MD (ft)", "Max speed (ft/min)", "Shoe surge/swab (ppg)", "Anchor surge/swab (ppg)", "Bit surge/swab (ppg)", "SBP static (psi)", "SBP required (psi)", "Limited by"];
  return (<>
    <table className="procedure-table hidden w-full text-right font-mono text-xs sm:table">
      <thead className="text-muted-foreground"><tr>{head.map((h) => <th key={h} className="border-b px-1.5 py-1 font-normal">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, j) => { const i = only[j]; return (
        <tr key={i} data-trip-row={i} onClick={() => onSel(i)} className={`[&>td]:px-1.5 cursor-pointer border-b border-border/50 ${sel === i ? "bg-primary/15" : ""}`}>
          <td className="px-1.5 py-1">{r.stage ?? "—"}</td><td>{r.direction}</td><td>{ft(r.fromBitMd_ft)}</td><td>{ft(r.toBitMd_ft)}</td>
          <td><Speed v={r.maxSpeed_ftmin} /></td><td>{emw(r, "shoe")}</td><td>{emw(r, "anchor")}</td><td>{emw(r, "bit")}</td>
          <td>{num(r.sbpStatic_psi, 0)}</td><td>{num(r.sbpRequired_psi, 0)}</td><td><LimitTag l={r.limitedBy} /></td></tr>); })}</tbody>
    </table>
    <div className="space-y-2 sm:hidden">{rows.map((r, j) => { const i = only[j]; return (
      <button key={i} data-trip-row={i} onClick={() => onSel(i)} className={`block w-full rounded-md border p-2 text-left text-xs ${sel === i ? "border-primary bg-primary/15" : ""}`}>
        <div className="mb-1 flex items-center justify-between"><span className="font-semibold">#{r.stage ?? "—"} {r.direction} · {ft(r.fromBitMd_ft)} → {ft(r.toBitMd_ft)} ft</span><LimitTag l={r.limitedBy} /></div>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono">
          <dt className="text-muted-foreground">Max speed</dt><dd><Speed v={r.maxSpeed_ftmin} /></dd>
          <dt className="text-muted-foreground">Shoe surge/swab</dt><dd>{emw(r, "shoe")} ppg</dd>
          <dt className="text-muted-foreground">Anchor surge/swab</dt><dd>{emw(r, "anchor")} ppg</dd>
          <dt className="text-muted-foreground">Bit surge/swab</dt><dd>{emw(r, "bit")} ppg</dd>
          <dt className="text-muted-foreground">SBP static / req.</dt><dd>{num(r.sbpStatic_psi, 0)} / {num(r.sbpRequired_psi, 0)} psi</dd>
        </dl>
      </button>); })}</div>
  </>);
}

const SurgeWarn = ({ msg }: { msg: string }) => (
  <div data-testid="surge-warn" className="rounded border border-warn bg-warn/15 px-2 py-1 text-xs text-warn">▲ {msg} <span className="font-mono opacity-70">[SHOE_SURGE_AT_FIT]</span></div>);
type Band = { dir: TripScheduleRow["direction"]; speed: number | null; idx: number[] };
/** Group contiguous rows by direction + maxSpeed. Grouping and max only, no hydraulics. */
function toBands(rows: TripScheduleRow[]): Band[] {
  const out: Band[] = [];
  rows.forEach((r, i) => {
    const b = out[out.length - 1];
    if (b && b.dir === r.direction && b.speed === r.maxSpeed_ftmin) b.idx.push(i);
    else out.push({ dir: r.direction, speed: r.maxSpeed_ftmin, idx: [i] });
  });
  return out;
}
const maxOf = (vals: (number | null)[]) => vals.reduce<number | null>((m, v) => (v == null ? m : m == null || v > m ? v : m), null);


function TripBands({ rows, fit, sel, onSel }: { rows: TripScheduleRow[]; fit: number | null; sel: number; onSel: (i: number) => void }) {
  const surge = useStore((s) => s.result?.issues)?.find((i) => i.code === "SHOE_SURGE_AT_FIT");
  // In-band by surge.stages (rows link via row.stage); falls back to limitedBy 'FIT' rows; global only if neither matches.
  const ss = surge?.stages ?? [];
  const inBand = (rs: TripScheduleRow[]) => ss.length ? rs.some((r) => r.stage != null && ss.includes(r.stage)) : rs.some((r) => r.limitedBy === "FIT");
  const anyFit = inBand(rows);
  return (<>
    {surge && !anyFit && <SurgeWarn msg={surge.message} />}
    <div className="space-y-2">{toBands(rows).map((b, k) => {
      const rs = b.idx.map((i) => rows[i]);
      const shoeMax = maxOf(rs.map((r) => r.emwAt.shoe.surge_ppg));
      const sbpMax = maxOf(rs.map((r) => r.sbpRequired_psi));
      return (
        <details key={k} data-band={k} open={b.idx.includes(sel)} className={`rounded-md border ${b.speed == null ? "border-danger" : rs.some((r) => r.limitedBy === "pore") ? "border-l-4 border-l-[#c4a05a]" : ""}`}>
          <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
            <span className="font-mono text-sm font-semibold">{b.dir} {ft(rs[0].fromBitMd_ft)} → {ft(rs[rs.length - 1].toBitMd_ft)} ft:{" "}
              {b.speed == null ? <span className="text-danger">no passing speed</span> : `${b.speed} ft/min`}</span>
            <span className="text-[11px] text-muted-foreground">{rs.length} step{rs.length > 1 ? "s" : ""}</span>
            {[...new Set(rs.map((r) => r.limitedBy))].filter((l) => l !== "none").map((l) => <LimitTag key={l} l={l} />)}
            <span className="basis-full font-mono text-[11px] text-muted-foreground">
              Worst: shoe surge EMW {num(shoeMax)} ppg vs FIT {num(fit)} ppg · max SBP required {num(sbpMax, 0)} psi</span>
          </summary>
          {surge && inBand(rs) && <div className="px-3 pb-2"><SurgeWarn msg={ss.length ? `${surge.message} Stages: ${ss.join(", ")}.` : surge.message} /></div>}
          <div className="border-t p-2"><TripTable rows={rows} only={b.idx} sel={sel} onSel={onSel} /></div>
        </details>);
    })}</div></>);
}

export function TripScreen() {
  const r = useStore((s) => s.result);
  const [sel, setSel] = useState(() => Math.max(0, r?.tripSchedule.findIndex((x) => x.maxSpeed_ftmin == null) ?? 0));
  if (!r) return null;
  const hl = r.tripSchedule[sel]?.limitedBy ?? "none";
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        {(Object.keys(r.depths) as DepthKey[]).map((k) => {
          const d = r.depths[k];
          const data = d.surge.map((p, i) => ({ speed: p.speed_ftmin, surge: p.emw_ppg, swab: d.swab[i]?.emw_ppg }));
          const lines = [["FIT", d.fit_ppg, "#c45c4a", "FIT"], ["Pore: entered at TD only", d.pore_ppg, "#c4a05a", "pore"], ["Target", d.targetEmw_ppg, "#6aa882", "targetEmw"]] as const;
          return (
            <Card key={k} title={`${depthLabel[k]} · ${d.md_ft} ft MD / ${num(d.tvd_ft, 0)} ft TVD`}>
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
                    <CartesianGrid stroke="#2a333c" />
                    <XAxis dataKey="speed" stroke="#93a09a" fontSize={10} padding={{ left: 8, right: 12 }} label={{ value: "Trip speed (ft/min)", fill: "#93a09a", fontSize: 10, position: "insideBottom", offset: -2 }} height={34} />
                    <YAxis stroke="#93a09a" fontSize={10} domain={["auto", "auto"]} unit=" ppg" width={62} />
                    <Tooltip contentStyle={{ background: "#1c222b", border: "1px solid #2a333c", fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line dataKey="surge" name="Surge EMW (ppg)" stroke="#b56a3c" dot />
                    <Line dataKey="swab" name="Swab EMW (ppg)" stroke="#4aa3c4" dot />
                    {lines.filter(([, v]) => v != null).map(([n, v, c, key]) => (
                      <ReferenceLine key={n} y={v as number} stroke={c} strokeWidth={hl === key ? 3 : 1} strokeOpacity={hl === "none" || hl === key ? 1 : 0.45} strokeDasharray={hl === key ? undefined : "4 3"}
                        label={{ value: `${n} · ${(v as number).toFixed(2)}`, fill: c, fontSize: 9, fontWeight: hl === key ? 700 : 400, position: "insideTopRight" }} />))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">ESD {fmt(d.esd_ppg, "ppg")} · ECD {fmt(d.ecd_ppg, "ppg")} · Pore {fmt(d.pore_ppg, "ppg")}</p>
            </Card>);
        })}
      </div>
      <Card title="Trip inputs">
        <Grid>
          <NumField path="trip.clinging" label="Clinging constant" unit="–" /><NumField path="trip.eccentricity" label="Eccentricity" unit="–" />
          <NumField path="trip.sbpConn_psi" label="SBP on connection" unit="psi" /><NumField path="trip.sbpCirc_psi" label="SBP circulating" unit="psi" />
          <NumField path="trip.flow_gpm" label="Flow rate" unit="gpm" /><NumField path="trip.standLength_ft" label="Stand length" unit="ft" />
        </Grid>
        <StandLengthErr />
      </Card>
      <Card title="Trip order (bands)" right={<span className="text-[11px] text-muted-foreground">Open a band, tap a step to highlight its limit</span>}>
        <TripBands rows={r.tripSchedule} fit={r.depths.shoe.fit_ppg} sel={sel} onSel={setSel} />
        <IssueList issues={issuesFor(r.issues, "trip.speeds_ftmin")} />
      </Card>
    </div>
  );
}


/* ---------- Strokes schedule: display only. All numbers come from strokesSchedule(). ---------- */
function useStrokes(): StrokesScheduleResult | null {
  const job = useStore((s) => s.job);
  const r = useStore((s) => s.result);
  if (!r) return null;
  const schedule = strokesSchedule(job, r);
  return isCalcRefusal(schedule) ? null : schedule;
}
const PumpErr = ({ e }: { e: PumpError }) => (
  <p data-pump-error={e.field} role="alert" className="mt-1 text-[11px] leading-snug text-danger">✖ {e.message} <span className="font-mono opacity-70">[{e.code}]</span></p>);

/** Pump input: blank → null (contract reports "is blank"); no conversion of entered values. */
function PumpField({ k, label, unit, hint, err }: { k: string; label: string; unit: string; hint?: string; err?: PumpError }) {
  const job = useStore((s) => s.job);
  const set = useStore((s) => s.set);
  const path = `pump.${k}`;
  const v = getPath(job, path);
  const [txt, setTxt] = useState<string | null>(null);
  const shown = txt ?? (typeof v === "number" && Number.isFinite(v) ? String(v) : "");
  return (
    <label className="block min-w-0">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className={`mt-0.5 flex items-center rounded-md border bg-background ${err ? "border-danger" : "border-input"}`}>
        <input inputMode="decimal" data-path={path} className="w-full min-w-0 bg-transparent px-2 py-1.5 font-mono text-sm outline-none" value={shown}
          onChange={(e) => { const t = e.target.value; setTxt(t); set(path, t.trim() === "" ? null : Number(t.trim())); }} onBlur={() => setTxt(null)} />
        <span className="shrink-0 pr-2 font-mono text-[11px] text-muted-foreground">{unit}</span>
      </div>
      {hint && <span className="mt-0.5 block text-[10px] text-muted-foreground">{hint}</span>}
      {err && <PumpErr e={err} />}
    </label>);
}

const PUMP_FIELDS = ["pump.linerIn", "pump.strokeIn", "pump.efficiency", "pump.bblPerStk", "pump.spm"];
/** Format only: fixed decimals, "—" for null/non-finite. */
const fx = (v: number | null | undefined, d: number) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d));
const Min = ({ v }: { v: number | null }) => v == null ? <span className="text-muted-foreground">— <span className="font-sans text-[10px]">enter SPM</span></span> : <span>{v.toFixed(2)}</span>;
const STROKE_HEAD = ["Stage", "Stage bbl", "Total bbl", "Stage strokes", "Total strokes", "Stage min", "Total min"];

export function StrokesTable({ s, print }: { s: Extract<StrokesScheduleResult, { ok: true }>; print?: boolean }) {
  const table = (
    <table data-testid="strokes-table" className={`procedure-table w-full text-right font-mono text-xs ${print ? "" : "hidden sm:table"}`}>
      <thead className="text-muted-foreground"><tr>{STROKE_HEAD.map((h) => <th key={h} className="border-b px-2 py-1 font-normal">{h}</th>)}</tr></thead>
      <tbody>{s.rows.map((r) => (
        <tr key={r.n} data-strokes-row={r.n} className="border-b border-border/50 [&>td]:px-2 [&>td]:py-1">
          <td className="text-left">{r.label}</td><td>{fx(r.stage_bbl, 3)}</td><td>{fx(r.cum_bbl, 3)}</td>
          <td>{fx(r.strokes, 2)}</td><td className="font-semibold">{fx(r.cumStrokes, 2)}</td><td><Min v={r.minutes} /></td><td className="font-semibold"><Min v={r.cumMinutes} /></td></tr>))}</tbody>
    </table>);
  if (print) return table;
  return (<>
    {table}
    <div className="space-y-2 sm:hidden">{s.rows.map((r) => (
      <div key={r.n} data-strokes-card={r.n} className="rounded-md border p-2 text-xs">
        <div className="mb-1 font-semibold">{r.label}</div>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono">
          <dt className="text-muted-foreground">Stage bbl</dt><dd>{fx(r.stage_bbl, 3)}</dd>
          <dt className="text-muted-foreground">Total bbl</dt><dd>{fx(r.cum_bbl, 3)}</dd>
          <dt className="text-muted-foreground">Stage strokes</dt><dd>{fx(r.strokes, 2)}</dd>
          <dt className="text-muted-foreground">Total strokes</dt><dd className="font-semibold">{fx(r.cumStrokes, 2)}</dd>
          <dt className="text-muted-foreground">Stage min</dt><dd><Min v={r.minutes} /></dd>
          <dt className="text-muted-foreground">Total min</dt><dd className="font-semibold"><Min v={r.cumMinutes} /></dd>
        </dl>
      </div>))}</div>
  </>);
}

export function StrokesScreen() {
  const s = useStrokes();
  if (!s) return null;
  const err = s.ok ? undefined : s.error;
  const at = (f: string) => (err && err.field === f ? err : undefined);
  const other = err && !PUMP_FIELDS.includes(err.field) ? err : undefined;
  return (
    <div className="space-y-3">
      <Card title="Triplex pump">
        <Grid>
          <PumpField k="linerIn" label="Liner" unit="in" err={at("pump.linerIn")} />
          <PumpField k="strokeIn" label="Stroke" unit="in" err={at("pump.strokeIn")} />
          <PumpField k="efficiency" label="Efficiency" unit="frac" hint="fraction, e.g. 0.97" err={at("pump.efficiency")} />
          <PumpField k="bblPerStk" label="bbl/stk override (opt)" unit="bbl/stk" hint="overrides liner, stroke, eff." err={at("pump.bblPerStk")} />
          <PumpField k="spm" label="SPM" unit="spm" hint="blank or 0: no minutes" err={at("pump.spm")} />
        </Grid>
        {other && <PumpErr e={other} />}
        <p data-testid="bbl-per-stk" className="mt-3 font-mono text-sm">Pump output: <span className="font-semibold">{s.ok ? `${s.bblPerStk.toFixed(6)} bbl/stk` : "—"}</span></p>
      </Card>
      <Card title="Strokes schedule (pill pumped per stage)" right={<span className="text-[11px] text-muted-foreground">Stage = this stage only · Total = running total</span>}>
        {s.ok ? <StrokesTable s={s} /> : <p className="text-xs text-muted-foreground">No schedule until the pump input above is fixed.</p>}
      </Card>
    </div>);
}

function StrokesPrint() {
  const s = useStrokes();
  if (!s) return null;
  return (<>
    <h3 className="mb-1 font-semibold">Strokes schedule · {s.ok ? `${s.bblPerStk.toFixed(6)} bbl/stk` : "not available"}</h3>
    {s.ok ? <div className="mb-3"><StrokesTable s={s} print /></div> : <p className="mb-3 text-xs text-danger">✖ {s.error.message} <span className="font-mono">[{s.error.field}]</span></p>}
  </>);
}

/* ---------- KPI & volumes: display only. All numbers come from one kpiVolumes() call. ---------- */
/** KPI uses the inputs snapshot from the last Calculate, like the other result screens — never live edits. */
function useKpi(): KpiVolumesResult | null {
  const job = useStore((s) => s.calcJob);
  return useMemo(() => {
    if (!job) return null;
    const volumes = kpiVolumes(job, { surfaceLine_bbl: 0 });
    return isCalcRefusal(volumes) ? null : volumes;
  }, [job]);
}
const KpiErr = ({ e }: { e: KpiError }) => (
  <p data-kpi-error={e.code} role="alert" className="text-xs text-danger">✖ {e.message} <span className="font-mono opacity-70">[{e.code} · {e.field}]</span></p>);
const Kv = ({ k, v, u, strong, id }: { k: string; v: string; u?: string; strong?: boolean; id?: string }) => (
  <div className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1 text-xs">
    <span className="text-muted-foreground">{k}</span>
    <span data-kpi={id} className={`font-mono ${strong ? "text-sm font-semibold" : ""}`}>{v}{u ? <span className="ml-1 text-[11px] text-muted-foreground">{u}</span> : null}</span>
  </div>);
/** Shows the contract's STAND_LENGTH error under the Trip inputs stand-length field. */
function StandLengthErr() {
  const k = useKpi();
  const error = !k || !k.ok ? null : !k.poohFill.ok && k.poohFill.error.code === "STAND_LENGTH" ? k.poohFill.error : null;
  return error ? <div className="mt-2"><KpiErr e={error} /></div> : null;
}
function RihShoeNote({ margin }: { margin: number }) {
  const note = rihShoeNote(margin, useEmwProfile());
  return note ? <p data-kpi="rih-shoe-note" className="mt-1 text-[11px] font-semibold text-danger">{note}</p> : null;
}

function KpiBody({ k, print }: { k: Extract<KpiVolumesResult, { ok: true }>; print?: boolean }) {
  const { masp: m, kmw: w, chase: c, kmwInString: s, kmwBackfill: b, poohFill: fill } = k;
  const Box = ({ title, children }: { title: string; children: ReactNode }) => print
    ? <div className="print-avoid mb-2"><h4 className="kpi-print-h text-xs font-semibold">{title}</h4>{children}</div>
    : <Card title={title}>{children}</Card>;
  return (<div className={print ? "grid grid-cols-2 gap-x-4" : "grid gap-3 md:grid-cols-2"}>
    <Box title="MASP vs planned SBP">
      <Kv k="MASP = (FIT − MW) × 0.052 × shoe TVD" v={fx(m.masp_psi, 2)} u="psi" strong id="masp" />
      <Kv k="Planned SBP" v={fx(m.plannedSbp_psi, 0)} u="psi" id="sbp" />
      <Kv k="MASP margin (mud at shoe, pipe out)" v={fx(m.margin_psi, 2)} u="psi" id="margin" />
      <RihShoeNote margin={m.margin_psi} />
      <div className="mt-1 text-xs"><span data-kpi="sbp-flag" className={`rounded px-2 py-0.5 font-semibold ${m.sbpExceedsMasp ? "kpi-flag-over" : "kpi-flag-ok"}`}>{m.sbpExceedsMasp ? "SBP OVER MASP" : "OK"} · {m.sbpFlag}</span></div>
      <p className="mt-1 text-[10px] text-muted-foreground">FIT {fx(m.fitEmw_ppg, 2)} · MW {fx(m.activeMw_ppg, 2)} ppg ({m.activeMwFluidId}) · shoe TVD {fx(m.shoeTvd_ft, 0)} ft</p>
    </Box>
    <Box title="Kill mud weight">
      <Kv k="KMW raw" v={fx(w.raw_ppg, 4)} u="ppg" id="kmw-raw" />
      <Kv k="KMW (rounded up 0.1)" v={fx(w.rounded_ppg, 1)} u="ppg" strong id="kmw" />
      <p className="mt-1 text-[10px] text-muted-foreground">MW {fx(w.activeMw_ppg, 2)} + SBP {fx(w.sbp_psi, 0)} psi ÷ (0.052 × anchor TVD {fx(w.anchorTvd_ft, 0)} ft)</p>
    </Box>
    <Box title="Chase volume">
      <Kv k="String" v={fx(c.stringCapacity_bbl, 3)} u="bbl" id="chase-string" />
      <Kv k="Annulus" v={fx(c.annularVolume_bbl, 3)} u="bbl" id="chase-annulus" />
      <Kv k="Pill in string" v={fx(c.pillInString_bbl, 3)} u="bbl" id="chase-pill" />
      <Kv k="Chase" v={fx(c.chase_bbl, 3)} u="bbl" strong id="chase" />
      <Kv k="Surface lines (separate, not in chase)" v={fx(c.surfaceLine_bbl, 3)} u="bbl" id="surface" />
    </Box>
    <Box title="KMW left in string">
      <Kv k="Volume" v={fx(s.bbl, 3)} u="bbl" strong id="kmw-left" />
      <Kv k="Length" v={s.height_ft.toLocaleString("en-US")} u="ft" id="kmw-left-ft" />
    </Box>
    <Box title="KMW backfill (annulus above pill)">
      <Kv k="Total" v={fx(b.volume_bbl, 3)} u="bbl" strong id="backfill" />
      {b.sections.map((x, i) => <Kv key={i} k={`${fx(x.topMd_ft, 0)}–${fx(x.bottomMd_ft, 0)} ft · ${fx(x.holeId_in, 3)} in`} v={fx(x.volume_bbl, 3)} u="bbl" id={`backfill-${i}`} />)}
    </Box>
    <Box title={fill.ok ? `POOH fill · ${fx(fill.standLength_ft, 0)} ft stands` : "POOH fill"}>
      {fill.ok ? <><Kv k="Per stand, closed pipe" v={fx(fill.closed.perStand_bbl, 4)} u="bbl" id="pooh-stand-closed" />
        <Kv k="Total, closed pipe" v={fx(fill.closed.total_bbl, 3)} u="bbl" strong id="pooh-total-closed" />
        <Kv k="Per stand, open pipe" v={fx(fill.open.perStand_bbl, 4)} u="bbl" id="pooh-stand-open" />
        <Kv k="Total, open pipe" v={fx(fill.open.total_bbl, 3)} u="bbl" strong id="pooh-total-open" />
        <Kv k="Rows" v={`${fill.closed.stands.length} (${fill.fullStandCount} stands${fill.partialStand_ft ? ` + ${fx(fill.partialStand_ft, 0)} ft single` : ""})`} id="pooh-rows" /></> : <KpiErr e={fill.error} />}
    </Box>
    <Box title="Pill volume">
      <Kv k="Pill volume" v={fx(k.pillVolume_bbl, 3)} u="bbl" strong id="pill-volume" />
      <p data-kpi="pill-breakdown" className="mt-1 font-mono text-[11px] text-muted-foreground">String capacity over pill interval {fx(k.pillVolumeBreakdown.stringCapOverPillInterval_bbl, 3)} bbl + chase {fx(k.pillVolumeBreakdown.chase_bbl, 3)} bbl</p>
    </Box>
  </div>);
}

function PoohRows({ fill, print }: { fill: PoohFillValue; print?: boolean }) {
  const table = (
    <table data-testid="pooh-table" className="procedure-table w-full text-right font-mono text-xs">
      <thead className="text-muted-foreground"><tr>{["#", "Length (ft)", "Closed (bbl)", "Closed total", "Open (bbl)", "Open total"].map((h) => <th key={h} className="border-b px-2 py-1 font-normal">{h}</th>)}</tr></thead>
      <tbody>{fill.closed.stands.map((r, i) => { const o = fill.open.stands[i]; return (
        <tr key={r.n} data-pooh-row={r.n} className="border-b border-border/50 [&>td]:px-2 [&>td]:py-0.5">
          <td>{r.n}</td><td>{fx(r.length_ft, 0)}</td><td>{fx(r.bbl, 4)}</td><td className="font-semibold">{fx(r.runningTotal_bbl, 3)}</td>
          <td>{o ? fx(o.bbl, 4) : "—"}</td><td>{o ? fx(o.runningTotal_bbl, 3) : "—"}</td></tr>); })}</tbody>
    </table>);
  if (print) return table;
  return (<details data-testid="pooh-details" className="rounded-md border p-2"><summary className="cursor-pointer text-xs font-semibold">POOH fill table · {fill.closed.stands.length} rows</summary><div className="mt-2 overflow-x-auto">{table}</div></details>);
}

export function KpiScreen() {
  const k = useKpi();
  if (!k) return null;
  return (<div className="space-y-3">
    <p className="text-[11px] text-muted-foreground print:hidden">Stand length is set in 7 Trip schedule → Trip inputs.</p>
    {k.ok ? <><KpiBody k={k} />{k.poohFill.ok ? <PoohRows fill={k.poohFill} /> : <div data-testid="pooh-table-error" className="rounded-md border p-2"><p className="mb-1 text-xs font-semibold">POOH fill table</p><KpiErr e={k.poohFill.error} /></div>}</> : <Card title="KPI & volumes"><KpiErr e={k.error} /><p className="mt-2 text-xs text-muted-foreground">No KPI numbers until this input is fixed.</p></Card>}
  </div>);
}

function KpiPrint() {
  const k = useKpi();
  if (!k) return null;
  return (<section className="kpi-print mb-3">
    <h3 className="mb-1 font-semibold">KPI &amp; volumes{k.ok ? "" : " · not available"}</h3>
    {k.ok ? <><KpiBody k={k} print />{k.poohFill.ok ? <><h4 className="kpi-print-h mt-2 text-xs font-semibold">POOH fill · {fx(k.poohFill.standLength_ft, 0)} ft stands</h4><PoohRows fill={k.poohFill} print /></> : <><h4 className="kpi-print-h mt-2 text-xs font-semibold">POOH fill table</h4><div data-testid="pooh-table-error"><KpiErr e={k.poohFill.error} /></div></>}</> : <KpiErr e={k.error} />}
  </section>);
}

export function ExportScreen() {
  const { job, result, calcJob } = useStore();
  const calcEdited = useCalcEdited();
  const errors = (result?.issues ?? []).filter((i) => i.level === "error");
  const fitBreach = errors.some((i) => i.code === "SHOE_ESD_AT_FIT");
  const locked = errors.length > 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button disabled={locked} onClick={() => window.print()} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{fitBreach ? "Print locked (SDS-FRM-087)" : locked ? "Print locked" : "Print"}</button>
        {locked && <span className="text-xs text-danger">{errors.length} error(s) must be fixed first.</span>}
      </div>
      {locked && <div className="print:hidden"><IssueList issues={errors} /></div>}
      <article className="procedure-sheet rounded-lg border bg-card p-4 text-sm">
        <FitBanner />
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
          <div><div data-testid="sheet-title" className="text-base font-semibold">{jobLabel(calcJob ?? job).text}{calcEdited && <span data-testid="print-edited-marker"> (edited)</span>}</div><div className="text-xs text-danger">EXAMPLE inputs, math checked against API RP 13D examples, pending Sergio's field review</div></div>
          <div className="text-right font-mono text-[11px] text-muted-foreground">PillView 2.0 · {APP_VERSION}<br />SDS-FRM-087 · calc {result?.calcVersion ?? "—"}<br />inputs #{result?.inputHash ?? "—"}</div>
        </header>
        {result && <>
          <h3 className="mb-1 font-semibold">{rihStageTitle(result.displacement.minStagesRih)}</h3>
          <table className="procedure-table mb-3 w-full text-right font-mono text-xs"><thead><tr>{["#", "Bit MD (ft)", "Pumped (bbl)", "SBP (psi)", "Shoe ESD hydrostatic (ppg)", "Shoe EMW (ppg)", `vs FIT ${num(result.depths.shoe.fit_ppg)}`].map((h) => <th key={h} className="border-b px-1">{h}</th>)}</tr></thead>
            <tbody>{result.displacement.stages.map((s) => <tr key={s.n}><td>{s.n}</td><td>{s.bitMd_ft}</td><td><Pumped v={s.pumped_bbl} /></td><td>{num(s.sbp_psi, 0)}</td><td>{num(s.shoeEsd_ppg)}</td><td className="font-semibold">{num(s.shoeEmw_ppg, 3)}</td><td><FitCmp n={s.n} /></td></tr>)}</tbody></table>
          <StrokesPrint />
          <KpiPrint />
          <EmwPrint />
        </>}
        <h3 className="mb-1 font-semibold">Inputs used</h3>
        <InputsTable />
        <footer className="mt-3 border-t pt-2 font-mono text-[10px] text-muted-foreground">PillView 2.0 · {APP_VERSION} · saved {job.savedAt || "not saved"}</footer>
      </article>
    </div>
  );
}

/** Print sheet inputs: the last-Calculate snapshot, so the table matches the results above it. */
function InputsTable() {
  const job = useStore((s) => s.calcJob ?? s.job);
  const w = job.well;
  const rows: [string, string][] = [
    ["Mode", job.mode], ["TD MD / TVD", `${w.mdTd_ft} / ${w.tvdTd_ft} ft`], ["Bit MD", `${w.bitMd_ft} ft`],
    ["Shoe MD / TVD", `${w.shoeMd_ft} / ${w.shoeTvd_ft} ft`], ["Anchor MD / TVD", `${w.anchorMd_ft} / ${w.anchorTvd_ft ?? "interp."} ft`],
    ["FIT / Pore / Target", `${w.fit_ppg} / ${w.porePressure_ppg ?? "—"} / ${w.targetEmw_ppg ?? "—"} ppg`],
    ["OH ID / String OD / ID", `${w.openHoleId_in} / ${w.stringOd_in} / ${w.stringId_in} in`],
    ...job.fluids.map((f): [string, string] => [f.label, `${f.density_ppg} ppg · Fann 600/300/200/100/6/3: ${f.fann ? [f.fann.r600, f.fann.r300, f.fann.r200, f.fann.r100, f.fann.r6, f.fann.r3].join("/") : "—"} ° · gel ${f.gel10m_lbf100ft2 ?? "—"} lbf/100ft²`]),
    ...job.column.map((c, i): [string, string] => [`Annulus column ${i + 1}`, `${c.fluidId}: ${c.topMd_ft}–${c.bottomMd_ft} ft MD`]),
    ...(job.pipeColumn ?? []).map((c, i): [string, string] => [`Pipe column ${i + 1}`, `${c.fluidId}: ${c.topMd_ft}–${c.bottomMd_ft} ft MD (inside string)`]),
    ["Trip speeds", `${job.trip.speeds_ftmin.join(", ")} ft/min, pipe ${job.trip.pipeEnd}`],
    ["Pump liner / stroke / eff. / SPM", job.pump ? `${job.pump.linerIn ?? "—"} in / ${job.pump.strokeIn ?? "—"} in / ${job.pump.efficiency ?? "—"} / ${job.pump.spm ?? "—"} spm${job.pump.bblPerStk != null ? ` · override ${job.pump.bblPerStk} bbl/stk` : ""}` : "—"],
    ["SBP conn / circ · flow", `${job.trip.sbpConn_psi} / ${job.trip.sbpCirc_psi} psi · ${job.trip.flow_gpm} gpm`],
    ["Stand length", job.trip.standLength_ft != null && Number.isFinite(job.trip.standLength_ft) ? `${job.trip.standLength_ft} ft` : "—"],
  ];
  return <table className="w-full text-xs"><tbody>{rows.map(([k, v]) => <tr key={k} className="border-b border-border/50"><td className="py-0.5 pr-2 text-muted-foreground">{k}</td><td className="font-mono">{v}</td></tr>)}</tbody></table>;
}
