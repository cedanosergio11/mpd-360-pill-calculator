import { create } from "zustand";
import type { Issue, Job, Result } from "@/contract";
import { calculate, inputHash, markEdited, metaFromSaved, resetToPreset } from "@/contract";
import { exampleJob } from "@/lib/example-job";
import { setPath } from "@/lib/paths";

const KEY = "pillview-rebuild.job.v1";

/** localStorage shape: the job plus the optional input hash of the preset/import it came from. Never part of the in-memory Job (it would change inputHash). */
export type SavedJob = Job & { presetBaseline?: string };
export function toSaved(job: Job, baselineHash: string | null): SavedJob {
  return baselineHash ? { ...job, presetBaseline: baselineHash } : { ...job };
}
/** Parses a saved job. Old saves without `presetBaseline` load with no baseline (no "(edited)" marker). */
export function parseSaved(raw: string | null): { job: Job; baselineHash: string | null } | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as SavedJob;
    if (j?.schemaVersion !== 1) return null;
    const { presetBaseline, ...rest } = j;
    const job = { ...rest, pipeColumn: rest.pipeColumn ?? [] } as Job;
    job.meta = metaFromSaved(rest.meta);
    return { job, baselineHash: typeof presetBaseline === "string" && presetBaseline ? presetBaseline : null };
  } catch { return null; }
}

type State = {
  job: Job; result: Result | null;
  /** Inputs snapshot used by the last Calculate (what `result` was computed from). */
  calcJob: Job | null;
  /** Input hash of the loaded preset / import; persisted as `presetBaseline`. Null = no baseline, no marker. */
  baselineHash: string | null; saved: boolean; loaded: boolean;
  load: () => void; set: (path: string, v: unknown) => void; replace: (j: Job) => void;
  save: () => void; run: () => void; reset: () => void;
};

export const useStore = create<State>((set, get) => ({
  job: exampleJob, result: null, calcJob: null, baselineHash: null, saved: false, loaded: false,
  load: () => {
    let job = exampleJob; let baselineHash: string | null = null;
    try { const p = parseSaved(localStorage.getItem(KEY)); if (p) { job = p.job; baselineHash = p.baselineHash; } } catch { /* ignore */ }
    set({ job, baselineHash, saved: !!localStorage.getItem(KEY), loaded: true, result: calculate(job), calcJob: job });
  },
  set: (path, v) => set({ job: markEdited(setPath(get().job, path, v)), saved: false }),
  replace: (j) => { const { presetBaseline: _pb, ...rest } = j as SavedJob; const job = { ...rest, pipeColumn: rest.pipeColumn ?? [] } as Job; set({ job, saved: false, result: calculate(job), calcJob: job, baselineHash: inputHash(job) }); },
  save: () => { const job = { ...get().job, savedAt: new Date().toISOString() }; localStorage.setItem(KEY, JSON.stringify(toSaved(job, get().baselineHash))); set({ job, saved: true }); },
  run: () => { const job = get().job; set({ result: calculate(job), calcJob: job }); },
  reset: () => { const job = resetToPreset(get().job); set({ job, saved: false, result: calculate(job), calcJob: job, baselineHash: inputHash(job) }); },
}));

export const useOutOfDate = () => useStore((s) => !!s.result && inputHash(s.job) !== s.result.inputHash);
/** Issues for one input: its own path, or any result issue whose jobFields name it. */
/** Issues for one input: its own path, or any result issue whose exact jobFields name it. */
export const issuesFor = (issues: Issue[] | undefined, path: string): Issue[] =>
  (issues ?? []).flatMap((i) =>
    i.field === path ? [i]
    : (i.jobFields ?? []).includes(path) ? [{ ...i, message: `Input to ${i.code} (full message in banner).` }]
    : []);
export const worst = (issues: Issue[] | undefined) =>
  (issues ?? []).find((i) => i.level === "error") ?? (issues ?? []).find((i) => i.level === "warn");

/** Screen marker: live inputs differ from the baseline. */
export const useEdited = () => useStore((s) => s.baselineHash != null && inputHash(s.job) !== s.baselineHash);
/** Print marker: last-Calculate inputs differ from the baseline. */
export const useCalcEdited = () => useStore((s) => s.baselineHash != null && !!s.calcJob && inputHash(s.calcJob) !== s.baselineHash);
