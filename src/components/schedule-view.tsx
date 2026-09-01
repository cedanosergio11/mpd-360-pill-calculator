import type { CalcResults, ScheduleResult, WellInputs } from "@/lib/calc/types";
import { ScheduleSbpChart } from "@/components/schedule-chart";
import { formatNumber, isNum } from "@/lib/utils";

export function ScheduleView({
  inputs,
  results,
  schedule,
}: {
  inputs: WellInputs;
  results: CalcResults;
  schedule: ScheduleResult;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Static stripping", formatNumber(results.staticStrippingPressure, 0), "psi"],
          ["Max dynamic SBP", formatNumber(results.maxDynamicSbp, 0), "psi"],
          ["Final pump volume", formatNumber(schedule.finalVolume, 0), "bbl"],
          ["Final strokes", formatNumber(schedule.finalStrokes, 0), "stk"],
        ].map(([l, v, u]) => (
          <div key={l} className="rounded-xl border border-border bg-card px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{l}</div>
            <div className="mt-1 font-mono text-lg tabular-nums">
              {v} <span className="text-xs text-muted-foreground">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Trip speed pressure table</h3>
          <span className="text-[11px] text-muted-foreground">
            Auto: {results.selectedTripTable === "other" ? "custom" : `${results.selectedTripTable} in`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Speed</th>
                <th className="pb-2 font-medium">Swab AP</th>
                <th className="pb-2 font-medium">Swab</th>
                <th className="pb-2 font-medium">Dynamic SBP</th>
              </tr>
            </thead>
            <tbody>
              {results.tripPressures.map((row) => (
                <tr key={row.speed} className="border-t border-border/70">
                  <td className="py-1.5 font-mono tabular-nums">{row.speed} ft/min</td>
                  <td className="py-1.5 font-mono tabular-nums">{row.ppge.toFixed(2)} ppge</td>
                  <td className="py-1.5 font-mono tabular-nums">{formatNumber(row.swabPressure, 0)} psi</td>
                  <td className="py-1.5 font-mono tabular-nums">{formatNumber(row.dynamicPressure, 0)} psi</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Highlighted high speeds increase operational risk and are not recommended. Dynamic SBP = static
          stripping + swab.
        </p>
      </section>

      {schedule.rows.length ? <ScheduleSbpChart rows={schedule.rows} /> : null}

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {inputs.pillMode === "withSlug" ? "Standard Pill — With Slug" : "Standard Pill — No Slug"}
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {schedule.rows.length
              ? `${schedule.rows.length} steps · ${inputs.sectionType} flow`
              : "Waiting for inputs"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Step</th>
                <th className="pb-2 font-medium">SBP</th>
                <th className="pb-2 font-medium">Flow</th>
                <th className="pb-2 font-medium">Volume</th>
                <th className="pb-2 font-medium">Strokes</th>
                <th className="pb-2 font-medium">Density</th>
                <th className="pb-2 font-medium">Static SBP</th>
                <th className="pb-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((row) => (
                <tr key={row.step} className="border-t border-border/70">
                  <td className="py-1.5 font-mono tabular-nums">{row.step}</td>
                  <td className="py-1.5 font-mono tabular-nums">
                    {typeof row.sbp === "number" ? Math.round(row.sbp) : row.sbp}
                  </td>
                  <td className="py-1.5 font-mono tabular-nums">{Math.round(row.flow)}</td>
                  <td className="py-1.5 font-mono tabular-nums">{Math.round(row.volume)}</td>
                  <td className="py-1.5 font-mono tabular-nums">{Math.round(row.strokes)}</td>
                  <td className="py-1.5 font-mono tabular-nums">{row.density.toFixed(2)}</td>
                  <td className="py-1.5 font-mono tabular-nums">{Math.round(row.staticSbp)}</td>
                  <td className="py-1.5 text-muted-foreground">{row.activityNotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isNum(results.resolutionPressureGain) ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {asNumSafe(inputs.desiredResolution)} bbl resolution drops SBP by{" "}
            {formatNumber(results.resolutionPressureGain, 0)} psi ({formatNumber(results.resolutionHeightGain, 0)} ft
            of annular height). Production sections step flow down after SBP reaches 50 psi.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function asNumSafe(v: number | ""): number | string {
  return typeof v === "number" ? v : "—";
}
