import { describe, expect, it } from "vitest";
import { exampleB, exampleC } from "@/lib/example-b";
import { exampleJob } from "@/lib/example-job";
import { inputHash } from "./hash";
import type { PresetId } from "./job.schema";
import { AVAILABLE_PRESETS, appDefaultJob, jobLabel, loadPreset, markEdited, resetToPreset } from "./preset";

function presetReady(id: PresetId): boolean {
  try {
    loadPreset(id);
    return true;
  } catch {
    return false;
  }
}

/** EXAMPLE D is absent until tapered strings. The D label test runs once `loadPreset("D")` succeeds. */
const exampleDReady = presetReady("D");

describe("AVAILABLE_PRESETS", () => {
  it("does not offer EXAMPLE D", () => {
    // D returns with #6 (tapered strings).
    expect([...AVAILABLE_PRESETS]).toEqual(["B", "C"]);
    expect(AVAILABLE_PRESETS).not.toContain("D");
    expect(() => loadPreset("D")).toThrow(/tapered strings/);
  });
});

describe("jobLabel", () => {
  it("returns the neutral name for B", () => {
    expect(loadPreset("B").name).toBe("EXAMPLE, pill trip-in");
    expect(jobLabel(loadPreset("B"))).toEqual({ kind: "example", text: "EXAMPLE, pill trip-in" });
  });

  it("returns the neutral name for C", () => {
    expect(loadPreset("C").name).toBe("EXAMPLE, SBP 550");
    expect(jobLabel(loadPreset("C"))).toEqual({ kind: "example", text: "EXAMPLE, SBP 550" });
  });

  // re-enable when #6 (tapered strings) lands
  it.skipIf(!exampleDReady)("returns EXAMPLE D", () => {
    expect(jobLabel(loadPreset("D")).text).toBe("EXAMPLE D");
  });

  it("returns Modified, not an EXAMPLE for a modified job", () => {
    expect(jobLabel(markEdited(loadPreset("B")))).toEqual({
      kind: "modified",
      text: "Modified, not an EXAMPLE",
    });
    expect(jobLabel(exampleC)).toEqual({ kind: "modified", text: "Modified, not an EXAMPLE" });
    expect(jobLabel(appDefaultJob())).toEqual({ kind: "modified", text: "Modified, not an EXAMPLE" });
  });

  it("no user-facing preset string contains the B or C letter", () => {
    const labels = [
      jobLabel(loadPreset("B")),
      jobLabel(loadPreset("C")),
      jobLabel(markEdited(loadPreset("B"))),
      jobLabel(markEdited(loadPreset("C"))),
      jobLabel(exampleB),
      jobLabel(exampleC),
      jobLabel(exampleJob),
      jobLabel(appDefaultJob()),
      jobLabel({ ...loadPreset("B"), meta: { presetId: "D", isExample: true, modified: false } }),
    ];
    if (exampleDReady) labels.push(jobLabel(loadPreset("D")));
    for (const label of labels) {
      expect(label.text).not.toContain("B/C/D");
      expect(label.text).not.toMatch(/\bEXAMPLE [BC]\b/);
    }
    expect(loadPreset("B").name).not.toMatch(/\bEXAMPLE [BC]\b/);
    expect(loadPreset("C").name).not.toMatch(/\bEXAMPLE [BC]\b/);
  });
});

describe("resetToPreset", () => {
  it("returns the loaded preset", () => {
    const loaded = loadPreset("C");
    expect(loaded.meta).toEqual({ presetId: "C", isExample: true, modified: false });
    const edited = markEdited(loaded);
    edited.name = "changed";
    edited.trip.sbpConn_psi = 1;
    const reset = resetToPreset(edited);
    expect(reset.meta).toEqual({ presetId: "C", isExample: true, modified: false });
    expect(reset.name).toBe(exampleC.name);
    expect(reset.trip.sbpConn_psi).toBe(exampleC.trip.sbpConn_psi);
    expect(inputHash(reset)).toBe(inputHash(exampleC));
    expect(loaded.meta).toEqual({ presetId: "C", isExample: true, modified: false });
  });

  it("returns the app default when presetId is null", () => {
    const edited = markEdited(structuredClone(exampleB));
    expect(edited.meta?.presetId).toBeNull();
    const reset = resetToPreset(edited);
    expect(reset.meta).toEqual({ presetId: null, isExample: true, modified: false });
    expect(reset.name).toBe(exampleJob.name);
    expect(inputHash(reset)).toBe(inputHash(exampleJob));
    expect(reset).toEqual(appDefaultJob());
  });

  it("loads B as an unmodified example", () => {
    const job = loadPreset("B");
    expect(job.meta).toEqual({ presetId: "B", isExample: true, modified: false });
    expect(job.name).toBe(exampleB.name);
    expect(exampleB.meta).toBeUndefined();
  });

  // re-enable when #6 (tapered strings) lands
  it.skip("loads D as an unmodified example", () => {
    const job = loadPreset("D");
    expect(job.meta).toEqual({ presetId: "D", isExample: true, modified: false });
    expect(job.name).toBe("EXAMPLE D (tapered)");
  });
});
