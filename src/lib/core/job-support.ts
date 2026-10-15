/**
 * Geometry gate for this single-string branch.
 * More than one section, a crossover depth, or an OD/ID change is #6.
 * `presetId` is not part of the check. D returns with #6 (tapered strings).
 */

export const TAPERED_STRING_UNSUPPORTED = "TAPERED_STRING_UNSUPPORTED" as const;

/** Calc entry points return this and nothing else. No volumes, depths, or notes. */
export type TaperedStringRefusal = {
  ok: false;
  code: typeof TAPERED_STRING_UNSUPPORTED;
};

export type JobSupport =
  | { ok: true }
  | { ok: false; code: typeof TAPERED_STRING_UNSUPPORTED; reason: string };

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

/** Shared lock for calc entry points and mutators. Same geometry check as `canSimulate`. */
export function jobSupport(job: { well?: unknown } | null | undefined): JobSupport {
  const reason = job == null || typeof job !== "object" ? null : taperReason(job.well);
  return reason == null ? { ok: true } : { ok: false, code: TAPERED_STRING_UNSUPPORTED, reason };
}

export function isTaperedRefusal(value: unknown): value is TaperedStringRefusal {
  if (value == null || typeof value !== "object") return false;
  const row = value as { ok?: unknown; code?: unknown };
  return row.ok === false && row.code === TAPERED_STRING_UNSUPPORTED;
}

/** `{ ok: false, code }` when the job is tapered. Null when the single-string engine may run. */
export function taperedCalcRefusal(job: { well?: unknown } | null | undefined): TaperedStringRefusal | null {
  return jobSupport(job).ok ? null : { ok: false, code: TAPERED_STRING_UNSUPPORTED };
}

/** Throw before a mutator clones or writes. The job argument is not changed. */
export function refuseTaperedJob(job: { well?: unknown } | null | undefined): void {
  const support = jobSupport(job);
  if (support.ok) return;
  const error = new Error(support.reason) as Error & { code: typeof TAPERED_STRING_UNSUPPORTED };
  error.code = TAPERED_STRING_UNSUPPORTED;
  throw error;
}

/** Narrow a calc result after an earlier `taperedCalcRefusal` guard. A refusal here is a missed guard. */
export function demandSupported<T>(value: T | TaperedStringRefusal): T {
  if (!isTaperedRefusal(value)) return value;
  const error = new Error(TAPERED_STRING_UNSUPPORTED) as Error & { code: typeof TAPERED_STRING_UNSUPPORTED };
  error.code = TAPERED_STRING_UNSUPPORTED;
  throw error;
}
