import { esdAtMd } from "./column";
import { calcRefusal, type CalcRefusal } from "./job-support";
import { pumpsOffSbpPsi } from "./displacement";
import { uniqueSorted } from "./geometry";
import { tripFrictionPsi } from "./hydraulics";
import { fannBlocked, issue, type Issue } from "./issues";
import type { Job } from "./job.schema";
import {
  PSI_PER_PPG_FT,
  type DisplacementStage,
  type TripEmw,
  type TripLimit,
  type TripPointKey,
  type TripScheduleRow,
} from "./result";
import { tvdAt } from "./tvd";

interface PointState {
  md: number;
  tvd: number | null;
  esd: number | null;
}

const EMPTY_EMW: TripEmw = { surge_ppg: null, swab_ppg: null };

function pointAt(job: Job, md: number): PointState {
  return { md, tvd: tvdAt(job.well, md), esd: esdAtMd(job, md) };
}

function sbpForFloor(point: PointState, dP: number | null, floorPpg: number): number | null {
  if (point.esd == null || point.tvd == null || !(point.tvd > 0) || dP == null) return null;
  return Math.max(0, (floorPpg - point.esd) * PSI_PER_PPG_FT * point.tvd + dP);
}

interface SpeedCheck {
  pass: boolean;
  /** Minimum SBP that satisfies swab floors. Null when the point cannot be evaluated. */
  sbpRequired: number | null;
  limitedBy: TripLimit;
  usable: boolean;
  /** Shoe surge at this speed and SBP is at or above FIT. */
  surgeAtFit: boolean;
}

/**
 * A speed passes when the anchor swab stays at or above target EMW (and the bit
 * swab stays at or above pore, when pore is entered) at an SBP that also keeps
 * the shoe under FIT. Pore is not applied at the shoe or the anchor.
 * RIH checks shoe surge at that SBP. POOH also keeps static shoe ESD plus the
 * SBP under FIT. A speed whose shoe surge reaches FIT is dropped from the band
 * either way, and maxSpeed stays at the fastest speed that still passes.
 * Anchor target EMW is enforced even when the bit is above the anchor: swab
 * still reduces pressure below the bit, and friction is summed only to the bit.
 * `limitedBy` names the constraint that closes the window.
 */
function checkSpeed(
  job: Job,
  speed: number,
  direction: "POOH" | "RIH",
  shoe: PointState,
  anchor: PointState,
  bit: PointState,
  frictionAt: (md: number) => number | null,
): SpeedCheck {
  const dShoe = frictionAt(shoe.md);
  const dAnchor = frictionAt(anchor.md);
  const dBit = frictionAt(bit.md);
  if ([dShoe, dAnchor, dBit].some((value) => value == null)) {
    return { pass: false, sbpRequired: null, limitedBy: "FIT", usable: false, surgeAtFit: false };
  }
  const targetPpg = job.well.targetEmw_ppg;
  const target =
    targetPpg != null && Number.isFinite(targetPpg) ? sbpForFloor(anchor, dAnchor, targetPpg) : 0;
  let poreNeed = 0;
  if (job.well.porePressure_ppg != null) {
    const need = sbpForFloor(bit, dBit, job.well.porePressure_ppg);
    if (need == null) {
      return {
        pass: false,
        sbpRequired: null,
        limitedBy: "pore",
        usable: false,
        surgeAtFit: false,
      };
    }
    poreNeed = need;
  }
  if (target == null || shoe.esd == null || shoe.tvd == null || !(shoe.tvd > 0) || dShoe == null) {
    return { pass: false, sbpRequired: null, limitedBy: "FIT", usable: false, surgeAtFit: false };
  }
  const sbpNeed = Math.max(target, poreNeed);
  const per = PSI_PER_PPG_FT * shoe.tvd;
  const surgeEmw = shoe.esd + (sbpNeed + dShoe) / per;
  const surgeAtFit = surgeEmw >= job.well.fit_ppg;
  const fitEmw = direction === "POOH" ? shoe.esd + sbpNeed / per : surgeEmw;
  // Surge at FIT drops the speed from the band. It does not by itself lock the sheet.
  const pass = fitEmw < job.well.fit_ppg && !surgeAtFit;
  if (pass)
    return { pass: true, sbpRequired: sbpNeed, limitedBy: "none", usable: true, surgeAtFit };

  const atZero = direction === "POOH" ? shoe.esd : shoe.esd + dShoe / per;
  let limitedBy: TripLimit = "targetEmw";
  if (atZero >= job.well.fit_ppg) limitedBy = "FIT";
  else if (job.well.porePressure_ppg != null && poreNeed > target) limitedBy = "pore";
  return { pass: false, sbpRequired: null, limitedBy, usable: true, surgeAtFit };
}

function emwAtSpeed(
  job: Job,
  md: number,
  bitMd: number,
  speed: number,
  sbp: number,
  dP: number | null,
): TripEmw {
  const esd = esdAtMd(job, md);
  const tvd = tvdAt(job.well, md);
  if (esd == null || tvd == null || !(tvd > 0) || dP == null) return { ...EMPTY_EMW };
  const perPsi = 1 / (PSI_PER_PPG_FT * tvd);
  return {
    surge_ppg: esd + (sbp + dP) * perPsi,
    swab_ppg: esd + (sbp - dP) * perPsi,
  };
}

const MAX_STEP_FT = 500;

/** Even splits so each span between breakpoints is at most `maxStep` ft. */
function subdivide(points: number[], maxStep: number): number[] {
  const sorted = uniqueSorted(points, 0.5);
  if (sorted.length < 2) return sorted;
  const out: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    const span = end - start;
    const pieces = Math.max(1, Math.ceil((span - 1e-6) / maxStep));
    for (let piece = 0; piece < pieces; piece++) out.push(start + (span * piece) / pieces);
  }
  out.push(sorted[sorted.length - 1]);
  return uniqueSorted(out, 0.05);
}

/**
 * Stops the bit must hit before each span is split into even steps of at most
 * 500 ft: surface, bit, casing ends, shoe, anchor, pill top, and spot depth.
 */
function breakpoints(job: Job, pillTop: number | null, spotMd: number | null): number[] {
  const bit = job.well.bitMd_ft;
  const marks = [0, bit, job.well.shoeMd_ft, job.well.anchorMd_ft];
  if (pillTop != null) marks.push(pillTop);
  if (spotMd != null) marks.push(spotMd);
  for (const interval of job.well.casing) marks.push(interval.topMd_ft, interval.bottomMd_ft);
  return marks.filter((mark) => mark >= -1e-6 && mark <= bit + 1e-3);
}

function stations(job: Job, pillTop: number | null, spotMd: number | null): number[] {
  return subdivide(breakpoints(job, pillTop, spotMd), MAX_STEP_FT);
}

/**
 * Trip rows in POOH-then-RIH order. Breakpoints are geometry stations, the shoe,
 * the anchor, the pill top, and the spot depth. Each of those spans is then
 * split into even steps of at most 500 ft. Each step is evaluated at its deeper end.
 *
 * The pill is not migrated along the trip. Surge and swab use the static column.
 *
 * maxSpeed is the fastest `trip.speeds_ftmin` entry that passes. A speed whose
 * shoe surge reaches FIT is dropped from that band, and that row's `limitedBy`
 * is FIT. When none pass, maxSpeed is null (never 0) and the result carries
 * NO_SAFE_TRIP_SPEED. If the anchor swab floor and the shoe FIT cannot both
 * hold, `limitedBy` is FIT. A pore floor that closes the window stays `pore`.
 */
export function buildTripSchedule(
  job: Job,
  pillTop: number | null,
  spotMd: number | null,
  stages: DisplacementStage[],
  issues: Issue[],
): TripScheduleRow[] | CalcRefusal {
  const refused = calcRefusal(job);
  if (refused) return refused;

  const speeds = [...new Set(job.trip.speeds_ftmin.filter((speed) => speed > 0))].sort(
    (a, b) => b - a,
  );
  const path = stations(job, pillTop, spotMd);
  if (path.length < 2) return [];

  const anchorEsd = esdAtMd(job, job.well.anchorMd_ft);
  const sbpStatic = pumpsOffSbpPsi(job, anchorEsd);

  const shoe = pointAt(job, job.well.shoeMd_ft);
  const anchor = pointAt(job, job.well.anchorMd_ft);
  const blocked = fannBlocked(issues);
  const frictionCache = new Map<string, number | null>();
  const friction = (bitMd: number, poiMd: number, speed: number): number | null => {
    if (blocked) return null;
    const key = `${bitMd}|${poiMd}|${speed}`;
    const cached = frictionCache.get(key);
    if (cached !== undefined) return cached;
    const value = tripFrictionPsi(job, poiMd, bitMd, speed);
    frictionCache.set(key, value);
    return value;
  };

  type Step = { direction: "POOH" | "RIH"; from: number; to: number; evalAt: number };
  const steps: Step[] = [];
  for (let i = path.length - 1; i > 0; i--) {
    steps.push({ direction: "POOH", from: path[i], to: path[i - 1], evalAt: path[i] });
  }
  for (let i = 0; i < path.length - 1; i++) {
    steps.push({ direction: "RIH", from: path[i], to: path[i + 1], evalAt: path[i + 1] });
  }

  let geometryMiss = false;
  let anyRejected = false;
  let droppedSurgeSpeed = false;
  const rows: TripScheduleRow[] = [];

  for (const step of steps) {
    const bitPoint = pointAt(job, step.evalAt);
    const blankEmw = (): Record<TripPointKey, TripEmw> => ({
      shoe: { ...EMPTY_EMW },
      anchor: { ...EMPTY_EMW },
      bit: { ...EMPTY_EMW },
    });

    let chosen: number | null = null;
    let chosenSbp: number | null = null;
    let limitedBy: TripLimit = "none";
    let sawUsable = false;

    if (!blocked && speeds.length) {
      for (let i = 0; i < speeds.length; i++) {
        const speed = speeds[i];
        const frictionAt = (md: number) => friction(step.evalAt, md, speed);
        const result = checkSpeed(job, speed, step.direction, shoe, anchor, bitPoint, frictionAt);
        if (!result.usable) {
          geometryMiss = true;
          break;
        }
        sawUsable = true;
        if (result.surgeAtFit && !result.pass) droppedSurgeSpeed = true;
        if (result.pass && result.sbpRequired != null) {
          chosen = speed;
          chosenSbp = result.sbpRequired;
          limitedBy = "none";
          if (i > 0) {
            const faster = speeds[i - 1];
            const fasterCheck = checkSpeed(
              job,
              faster,
              step.direction,
              shoe,
              anchor,
              bitPoint,
              (md) => friction(step.evalAt, md, faster),
            );
            // A faster speed dropped because shoe surge reached FIT closes the window on FIT.
            // Pore still wins when that faster speed failed the pore floor.
            limitedBy =
              fasterCheck.surgeAtFit && fasterCheck.limitedBy !== "pore"
                ? "FIT"
                : fasterCheck.limitedBy;
          }
          break;
        }
        if (i === speeds.length - 1) limitedBy = result.limitedBy;
      }
    }

    if (chosen == null && sawUsable && limitedBy === "targetEmw") limitedBy = "FIT";

    if (chosen == null && (blocked || speeds.length === 0 || sawUsable)) anyRejected = true;

    const emwAt = blankEmw();
    if (chosen != null && chosenSbp != null) {
      const fill = (key: TripPointKey, md: number) => {
        emwAt[key] = emwAtSpeed(
          job,
          md,
          step.evalAt,
          chosen!,
          chosenSbp!,
          friction(step.evalAt, md, chosen!),
        );
      };
      fill("shoe", job.well.shoeMd_ft);
      fill("anchor", job.well.anchorMd_ft);
      fill("bit", step.evalAt);
    }

    const row: TripScheduleRow = {
      direction: step.direction,
      fromBitMd_ft: step.from,
      toBitMd_ft: step.to,
      maxSpeed_ftmin: chosen,
      emwAt,
      sbpStatic_psi: sbpStatic,
      sbpRequired_psi: chosen == null ? null : chosenSbp,
      limitedBy,
    };
    if (step.direction === "RIH") {
      const stage = stages.find((item) => Math.abs(item.bitMd_ft - step.to) <= 1);
      if (stage) row.stage = stage.n;
    }
    rows.push(row);
  }

  if (
    droppedSurgeSpeed &&
    rows.some((row) => row.maxSpeed_ftmin != null) &&
    !issues.some((item) => item.code === "SHOE_SURGE_AT_FIT")
  ) {
    const surgeStages = [
      ...new Set(
        rows.flatMap((row) =>
          row.stage != null && row.limitedBy === "FIT" && row.maxSpeed_ftmin != null
            ? [row.stage]
            : [],
        ),
      ),
    ].sort((a, b) => a - b);
    const warning = issue(
      "warn",
      "SHOE_SURGE_AT_FIT",
      "Shoe surge reaches FIT at one or more trip speeds. Those speeds are dropped from the band. maxSpeed is the fastest speed that stays under FIT.",
      "depths.shoe.surge",
    );
    warning.stages = surgeStages;
    issues.push(warning);
  }
  if (geometryMiss && !issues.some((item) => item.code === "GEOMETRY")) {
    issues.push(
      issue(
        "error",
        "GEOMETRY",
        "Trip hydraulics need a hole ID larger than the string OD along the well to the bit.",
        "well.casing",
      ),
    );
  }
  if (!blocked && !geometryMiss && speeds.length === 0 && rows.length) {
    issues.push(
      issue(
        "error",
        "NO_SAFE_TRIP_SPEED",
        "No trip speed keeps shoe surge under FIT, static shoe ESD plus SBP under FIT on POOH, anchor swab at or above target EMW, and bit swab at or above pore. maxSpeed is null.",
        "trip.speeds_ftmin",
      ),
    );
  } else if (
    !blocked &&
    !geometryMiss &&
    anyRejected &&
    rows.some((row) => row.maxSpeed_ftmin == null)
  ) {
    const failing = rows.filter((row) => row.maxSpeed_ftmin == null).length;
    issues.push(
      issue(
        "error",
        "NO_SAFE_TRIP_SPEED",
        `No trip speed keeps shoe surge under FIT, static shoe ESD plus SBP under FIT on POOH, anchor swab at or above target EMW, and bit swab at or above pore on ${failing} of ${rows.length} steps. maxSpeed is null, not 0.`,
        "trip.speeds_ftmin",
      ),
    );
  }
  return rows;
}
