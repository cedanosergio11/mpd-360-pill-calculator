import type { Job, PumpInput } from "./job.schema";
import type { Result } from "./result";

/** Triplex pump output factor: bbl/stk = 0.000243 × liner² × stroke × efficiency. */
const TRIPLEX_BBL_PER_STK = 0.000243;

export interface StrokesScheduleRow {
  /** Stage index from `displacement.stages[].n`. */
  n: number;
  /** `Stage 0`, `Stage 1`, and so on. */
  label: string;
  /** Increment of cumulative `pumped_bbl` since the previous stage. 0 before the first. */
  stage_bbl: number;
  /** Cumulative pill volume pumped, bbl. Equal to this stage's `pumped_bbl`. */
  cum_bbl: number;
  /** `stage_bbl / bblPerStk`. */
  strokes: number;
  /** Strokes from job start through this stage. */
  cumStrokes: number;
  /**
   * This stage only: `strokes / spm`.
   * Null when SPM is omitted, null, or 0. 0 when this stage's strokes are 0 and SPM is positive.
   */
  minutes: number | null;
  /**
   * `cumStrokes / spm` from job start.
   * Null when SPM is omitted, null, or 0. 0 when cumulative strokes are 0 and SPM is positive.
   */
  cumMinutes: number | null;
}

export interface PumpError {
  code: "MISSING_PUMP" | "INVALID_PUMP" | "INVALID_STAGE";
  /** `pump`, `pump.linerIn`, `pump.strokeIn`, `pump.efficiency`, `pump.bblPerStk`, `pump.spm`, or `displacement.stages[n].pumped_bbl`. */
  field: string;
  message: string;
}

export type PumpOutputResult = { ok: true; bblPerStk: number } | { ok: false; error: PumpError };

export type StrokesScheduleResult =
  { ok: true; bblPerStk: number; rows: StrokesScheduleRow[] } | { ok: false; error: PumpError };

function fail(
  code: PumpError["code"],
  field: string,
  message: string,
): { ok: false; error: PumpError } {
  return { ok: false, error: { code, field, message } };
}

function requirePositive(
  field: string,
  label: string,
  value: number | null | undefined,
): { ok: true; value: number } | { ok: false; error: PumpError } {
  if (value == null) return fail("INVALID_PUMP", field, `${label} is blank.`);
  if (!Number.isFinite(value) || value <= 0) {
    return fail("INVALID_PUMP", field, `${label} must be a finite number greater than 0.`);
  }
  return { ok: true, value };
}

function requireEfficiency(
  value: number | null | undefined,
): { ok: true; value: number } | { ok: false; error: PumpError } {
  if (value == null) return fail("INVALID_PUMP", "pump.efficiency", "Efficiency is blank.");
  if (!Number.isFinite(value) || value <= 0) {
    return fail(
      "INVALID_PUMP",
      "pump.efficiency",
      "Efficiency must be a fraction greater than 0 and at most 1.",
    );
  }
  if (value > 1) {
    return fail(
      "INVALID_PUMP",
      "pump.efficiency",
      "Efficiency must be a fraction (enter as fraction, e.g. 0.97).",
    );
  }
  return { ok: true, value };
}

/** Present and invalid formula fields still fail when a direct bbl/stk override is in use. */
function rejectIfPresent(
  field: string,
  label: string,
  value: number | null | undefined,
  kind: "positive" | "efficiency",
): PumpError | null {
  if (value == null) return null;
  const checked =
    kind === "efficiency" ? requireEfficiency(value) : requirePositive(field, label, value);
  return checked.ok ? null : checked.error;
}

/**
 * Triplex output, bbl/stk.
 * Efficiency is a fraction in (0, 1]. A value above 1 is rejected and is not divided by 100.
 */
export function pumpOutput_bblPerStk(input: {
  linerIn?: number | null;
  strokeIn?: number | null;
  efficiency?: number | null;
}): PumpOutputResult {
  const liner = requirePositive("pump.linerIn", "Liner size", input.linerIn);
  if (!liner.ok) return liner;
  const stroke = requirePositive("pump.strokeIn", "Stroke length", input.strokeIn);
  if (!stroke.ok) return stroke;
  const efficiency = requireEfficiency(input.efficiency);
  if (!efficiency.ok) return efficiency;
  const bblPerStk = TRIPLEX_BBL_PER_STK * liner.value ** 2 * stroke.value * efficiency.value;
  if (!Number.isFinite(bblPerStk) || bblPerStk <= 0) {
    return fail("INVALID_PUMP", "pump", "Pump output is not a finite bbl/stk.");
  }
  return { ok: true, bblPerStk };
}

function resolveOutput(pump: PumpInput): PumpOutputResult {
  if (pump.bblPerStk != null) {
    if (!Number.isFinite(pump.bblPerStk) || pump.bblPerStk <= 0) {
      return fail(
        "INVALID_PUMP",
        "pump.bblPerStk",
        "bbl/stk must be a finite number greater than 0.",
      );
    }
    const liner = rejectIfPresent("pump.linerIn", "Liner size", pump.linerIn, "positive");
    if (liner) return { ok: false, error: liner };
    const stroke = rejectIfPresent("pump.strokeIn", "Stroke length", pump.strokeIn, "positive");
    if (stroke) return { ok: false, error: stroke };
    const efficiency = rejectIfPresent(
      "pump.efficiency",
      "Efficiency",
      pump.efficiency,
      "efficiency",
    );
    if (efficiency) return { ok: false, error: efficiency };
    return { ok: true, bblPerStk: pump.bblPerStk };
  }
  return pumpOutput_bblPerStk(pump);
}

/** Omitted, null, or 0 SPM → minutes and cumMinutes null. Negative or non-finite SPM is an error. */
function resolveSpm(
  spm: number | null | undefined,
): { ok: true; spm: number | null } | { ok: false; error: PumpError } {
  if (spm == null || spm === 0) return { ok: true, spm: null };
  if (!Number.isFinite(spm) || spm < 0) {
    return fail(
      "INVALID_PUMP",
      "pump.spm",
      "SPM must be a finite number greater than or equal to 0.",
    );
  }
  return { ok: true, spm };
}

/**
 * One row per displacement stage.
 * Stage bbl is the increment of core `pumped_bbl` (already string capacity × pill length covered).
 * Cumulative strokes start at 0. `minutes` is this stage's strokes / SPM.
 * `cumMinutes` is cumulative strokes / SPM. Both are null when SPM is 0 or blank.
 */
export function strokesSchedule(
  job: Job,
  result: Pick<Result, "displacement">,
): StrokesScheduleResult {
  if (job.pump == null) return fail("MISSING_PUMP", "pump", "Pump inputs are missing.");
  const output = resolveOutput(job.pump);
  if (!output.ok) return output;
  const spm = resolveSpm(job.pump.spm);
  if (!spm.ok) return spm;

  const rows: StrokesScheduleRow[] = [];
  let previous = 0;
  let cumStrokes = 0;
  for (const stage of result.displacement.stages) {
    const pumped = stage.pumped_bbl;
    if (pumped == null || !Number.isFinite(pumped)) {
      return fail(
        "INVALID_STAGE",
        `displacement.stages[${stage.n}].pumped_bbl`,
        pumped == null
          ? `Stage ${stage.n} pumped volume is missing.`
          : `Stage ${stage.n} pumped volume must be a finite number.`,
      );
    }
    const stage_bbl = pumped - previous;
    const strokes = stage_bbl / output.bblPerStk;
    cumStrokes += strokes;
    rows.push({
      n: stage.n,
      label: `Stage ${stage.n}`,
      stage_bbl,
      cum_bbl: pumped,
      strokes,
      cumStrokes,
      minutes: spm.spm == null ? null : strokes / spm.spm,
      cumMinutes: spm.spm == null ? null : cumStrokes / spm.spm,
    });
    previous = pumped;
  }
  return { ok: true, bblPerStk: output.bblPerStk, rows };
}
