import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { buildRihFitStops } from "@/lib/calc/rih-fit";
import { formatExact, formatNumber, isNum } from "@/lib/utils";

export function DisplacementView({ inputs, results }: { inputs: WellInputs; results: CalcResults }) {
  const plan = buildRihFitStops(inputs, results);
  const fit = plan.fit;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold">RIH until shoe ESD hits FIT</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Pipe out, then run closed-end DP into the no-DP pill. Stop when hydrostatic at the shoe
            reaches FIT. Circulate that extra KMW out (new top = bit), then repeat.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="FIT" value={`${formatExact(fit, 2)} ppge`} />
          <Mini label="Pill base" value={`${formatNumber(plan.pillBase, 0)} ft`} />
          <Mini label="Casing cap" value={`${isNum(plan.casingCap) ? plan.casingCap.toFixed(4) : "—"} bbl/ft`} />
          <Mini label="Annulus" value={`${isNum(plan.annularCap) ? plan.annularCap.toFixed(4) : "—"} bbl/ft`} />
        </div>
        <ol className="mt-4 space-y-2">
          {plan.stages.length === 0 ? (
            <li className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
              Need FIT, DP OD, casing ID, and a no-DP pill top.
            </li>
          ) : (
            plan.stages.map((s) => (
              <li key={s.index} className="rounded-xl border border-border px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    Stage {s.index}
                    <span className="ml-2 font-mono text-xs font-normal tabular-nums text-muted-foreground">
                      pill {formatNumber(s.pillTop, 0)}–{formatNumber(s.pillBase, 0)} ft
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    shoe {formatExact(s.shoeEsdStart, 2)} ppge
                  </span>
                </div>
                {s.canReachBase ? (
                  <p className="mt-1 text-sm">
                    RIH to the shoe — remaining pill stays under FIT
                    {isNum(s.shoeEsdAtStop) ? (
                      <span className="text-muted-foreground">
                        {" "}({formatExact(s.shoeEsdAtStop, 2)} ppge)
                      </span>
                    ) : null}
                    .
                  </p>
                ) : (
                  <p className="mt-1 text-sm">
                    Stop at{" "}
                    <span className="font-mono font-medium tabular-nums">{formatNumber(s.stopBit ?? 0, 0)} ft</span>
                    {" "}bit — shoe {formatExact(s.shoeEsdAtStop, 2)} ppge. Circulate extra KMW so the
                    next pill top is that bit depth.
                  </p>
                )}
              </li>
            ))
          )}
        </ol>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Static shoe ESD only — no surge. Verify the last rate in SafeVision before issuing.
        </p>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}
