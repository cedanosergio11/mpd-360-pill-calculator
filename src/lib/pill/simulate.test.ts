import { readFileSync } from "node:fs";
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

  it("refuses a calculated depthBlock before any model", () => {
    const inputs = { ...EXAMPLE_8_5, spotMd: 18000 };
    const results = calculate(inputs);
    expect(results.depthBlock).not.toBeNull();
    const run = simulate(inputs, results, [15400]);
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.code).toBe("DEPTH_BEYOND_TD");
    expect(run.fields.length).toBeGreaterThan(0);
    expect(run).not.toHaveProperty("steps");
    expect(run).not.toHaveProperty("models");
  });

  it("refuses while a depth block is active, before any model", () => {
    const results = calculate(EXAMPLE_8_5);
    const blocked = {
      ...results,
      depthBlock: {
        code: "DEPTH_BEYOND_TD" as const,
        fields: [{ label: "Anchor point MD", value: 20000, limit: 17650, limitLabel: "TD" }],
      },
    };
    const run = simulate(EXAMPLE_8_5, blocked, [15400]);
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.fields).toEqual(blocked.depthBlock.fields);
    expect(run).not.toHaveProperty("models");
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

  it("uses the live well when one is passed, and the simulator view does not call computeModel", () => {
    const results = calculate(EXAMPLE_8_5);
    const geometry = geometryFromWell(EXAMPLE_8_5);
    const placed = pillFromProcedure(EXAMPLE_8_5, results, geometry, "open");
    const live = composeWellState(EXAMPLE_8_5, {
      ...DEFAULT_STATE,
      ...placed,
      pipeEnd: "open",
      autoBackfill: false,
    });
    const run = simulate(EXAMPLE_8_5, results, [live.pipeDepth], live);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const model = computeModel(live);
    expect(run.models[0]).toEqual(model);
    expect(run.steps[0]?.pillTop).toBe(model.pillTop);
    const view = readFileSync(new URL("../../components/simulator-view.tsx", import.meta.url), "utf8");
    expect(view).not.toMatch(/computeModel/);
    expect(view).toMatch(/simulate\(/);
  });
});
