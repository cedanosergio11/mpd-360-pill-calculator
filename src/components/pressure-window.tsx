import { asNum, isNum } from "@/lib/utils";
import { dEmw } from "@/components/fmt";
import { esdCasingWithDp, esdTargetWithDp } from "@/lib/calc/engine";
import type { CalcResults, WellInputs } from "@/lib/calc/types";

export function PressureWindow({ inputs, results }: { inputs: WellInputs; results: CalcResults }) {
  const mw = asNum(inputs.currentMw);
  const emw = asNum(inputs.desiredEmw);
  const fit = asNum(inputs.fit);
  const kmw = asNum(inputs.kmw);
  const esdShoe = esdCasingWithDp(results);
  const esdTgt = esdTargetWithDp(results, emw);
  if (![mw, emw, fit].every(isNum)) return null;

  const min = mw - 0.4;
  const max = Math.max(fit, isNum(kmw) ? kmw : fit) + 0.3;
  const pct = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const window = fit - emw;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">MPD window</h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          FIT − target {dEmw(window)} ppge
        </span>
      </div>
      <div className="relative mt-5 h-2.5 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 rounded-full bg-primary/40"
          style={{ left: pct(mw), width: `calc(${pct(fit)} - ${pct(mw)})` }}
        />
        <Tick left={pct(mw)} label={`MW ${dEmw(mw)}`} />
        <Tick left={pct(emw)} label={`Target ${dEmw(emw)}`} accent />
        <Tick left={pct(fit)} label={`FIT ${dEmw(fit)}`} />
      </div>
      {isNum(esdTgt) ? (
        <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground">
          Balanced ESD with DP at target {dEmw(esdTgt)} ppge
          {isNum(esdShoe) ? ` · shoe ${dEmw(esdShoe)} ppge` : ""}. Keep shoe ECD below FIT while
          spotting — pump the last KMW rate in SafeVision before issuing the PDF.
        </p>
      ) : (
        <div className="h-6" />
      )}
    </div>
  );
}

function Tick({ left, label, accent }: { left: string; label: string; accent?: boolean }) {
  return (
    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left }}>
      <div className={`mx-auto h-4 w-0.5 ${accent ? "bg-primary" : "bg-foreground/70"}`} />
      <div className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap text-center">
        <div className="font-mono text-[10px] tabular-nums text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
