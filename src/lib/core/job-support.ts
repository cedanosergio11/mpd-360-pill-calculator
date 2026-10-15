/**
 * Geometry gate for this single-string branch.
 * More than one section, a crossover depth, or an OD/ID change is #6.
 * `presetId` is not part of the check. D returns with #6 (tapered strings).
 */

import type { Well } from "./job.schema";
import { surveyTvdAt } from "./tvd";

export const TAPERED_STRING_UNSUPPORTED = "TAPERED_STRING_UNSUPPORTED" as const;

/** Calc entry points return this and nothing else. No volumes, depths, or notes. */
export type TaperedStringRefusal = {
  ok: false;
  code: typeof TAPERED_STRING_UNSUPPORTED;
};

/** A depth is past TD, or the pill or anchor is past the bit. */
export const DEPTH_BEYOND_TD = "DEPTH_BEYOND_TD" as const;

export interface DepthBeyondField {
  field: string;
  value: number;
  /** The limit that field passed. */
  limit: number;
  limitField: "well.mdTd_ft" | "well.bitMd_ft" | "surveyTvdAt(well.bitMd_ft)" | "well.survey";
}

/** Calc entry points return this and nothing else. The field list stays on `jobSupport` and the paste error. */
export type DepthBeyondRefusal = {
  ok: false;
  code: typeof DEPTH_BEYOND_TD;
};

export type CalcRefusal = TaperedStringRefusal | DepthBeyondRefusal;

export type JobSupport =
  | { ok: true }
  | { ok: false; code: typeof TAPERED_STRING_UNSUPPORTED; reason: string }
  | { ok: false; code: typeof DEPTH_BEYOND_TD; fields: DepthBeyondField[] };

interface StringGeometry {
  stringOd_in?: unknown;
  stringId_in?: unknown;
  stringSections?: unknown;
  crossovers?: unknown;
  crossoverMd_ft?: unknown;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function taperReason(well: unknown): string | null {
  if (well == null || typeof well !== "object") return null;
  const geometry = well as StringGeometry;
  const sections = Array.isArray(geometry.stringSections) ? geometry.stringSections : [];
  if (sections.length > 1) {
    for (let i = 1; i < sections.length; i++) {
      if (sectionChanges(sections[i - 1], sections[i])) {
        return "The drill string changes OD or ID along its length.";
      }
    }
    return "The drill string has more than one section.";
  }
  if (sections.length === 1 && odIdChanges(geometry, sections[0])) {
    return "The drill string changes OD or ID along its length.";
  }
  if (hasCrossoverDepth(geometry)) return "The drill string has a crossover depth.";
  return null;
}

function odIdChanges(well: StringGeometry, section: unknown): boolean {
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

/** True when `well` has more than one section, a crossover depth, or an OD/ID change. Never throws. */
export function drillStringNeedsTaper(well: unknown): boolean {
  return taperReason(well) != null;
}

const DEPTH_EPS = 1e-4;

interface DepthSegment {
  fluidId?: unknown;
  topMd_ft?: unknown;
  bottomMd_ft?: unknown;
}

interface DepthJob {
  well?: {
    mdTd_ft?: unknown;
    bitMd_ft?: unknown;
    shoeMd_ft?: unknown;
    shoeTvd_ft?: unknown;
    anchorMd_ft?: unknown;
    anchorTvd_ft?: unknown;
    survey?: { md_ft?: unknown; tvd_ft?: unknown }[];
  };
  fluids?: { id?: unknown }[];
  column?: DepthSegment[];
  pipeColumn?: DepthSegment[];
}

function asDepth(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function past(fields: DepthBeyondField[], field: string, value: number | null, limit: number | null, limitField: DepthBeyondField["limitField"]) {
  if (value == null || limit == null || !(value > limit + DEPTH_EPS)) return;
  fields.push({ field, value, limit, limitField });
}

/**
 * Every MD that is past `mdTd_ft`, including `bitMd_ft`, and every pill or anchor MD past `bitMd_ft`.
 * Anchor TVD is compared to the survey TVD at the bit, not to the bit MD.
 * Equal to the limit is inside the well.
 */
export function depthBeyondFields(job: DepthJob | null | undefined): DepthBeyondField[] {
  if (job == null || typeof job !== "object" || job.well == null) return [];
  const well = job.well;
  const td = asDepth(well.mdTd_ft);
  const bit = asDepth(well.bitMd_ft);
  const bitTvd = bit == null ? null : surveyTvdAt(well as Well, bit);
  const fields: DepthBeyondField[] = [];
  const vsTd = (field: string, value: number | null) => past(fields, field, value, td, "well.mdTd_ft");
  const vsBit = (field: string, value: number | null) => past(fields, field, value, bit, "well.bitMd_ft");

  vsTd("well.bitMd_ft", bit);
  vsTd("well.shoeMd_ft", asDepth(well.shoeMd_ft));
  vsTd("well.shoeTvd_ft", asDepth(well.shoeTvd_ft));
  vsTd("well.anchorMd_ft", asDepth(well.anchorMd_ft));
  vsTd("well.anchorTvd_ft", asDepth(well.anchorTvd_ft));
  vsBit("well.anchorMd_ft", asDepth(well.anchorMd_ft));
  past(fields, "well.anchorTvd_ft", asDepth(well.anchorTvd_ft), bitTvd, "surveyTvdAt(well.bitMd_ft)");

  const survey = Array.isArray(well.survey) ? well.survey : [];
  const last = survey.length > 0 ? survey[survey.length - 1] : null;
  if (last) {
    const index = survey.length - 1;
    vsTd(`well.survey[${index}].md_ft`, asDepth(last.md_ft));
    vsTd(`well.survey[${index}].tvd_ft`, asDepth(last.tvd_ft));
  }

  const surfaceId = job.fluids?.[0]?.id ?? job.column?.[0]?.fluidId;
  (job.column ?? []).forEach((segment, index) => {
    if (surfaceId != null && segment.fluidId === surfaceId) return;
    vsTd(`column[${index}].topMd_ft`, asDepth(segment.topMd_ft));
    vsTd(`column[${index}].bottomMd_ft`, asDepth(segment.bottomMd_ft));
    vsBit(`column[${index}].topMd_ft`, asDepth(segment.topMd_ft));
    vsBit(`column[${index}].bottomMd_ft`, asDepth(segment.bottomMd_ft));
  });
  (job.pipeColumn ?? []).forEach((segment, index) => {
    vsTd(`pipeColumn[${index}].topMd_ft`, asDepth(segment.topMd_ft));
    vsTd(`pipeColumn[${index}].bottomMd_ft`, asDepth(segment.bottomMd_ft));
  });
  return fields;
}

/** Shared lock for calc entry points. Taper uses the same geometry check as `canSimulate`. */
export function jobSupport(job: { well?: unknown } | null | undefined): JobSupport {
  const reason = job == null || typeof job !== "object" ? null : taperReason(job.well);
  if (reason != null) return { ok: false, code: TAPERED_STRING_UNSUPPORTED, reason };
  const fields = depthBeyondFields(job as DepthJob);
  if (fields.length > 0) return { ok: false, code: DEPTH_BEYOND_TD, fields };
  return { ok: true };
}

export function isTaperedRefusal(value: unknown): value is TaperedStringRefusal {
  if (value == null || typeof value !== "object") return false;
  const row = value as { ok?: unknown; code?: unknown };
  return row.ok === false && row.code === TAPERED_STRING_UNSUPPORTED;
}

export function isCalcRefusal(value: unknown): value is CalcRefusal {
  if (value == null || typeof value !== "object") return false;
  const row = value as { ok?: unknown; code?: unknown };
  return row.ok === false && (row.code === TAPERED_STRING_UNSUPPORTED || row.code === DEPTH_BEYOND_TD);
}

/**
 * Jobs `simulate` builds for one pipe MD. The user's job is checked first.
 * Moving `bitMd_ft` to that pipe MD leaves the pill and anchor where they are,
 * so the step is not a second depth error.
 */
const pipeStepJobs = new WeakSet<object>();

export function markPipeStep(job: object): void {
  pipeStepJobs.add(job);
}

/** `{ ok: false, code }` when the job is tapered or past TD. No field values. Null when the engine may run. */
export function calcRefusal(job: { well?: unknown } | null | undefined): CalcRefusal | null {
  const support = jobSupport(job);
  if (support.ok) return null;
  if (support.code === DEPTH_BEYOND_TD && job != null && pipeStepJobs.has(job)) return null;
  return { ok: false, code: support.code };
}

/** `{ ok: false, code }` when the job is tapered. Null when the single-string engine may run. */
export function taperedCalcRefusal(job: { well?: unknown } | null | undefined): TaperedStringRefusal | null {
  const refusal = calcRefusal(job);
  return refusal?.code === TAPERED_STRING_UNSUPPORTED ? refusal : null;
}

/** Throw before a mutator clones or writes a tapered job. A depth error does not throw. The job is not changed. */
export function refuseTaperedJob(job: { well?: unknown } | null | undefined): void {
  const support = jobSupport(job);
  if (support.ok || support.code !== TAPERED_STRING_UNSUPPORTED) return;
  const error = new Error(support.reason) as Error & { code: typeof TAPERED_STRING_UNSUPPORTED };
  error.code = TAPERED_STRING_UNSUPPORTED;
  throw error;
}

/** Narrow a calc result after an earlier `calcRefusal` guard. A refusal here is a missed guard. */
export function demandSupported<T>(value: T | CalcRefusal): T {
  if (!isCalcRefusal(value)) return value;
  const error = new Error(value.code) as Error & { code: CalcRefusal["code"] };
  error.code = value.code;
  throw error;
}
