import { ATMOSPHERIC_PSI, PSI_PER_PPG_FT, tvdAt } from "@/lib/pill/hydrostatic";
import type { SurveyPoint } from "@/lib/pill/types";
import { asNum, isNum } from "@/lib/utils";
import type { WellInputs } from "./types";

export { ATMOSPHERIC_PSI };

export function surveyFromInputs(inputs: WellInputs): SurveyPoint[] {
  const pts: SurveyPoint[] = [{ md: 0, tvd: 0 }];
  const add = (mdVal: unknown, tvdVal: unknown) => {
    const md = asNum(mdVal);
    const tvd = asNum(tvdVal);
    if (isNum(md) && md > 0 && isNum(tvd) && tvd > 0) {
      pts.push({ md, tvd: Math.min(md, tvd) });
    }
  };
  add(inputs.casingMd, inputs.casingTvd);
  add(inputs.spotMd, inputs.spotTvd);
  add(inputs.anchorMd, inputs.anchorTvd);
  pts.sort((a, b) => a.md - b.md);
  const out: SurveyPoint[] = [];
  for (const p of pts) {
    if (!out.length || p.md > out[out.length - 1].md + 0.5) out.push(p);
  }
  return out;
}

export type EqualizeInput = {
  bitMd: number;
  tvdOf: (md: number) => number;
  kmw: number;
  baseMw: number;
  boreBblFt: number;
  annularBblFt: number;
  pipeKmwVolume: number;
  pipeChaseVolume?: number;
  annularHeightMd: number;
};

export type EqualizeResult = {
  dumpBbl: number;
  remainingPipeKmw: number;
  equalizedAnnularHeightMd: number;
  airCapMd: number;
  extraPsi: number;
  pDp: number;
  pAnn: number;
};

function pDpOf(pipeVol: number, input: EqualizeInput) {
  const bore = Math.max(input.boreBblFt, 1e-12);
  const kmwH = Math.max(0, pipeVol) / bore;
  const chaseH = Math.max(0, input.pipeChaseVolume ?? 0) / bore;
  const kmwTopMd = Math.max(0, input.bitMd - kmwH);
  const chaseTopMd = Math.max(0, kmwTopMd - chaseH);
  const bitTvd = Math.max(0, input.tvdOf(input.bitMd));
  const kmwTopTvd = Math.max(0, input.tvdOf(kmwTopMd));
  const chaseTopTvd = Math.max(0, input.tvdOf(chaseTopMd));
  return (
    ATMOSPHERIC_PSI +
    input.baseMw * PSI_PER_PPG_FT * Math.max(0, kmwTopTvd - chaseTopTvd) +
    input.kmw * PSI_PER_PPG_FT * Math.max(0, bitTvd - kmwTopTvd)
  );
}

function pAnnOf(dump: number, input: EqualizeInput) {
  const bitTvd = Math.max(0, input.tvdOf(input.bitMd));
  const height = input.annularHeightMd + (input.annularBblFt > 0 ? dump / input.annularBblFt : 0);
  return (
    ATMOSPHERIC_PSI +
    input.baseMw * PSI_PER_PPG_FT * bitTvd +
    (input.kmw - input.baseMw) * PSI_PER_PPG_FT * height
  );
}

/** Float U-tube: air cap at 14.7 psi, KMW turns the bit into the annulus, no influx. */
export function equalizeFloatAirCap(input: EqualizeInput): EqualizeResult {
  let lo = 0;
  let hi = Math.max(0, input.pipeKmwVolume);
  for (let i = 0; i < 48; i++) {
    const dump = (lo + hi) / 2;
    if (pDpOf(input.pipeKmwVolume - dump, input) > pAnnOf(dump, input)) lo = dump;
    else hi = dump;
  }
  const dumpBbl = (lo + hi) / 2;
  const remainingPipeKmw = Math.max(0, input.pipeKmwVolume - dumpBbl);
  const equalizedAnnularHeightMd =
    input.annularHeightMd + (input.annularBblFt > 0 ? dumpBbl / input.annularBblFt : 0);
  const hMd = input.boreBblFt > 0 ? remainingPipeKmw / input.boreBblFt : 0;
  const chaseH = input.boreBblFt > 0 ? Math.max(0, input.pipeChaseVolume ?? 0) / input.boreBblFt : 0;
  const extraPsi = (input.kmw - input.baseMw) * PSI_PER_PPG_FT * Math.max(0, dumpBbl / Math.max(input.annularBblFt, 1e-9));
  return {
    dumpBbl,
    remainingPipeKmw,
    equalizedAnnularHeightMd,
    airCapMd: Math.max(0, input.bitMd - hMd - chaseH),
    extraPsi,
    pDp: pDpOf(remainingPipeKmw, input),
    pAnn: pAnnOf(dumpBbl, input),
  };
}

export function tvdOfSurvey(survey: SurveyPoint[]) {
  return (md: number) => tvdAt(survey, md);
}
