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

function mdToTvd(md: number, casingMd: number, casingTvd: number): number {
  if (!isNum(casingMd) || casingMd <= 0 || !isNum(casingTvd)) return md;
  return (md * casingTvd) / casingMd;
}

/** Shoe ESD with KMW from topMd down to the shoe, pipe out. Linear MD→TVD to casing shoe. */
export function shoeEsdFromPillTop(topMd: number, inputs: WellInputs): number {
  const mw = asNum(inputs.currentMw);
  const kmw = asNum(inputs.kmw);
  const casingMd = asNum(inputs.casingMd);
  const casingTvd = asNum(inputs.casingTvd);
  if (![mw, kmw, casingMd, casingTvd].every(isNum) || casingTvd <= 0) return Number.NaN;
  const clamped = Math.max(0, Math.min(topMd, casingMd));
  const topTvd = mdToTvd(clamped, casingMd, casingTvd);
  const h = Math.max(0, casingTvd - topTvd);
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

  const stages: RihFitStage[] = [];
  let pillTop = startTop;
  for (let i = 0; i < 8; i++) {
    const shoeEsdStart = shoeEsdFromPillTop(pillTop, inputs);
    let stopBit: number | null = null;
    let shoeEsdAtStop = shoeEsdStart;
    const start = Math.max(0, Math.ceil(pillTop));
    const end = Math.floor(pillBase);
    for (let d = start; d <= end; d++) {
      const top = pillTopWithPipe(pillTop, pillBase, d, casingCap, annularCap);
      const esd = shoeEsdFromPillTop(top, inputs);
      if (isNum(esd) && esd >= fit) {
        stopBit = d;
        shoeEsdAtStop = esd;
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
      shoeEsdAtStop: canReachBase ? shoeEsdFromPillTop(pillTopWithPipe(pillTop, pillBase, pillBase, casingCap, annularCap), inputs) : shoeEsdAtStop,
      canReachBase,
    });
    if (canReachBase) break;
    if (stopBit! <= pillTop + 1) break;
    pillTop = stopBit!;
  }
  return { stages, fit, pillBase, casingCap, annularCap };
}
