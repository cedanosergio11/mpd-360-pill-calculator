import type { CalcResults, ScheduleResult, WellInputs } from "@/lib/calc/types";
import { esdCasingWithDp, esdTargetWithDp, pillHeightWithDp } from "@/lib/calc/engine";
import { asNum, formatExact, formatNumber, isNum } from "@/lib/utils";
import { formatVersion } from "@/lib/version";
import { Badge } from "@/components/ui/badge";

function Cell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="border border-border px-2.5 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm tabular-nums leading-tight">
        {value}
        {unit ? <span className="ml-1 font-sans text-[10px] text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/70 py-1 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono tabular-nums">{v}</dd>
    </div>
  );
}

export function shoeExceedsFit(inputs: WellInputs, results: CalcResults): boolean {
  const fit = asNum(inputs.fit);
  if (!isNum(fit)) return false;
  const asPumped = results.esdCasingNoDp;
  const equalized = esdCasingWithDp(results);
  return (isNum(asPumped) && asPumped >= fit) || (isNum(equalized) && equalized >= fit);
}

export function ProcedureDoc({
  inputs,
  results,
  schedule,
}: {
  inputs: WellInputs;
  results: CalcResults;
  schedule: ScheduleResult;
}) {
  const withSlug = inputs.pillMode === "withSlug";
  const hole = asNum(inputs.openHoleDia);
  const emw = asNum(inputs.desiredEmw);
  const mw = asNum(inputs.currentMw);
  const kmw = asNum(inputs.kmw);
  const spot = asNum(inputs.spotMd);
  const topSlug = asNum(inputs.topSlugBbl);
  const fit = asNum(inputs.fit);
  const title = withSlug ? "Standard Pill — With Slug" : "Standard Pill — No Slug";
  const eqAnnulus = (results.correctedPillVol || 0) + (results.equalizeDumpBbl || 0);
  const asPumpedAnn = results.correctedPillVol;
  const asPumpedStr = results.finalKwm;
  const chase = results.correctedChase;
  const overFit = shoeExceedsFit(inputs, results);
  const shoeEq = esdCasingWithDp(results);

  return (
    <article className="procedure-sheet mx-auto max-w-4xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-8">
      <header className="procedure-letterhead border-b-2 border-foreground/30 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Master procedure template
            </p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-balance sm:text-2xl">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isNum(hole) ? `${hole}" ` : "—"} {inputs.sectionType} · MPD 360 pill program
            </p>
          </div>
          <div className="text-right text-xs leading-relaxed">
            <div className="font-mono text-[11px] text-muted-foreground">SDS-FRM-087 · {formatVersion()}</div>
            <div className="text-base font-semibold">{inputs.wellName || "Untitled well"}</div>
            <div>{inputs.client || "—"}</div>
            <div className="text-muted-foreground">
              {inputs.date} · {inputs.producedBy || "—"}
            </div>
          </div>
        </div>
      </header>

      {!results.procedurePossible ? (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {results.errorReason}
        </div>
      ) : null}

      {overFit ? (
        <div className="procedure-hot procedure-fit-banner mt-4 rounded-xl px-4 py-3 text-sm font-semibold">
          Not issuable — shoe ESD at or above FIT. FIT {formatExact(fit, 2)} ppge · as-pumped {formatExact(results.esdCasingNoDp, 2)} · equalized {formatExact(shoeEq, 2)}. Engineering aid only.
        </div>
      ) : null}

      <section className="procedure-block mt-4">
        <h3 className="procedure-kicker">Well information</h3>
        <div className="mt-1 grid grid-cols-2 sm:grid-cols-4">
          <Cell label="Well" value={inputs.wellName || "—"} />
          <Cell label="Client" value={inputs.client || "—"} />
          <Cell label="Date" value={String(inputs.date || "—")} />
          <Cell label="Prepared by" value={inputs.producedBy || "—"} />
          <Cell label="Active MW" value={formatExact(mw, 1)} unit="ppg" />
          <Cell label="KMW" value={formatExact(kmw, 1)} unit="ppg" />
          <Cell label="Target EMW" value={formatExact(emw, 1)} unit="ppge" />
          <Cell label="FIT" value={formatExact(fit, 2)} unit="ppge" />
          <Cell label="Spot MD" value={formatNumber(spot, 0)} unit="ft" />
          <Cell label="Casing MD" value={formatNumber(asNum(inputs.casingMd), 0)} unit="ft" />
          <Cell label="Anchor MD" value={formatNumber(asNum(inputs.anchorMd), 0)} unit="ft" />
          <Cell label="Anchor TVD" value={formatNumber(asNum(inputs.anchorTvd), 0)} unit="ft" />
          <Cell label="Casing ID" value={formatExact(asNum(inputs.idCasing), 3)} unit="in" />
          <Cell label="Hole" value={formatExact(hole, 3)} unit="in" />
          <Cell label="DP OD" value={formatExact(asNum(inputs.odDp), 3)} unit="in" />
          <Cell label="DP ID" value={formatExact(asNum(inputs.idDp), 3)} unit="in" />
        </div>
      </section>
    </article>
  );
}
