import { describe, expect, it } from "vitest";
import { exampleB } from "@/lib/example-b";
import { exampleJob } from "./example-job";
import { calculate } from "./calculate";
import { fieldLabel, hasFieldLabel } from "./field-label";
import { isCalcRefusal, depthBeyondFields } from "./job-support";
import type { Job } from "./job.schema";
import { parseWellPaste, previewPaste } from "./paste";

function overDeep(): Job {
  const job = structuredClone(exampleB);
  job.well.mdTd_ft = 1000;
  job.well.bitMd_ft = 900;
  job.well.shoeMd_ft = 2000;
  job.well.shoeTvd_ft = 2000;
  job.well.anchorMd_ft = 3000;
  job.well.anchorTvd_ft = 3000;
  job.well.survey = [{ md_ft: 4000, tvd_ft: 4000 }];
  job.column = [
    { fluidId: "mud", topMd_ft: 0, bottomMd_ft: 100 },
    { fluidId: "pill", topMd_ft: 5000, bottomMd_ft: 6000 },
  ];
  job.pipeColumn = [{ fluidId: "mud", topMd_ft: 7000, bottomMd_ft: 8000 }];
  return job;
}

function emittedPaths(): string[] {
  const paths = new Set<string>();
  for (const field of depthBeyondFields(overDeep())) paths.add(field.field);

  const preview = previewPaste(
    exampleB,
    parseWellPaste(
      [
        "Well name\tPasted",
        "Current Well Depth (MD)\t10000\tft",
        "TD Depth\t10500\tft",
        "Anchor point MD\t10000\tft",
        "Anchor point TVD\t9986\tft",
        "Casing depth MD\t8000\tft",
        "Casing depth TVD\t7988\tft",
        "Spot depth MD\t9000\tft",
        "Spot depth TVD\t8986\tft",
        "Open hole diameter\t12.25\tin",
        "Desired EMW\t12\tppg",
        "OD Drill Pipe\t5.5\tin",
        "ID Drill Pipe\t4.778\tin",
        "ID Casing\t12.515\tin",
        "Current MW\t11.4\tppg",
        "Pump Displacement\t0.1176\tbbl/stk",
        "KMW\t12.1\tppg",
        "SBP on connection\t325\tpsi",
        "FIT\t12.6\tppg",
        "Initial flow rate\t300\tgpm",
        "Casing ID larger\t12.6\tin",
        "Casing shoe depth MD larger\t7000\tft",
        "Liner ID\t8.5\tin",
        "Liner hanger\t7000\tft",
        "Liner shoe\t9000\tft",
      ].join("\n"),
    ),
  );
  for (const row of preview.rows) paths.add(row.field);

  const hot = exampleJob();
  hot.well.fit_ppg = 12;
  hot.trip.speeds_ftmin = [];
  hot.trip.flow_gpm = 0;
  const result = calculate(hot);
  if (!isCalcRefusal(result)) {
    for (const issue of result.issues) {
      for (const path of issue.jobFields ?? []) paths.add(path);
    }
  }
  return [...paths];
}

describe("fieldLabel", () => {
  it("names bit MD and a string section by one-based index", () => {
    expect(fieldLabel("well.bitMd_ft")).toEqual({ label: "Bit MD", unit: "ft" });
    expect(fieldLabel("stringSections[1].id_in")).toEqual({ label: "String section 2 ID", unit: "in" });
    expect(fieldLabel("stringSections[0].od_in")).toEqual({ label: "String section 1 OD", unit: "in" });
    expect(fieldLabel("stringSections[1].length_ft")).toEqual({ label: "String section 2 length", unit: "ft" });
    expect(fieldLabel("name")).toEqual({ label: "Well name", unit: "" });
    expect(fieldLabel("survey")).toEqual({ label: "Survey", unit: "" });
    expect(fieldLabel("well.casing.0.id_in")).toEqual({ label: "Casing 1 ID", unit: "in" });
    expect(fieldLabel("column[1].bottomMd_ft")).toEqual({ label: "Annulus column 2 bottom MD", unit: "ft" });
  });

  it("humanizes an unknown path and does not return the raw path", () => {
    const unknown = "well.notARealField_ft";
    const label = fieldLabel(unknown);
    expect(hasFieldLabel(unknown)).toBe(false);
    expect(label.label).not.toBe(unknown);
    expect(label.label).not.toContain(".");
    expect(label.label).not.toContain("[");
    expect(label.unit).toBe("ft");
    expect(label.label.toLowerCase()).toContain("not a real field");
  });

  it("has an entry for every path preview, depth, or the inputs list can emit", () => {
    const paths = emittedPaths();
    expect(paths.length).toBeGreaterThan(10);
    expect(paths).toEqual(
      expect.arrayContaining([
        "well.bitMd_ft",
        "name",
        "column[1].bottomMd_ft",
        "well.survey[0].md_ft",
        "pipeColumn[0].bottomMd_ft",
        "well.casing.0.id_in",
        "well.casing.1",
        "spot.bottomMd_ft",
        "well.survey.spot",
        "fluids[0].density_ppg",
        "trip.sbpConn_psi",
        "well.tvdTd_ft",
      ]),
    );
    for (const path of paths) {
      expect(hasFieldLabel(path), path).toBe(true);
      const label = fieldLabel(path);
      expect(label.label, path).not.toBe(path);
      expect(label.label, path).not.toMatch(/\[|\./);
    }
  });
});
