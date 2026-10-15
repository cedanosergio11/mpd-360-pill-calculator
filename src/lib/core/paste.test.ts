import { describe, expect, it } from "vitest";
import { exampleB } from "@/lib/example-b";
import type { Job } from "./job.schema";
import { inputHash } from "./hash";
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
    expected.meta = { modified: true, isExample: false };
    expect(applied).toEqual(expected);
    expect(applied.meta).toEqual({ modified: true, isExample: false });
    expect(job).toEqual(exampleB);
    expect(exampleB.meta).toBeUndefined();
  });

  it("formats display strings and leaves the raw values", () => {
    const preview = previewPaste(
      exampleB,
      paste(
        [
          "Well name\tPasted name",
          "Current MW\t12.25\tppg",
          "Current Well Depth (MD)\t10000\tft",
          "SBP on connection\t400\tpsi",
        ].join("\n"),
      ),
    );
    const mw = preview.rows.find((row) => row.field === "fluids.0.density_ppg");
    expect(mw?.kind).toBe("number");
    expect(mw?.newValue).toBe(12.25);
    expect(mw?.newDisplay).toBe("12.25");
    expect(mw?.oldValue).toBe(11.4);
    expect(mw?.oldDisplay).toBe("11.40");
    expect(mw?.changed).toBe(true);
    expect(mw?.unit).toBe("ppg");
    const name = preview.rows.find((row) => row.field === "name");
    expect(name?.kind).toBe("text");
    expect(name?.newValue).toBe("Pasted name");
    expect(name?.newDisplay).toBe("Pasted name");
    expect(name?.oldDisplay).toBe(exampleB.name);
    const depth = preview.rows.find((row) => row.field === "well.bitMd_ft");
    expect(depth?.kind).toBe("number");
    expect(depth?.newValue).toBe(10000);
    expect(depth?.newDisplay).toBe("10000");
    expect(depth?.oldValue).toBe(10480);
    expect(depth?.oldDisplay).toBe("10480");
    const sbp = preview.rows.find((row) => row.field === "trip.sbpConn_psi");
    expect(sbp?.newValue).toBe(400);
    expect(sbp?.newDisplay).toBe("400");
    expect(sbp?.oldValue).toBe(325);
    expect(sbp?.oldDisplay).toBe("325");
  });

  it("shows a ppg change from the raw values at 0.01", () => {
    const job = structuredClone(exampleB);
    job.fluids[0].density_ppg = 12.6;
    const preview = previewPaste(job, paste("Current MW\t12.65\tppg"));
    const mw = preview.rows.find((row) => row.field === "fluids.0.density_ppg");
    expect(mw?.changed).toBe(true);
    expect(mw?.newValue).toBe(12.65);
    expect(mw?.oldValue).toBe(12.6);
    expect(mw?.newDisplay).toBe("12.65");
    expect(mw?.oldDisplay).toBe("12.60");
  });

  it("shows a bbl/stk change from the raw values at 0.0001", () => {
    const job = structuredClone(exampleB);
    job.pump = { ...job.pump, bblPerStk: 0.0962 };
    const preview = previewPaste(job, paste("Pump Displacement\t0.0958\tbbl/stk"));
    const row = preview.rows.find((item) => item.field === "pump.bblPerStk");
    expect(row?.kind).toBe("number");
    expect(row?.unit).toBe("bbl/stk");
    expect(row?.changed).toBe(true);
    expect(row?.newValue).toBe(0.0958);
    expect(row?.oldValue).toBe(0.0962);
    expect(row?.newDisplay).toBe("0.0958");
    expect(row?.oldDisplay).toBe("0.0962");
  });

  it("keeps changed true when rounding makes the display strings match", () => {
    const job = structuredClone(exampleB);
    job.fluids[0].density_ppg = 12.601;
    const preview = previewPaste(job, paste("Current MW\t12.604\tppg"));
    const mw = preview.rows.find((row) => row.field === "fluids.0.density_ppg");
    expect(mw?.oldDisplay).toBe("12.60");
    expect(mw?.newDisplay).toBe("12.60");
    expect(mw?.oldValue).toBe(12.601);
    expect(mw?.newValue).toBe(12.604);
    expect(mw?.changed).toBe(true);
  });

  it("throws when canApply is false and leaves the job unchanged", () => {
    const job = structuredClone(exampleB);
    const before = structuredClone(job);
    const preview = previewPaste(job, paste("Current Well Depth (MD)\t1,5\tft"));
    expect(preview.canApply).toBe(false);
    expect(preview.errors.some((item) => item.code === "BAD_NUMBER" && item.blocking)).toBe(true);
    expect(() => applyPaste(job, preview)).toThrow(/blocked/);
    expect(job).toEqual(before);
    expect(job.meta).toBeUndefined();
  });

  it("flags the returned job and leaves the preset baseline untouched", () => {
    const job = { ...structuredClone(exampleB), presetBaseline: "abc" } as Job & { presetBaseline?: string };
    const before = structuredClone(job);
    const beforeHash = inputHash(job);
    const preview = previewPaste(job, paste("Well name\tPasted name"));
    const applied = applyPaste(job, preview) as Job & { presetBaseline?: string };
    expect(applied.meta).toEqual({ modified: true, isExample: false });
    expect(applied.presetBaseline).toBeUndefined();
    expect(applied.name).toBe("Pasted name");
    expect(job).toEqual(before);
    expect(job.presetBaseline).toBe("abc");
    expect(inputHash(job)).toBe(beforeHash);
    const { meta: _meta, ...withoutMeta } = applied;
    expect(inputHash(applied)).toBe(inputHash(withoutMeta as Job));
    expect(inputHash(applied)).not.toBe(beforeHash);
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
