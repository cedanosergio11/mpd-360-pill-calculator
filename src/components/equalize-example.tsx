import { equalizeFloatAirCap, surveyFromInputs, tvdOfSurvey } from "@/lib/calc/equalize";
import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { asNum, formatExact, formatNumber, isNum } from "@/lib/utils";

function Eq({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`overflow-x-auto font-mono text-[12px] leading-relaxed tabular-nums ${className ?? ""}`}>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono tabular-nums">{v}</dd>
    </div>
  );
}

export function EqualizeWorkedExample({
  inputs,
  results,
}: {
  inputs: WellInputs;
  results: CalcResults;
}) {
  const od = asNum(inputs.odDp);
  const id = asNum(inputs.idDp);
  const idCsg = asNum(inputs.idCasing);
  const kmw = asNum(inputs.kmw);
  const mw = asNum(inputs.currentMw);
  const spotMd = asNum(inputs.spotMd);
  const emw = asNum(inputs.desiredEmw);
  const C_ann = results.annularCap;
  const C_dp = results.drillStringCap;
  const V0 = results.finalKwm;
  const chase = results.correctedChase;
  const h0 = results.heightPillNoDp;

  if (![od, id, idCsg, kmw, mw, spotMd, C_ann, C_dp, V0, h0].every(isNum) || C_ann <= 0 || C_dp <= 0) {
    return null;
  }

  const tvdOf = tvdOfSurvey(surveyFromInputs(inputs));
  const eq = equalizeFloatAirCap({
    bitMd: spotMd,
    tvdOf,
    kmw,
    baseMw: mw,
    boreBblFt: C_dp,
    annularBblFt: C_ann,
    pipeKmwVolume: V0,
    pipeChaseVolume: isNum(chase) ? chase : 0,
    annularHeightMd: h0,
  });

  const bitTvd = tvdOf(spotMd);
  const hKmw0 = V0 / C_dp;
  const hChase = (isNum(chase) ? chase : 0) / C_dp;
  const kmwTop0 = Math.max(0, spotMd - hKmw0);
  const hKmw1 = eq.remainingPipeKmw / C_dp;
  const dh = eq.dumpBbl / C_ann;
  const pAnn0 =
    14.7 + mw * 0.052 * bitTvd + (kmw - mw) * 0.052 * h0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Equalize worked example</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {inputs.wellName || "Current well"} · float U-tube, air cap at 14.7 psi, no influx into the DP. Find dump{" "}
        <span className="font-mono">V</span> so P at the bit from the DP equals P from the annulus.
      </p>

      <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        1. Capacities
      </h4>
      <Eq>{`C_ann = (ID_csg² − OD_DP²) / 1029.4 = (${idCsg.toFixed(3)}² − ${od.toFixed(3)}²) / 1029.4 = ${C_ann.toFixed(5)} bbl/ft`}</Eq>
      <Eq>{`C_DP  = ID_DP² / 1029.4 = ${id.toFixed(3)}² / 1029.4 = ${C_dp.toFixed(5)} bbl/ft`}</Eq>

      <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        2. As pumped (V = 0 dump)
      </h4>
      <dl>
        <Row k="KMW in DP" v={`${formatNumber(V0, 1)} bbl`} />
        <Row k="Chase in DP" v={`${formatNumber(isNum(chase) ? chase : 0, 1)} bbl`} />
        <Row k="KMW height in DP" v={`${formatNumber(hKmw0, 0)} ft  (${formatNumber(V0, 1)} / C_DP)`} />
        <Row k="Top of KMW in DP" v={`${formatNumber(kmwTop0, 0)} ft MD`} />
        <Row k="Annular pill height" v={`${formatNumber(h0, 0)} ft`} />
        <Row k="Bit TVD" v={`${formatNumber(bitTvd, 0)} ft`} />
      </dl>
      <Eq className="mt-2">{`P_ann = 14.7 + 0.052×${mw.toFixed(1)}×${formatNumber(bitTvd, 0)} + 0.052×(${kmw.toFixed(1)}−${mw.toFixed(1)})×${formatNumber(h0, 0)} = ${formatNumber(pAnn0, 0)} psi`}</Eq>
      <Eq>{`P_DP  = 14.7 + 0.052×ρ_base×TVD_chase + 0.052×${kmw.toFixed(1)}×TVD_KMW`}</Eq>
      <p className="mt-1 text-xs text-muted-foreground">
        If DP pressure is higher than the annulus, KMW falls through the float until the two sides match. Air
        (not base mud) fills the DP from RKB down to the top of remaining KMW.
      </p>

      <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        3. Solve P_DP(V) = P_ann(V)
      </h4>
      <Eq>{`h_ann(V) = ${formatNumber(h0, 0)} + V / C_ann`}</Eq>
      <Eq>{`h_KMW,DP(V) = (${formatNumber(V0, 1)} − V) / C_DP`}</Eq>
      <dl className="mt-2">
        <Row k="Dump V (VTT gain)" v={`${formatNumber(eq.dumpBbl, 2)} bbl`} />
        <Row k="Δh in annulus" v={`${formatNumber(dh, 0)} ft  (${formatNumber(eq.dumpBbl, 2)} / C_ann)`} />
        <Row k="P at bit (balanced)" v={`${formatNumber(eq.pDp, 0)} psi  (DP = annulus)`} />
      </dl>

      <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        4. After equalizing
      </h4>
      <dl>
        <Row k="KMW left in DP" v={`${formatNumber(eq.remainingPipeKmw, 1)} bbl  (${formatNumber(hKmw1, 0)} ft)`} />
        <Row k="Air cap to" v={`${formatNumber(eq.airCapMd, 0)} ft MD`} />
        <Row k="Annular KMW height" v={`${formatNumber(eq.equalizedAnnularHeightMd, 0)} ft`} />
        <Row k="Extra psi from dump" v={`${formatNumber(eq.extraPsi, 0)} psi`} />
        <Row
          k="ΔEMW at anchor"
          v={`${formatExact(results.addPpgTarget, 3)} ppg  →  ${formatExact(isNum(emw) ? emw + results.addPpgTarget : results.anchorPointEsd, 2)} ppge`}
        />
      </dl>
      <Eq>{`ΔP = 0.052 × (${kmw.toFixed(1)} − ${mw.toFixed(1)}) × V / C_ann = ${formatNumber(eq.extraPsi, 1)} psi`}</Eq>
    </section>
  );
}
