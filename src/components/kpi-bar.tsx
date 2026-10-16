import { isNum } from "@/lib/utils";
import { dBbl, dEmw, dPsi } from "@/components/fmt";
import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { esdTargetWithDp } from "@/lib/calc/engine";
import { asNum } from "@/lib/utils";

function Kpi({
  label,
  value,
  unit,
  warn,
}: {
  label: string;
  value: string;
  unit?: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap">{label}</div>
      <div className={`mt-1 font-mono text-lg tabular-nums leading-none sm:text-xl ${warn ? "text-destructive" : "text-foreground"}`}>
        {value}
        {unit ? <span className="ml-1 text-[11px] font-sans font-medium text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  );
}

export function KpiBar({ inputs, results }: { inputs: WellInputs; results: CalcResults }) {
  const withSlug = inputs.pillMode === "withSlug";
  const emw = asNum(inputs.desiredEmw);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Kpi label="MASP" value={dPsi(results.masp)} unit="psi" warn={isNum(results.maxDynamicSbp) && isNum(results.masp) && results.maxDynamicSbp > results.masp} />
      <Kpi label="Total pill" value={dBbl(results.totalPillVol)} unit="bbl" />
      {withSlug ? (
        <Kpi label="Slug volume" value={dBbl(results.slugPillVol)} unit="bbl" />
      ) : isNum(results.bblBackfill) && results.bblBackfill > 0 ? (
        <Kpi label="KMW backfill" value={dBbl(results.bblBackfill)} unit="bbl" warn />
      ) : (
        <Kpi label="Chase" value={dBbl(results.correctedChase)} unit="bbl" />
      )}
      <Kpi
        label="Target ESD"
        value={dEmw(esdTargetWithDp(results, emw))}
        unit="ppge"
      />
    </div>
  );
}
