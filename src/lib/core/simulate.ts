import { calculate } from "./calculate";
import { columnDisplacedByPipe, pillPlacement } from "./column";
import { emwProfile, type EmwProfileResult } from "./emw-profile";
import type { Job } from "./job.schema";
import { chaseVolume, kmwInString, kpiVolumes, type KpiVolumesResult } from "./kpi";
import { strokesSchedule, type StrokesScheduleResult } from "./strokes";
import { stringVolumeBbl } from "./string";
import { tvdAt } from "./tvd";

/**
 * Pipe-MD steps for one job. Each step is recomputed from that job.
 * There is no carried inventory and no second well.
 */

export interface SimulateOptions {
  /** Start pipe MD, ft. Default `job.well.bitMd_ft`. Still the trip-tank origin when `mds` is set. */
  fromMd_ft?: number;
  /** End pipe MD, ft. Default 0. Ignored for the step list when `mds` is set. */
  toMd_ft?: number;
  /** Pipe-MD step, ft. Default 100. Must be finite and greater than 0 when `mds` is omitted. */
  stepMd_ft?: number;
  /**
   * Explicit pipe MDs, ft, in this order. When set, `steps` are these depths and nothing else.
   * A single-point evaluation is a one-element list. `fromMd_ft` still anchors `tripTank_bbl` and `pipeDelta_ft`.
   */
  mds?: number[];
}

export interface SimulateStep {
  index: number;
  pipeMd_ft: number;
  pipeTvd_ft: number | null;
  /** `pipeMd_ft - fromMd_ft`. Negative while pulling. */
  pipeDelta_ft: number;
  pillTopMd_ft: number | null;
  pillTopTvd_ft: number | null;
  pillBottomMd_ft: number | null;
  pillBottomTvd_ft: number | null;
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
   * `emwProfile(stepJob)`.
   * `inPlace` is pipe out. `spotted` is this pipe MD, because `spottedColumn`
   * calls `columnDisplacedByPipe(job, job.well.bitMd_ft)`.
   * Lines are static, staticSbp, and ecd, in ppg, with MD and TVD on each point.
   * `sections` and `crossovers` are the tapered string layout.
   * Stations stay shoe, anchor, and bit. Shoe check is margin ppg and psi.
   */
  emw: EmwProfileResult;
}

export interface SimulateError {
  code: "INVALID_STEP" | "INVALID_DEPTH" | "MISSING_BIT";
  field: "stepMd_ft" | "fromMd_ft" | "toMd_ft" | "well.bitMd_ft";
  message: string;
}

export type SimulateResult =
  | {
      ok: true;
      stepMd_ft: number;
      fromMd_ft: number;
      toMd_ft: number;
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

/** `from`, then each full step, then `to` when the last interval is shorter than the step. */
function walk(from: number, to: number, step: number): number[] {
  const mds = [from];
  if (Math.abs(to - from) <= 1e-9) return mds;
  const sign = to > from ? 1 : -1;
  let cursor = from;
  for (let guard = 0; guard < 1_000_000; guard++) {
    const next = cursor + sign * step;
    const reached = sign > 0 ? next >= to - 1e-9 : next <= to + 1e-9;
    if (reached) {
      if (Math.abs(mds[mds.length - 1] - to) > 1e-9) mds.push(to);
      return mds;
    }
    cursor = next;
    mds.push(cursor);
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

function emwAt(job: Job, pipeMd: number): EmwProfileResult {
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
  const topTvd = pill ? tvdAt(job.well, pill.topMd) : null;
  const bottomTvd = pill ? tvdAt(job.well, pill.bottomMd) : null;
  return {
    index,
    pipeMd_ft: pipeMd,
    pipeTvd_ft: tvdAt(job.well, pipeMd),
    pipeDelta_ft: pipeMd - fromMd,
    pillTopMd_ft: pill?.topMd ?? null,
    pillTopTvd_ft: topTvd,
    pillBottomMd_ft: pill?.bottomMd ?? null,
    pillBottomTvd_ft: bottomTvd,
    chase_bbl: chase.ok ? chase.chase_bbl : null,
    stringCapacity_bbl: chase.ok ? chase.stringCapacity_bbl : null,
    kmwInString_bbl: kmw.ok ? kmw.bbl : null,
    tripTank_bbl: tripTankBbl(job, fromMd, pipeMd),
    emw: emwAt(job, pipeMd),
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

  const fromMd = opts.fromMd_ft ?? bit;
  const explicit = opts.mds;
  if (!inSpan(fromMd, td)) {
    return fail("INVALID_DEPTH", "fromMd_ft", "Pipe MD must lie between 0 and TD.");
  }

  let toMd: number;
  let stepMd: number;
  let mds: number[];
  if (explicit) {
    for (const md of explicit) {
      if (!inSpan(md, td)) {
        return fail("INVALID_DEPTH", "toMd_ft", "Pipe MD must lie between 0 and TD.");
      }
    }
    mds = [...explicit];
    toMd = opts.toMd_ft ?? explicit[explicit.length - 1] ?? fromMd;
    if (opts.toMd_ft != null && !inSpan(opts.toMd_ft, td)) {
      return fail("INVALID_DEPTH", "toMd_ft", "Pipe MD must lie between 0 and TD.");
    }
    stepMd = opts.stepMd_ft != null && Number.isFinite(opts.stepMd_ft) && opts.stepMd_ft > 0 ? opts.stepMd_ft : 100;
  } else {
    stepMd = opts.stepMd_ft ?? 100;
    if (!Number.isFinite(stepMd) || stepMd <= 0) {
      return fail("INVALID_STEP", "stepMd_ft", "Pipe step must be a finite number greater than 0.");
    }
    toMd = opts.toMd_ft ?? 0;
    if (!inSpan(toMd, td)) {
      return fail("INVALID_DEPTH", "toMd_ft", "Pipe MD must lie between 0 and TD.");
    }
    mds = walk(fromMd, toMd, stepMd);
  }

  return {
    ok: true,
    stepMd_ft: stepMd,
    fromMd_ft: fromMd,
    toMd_ft: toMd,
    kpi: kpiVolumes(job),
    pump: strokesSchedule(job, calculate(job)),
    steps: mds.map((md, index) => stepAt(job, index, md, fromMd)),
  };
}
