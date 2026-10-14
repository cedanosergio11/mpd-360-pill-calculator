import { create } from "zustand";
import type { Issue, Job, Result } from "@/contract";
import { calculate, inputHash } from "@/contract";
import { exampleJob } from "@/lib/example-job";
import { setPath } from "@/lib/paths";

const KEY = "pillview-rebuild.job.v1";

type State = {
  job: Job; result: Result | null; saved: boolean; loaded: boolean;
  load: () => void; set: (path: string, v: unknown) => void; replace: (j: Job) => void;
  save: () => void; run: () => void; reset: () => void;
};

export const useStore = create<State>((set, get) => ({
  job: exampleJob, result: null, saved: false, loaded: false,
  load: () => {
    let job = exampleJob;
    try { const raw = localStorage.getItem(KEY); if (raw) { const j = JSON.parse(raw); if (j?.schemaVersion === 1) job = { ...j, pipeColumn: j.pipeColumn ?? [] }; } } catch { /* ignore */ }
    set({ job, saved: !!localStorage.getItem(KEY), loaded: true, result: calculate(job) });
  },
  set: (path, v) => set({ job: setPath(get().job, path, v), saved: false }),
  replace: (j) => { const job = { ...j, pipeColumn: j.pipeColumn ?? [] }; set({ job, saved: false, result: calculate(job) }); },
  save: () => { const job = { ...get().job, savedAt: new Date().toISOString() }; localStorage.setItem(KEY, JSON.stringify(job)); set({ job, saved: true }); },
  run: () => set({ result: calculate(get().job) }),
  reset: () => set({ job: exampleJob, saved: false, result: calculate(exampleJob) }),
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
