import { exampleB, exampleC } from "@/lib/example-b";
import { exampleJob } from "@/lib/example-job";
import type { Job, JobMeta, PresetId } from "./job.schema";
import { drillStringNeedsTaper, refuseTaperedJob, TAPERED_STRING_UNSUPPORTED } from "./job-support";

export { TAPERED_STRING_UNSUPPORTED };

/** Older saves with no `meta` load as this. They are not an EXAMPLE. */
export const LEGACY_JOB_META: JobMeta = {
  presetId: null,
  isExample: false,
  modified: true,
};

/** Presets this branch can load. D returns with #6 (tapered strings). */
export const AVAILABLE_PRESETS = ["B", "C"] as const;

const PRESETS: Record<(typeof AVAILABLE_PRESETS)[number], Job> = {
  B: exampleB,
  C: exampleC,
};

function isOffered(id: PresetId): id is (typeof AVAILABLE_PRESETS)[number] {
  return (AVAILABLE_PRESETS as readonly PresetId[]).includes(id);
}

/**
 * A saved job either becomes the single-string job, or comes back untouched.
 * `saved` is the caller's object. It is not rewritten as one section.
 */
export type RestoreSavedResult =
  | { ok: true; job: Job; baselineHash: string | null }
  | { ok: false; code: typeof TAPERED_STRING_UNSUPPORTED; saved: unknown };

/**
 * Load a saved or legacy job. Never throws.
 * `metaFromSaved` runs only for a single string, and only on the returned copy.
 * More than one section, a crossover depth, or an OD/ID change returns
 * `{ ok: false, code: TAPERED_STRING_UNSUPPORTED, saved }` and does not rewrite `saved`.
 * Invalid input returns null.
 */
export function restoreSaved(input: unknown): RestoreSavedResult | null {
  try {
    const saved = typeof input === "string" ? (input ? JSON.parse(input) : null) : input;
    if (saved == null || typeof saved !== "object" || Array.isArray(saved)) return null;
    const record = saved as Record<string, unknown>;
    if (record.schemaVersion !== 1) return null;
    if (drillStringNeedsTaper(record.well)) {
      return { ok: false, code: TAPERED_STRING_UNSUPPORTED, saved };
    }
    const { presetBaseline, ...rest } = record;
    const job = { ...rest, pipeColumn: rest.pipeColumn ?? [] } as Job;
    job.meta = metaFromSaved(rest.meta);
    const baselineHash = typeof presetBaseline === "string" && presetBaseline ? presetBaseline : null;
    return { ok: true, job, baselineHash };
  } catch {
    return null;
  }
}

/** `meta` from a saved job. Missing `meta` is the legacy object. Does not read or rewrite the string. */
export function metaFromSaved(meta: unknown): JobMeta {
  if (meta == null || typeof meta !== "object") return { ...LEGACY_JOB_META };
  const raw = meta as { presetId?: unknown; isExample?: unknown; modified?: unknown };
  const presetId = raw.presetId === "B" || raw.presetId === "C" || raw.presetId === "D" ? raw.presetId : null;
  return {
    presetId,
    isExample: raw.isExample === true,
    modified: raw.modified === true,
  };
}

/** The preset job, flagged as an unmodified example. EXAMPLE D waits for tapered strings. */
export function loadPreset(id: PresetId): Job {
  // D returns with #6 (tapered strings).
  if (!isOffered(id)) throw new Error("EXAMPLE D is not available until tapered strings land.");
  const job = structuredClone(PRESETS[id]);
  job.meta = { presetId: id, isExample: true, modified: false };
  return job;
}

/** App default (EXAMPLE Well A) when the job is not on B, C, or D. */
export function appDefaultJob(): Job {
  const job = structuredClone(exampleJob);
  job.meta = { presetId: null, isExample: true, modified: false };
  return job;
}

/** The preset named by `job.meta.presetId`, or the app default when that id is null. A tapered job is unchanged. */
export function resetToPreset(job: Job): Job {
  refuseTaperedJob(job);
  const id = job.meta?.presetId;
  if (id === "B" || id === "C" || id === "D") return loadPreset(id);
  return appDefaultJob();
}

/**
 * Screen header and print title.
 * `kind` matches the lock: an unmodified example whose string is tapered is
 * `example-locked`, the same state as `jobSupport`'s `TAPERED_STRING_UNSUPPORTED`.
 * That text is `EXAMPLE, tapered strings not available yet` and is never `Modified`.
 * An unmodified single-string B or C example is `example`. The text is the preset
 * name and does not include the preset letter. `PresetId` itself stays B, C, or D.
 * Anything else, including a legacy save and the app default, is `modified`.
 */
export type JobLabelKind = "example" | "example-locked" | "modified";

export interface JobLabel {
  kind: JobLabelKind;
  text: string;
}

const LOCKED_EXAMPLE = "EXAMPLE, tapered strings not available yet";

export function jobLabel(job: Job): JobLabel {
  const meta = job.meta;
  const unmodifiedExample = meta?.isExample === true && meta.modified !== true;
  if (unmodifiedExample && drillStringNeedsTaper(job.well)) {
    return { kind: "example-locked", text: LOCKED_EXAMPLE };
  }
  const id = unmodifiedExample ? meta.presetId : null;
  if (id === "B") return { kind: "example", text: "EXAMPLE, pill trip-in" };
  if (id === "C") return { kind: "example", text: "EXAMPLE, SBP 550" };
  if (id === "D") return { kind: "example", text: "EXAMPLE D" };
  return { kind: "modified", text: "Modified, not an EXAMPLE" };
}

/**
 * Any input edit. Keeps `presetId`. Clears the example flag and marks the job modified.
 * Does not mutate `job`.
 */
export function markEdited(job: Job): Job {
  refuseTaperedJob(job);
  const next = structuredClone(job);
  next.meta = {
    presetId: next.meta?.presetId ?? null,
    isExample: false,
    modified: true,
  };
  return next;
}
