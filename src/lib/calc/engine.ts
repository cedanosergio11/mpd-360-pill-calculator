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
  const casingTvd = n(inputs, "casingTvd");
  const maspTvd = isNum(casingTvd) ? casingTvd : anchorTvd;
  const pressureGradient = (kmw - currentMw) * 0.052;
  const targetPressure = (desiredEmw - currentMw) * 0.052 * anchorTvd;
  const masp = (fit - currentMw) * 0.052 * maspTvd;
  const initialApl = (safevisionNoSlug - currentMw) * 0.052 * anchorTvd;
  const initialAplAnchor = initialApl;
  return {
    currentMw,
    kmw,
    anchorTvd,
    casingTvd,
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
