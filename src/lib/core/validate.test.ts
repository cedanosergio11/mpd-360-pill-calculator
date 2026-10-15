import { describe, expect, it } from "vitest";
import { calculate as calculateAny } from "./calculate";
import { isCalcRefusal } from "./job-support";
import type { Result } from "./result";
import { exampleJob } from "./example-job";
import { inputHash, stableStringify } from "./hash";
import type { Job } from "./job.schema";
import { validate } from "./validate";

function calculate(job: Job): Result {
  const result = calculateAny(job);
  if (isCalcRefusal(result)) throw new Error(result.code);
  return result;
}

function issues(job: Job, code: string) {
  return validate(job).filter((item) => item.code === code);
}

describe("validate — column", () => {
  it("accepts the EXAMPLE job", () => {
    const errors = validate(exampleJob()).filter((item) => item.level === "error");
    expect(errors).toEqual([]);
  });

  it("errors on a column gap with a dotted field path", () => {
    const job = exampleJob();
    job.column[1].topMd_ft = 7500;
    const gap = issues(job, "COLUMN_GAP");
    expect(gap).toHaveLength(1);
    expect(gap[0].level).toBe("error");
    expect(gap[0].field).toBe("column[1].topMd_ft");
  });

  it("errors when the column does not start at surface or reach TD", () => {
    const fromSurface = exampleJob();
    fromSurface.column[0].topMd_ft = 100;
    expect(issues(fromSurface, "COLUMN_GAP")[0].field).toBe("column[0].topMd_ft");

    const short = exampleJob();
    short.column[2].bottomMd_ft = 9500;
    expect(issues(short, "COLUMN_GAP")[0].field).toBe("column[2].bottomMd_ft");
  });

  it("errors on a column overlap", () => {
    const job = exampleJob();
    job.column[1].topMd_ft = 6000;
    const overlap = issues(job, "COLUMN_OVERLAP");
    expect(overlap).toHaveLength(1);
    expect(overlap[0].field).toBe("column[1].topMd_ft");
  });

  it("errors on an unknown fluidId", () => {
    const job = exampleJob();
    job.column[1].fluidId = "missing";
    const unknown = issues(job, "UNKNOWN_FLUID");
    expect(unknown[0]).toMatchObject({
      level: "error",
      field: "column[1].fluidId",
    });
  });
});

describe("validate — TVD", () => {
  it("errors when TVD is greater than MD", () => {
    const job = exampleJob();
    job.well.shoeTvd_ft = 6000;
    job.well.survey = [{ md_ft: 1000, tvd_ft: 1001 }];
    const found = issues(job, "TVD_GT_MD");
    expect(found.map((item) => item.field).sort()).toEqual([
      "well.shoeTvd_ft",
      "well.survey[0].tvd_ft",
    ]);
  });

  it("does not warn when entered shoe and anchor TVDs are used with no survey", () => {
    const job = exampleJob();
    delete job.well.survey;
    expect(issues(job, "TVD_INTERPOLATED")).toEqual([]);
  });

  it("does not warn when shoe and anchor are survey stations", () => {
    expect(issues(exampleJob(), "TVD_INTERPOLATED")).toEqual([]);
  });

  it("derives a missing anchor TVD from the survey and names anchor when that TVD is interpolated", () => {
    const job = exampleJob();
    delete job.well.anchorTvd_ft;
    job.well.tvdTd_ft = 8000;
    job.well.survey = [
      { md_ft: 5000, tvd_ft: 5000 },
      { md_ft: 10000, tvd_ft: 8000 },
    ];
    const anchor = issues(job, "TVD_INTERPOLATED").find(
      (item) => item.field === "well.anchorMd_ft",
    );
    expect(anchor?.level).toBe("warn");
    expect(anchor?.message).toMatch(/anchor/i);
    expect(anchor?.message).toMatch(/from survey/);
    expect(anchor?.message).toMatch(/7400/);
    expect(issues(job, "TVD_INTERPOLATED").some((item) => item.field === "well.shoeTvd_ft")).toBe(
      false,
    );
    const result = calculate(job);
    // 5000 ft TVD at 5000 MD, 8000 ft TVD at 10000 MD → 7400 ft TVD at 9000 MD.
    expect(result.depths.anchor.tvd_ft).toBeCloseTo(7400, 4);
  });
});

describe("validate — pipe column", () => {
  it("errors on a pipe-column gap with a dotted field path", () => {
    const job = exampleJob();
    job.pipeColumn = [
      { fluidId: "mud", topMd_ft: 0, bottomMd_ft: 4000 },
      { fluidId: "pill", topMd_ft: 4500, bottomMd_ft: 10000 },
    ];
    const gap = issues(job, "COLUMN_GAP");
    expect(gap).toHaveLength(1);
    expect(gap[0].field).toBe("pipeColumn[1].topMd_ft");
  });

  it("errors on an unknown pipe fluid and when the pipe column misses the bit", () => {
    const unknown = exampleJob();
    unknown.pipeColumn = [{ fluidId: "missing", topMd_ft: 0, bottomMd_ft: 10000 }];
    expect(issues(unknown, "UNKNOWN_FLUID")[0]).toMatchObject({
      level: "error",
      field: "pipeColumn[0].fluidId",
    });

    const short = exampleJob();
    short.pipeColumn = [{ fluidId: "mud", topMd_ft: 0, bottomMd_ft: 9000 }];
    expect(issues(short, "COLUMN_GAP")[0].field).toBe("pipeColumn[0].bottomMd_ft");
  });
});

describe("validate — Fann", () => {
  it("errors MISSING_FANN on the fluid that a hydraulics result needs", () => {
    const job = exampleJob();
    delete job.fluids[1].fann;
    const missing = issues(job, "MISSING_FANN");
    expect(missing[0]).toMatchObject({ level: "error", field: "fluids[1].fann" });
  });

  it("points at the missing dial reading", () => {
    const job = exampleJob();
    job.fluids[1].fann = { ...job.fluids[1].fann!, r300: Number.NaN };
    expect(issues(job, "MISSING_FANN")[0].field).toBe("fluids[1].fann.r300");
  });

  it("errors INVALID_FANN when the dials cannot support Herschel-Bulkley", () => {
    const job = exampleJob();
    job.fluids[1].fann = { ...job.fluids[1].fann!, r600: 40, r300: 48 };
    expect(issues(job, "INVALID_FANN")[0].field).toBe("fluids[1].fann.r300");
  });

  it("does not require Fann when nothing hydraulic is requested", () => {
    const job = exampleJob();
    delete job.fluids[0].fann;
    delete job.fluids[1].fann;
    job.trip.flow_gpm = 0;
    job.trip.speeds_ftmin = [];
    expect(issues(job, "MISSING_FANN")).toEqual([]);
  });
});

describe("inputHash", () => {
  it("ignores savedAt and key order", () => {
    const first = exampleJob();
    const second = exampleJob();
    second.savedAt = "1999-01-01T00:00:00.000Z";
    expect(inputHash(first)).toBe(inputHash(second));
    expect(inputHash(first)).toMatch(/^[0-9a-f]{16}$/);
    second.name = "EXAMPLE other";
    expect(inputHash(second)).not.toBe(inputHash(first));
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });
});

describe("calculate — blocked inputs stay null", () => {
  it("does not publish a zero ESD when the column is invalid", () => {
    const job = exampleJob();
    job.column[1].topMd_ft = 7500;
    const result = calculate(job);
    expect(result.depths.shoe.esd_ppg).toBeNull();
    expect(result.depths.anchor.ecd_ppg).toBeNull();
    expect(result.displacement.pillVolume_bbl).toBeNull();
    expect(result.tripSchedule).toEqual([]);
    expect(result.depths.shoe.surge).toEqual([]);
  });
});
