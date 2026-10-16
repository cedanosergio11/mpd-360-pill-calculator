/**
 * RP 13D reference tab. Imports only from `@/lib/rp13d`; the sheet tabs never import this file.
 * Every TVD comes from the sheet paste and is read-only here. The paste has no bit TVD, so the bit row says so.
 * The swab/surge trip table stays on the engine result and is not rendered.
 */
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { dEmw } from "@/components/fmt";
import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { BIT_TVD_NOT_IN_SHEET, calcRp13d, compareEcd, type EcdComparison, type Rp13dInputs, type SheetBasis } from "@/lib/rp13d";
import { asNum } from "@/lib/utils";

export const RP13D_REFERENCE_LINE = "RP 13D hydraulics, reference only, not used on the sheet tabs.";
export const RP13D_EXAMPLE_DIALS_LINE = "Fann dials shown are EXAMPLE values.";

/** Synthetic EXAMPLE dials (the 1.0.7.1 sheet has no Fann readings). */
const EXAMPLE_DIALS = { fann600: "80", fann300: "48", fann200: "36", fann100: "24", fann6: "9.2", fann3: "8.2" };
const FANN = [
  ["fann600", "600 rpm"],
  ["fann300", "300 rpm"],
  ["fann200", "200 rpm"],
  ["fann100", "100 rpm"],
  ["fann6", "6 rpm"],
  ["fann3", "3 rpm"],
] as const;
type FannKey = (typeof FANN)[number][0];

const GEOMETRY = [
  ["mw", "Mud weight", "ppg"],
  ["flowGpm", "Flow rate", "gpm"],
  ["pipeOd", "Pipe OD", "in"],
  ["pipeId", "Pipe ID", "in"],
  ["casingId", "Casing ID", "in"],
  ["casingMd", "Casing shoe MD", "ft"],
  ["openHoleDia", "Open hole", "in"],
  ["anchorMd", "Anchor MD", "ft"],
  ["bitMd", "Bit MD", "ft"],
  ["sbpConnection", "Connection SBP", "psi"],
] as const;
type GeoKey = (typeof GEOMETRY)[number][0];

/** Plain numbers handed over from the sheet. */
interface Rp13dSeed {
  key: string;
  geometry: Record<GeoKey, number | null>;
}

const n = (v: unknown) => {
  const x = asNum(v);
  return Number.isFinite(x) ? x : null;
};

function seedFrom(inputs: WellInputs): Rp13dSeed {
  const geometry: Record<GeoKey, number | null> = {
    mw: n(inputs.currentMw),
    flowGpm: n(inputs.initialFlowRate),
    pipeOd: n(inputs.odDp),
    pipeId: n(inputs.idDp),
    casingId: n(inputs.idCasing),
    casingMd: n(inputs.casingMd),
    openHoleDia: n(inputs.openHoleDia),
    anchorMd: n(inputs.anchorMd),
    bitMd: n(inputs.currentDepthMd),
    sbpConnection: n(inputs.sbpConnection),
  };
  return { key: JSON.stringify(geometry), geometry };
}

/** The sheet paste has no bit TVD, so both bit columns say so. */
export function bitEcdCell(): string {
  return BIT_TVD_NOT_IN_SHEET;
}

export function bitDifferenceCell(): string {
  return BIT_TVD_NOT_IN_SHEET;
}

interface Rp13dUiState {
  seedKey: string | null;
  fann: Record<FannKey, string>;
  dialsEdited: boolean;
  geo: Record<GeoKey, string>;
  pipeEnd: "closed" | "open";
  seed: (seed: Rp13dSeed) => void;
  setFann: (key: FannKey, value: string) => void;
  setGeo: (key: GeoKey, value: string) => void;
  setPipeEnd: (value: "closed" | "open") => void;
}

const str = (v: number | null) => (v == null || !Number.isFinite(v) ? "" : String(v));

export const useRp13dUi = create<Rp13dUiState>((set) => ({
  seedKey: null,
  fann: { ...EXAMPLE_DIALS },
  dialsEdited: false,
  geo: Object.fromEntries(GEOMETRY.map(([k]) => [k, ""])) as Record<GeoKey, string>,
  pipeEnd: "closed",
  seed: (seed) =>
    set((s) =>
      s.seedKey === seed.key
        ? s
        : {
            seedKey: seed.key,
            geo: Object.fromEntries(GEOMETRY.map(([k]) => [k, str(seed.geometry[k])])) as Record<GeoKey, string>,
          },
    ),
  setFann: (key, value) => set((s) => ({ fann: { ...s.fann, [key]: value }, dialsEdited: true })),
  setGeo: (key, value) => set((s) => ({ geo: { ...s.geo, [key]: value } })),
  setPipeEnd: (pipeEnd) => set({ pipeEnd }),
}));

const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));
const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const emw = (v: number | null | undefined) => dEmw(v);
const diff = (v: number | null | undefined) => {
  if (!ok(v)) return "—";
  const r = Math.round(v * 1000) / 1000;
  return `${r > 0 ? "+" : ""}${(r === 0 ? 0 : r).toFixed(3)}`;
};
const sheetVal = (v: number | null | undefined) => dEmw(v);

const sheetLabel = (b: SheetBasis) => (b === "ecd" ? "Sheet ECD" : "Sheet ESD (static)");
const diffLabel = (b: SheetBasis) => (b === "ecd" ? "RP 13D ECD minus sheet ECD" : "RP 13D ECD minus sheet ESD");

function Banner({ dialsEdited }: { dialsEdited: boolean }) {
  return (
    <div data-rp13d-banner className="rounded-xl border border-zinc-400/50 bg-zinc-500/20 px-4 py-2.5 text-sm text-foreground print:border-zinc-500 print:bg-zinc-200 print:text-black">
      <p className="font-medium">{RP13D_REFERENCE_LINE}</p>
      {dialsEdited ? null : <p data-example-dials className="text-muted-foreground print:text-black">{RP13D_EXAMPLE_DIALS_LINE}</p>}
    </div>
  );
}

function NumIn({ id, label, unit, value, onChange, required }: { id: string; label: string; unit: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs">
      <span className="truncate text-muted-foreground">
        {label} <span className="opacity-70">({unit})</span>
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      <input
        id={id}
        data-rp13d-input={id}
        inputMode="decimal"
        type="number"
        step="any"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-2 font-mono text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function TvdOut({ id, label, value }: { id: string; label: string; value: number | null }) {
  return (
    <div data-rp13d-tvd={id} className="flex min-w-0 flex-col gap-1 text-xs">
      <span className="text-muted-foreground break-words">
        {label} <span className="opacity-70">(ft)</span>
      </span>
      <output
        aria-readonly="true"
        className="flex min-h-9 w-full min-w-0 flex-wrap items-center gap-x-2 rounded-md border border-dashed border-border bg-muted/40 px-2 py-1 font-mono text-sm tabular-nums"
      >
        {value == null ? (
          <span className="font-sans text-xs text-muted-foreground italic">{id === "bitTvd" ? BIT_TVD_NOT_IN_SHEET : "not in sheet paste"}</span>
        ) : (
          <>
            <span>{dFtPlain(value)}</span>
            <span className="font-sans text-[11px] text-muted-foreground">from sheet paste</span>
          </>
        )}
      </output>
    </div>
  );
}

const dFtPlain = (v: number) => Math.round(v).toLocaleString("en-US");

function CompareTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table data-rp13d-compare className="w-full min-w-0 text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-1.5 pr-2 font-medium">Point</th>
            <th className="py-1.5 pr-2 font-medium">TVD (ft)</th>
            <th className="py-1.5 pr-2 font-medium">RP 13D ECD (ppg)</th>
            <th className="py-1.5 pr-2 font-medium">Sheet value (ppg)</th>
            <th className="py-1.5 font-medium">Difference (ppg)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.depth} data-rp13d-depth={row.depth} className="border-t border-border align-top">
              <td className="py-1.5 pr-2 font-medium">{row.label}</td>
              <td className="py-1.5 pr-2" data-rp13d-column="tvd">
                {row.tvd == null ? (
                  <span className="text-xs text-muted-foreground italic">{row.depth === "bit" ? BIT_TVD_NOT_IN_SHEET : "not in sheet paste"}</span>
                ) : (
                  <>
                    <span className="font-mono tabular-nums">{dFtPlain(row.tvd)}</span>
                    <span className="block text-[11px] text-muted-foreground">from sheet paste</span>
                  </>
                )}
              </td>
              <td className="py-1.5 pr-2 font-mono tabular-nums" data-rp13d-column="ecd">
                {row.depth === "bit" ? (
                  <span className="font-sans text-xs text-muted-foreground italic">{bitEcdCell()}</span>
                ) : row.rp13dEcd == null ? (
                  <span className="font-sans text-xs text-muted-foreground italic">{row.reason ?? "not in sheet paste"}</span>
                ) : (
                  emw(row.rp13dEcd)
                )}
              </td>
              <td className="py-1.5 pr-2">
                {row.depth === "bit" ? (
                  <span className="text-xs text-muted-foreground italic">no sheet value at bit</span>
                ) : (
                  <>
                    <span className="block text-[11px] text-muted-foreground">{sheetLabel(row.sheetBasis)}</span>
                    <span className="font-mono tabular-nums">{sheetVal(row.sheetEcd)}</span>
                  </>
                )}
              </td>
              <td className="py-1.5" data-rp13d-column="difference">
                {row.depth === "bit" ? (
                  <span className="text-xs text-muted-foreground italic">{bitDifferenceCell()}</span>
                ) : (
                  <>
                    <span className="block text-[11px] text-muted-foreground">{diffLabel(row.sheetBasis)}</span>
                    <span className="font-mono tabular-nums">{diff(row.difference)}</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Row = EcdComparison & { tvd: number | null };

export function Rp13dView({ inputs, results, print = false }: { inputs: WellInputs; results: CalcResults; print?: boolean }) {
  const ui = useRp13dUi();
  const seed = useMemo(() => seedFrom(inputs), [inputs]);
  useEffect(() => {
    useRp13dUi.getState().seed(seed);
  }, [seed]);
  // First render before the effect: use the seed directly so nothing flashes empty.
  const geo = ui.seedKey === seed.key ? ui.geo : (Object.fromEntries(GEOMETRY.map(([k]) => [k, str(seed.geometry[k])])) as Record<GeoKey, string>);
  const anchorTvd = n(inputs.anchorTvd);
  const casingTvd = n(inputs.casingTvd);

  const rpInputs: Rp13dInputs = {
    fann600: num(ui.fann.fann600),
    fann300: num(ui.fann.fann300),
    fann200: num(ui.fann.fann200),
    fann100: num(ui.fann.fann100),
    fann6: num(ui.fann.fann6),
    fann3: num(ui.fann.fann3),
    mw: num(geo.mw),
    flowGpm: num(geo.flowGpm),
    pipeOd: num(geo.pipeOd),
    pipeId: num(geo.pipeId),
    casingId: num(geo.casingId),
    casingMd: num(geo.casingMd),
    casingTvd: casingTvd ?? Number.NaN,
    openHoleDia: num(geo.openHoleDia),
    anchorMd: num(geo.anchorMd),
    anchorTvd: anchorTvd ?? Number.NaN,
    bitMd: num(geo.bitMd),
    // The 1.0.7.1 paste carries no bit TVD. Do not invent one.
    bitTvd: Number.NaN,
    sbpConnection: Number.isFinite(num(geo.sbpConnection)) ? num(geo.sbpConnection) : 0,
    pipeEnd: ui.pipeEnd,
  };
  const result = calcRp13d(rpInputs);
  const tvdOf = { anchor: anchorTvd, shoe: casingTvd, bit: null } as const;
  const rows: Row[] = result.available
    ? compareEcd(result.ecd, {
        currentMw: n(inputs.currentMw),
        initialAplAnchor: Number.isFinite(results.initialAplAnchor) ? results.initialAplAnchor : null,
        anchorTvd,
        shoeTvd: casingTvd,
        shoe: Number.isFinite(results.esdCasingNoDp) ? results.esdCasingNoDp : null,
      }).map((row) => ({ ...row, tvd: tvdOf[row.depth] }))
    : [];
  const byDepth = (d: string) => result.ecd.find((p) => p.depth === d);

  return (
    <div data-rp13d-view className="grid min-w-0 gap-4">
      {print ? (
        <header className="border-b border-zinc-400 pb-2">
          <h2 className="text-lg font-semibold">RP 13D hydraulics</h2>
        </header>
      ) : null}
      <Banner dialsEdited={ui.dialsEdited} />

      <section className="print:hidden rounded-xl border border-border bg-card p-3 sm:p-4">
        <h3 className="text-sm font-medium">Fann 35 readings (lbf/100 ft²) — all six required</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {FANN.map(([k, label]) => (
            <NumIn key={k} id={k} label={label} unit="dial" value={ui.fann[k]} onChange={(v) => ui.setFann(k, v)} required />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Pipe end</span>
          <div className="inline-flex rounded-full border border-border p-0.5" role="radiogroup" aria-label="Pipe end">
            {(["closed", "open"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={ui.pipeEnd === v}
                onClick={() => ui.setPipeEnd(v)}
                className={ui.pipeEnd === v ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" : "rounded-full px-3 py-1 text-xs text-muted-foreground"}
              >
                {v === "closed" ? "Closed" : "Open"}
              </button>
            ))}
          </div>
        </div>
        <h3 className="mt-4 text-sm font-medium">TVDs (from the sheet paste, read-only)</h3>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <TvdOut id="anchorTvd" label="Anchor TVD" value={anchorTvd} />
          <TvdOut id="casingTvd" label="Casing shoe TVD" value={casingTvd} />
          <TvdOut id="bitTvd" label="Bit TVD" value={null} />
        </div>
        <h3 className="mt-4 text-sm font-medium">Well and flow (from the sheet inputs, editable here only)</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {GEOMETRY.map(([k, label, unit]) => (
            <NumIn key={k} id={k} label={label} unit={unit} value={geo[k]} onChange={(v) => ui.setGeo(k, v)} />
          ))}
        </div>
      </section>

      {!result.available ? (
        <div role="alert" data-rp13d-unavailable className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-semibold">RP 13D not calculated</p>
          <p className="mt-1 text-muted-foreground">{result.reason ?? "Inputs incomplete."}</p>
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <h3 className="text-sm font-medium">ECD (ppg)</h3>
            <div className="mt-2 grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
              {(["anchor", "shoe", "bit"] as const).map((d) => {
                const p = byDepth(d);
                const ready = p && Number.isFinite(p.ecd);
                return (
                  <div key={d} className="min-w-0 rounded-lg bg-muted/50 px-2 py-2">
                    <div className="text-[11px] text-muted-foreground capitalize">{d}</div>
                    {ready ? (
                      <>
                        <div className="font-mono text-base font-semibold tabular-nums sm:text-lg">{emw(p.ecd)}</div>
                        <div className="text-[11px] break-words text-muted-foreground">{`${dFtPlain(p.md)} ft MD · ${dFtPlain(p.pa)} psi`}</div>
                      </>
                    ) : (
                      <div className="text-xs break-words text-muted-foreground italic">{d === "bit" ? BIT_TVD_NOT_IN_SHEET : (p?.reason ?? "not in sheet paste")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <h3 className="text-sm font-medium">RP 13D against the 1.0.7.1 sheet</h3>
            <CompareTable rows={rows} />
          </section>
        </>
      )}
      <p className="text-xs text-muted-foreground">{RP13D_REFERENCE_LINE}</p>
    </div>
  );
}
