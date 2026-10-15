import { describe, expect, it } from "vitest";
import { exampleB } from "@/lib/example-b";
import { calculate } from "./calculate";
import { fmtBbl, fmtDepth, fmtDepthRange, fmtEmw, fmtKmw, fmtPsi } from "./format";
import { isCalcRefusal } from "./job-support";

const EM_DASH = "\u2014";

describe("display format", () => {
  it("rounds a depth range outward and keeps an exact integer", () => {
    expect(fmtDepthRange(9404.93, 10466)).toBe("9,404\u201310,466 ft");
    expect(fmtDepthRange(9404, 10466)).toBe("9,404\u201310,466 ft");
    expect(fmtDepthRange(9404.0, 10466.0)).toBe("9,404\u201310,466 ft");
    expect(fmtDepthRange(1000, 2000.0001)).toBe("1,000\u20132,001 ft");
    expect(fmtDepthRange(999.2, 1000)).toBe("999\u20131,000 ft");
  });

  it("formats a whole depth, including a large value", () => {
    expect(fmtDepth(10480)).toBe("10,480 ft");
    expect(fmtDepth(10480.4)).toBe("10,480 ft");
    expect(fmtDepth(1_234_567.2)).toBe("1,234,567 ft");
  });

  it("renders negative zero as zero", () => {
    expect(fmtDepth(-0)).toBe("0 ft");
    expect(fmtDepthRange(-0, -0)).toBe("0\u20130 ft");
    expect(fmtEmw(-0)).toBe("0.00");
    expect(fmtKmw(-0)).toBe("0.0");
    expect(fmtPsi(-0)).toBe("0");
    expect(fmtBbl(-0)).toBe("0.0");
    expect(Object.is(fmtDepth(-0), "0 ft")).toBe(true);
  });

  it("ceils KMW to 0.1 and keeps an exact tenth", () => {
    expect(fmtKmw(12.01)).toBe("12.1");
    expect(fmtKmw(12)).toBe("12.0");
    expect(fmtKmw(12.1)).toBe("12.1");
  });

  it("formats EMW to 0.01, psi to a whole number, and bbl to 0.1", () => {
    expect(fmtEmw(12.345)).toBe("12.35");
    expect(fmtEmw(12.34)).toBe("12.34");
    expect(fmtPsi(325)).toBe("325");
    expect(fmtPsi(325.4)).toBe("325");
    expect(fmtPsi(12345.6)).toBe("12,346");
    expect(fmtBbl(1.04)).toBe("1.0");
    expect(fmtBbl(1.25)).toBe("1.3");
    expect(fmtBbl(10)).toBe("10.0");
  });

  it("uses an em dash for null, undefined, and non-finite values", () => {
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(fmtDepth(value)).toBe(EM_DASH);
      expect(fmtEmw(value)).toBe(EM_DASH);
      expect(fmtKmw(value)).toBe(EM_DASH);
      expect(fmtPsi(value)).toBe(EM_DASH);
      expect(fmtBbl(value)).toBe(EM_DASH);
      expect(fmtDepthRange(value, 10)).toBe(EM_DASH);
      expect(fmtDepthRange(10, value)).toBe(EM_DASH);
    }
    const shown = [fmtDepth(Number.NaN), fmtEmw(undefined), fmtKmw(null), fmtPsi(Number.NaN), fmtBbl(undefined)];
    expect(shown.join(" ")).not.toContain("NaN");
  });

  it("leaves engine output deep-equal to the result from before formatting", () => {
    const before = calculate(exampleB);
    expect(isCalcRefusal(before)).toBe(false);
    if (isCalcRefusal(before)) return;
    const snapshot = structuredClone(before);
    fmtDepth(before.depths.shoe.md_ft);
    fmtDepth(before.depths.anchor.tvd_ft);
    fmtDepthRange(before.displacement.pillTopMd_ft, before.displacement.pillBottomMd_ft);
    fmtEmw(before.depths.shoe.esd_ppg);
    fmtEmw(before.depths.anchor.ecd_ppg);
    fmtKmw(12.01);
    fmtPsi(before.displacement.stages[0]?.sbp_psi);
    fmtBbl(before.displacement.pillVolume_bbl);
    expect(before).toEqual(snapshot);
    expect(calculate(exampleB)).toEqual(snapshot);
  });
});
