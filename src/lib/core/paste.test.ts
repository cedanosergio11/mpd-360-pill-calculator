import { describe, expect, it } from "vitest";
import { exampleB } from "@/lib/example-b";
import type { Job } from "./job.schema";
import { applyPaste, getPath, parseWellPaste, previewPaste, setPath } from "./paste";

function paste(text: string) {
  return parseWellPaste(text);
}

describe("parseWellPaste commas", () => {
  it("accepts a thousands separator only when three digits follow", () => {
    const cases: [string, number | null][] = [
      ["1,500", 1500],
      ["1,234.5", 1234.5],
      ["1,234,567", 1234567],
      ["1,5", null],
      ["1,50", null],
      ["1,2345", null],
    ];
    for (const [raw, expected] of cases) {
      const result = paste(`Current Well Depth (MD)\t${raw}\tft`);
      if (expected == null) {
        expect(result.errors.some((item) => item.code === "BAD_NUMBER")).toBe(true);
        expect(result.patch).toEqual({});
        expect(JSON.stringify(result.patch)).not.toContain("15");
      } else {
        expect(result.errors.filter((item) => item.code === "BAD_NUMBER")).toEqual([]);
        expect(getPath(result.patch, "well.bitMd_ft")).toBe(expected);
      }
    }
  });

  it("treats 1,500 and 1500 as the same value", () => {
    const result = paste("Current Well Depth (MD)\t1500\tft\nCurrent Well Depth (MD)\t1,500\tft");
    expect(result.ok).toBe(true);
    expect(result.ignored.some((item) => item.code === "DUPLICATE")).toBe(true);
    expect(getPath(result.patch, "well.bitMd_ft")).toBe(1500);
  });
});

describe("parseWellPaste duplicates", () => {
  it("keeps a repeated label with the same value as a DUPLICATE warning", () => {
    const result = paste("Well name\tAlpha\nWell name\tAlpha");
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.ignored.some((item) => item.code === "DUPLICATE")).toBe(true);
    expect(getPath(result.patch, "name")).toBe("Alpha");
  });

  it("blocks the patch on CONFLICTING_DUPLICATE", () => {
    const result = paste("Well name\tAlpha\nSBP on connection\t400\tpsi\nWell name\tBeta");
    expect(result.ok).toBe(false);
    expect(result.patch).toEqual({});
    expect(result.matched).toEqual([]);
    const conflict = result.errors.find((item) => item.code === "CONFLICTING_DUPLICATE");
    expect(conflict?.field).toBe("name");
    const preview = previewPaste(exampleB, result);
    expect(preview.canApply).toBe(false);
    expect(preview.errors.find((item) => item.code === "CONFLICTING_DUPLICATE")?.blocking).toBe(true);
    expect(preview.rows).toEqual([]);
  });
});

describe("applyPaste", () => {
  it("writes exactly the preview rows", () => {
    const job: Job = exampleB;
    const result = paste(
      ["Well name\tPasted name", "SBP on connection\t400\tpsi", "Current Well Depth (MD)\t10000\tft"].join(
        "\n",
      ),
    );
    const preview = previewPaste(job, result);
    expect(preview.canApply).toBe(true);
    expect(preview.rows.map((row) => row.field).sort()).toEqual(
      ["name", "trip.sbpConn_psi", "well.bitMd_ft", "well.mdTd_ft"].sort(),
    );
    for (const row of preview.rows) {
      if (row.field === "name") expect(row.unit).toBeNull();
      else expect(row.unit).toBeTruthy();
    }
    const applied = applyPaste(job, preview);
    const expected = structuredClone(job);
    for (const row of preview.rows) setPath(expected, row.field, row.newValue);
    expect(applied).toEqual(expected);
    expect(job).toEqual(exampleB);
  });

  it("throws when canApply is false and leaves the job unchanged", () => {
    const job = structuredClone(exampleB);
    const before = structuredClone(job);
    const preview = previewPaste(job, paste("Current Well Depth (MD)\t1,5\tft"));
    expect(preview.canApply).toBe(false);
    expect(preview.errors.some((item) => item.code === "BAD_NUMBER" && item.blocking)).toBe(true);
    expect(() => applyPaste(job, preview)).toThrow(/blocked/);
    expect(job).toEqual(before);
  });
});

describe("parseWellPaste does not take a job", () => {
  it("returns a patch from text alone", () => {
    const result = paste("Well name\tOnly text");
    expect(result.ok).toBe(true);
    expect(getPath(result.patch, "name")).toBe("Only text");
  });

  it("ignores a calculated MASP row", () => {
    const result = paste("MASP for this Procedure\t501\tpsi\nWell name\tKept");
    expect(result.ignored.some((item) => item.code === "CALCULATED")).toBe(true);
    expect(result.patch).toEqual({ name: "Kept" });
  });
});
