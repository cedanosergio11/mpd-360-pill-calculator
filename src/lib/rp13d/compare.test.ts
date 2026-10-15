import { describe, expect, it } from "vitest";
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
    }
  });

  it("leaves the difference empty when the sheet has no ECD at that depth", () => {
    const rows = compareEcd([], { shoe: 12.4 });
    expect(rows).toEqual([
      { depth: "anchor", label: "Anchor", rp13dEcd: null, sheetEcd: null, difference: null },
      { depth: "shoe", label: "Shoe", rp13dEcd: null, sheetEcd: 12.4, difference: null },
      { depth: "bit", label: "Bit", rp13dEcd: null, sheetEcd: null, difference: null },
    ]);
  });
});
