import { exampleB, exampleC, exampleD } from "@/lib/example-b";
import { exampleJob } from "@/lib/example-job";
import type { Job, JobMeta, PresetId } from "./job.schema";

/** Older saves with no `meta` load as this. They are not an EXAMPLE. */
export const LEGACY_JOB_META: JobMeta = {
  presetId: null,
  isExample: false,
  modified: true,
};

const PRESETS: Record<PresetId, Job> = {
  B: exampleB,
  C: exampleC,
  D: exampleD,
};

/** `meta` from a saved job. Missing `meta` is the legacy object. */
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

/** The preset job, flagged as an unmodified example. */
export function loadPreset(id: PresetId): Job {
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

/** The preset named by `job.meta.presetId`, or the app default when that id is null. */
export function resetToPreset(job: Job): Job {
  const id = job.meta?.presetId;
  if (id === "B" || id === "C" || id === "D") return loadPreset(id);
  return appDefaultJob();
}

/**
 * Any input edit. Keeps `presetId`. Clears the example flag and marks the job modified.
 * Does not mutate `job`.
 */
export function markEdited(job: Job): Job {
  const next = structuredClone(job);
  next.meta = {
    presetId: next.meta?.presetId ?? null,
    isExample: false,
    modified: true,
  };
  return next;
}
