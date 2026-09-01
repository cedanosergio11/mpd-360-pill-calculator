import { useState } from "react";
import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { buildStageCirculation, buildSteelSchedule } from "@/lib/calc/steel";
import { formatExact, formatNumber, isNum } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function DisplacementView({ inputs, results }: { inputs: WellInputs; results: CalcResults }) {
  const [stages, setStages] = useState<1 | 2 | 3>(1);
  const steel = buildSteelSchedule(inputs, results);
  const stage = buildStageCirculation(inputs, results, stages);
  const visible = steel.rows.filter((r, i) => i === 0 || r.bitDepth === 0 || r.comment || i % 1 === 0).slice(0, 36);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Steel displacement</h3>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Closed-ended drill pipe displaces the spotted pill without circulation. Typical for shallow spots
              below ~6,500 ft MD. Surge automations apply to 6.75 in and 8.5 in holes when FIT − target ≥ 0.6 ppge.
            </p>
          </div>
          {steel.needsSafevision ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-300">
              Model surge in SafeVision
            </span>
          ) : (
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-800 dark:text-emerald-300">
              Window {formatExact(steel.windowPpg, 2)} ppge
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="KMW length" value={`${formatNumber(steel.kmwLength, 0)} ft`} />
          <Mini label="KMW volume" value={`${formatNumber(steel.kmwVolume, 0)} bbl`} />
          <Mini label="Closed disp." value={`${isNum(steel.closedDisp) ? steel.closedDisp.toFixed(4) : "—"} bbl/ft`} />
          <Mini label="KMW out at" value={`${formatNumber(steel.displacedOutDepth, 0)} ft`} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Bit depth</th>
                <th className="pb-2 font-medium">Interface</th>
                <th className="pb-2 font-medium">Trip</th>
                <th className="pb-2 font-medium">Surge</th>
                <th className="pb-2 font-medium">ESD AP</th>
                <th className="pb-2 font-medium">ECD AP</th>
                <th className="pb-2 font-medium">SBP stat</th>
                <th className="pb-2 font-medium">SBP dyn</th>
                <th className="pb-2 font-medium">Comment</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.bitDepth} className="border-t border-border/70">
                  <td className="py-1.5 font-mono tabular-nums">{formatNumber(row.bitDepth, 0)}</td>
                  <td className="py-1.5 font-mono tabular-nums">{formatNumber(row.interfaceDepth, 0)}</td>
                  <td className="py-1.5 font-mono tabular-nums">{row.tripSpeed || "—"}</td>
                  <td className="py-1.5 font-mono tabular-nums">{row.surgePpg ? row.surgePpg.toFixed(3) : "—"}</td>
                  <td className="py-1.5 font-mono tabular-nums">{formatExact(row.emwStatic, 2)}</td>
                  <td className="py-1.5 font-mono tabular-nums">{formatExact(row.emwDynamic, 2)}</td>
                  <td className="py-1.5 font-mono tabular-nums">{formatNumber(row.sbpStatic, 0)}</td>
                  <td className="py-1.5 font-mono tabular-nums">{formatNumber(row.sbpDynamic, 0)}</td>
                  <td className="py-1.5 text-muted-foreground">{row.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          After the first “KMW displaced out of the hole” row, hide remaining trip rows before issuing the PDF.
          Surge values are averages — verify on SafeVision, especially for tapered strings and casing runs.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Pumped displacement</h3>
            <p className="mt-1 text-xs text-muted-foreground">{stage.note}</p>
          </div>
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {([1, 2, 3] as const).map((n) => (
              <Button
                key={n}
                size="sm"
                variant={stages === n ? "default" : "ghost"}
                onClick={() => setStages(n)}
              >
                {n} stage
              </Button>
            ))}
          </div>
        </div>
        <ol className="mt-4 space-y-2 text-sm">
          {stage.tripStops.map((d, i) => (
            <li key={`${d}-${i}`} className="flex justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span>
                Trip {i + 1} — bit to <span className="font-mono tabular-nums">{formatNumber(d, 0)} ft</span>
              </span>
              <span className="text-muted-foreground">Hold target EMW · record ECD then wait 10 min for ESD</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <span>
              Circulate bottoms up ≈ <span className="font-mono tabular-nums">{formatNumber(stage.circulateBbl, 0)} bbl</span>
            </span>
            <span className="text-muted-foreground">
              Step {asRes(inputs.desiredResolution)} bbl; keep shoe ECD below FIT
            </span>
          </li>
        </ol>
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

function asRes(v: number | "") {
  return typeof v === "number" ? v : 20;
}
