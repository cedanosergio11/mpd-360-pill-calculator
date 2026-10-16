import { describe, expect, it } from "vitest";
import { tvdAt } from "@/lib/pill/hydrostatic";
import { calculate } from "./engine";
import { EXAMPLE_8_5, EMPTY_INPUTS } from "./examples";
import { buildSchedule } from "./schedule";
import { buildSteelSchedule } from "./steel";
import { surveyFromInputs } from "./equalize";
import { bitTvd, depthBeyondFields, lastSurveyMd, surveyTvdAt, syncChangedMd } from "./depth";

describe("depth block", () => {
  it("leaves the 8.5 in example inside TD and inside the bit", () => {
    expect(depthBeyondFields(EXAMPLE_8_5)).toEqual([]);
    expect(calculate(EXAMPLE_8_5).depthBlock).toBeNull();
    expect(calculate(EXAMPLE_8_5).procedurePossible).toBe(true);
  });

  it("lists a bit, pill, shoe, and survey station past TD and does not run the sheet", () => {
    const inputs = {
      ...EXAMPLE_8_5,
      tdDepth: 15000,
      currentDepthMd: 17650,
      spotMd: 15400,
      casingTvd: 16000,
    };
    const fields = depthBeyondFields(inputs);
    expect(fields).toEqual(
      expect.arrayContaining([
        { label: "Current well depth", value: 17650, limit: 15000, limitLabel: "TD" },
        { label: "Spot depth MD", value: 15400, limit: 15000, limitLabel: "TD" },
        { label: "Casing depth TVD", value: 16000, limit: 15000, limitLabel: "TD" },
      ]),
    );
    expect(fields.some((field) => field.label.startsWith("Survey station") && field.value === 15400)).toBe(true);

    const results = calculate(inputs);
    expect(results.depthBlock?.fields).toEqual(fields);
    expect(results.procedurePossible).toBe(false);
    expect(results.masp).toBeNaN();
    expect(results.totalPillVol).toBeNaN();
    expect(results.tripPressures).toEqual([]);
    expect(buildSchedule(inputs, results).rows).toEqual([]);
    expect(buildSteelSchedule(inputs, results).rows).toEqual([]);
    expect(results.errorReason).toContain("Current well depth 17650 ft is past TD 15000 ft");
  });

  it("compares pill and anchor MD to bit MD, and TVD to bit TVD", () => {
    const inputs = {
      ...EMPTY_INPUTS,
      currentDepthMd: 12000,
      casingMd: 10000,
      casingTvd: 9000,
      spotMd: 12000,
      spotTvd: 11000,
      anchorMd: 12000,
      anchorTvd: 11500,
      tdDepth: "" as const,
    };
    expect(bitTvd(inputs)).toBe(11000);
    const fields = depthBeyondFields(inputs);
    expect(fields).toEqual([
      { label: "Anchor point TVD", value: 11500, limit: 11000, limitLabel: "bit TVD" },
    ]);
    expect(calculate(inputs).depthBlock?.code).toBe("DEPTH_BEYOND_TD");
  });

  it("does not extrapolate a bit TVD past the last survey station", () => {
    expect(lastSurveyMd(EXAMPLE_8_5)).toBe(15400);
    expect(bitTvd(EXAMPLE_8_5)).toBeNull();
    expect(depthBeyondFields(EXAMPLE_8_5).some((field) => field.limitLabel === "bit TVD")).toBe(false);

    const pastBit = { ...EXAMPLE_8_5, tdDepth: "" as const, spotMd: 18000, spotTvd: 11120 };
    const tvd = bitTvd(pastBit);
    expect(tvd).not.toBeNull();
    expect(depthBeyondFields(pastBit)).toEqual([
      { label: "Spot depth MD", value: 18000, limit: 17650, limitLabel: "bit MD" },
      { label: "Anchor point TVD", value: 11250, limit: tvd, limitLabel: "bit TVD" },
    ]);
  });

  it("treats a depth equal to the limit as inside", () => {
    expect(depthBeyondFields({ ...EXAMPLE_8_5, currentDepthMd: 17650, tdDepth: 17650 })).toEqual([]);
  });

  it("does not block a bit MD past the last survey station", () => {
    const inputs = { ...EXAMPLE_8_5, currentDepthMd: 17000 };
    expect(bitTvd(inputs)).toBeNull();
    expect(calculate(inputs).depthBlock).toBeNull();
    expect(calculate(inputs).totalPillVol).toBe(calculate(EXAMPLE_8_5).totalPillVol);
  });

  it("blocks an untied shoe, anchor, or spot MD in results.depthBlock", () => {
    const shoe = calculate({ ...EXAMPLE_8_5, casingMd: 16000, casingTvd: "" });
    expect(shoe.depthBlock).toEqual({
      code: "MD_BEYOND_SURVEY",
      fields: [{ label: "Casing depth MD", value: 16000, limit: 15400, limitLabel: "last survey station" }],
    });
    const anchor = calculate({ ...EXAMPLE_8_5, anchorMd: 16000, anchorTvd: "" });
    expect(anchor.depthBlock).toEqual({
      code: "MD_BEYOND_SURVEY",
      fields: [{ label: "Anchor point MD", value: 16000, limit: 15400, limitLabel: "last survey station" }],
    });
    const spot = calculate({ ...EXAMPLE_8_5, spotMd: 16000, spotTvd: "" });
    expect(spot.depthBlock).toEqual({
      code: "MD_BEYOND_SURVEY",
      fields: [{ label: "Spot depth MD", value: 16000, limit: 13900, limitLabel: "last survey station" }],
    });
    expect(calculate(EXAMPLE_8_5).depthBlock).toBeNull();
  });
});

describe("survey TVD on an MD change", () => {
  it("recomputes anchor TVD with tvdAt so the anchor pressure follows", () => {
    const next = { ...EXAMPLE_8_5, anchorMd: 12000 };
    const survey = surveyFromInputs({ ...next, anchorMd: "", anchorTvd: "" });
    const synced = syncChangedMd(EXAMPLE_8_5, next);
    expect(synced.beyond).toEqual([]);
    expect(synced.inputs.anchorTvd).toBe(tvdAt(survey, 12000));
    expect(surveyTvdAt(next, 12000, survey)).toBe(synced.inputs.anchorTvd);
    const before = calculate(EXAMPLE_8_5);
    const after = calculate(synced.inputs);
    expect(after.depthBlock).toBeNull();
    expect(after.staticStrippingPressure).not.toBe(before.staticStrippingPressure);
    expect(after.heightPillNoDp).not.toBe(before.heightPillNoDp);
  });

  it("recomputes casing TVD so MASP follows the shoe", () => {
    const next = { ...EXAMPLE_8_5, casingMd: 12000 };
    const synced = syncChangedMd(EXAMPLE_8_5, next);
    expect(synced.beyond).toEqual([]);
    expect(synced.inputs.casingTvd).not.toBe(EXAMPLE_8_5.casingTvd);
    expect(calculate(synced.inputs).masp).not.toBe(calculate(EXAMPLE_8_5).masp);
  });

  it("blocks an MD past the last other station and does not change its TVD", () => {
    const next = { ...EXAMPLE_8_5, anchorMd: 20000 };
    const synced = syncChangedMd(EXAMPLE_8_5, next);
    expect(synced.beyond).toEqual([
      { label: "Anchor point MD", value: 20000, limit: 15400, limitLabel: "last survey station" },
    ]);
    expect(synced.inputs.anchorTvd).toBe(EXAMPLE_8_5.anchorTvd);
    expect(synced.updated).toEqual([]);
  });

  it("blocks when the survey has no station", () => {
    const before = { ...EMPTY_INPUTS, spotMd: "" as const, spotTvd: "" as const };
    const synced = syncChangedMd(before, { ...before, spotMd: 5000 });
    expect(synced.beyond).toEqual([
      { label: "Spot depth MD", value: 5000, limit: 0, limitLabel: "last survey station" },
    ]);
    expect(synced.inputs.spotTvd).toBe("");
  });

  it("does not touch TVDs when the MD is unchanged", () => {
    const synced = syncChangedMd(EXAMPLE_8_5, { ...EXAMPLE_8_5 });
    expect(synced.updated).toEqual([]);
    expect(synced.inputs.anchorTvd).toBe(11250);
    expect(synced.inputs.casingTvd).toBe(10125);
    expect(synced.inputs.spotTvd).toBe(11120);
  });
});
