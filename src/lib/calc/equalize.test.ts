import { describe, expect, it } from "vitest";
import { equalizeFloatAirCap, surveyFromInputs, tvdOfSurvey } from "./equalize";
import { calculate } from "./engine";
import { MOMENTUM } from "./examples";
import { annularBblFt, capBblFt, round } from "../utils";

describe("equalizeFloatAirCap", () => {
  it("dumps 7.39 bbl on Momentum as-pumped KMW with air-cap U-tube", () => {
    const r = calculate(MOMENTUM);
    const eq = equalizeFloatAirCap({
      bitMd: 11527,
      tvdOf: tvdOfSurvey(surveyFromInputs(MOMENTUM)),
      kmw: 18.5,
      baseMw: 15.3,
      boreBblFt: capBblFt(3.7),
      annularBblFt: annularBblFt(6.88, 4.5),
      pipeKmwVolume: r.finalKwm,
      pipeChaseVolume: r.correctedChase,
      annularHeightMd: r.heightPillNoDp,
    });
    expect(round(eq.dumpBbl, 2)).toBe(7.39);
    expect(round(eq.remainingPipeKmw, 2)).toBe(145.61);
    expect(eq.dumpBbl).toBeGreaterThan(0);
    expect(eq.dumpBbl).toBeLessThan(r.finalKwm);
    expect(Math.abs(eq.pDp - eq.pAnn)).toBeLessThan(0.05);
    expect(round(r.equalizeDumpBbl, 2)).toBe(round(eq.dumpBbl, 2));
  });
});
