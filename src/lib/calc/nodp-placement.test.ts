import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { EMPTY_INPUTS } from "./examples";
import { bbl, bblPerFt, columnTopFt, ft, placedAnnulusBbl } from "./nodp-placement";
import type { WellInputs } from "./types";

/** Anonymized well whose string cannot hold the inside share of the pill. */
const NEGATIVE_CHASE: WellInputs = {
  ...EMPTY_INPUTS,
  wellName: "EXAMPLE",
  client: "",
  date: "",
  producedBy: "",
  sectionType: "Production",
  pillMode: "noSlug",
  currentDepthMd: 21750,
  tdDepth: 21750,
  anchorMd: 12000,
  anchorTvd: 11226,
  casingMd: 9919,
  casingTvd: 10378,
  spotMd: 6000,
  spotTvd: 6000,
  openHoleDia: 6.75,
  odDp: 4.5,
  idDp: 3.826,
  idCasing: 6.875,
  currentMw: 15.3,
  kmw: 18.5,
  desiredEmw: 16.7,
  pumpDisp: 0.0692,
  taperedOn: false,
};

describe("placedAnnulusBbl", () => {
  it("adds the excess to the annulus when chase is negative", () => {
    const share = bbl(129.12072566543617);
    const chase = bbl(-11.558061977851182);
    expect(placedAnnulusBbl(share, chase)).toBe(141);
    expect(placedAnnulusBbl(share, bbl(0))).toBe(129);
  });

  it("leaves a positive chase on the rounded annulus share", () => {
    expect(placedAnnulusBbl(bbl(228.186), bbl(152.72))).toBe(228);
    expect(placedAnnulusBbl(bbl(96.4), bbl(10))).toBe(96);
  });
});

describe("negative chase well", () => {
  const r = calculate(NEGATIVE_CHASE);

  it("places the overflow in the annulus", () => {
    expect(r.calculatedChase).toBeLessThan(0);
    expect(r.correctedChase).toBe(0);
    expect(r.totalPillVol).toBe(226);
    expect(r.finalKwm).toBe(85);
    expect(r.correctedPillVol).toBe(141);
    expect(r.finalKwm + r.correctedPillVol).toBe(r.totalPillVol);
    expect(r.correctedPillVol).toBe(placedAnnulusBbl(bbl(r.requiredVolAnnulus), bbl(r.calculatedChase)));
  });

  it("puts the annulus top near 627 ft and the inside top near 23 ft", () => {
    const annulusTop = columnTopFt(ft(6000), bbl(r.correctedPillVol), bblPerFt(r.annularCap));
    expect(annulusTop).toBeCloseTo(627, 0);
    expect(r.topOfPillInsideDp).toBeCloseTo(23, 0);
  });
});
