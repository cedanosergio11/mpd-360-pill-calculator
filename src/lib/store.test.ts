import { describe, expect, it } from "vitest";
import { inputHash, jobLabel, loadPreset, markEdited } from "@/contract";
import { exampleC } from "@/lib/example-b";
import { parseSaved, toSaved, useStore } from "@/lib/store";

describe("saved job presetBaseline", () => {
  it("loads an old save without presetBaseline with no baseline", () => {
    const p = parseSaved(JSON.stringify(exampleC));
    expect(p).not.toBeNull();
    expect(p!.baselineHash).toBeNull();
    expect(inputHash(p!.job)).toBe(inputHash(exampleC));
  });
  it("round-trips presetBaseline without changing the job hash", () => {
    const base = inputHash(exampleC);
    const edited = { ...exampleC, trip: { ...exampleC.trip, sbpConn_psi: 560 } };
    const saved = toSaved(edited, base);
    expect(saved.presetBaseline).toBe(base);
    const p = parseSaved(JSON.stringify(saved))!;
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
    const parsed = parseSaved(JSON.stringify(toSaved(job, "abc")));
    expect(parsed).not.toBeNull();
    expect(parsed!.job.meta).toEqual({ presetId: "B", isExample: false, modified: true });
    expect(parsed!.job.name).toBe("Saved B");
    expect(parsed!.baselineHash).toBe("abc");
    expect("presetBaseline" in parsed!.job).toBe(false);
  });

  it("loads a legacy save with no meta as not an EXAMPLE", () => {
    const parsed = parseSaved(JSON.stringify(exampleC));
    expect(parsed).not.toBeNull();
    expect(parsed!.job.meta).toEqual({ presetId: null, isExample: false, modified: true });
    expect(jobLabel(parsed!.job)).toBe("Modified, not an EXAMPLE");
    expect(parsed!.job.name).toBe(exampleC.name);
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
