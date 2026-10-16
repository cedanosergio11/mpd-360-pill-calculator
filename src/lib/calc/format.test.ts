import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { EXAMPLE_8_5 } from "./examples";
import {
  fmtBbl,
  fmtBblPerStk,
  fmtBblPerStand,
  fmtDepth,
  fmtDepthRange,
  fmtEmw,
  fmtIn,
  fmtKmw,
  fmtMin,
  fmtPsi,
  fmtStrokes,
  fmtTimeCT,
} from "./format";

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
    expect(fmtStrokes(-0)).toBe("0 stk");
    expect(fmtMin(-0)).toBe("0.0 min");
    expect(fmtBblPerStk(-0)).toBe("0.0000 bbl/stk");
    expect(fmtIn(-0)).toBe("0.000 in");
    expect(fmtBblPerStand(-0)).toBe("0.00");
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

  it("formats strokes, minutes, pump output, inches, and barrels per stand", () => {
    expect(fmtStrokes(12345)).toBe("12,345 stk");
    expect(fmtStrokes(12345.6)).toBe("12,346 stk");
    expect(fmtStrokes(10.4)).toBe("10 stk");
    expect(fmtMin(1.04)).toBe("1.0 min");
    expect(fmtMin(1.25)).toBe("1.3 min");
    expect(fmtMin(12)).toBe("12.0 min");
    expect(fmtBblPerStk(0.012345)).toBe("0.0123 bbl/stk");
    expect(fmtBblPerStk(1.23456)).toBe("1.2346 bbl/stk");
    expect(fmtBblPerStk(0.1176)).toBe("0.1176 bbl/stk");
    expect(fmtIn(4.276)).toBe("4.276 in");
    expect(fmtIn(5.5)).toBe("5.500 in");
    expect(fmtIn(8.8354)).toBe("8.835 in");
    expect(fmtBblPerStand(1.234)).toBe("1.23");
    expect(fmtBblPerStand(1.235)).toBe("1.24");
    expect(fmtBblPerStand(10)).toBe("10.00");
  });

  it("formats a Chicago clock with a fixed en-US locale", () => {
    expect(fmtTimeCT("2026-10-15T22:45:00.000Z")).toBe("Oct 15, 2026 5:45 PM CT");
    expect(fmtTimeCT("2026-10-15T17:45:00-05:00")).toBe("Oct 15, 2026 5:45 PM CT");
    expect(fmtTimeCT("2026-01-15T23:45:00.000Z")).toBe("Jan 15, 2026 5:45 PM CT");
    expect(fmtTimeCT("2026-10-16T05:00:00.000Z")).toBe("Oct 16, 2026 12:00 AM CT");
    expect(fmtTimeCT("2026-10-15T17:00:00.000Z")).toBe("Oct 15, 2026 12:00 PM CT");
    expect(fmtTimeCT(null)).toBe(EM_DASH);
    expect(fmtTimeCT(undefined)).toBe(EM_DASH);
    expect(fmtTimeCT("")).toBe(EM_DASH);
    expect(fmtTimeCT("   ")).toBe(EM_DASH);
    expect(fmtTimeCT("not-a-date")).toBe(EM_DASH);
  });

  it("uses an em dash for null and non-finite values", () => {
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(fmtDepth(value)).toBe(EM_DASH);
      expect(fmtEmw(value)).toBe(EM_DASH);
      expect(fmtKmw(value)).toBe(EM_DASH);
      expect(fmtPsi(value)).toBe(EM_DASH);
      expect(fmtBbl(value)).toBe(EM_DASH);
      expect(fmtStrokes(value)).toBe(EM_DASH);
      expect(fmtMin(value)).toBe(EM_DASH);
      expect(fmtBblPerStk(value)).toBe(EM_DASH);
      expect(fmtIn(value)).toBe(EM_DASH);
      expect(fmtBblPerStand(value)).toBe(EM_DASH);
      expect(fmtDepthRange(value, 10)).toBe(EM_DASH);
      expect(fmtDepthRange(10, value)).toBe(EM_DASH);
    }
  });

  it("leaves engine output deep-equal to the result from before formatting", () => {
    const before = calculate(EXAMPLE_8_5);
    const snapshot = structuredClone(before);
    fmtDepth(before.topOfPillNoDp);
    fmtDepthRange(before.topOfPillNoDp, EXAMPLE_8_5.spotMd as number);
    fmtEmw(before.esdCasingNoDp);
    fmtKmw(before.anchorPointEsd);
    fmtPsi(before.masp);
    fmtBbl(before.totalPillVol);
    fmtStrokes(before.strokesToPumpSlug);
    fmtMin(1.25);
    fmtBblPerStk(EXAMPLE_8_5.pumpDisp as number);
    fmtIn(EXAMPLE_8_5.idDp as number);
    fmtBblPerStand(1.25);
    fmtTimeCT("2026-10-15T22:45:00.000Z");
    expect(before).toEqual(snapshot);
    expect(calculate(EXAMPLE_8_5)).toEqual(snapshot);
  });
});
