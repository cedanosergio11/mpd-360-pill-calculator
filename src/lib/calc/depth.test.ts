import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { EXAMPLE_8_5, EMPTY_INPUTS } from "./examples";
import { buildSchedule } from "./schedule";
import { buildSteelSchedule } from "./steel";
import { depthBeyondFields } from "./depth";

describe("depth block", () => {
  it("leaves the 8.5 in example inside TD and inside the bit", () => {
    expect(depthBeyondFields(EXAMPLE_8_5)).toEqual([]);
    expect(calculate(EXAMPLE_8_5).depthBlock).toBeNull();
    expect(calculate(EXAMPLE_8_5).procedurePossible).toBe(true);
  });

  it("lists a bit, pill, and shoe past TD and does not run the sheet", () => {
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
    expect(fields.some((field) => field.label.startsWith("Survey station"))).toBe(false);

    const results = calculate(inputs);
    expect(results.depthBlock?.fields).toEqual(fields);
    expect(results.depthBlock?.code).toBe("DEPTH_BEYOND_TD");
    expect(results.procedurePossible).toBe(false);
    expect(results.masp).toBeNaN();
    expect(results.totalPillVol).toBeNaN();
    expect(results.tripPressures).toEqual([]);
    expect(buildSchedule(inputs, results).rows).toEqual([]);
    expect(buildSteelSchedule(inputs, results).rows).toEqual([]);
    expect(results.errorReason).toContain("Current well depth 17650 ft is past TD 15000 ft");
  });

  it("compares pill and anchor MD to bit MD", () => {
    const inputs = {
      ...EMPTY_INPUTS,
      currentDepthMd: 12000,
      casingMd: 10000,
      casingTvd: 9000,
      spotMd: 13000,
      spotTvd: 11000,
      anchorMd: 12500,
      anchorTvd: 11500,
      tdDepth: "" as const,
    };
    expect(depthBeyondFields(inputs)).toEqual([
      { label: "Spot depth MD", value: 13000, limit: 12000, limitLabel: "bit MD" },
      { label: "Anchor point MD", value: 12500, limit: 12000, limitLabel: "bit MD" },
    ]);
    expect(calculate(inputs).depthBlock?.code).toBe("DEPTH_BEYOND_TD");
  });

  it("does not compare sheet TVDs to an invented bit TVD", () => {
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
    expect(depthBeyondFields(inputs)).toEqual([]);
    expect(calculate(inputs).depthBlock).toBeNull();
  });

  it("treats a depth equal to the limit as inside", () => {
    expect(depthBeyondFields({ ...EXAMPLE_8_5, currentDepthMd: 17650, tdDepth: 17650 })).toEqual([]);
  });

  it("refuses a bit MD one foot past TD", () => {
    const inputs = { ...EXAMPLE_8_5, currentDepthMd: 17651 };
    expect(depthBeyondFields(inputs)).toEqual([
      { label: "Current well depth", value: 17651, limit: 17650, limitLabel: "TD" },
    ]);
    const results = calculate(inputs);
    expect(results.depthBlock).toEqual({
      code: "DEPTH_BEYOND_TD",
      fields: [{ label: "Current well depth", value: 17651, limit: 17650, limitLabel: "TD" }],
    });
    expect(results.procedurePossible).toBe(false);
  });
});
