import { describe, expect, it } from "vitest";
import { calculate, esdCasingWithDp, esdTargetWithDp, pillHeightWithDp } from "./engine";
import { EMPTY_INPUTS } from "./examples";
import type { WellInputs } from "./types";
import { round } from "../utils";

/** EXCO Lock Sub 1H — Stasis pill sheet inputs (12.25 in intermediate, shoe 3199 MD / 3187 TVD). */
const LOCK_SUB_1H: WellInputs = {
  ...EMPTY_INPUTS,
  wellName: "Lock Sub 1H",
  client: "EXCO",
  date: "2026-10-05",
  sectionType: "Intermediate",
  pillMode: "noSlug",
  currentDepthMd: 10530,
  anchorMd: 10480,
  anchorTvd: 10466,
  casingMd: 3199,
  casingTvd: 3187,
  spotMd: 10480,
  spotTvd: 10466,
  openHoleDia: 12.25,
  odDp: 5.5,
  idDp: 4.778,
  idCasing: 12.515,
  currentMw: 11.4,
  kmw: 14,
  desiredEmw: 12,
  sbpConnection: 325,
  fit: 12.6,
  maxFlowRate: 300,
  initialFlowRate: 300,
  safevisionNoSlug: 11.5,
  pumpDisp: 0.0914,
  desiredResolution: 30,
  overbalanceSlug: 300,
  taperedOn: false,
  odDp1: 5.5,
  idDp1: 4.778,
};

describe("shoe ESD — Lock Sub 1H (pill top far below the shoe)", () => {
  const r = calculate(LOCK_SUB_1H);

  it("keeps pill sizing and MASP", () => {
    expect(r.heightPillNoDp).toBe(2420);
    expect(round(r.masp, 0)).toBe(199);
    expect(r.totalPillVol).toBe(353);
    expect(r.correctedPillVol).toBe(282);
    expect(round(r.minHeightPillWithDp, 0)).toBe(2547);
    expect(round(pillHeightWithDp(r), 0)).toBe(2446);
  });

  it("shoe ESD is current MW with and without DP, never below it", () => {
    // Pill top 10466 - 2420 = 8046 TVD, ~4860 ft below the 3187 TVD shoe.
    expect(r.esdCasingNoDp).toBe(11.4);
    expect(r.balancedEsdCasing).toBe(11.4);
    expect(esdCasingWithDp(r)).toBe(11.4);
    expect(r.addPpgCsg).toBe(0);
  });

  it("anchor still gets the equalize extra", () => {
    expect(round(esdTargetWithDp(r, 12), 3)).toBe(12.006);
    expect(r.addPpgTarget).toBeGreaterThan(0);
  });
});

describe("shoe ESD — pill reaches into casing (hand calc)", () => {
  // Same well, shoe moved to 9000 MD / 8990 TVD.
  const w: WellInputs = { ...LOCK_SUB_1H, wellName: "Deep shoe", casingMd: 9000, casingTvd: 8990 };
  const r = calculate(w);

  it("no DP: 11.4 + (2420 - 10466 + 8990) x 2.6 / 8990", () => {
    // 944 ft of KMW above the shoe -> 11.4 + 944 * 2.6 / 8990 = 11.6730
    expect(r.heightPillNoDp).toBe(2420);
    expect(r.esdCasingNoDp).toBeCloseTo(11.4 + (944 * 2.6) / 8990, 9);
    expect(round(r.esdCasingNoDp, 4)).toBe(11.673);
  });

  it("with DP: full equalize extra lands above the shoe (unchanged formula)", () => {
    // Independent bisection of the float U-tube: dump 3.155 bbl, annular height 2445.70 ft.
    expect(round(r.equalizeDumpBbl, 3)).toBe(3.155);
    expect(round(r.minHeightWithDp, 2)).toBe(2445.7);
    expect(r.balancedEsdCasing).toBe(r.esdCasingNoDp + r.balancedAdditionalPsi / (0.052 * 8990));
    const above = r.minHeightWithDp - (10466 - 8990);
    expect(r.balancedEsdCasing).toBeCloseTo(11.4 + (above * 2.6) / 8990, 9);
    expect(round(esdCasingWithDp(r), 4)).toBe(11.6804);
  });
});

describe("shoe ESD — only the equalized pill crosses the shoe", () => {
  // Shoe at 8033 TVD: 10466 - 8033 = 2433 ft, between 2420 (no DP) and ~2446 (with DP).
  const r = calculate({ ...LOCK_SUB_1H, wellName: "Crossing shoe", casingMd: 8045, casingTvd: 8033 });

  it("no DP stays at MW, with DP counts only the part above the shoe", () => {
    expect(r.esdCasingNoDp).toBe(11.4);
    const above = r.minHeightWithDp - 2433;
    expect(above).toBeGreaterThan(0);
    expect(above).toBeLessThan(r.minHeightWithDp - r.heightPillNoDp);
    expect(r.balancedEsdCasing).toBeCloseTo(11.4 + (above * 2.6) / 8033, 9);
    expect(r.balancedEsdCasing).toBeLessThan(11.4 + r.balancedAdditionalPsi / (0.052 * 8033));
  });
});
