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
  it("puts the RP 13D ECD next to the sheet ECD and the difference", () => {
    const rp = calcRp13d(WELL);
    const sheet = { anchor: 12.8, shoe: 12.6, bit: 13.1 };
    const rows = compareEcd(rp.ecd, sheet);
    expect(rows.map((row) => row.depth)).toEqual(["anchor", "shoe", "bit"]);
    for (const row of rows) {
      const point = rp.ecd.find((item) => item.depth === row.depth)!;
      expect(row.rp13dEcd).toBe(point.ecd);
      expect(row.sheetEcd).toBe(sheet[row.depth]);
      expect(row.difference).toBeCloseTo(point.ecd - sheet[row.depth], 9);
      expect(row.sheetBasis).toBe("esd");
    }
  });

  it("uses current MW plus anchor APL over 0.052 TVD at the anchor and shoe", () => {
    const currentMw = 12.4;
    const anchorTvd = 11250;
    const shoeTvd = 10125;
    const initialAplAnchor = (12.85 - currentMw) * 0.052 * anchorTvd;
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
    expect(rows[1].sheetBasis).toBe("ecd");
    expect(rows[1].sheetEcd).toBeCloseTo(currentMw + initialAplAnchor / (0.052 * shoeTvd), 9);
    expect(rows[2].sheetBasis).toBe("esd");
    expect(rows[2].sheetEcd).toBe(11.4);
    expect(rows[2].difference).toBeCloseTo(13.2 - 11.4, 9);
  });

  it("reports EXAMPLE sheet ECD at the anchor and shoe, and ESD only where that cannot be computed", () => {
    const results = calculate(EXAMPLE_8_5);
    const rows = compareEcd([], {
      currentMw: asNum(EXAMPLE_8_5.currentMw),
      initialAplAnchor: results.initialAplAnchor,
      anchorTvd: asNum(EXAMPLE_8_5.anchorTvd),
      shoeTvd: asNum(EXAMPLE_8_5.casingTvd),
      anchor: results.anchorPointEsd,
      shoe: results.esdCasingNoDp,
    });
    expect(rows.map((row) => row.depth)).toEqual(["anchor", "shoe", "bit"]);
    expect(rows[0].sheetBasis).toBe("ecd");
    expect(rows[0].sheetEcd).toBeCloseTo(12.85, 9);
    expect(rows[0].rp13dEcd).toBeNull();
    expect(rows[1].sheetBasis).toBe("ecd");
    expect(rows[1].sheetEcd).toBeCloseTo(12.9, 9);
    expect(rows[2]).toMatchObject({ sheetBasis: "esd", sheetEcd: null, rp13dEcd: null, difference: null });
    expect(results.anchorPointEsd).not.toBe(rows[0].sheetEcd);
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
