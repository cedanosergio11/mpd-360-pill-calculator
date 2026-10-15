import { afterEach, describe, expect, it, vi } from "vitest";
import { canSimulate, inputHash, jobLabel, loadPreset, markEdited, restoreSaved, simulate, TAPERED_STRING_UNSUPPORTED } from "@/contract";
import { exampleB, exampleC } from "@/lib/example-b";
import { exampleJob } from "@/lib/example-job";
import type { Job } from "@/lib/core/job.schema";
import { parseSaved, toSaved, useStore } from "@/lib/store";

function restoredJob(raw: string) {
  const parsed = parseSaved(raw);
  expect(parsed?.ok).toBe(true);
  if (!parsed?.ok) throw new Error("expected a restored job");
  return parsed;
}

describe("saved job presetBaseline", () => {
  it("loads an old save without presetBaseline with no baseline", () => {
    const p = restoredJob(JSON.stringify(exampleC));
    expect(p.baselineHash).toBeNull();
    expect(inputHash(p.job)).toBe(inputHash(exampleC));
  });
  it("round-trips presetBaseline without changing the job hash", () => {
    const base = inputHash(exampleC);
    const edited = { ...exampleC, trip: { ...exampleC.trip, sbpConn_psi: 560 } };
    const saved = toSaved(edited, base);
    expect(saved.presetBaseline).toBe(base);
    const p = restoredJob(JSON.stringify(saved));
    expect(p.baselineHash).toBe(base);
    expect("presetBaseline" in p.job).toBe(false);
    expect(inputHash(p.job)).toBe(inputHash(edited));
    expect(inputHash(p.job)).not.toBe(base);
  });
  it("omits presetBaseline when there is no baseline", () => {
    expect("presetBaseline" in toSaved(exampleC, null)).toBe(false);
  });

  it("round-trips meta on save and reload", () => {
    const job = markEdited(loadPreset("B"));
    job.name = "Saved B";
    const parsed = restoredJob(JSON.stringify(toSaved(job, "abc")));
    expect(parsed.job.meta).toEqual({ presetId: "B", isExample: false, modified: true });
    expect(parsed.job.name).toBe("Saved B");
    expect(parsed.baselineHash).toBe("abc");
    expect("presetBaseline" in parsed.job).toBe(false);
  });

  it("loads a legacy save with no meta as not an EXAMPLE", () => {
    const parsed = restoredJob(JSON.stringify(exampleC));
    expect(parsed.job.meta).toEqual({ presetId: null, isExample: false, modified: true });
    expect(jobLabel(parsed.job)).toBe("Modified, not an EXAMPLE");
    expect(parsed.job.name).toBe(exampleC.name);
  });
});

const SAVED_KEY = "pillview-rebuild.job.v1";

function taperedSave(meta: Job["meta"] | undefined): Job {
  const job = structuredClone(exampleC);
  job.name = "EXAMPLE D (tapered)";
  Object.assign(job.well, {
    stringSections: [
      { length_ft: 8480, od_in: 5.5, id_in: 4.778 },
      { length_ft: 2000, od_in: 4, id_in: 3.34 },
    ],
  });
  if (meta === undefined) delete job.meta;
  else job.meta = meta;
  return job;
}

function expectSavedRefused(input: Job) {
  const snapshot = structuredClone(input);
  let result: ReturnType<typeof restoreSaved> = null;
  expect(() => {
    result = restoreSaved(input);
  }).not.toThrow();
  expect(result).toEqual({ ok: false, code: TAPERED_STRING_UNSUPPORTED, saved: input });
  expect(input).toEqual(snapshot);
  expect((input.well as { stringSections?: unknown[] }).stringSections).toHaveLength(2);
  expect(canSimulate(input).ok).toBe(false);
  const sim = simulate(input);
  expect(sim.ok).toBe(false);
  if (!sim.ok) expect(sim.error).toEqual({ code: "SIM_REQUIRES_TAPERED", presetId: "D" });
  expect(sim).not.toHaveProperty("steps");
}

describe("restore tapered saves", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses a saved D with meta and leaves the object untouched", () => {
    expectSavedRefused(taperedSave({ presetId: "D", isExample: true, modified: false }));
  });

  it("refuses a legacy D save with no meta and leaves the object untouched", () => {
    const input = taperedSave(undefined);
    expect(input.meta).toBeUndefined();
    expectSavedRefused(input);
    expect(input.meta).toBeUndefined();
  });

  it("does not write a collapsed job back to storage", () => {
    const input = taperedSave({ presetId: "D", isExample: true, modified: false });
    const raw = JSON.stringify(input);
    const memory = new Map<string, string>([[SAVED_KEY, raw]]);
    const setItem = vi.fn((key: string, value: string) => {
      memory.set(key, value);
    });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem,
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
    });
    useStore.getState().load();
    expect(setItem).not.toHaveBeenCalled();
    expect(memory.get(SAVED_KEY)).toBe(raw);
    expect(JSON.parse(memory.get(SAVED_KEY)!)).toEqual(input);
    expect(useStore.getState().job.name).toBe(exampleJob.name);
    expect((useStore.getState().job.well as { stringSections?: unknown }).stringSections).toBeUndefined();
  });

  it("restores EXAMPLE B and EXAMPLE C", () => {
    for (const id of ["B", "C"] as const) {
      const job = loadPreset(id);
      const restored = restoreSaved(JSON.stringify(toSaved(job, "base")));
      expect(restored?.ok).toBe(true);
      if (!restored?.ok) return;
      expect(restored.baselineHash).toBe("base");
      expect(restored.job.meta).toEqual({ presetId: id, isExample: true, modified: false });
      expect(restored.job.name).toBe(job.name);
      expect(restored.job.well.stringOd_in).toBe(job.well.stringOd_in);
      expect(restored.job.well.stringId_in).toBe(job.well.stringId_in);
      expect((restored.job.well as { stringSections?: unknown }).stringSections).toBeUndefined();
      expect(canSimulate(restored.job)).toEqual({ ok: true });
      expect(simulate(restored.job, { mds: [job.well.bitMd_ft], fromMd_ft: 0 }).ok).toBe(true);
    }
    expect(restoreSaved(exampleB)?.ok).toBe(true);
  });
});

describe("input edits", () => {
  it("marks any input edit and keeps the preset id", () => {
    useStore.getState().replace(loadPreset("C"));
    useStore.getState().set("name", "Edited C");
    expect(useStore.getState().job.meta).toEqual({ presetId: "C", isExample: false, modified: true });
    expect(useStore.getState().job.name).toBe("Edited C");
  });

  // re-enable when #6 (tapered strings) lands
  it.skip("marks an EXAMPLE D edit and keeps the preset id", () => {
    useStore.getState().replace(loadPreset("D"));
    useStore.getState().set("name", "Edited D");
    expect(useStore.getState().job.meta).toEqual({ presetId: "D", isExample: false, modified: true });
    expect(useStore.getState().job.name).toBe("Edited D");
  });
});
