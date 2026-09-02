import { annularBblFt, asNum, capBblFt, isNum } from "@/lib/utils";
import type { CalcResults, WellInputs } from "./types";

export type RihFitStage = {
  index: number;
  pillTop: number;
  pillBase: number;
  shoeEsdStart: number;
  /** Bit MD where shoe ESD reaches FIT. Null if the remaining pill stays under FIT to the base. */
  stopBit: number | null;
  shoeEsdAtStop: number;
  canReachBase: boolean;
};

/** TVD at md. Vertical (or linear) to spot when spot is shallower than the shoe; else linear MD→TVD to casing. */
function mdToTvd(
  md: number,
  casingMd: number,
  casingTvd: number,
  spotMd?: number,
  spotTvd?: number,
): number {
  if (!isNum(casingMd) || casingMd <= 0 || !isNum(casingTvd)) return md;
  if (isNum(spotMd) && isNum(spotTvd) && spotMd > 0 && spotMd < casingMd) {
    if (md <= spotMd) return (md * spotTvd) / spotMd;
    if (md >= casingMd) return casingTvd;
    return spotTvd + ((md - spotMd) * (casingTvd - spotTvd)) / (casingMd - spotMd);
  }
  return (md * casingTvd) / casingMd;
}

/**
 * Shoe ESD with KMW only from topMd down to pill base (spot), MW from there to the shoe.
 * When spot is the shoe this matches the old top-to-shoe column.
 */
export function shoeEsdFromPillTop(topMd: number, inputs: WellInputs, pillBaseMd?: number): number {
  const mw = asNum(inputs.currentMw);
  const kmw = asNum(inputs.kmw);
  const casingMd = asNum(inputs.casingMd);
  const casingTvd = asNum(inputs.casingTvd);
  const spotMd = asNum(inputs.spotMd);
  const spotTvd = asNum(inputs.spotTvd);
  if (![mw, kmw, casingMd, casingTvd].every(isNum) || casingTvd <= 0) return Number.NaN;
  const baseMd = isNum(pillBaseMd) ? pillBaseMd : isNum(spotMd) ? spotMd : casingMd;
  const topClamped = Math.max(0, Math.min(topMd, casingMd));
  const baseClamped = Math.max(topClamped, Math.min(baseMd, casingMd));
  const topTvd = mdToTvd(topClamped, casingMd, casingTvd, spotMd, spotTvd);
  const baseTvd = mdToTvd(baseClamped, casingMd, casingTvd, spotMd, spotTvd);
  const h = Math.max(0, baseTvd - topTvd);
  return mw + ((kmw - mw) * h) / casingTvd;
}

/**
 * Conserved no-DP pill volume after closed-end pipe is run to bitMd.
 * Below the bit: full casing. Around the pipe: annulus. Top rises as steel takes volume.
 */
export function pillTopWithPipe(
  pillTop: number,
  pillBase: number,
  bitMd: number,
  casingCap: number,
  annularCap: number,
): number {
  const height = Math.max(0, pillBase - pillTop);
  const volume = height * casingCap;
  if (!isNum(volume) || annularCap <= 1e-12) return pillTop;
  if (bitMd <= pillTop) return pillTop;
  const volBelow = Math.max(0, (pillBase - bitMd) * casingCap);
  if (volume <= volBelow) return pillBase - volume / casingCap;
  return bitMd - (volume - volBelow) / annularCap;
}

export function buildRihFitStops(
  inputs: WellInputs,
  results: CalcResults,
  opts?: { pillTop?: number; pillBase?: number },
): {
  stages: RihFitStage[];
  fit: number;
  pillBase: number;
  casingCap: number;
  annularCap: number;
} {
  const fit = asNum(inputs.fit);
  const odDp = asNum(inputs.odDp);
  const idCasing = asNum(inputs.idCasing);
  const spotMd = asNum(inputs.spotMd);
  const casingCap = capBblFt(idCasing);
  const annularCap = annularBblFt(idCasing, odDp);
  const pillBase = isNum(opts?.pillBase)
    ? opts!.pillBase!
    : isNum(spotMd)
      ? spotMd
      : Number.NaN;
  const startTop = isNum(opts?.pillTop)
    ? opts!.pillTop!
    : isNum(results.topOfPillNoDp)
      ? Math.max(0, results.topOfPillNoDp)
      : Number.NaN;

  const empty = { stages: [] as RihFitStage[], fit, pillBase, casingCap, annularCap };
  if (![fit, odDp, idCasing, pillBase, startTop, casingCap, annularCap].every(isNum)) return empty;
  if (annularCap <= 1e-12 || pillBase <= startTop) return empty;

  const esd = (top: number) => shoeEsdFromPillTop(top, inputs, pillBase);

  const stages: RihFitStage[] = [];
  let pillTop = startTop;
  for (let i = 0; i < 8; i++) {
    const shoeEsdStart = esd(pillTop);
    let stopBit: number | null = null;
    let shoeEsdAtStop = shoeEsdStart;
    const start = Math.max(0, Math.ceil(pillTop));
    const end = Math.floor(pillBase);
    for (let d = start; d <= end; d++) {
      const top = pillTopWithPipe(pillTop, pillBase, d, casingCap, annularCap);
      const next = esd(top);
      if (isNum(next) && next >= fit) {
        stopBit = d;
        shoeEsdAtStop = next;
        break;
      }
    }
    const canReachBase = stopBit === null;
    stages.push({
      index: i + 1,
      pillTop,
      pillBase,
      shoeEsdStart,
      stopBit,
      shoeEsdAtStop: canReachBase
        ? esd(pillTopWithPipe(pillTop, pillBase, pillBase, casingCap, annularCap))
        : shoeEsdAtStop,
      canReachBase,
    });
    if (canReachBase) break;
    if (stopBit! <= pillTop + 1) break;
    pillTop = stopBit!;
  }
  return { stages, fit, pillBase, casingCap, annularCap };
}
