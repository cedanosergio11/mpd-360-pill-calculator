import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { formatNumber, isNum } from "@/lib/utils";

export function CementView({ inputs, results }: { inputs: WellInputs; results: CalcResults }) {
  const c = results.cement;
  const ready = [c.requiredCementPillVol, c.staticPressure].every(isNum) && (c.requiredCementPillVol > 0 || isNum(inputs.cementDesiredEsd));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Mini label="Static pressure" value={`${formatNumber(c.staticPressure, 0)} psi`} />
        <Mini label="Required cement" value={`${formatNumber(c.requiredCementPillVol, 0)} bbl`} />
        <Mini label="Total chase" value={`${formatNumber(c.totalChase, 0)} bbl`} />
      </div>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Non-balanced / offline cement pill</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Fill every cement input even if it already appears under well information. The procedure assumes casing
          in the hole.
        </p>
        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">Enter offline-cement inputs to calculate volumes.</p>
        ) : (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <Row k="Annular capacity" v={`${isNum(c.annularCapacity) ? c.annularCapacity.toFixed(4) : "—"} bbl/ft`} />
            <Row k="Open hole capacity" v={`${isNum(c.openHoleCapacity) ? c.openHoleCapacity.toFixed(4) : "—"} bbl/ft`} />
            <Row k="Casing string capacity" v={`${isNum(c.casingStringCapacity) ? c.casingStringCapacity.toFixed(4) : "—"} bbl/ft`} />
            <Row k="OH length TD → BOC" v={`${formatNumber(c.openHoleToBoc, 0)} ft`} />
            <Row k="OH length BOC → shoe" v={`${formatNumber(c.bocToShoe, 0)} ft`} />
            <Row k="Required pill height" v={`${formatNumber(c.requiredPillHeight, 0)} ft`} />
            <Row k="Casing string volume" v={`${formatNumber(c.totalCasingStringVol, 0)} bbl`} />
            <Row k="Chase after KWM to TD" v={`${formatNumber(c.chaseToTd, 0)} bbl`} />
            <Row k="Chase to exit casing" v={`${formatNumber(c.chaseExitCasing, 0)} bbl`} />
            <Row k="Chase exit → BOC" v={`${formatNumber(c.chaseBocToShoe, 0)} bbl`} />
            <Row k="Chase BOC → shoe + pill" v={`${formatNumber(c.chaseBocShoePlusPill, 0)} bbl`} />
            <Row k="Top of pill" v={`${formatNumber(c.topOfPill, 0)} ft`} />
          </dl>
        )}
        <ol className="mt-5 space-y-1.5 text-sm text-muted-foreground">
          <li>1. Swap from KWM to chase once the required KWM volume is pumped.</li>
          <li>2. Fill the casing string so KWM reaches TD.</li>
          <li>3. Continue until the top of kill mud reaches BOC.</li>
          <li>4. Step surface pressure down as KWM climbs above BOC.</li>
        </ol>
      </section>
      {inputs.taperedOn ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Tapered pill volumes</h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Row k="Total pill volume" v={`${formatNumber(results.tapered.totalPillVol, 1)} bbl`} />
            <Row k="Pill in annulus w/ DP" v={`${formatNumber(results.tapered.pillNeededAnnulus, 1)} bbl`} />
            <Row k="DP volume" v={`${formatNumber(results.tapered.dpVolume, 1)} bbl`} />
            <Row k="Mud in annulus after pump" v={`${formatNumber(results.tapered.mudInAnnulusAfterPumping, 1)} bbl`} />
            <Row k="Additional chase" v={`${formatNumber(results.tapered.additionalChase, 1)} bbl`} />
            <Row k="Mud in DP" v={`${formatNumber(results.tapered.mudInDp, 1)} bbl`} />
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg tabular-nums">{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono tabular-nums">{v}</dd>
    </div>
  );
}
