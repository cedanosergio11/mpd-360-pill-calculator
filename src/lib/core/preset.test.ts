import { describe, expect, it } from "vitest";
import { exampleB, exampleC, exampleD } from "@/lib/example-b";
import { exampleJob } from "@/lib/example-job";
import { inputHash } from "./hash";
import { appDefaultJob, jobLabel, loadPreset, markEdited, resetToPreset } from "./preset";

describe("jobLabel", () => {
  it("returns EXAMPLE B/C/D when the job is an example", () => {
    for (const id of ["B", "C", "D"] as const) {
      expect(jobLabel(loadPreset(id))).toBe("EXAMPLE B/C/D");
    }
  });

  it("returns Modified, not an EXAMPLE when the job is not an example", () => {
    expect(jobLabel(markEdited(loadPreset("B")))).toBe("Modified, not an EXAMPLE");
    expect(jobLabel(exampleC)).toBe("Modified, not an EXAMPLE");
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

  it.each([
    ["B", exampleB],
    ["D", exampleD],
  ] as const)("loads %s as an unmodified example", (id, source) => {
    const job = loadPreset(id);
    expect(job.meta).toEqual({ presetId: id, isExample: true, modified: false });
    expect(job.name).toBe(source.name);
    expect(source.meta).toBeUndefined();
  });
});
