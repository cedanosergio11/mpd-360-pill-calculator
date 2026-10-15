import { calculate } from "./calculate";
import { columnDisplacedByPipe, pillPlacement } from "./column";
import {
  emwProfile,
  type EmwError,
  type EmwLines,
  type EmwNote,
  type EmwProfileResult,
  type EmwShoeCheck,
  type EmwStationEmw,
  type EmwStationLabel,
} from "./emw-profile";
import type { Job } from "./job.schema";
import { chaseVolume, kmwInString, kpiVolumes, type KpiVolumesResult } from "./kpi";
import { strokesSchedule, type StrokesScheduleResult } from "./strokes";
import { tvdAt } from "./tvd";
import { capBblFt } from "@/lib/utils";

/**
 * Pipe-MD steps for one job. Each step is recomputed from that job.
 * There is no carried inventory and no second well.
 */

/** Default pipe-MD step, ft. */
export const DEFAULT_STEP_FT = 100;
/** Smallest accepted pipe-MD step, ft. Below this is `INVALID_STEP`. */
export const MIN_STEP_FT = 10;
/** Inclusive cap. A longer list is `STEP_LIMIT`; the step is not coarsened. */
export const MAX_STEPS = 1000;

export interface SimulateOptions {
  /** Start pipe MD, ft. Default `job.well.bitMd_ft`. Still the trip-tank origin when `mds` is set. */
  fromMd_ft?: number;
  /** End pipe MD, ft. Default 0. Ignored for the step list when `mds` is set. */
  toMd_ft?: number;
  /** Pipe-MD step, ft. Default `DEFAULT_STEP_FT`. Must be finite and at least `MIN_STEP_FT`, including when `mds` is set. */
  stepMd_ft?: number;
  /**
   * Explicit pipe MDs, ft, in this order. When set, `steps` are these depths and nothing else.
   * A single-point evaluation is a one-element list. `fromMd_ft` still anchors `tripTank_bbl` and `pipeDelta_ft`.
   * Longer than `MAX_STEPS` is `STEP_LIMIT`.
   */
  mds?: number[];
}

/** Pill top or bottom. `null` on either depth means the pill is not in the hole. */
export interface SimulateDepth {
  md_ft: number | null;
  tvd_ft: number | null;
}

/** One labeled station, with EMW for a single pill state. */
export interface SimulateEmwStation {
  label: EmwStationLabel;
  md_ft: number;
  tvd_ft: number;
  emw: EmwStationEmw;
}

/** One pill state's lines, stations, and shoe check. */
export interface SimulateFluidProfile {
  label: string;
  lines: EmwLines;
  stations: SimulateEmwStation[];
  shoeCheck: EmwShoeCheck[];
}

export type SimulateFluidResult =
  | ({ ok: true; notes: EmwNote[] } & SimulateFluidProfile)
  | { ok: false; notes: EmwNote[]; error: EmwError };

export interface SimulateStep {
  index: number;
  pipeMd_ft: number;
  pipeTvd_ft: number | null;
  /** `pipeMd_ft - fromMd_ft`. Negative while pulling. */
  pipeDelta_ft: number;
  /** Pill top at this pipe MD. `{ md_ft, tvd_ft }`, each `number | null`. Null means not in the hole. */
  pillTop: SimulateDepth;
  /** Pill bottom at this pipe MD. Same shape as `pillTop`. */
  pillBottom: SimulateDepth;
  /** `chaseVolume` at this pipe MD. */
  chase_bbl: number | null;
  /** Surface-to-bit string capacity at this pipe MD. Not the pill-interval term. */
  stringCapacity_bbl: number | null;
  kmwInString_bbl: number | null;
  /**
   * Closed-pipe displacement, bbl, cumulative from `fromMd_ft` to `pipeMd_ft`.
   * Positive when this MD is deeper than `fromMd_ft`, negative when it is shallower, 0 at `fromMd_ft`.
   * One string: `stringOd_in`² / 1029.4 × the feet between the two MDs.
   */
  tripTank_bbl: number;
  /**
   * Full `emwProfile` at this pipe MD, including the in-place side and the spotted side:
   * both pill-state lines, stations, limits, and shoe check. At pipe MD 0 the spotted
   * side is the pipe-out copy of the in-place profile. `emwProfile` rejects a non-positive bit.
   */
  spotted: EmwProfileResult;
}

export interface SimulateMeta {
  /** Equal to `steps.length`. */
  stepCount: number;
  /**
   * @deprecated Use `stepCount`. Equal to `stepCount` and to `steps.length`.
   */
  stepsLength: number;
  /** Resolved step, ft. Default `DEFAULT_STEP_FT`. Minimum `MIN_STEP_FT`. */
  stepFt: number;
}

interface SimulateErrorBase {
  field: "stepMd_ft" | "fromMd_ft" | "toMd_ft" | "well.bitMd_ft";
  message: string;
}

export type SimulateError =
  | (SimulateErrorBase & { code: "INVALID_STEP" | "INVALID_DEPTH" | "MISSING_BIT" })
  | (SimulateErrorBase & {
      code: "STEP_LIMIT";
      field: "stepMd_ft";
      minStepFt: typeof MIN_STEP_FT;
      maxSteps: typeof MAX_STEPS;
      requestedSteps: number;
    })
  | { code: "SIM_REQUIRES_TAPERED"; presetId: "D" };

export type SimulateResult =
  | {
      ok: true;
      stepMd_ft: number;
      fromMd_ft: number;
      toMd_ft: number;
      /** `stepCount` equals `steps.length`. `stepsLength` is the deprecated alias. `stepFt` equals `stepMd_ft`. */
      meta: SimulateMeta;
      /**
       * Reference only. The in-place side of the job passed in, computed once as `SimulateFluidResult`.
       * Not the full profile on each step, and not recomputed per step.
       */
      inPlace: SimulateFluidResult;
      /** `kpiVolumes(job)` for the job passed in. Output only. */
      kpi: KpiVolumesResult;
      /** One row per displacement stage. Not the pipe-step axis. */
      pump: StrokesScheduleResult;
      steps: SimulateStep[];
    }
  | { ok: false; error: SimulateError };

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

interface StringGeometry {
  stringSections?: unknown;
  crossovers?: unknown;
  crossoverMd_ft?: unknown;
}

/**
 * Whether this single-string branch can run `simulate` on `job`.
 * The decision is the drill string, not `meta.presetId`. More than one section,
 * a crossover depth, or an OD/ID change along the string is #6.
 */
/** True when `well` has more than one section, a crossover depth, or an OD/ID change. Never throws. */
export function drillStringNeedsTaper(well: unknown): boolean {
  if (well == null || typeof well !== "object") return false;
  return taperReason(well as Job["well"] & StringGeometry) != null;
}

export function canSimulate(job: Job): { ok: boolean; reason?: string } {
  const reason = drillStringNeedsTaper(job.well) ? taperReason(job.well as Job["well"] & StringGeometry) : null;
  return reason == null ? { ok: true } : { ok: false, reason };
}

function taperReason(well: Job["well"] & StringGeometry): string | null {
  const sections = Array.isArray(well.stringSections) ? well.stringSections : [];
  if (sections.length > 1) {
    for (let i = 1; i < sections.length; i++) {
      if (sectionChanges(sections[i - 1], sections[i])) {
        return "The drill string changes OD or ID along its length.";
      }
    }
    return "The drill string has more than one section.";
  }
  if (sections.length === 1 && odIdChanges(well, sections[0])) {
    return "The drill string changes OD or ID along its length.";
  }
  if (hasCrossoverDepth(well)) return "The drill string has a crossover depth.";
  return null;
}

function odIdChanges(well: Job["well"], section: unknown): boolean {
  if (section == null || typeof section !== "object") return false;
  const row = section as { od_in?: unknown; id_in?: unknown };
  const od = finite(row.od_in) ? row.od_in : well.stringOd_in;
  const id = finite(row.id_in) ? row.id_in : well.stringId_in;
  return od !== well.stringOd_in || id !== well.stringId_in;
}

function sectionChanges(left: unknown, right: unknown): boolean {
  if (left == null || typeof left !== "object" || right == null || typeof right !== "object") return false;
  const a = left as { od_in?: unknown; id_in?: unknown };
  const b = right as { od_in?: unknown; id_in?: unknown };
  return (finite(a.od_in) && finite(b.od_in) && a.od_in !== b.od_in) || (finite(a.id_in) && finite(b.id_in) && a.id_in !== b.id_in);
}

function hasCrossoverDepth(well: StringGeometry): boolean {
  if (finite(well.crossoverMd_ft)) return true;
  if (!Array.isArray(well.crossovers) || well.crossovers.length === 0) return false;
  return well.crossovers.some((item) => {
    if (finite(item)) return true;
    if (item == null || typeof item !== "object") return false;
    const row = item as { md_ft?: unknown; tvd_ft?: unknown; depth_ft?: unknown };
    return finite(row.md_ft) || finite(row.tvd_ft) || finite(row.depth_ft);
  });
}

function taperedRefusal(): SimulateResult {
  return { ok: false, error: { code: "SIM_REQUIRES_TAPERED", presetId: "D" } };
}

function fail(
  code: "INVALID_STEP" | "INVALID_DEPTH" | "MISSING_BIT",
  field: SimulateErrorBase["field"],
  message: string,
): SimulateResult {
  return { ok: false, error: { code, field, message } };
}

function stepLimit(requestedSteps: number): SimulateResult {
  return {
    ok: false,
    error: {
      code: "STEP_LIMIT",
      field: "stepMd_ft",
      message: `This range is more than ${MAX_STEPS} steps. The step is not coarsened.`,
      minStepFt: MIN_STEP_FT,
      maxSteps: MAX_STEPS,
      requestedSteps,
    },
  };
}

/** How many pipe MDs `from` → `to` at `step` would emit, including both ends. */
function requestedStepCount(from: number, to: number, step: number): number {
  const span = Math.abs(to - from);
  if (span <= 1e-9) return 1;
  const full = Math.floor((span + 1e-9) / step);
  if (span - full * step <= 1e-9) return full + 1;
  return full + 2;
}

function inSpan(md: number, td: number): boolean {
  return Number.isFinite(md) && md >= 0 && md <= td;
}

/** `from`, then each full step, then `to` when the last interval is shorter than the step. Stops once the cap is passed. */
function walk(from: number, to: number, step: number): number[] {
  const mds = [from];
  if (Math.abs(to - from) <= 1e-9) return mds;
  const sign = to > from ? 1 : -1;
  let cursor = from;
  for (let guard = 0; guard < MAX_STEPS + 2; guard++) {
    const next = cursor + sign * step;
    const reached = sign > 0 ? next >= to - 1e-9 : next <= to + 1e-9;
    if (reached) {
      if (Math.abs(mds[mds.length - 1] - to) > 1e-9) mds.push(to);
      return mds;
    }
    cursor = next;
    mds.push(cursor);
    if (mds.length > MAX_STEPS) return mds;
  }
  return mds;
}

function tripTankBbl(job: Job, fromMd: number, pipeMd: number): number {
  if (Math.abs(pipeMd - fromMd) <= 1e-9) return 0;
  const sign = pipeMd > fromMd ? 1 : -1;
  const perFt = capBblFt(job.well.stringOd_in);
  if (!Number.isFinite(perFt)) return Number.NaN;
  return sign * perFt * Math.abs(pipeMd - fromMd);
}

function withBit(job: Job, bitMd: number): Job {
  return { ...job, well: { ...job.well, bitMd_ft: bitMd } };
}

/**
 * Pipe MD 0 removes no closed-pipe volume, so spotted equals in place.
 * `emwProfile` itself rejects a non-positive bit, so this copies the pipe-out
 * profile onto the spotted side and keeps the contract labels.
 */
function pipeOutProfile(profile: Extract<EmwProfileResult, { ok: true }>): EmwProfileResult {
  const inPlaceShoe = profile.shoeCheck.filter((row) => row.pillState === "inPlace");
  return {
    ...profile,
    spotted: { label: profile.spotted.label, lines: profile.inPlace.lines },
    stations: profile.stations.map((station) => ({
      ...station,
      emw: {
        inPlace: station.emw.inPlace,
        spotted: { ...station.emw.inPlace },
      },
    })),
    shoeCheck: profile.shoeCheck.map((row) => {
      if (row.pillState !== "spotted") return row;
      const source = inPlaceShoe.find((item) => item.line === row.line);
      return source ? { ...source, pillState: "spotted" as const } : row;
    }),
  };
}

function fluidSide(profile: EmwProfileResult, pillState: "inPlace" | "spotted"): SimulateFluidResult {
  if (!profile.ok) return { ok: false, notes: profile.notes, error: profile.error };
  const fluid = profile[pillState];
  return {
    ok: true,
    notes: profile.notes,
    label: fluid.label,
    lines: fluid.lines,
    stations: profile.stations.map((station) => ({
      label: station.label,
      md_ft: station.md_ft,
      tvd_ft: station.tvd_ft,
      emw: station.emw[pillState],
    })),
    shoeCheck: profile.shoeCheck.filter((row) => row.pillState === pillState),
  };
}

function spottedAt(job: Job, pipeMd: number): EmwProfileResult {
  if (pipeMd > 0) return emwProfile(withBit(job, pipeMd));
  const profile = emwProfile(job);
  if (!profile.ok) return profile;
  return pipeOutProfile(profile);
}

function stepAt(job: Job, index: number, pipeMd: number, fromMd: number): SimulateStep {
  const stepJob = withBit(job, pipeMd);
  const placed = columnDisplacedByPipe(job, pipeMd);
  const placement = placed ? pillPlacement(placed) : null;
  const pill = placement?.pill ?? null;
  const chase = chaseVolume(stepJob);
  const kmw = kmwInString(stepJob);
  return {
    index,
    pipeMd_ft: pipeMd,
    pipeTvd_ft: tvdAt(job.well, pipeMd),
    pipeDelta_ft: pipeMd - fromMd,
    pillTop: {
      md_ft: pill?.topMd ?? null,
      tvd_ft: pill ? tvdAt(job.well, pill.topMd) : null,
    },
    pillBottom: {
      md_ft: pill?.bottomMd ?? null,
      tvd_ft: pill ? tvdAt(job.well, pill.bottomMd) : null,
    },
    chase_bbl: chase.ok ? chase.chase_bbl : null,
    stringCapacity_bbl: chase.ok ? chase.stringCapacity_bbl : null,
    kmwInString_bbl: kmw.ok ? kmw.bbl : null,
    tripTank_bbl: tripTankBbl(job, fromMd, pipeMd),
    spotted: spottedAt(job, pipeMd),
  };
}

export function simulate(job: Job, opts: SimulateOptions = {}): SimulateResult {
  if (!canSimulate(job).ok) return taperedRefusal();

  const bit = job.well.bitMd_ft;
  if (!Number.isFinite(bit) || bit < 0) {
    return fail("MISSING_BIT", "well.bitMd_ft", "Bit depth must be a finite number greater than or equal to 0.");
  }
  const td = job.well.mdTd_ft;
  if (!Number.isFinite(td) || td < 0) {
    return fail("INVALID_DEPTH", "toMd_ft", "TD must be a finite depth greater than or equal to 0.");
  }

  const stepMd = opts.stepMd_ft ?? DEFAULT_STEP_FT;
  if (!Number.isFinite(stepMd) || stepMd < MIN_STEP_FT) {
    return fail("INVALID_STEP", "stepMd_ft", `Pipe step must be a finite number of at least ${MIN_STEP_FT} ft.`);
  }

  const fromMd = opts.fromMd_ft ?? bit;
  if (!inSpan(fromMd, td)) {
    return fail("INVALID_DEPTH", "fromMd_ft", "Pipe MD must lie between 0 and TD.");
  }

  const explicit = opts.mds;
  let toMd: number;
  let mds: number[];
  if (explicit) {
    for (const md of explicit) {
      if (!inSpan(md, td)) {
        return fail("INVALID_DEPTH", "toMd_ft", "Pipe MD must lie between 0 and TD.");
      }
    }
    if (explicit.length > MAX_STEPS) {
      return stepLimit(explicit.length);
    }
    mds = [...explicit];
    toMd = opts.toMd_ft ?? explicit[explicit.length - 1] ?? fromMd;
    if (opts.toMd_ft != null && !inSpan(opts.toMd_ft, td)) {
      return fail("INVALID_DEPTH", "toMd_ft", "Pipe MD must lie between 0 and TD.");
    }
  } else {
    toMd = opts.toMd_ft ?? 0;
    if (!inSpan(toMd, td)) {
      return fail("INVALID_DEPTH", "toMd_ft", "Pipe MD must lie between 0 and TD.");
    }
    const requested = requestedStepCount(fromMd, toMd, stepMd);
    if (requested > MAX_STEPS) return stepLimit(requested);
    mds = walk(fromMd, toMd, stepMd);
    if (mds.length > MAX_STEPS) return stepLimit(mds.length);
  }

  return {
    ok: true,
    stepMd_ft: stepMd,
    fromMd_ft: fromMd,
    toMd_ft: toMd,
    meta: { stepCount: mds.length, stepsLength: mds.length, stepFt: stepMd },
    inPlace: fluidSide(emwProfile(job), "inPlace"),
    kpi: kpiVolumes(job),
    pump: strokesSchedule(job, calculate(job)),
    steps: mds.map((md, index) => stepAt(job, index, md, fromMd)),
  };
}
