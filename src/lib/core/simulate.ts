import { calculate } from "./calculate";
import { columnDisplacedByPipe, pillPlacement } from "./column";
import {
  emwProfile,
  type EmwCrossover,
  type EmwError,
  type EmwLines,
  type EmwNote,
  type EmwProfileResult,
  type EmwShoeCheck,
  type EmwStationEmw,
  type EmwStationLabel,
  type EmwStringSection,
} from "./emw-profile";
import type { Job } from "./job.schema";
import { chaseVolume, kmwInString, kpiVolumes, type KpiVolumesResult } from "./kpi";
import { strokesSchedule, type StrokesScheduleResult } from "./strokes";
import { stringVolumeBbl } from "./string";
import { tvdAt } from "./tvd";

/**
 * Pipe-MD steps for one job. Each step is recomputed from that job.
 * There is no carried inventory and no second well.
 */

/** Inclusive cap. A longer list is `STEP_LIMIT`; the step is not coarsened. */
const STEP_CAP = 1000;

export interface SimulateOptions {
  /** Start pipe MD, ft. Default `job.well.bitMd_ft`. Still the trip-tank origin when `mds` is set. */
  fromMd_ft?: number;
  /** End pipe MD, ft. Default 0. Ignored for the step list when `mds` is set. */
  toMd_ft?: number;
  /** Pipe-MD step, ft. Default 100. Must be finite and at least 10, including when `mds` is set. */
  stepMd_ft?: number;
  /**
   * Explicit pipe MDs, ft, in this order. When set, `steps` are these depths and nothing else.
   * A single-point evaluation is a one-element list. `fromMd_ft` still anchors `tripTank_bbl` and `pipeDelta_ft`.
   * Longer than 1000 is `STEP_LIMIT`.
   */
  mds?: number[];
}

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

/** One pill state's lines, stations, and shoe check, plus the string at that pipe MD. */
export interface SimulateFluidProfile {
  label: string;
  lines: EmwLines;
  stations: SimulateEmwStation[];
  shoeCheck: EmwShoeCheck[];
  sections: EmwStringSection[];
  crossovers: EmwCrossover[];
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
  /** Pill top at this pipe MD. Both depths come from `pillPlacement` and `tvdAt`. */
  pillTop: SimulateDepth;
  /** Pill bottom at this pipe MD. */
  pillBottom: SimulateDepth;
  /** `chaseVolume` at this pipe MD. */
  chase_bbl: number | null;
  /** Surface-to-bit string capacity at this pipe MD. Not the pill-interval term. */
  stringCapacity_bbl: number | null;
  kmwInString_bbl: number | null;
  /**
   * Closed-pipe displacement, bbl, cumulative from `fromMd_ft` to `pipeMd_ft`.
   * Positive when this MD is deeper than `fromMd_ft`, negative when it is shallower, 0 at `fromMd_ft`.
   * Each section contributes OD² / 1029.4 × the feet of that section inside the interval.
   */
  tripTank_bbl: number;
  /**
   * Full `emwProfile` at this pipe MD: both pill-state lines, stations, limits,
   * shoe check, sections, and crossovers. At pipe MD 0 the spotted side is the
   * pipe-out copy of the in-place profile. `emwProfile` rejects a non-positive bit.
   */
  spotted: EmwProfileResult;
}

export interface SimulateMeta {
  /** Equal to `steps.length`. */
  stepsLength: number;
  /** Resolved step, ft. Default 100. Minimum 10. */
  stepFt: number;
}

export interface SimulateError {
  code: "INVALID_STEP" | "INVALID_DEPTH" | "MISSING_BIT" | "STEP_LIMIT";
  field: "stepMd_ft" | "fromMd_ft" | "toMd_ft" | "well.bitMd_ft";
  message: string;
}

export type SimulateResult =
  | {
      ok: true;
      stepMd_ft: number;
      fromMd_ft: number;
      toMd_ft: number;
      /** `stepsLength` equals `steps.length`. `stepFt` equals `stepMd_ft`. */
      meta: SimulateMeta;
      /**
       * In-place EMW of the job passed in, computed once.
       * Not recomputed per step. Stations and shoe check are the in-place side only.
       */
      inPlace: SimulateFluidResult;
      /** `kpiVolumes(job)` for the job passed in. Output only. */
      kpi: KpiVolumesResult;
      /** One row per displacement stage. Not the pipe-step axis. */
      pump: StrokesScheduleResult;
      steps: SimulateStep[];
    }
  | { ok: false; error: SimulateError };

function fail(
  code: SimulateError["code"],
  field: SimulateError["field"],
  message: string,
): SimulateResult {
  return { ok: false, error: { code, field, message } };
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
  for (let guard = 0; guard < STEP_CAP + 2; guard++) {
    const next = cursor + sign * step;
    const reached = sign > 0 ? next >= to - 1e-9 : next <= to + 1e-9;
    if (reached) {
      if (Math.abs(mds[mds.length - 1] - to) > 1e-9) mds.push(to);
      return mds;
    }
    cursor = next;
    mds.push(cursor);
    if (mds.length > STEP_CAP) return mds;
  }
  return mds;
}

function tripTankBbl(job: Job, fromMd: number, pipeMd: number): number {
  if (Math.abs(pipeMd - fromMd) <= 1e-9) return 0;
  const sign = pipeMd > fromMd ? 1 : -1;
  const volume = stringVolumeBbl(
    job.well,
    Math.min(fromMd, pipeMd),
    Math.max(fromMd, pipeMd),
    "closed",
  );
  if (volume == null || !Number.isFinite(volume)) return Number.NaN;
  return sign * volume;
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
    sections: profile.sections,
    crossovers: profile.crossovers,
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
  const bit = job.well.bitMd_ft;
  if (!Number.isFinite(bit) || bit < 0) {
    return fail("MISSING_BIT", "well.bitMd_ft", "Bit depth must be a finite number greater than or equal to 0.");
  }
  const td = job.well.mdTd_ft;
  if (!Number.isFinite(td) || td < 0) {
    return fail("INVALID_DEPTH", "toMd_ft", "TD must be a finite depth greater than or equal to 0.");
  }

  const stepMd = opts.stepMd_ft ?? 100;
  if (!Number.isFinite(stepMd) || stepMd < 10) {
    return fail("INVALID_STEP", "stepMd_ft", "Pipe step must be a finite number of at least 10 ft.");
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
    if (explicit.length > STEP_CAP) {
      return fail("STEP_LIMIT", "stepMd_ft", "This range is more than 1000 steps. The step is not coarsened.");
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
    mds = walk(fromMd, toMd, stepMd);
    if (mds.length > STEP_CAP) {
      return fail("STEP_LIMIT", "stepMd_ft", "This range is more than 1000 steps. The step is not coarsened.");
    }
  }

  return {
    ok: true,
    stepMd_ft: stepMd,
    fromMd_ft: fromMd,
    toMd_ft: toMd,
    meta: { stepsLength: mds.length, stepFt: stepMd },
    inPlace: fluidSide(emwProfile(job), "inPlace"),
    kpi: kpiVolumes(job),
    pump: strokesSchedule(job, calculate(job)),
    steps: mds.map((md, index) => stepAt(job, index, md, fromMd)),
  };
}
