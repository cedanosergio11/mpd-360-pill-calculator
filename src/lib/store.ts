import { create } from "zustand";
import type { Issue, Job, Result } from "@/contract";
import { calculate, inputHash, isTaperedRefusal, jobSupport, markEdited, resetToPreset, restoreSaved, type RestoreSavedResult } from "@/contract";
import { exampleJob } from "@/lib/example-job";
import { setPath } from "@/lib/paths";

const KEY = "pillview-rebuild.job.v1";

/** localStorage shape: the job plus the optional input hash of the preset/import it came from. Never part of the in-memory Job (it would change inputHash). */
export type SavedJob = Job & { presetBaseline?: string };
export function toSaved(job: Job, baselineHash: string | null): SavedJob {
  return baselineHash ? { ...job, presetBaseline: baselineHash } : { ...job };
}
/** Parses a saved job. Old saves without `presetBaseline` load with no baseline (no "(edited)" marker). A tapered string is not rewritten. */
export function parseSaved(raw: string | null): RestoreSavedResult | null {
  return restoreSaved(raw);
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

function calcOrNull(job: Job): Result | null {
  const result = calculate(job);
  return isTaperedRefusal(result) ? null : result;
}

export const useStore = create<State>((set, get) => ({
  job: exampleJob, result: null, calcJob: null, baselineHash: null, saved: false, loaded: false,
  load: () => {
    let job = exampleJob; let baselineHash: string | null = null; let hasRaw = false;
    try {
      const raw = localStorage.getItem(KEY);
      hasRaw = !!raw;
      const restored = restoreSaved(raw);
      if (restored?.ok) { job = restored.job; baselineHash = restored.baselineHash; }
    } catch { /* ignore */ }
    set({ job, baselineHash, saved: hasRaw, loaded: true, result: calcOrNull(job), calcJob: job });
  },
  set: (path, v) => {
    const current = get().job;
    if (!jobSupport(current).ok) return;
    set({ job: markEdited(setPath(current, path, v)), saved: false });
  },
  replace: (j) => { const { presetBaseline: _pb, ...rest } = j as SavedJob; const job = { ...rest, pipeColumn: rest.pipeColumn ?? [] } as Job; set({ job, saved: false, result: calcOrNull(job), calcJob: job, baselineHash: inputHash(job) }); },
  save: () => { const job = { ...get().job, savedAt: new Date().toISOString() }; localStorage.setItem(KEY, JSON.stringify(toSaved(job, get().baselineHash))); set({ job, saved: true }); },
  run: () => { const job = get().job; set({ result: calcOrNull(job), calcJob: job }); },
  reset: () => { const job = resetToPreset(get().job); set({ job, saved: false, result: calcOrNull(job), calcJob: job, baselineHash: inputHash(job) }); },
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
