import { asNum, capBblFt, annularBblFt, isNum, roundUp, ceilingMath } from "@/lib/utils";
import { rheologyFrom, tripDp, tripSpeeds } from "./rp13d";
import { pillTopWithPipe, shoeEsdFromPillTop } from "./rih-fit";
import type { CalcResults, SteelRow, WellInputs } from "./types";

function hydrostaticEmw(interfaceMd: number, kmw: number, mw: number, anchorTvd: number): number {
  const h = Math.max(0, Math.min(interfaceMd, anchorTvd));
  return (h * kmw + (anchorTvd - h) * mw) / anchorTvd;
}

export function buildSteelSchedule(inputs: WellInputs, results: CalcResults): {
  rows: SteelRow[];
  windowPpg: number;
  needsRheology: boolean;
  kmwLength: number;
  kmwVolume: number;
  closedDisp: number;
  annularCap: number;
  displacedOutDepth: number;
} {
  const hole = asNum(inputs.openHoleDia);
  const fit = asNum(inputs.fit);
  const target = asNum(inputs.desiredEmw);
  const windowPpg = fit - target;
  const odDp = asNum(inputs.odDp);
  const idCasing = asNum(inputs.idCasing);
  const kmw = asNum(inputs.kmw);
  const mw = asNum(inputs.currentMw);
  const anchorTvd = asNum(inputs.anchorTvd);
  const spotMd = asNum(inputs.spotMd);
  const topNoDp = isNum(results.topOfPillNoDp) ? Math.max(0, results.topOfPillNoDp) : Number.NaN;

  const closedDisp = capBblFt(odDp);
  const annularCap = annularBblFt(idCasing, odDp);
  const casingCap = capBblFt(idCasing);
  const kmwLength = isNum(anchorTvd) && kmw > mw ? ((target - mw) * anchorTvd) / (kmw - mw) : Number.NaN;
  const kmwVolume = kmwLength * casingCap;
  const ratio = annularCap > 0 ? closedDisp / annularCap : 0;
  const displacedOutDepth = isNum(spotMd) && ratio > 0 ? roundUp(spotMd * (1 + annularCap / closedDisp), -1) : Number.NaN;

  const empty = {
    rows: [] as SteelRow[],
    windowPpg,
    needsRheology: true,
    kmwLength,
    kmwVolume,
    closedDisp,
    annularCap,
    displacedOutDepth,
  };

  if (![hole, fit, target, odDp, idCasing, kmw, mw, anchorTvd, spotMd].every(isNum)) {
    return empty;
  }

  const pillVolume = isNum(topNoDp) ? Math.max(0, spotMd - topNoDp) * casingCap : Number.NaN;
  // API RP 13D closed-pipe (float) surge, Eq 100, POI at the anchor and at the shoe (replaces SafeVision surge tables).
  const rh = rheologyFrom(inputs);
  const needsRheology = !rh;
  const anchorMd = asNum(inputs.anchorMd);
  const shoeMd = asNum(inputs.casingMd);
  const shoeTvd = asNum(inputs.casingTvd);
  const closedInputs: WellInputs = { ...inputs, pipeEnd: "closed" };
  const speeds = [...tripSpeeds(inputs)].sort((a, b) => b - a);
  const step = 500;

  const depths: number[] = [];
  if (isNum(topNoDp) && topNoDp > 0) depths.push(0, Math.round(topNoDp / 10) * 10);
  depths.push(spotMd);
  const end = isNum(displacedOutDepth) ? Math.min(displacedOutDepth, asNum(inputs.currentDepthMd) || displacedOutDepth) : spotMd + 8000;
  for (let d = ceilingMath(spotMd + step, step); d <= end + 1; d += step) depths.push(d);
  const unique = [...new Set(depths)].filter((d) => d >= 0).sort((a, b) => a - b);

  const rows: SteelRow[] = unique.map((bitDepth) => {
    const belowSpot = Math.max(0, bitDepth - spotMd);
    const interfaceDepth = Math.max(0, spotMd - belowSpot * (closedDisp / annularCap));
    const emwStatic = hydrostaticEmw(interfaceDepth, kmw, mw, anchorTvd);

    // Shoe sees only the KMW standing above it. Follow this row's pill: the no-DP pill
    // (topNoDp..spot) rises as closed-end steel enters it; below spot the whole pill is
    // pushed up with its base at interfaceDepth. Same column model as the RIH / FIT stops.
    const pillBase = bitDepth > spotMd ? interfaceDepth : spotMd;
    const pillTop =
      bitDepth > spotMd
        ? Math.max(0, interfaceDepth - pillVolume / annularCap)
        : pillTopWithPipe(topNoDp, spotMd, bitDepth, casingCap, annularCap);
    const emwShoeStatic = shoeEsdFromPillTop(pillTop, inputs, pillBase);
    const sbpStatic = Math.max(0, roundUp((target - emwStatic) * 0.052 * anchorTvd, -1));
    // Surge at a POI counts only annular friction above the bit (bit above POI → friction to the bit).
    const surgeAt = (speed: number) => {
      if (!rh || bitDepth <= 0) return { anchor: 0, shoe: 0 };
      const pa = tripDp(closedInputs, rh, Math.min(bitDepth, anchorMd), speed, bitDepth);
      const ps = isNum(shoeMd) ? tripDp(closedInputs, rh, Math.min(bitDepth, shoeMd), speed, bitDepth) : 0;
      return { anchor: pa / (0.052 * anchorTvd), shoe: isNum(shoeTvd) ? ps / (0.052 * shoeTvd) : 0 };
    };
    // Fastest grid speed that keeps anchor and shoe surge EMW at or below FIT (SBP held at sbpStatic).
    const sbpPpg = sbpStatic / (0.052 * anchorTvd);
    const sbpShoePpg = isNum(shoeTvd) ? sbpStatic / (0.052 * shoeTvd) : 0;
    let tripSpeed = speeds.at(-1) ?? 40;
    let surge = surgeAt(tripSpeed);
    for (const sp of speeds) {
      const sg = surgeAt(sp);
      if (emwStatic + sbpPpg + sg.anchor <= fit && emwShoeStatic + sbpShoePpg + sg.shoe <= fit) {
        tripSpeed = sp;
        surge = sg;
        break;
      }
    }
    const emwDynamic = emwStatic + surge.anchor;
    const emwShoeDynamic = emwShoeStatic + surge.shoe;
    const sbpDynamic = Math.max(0, roundUp(sbpStatic - surge.anchor * 0.052 * anchorTvd, -1));
    let comment = "";
    if (bitDepth === 0) comment = "Surface — RCD installed";
    else if (isNum(topNoDp) && Math.abs(bitDepth - topNoDp) < 6) comment = "Top of pill — install RCD / begin steel displacement";
    else if (Math.abs(bitDepth - spotMd) < 6) comment = `Bottom of mud cap at ${Math.round(spotMd)} ft MD`;
    else if (interfaceDepth <= 1) comment = "KMW displaced out of the hole";
    else if (rh) comment = `Trip ≤ ${tripSpeed} ft/min (RP 13D)`;

    return {
      bitDepth,
      interfaceDepth,
      tripSpeed: rh ? tripSpeed : 0,
      surgePpg: surge.anchor,
      emwStatic,
      emwDynamic,
      emwShoeStatic,
      surgeShoePpg: surge.shoe,
      emwShoeDynamic,
      sbpStatic,
      sbpDynamic,
      comment,
    };
  });

  return {
    rows,
    windowPpg,
    needsRheology,
    kmwLength,
    kmwVolume,
    closedDisp,
    annularCap,
    displacedOutDepth,
  };
}

export function buildStageCirculation(
  inputs: WellInputs,
  results: CalcResults,
  stages: 1 | 2 | 3,
): {
  tripStops: number[];
  circulateBbl: number;
  note: string;
} {
  const spot = asNum(inputs.spotMd);
  const top =
    results.topOfPillWithDp === "Surface" ? 0 : asNum(results.topOfPillWithDp);
  const height = isNum(results.minHeightWithDp) ? results.minHeightWithDp : results.heightPillNoDp;
  const bottomsUp = roundUp((results.annularAtSpot || 0) + (results.drillStringVolAtSpot || 0), -1) || 0;
  const window = asNum(inputs.fit) - asNum(inputs.desiredEmw);

  const tripStops: number[] = [];
  if (stages === 1) {
    tripStops.push(top, (top + spot) / 2, spot);
  } else if (stages === 2) {
    tripStops.push(top, top + height / 2, spot);
  } else {
    const firstFrac = window < 0.7 ? 0.7 / 3 : 1 / 3;
    tripStops.push(top, top + height * firstFrac, top + height * (firstFrac + 1 / 3), spot);
  }

  return {
    tripStops: tripStops.map((d) => Math.round(d)),
    circulateBbl: bottomsUp,
    note:
      stages === 1
        ? "Trip to the base of the pill, then circulate a bottoms-up of active mud in resolution steps."
        : `${stages}-stage: stop at each listed depth, circulate a portion of the KMW, then continue in.`,
  };
}
