import { describe, expect, it } from "vitest";
import {
  annulusSections,
  calcRp13d,
  eccentricityRatio,
  ecd,
  hbParams,
  segmentDp,
  veffClosed,
  veffOpen,
  vel,
  type HbParams,
  type Rheology,
  type Rp13dInputs,
} from "./engine";

/** Eqs 23–25. Reference for the RP worked example only. Production uses `hbParams`. */
function hbParamsFourPoint(r600: number, r300: number, r6: number, r3: number): HbParams {
  const ty = Math.max(0, 2 * r3 - r6);
  const n = 3.32 * Math.log10((r600 - ty) / (r300 - ty));
  const k = (r300 - ty) / Math.pow(511, n);
  const np = 3.32 * Math.log10(r600 / r300);
  return { ty, n, k, np };
}

const rh = (r600: number, r300: number, r6: number, r3: number) => hbParamsFourPoint(r600, r300, r6, r3);

// API RP 13D Annex C (Q = 420 gpm), density + Fann per cell. [top, bot, dh, dp, di, rho, rheo, rpPipe, rpAnn]
const ANNEX_C: [number, number, number, number, number, number, ReturnType<typeof rh>, number, number][] = [
  [0, 3000, 19.0, 5, 4.276, 12.51, rh(80, 48, 9.2, 8.2), 214, 8],
  [3000, 4298, 8.535, 5, 4.276, 12.55, rh(102, 63, 10, 9), 97, 44],
  [4298, 11690, 8.535, 5, 4.276, 12.53, rh(105, 65, 11, 10), 553, 260],
  [11690, 19690, 8.535, 5, 4.276, 12.55, rh(117, 70, 12, 11), 633, 292],
  [19690, 21490, 8.5, 5, 4.276, 12.54, rh(119, 74, 13, 12), 139, 75],
  [21490, 21690, 8.5, 6.75, 3.0, 12.54, rh(124, 79, 14, 13), 73, 37],
];

describe("API RP 13D Annex C — 420 gpm", () => {
  let pipe = 0;
  let ann = 0;
  for (const [t, b, dh, dp, di, rho, r, rpPipe, rpAnn] of ANNEX_C) {
    const L = b - t;
    const pd = segmentDp(rho, vel(420, di), di, 0, L, r, false).p;
    const pa = segmentDp(rho, vel(420, dh, dp), dh, dp, L, r, true).p;
    pipe += pd;
    ann += pa;
    it(`${t}-${b} ft pipe ${Math.round(pd)} vs RP ${rpPipe}, annulus ${Math.round(pa)} vs RP ${rpAnn} (±1 psi)`, () => {
      expect(Math.abs(Math.round(pd) - rpPipe)).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.round(pa) - rpAnn)).toBeLessThanOrEqual(1);
    });
  }
  it("totals within 1 psi of RP (1708 / 716) and ECD 13.60 ppg at 13,000 ft TVD", () => {
    expect(Math.abs(Math.round(pipe) - 1708)).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.round(ann) - 716)).toBeLessThanOrEqual(1);
    expect(ecd(8477 / (0.052 * 13000), ann, 13000).toFixed(2)).toBe("13.60");
  });
  it("HB fit from surface Fann (Eqs 23-25)", () => {
    const p = hbParamsFourPoint(80, 48, 9.2, 8.2);
    expect(p.ty).toBeCloseTo(7.2, 6);
    expect(p.n).toBeCloseTo(0.8349, 3);
  });
});

describe("API RP 13D Annex D — closed string, 93 ft/min, rho 12.5", () => {
  const secs: [number, number, number, number, number, number][] = [
    // dh, dp, di, L, rp Veff (closed), rp Veff open-final
    [19.0, 5.0, 4.276, 3000, 48.8, 44.0],
    [8.535, 5.0, 4.276, 16500, 90.5, 56.7],
    [8.535, 6.75, 3.0, 200, 197.4, 138.1],
  ];
  it("closed-pipe Veff (Eq 100) matches RP within 0.3 ft/min", () => {
    for (const [dh, dp, , , rpV] of secs) expect(Math.abs(veffClosed(93, dh, dp) - rpV)).toBeLessThan(0.3);
  });
  it("open-pipe simplified Veff (Eq 101) is within 6 ft/min of RP iterated split", () => {
    for (const [dh, dp, di, , , rpOpen] of secs) expect(Math.abs(veffOpen(93, dh, dp, di) - rpOpen)).toBeLessThan(6);
  });
  it("surge with surface rheology within 10% of RP 333 psi, EMW within 0.05 of 13.03", () => {
    const r = hbParamsFourPoint(80, 48, 9.2, 8.2);
    let tot = 0;
    for (const [dh, dp, , L] of secs) tot += segmentDp(12.5, veffClosed(93, dh, dp), dh, dp, L, r, true).p;
    expect(Math.abs(tot - 333) / 333).toBeLessThan(0.1);
    expect(Math.abs((0.052 * 12.5 * 12000 + tot) / (0.052 * 12000) - 13.03)).toBeLessThan(0.05);
  });
});

describe("eccentricity Eqs 87-88", () => {
  it("is 1 when concentric and reduces loss when eccentric", () => {
    expect(eccentricityRatio(0, 0.7, 0.6, true)).toBe(1);
    const lam = eccentricityRatio(1, 0.7, 0.6, true);
    const turb = eccentricityRatio(1, 0.7, 0.6, false);
    expect(lam).toBeLessThan(1);
    expect(turb).toBeLessThan(1);
    expect(lam).toBeLessThan(turb);
  });
});

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

describe("well ECD", () => {
  it("defaults to a closed pipe and reports the anchor, shoe, and bit", () => {
    const result = calcRp13d(WELL);
    expect(result.available).toBe(true);
    expect(result.pipeEnd).toBe("closed");
    expect(result.ecd.map((point) => point.depth)).toEqual(["anchor", "shoe", "bit"]);
    for (const point of result.ecd) expect(point.ecd).toBeGreaterThan(WELL.mw);
    const shoe = result.ecd.find((point) => point.depth === "shoe")!;
    const anchor = result.ecd.find((point) => point.depth === "anchor")!;
    const bit = result.ecd.find((point) => point.depth === "bit")!;
    expect(shoe.pa).toBeLessThan(anchor.pa);
    expect(anchor.pa).toBeLessThan(bit.pa);
    expect(annulusSections(WELL, WELL.bitMd)).toHaveLength(2);
  });

  it("needs all six Fann readings", () => {
    const result = calcRp13d({ ...WELL, fann200: Number.NaN });
    expect(result.available).toBe(false);
    expect(result.ecd).toEqual([]);
    expect(result.reason).toMatch(/six Fann/);
  });

  it("refuses Fann readings that are not 600 ≥ 300 ≥ 200 ≥ 100 ≥ 6 ≥ 3", () => {
    const result = calcRp13d({ ...WELL, fann200: 50 });
    expect(result.available).toBe(false);
    expect(result.ecd).toEqual([]);
    expect(result.reason).toMatch(/600 ≥ 300 ≥ 200 ≥ 100 ≥ 6 ≥ 3/);
  });

  it("fits n and K through all six readings, with the same yield as the 6-and-3-rpm point", () => {
    const readings: Rheology = {
      r600: WELL.fann600,
      r300: WELL.fann300,
      r200: WELL.fann200,
      r100: WELL.fann100,
      r6: WELL.fann6,
      r3: WELL.fann3,
    };
    const six = hbParams(readings);
    const four = hbParamsFourPoint(readings.r600, readings.r300, readings.r6, readings.r3);
    expect(six.ty).toBeCloseTo(four.ty, 6);
    expect(six.ty).toBeCloseTo(7.2, 6);
    expect(six.n).not.toBeCloseTo(four.n, 4);
    expect(six.k).not.toBeCloseTo(four.k, 4);
    const moved = hbParams({ ...readings, r200: readings.r200 + 4, r100: readings.r100 + 2 });
    expect(moved.n).not.toBeCloseTo(six.n, 6);
    expect(moved.k).not.toBeCloseTo(six.k, 6);
    expect(moved.ty).toBeCloseTo(six.ty, 6);
  });

  it("open pipe swabs no higher than the closed pipe", () => {
    const closed = calcRp13d(WELL);
    const open = calcRp13d({ ...WELL, pipeEnd: "open" });
    expect(open.pipeEnd).toBe("open");
    const at = (rows: typeof closed.trips, depth: "anchor") =>
      rows[4].points.find((point) => point.depth === depth)!.swabPsi;
    expect(at(open.trips, "anchor")).toBeLessThanOrEqual(at(closed.trips, "anchor"));
  });
});
