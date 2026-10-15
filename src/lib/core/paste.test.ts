import { describe, expect, it } from "vitest";
import { exampleB } from "@/lib/example-b";
import type { Job } from "./job.schema";
import { loadPreset } from "./preset";
import { inputHash } from "./hash";
import { applyPaste, getPath, parseWellPaste, previewPaste, setPath } from "./paste";
import { canSimulate, simulate } from "./simulate";

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

describe("parseWellPaste tapered string", () => {
  it("blocks a second string section instead of dropping it", () => {
    const job = structuredClone(exampleB);
    const result = paste(
      [
        "OD Drill Pipe\t5.5\tin",
        "ID Drill Pipe\t4.778\tin",
        "OD Drill Pipe 1\t5.5\tin",
        "ID Drill Pipe 1\t4.778\tin",
        "Length of DP 1\t8480\tft",
        "OD Drill Pipe 2\t4\tin",
        "ID Drill Pipe 2\t3.34\tin",
      ].join("\n"),
    );
    const tapered = result.errors.filter((item) => item.code === "TAPERED_STRING");
    expect(tapered.map((item) => item.field).sort()).toEqual(
      ["idDp1", "idDp2", "lengthDp1", "odDp1", "odDp2"].sort(),
    );
    expect(result.matched.map((item) => item.field)).not.toEqual(expect.arrayContaining(["odDp1", "idDp1", "lengthDp1", "odDp2", "idDp2"]));
    expect(JSON.stringify(result.patch)).not.toContain("stringSections");
    expect(getPath(result.patch, "well.stringOd_in")).toBe(5.5);
    expect(getPath(result.patch, "well.stringId_in")).toBe(4.778);

    const preview = previewPaste(job, result);
    expect(preview.canApply).toBe(false);
    expect(preview.errors.filter((item) => item.code === "TAPERED_STRING")).toHaveLength(5);
    expect(preview.errors.filter((item) => item.code === "TAPERED_STRING").every((item) => item.blocking)).toBe(true);
    expect(() => applyPaste(job, preview)).toThrow(/blocked/);
    expect(job.well.stringOd_in).toBe(exampleB.well.stringOd_in);
    expect(canSimulate(job)).toEqual({ ok: true });

    const carried = structuredClone(exampleB);
    Object.assign(carried.well, {
      stringSections: [
        { length_ft: 8480, od_in: 5.5, id_in: 4.778 },
        { length_ft: 2000, od_in: 4, id_in: 3.34 },
      ],
    });
    expect(canSimulate(carried).ok).toBe(false);
    const refused = simulate(carried);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error).toEqual({ code: "SIM_REQUIRES_TAPERED", presetId: null });
      expect(refused).not.toHaveProperty("steps");
    }
  });
});

describe("applyPaste", () => {
  it("writes exactly the preview rows", () => {
    const job: Job = exampleB;
    const result = paste(
      ["Well name\tPasted name", "SBP on connection\t400\tpsi", "Current Well Depth (MD)\t10500\tft"].join(
        "\n",
      ),
    );
    const preview = previewPaste(job, result);
    expect(preview.canApply).toBe(true);
    expect(preview.rows.map((row) => row.field).sort()).toEqual(
      ["name", "trip.sbpConn_psi", "well.bitMd_ft"].sort(),
    );
    for (const row of preview.rows) {
      if (row.field === "name") expect(row.unit).toBeNull();
      else expect(row.unit).toBeTruthy();
    }
    const applied = applyPaste(job, preview);
    const expected = structuredClone(job);
    for (const row of preview.rows) setPath(expected, row.field, row.newValue);
    expected.meta = { presetId: null, modified: true, isExample: false };
    expect(applied).toEqual(expected);
    expect(applied.meta).toEqual({ presetId: null, isExample: false, modified: true });
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
          "Current Well Depth (MD)\t10500\tft",
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
    expect(depth?.newValue).toBe(10500);
    expect(depth?.newDisplay).toBe("10500");
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
    expect(applied.meta).toEqual({ presetId: null, isExample: false, modified: true });
    expect(applied.presetBaseline).toBeUndefined();
    expect(applied.name).toBe("Pasted name");
    expect(job).toEqual(before);
    expect(job.presetBaseline).toBe("abc");
    expect(inputHash(job)).toBe(beforeHash);
    const { meta: _meta, ...withoutMeta } = applied;
    expect(inputHash(applied)).toBe(inputHash(withoutMeta as Job));
    expect(inputHash(applied)).not.toBe(beforeHash);
  });

  it("keeps the preset id when marking the paste edited", () => {
    const job = loadPreset("B");
    const applied = applyPaste(job, previewPaste(job, paste("Well name\tPasted name")));
    expect(applied.meta).toEqual({ presetId: "B", isExample: false, modified: true });
    expect(applied.name).toBe("Pasted name");
    expect(job.meta).toEqual({ presetId: "B", isExample: true, modified: false });
  });
});

describe("previewPaste depth consistency", () => {
  it("blocks Current well depth 9000 on EXAMPLE B and lists pill bottom and anchor MD/TVD", () => {
    const job = structuredClone(exampleB);
    const before = structuredClone(job);
    const preview = previewPaste(job, paste("Current Well Depth (MD)\t9000\tft"));
    expect(preview.canApply).toBe(false);
    const depth = preview.errors.filter((item) => item.code === "DEPTH_BEYOND_TD");
    expect(depth).toHaveLength(1);
    expect(depth[0]?.blocking).toBe(true);
    expect(depth[0]?.fields).toEqual([
      { field: "well.anchorMd_ft", value: 10480, limit: 9000, limitField: "well.bitMd_ft" },
      { field: "well.anchorTvd_ft", value: 10466, limit: 9000, limitField: "well.bitMd_ft" },
      { field: "column[1].bottomMd_ft", value: 10480, limit: 9000, limitField: "well.bitMd_ft" },
    ]);
    expect(depth[0]?.message).toContain("10480");
    expect(depth[0]?.message).toContain("10466");
    expect(depth[0]?.fields?.some((item) => item.field.startsWith("well.survey"))).toBe(false);
    expect(() => applyPaste(job, preview)).toThrow(/blocked/);
    expect(job).toEqual(before);
  });

  it("applies a current well depth that stays above the pill and anchor", () => {
    const job = structuredClone(exampleB);
    const preview = previewPaste(job, paste("Current Well Depth (MD)\t10500\tft"));
    expect(preview.errors.filter((item) => item.code === "DEPTH_BEYOND_TD")).toEqual([]);
    expect(preview.canApply).toBe(true);
    const applied = applyPaste(job, preview);
    expect(applied.well.bitMd_ft).toBe(10500);
    expect(applied.well.mdTd_ft).toBe(exampleB.well.mdTd_ft);
    expect(job).toEqual(exampleB);
  });

  it("lists the last survey when TD Depth is shallower than the station", () => {
    const job = structuredClone(exampleB);
    const preview = previewPaste(job, paste("TD Depth\t9000\tft"));
    expect(preview.canApply).toBe(false);
    const fields = preview.errors.find((item) => item.code === "DEPTH_BEYOND_TD")?.fields ?? [];
    expect(fields).toEqual(
      expect.arrayContaining([
        { field: "well.survey[4].md_ft", value: 10530, limit: 9000, limitField: "well.mdTd_ft" },
        { field: "column[1].bottomMd_ft", value: 10480, limit: 9000, limitField: "well.mdTd_ft" },
        { field: "well.anchorMd_ft", value: 10480, limit: 9000, limitField: "well.mdTd_ft" },
        { field: "well.anchorTvd_ft", value: 10466, limit: 9000, limitField: "well.mdTd_ft" },
      ]),
    );
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
