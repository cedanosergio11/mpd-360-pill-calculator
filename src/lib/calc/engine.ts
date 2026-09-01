import {
  annularBblFt,
  asNum,
  capBblFt,
  ceilingMath,
  isNum,
  round,
  roundUp,
  safeDiv,
} from "@/lib/utils";
import { TRIP_TABLES, tripTableKey } from "./tables";
import { equalizeFloatAirCap, surveyFromInputs, tvdOfSurvey } from "./equalize";
import type {
  CalcResults,
  CementResults,
  TaperedResults,
  TripPressure,
  WarningItem,
  WellInputs,
} from "./types";

function n(inputs: WellInputs, key: keyof WellInputs): number {
  return asNum(inputs[key]);
}

function swabTable(inputs: WellInputs, hole: number): [number, number][] {
  const key = tripTableKey(hole);
  if (key === "other") {
    const custom = inputs.customSwab?.length === 7 ? inputs.customSwab : TRIP_TABLES.other.map((r) => r[1]);
    return TRIP_TABLES.other.map(([speed], i) => [speed, custom[i] ?? 0]);
  }
  return TRIP_TABLES[key];
}

function calcCement(inputs: WellInputs): CementResults {
  const desiredEsd = n(inputs, "cementDesiredEsd");
  const newCasingOd = n(inputs, "newCasingOd");
  const newCasingId = n(inputs, "newCasingId");
  const cementMw = n(inputs, "cementMw");
  const tdDepth = n(inputs, "tdDepth");
  const anchorMd = n(inputs, "anchorMd");
  const casingMd = n(inputs, "casingMd");
  const idCasing = n(inputs, "idCasing");
  const openHoleDia = n(inputs, "openHoleDia");
  const kmw = n(inputs, "kmw");
  const casingTvd = n(inputs, "casingTvd");
  const anchorTvd = n(inputs, "anchorTvd");

  const staticPressure = (desiredEsd - cementMw) * 0.052 * (isNum(anchorTvd) ? anchorTvd : casingTvd);
  const annularCapacity = annularBblFt(idCasing, newCasingOd);
  const openHoleCapacity = annularBblFt(openHoleDia, newCasingOd);
  const casingStringCapacity = capBblFt(newCasingId);
  const openHoleToBoc = tdDepth - anchorMd;
  const bocToShoe = anchorMd - casingMd;
  const requiredPillHeight = ceilingMath(
    safeDiv(staticPressure, (kmw - cementMw) * 0.052),
    10,
  );
  const requiredCementPillVol = roundUp(requiredPillHeight * annularCapacity, 0);
  const totalCasingStringVol = casingStringCapacity * tdDepth;
  const chaseToTd = totalCasingStringVol - requiredCementPillVol;
  const chaseExitCasing = requiredCementPillVol;
  const chaseBocToShoe = openHoleToBoc * openHoleCapacity;
  const chaseBocShoePlusPill = bocToShoe * openHoleCapacity + requiredCementPillVol;
  const totalChase = chaseBocShoePlusPill + chaseBocToShoe + totalCasingStringVol;
  const topOfPill = casingMd - requiredPillHeight;

  return {
    staticPressure,
    annularCapacity,
    openHoleCapacity,
    casingStringCapacity,
    openHoleToBoc,
    bocToShoe,
    requiredPillHeight,
    requiredCementPillVol,
    totalCasingStringVol,
    chaseToTd,
    chaseExitCasing,
    chaseBocToShoe,
    chaseBocShoePlusPill,
    totalChase,
    topOfPill,
  };
}

function calcTapered(inputs: WellInputs, heightPillNoDp: number): TaperedResults {
  const spotMd = n(inputs, "spotMd");
  const ohDia = n(inputs, "openHoleDia");
  const linerId = n(inputs, "linerId");
  const linerHanger = n(inputs, "linerHangerMd");
  const linerShoe = n(inputs, "linerShoeMd");
  const casingIdLarger = n(inputs, "casingIdLarger");
  const odDp1 = n(inputs, "odDp1") || n(inputs, "odDp");
  const idDp1 = n(inputs, "idDp1") || n(inputs, "idDp");
  const lengthDp1 = n(inputs, "lengthDp1");
  const idDp2 = n(inputs, "idDp2");

  const lengthDp2 = spotMd - (isNum(lengthDp1) ? lengthDp1 : 0);
  const openHoleLength = !isNum(linerShoe) || spotMd <= linerShoe ? 0 : spotMd - linerShoe;
  const linerLength = (isNum(linerShoe) ? linerShoe : 0) - (isNum(linerHanger) ? linerHanger : 0);

  const ohCap = capBblFt(ohDia);
  const linerCap = capBblFt(linerId);
  const largeCap = capBblFt(casingIdLarger);
  const remainingHeight = heightPillNoDp - (linerLength + openHoleLength);

  const totalPillVol =
    ohCap * openHoleLength + linerCap * linerLength + largeCap * remainingHeight;

  const pillNeededAnnulus =
    annularBblFt(ohDia, odDp1) * openHoleLength +
    annularBblFt(linerId, odDp1) * linerLength +
    annularBblFt(casingIdLarger, odDp1) * remainingHeight;

  const dpVolume = capBblFt(idDp2) * lengthDp2 + capBblFt(idDp1) * (isNum(lengthDp1) ? lengthDp1 : 0);
  const mudInAnnulusAfterPumping = totalPillVol - dpVolume;
  const additionalChase = pillNeededAnnulus - mudInAnnulusAfterPumping;
  const mudInDp = dpVolume - additionalChase;

  return {
    lengthDp2,
    openHoleLength,
    linerLength,
    totalPillVol,
    pillNeededAnnulus,
    dpVolume,
    mudInAnnulusAfterPumping,
    additionalChase,
    mudInDp,
  };
}

type TripStatic = {
  currentMw: number;
  kmw: number;
  anchorTvd: number;
  casingTvd: number;
  desiredEmw: number;
  desiredResolution: number;
  pumpDisp: number;
  overbalanceSlug: number;
  safevisionNoSlug: number;
  staticStrippingPressure: number;
  selectedTripTable: ReturnType<typeof tripTableKey>;
  tripPressures: TripPressure[];
  maxSwabPressure: number;
  maxDynamicSbp: number;
  pressureGradient: number;
  targetPressure: number;
  masp: number;
  initialApl: number;
  initialAplAnchor: number;
};

/** Trip/swab table plus static SBP, MASP, and APL. */
function calcTripAndStatic(inputs: WellInputs): TripStatic {
  const currentMw = n(inputs, "currentMw");
  const kmw = n(inputs, "kmw");
  const anchorTvd = n(inputs, "anchorTvd");
  const desiredEmw = n(inputs, "desiredEmw");
  const openHoleDia = n(inputs, "openHoleDia");
  const fit = n(inputs, "fit");
  const safevisionNoSlug = n(inputs, "safevisionNoSlug");
  const staticStrippingPressure = (desiredEmw - currentMw) * 0.052 * anchorTvd;
  const selectedTripTable = tripTableKey(openHoleDia);
  const table = swabTable(inputs, openHoleDia);
  const tripPressures: TripPressure[] = table.map(([speed, ppge]) => {
    const swabPressure = ceilingMath(ppge * 0.052 * anchorTvd, 10);
    return {
      speed,
      ppge,
      swabPressure,
      dynamicPressure: staticStrippingPressure + swabPressure,
    };
  });
  const maxSwabPressure = tripPressures.at(-1)?.swabPressure ?? Number.NaN;
  const maxDynamicSbp = staticStrippingPressure + maxSwabPressure;
  const pressureGradient = (kmw - currentMw) * 0.052;
  const targetPressure = (desiredEmw - currentMw) * 0.052 * anchorTvd;
  const masp = (fit - currentMw) * 0.052 * anchorTvd;
  const initialApl = (safevisionNoSlug - currentMw) * 0.052 * anchorTvd;
  const initialAplAnchor = initialApl;
  return {
    currentMw,
    kmw,
    anchorTvd,
    casingTvd: n(inputs, "casingTvd"),
    desiredEmw,
    desiredResolution: n(inputs, "desiredResolution"),
    pumpDisp: n(inputs, "pumpDisp"),
    overbalanceSlug: n(inputs, "overbalanceSlug"),
    safevisionNoSlug,
    staticStrippingPressure,
    selectedTripTable,
    tripPressures,
    maxSwabPressure,
    maxDynamicSbp,
    pressureGradient,
    targetPressure,
    masp,
    initialApl,
    initialAplAnchor,
  };
}

type WellCaps = {
  spotMd: number;
  spotTvd: number;
  casingMd: number;
  idDp: number;
  odDp: number;
  idCasing: number;
  openHoleDia: number;
  drillStringCap: number;
  drillStringVolAtSpot: number;
  casingCap: number;
  annularCap: number;
  annularBelowShoe: number;
  drillStringOpenHole: number;
  openHoleCap: number;
  volumeBelowShoe: number;
  casingVolAtSpot: number;
  annularAtSpot: number;
  kmwRoomWithPipe: number;
  dsVolUnrounded: number;
};

/** Capacities and room-with-pipe (casing annulus + OH annulus + DP bore). */
function calcCapacitiesAndRoom(inputs: WellInputs): WellCaps {
  const spotMd = n(inputs, "spotMd");
  const spotTvd = n(inputs, "spotTvd");
  const casingMd = n(inputs, "casingMd");
  const idDp = n(inputs, "idDp");
  const odDp = n(inputs, "odDp");
  const idCasing = n(inputs, "idCasing");
  const openHoleDia = n(inputs, "openHoleDia");
  const drillStringCap = capBblFt(idDp);
  const drillStringVolAtSpot = round(drillStringCap * spotMd, 0);
  const casingCap = capBblFt(idCasing);
  const annularCap = annularBblFt(idCasing, odDp);
  const annularBelowShoe = spotMd <= casingMd ? 0 : annularBblFt(openHoleDia, odDp);
  const drillStringOpenHole = spotMd <= casingMd ? 0 : spotMd - casingMd;
  const openHoleCap = annularBblFt(openHoleDia, odDp);
  const volumeBelowShoe = drillStringOpenHole * openHoleCap;
  const casingVolAtSpot =
    spotMd <= casingMd ? casingCap * spotMd : casingCap * casingMd - volumeBelowShoe;
  const annularAtSpot =
    spotMd <= casingMd
      ? annularCap * spotMd
      : annularCap * (spotMd - drillStringOpenHole) + annularBelowShoe * drillStringOpenHole;
  const dsVolUnrounded = drillStringCap * spotMd;
  const kmwRoomWithPipe = round(
    (isNum(annularAtSpot) ? annularAtSpot : 0) + dsVolUnrounded,
    0,
  );
  return {
    spotMd,
    spotTvd,
    casingMd,
    idDp,
    odDp,
    idCasing,
    openHoleDia,
    drillStringCap,
    drillStringVolAtSpot,
    casingCap,
    annularCap,
    annularBelowShoe,
    drillStringOpenHole,
    openHoleCap,
    volumeBelowShoe,
    casingVolAtSpot,
    annularAtSpot,
    kmwRoomWithPipe,
    dsVolUnrounded,
  };
}

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
function calcNoDpPill(inputs: WellInputs, caps: WellCaps, pressures: TripStatic): NoDpPill {
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
function calcEqualizeExtraPpg(inputs: WellInputs, caps: WellCaps, pill: NoDpPill, pressures: TripStatic): EqualizeExtra {
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
function calcSlugAt200FtMin(caps: WellCaps, pill: NoDpPill, pressures: TripStatic): SlugAt200 {
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

export function calculate(inputs: WellInputs): CalcResults {
  const pressures = calcTripAndStatic(inputs);
  const caps = calcCapacitiesAndRoom(inputs);
  const pill = calcNoDpPill(inputs, caps, pressures);
  const eqx = calcEqualizeExtraPpg(inputs, caps, pill, pressures);
  const {
    desiredEmw,
    desiredResolution,
    currentMw,
    safevisionNoSlug,
    anchorTvd,
  } = pressures;
  const resolutionHeightGain = safeDiv(desiredResolution, caps.annularCap);
  const resolutionPressureGain = (pressures.kmw - currentMw) * resolutionHeightGain * 0.052;
  const pressureDifferential = (desiredEmw - safevisionNoSlug) * 0.052 * anchorTvd;

  const slug = calcSlugAt200FtMin(caps, pill, pressures);

  const pillHeightPosition =
    eqx.minHeightWithDp < caps.spotMd && caps.spotMd > pill.heightPillNoDp
      ? eqx.minHeightWithDp - caps.spotMd
      : 0;
  const correctedTotalPillAtSpot = pill.totalPillVol - round(pillHeightPosition * caps.annularCap, 0);
  const totalPillVolAtSpotNoSlug =
    caps.spotMd > eqx.minHeightWithDp ? pill.totalPillVol : correctedTotalPillAtSpot;
  const totalPillVolAtSpotWithSlug =
    slug.pillVolAtSpot < caps.annularAtSpot ? pill.totalPillVol : correctedTotalPillAtSpot;

  const topOfPillWithDp: number | "Surface" =
    isNum(caps.spotMd) && isNum(eqx.minHeightWithDp)
      ? caps.spotMd > eqx.minHeightWithDp
        ? caps.spotMd - eqx.minHeightWithDp
        : "Surface"
      : Number.NaN;
  const topOfPillNoDp = caps.spotMd - pill.heightPillNoDp;
  const drillStringPillHeight = safeDiv(pill.finalKwm, caps.drillStringCap);
  const topOfPillInsideDp =
    isNum(caps.spotMd) && isNum(drillStringPillHeight)
      ? Math.max(0, caps.spotMd - drillStringPillHeight)
      : Number.NaN;
  const kwmPlusChase = roundUp(
    pill.bblBackfill > 0
      ? pill.spottedKmwVol + (isNum(pill.correctedChase) ? pill.correctedChase : 0)
      : pill.totalPillVol + (isNum(pill.correctedChase) ? pill.correctedChase : 0),
    0,
  );

  const deltaSpotBackfill =
    eqx.minHeightWithDp < caps.spotMd && caps.spotMd > pill.heightPillNoDp
      ? eqx.minHeightWithDp - caps.spotMd
      : 0;

  const procedurePossible = !(isNum(pill.heightPillNoDp) && isNum(caps.spotMd) && pill.heightPillNoDp > caps.spotMd);
  const errorReason = !procedurePossible
    ? "ERROR — PROCEDURE NOT POSSIBLE. Pill height without drill pipe exceeds spot depth. Increase spot depth or change parameters."
    : null;

  const correctedSlugPill =
    slug.pillVolAtSpot < caps.annularAtSpot ? slug.pillVolAtSpot : slug.pillVolAtSpot - pill.bblBackfill;

  return {
    masp: pressures.masp,
    initialApl: pressures.initialApl,
    initialAplAnchor: pressures.initialAplAnchor,
    drillStringCap: caps.drillStringCap,
    drillStringVolAtSpot: caps.drillStringVolAtSpot,
    casingCap: caps.casingCap,
    casingVolAtSpot: caps.casingVolAtSpot,
    annularCap: caps.annularCap,
    annularBelowShoe: caps.annularBelowShoe,
    annularAtSpot: caps.annularAtSpot,
    openHoleCap: caps.openHoleCap,
    heightPillNoDp: pill.heightPillNoDp,
    totalPillVol: pill.totalPillVol,
    drillStringOpenHole: caps.drillStringOpenHole,
    volumeBelowShoe: caps.volumeBelowShoe,
    requiredVolAnnulus: pill.requiredVolAnnulus,
    correctedPillVol: pill.pumpedAnnulus,
    calculatedChase: pill.calculatedChase,
    correctedChase: pill.correctedChase,
    finalKwm: pill.finalKwm,
    spottedKmwVol: pill.spottedKmwVol,
    kmwRoomWithPipe: caps.kmwRoomWithPipe,
    minHeightPillWithDp: pill.minHeightPillWithDp,
    minHeightWithDp: eqx.minHeightWithDp,
    balancedAdditionalPsi: eqx.balancedAdditionalPsi,
    addPpgCsg: eqx.addPpgCsg,
    addPpgTarget: eqx.addPpgTarget,
    balancedEsdCasing: eqx.balancedEsdCasing,
    esdCasingNoDp: eqx.esdCasingNoDp,
    anchorPointEsd: eqx.anchorPointEsd,
    equalizeDumpBbl: eqx.dumpBbl,
    remainingKmwInDp: eqx.remainingPipeKmw,
    airCapTopMd: eqx.airCapMd,
    resolutionHeightGain,
    resolutionPressureGain,
    pressureDifferential,
    pressureDifferentialSlug: slug.pressureDifferentialSlug,
    staticStrippingPressure: pressures.staticStrippingPressure,
    maxDynamicSbp: pressures.maxDynamicSbp,
    maxSwabPressure: pressures.maxSwabPressure,
    selectedTripTable: pressures.selectedTripTable,
    tripPressures: pressures.tripPressures,
    slugPressure: slug.slugPressure,
    slugPillVol: slug.slugPillVol,
    strokesToPumpSlug: slug.strokesToPumpSlug,
    pillVolAtSpot: slug.pillVolAtSpot,
    slugFits: slug.slugFits,
    slugFallOut: slug.slugFallOut,
    slugFallHeight: slug.slugFallHeight,
    chaseWithSlug: slug.chaseWithSlug,
    slugPpgEquivalent: slug.slugPpgEquivalent,
    slugPsiEquivalent: slug.slugPsiEquivalent,
    slugApl: slug.slugApl,
    correctedSlugPill,
    totalPillVolAtSpotNoSlug,
    totalPillVolAtSpotWithSlug,
    topOfPillWithDp,
    topOfPillNoDp,
    drillStringPillHeight,
    topOfPillInsideDp,
    kwmPlusChase,
    deltaSpotBackfill,
    bblBackfill: pill.bblBackfill,
    safevisionSlug: slug.safevisionSlug,
    cement: calcCement(inputs),
    tapered: pill.tapered,
    procedurePossible,
    errorReason,
  };
}

export function collectWarnings(inputs: WellInputs, results: CalcResults): WarningItem[] {
  const warnings: WarningItem[] = [];
  const required: [keyof WellInputs, string][] = [
    ["anchorTvd", "Anchor point TVD"],
    ["casingTvd", "Casing depth TVD"],
    ["spotMd", "Spot depth MD"],
    ["openHoleDia", "Open hole diameter"],
    ["desiredEmw", "Desired EMW"],
    ["currentMw", "Current MW"],
    ["kmw", "KMW"],
    ["idDp", "ID drill pipe"],
    ["odDp", "OD drill pipe"],
    ["idCasing", "ID casing"],
    ["pumpDisp", "Pump displacement"],
    ["desiredResolution", "Desired resolution"],
    ["initialFlowRate", "Initial flow rate"],
    ["safevisionNoSlug", "SafeVision AP ECD (no slug)"],
  ];
  if (inputs.pillMode === "withSlug") {
    required.push(["overbalanceSlug", "Overbalance pressure for slug"]);
  }
  const missing = required.filter(([key]) => !isNum(n(inputs, key))).map(([, l]) => l);
  if (missing.length) {
    warnings.push({ level: "error", text: `Missing required values: ${missing.join(", ")}.` });
  }
  if (isNum(n(inputs, "kmw")) && isNum(n(inputs, "currentMw")) && n(inputs, "kmw") <= n(inputs, "currentMw")) {
    warnings.push({ level: "error", text: "KMW must be greater than current MW." });
  }
  if (!results.procedurePossible && results.errorReason) {
    warnings.push({ level: "error", text: results.errorReason });
  }
  if (isNum(results.pressureDifferential) && isNum(results.masp) && results.pressureDifferential > results.masp) {
    warnings.push({ level: "error", text: "Initial pressure differential exceeds MASP." });
  }
  if (isNum(n(inputs, "desiredEmw")) && isNum(n(inputs, "fit")) && n(inputs, "desiredEmw") > n(inputs, "fit")) {
    warnings.push({
      level: "warn",
      text: `Desired EMW (${n(inputs, "desiredEmw")} ppge) is above FIT (${n(inputs, "fit")} ppge).`,
    });
  }
  if (isNum(results.maxDynamicSbp) && isNum(results.masp) && results.maxDynamicSbp > results.masp) {
    warnings.push({
      level: "warn",
      text: `Max dynamic SBP (${round(results.maxDynamicSbp, 0)} psi) is above MASP (${round(results.masp, 0)} psi).`,
    });
  }
  if (
    inputs.pillMode === "withSlug" &&
    isNum(results.slugPillVol) &&
    isNum(results.totalPillVol) &&
    results.slugPillVol >= results.totalPillVol
  ) {
    warnings.push({
      level: "error",
      text: "Slug volume is greater than or equal to total pill volume. Reduce overbalance or increase EMW window.",
    });
  }
  if (inputs.pillMode === "withSlug" && results.slugFits === false && isNum(results.slugFallOut)) {
    warnings.push({
      level: "warn",
      text: `Slug exceeds drill-string volume at spot depth; ${round(results.slugFallOut, 1)} bbl of fallout compensation is applied.`,
    });
  }
  if (isNum(results.bblBackfill) && results.bblBackfill > 0) {
    warnings.push({
      level: "warn",
      text: `Only ${round(results.spottedKmwVol, 0)} bbl of KMW fits with pipe in the hole; ${round(results.totalPillVol, 0)} bbl is needed for the anchor EMW. Backfill ${round(results.bblBackfill, 0)} bbl of KMW while tripping out.`,
    });
  }
  if (results.selectedTripTable === "other") {
    warnings.push({
      level: "info",
      text: "Open-hole size is not 6.75 / 7.875 / 8.5 in. Using the custom swab table — verify values in SafeVision.",
    });
  }
  if (isNum(n(inputs, "initialFlowRate")) && isNum(n(inputs, "maxFlowRate")) && n(inputs, "initialFlowRate") > n(inputs, "maxFlowRate")) {
    warnings.push({
      level: "warn",
      text: "Initial flow rate exceeds the stated max flow rate.",
    });
  }
  if (isNum(n(inputs, "fit")) && isNum(n(inputs, "desiredEmw")) && n(inputs, "fit") - n(inputs, "desiredEmw") < 0.6) {
    warnings.push({
      level: "warn",
      text: "FIT − target EMW window is under 0.6 ppge. Steel-displacement automations are not valid — model surge in SafeVision.",
    });
  }
  if (inputs.taperedOn) {
    warnings.push({
      level: "info",
      text: "Tapered casing/string trigger is ON. Confirm the pill is spotted at the liner shoe and pill height exceeds liner length.",
    });
  }
  if (!warnings.some((w) => w.level === "error")) {
    warnings.unshift({
      level: "ok",
      text: "Primary calculations are complete. Trust the sheet — then verify the spotting schedule in SafeVision.",
    });
  }
  return warnings;
}

export function atSurface(results: CalcResults): boolean {
  return results.topOfPillWithDp === "Surface";
}

export function esdCasingWithDp(results: CalcResults): number {
  return atSurface(results) ? results.esdCasingNoDp : results.balancedEsdCasing;
}

export function esdTargetWithDp(results: CalcResults, desiredEmw: number): number {
  return atSurface(results) ? desiredEmw : results.anchorPointEsd;
}

export function pillHeightWithDp(results: CalcResults): number {
  return atSurface(results) ? results.heightPillNoDp : results.minHeightWithDp;
}
