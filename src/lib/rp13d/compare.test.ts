import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc/engine";
import { EXAMPLE_8_5 } from "@/lib/calc/examples";
import { asNum } from "@/lib/utils";
import { compareEcd } from "./compare";
import { calcRp13d, type Rp13dInputs } from "./engine";

const WELL: Rp13dInputs = {
  fann600: 80,
  fann300: 48,
  fann200: 36,
  fann100: 28,
  fann6: 9.2,
  fann3: 8.2,
  mw: 12.5,
  flowGpm: 300,
  pipeOd: 5,
  pipeId: 4.276,
  casingId: 8.535,
  casingMd: 10000,
  casingTvd: 9800,
  openHoleDia: 8.5,
  anchorMd: 12000,
  anchorTvd: 11000,
  bitMd: 14000,
  bitTvd: 12000,
};

describe("compareEcd", () => {
  it("puts the RP 13D ECD next to the sheet value and the difference", () => {
    const rp = calcRp13d(WELL);
    const sheet = { anchor: 12.8, shoe: 12.6, bit: 13.1 };
    const rows = compareEcd(rp.ecd, sheet);
    expect(rows.map((row) => row.depth)).toEqual(["anchor", "shoe", "bit"]);
    for (const row of rows) {
      const point = rp.ecd.find((item) => item.depth === row.depth)!;
      expect(row.rp13dEcd).toBe(point.ecd);
      if (row.depth === "bit") {
        expect(row.sheetEcd).toBeNull();
        expect(row.difference).toBeNull();
      } else {
        expect(row.sheetEcd).toBe(sheet[row.depth]);
        expect(row.difference).toBeCloseTo(point.ecd - sheet[row.depth]!, 9);
      }
      expect(row.sheetBasis).toBe("esd");
    }
  });

  it("uses anchor APL at the anchor and does not scale it to the shoe", () => {
    const currentMw = 12.4;
    const anchorTvd = 11250;
    const shoeTvd = 10125;
    const initialAplAnchor = (12.85 - currentMw) * 0.052 * anchorTvd;
    const scaled = currentMw + initialAplAnchor / (0.052 * shoeTvd);
    const rows = compareEcd([{ depth: "anchor", ecd: 13 }, { depth: "shoe", ecd: 13.1 }, { depth: "bit", ecd: 13.2 }], {
      currentMw,
      initialAplAnchor,
      anchorTvd,
      shoeTvd,
      anchor: 11,
      shoe: 11.2,
      bit: 11.4,
    });
    expect(rows[0].sheetBasis).toBe("ecd");
    expect(rows[0].sheetEcd).toBeCloseTo(currentMw + initialAplAnchor / (0.052 * anchorTvd), 9);
    expect(rows[0].difference).toBeCloseTo(13 - rows[0].sheetEcd!, 9);
    expect(rows[1].sheetBasis).toBe("esd");
    expect(rows[1].sheetEcd).toBe(11.2);
    expect(rows[1].sheetEcd).not.toBeCloseTo(scaled, 2);
    expect(rows[2]).toMatchObject({ sheetBasis: "esd", sheetEcd: null, difference: null });
  });

  it("uses friction from surface to the shoe when that psi is supplied", () => {
    const currentMw = 12.4;
    const shoeTvd = 10125;
    const shoeFrictionPsi = 180;
    const anchorApl = 263.25;
    const rows = compareEcd([], {
      currentMw,
      initialAplAnchor: anchorApl,
      anchorTvd: 11250,
      shoeFrictionPsi,
      shoeTvd,
      shoe: 11.2,
    });
    expect(rows[1].sheetBasis).toBe("ecd");
    expect(rows[1].sheetEcd).toBeCloseTo(currentMw + shoeFrictionPsi / (0.052 * shoeTvd), 9);
    expect(rows[1].sheetEcd).not.toBeCloseTo(currentMw + anchorApl / (0.052 * shoeTvd), 2);
  });

  it("EXAMPLE 8.5 anchor is RP 13D ECD minus the SafeVision sheet ECD", () => {
    const results = calculate(EXAMPLE_8_5);
    // The 1.0.7.1 sheet has no Fann readings. These are the synthetic EXAMPLE
    // dials, not adjusted to land on a difference.
    const rp = calcRp13d({
      fann600: 80,
      fann300: 48,
      fann200: 36,
      fann100: 24,
      fann6: 9.2,
      fann3: 8.2,
      mw: asNum(EXAMPLE_8_5.currentMw),
      flowGpm: asNum(EXAMPLE_8_5.initialFlowRate),
      pipeOd: asNum(EXAMPLE_8_5.odDp),
      pipeId: asNum(EXAMPLE_8_5.idDp),
      casingId: asNum(EXAMPLE_8_5.idCasing),
      casingMd: asNum(EXAMPLE_8_5.casingMd),
      casingTvd: asNum(EXAMPLE_8_5.casingTvd),
      openHoleDia: asNum(EXAMPLE_8_5.openHoleDia),
      anchorMd: asNum(EXAMPLE_8_5.anchorMd),
      anchorTvd: asNum(EXAMPLE_8_5.anchorTvd),
      bitMd: asNum(EXAMPLE_8_5.currentDepthMd),
      bitTvd: asNum(EXAMPLE_8_5.anchorTvd),
    });
    const rows = compareEcd(rp.ecd, {
      currentMw: asNum(EXAMPLE_8_5.currentMw),
      initialAplAnchor: results.initialAplAnchor,
      anchorTvd: asNum(EXAMPLE_8_5.anchorTvd),
      shoeTvd: asNum(EXAMPLE_8_5.casingTvd),
      shoe: results.esdCasingNoDp,
    });
    expect(rows[0].sheetBasis).toBe("ecd");
    expect(rows[0].sheetEcd).toBeCloseTo(12.85, 9);
    expect(rows[0].difference).toBeCloseTo(-0.035934759224972, 8);
    expect(rows[1].sheetBasis).toBe("esd");
    expect(rows[1].sheetEcd).toBe(results.esdCasingNoDp);
    expect(rows[2]).toMatchObject({ sheetEcd: null, sheetBasis: "esd", difference: null });
  });

  it("leaves the difference empty when the sheet has no ECD at that depth", () => {
    const rows = compareEcd([], { shoe: 12.4 });
    expect(rows).toEqual([
      { depth: "anchor", label: "Anchor", rp13dEcd: null, sheetEcd: null, difference: null, sheetBasis: "esd" },
      { depth: "shoe", label: "Shoe", rp13dEcd: null, sheetEcd: 12.4, difference: null, sheetBasis: "esd" },
      { depth: "bit", label: "Bit", rp13dEcd: null, sheetEcd: null, difference: null, sheetBasis: "esd" },
    ]);
  });
});
