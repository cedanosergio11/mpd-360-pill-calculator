import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { WW_FARMS } from "./examples";
import { round } from "../utils";
import { buildRihFitStops, pillTopWithPipe, shoeEsdFromPillTop } from "./rih-fit";
import { annularBblFt, capBblFt } from "../utils";

describe("RIH stop vs FIT at shoe — WW Farms", () => {
  const r = calculate(WW_FARMS);
  const csg = capBblFt(8.681);
  const ann = annularBblFt(8.681, 5.5);

  it("pipe-out pill top is ~5445 ft and shoe ESD is ~17.17", () => {
    expect(r.topOfPillNoDp).toBe(5445);
    expect(round(shoeEsdFromPillTop(5445, WW_FARMS), 2)).toBe(17.18);
  });

  it("bit 6550 raises shoe ESD to ~17.42 (Sergio dry run, almost FIT 17.5)", () => {
    const top = pillTopWithPipe(5450, 11045, 6550, csg, ann);
    expect(round(top, 0)).toBe(4712);
    expect(round(shoeEsdFromPillTop(top, WW_FARMS), 2)).toBe(17.42);
  });

  it("FIT 17.5 first stop is ~6900 ft, then circulate and RIH again", () => {
    const { stages } = buildRihFitStops(WW_FARMS, r, { pillTop: 5450, pillBase: 11045 });
    expect(stages.length).toBe(3);
    expect(stages[0].stopBit).toBe(6900);
    expect(round(stages[0].shoeEsdAtStop, 2)).toBe(17.5);
    expect(stages[1].pillTop).toBe(6900);
    expect(stages[1].stopBit).toBe(10513);
    expect(stages[2].canReachBase).toBe(true);
    expect(stages[2].stopBit).toBeNull();
  });

  it("defaults to procedure no-DP top", () => {
    const { stages } = buildRihFitStops(WW_FARMS, r);
    expect(stages[0].pillTop).toBe(5445);
    expect(stages[0].stopBit).toBeGreaterThan(6500);
    expect(stages[0].stopBit).toBeLessThan(7000);
  });
});
