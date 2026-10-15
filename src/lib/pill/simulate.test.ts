import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc/engine";
import { EXAMPLE_8_5 } from "@/lib/calc/examples";
import { composeWellState, geometryFromWell, pillFromProcedure } from "./from-calc";
import { computeModel } from "./physics";
import { simulate } from "./simulate";
import { DEFAULT_STATE } from "./types";

describe("simulate", () => {
  it("steps the 1.0 pill model at a pipe MD", () => {
    const results = calculate(EXAMPLE_8_5);
    const pipeMd = 15400;
    const run = simulate(EXAMPLE_8_5, results, [pipeMd, 14000]);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const geometry = geometryFromWell(EXAMPLE_8_5);
    const placed = pillFromProcedure(EXAMPLE_8_5, results, geometry, "closed");
    const base = composeWellState(EXAMPLE_8_5, {
      ...DEFAULT_STATE,
      ...placed,
      pipeEnd: "closed",
      autoBackfill: true,
    });
    const model = computeModel({ ...base, pipeDepth: pipeMd });
    expect(run.steps[0]).toEqual({
      pipeMd,
      pillTop: model.pillTop,
      pillBottom: model.pillBottom,
      tripTankGain: model.tripTankGain,
      phase: model.phase,
    });
    expect(run.steps[1]?.pipeMd).toBe(14000);
    expect(Number.isFinite(run.steps[1]?.pillTop)).toBe(true);
  });

  it("returns the depth field list and no steps", () => {
    const inputs = { ...EXAMPLE_8_5, spotMd: 18000 };
    const results = calculate(inputs);
    const run = simulate(inputs, results, [15400, 18000]);
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.fields.some((field) => field.label === "Spot depth MD")).toBe(true);
    expect(run).not.toHaveProperty("steps");
    expect(JSON.stringify(run)).not.toMatch(/pillTop/);
  });

  it("blocks a pipe MD past TD before any step numbers", () => {
    const results = calculate(EXAMPLE_8_5);
    const run = simulate(EXAMPLE_8_5, results, [18000]);
    expect(run).toEqual({
      ok: false,
      code: "DEPTH_BEYOND_TD",
      fields: [{ label: "Pipe MD", value: 18000, limit: 17650, limitLabel: "TD" }],
    });
  });
});
