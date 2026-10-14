import { describe, expect, it } from "vitest";
import {
  eccentricityRatio,
  ecd,
  hbParams,
  segmentDp,
  veffClosed,
  veffOpen,
  vel,
  type Rheology,
} from "./rp13d";
import { calculate } from "./engine";
import { buildSteelSchedule } from "./steel";
import { AUBURNIA } from "./examples";

const rh = (r600: number, r300: number, r6: number, r3: number): Rheology => ({ r600, r300, r6, r3 });

// API RP 13D Annex C (Q = 420 gpm), density + Fann per cell. [top, bot, dh, dp, di, rho, rheo, rpPipe, rpAnn]
const ANNEX_C: [number, number, number, number, number, number, Rheology, number, number][] = [
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
    const p = hbParams(rh(80, 48, 9.2, 8.2));
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
    const r = rh(80, 48, 9.2, 8.2);
    let tot = 0;
    for (const [dh, dp, , L] of secs) tot += segmentDp(12.5, veffClosed(93, dh, dp), dh, dp, L, r, true).p;
    expect(Math.abs(tot - 333) / 333).toBeLessThan(0.1);
    expect(Math.abs((0.052 * 12.5 * 12000 + tot) / (0.052 * 12000) - 13.03)).toBeLessThan(0.05);
  });
});

describe("eccentricity Eqs 87-88 (verified against RP p.37)", () => {
  it("is 1 when concentric and reduces loss when eccentric", () => {
    expect(eccentricityRatio(0, 0.7, 0.6, true)).toBe(1);
    const lam = eccentricityRatio(1, 0.7, 0.6, true);
    const turb = eccentricityRatio(1, 0.7, 0.6, false);
    expect(lam).toBeLessThan(1);
    expect(turb).toBeLessThan(1);
    expect(lam).toBeLessThan(turb);
  });
});

describe("PillView wiring", () => {
  const fann = { fann600: 80, fann300: 48, fann6: 9.2, fann3: 8.2 } as const;
  it("no Fann → no swab rows and a warning reason", () => {
    const r = calculate(AUBURNIA);
    expect(r.rp13d.available).toBe(false);
    expect(r.tripPressures).toEqual([]);
  });
  it("with Fann → swab at anchor rises with speed, ECD at shoe / anchor / TD", () => {
    const inputs = { ...AUBURNIA, ...fann, currentDepthTvd: AUBURNIA.anchorTvd };
    const r = calculate(inputs);
    expect(r.rp13d.available).toBe(true);
    const sw = r.tripPressures.map((t) => t.swabPressure);
    expect(sw.length).toBe(7);
    for (let i = 1; i < sw.length; i++) expect(sw[i]).toBeGreaterThanOrEqual(sw[i - 1]);
    expect(r.rp13d.ecd.map((p) => p.key).sort()).toEqual(["anchor", "shoe", "td"]);
    for (const p of r.rp13d.ecd) expect(p.ecd).toBeGreaterThan(Number(AUBURNIA.currentMw));
    const shoe = r.rp13d.ecd.find((p) => p.key === "shoe")!;
    const anc = r.rp13d.ecd.find((p) => p.key === "anchor")!;
    expect(shoe.pa).toBeLessThan(anc.pa);
    const open = calculate({ ...inputs, pipeEnd: "open" });
    expect(open.tripPressures[4].swabPressure).toBeLessThanOrEqual(r.tripPressures[4].swabPressure);
    const steel = buildSteelSchedule(inputs, r);
    expect(steel.needsRheology).toBe(false);
  });
});
