import {
  capBblFt,
  ceilingMath,
  isNum,
  round,
  roundUp,
  safeDiv,
} from "@/lib/utils";
import { equalizeFloatAirCap, surveyFromInputs, tvdOfSurvey } from "./equalize";
import type { TaperedResults, WellInputs } from "./types";
import { calcTapered, type TripStatic, type WellCaps } from "./engine";

type NoDpPill = {
  heightPillNoDp: number;
  tapered: TaperedResults;
  useTapered: boolean;
  totalPillVol: number;
  requiredVolAnnulus: number;
  calculatedChase: number;
  correctedChase: number;
  minHeightPillWithDp: number;
  correctedPillVol: number;
  finalKwm: number;
  bblBackfill: number;
  pumpedAnnulus: number;
  spottedKmwVol: number;
};

/** No-DP pill volume, height, chase, and KMW backfill. */
export function calcNoDpPill(inputs: WellInputs, caps: WellCaps, pressures: TripStatic): NoDpPill {
  const { targetPressure, pressureGradient } = pressures;
  const {
    spotMd,
    casingMd,
    drillStringCap,
    drillStringVolAtSpot,
    casingCap,
    annularCap,
    annularBelowShoe,
    drillStringOpenHole,
    kmwRoomWithPipe,
  } = caps;
  const heightPillNoDp = ceilingMath(safeDiv(targetPressure, pressureGradient), 10);

  const tapered = calcTapered(inputs, heightPillNoDp);
  const useTapered = inputs.taperedOn === true;

  const openHoleFullCap = capBblFt(caps.openHoleDia);
  const heightInOh = drillStringOpenHole > 0 ? Math.min(heightPillNoDp, drillStringOpenHole) : 0;
  const heightInCsg = Math.max(0, heightPillNoDp - heightInOh);
  const totalPillVolRaw =
    drillStringOpenHole > 0
      ? heightInOh * openHoleFullCap + heightInCsg * casingCap
      : heightPillNoDp * casingCap;
  const totalPillVol = useTapered ? tapered.totalPillVol : roundUp(totalPillVolRaw, 0);
  const requiredVolAnnulus = useTapered
    ? tapered.pillNeededAnnulus
    : drillStringOpenHole > 0
      ? heightInOh * annularBelowShoe + heightInCsg * annularCap
      : heightPillNoDp * annularCap;
  const calculatedChase = useTapered
    ? tapered.additionalChase
    : drillStringCap * spotMd - (totalPillVol - requiredVolAnnulus);
  const correctedChase = calculatedChase <= 0 ? 0 : calculatedChase;
  const capPipeCsg = annularCap + drillStringCap;
  const capPipeOh = annularBelowShoe + drillStringCap;
  let minHeightPillWithDp = safeDiv(totalPillVol, capPipeCsg);
  if (spotMd > casingMd && isNum(capPipeOh) && capPipeOh > 1e-12 && isNum(totalPillVol)) {
    const volOhWithPipe = drillStringOpenHole * capPipeOh;
    minHeightPillWithDp =
      totalPillVol <= volOhWithPipe
        ? safeDiv(totalPillVol, capPipeOh)
        : drillStringOpenHole + (totalPillVol - volOhWithPipe) / capPipeCsg;
  }
  const correctedPillVol = useTapered
    ? round(requiredVolAnnulus, 0)
    : round(requiredVolAnnulus, 0);
  const finalKwm = useTapered
    ? tapered.mudInDp
    : correctedChase === 0
      ? drillStringVolAtSpot
      : totalPillVol - requiredVolAnnulus;
  const bblBackfill = !isNum(kmwRoomWithPipe)
    ? 0
    : Math.max(0, round((isNum(totalPillVol) ? totalPillVol : 0) - kmwRoomWithPipe, 0));
  const pumpedAnnulus =
    bblBackfill > 0 ? Math.max(0, kmwRoomWithPipe - drillStringVolAtSpot) : correctedPillVol;
  const spottedKmwVol = bblBackfill > 0
    ? kmwRoomWithPipe
    : (isNum(correctedPillVol) ? correctedPillVol : 0) + (isNum(finalKwm) ? finalKwm : 0);

  return {
    heightPillNoDp,
    tapered,
    useTapered,
    totalPillVol,
    requiredVolAnnulus,
    calculatedChase,
    correctedChase,
    minHeightPillWithDp,
    correctedPillVol,
    finalKwm,
    bblBackfill,
    pumpedAnnulus,
    spottedKmwVol,
  };
}

type EqualizeExtra = {
  dumpBbl: number;
  remainingPipeKmw: number;
  airCapMd: number;
  minHeightWithDp: number;
  balancedAdditionalPsi: number;
  addPpgCsg: number;
  addPpgTarget: number;
  esdCasingNoDp: number;
  balancedEsdCasing: number;
  anchorPointEsd: number;
};

/** Float air-cap equalize plus extra ppg at casing and anchor. */
export function calcEqualizeExtraPpg(inputs: WellInputs, caps: WellCaps, pill: NoDpPill, pressures: TripStatic): EqualizeExtra {
  const { currentMw, kmw, desiredEmw, targetPressure, casingTvd, anchorTvd } = pressures;
  const { spotMd, spotTvd, drillStringCap, annularCap } = caps;
  const { finalKwm, correctedChase, heightPillNoDp } = pill;
  const eq = equalizeFloatAirCap({
    bitMd: spotMd,
    tvdOf: tvdOfSurvey(surveyFromInputs(inputs)),
    kmw,
    baseMw: currentMw,
    boreBblFt: drillStringCap,
    annularBblFt: annularCap,
    pipeKmwVolume: isNum(finalKwm) ? finalKwm : 0,
    pipeChaseVolume: isNum(correctedChase) ? correctedChase : 0,
    annularHeightMd: heightPillNoDp,
  });
  const minHeightWithDp = eq.equalizedAnnularHeightMd;
  const balancedAdditionalPsi = eq.extraPsi;
  const addPpgCsg = safeDiv(balancedAdditionalPsi, 0.052 * casingTvd);
  const addPpgTarget = safeDiv(balancedAdditionalPsi, 0.052 * anchorTvd);
  const esdCasingNoDp =
    spotMd <= caps.casingMd
      ? safeDiv(targetPressure, 0.052 * casingTvd) + currentMw
      : ((heightPillNoDp - spotTvd + casingTvd) * (kmw - currentMw)) / casingTvd + currentMw;
  const balancedEsdCasing = esdCasingNoDp + addPpgCsg;
  const anchorPointEsd = desiredEmw + addPpgTarget;
  return {
    dumpBbl: eq.dumpBbl,
    remainingPipeKmw: eq.remainingPipeKmw,
    airCapMd: eq.airCapMd,
    minHeightWithDp,
    balancedAdditionalPsi,
    addPpgCsg,
    addPpgTarget,
    esdCasingNoDp,
    balancedEsdCasing,
    anchorPointEsd,
  };
}

type SlugAt200 = {
  slugPressure: number;
  slugPillVol: number;
  strokesToPumpSlug: number;
  pillVolAtSpot: number;
  slugFits: boolean;
  slugFallOut: number;
  slugFallHeight: number;
  chaseWithSlug: number;
  slugPpgEquivalent: number;
  slugPsiEquivalent: number;
  slugApl: number;
  safevisionSlug: number;
  pressureDifferentialSlug: number;
};

/** Slug volume at 200 ft/min swab (Excel lock — do not retune). */
export function calcSlugAt200FtMin(caps: WellCaps, pill: NoDpPill, pressures: TripStatic): SlugAt200 {
  const {
    tripPressures,
    maxDynamicSbp,
    pressureGradient,
    overbalanceSlug,
    pumpDisp,
    currentMw,
    desiredEmw,
    safevisionNoSlug,
    anchorTvd,
  } = pressures;
  const { drillStringCap, drillStringVolAtSpot, casingCap, idDp } = caps;
  const { useTapered, tapered, totalPillVol, correctedChase } = pill;
  const swab200 = tripPressures.find((t) => t.speed === 200)?.dynamicPressure ?? maxDynamicSbp;
  const slugPressure = swab200 + overbalanceSlug;
  const slugPillVol = useTapered
    ? tapered.dpVolume
      ? (slugPressure / pressureGradient) * capBblFt(idDp)
      : (slugPressure / pressureGradient) * drillStringCap
    : (slugPressure / pressureGradient) * drillStringCap;
  const strokesToPumpSlug = safeDiv(slugPillVol, pumpDisp);
  const pillVolAtSpot = totalPillVol - slugPillVol;
  const slugFits = drillStringVolAtSpot > slugPillVol;
  const slugFallOut = slugFits ? 0 : round(slugPillVol - drillStringVolAtSpot, 0);
  const slugFallHeight = safeDiv(slugFallOut, casingCap);
  const chaseWithSlug = pillVolAtSpot + correctedChase;
  const slugPpgEquivalent = safeDiv(slugFallHeight * pressureGradient, 0.052 * anchorTvd);
  const slugPsiEquivalent = slugPpgEquivalent * 0.052 * anchorTvd;
  const safevisionSlug = safevisionNoSlug + (isNum(slugPpgEquivalent) ? slugPpgEquivalent : 0);
  const pressureDifferentialSlug = (desiredEmw - safevisionSlug) * 0.052 * anchorTvd;
  const slugApl = (safevisionSlug - currentMw) * 0.052 * anchorTvd;
  return {
    slugPressure,
    slugPillVol,
    strokesToPumpSlug,
    pillVolAtSpot,
    slugFits,
    slugFallOut,
    slugFallHeight,
    chaseWithSlug,
    slugPpgEquivalent,
    slugPsiEquivalent,
    slugApl,
    safevisionSlug,
    pressureDifferentialSlug,
  };
}
