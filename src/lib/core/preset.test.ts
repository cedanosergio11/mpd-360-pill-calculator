import { describe, expect, it } from "vitest";
import { exampleB, exampleC } from "@/lib/example-b";
import { exampleJob } from "@/lib/example-job";
import { inputHash } from "./hash";
import { appDefaultJob, jobLabel, loadPreset, markEdited, resetToPreset } from "./preset";

describe("jobLabel", () => {
  it("returns the preset letter when the job is an example", () => {
    expect(jobLabel(loadPreset("B"))).toBe("EXAMPLE B");
    expect(jobLabel(loadPreset("C"))).toBe("EXAMPLE C");
  });

  // re-enable when #6 (tapered strings) lands
  it.skip("returns EXAMPLE D for EXAMPLE D", () => {
    expect(jobLabel(loadPreset("D"))).toBe("EXAMPLE D");
  });

  it("returns Modified, not an EXAMPLE when the job is not an example", () => {
    expect(jobLabel(markEdited(loadPreset("B")))).toBe("Modified, not an EXAMPLE");
    expect(jobLabel(exampleC)).toBe("Modified, not an EXAMPLE");
    expect(jobLabel(appDefaultJob())).toBe("Modified, not an EXAMPLE");
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
