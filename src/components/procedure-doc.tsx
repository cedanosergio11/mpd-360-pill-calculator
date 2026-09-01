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

      <ol className="procedure-steps">
        <li>
          <span className="procedure-n">1</span>
          <p>Circulate to clean according to the client's best practices.</p>
        </li>
        <li>
          <span className="procedure-n">2</span>
          <p>Back-ream the first stands, holding pressure accordingly.</p>
        </li>
        <li>
          <span className="procedure-n">3</span>
          <div>
            <p>
              Line up the pumping system through the kill line and pull out holding required SBP.
              {withSlug && isNum(results.slugPillVol) ? (
                <span className="mt-1 block text-muted-foreground">
                  Pump {formatNumber(results.slugPillVol, 1)} bbl slug of {formatExact(kmw, 1)} ppg KMW (
                  {formatNumber(results.strokesToPumpSlug, 0)} stk) before lining up on the drill string.
                </span>
              ) : null}
            </p>
          </div>
        </li>
      </ol>

      {results.tripPressures.length > 0 ? (
        <div className="procedure-table-wrap print-avoid mt-3">
          <table className="procedure-table">
            <thead>
              <tr>
                <th>Trip speed</th>
                <th>Static SBP</th>
                <th>Dynamic SBP</th>
              </tr>
            </thead>
            <tbody>
              {results.tripPressures.map((row) => (
                <tr key={row.speed}>
                  <td>{row.speed} ft/min</td>
                  <td>{formatNumber(results.staticStrippingPressure, 0)} psi</td>
                  <td className={row.speed >= 80 ? "procedure-hot" : "procedure-warm"}>
                    {formatNumber(row.dynamicPressure, 0)} psi
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="procedure-caption">
            Highlighted speeds increase the risk of operational issues and are not recommended. Dynamic SBP =
            static stripping + swab.
          </p>
        </div>
      ) : null}

      <ol className="procedure-steps" start={4}>
        <li>
          <span className="procedure-n">4</span>
          <p>
            POOH to <span className="font-mono font-medium tabular-nums">{formatNumber(spot, 0)} ft MD</span>{" "}
            while pumping across the top and hold back pressure to keep proper fill. Spot the pill per the
            schedule below.
          </p>
        </li>
      </ol>

      <div className="procedure-table-wrap mt-3">
        <div className="procedure-table-head">
          <h3>{title}</h3>
          <span>
            {schedule.rows.length
              ? `${schedule.rows.length} steps · ${inputs.sectionType} · ${formatNumber(schedule.finalVolume, 0)} bbl · ${formatNumber(schedule.finalStrokes, 0)} stk`
              : "Waiting for inputs"}
          </span>
        </div>
        <table className="procedure-table procedure-table-dense">
          <thead>
            <tr>
              <th>Step</th>
              <th>SBP psi</th>
              <th>Flow gpm</th>
              <th>Volume bbl</th>
              <th>Strokes</th>
              <th>Density</th>
              <th>Static SBP</th>
              <th className="procedure-notes">Notes</th>
            </tr>
          </thead>
          <tbody>
            {schedule.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 text-center text-muted-foreground">
                  Complete geometry and fluid inputs to generate the spotting schedule.
                </td>
              </tr>
            ) : (
              schedule.rows.map((row) => (
                <tr key={row.step} className={row.density === kmw ? "procedure-kmw-row" : undefined}>
                  <td>{row.step}</td>
                  <td>{typeof row.sbp === "number" ? Math.round(row.sbp) : row.sbp}</td>
                  <td>{Math.round(row.flow)}</td>
                  <td>{Math.round(row.volume)}</td>
                  <td>{Math.round(row.strokes)}</td>
                  <td>
                    {row.density.toFixed(1)}
                    {row.density === kmw ? (
                      <Badge variant="default" className="ml-1.5 print:hidden">
                        KMW
                      </Badge>
                    ) : (
                      <span className="ml-1.5 hidden text-[9px] uppercase tracking-wide text-muted-foreground print:inline">
                        chase
                      </span>
                    )}
                  </td>
                  <td>{Math.round(row.staticSbp)}</td>
                  <td className="procedure-notes text-muted-foreground">{row.activityNotes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isNum(topSlug) && topSlug > 0 ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs">
          NOTE: The last {topSlug} bbl of chase are designated as a top slug. Top slug volume is not included in
          the original pill calculation — replace the last chase rows' density after unprotecting the
          schedule.
        </p>
      ) : null}

      <ol className="procedure-steps" start={5}>
        <li>
          <span className="procedure-n">5</span>
          <p>Line back up on the drill string. Pump the remainder of the pill using the spotting schedule above.</p>
        </li>
        <li>
          <span className="procedure-n">6</span>
          <p>Once the heavy pill is pumped as per the table above, pump off and line up fluid return to the shale shakers.</p>
        </li>
        <li>
          <span className="procedure-n">7</span>
          <p>Perform a conventional flow check.</p>
        </li>
        <li>
          <span className="procedure-n">8</span>
          <p>Remove the RCD bearing.</p>
        </li>
        <li>
          <span className="procedure-n">9</span>
          <p>
            Stasis offline. Recommendation: do not exceed 100 ft/min until the drill string is above the pill.
          </p>
        </li>
        <li>
          <span className="procedure-n">10</span>
          <p>
            Continue conventional POOH / backfill with active mud unless additional KMW is required.
            {isNum(results.bblBackfill) && results.bblBackfill > 0 ? (
              <span className="procedure-note-hot">
                Note: This will require {formatNumber(results.bblBackfill, 0)} bbl of KMW of backfill
                while tripping out
              </span>
            ) : null}
          </p>
        </li>
      </ol>

      <section className="print-avoid mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-3">
          <h3 className="procedure-kicker">As pumped</h3>
          <dl className="mt-1">
            <Line k="Annulus KMW" v={`${formatNumber(asPumpedAnn, 1)} bbl`} />
            <Line k="KMW in DP" v={`${formatNumber(asPumpedStr, 1)} bbl`} />
            <Line k="KMW spotted (fits)" v={`${formatNumber(results.spottedKmwVol, 0)} bbl`} />
            <Line k="KMW needed (no DP)" v={`${formatNumber(results.totalPillVol, 0)} bbl`} />
            {isNum(results.bblBackfill) && results.bblBackfill > 0 ? (
              <Line k="KMW backfill POOH" v={`${formatNumber(results.bblBackfill, 0)} bbl`} />
            ) : (
              <Line k="Chase in DP" v={`${formatNumber(chase, 1)} bbl`} />
            )}
            <Line k="Top of pill (no DP)" v={`${formatNumber(results.topOfPillNoDp, 0)} ft`} />
            <Line k="Anchor EMW" v={`${formatExact(emw, 2)} ppge`} />
            <Line k="ESD @ shoe" v={`${formatExact(results.esdCasingNoDp, 2)} ppge`} />
          </dl>
        </div>
        <div className="rounded-xl border border-border p-3">
          <h3 className="procedure-kicker">After equalizing (float / air cap)</h3>
          <dl className="mt-1">
            <Line k="Annulus KMW" v={`${formatNumber(eqAnnulus, 1)} bbl`} />
            <Line k="KMW left in DP" v={`${formatNumber(results.remainingKmwInDp, 1)} bbl`} />
            <Line k="Dump / VTT" v={`${formatNumber(results.equalizeDumpBbl, 1)} bbl`} />
            <Line k="Air cap to" v={`${formatNumber(results.airCapTopMd, 0)} ft`} />
            <Line k="Anchor EMW" v={`${formatExact(esdTargetWithDp(results, emw), 2)} ppge`} />
            <Line k="ESD @ shoe" v={`${formatExact(esdCasingWithDp(results), 2)} ppge`} />
            <Line
              k="Top of pill"
              v={
                results.topOfPillWithDp === "Surface"
                  ? "Surface"
                  : `${formatNumber(results.topOfPillWithDp as number, 0)} ft`
              }
            />
            <Line k="Annular height" v={`${formatNumber(pillHeightWithDp(results), 0)} ft`} />
          </dl>
        </div>
      </section>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Keep shoe ECD below FIT ({formatExact(fit, 2)} ppge) while spotting — confirm the last KMW rate in
        SafeVision before issuing this procedure. Engineering aid only; not a controlled operational release.
      </p>

      <footer className="procedure-sign mt-6 grid gap-3 border-t-2 border-foreground/30 pt-3 text-xs sm:grid-cols-3">
        <div>
          Completed on
          <div className="procedure-sign-line" />
        </div>
        <div>
          Completed by
          <div className="procedure-sign-line" />
        </div>
        <div>
          Verified / SafeVision
          <div className="procedure-sign-line" />
        </div>
        <div className="sm:col-span-3 flex flex-wrap justify-between gap-2 pt-1 text-muted-foreground">
          <span>SDS-FRM-087 · Trust but verify against SafeVision.</span>
          <span>
            {inputs.wellName || "Well"} · {formatVersion()}
          </span>
        </div>
      </footer>
    </article>
  );
}
