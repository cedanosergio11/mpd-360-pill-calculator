import type { CalcResults, WarningItem, WellInputs } from "@/lib/calc/types";
import { formatExact, formatNumber, isNum } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { EqualizeWorkedExample } from "@/components/equalize-example";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AuditView({
  inputs,
  results,
  warnings,
}: {
  inputs: WellInputs;
  results: CalcResults;
  warnings: WarningItem[];
}) {
  const scenarios = useAppStore((s) => s.scenarios);
  const loadScenario = useAppStore((s) => s.loadScenario);
  const deleteScenario = useAppStore((s) => s.deleteScenario);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Validation</h3>
        <div className="mt-3 space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={
                w.level === "error"
                  ? "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  : w.level === "warn"
                    ? "rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm"
                    : w.level === "ok"
                      ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm"
                      : "rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
              }
            >
              {w.text}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Pill calculation audit</h3>
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          <Row k="Drill string capacity" v={`${fmt4(results.drillStringCap)} bbl/ft`} />
          <Row k="DS volume @ spot" v={`${formatNumber(results.drillStringVolAtSpot, 0)} bbl`} />
          <Row k="Casing capacity" v={`${fmt4(results.casingCap)} bbl/ft`} />
          <Row k="Annular capacity" v={`${fmt4(results.annularCap)} bbl/ft`} />
          <Row k="Open hole capacity" v={`${fmt4(results.openHoleCap)} bbl/ft`} />
          <Row k="Height of pill w/o DP" v={`${formatNumber(results.heightPillNoDp, 0)} ft`} />
          <Row k="Required annulus volume" v={`${formatNumber(results.requiredVolAnnulus, 1)} bbl`} />
          <Row k="Corrected annulus volume" v={`${formatNumber(results.correctedPillVol, 0)} bbl`} />
          <Row k="KMW that fits with DP" v={`${formatNumber(results.spottedKmwVol, 0)} bbl`} />
          <Row k="Room with pipe (annulus + DP to bit)" v={`${formatNumber(results.kmwRoomWithPipe, 0)} bbl`} />
          <Row k="KMW needed (no DP)" v={`${formatNumber(results.totalPillVol, 0)} bbl`} />
          <Row k="Min height with DP" v={`${formatNumber(results.minHeightPillWithDp, 0)} ft`} />
          <Row k="KMW backfill while POOH" v={`${formatNumber(results.bblBackfill, 0)} bbl`} />
          <Row k="Chase calculated" v={`${formatNumber(results.calculatedChase, 1)} bbl`} />
          <Row k="Chase corrected" v={`${formatNumber(results.correctedChase, 1)} bbl`} />
          <Row k="Final KWM in DS (as pumped)" v={`${formatNumber(results.finalKwm, 1)} bbl`} />
          <Row k="Equalize dump (VTT)" v={`${formatNumber(results.equalizeDumpBbl, 1)} bbl`} />
          <Row k="KMW left in DP" v={`${formatNumber(results.remainingKmwInDp, 1)} bbl`} />
          <Row k="Air cap to" v={`${formatNumber(results.airCapTopMd, 0)} ft`} />
          <Row k="Annular height after equalize" v={`${formatNumber(results.minHeightWithDp, 0)} ft`} />
          <Row k="Extra psi from dump" v={`${formatNumber(results.balancedAdditionalPsi, 0)} psi`} />
          <Row k="Add. ppg @ shoe" v={`${formatExact(results.addPpgCsg, 3)} ppge`} />
          <Row k="Add. ppg @ target" v={`${formatExact(results.addPpgTarget, 3)} ppge`} />
          <Row k="Initial ΔP" v={`${formatNumber(results.pressureDifferential, 0)} psi`} />
          <Row k="Slug pressure" v={`${formatNumber(results.slugPressure, 0)} psi`} />
          <Row k="Slug volume" v={`${formatExact(results.slugPillVol, 1)} bbl`} />
          <Row k="Slug fallout" v={`${formatNumber(results.slugFallOut, 1)} bbl`} />
          <Row k="KWM + chase" v={`${formatNumber(results.kwmPlusChase, 0)} bbl`} />
        </dl>
      </section>

      <EqualizeWorkedExample inputs={inputs} results={results} />

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Saved scenarios</h3>
        {scenarios.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No scenarios saved on this device yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {scenarios.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(s.savedAt).toLocaleString()} · {s.inputs.client || "no client"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      loadScenario(s.id);
                      toast.success(`Loaded ${s.name}`);
                    }}
                  >
                    Load
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteScenario(s.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <h3 className="text-sm font-semibold text-foreground">Calculation notes</h3>
        <p className="mt-2 text-pretty">
          Capacities use ID² / 1029.4 bbl/ft. Pill height without DP is CEILING of hydrostatic / kill-mud gradient
          to the next 10 ft. Production sections floor the initial rate to 10 gpm and step down after SBP reaches
          50 psi using annular-friction similarity. Slug pressure uses the 200 ft/min dynamic SBP plus overbalance,
          matching the master template. This is an engineering aid — not a controlled operational release.
        </p>
        <p className="mt-2">
          Well {inputs.wellName || "—"} · {inputs.sectionType} · hole {isNum(Number(inputs.openHoleDia)) ? inputs.openHoleDia : "—"} in
        </p>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono tabular-nums text-foreground">{v}</dd>
    </div>
  );
}
function fmt4(v: number) {
  return isNum(v) ? v.toFixed(4) : "—";
}
