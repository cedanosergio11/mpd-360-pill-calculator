import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ecd,
  hbParams,
  segmentDp,
  veffClosed,
  veffOpen,
  vel,
  type Rheology,
} from "@/lib/calc/rp13d";
import { calculate } from "./calculate";
import { columnDisplacedByPipe } from "./column";
import { EXAMPLE_FANN, exampleJob } from "./example-job";
import { balanceFloat } from "./equalize";
import { auburniaJob } from "./fixtures/auburnia";
import { lockSubDryJob, lockSubSpotJob } from "./fixtures/lock-sub";
import type { SpeedEmw, TripEmw, TripPointKey } from "./index";
import type { FannReading, Job, PillMode } from "./job.schema";
import type { TripScheduleRow } from "./result";

const _exported: [TripPointKey, TripEmw, SpeedEmw] = [
  "bit",
  { surge_ppg: null, swab_ppg: null },
  { speed_ftmin: 40, emw_ppg: 12 },
];
void _exported;

const rh = (r600: number, r300: number, r6: number, r3: number): Rheology => ({
  r600,
  r300,
  r6,
  r3,
});

function fann(reading: Rheology): FannReading {
  return {
    r600: reading.r600,
    r300: reading.r300,
    r200: (reading.r600 + reading.r300) / 2,
    r100: reading.r300 / 2,
    r6: reading.r6,
    r3: reading.r3,
  };
}

// API RP 13D Annex C (Q = 420 gpm). [top, bot, dh, dp, di, rho, rheo, rpPipe, rpAnn]
const ANNEX_C: [number, number, number, number, number, number, Rheology, number, number][] = [
  [0, 3000, 19.0, 5, 4.276, 12.51, rh(80, 48, 9.2, 8.2), 214, 8],
  [3000, 4298, 8.535, 5, 4.276, 12.55, rh(102, 63, 10, 9), 97, 44],
  [4298, 11690, 8.535, 5, 4.276, 12.53, rh(105, 65, 11, 10), 553, 260],
  [11690, 19690, 8.535, 5, 4.276, 12.55, rh(117, 70, 12, 11), 633, 292],
  [19690, 21490, 8.5, 5, 4.276, 12.54, rh(119, 74, 13, 12), 139, 75],
  [21490, 21690, 8.5, 6.75, 3.0, 12.54, rh(124, 79, 14, 13), 73, 37],
];

describe("API RP 13D Annex C — wired through the core hydraulics", () => {
  let pipe = 0;
  let ann = 0;
  for (const [t, b, dh, dp, di, rho, reading, rpPipe, rpAnn] of ANNEX_C) {
    const length = b - t;
    const pipePsi = segmentDp(rho, vel(420, di), di, 0, length, reading, false).p;
    const annPsi = segmentDp(rho, vel(420, dh, dp), dh, dp, length, reading, true).p;
    pipe += pipePsi;
    ann += annPsi;
    it(`${t}-${b} ft pipe ${Math.round(pipePsi)} vs RP ${rpPipe}, annulus ${Math.round(annPsi)} vs RP ${rpAnn} (±1 psi)`, () => {
      expect(Math.abs(Math.round(pipePsi) - rpPipe)).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.round(annPsi) - rpAnn)).toBeLessThanOrEqual(1);
    });
  }

  it("totals within 1 psi of RP (1708 / 716) and ECD 13.60 ppg at 13,000 ft TVD", () => {
    expect(Math.abs(Math.round(pipe) - 1708)).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.round(ann) - 716)).toBeLessThanOrEqual(1);
    expect(ecd(8477 / (0.052 * 13000), ann, 13000).toFixed(2)).toBe("13.60");
  });

  it("HB fit from surface Fann (Eqs 23-25)", () => {
    const params = hbParams(rh(80, 48, 9.2, 8.2));
    expect(params.ty).toBeCloseTo(7.2, 6);
    expect(params.n).toBeCloseTo(0.8349, 3);
  });

  it("calculate() annular friction matches segmentDp on the uniform-OD annex (BHA OD is outside job v1)", () => {
    const uniform = ANNEX_C.slice(0, 5);
    const job: Job = {
      schemaVersion: 1,
      name: "EXAMPLE RP 13D Annex C uniform string",
      savedAt: "2026-01-01T00:00:00.000Z",
      mode: "noDP",
      well: {
        mdTd_ft: 21490,
        tvdTd_ft: 21490,
        bitMd_ft: 21490,
        shoeMd_ft: 19690,
        shoeTvd_ft: 19690,
        anchorMd_ft: 21000,
        anchorTvd_ft: 21000,
        fit_ppg: 40,
        targetEmw_ppg: 10,
        casing: [
          { topMd_ft: 0, bottomMd_ft: 3000, id_in: 19 },
          { topMd_ft: 3000, bottomMd_ft: 19690, id_in: 8.535 },
        ],
        openHoleId_in: 8.5,
        stringOd_in: 5,
        stringId_in: 4.276,
        survey: [3000, 4298, 11690, 19690, 21000, 21490].map((md) => ({ md_ft: md, tvd_ft: md })),
      },
      fluids: uniform.map((section, index) => ({
        id: `f${index}`,
        label: `EXAMPLE annex ${section[0]}-${section[1]}`,
        density_ppg: section[5],
        fann: fann(section[6]),
      })),
      column: uniform.map((section, index) => ({
        fluidId: `f${index}`,
        topMd_ft: section[0],
        bottomMd_ft: section[1],
      })),
      pipeColumn: [{ fluidId: "f0", topMd_ft: 0, bottomMd_ft: 21490 }],
      trip: {
        speeds_ftmin: [40],
        pipeEnd: "closed",
        clinging: 0.45,
        eccentricity: 0,
        sbpConn_psi: 0,
        sbpCirc_psi: 0,
        flow_gpm: 420,
      },
    };

    let expected = 0;
    for (const [top, bot, dh, dp, , rho, reading] of uniform) {
      expected += segmentDp(rho, vel(420, dh, dp), dh, dp, bot - top, reading, true).p;
    }
    const result = calculate(job);
    const td = result.depths.td;
    expect(td.esd_ppg).not.toBeNull();
    expect(td.ecd_ppg).not.toBeNull();
    const friction = (td.ecd_ppg! - td.esd_ppg!) * 0.052 * td.tvd_ft!;
    expect(friction).toBeCloseTo(expected, 3);
    expect(td.ecd_ppg!).toBeGreaterThan(td.esd_ppg!);
  });
});

describe("API RP 13D Annex D — effective velocity used by the core trip model", () => {
  const sections: [number, number, number, number, number, number][] = [
    [19.0, 5.0, 4.276, 3000, 48.8, 44.0],
    [8.535, 5.0, 4.276, 16500, 90.5, 56.7],
    [8.535, 6.75, 3.0, 200, 197.4, 138.1],
  ];

  it("closed-pipe Veff (Eq 100) matches RP within 0.3 ft/min", () => {
    for (const [dh, dp, , , rpV] of sections)
      expect(Math.abs(veffClosed(93, dh, dp) - rpV)).toBeLessThan(0.3);
  });

  it("open-pipe simplified Veff (Eq 101) is within 6 ft/min of RP iterated split", () => {
    for (const [dh, dp, di, , , rpOpen] of sections)
      expect(Math.abs(veffOpen(93, dh, dp, di) - rpOpen)).toBeLessThan(6);
  });

  it("surge with surface rheology within 10% of RP 333 psi, EMW within 0.05 of 13.03", () => {
    const reading = rh(80, 48, 9.2, 8.2);
    let total = 0;
    for (const [dh, dp, , length] of sections) {
      total += segmentDp(12.5, veffClosed(93, dh, dp), dh, dp, length, reading, true).p;
    }
    expect(Math.abs(total - 333) / 333).toBeLessThan(0.1);
    expect(Math.abs((0.052 * 12.5 * 12000 + total) / (0.052 * 12000) - 13.03)).toBeLessThan(0.05);
  });
});

describe("Lock Sub 1H shoe ESD — real shoe, pill never reaches it", () => {
  const noDp = calculate(lockSubDryJob("noDP"));
  const withDp = calculate(lockSubDryJob("withDP"));

  it("shoe ESD equals mud weight and never drops below it", () => {
    for (const result of [noDp, withDp]) {
      expect(result.depths.shoe.esd_ppg).toBeCloseTo(11.4, 4);
      expect(result.depths.shoe.esd_ppg!).toBeGreaterThanOrEqual(11.4 - 1e-6);
      expect(result.depths.shoe.fit_ppg).toBe(12.6);
      expect(result.depths.anchor.fit_ppg).toBeNull();
      expect(result.depths.shoe.pore_ppg).toBeNull();
      expect(result.depths.anchor.pore_ppg).toBeNull();
      for (const stage of result.displacement.stages) {
        expect(stage.shoeEsd_ppg).toBeCloseTo(11.4, 4);
        expect(stage.shoeEsd_ppg!).toBeGreaterThanOrEqual(11.4 - 1e-6);
        expect(stage.pumped_bbl).not.toBeNull();
        expect(stage.pumped_bbl!).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("withDP adds no equalized pill pressure when the pill never reaches the shoe", () => {
    expect(withDp.depths.shoe.esd_ppg).toBeCloseTo(noDp.depths.shoe.esd_ppg!, 6);
    expect(withDp.issues.some((item) => item.code === "EQUALIZE_PENDING")).toBe(false);
    expect(noDp.issues.some((item) => item.code === "EQUALIZE_PENDING")).toBe(false);
    expect(withDp.displacement.stages.length).toBeGreaterThan(0);
    expect(withDp.displacement.minStagesRih).toBe(withDp.displacement.stages.length);
    const linked = withDp.tripSchedule.filter((row) => row.stage != null);
    expect(linked.length).toBeGreaterThan(0);
    expect(linked.every((row) => row.direction === "RIH")).toBe(true);
  });

  it("keeps the pipe-out pill volume of the 2420 ft open-hole column", () => {
    const expected = (2420 * 12.25 ** 2) / 1029.4;
    expect(noDp.displacement.pillVolume_bbl).toBeCloseTo(expected, 3);
    expect(noDp.displacement.pillTopMd_ft).toBe(8060);
    expect(noDp.displacement.slugVolume_bbl).toBeUndefined();
  });
});

describe("EXAMPLE column — pill stands above the shoe", () => {
  function crossing(mode: PillMode): Job {
    const job = exampleJob();
    job.name = "EXAMPLE pill across the shoe";
    job.mode = mode;
    job.well.mdTd_ft = 12000;
    job.well.tvdTd_ft = 12000;
    job.well.bitMd_ft = 11000;
    job.well.shoeMd_ft = 9000;
    job.well.shoeTvd_ft = 9000;
    job.well.anchorMd_ft = 11000;
    job.well.anchorTvd_ft = 11000;
    job.well.fit_ppg = 16;
    job.well.targetEmw_ppg = 12;
    job.well.casing = [{ topMd_ft: 0, bottomMd_ft: 9000, id_in: 8.5 }];
    job.well.survey = [
      { md_ft: 9000, tvd_ft: 9000 },
      { md_ft: 11000, tvd_ft: 11000 },
      { md_ft: 12000, tvd_ft: 12000 },
    ];
    job.fluids[0].density_ppg = 11.4;
    job.fluids[1].density_ppg = 14;
    job.column = [
      { fluidId: "mud", topMd_ft: 0, bottomMd_ft: 7000 },
      { fluidId: "pill", topMd_ft: 7000, bottomMd_ft: 11000 },
      { fluidId: "mud", topMd_ft: 11000, bottomMd_ft: 12000 },
    ];
    job.pipeColumn = [{ fluidId: "mud", topMd_ft: 0, bottomMd_ft: 11000 }];
    return job;
  }

  it("shoe ESD is mud plus only the pill TVD standing above the shoe", () => {
    // 11.4 + (14 - 11.4) * (9000 - 7000) / 9000
    const expected = 11.4 + (2.6 * 2000) / 9000;
    for (const mode of ["noDP", "withDP"] as const) {
      const result = calculate(crossing(mode));
      expect(result.depths.shoe.esd_ppg).toBeCloseTo(expected, 4);
      expect(result.depths.shoe.esd_ppg!).toBeGreaterThan(11.4);
      expect(result.depths.shoe.esd_ppg!).toBeLessThan(14);
    }
  });

  it("withDP without pipe-side pill matches the column and does not invent equalize pressure", () => {
    const withDp = calculate(crossing("withDP"));
    const noDp = calculate(crossing("noDP"));
    expect(withDp.issues.some((item) => item.code === "EQUALIZE_PENDING")).toBe(false);
    expect(noDp.issues.some((item) => item.code === "EQUALIZE_PENDING")).toBe(false);
    expect(withDp.depths.shoe.esd_ppg!).toBeGreaterThanOrEqual(noDp.depths.shoe.esd_ppg! - 1e-6);
    for (const stage of withDp.displacement.stages) {
      expect(stage.shoeEsd_ppg!).toBeGreaterThanOrEqual(11.4 - 1e-6);
      expect(stage.shoeEsd_ppg!).toBeLessThanOrEqual(14 + 1e-6);
      expect(stage.pumped_bbl).not.toBeNull();
      expect(stage.pumped_bbl!).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("RIH pipe displacement — slug and multi-fluid columns", () => {
  const full = 8.5 ** 2 / 1029.4;
  const annular = (8.5 ** 2 - 5 ** 2) / 1029.4;
  const ratio = full / annular;

  function stacked(column: Job["column"]): Job {
    const job = exampleJob();
    job.name = "EXAMPLE stacked column";
    job.mode = "noDP";
    job.well.mdTd_ft = 10000;
    job.well.tvdTd_ft = 10000;
    job.well.bitMd_ft = 10000;
    job.well.shoeMd_ft = 6000;
    job.well.shoeTvd_ft = 6000;
    job.well.anchorMd_ft = 9000;
    job.well.anchorTvd_ft = 9000;
    job.well.fit_ppg = 18;
    job.well.targetEmw_ppg = 12;
    job.well.casing = [{ topMd_ft: 0, bottomMd_ft: 6000, id_in: 8.5 }];
    job.well.survey = [6000, 9000, 10000].map((md) => ({ md_ft: md, tvd_ft: md }));
    job.fluids = [
      { id: "mud", label: "EXAMPLE mud", density_ppg: 12, fann: EXAMPLE_FANN },
      { id: "slug", label: "EXAMPLE slug", density_ppg: 14, fann: EXAMPLE_FANN },
      { id: "pill", label: "EXAMPLE pill", density_ppg: 16, fann: EXAMPLE_FANN },
    ];
    job.column = column;
    job.pipeColumn = [{ fluidId: "mud", topMd_ft: 0, bottomMd_ft: 10000 }];
    job.trip.speeds_ftmin = [];
    return job;
  }

  it("moves a multi-fluid pill up by the closed-pipe displacement", () => {
    const job = stacked([
      { fluidId: "mud", topMd_ft: 0, bottomMd_ft: 7000 },
      { fluidId: "slug", topMd_ft: 7000, bottomMd_ft: 8000 },
      { fluidId: "pill", topMd_ft: 8000, bottomMd_ft: 10000 },
    ]);
    const pillTop = 10000 - 2000 * ratio;
    const slugTop = pillTop - 1000 * ratio;
    const shifted = columnDisplacedByPipe(job, 10000);
    expect(shifted).not.toBeNull();
    const slug = shifted!.column.find((segment) => segment.fluidId === "slug")!;
    const pill = shifted!.column.find((segment) => segment.fluidId === "pill")!;
    expect(pill.bottomMd_ft).toBeCloseTo(10000, 2);
    expect(pill.topMd_ft).toBeCloseTo(pillTop, 2);
    expect(slug.bottomMd_ft).toBeCloseTo(pillTop, 2);
    expect(slug.topMd_ft).toBeCloseTo(slugTop, 2);
    expect(slug.topMd_ft).toBeLessThan(7000);

    const result = calculate(job);
    expect(result.issues.some((item) => item.code === "RELEASE_BLOCKER")).toBe(false);
    expect(result.displacement.stages[0].shoeEsd_ppg).toBeCloseTo(12, 4);
    expect(result.displacement.stages[0].pumped_bbl).toBe(0);
    const slugAboveShoe = 6000 - slugTop;
    expect(result.displacement.stages.at(-1)!.shoeEsd_ppg).toBeCloseTo(
      12 + (2 * slugAboveShoe) / 6000,
      3,
    );
    expect(result.displacement.stages.at(-1)!.pumped_bbl).toBeCloseTo(
      2000 * (4.276 ** 2 / 1029.4),
      4,
    );
  });

  it("moves a slug that sits above a mud spacer", () => {
    const job = stacked([
      { fluidId: "mud", topMd_ft: 0, bottomMd_ft: 5000 },
      { fluidId: "slug", topMd_ft: 5000, bottomMd_ft: 6000 },
      { fluidId: "mud", topMd_ft: 6000, bottomMd_ft: 7000 },
      { fluidId: "pill", topMd_ft: 7000, bottomMd_ft: 10000 },
    ]);
    const pillTop = 10000 - 3000 * ratio;
    const spacerTop = pillTop - 1000 * ratio;
    const slugTop = spacerTop - 1000 * ratio;
    const shifted = columnDisplacedByPipe(job, 10000);
    expect(shifted).not.toBeNull();
    const slug = shifted!.column.find((segment) => segment.fluidId === "slug")!;
    expect(slug.topMd_ft).toBeCloseTo(slugTop, 2);
    expect(slug.bottomMd_ft).toBeCloseTo(spacerTop, 2);
    expect(slug.topMd_ft).toBeLessThan(5000);
    const result = calculate(job);
    expect(result.issues.some((item) => item.code === "RELEASE_BLOCKER")).toBe(false);
    const slugHeight = spacerTop - slugTop;
    const pillAboveShoe = 6000 - pillTop;
    expect(result.displacement.stages.at(-1)!.shoeEsd_ppg).toBeCloseTo(
      12 + ((14 - 12) * slugHeight + (16 - 12) * pillAboveShoe) / 6000,
      3,
    );
    expect(result.displacement.slugVolume_bbl).toBeCloseTo(1000 * full, 3);
    expect(result.displacement.stages[0].pumped_bbl).toBe(0);
    expect(result.displacement.stages.at(-1)!.pumped_bbl).toBeCloseTo(
      3000 * (4.276 ** 2 / 1029.4),
      4,
    );
  });
});

describe("trip schedule", () => {
  it("is POOH then RIH, and never reports maxSpeed 0", () => {
    const job = exampleJob();
    job.well.fit_ppg = 40;
    job.trip.speeds_ftmin = [0, 10, 400];
    const rows = calculate(job).tripSchedule;
    expect(rows.length).toBeGreaterThan(1);
    const firstRih = rows.findIndex((row) => row.direction === "RIH");
    expect(firstRih).toBeGreaterThan(0);
    expect(rows.slice(0, firstRih).every((row) => row.direction === "POOH")).toBe(true);
    expect(rows.slice(firstRih).every((row) => row.direction === "RIH")).toBe(true);
    for (const row of rows) {
      expect(row.maxSpeed_ftmin).not.toBe(0);
      if (row.direction === "POOH") expect(row.fromBitMd_ft).toBeGreaterThan(row.toBitMd_ft);
      else expect(row.toBitMd_ft).toBeGreaterThan(row.fromBitMd_ft);
      if (row.maxSpeed_ftmin != null) {
        expect([10, 400]).toContain(row.maxSpeed_ftmin);
        expect(row.sbpRequired_psi).not.toBeNull();
        expect(row.emwAt.shoe.surge_ppg).not.toBeNull();
        expect(row.emwAt.anchor.swab_ppg).not.toBeNull();
        expect(row.emwAt.bit.swab_ppg).not.toBeNull();
        expect(row.emwAt.shoe.surge_ppg!).toBeGreaterThan(0);
      }
    }
    expect(rows.some((row) => row.maxSpeed_ftmin != null)).toBe(true);
  });

  it("returns null maxSpeed and an error when no speed stays under FIT", () => {
    const job = exampleJob();
    job.well.fit_ppg = 12;
    job.well.targetEmw_ppg = 12;
    job.trip.speeds_ftmin = [40];
    const result = calculate(job);
    expect(result.tripSchedule.length).toBeGreaterThan(0);
    expect(result.tripSchedule.every((row) => row.maxSpeed_ftmin === null)).toBe(true);
    expect(result.tripSchedule.some((row) => row.maxSpeed_ftmin === 0)).toBe(false);
    const failure = result.issues.find((item) => item.code === "NO_SAFE_TRIP_SPEED");
    expect(failure).toMatchObject({ level: "error", field: "trip.speeds_ftmin" });
    expect(result.tripSchedule.every((row) => row.limitedBy === "FIT")).toBe(true);
  });

  it("names pore, or FIT when the anchor floor and FIT cannot both hold", () => {
    const pore = exampleJob();
    pore.trip.speeds_ftmin = [10];
    pore.well.fit_ppg = 14;
    pore.well.targetEmw_ppg = 12;
    pore.well.porePressure_ppg = 30;
    const poreResult = calculate(pore);
    expect(poreResult.depths.shoe.pore_ppg).toBeNull();
    expect(poreResult.depths.anchor.pore_ppg).toBeNull();
    expect(poreResult.depths.td.pore_ppg).toBe(30);
    const deep = poreResult.tripSchedule.filter((row) => row.toBitMd_ft >= 1000);
    expect(deep.length).toBeGreaterThan(0);
    expect(deep.every((row) => row.maxSpeed_ftmin === null)).toBe(true);
    expect(deep.every((row) => row.limitedBy === "pore")).toBe(true);

    const target = exampleJob();
    target.trip.speeds_ftmin = [10];
    target.well.fit_ppg = 14;
    target.well.targetEmw_ppg = 20;
    const targetResult = calculate(target);
    expect(targetResult.tripSchedule.every((row) => row.maxSpeed_ftmin === null)).toBe(true);
    expect(targetResult.tripSchedule.every((row) => row.limitedBy === "FIT")).toBe(true);
    expect(
      targetResult.issues.some(
        (item) => item.code === "NO_SAFE_TRIP_SPEED" && item.level === "error",
      ),
    ).toBe(true);
  });

  it("leaves ECD and surge empty — not zero — when Fann is missing", () => {
    const job = exampleJob();
    delete job.fluids[0].fann;
    delete job.fluids[1].fann;
    const result = calculate(job);
    expect(result.depths.shoe.esd_ppg).toBeCloseTo(12, 4);
    expect(result.depths.shoe.ecd_ppg).toBeNull();
    expect(result.depths.td.ecd_ppg).toBeNull();
    expect(result.depths.shoe.surge).toEqual([]);
    expect(result.depths.anchor.swab).toEqual([]);
    expect(result.issues.some((item) => item.code === "MISSING_FANN")).toBe(true);
    expect(result.issues.some((item) => item.code === "NO_SAFE_TRIP_SPEED")).toBe(false);
    expect(result.tripSchedule.every((row) => row.maxSpeed_ftmin === null)).toBe(true);
  });
});

describe("Auburnia — fixture copied into the core", () => {
  const mud = 15.3;
  const kmw = 18.5;

  it("keeps shoe ESD between mud weight and pill weight in both modes", () => {
    for (const mode of ["noDP", "withDP"] as const) {
      const result = calculate(auburniaJob(mode));
      expect(result.depths.shoe.esd_ppg).not.toBeNull();
      expect(result.depths.shoe.esd_ppg!).toBeGreaterThan(mud);
      expect(result.depths.shoe.esd_ppg!).toBeLessThanOrEqual(kmw + 1e-6);
      expect(result.depths.shoe.esd_ppg).not.toBe(0);
      for (const stage of result.displacement.stages) {
        expect(stage.shoeEsd_ppg!).toBeGreaterThanOrEqual(mud - 1e-6);
        expect(stage.shoeEsd_ppg!).toBeLessThanOrEqual(kmw + 1e-6);
      }
    }
    expect(
      calculate(auburniaJob("withDP")).issues.some((item) => item.code === "EQUALIZE_PENDING"),
    ).toBe(false);
    expect(
      calculate(auburniaJob("noDP")).issues.some((item) => item.code === "EQUALIZE_PENDING"),
    ).toBe(false);
  });
});

interface ExpectedTrip {
  rows: TripScheduleRow[];
}

const auburniaExpected = JSON.parse(
  readFileSync(new URL("./fixtures/auburnia-trip.expected.json", import.meta.url), "utf8"),
) as ExpectedTrip;

function within(actual: number | null, expected: number, tol: number) {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual ?? 0) - expected)).toBeLessThanOrEqual(tol);
}

describe("Auburnia tripSchedule — 500 ft steps", () => {
  const result = calculate(auburniaJob("noDP"));
  const expectedRih = auburniaExpected.rows.filter((row) => row.direction === "RIH");
  const rih = result.tripSchedule.filter((row) => row.direction === "RIH");
  const pooh = result.tripSchedule.filter((row) => row.direction === "POOH");

  it("breaks at pill top and spot, then even-splits into the attached rows", () => {
    // Breakpoints: surface, pill top 7951, shoe 10785, spot 11681, anchor 12675, TD.
    // Even splits of those spans are 16+6+2+2+12 = 38 intervals, 39 depths.
    // The attached file has one row per interval: 38 POOH and 38 RIH.
    const ends = result.tripSchedule.flatMap((row) => [row.fromBitMd_ft, row.toBitMd_ft]);
    for (const knot of [0, 7951, 10785, 11681, 12675, 18359]) {
      expect(ends.some((md) => Math.abs(md - knot) < 0.2)).toBe(true);
    }
    const depths = [...new Set(ends.map((md) => Math.round(md * 10) / 10))].sort((a, b) => a - b);
    expect(depths).toHaveLength(39);
    expect(auburniaExpected.rows).toHaveLength(76);
    expect(result.tripSchedule).toHaveLength(auburniaExpected.rows.length);
    expect(pooh).toHaveLength(38);
    expect(rih).toHaveLength(38);
    within(result.depths.shoe.esd_ppg, 16.1409, 0.001);
    within(result.depths.anchor.esd_ppg, 16.2767, 0.001);
    within(result.tripSchedule[0].sbpStatic_psi, 14.45, 0.1);
    for (const row of result.tripSchedule) {
      expect(Math.abs(row.toBitMd_ft - row.fromBitMd_ft)).toBeLessThanOrEqual(500 + 1e-6);
    }
    for (let i = 0; i < result.tripSchedule.length; i++) {
      const row = result.tripSchedule[i];
      const expected = auburniaExpected.rows[i];
      expect(row.direction).toBe(expected.direction);
      within(row.fromBitMd_ft, expected.fromBitMd_ft, 0.051);
      within(row.toBitMd_ft, expected.toBitMd_ft, 0.051);
    }
  });

  it("matches the RIH check within 0.001 ppg and 0.1 psi", () => {
    expect(rih).toHaveLength(expectedRih.length);
    for (let i = 0; i < rih.length; i++) {
      const row = rih[i];
      const expected = expectedRih[i];
      expect(row.maxSpeed_ftmin).toBe(expected.maxSpeed_ftmin);
      expect(row.limitedBy).toBe(expected.limitedBy);
      within(row.fromBitMd_ft, expected.fromBitMd_ft, 0.051);
      within(row.toBitMd_ft, expected.toBitMd_ft, 0.051);
      within(row.sbpRequired_psi, expected.sbpRequired_psi!, 0.1);
      within(row.sbpStatic_psi, expected.sbpStatic_psi!, 0.1);
      for (const key of ["shoe", "anchor", "bit"] as const) {
        within(row.emwAt[key].surge_ppg, expected.emwAt[key].surge_ppg!, 0.001);
        within(row.emwAt[key].swab_ppg, expected.emwAt[key].swab_ppg!, 0.001);
      }
    }
    const deep = rih.find((row) => row.toBitMd_ft > 18000);
    expect(deep?.maxSpeed_ftmin).toBe(40);
    within(deep?.sbpRequired_psi ?? null, 324.5, 0.1);
    const at12178 = rih.find((row) => Math.abs(row.toBitMd_ft - 12178) < 0.2);
    expect(at12178?.maxSpeed_ftmin).toBe(80);
    within(at12178?.emwAt.shoe.surge_ppg ?? null, 17.498, 0.001);
    const shallow = rih.find((row) => row.toBitMd_ft > 0 && row.toBitMd_ft < 6957);
    expect(shallow?.maxSpeed_ftmin).toBe(200);
    expect(shallow?.limitedBy).toBe("none");
    const aboveAnchor = rih.find((row) => row.toBitMd_ft < 12675);
    within(aboveAnchor?.emwAt.anchor.swab_ppg ?? null, 16.3, 0.001);
  });

  it("keeps POOH static shoe EMW under FIT and drops speeds whose surge reaches FIT", () => {
    const shoeEsd = result.depths.shoe.esd_ppg!;
    const shoeTvd = result.depths.shoe.tvd_ft!;
    expect(pooh.length).toBe(rih.length);
    for (let i = 0; i < rih.length; i++) {
      const out = pooh[pooh.length - 1 - i];
      within(out.fromBitMd_ft, rih[i].toBitMd_ft, 0.051);
      const outSpeed = out.maxSpeed_ftmin ?? -1;
      const inSpeed = rih[i].maxSpeed_ftmin ?? -1;
      expect(outSpeed).toBeGreaterThanOrEqual(inSpeed);
      if (out.sbpRequired_psi == null) continue;
      const staticEmw = shoeEsd + out.sbpRequired_psi / (0.052 * shoeTvd);
      expect(staticEmw).toBeLessThan(17.5);
      expect(out.emwAt.shoe.surge_ppg!).toBeLessThan(17.5);
      within(out.emwAt.anchor.swab_ppg, 16.3, 0.001);
    }
  });
});

describe("Lock Sub 1H — MPGenie shoe 8033 and the real shoe", () => {
  it("case A balances the float U-tube and raises shoe ESD only above the shoe", () => {
    const job = lockSubSpotJob("8033");
    const balance = balanceFloat(job);
    expect(balance).not.toBeNull();
    within(balance!.dumpBbl, 3.17, 0.01);
    within(balance!.pillTopTvd_ft, 8018.7, 0.1);
    within(balance!.bitPsi, 6535.1, 0.1);
    within(balance!.shoeEsd_ppg, 11.4046, 0.001);
    expect(balance!.shoeEsd_ppg).toBeGreaterThan(11.4);

    const result = calculate(job);
    within(result.depths.shoe.esd_ppg, 11.4046, 0.001);
    within(result.displacement.pillTopTvd_ft, 8018.7, 0.1);
    expect(result.displacement.stages.map((stage) => stage.n)).toEqual([0, 1, 2]);
    expect(result.displacement.stages.map((stage) => Math.round(stage.bitMd_ft))).toEqual([
      0, 8057, 10480,
    ]);
    within(result.displacement.stages[0].shoeEsd_ppg, 11.4, 0.001);
    within(result.displacement.stages[1].shoeEsd_ppg, 11.4, 0.001);
    within(result.displacement.stages[2].shoeEsd_ppg, 11.4046, 0.001);
    expect(result.issues.some((item) => item.code === "EQUALIZE_PENDING")).toBe(false);
    const pill = job.column.find((segment) => segment.fluidId === "pill")!;
    const pipeCap = job.well.stringId_in ** 2 / 1029.4;
    expect(result.displacement.stages[0].pumped_bbl).toBe(0);
    expect(result.displacement.stages[1].pumped_bbl).toBe(0);
    expect(result.displacement.stages[2].pumped_bbl).toBeCloseTo(
      (pill.bottomMd_ft - pill.topMd_ft) * pipeCap,
      4,
    );
    expect(
      result.issues.some((item) => item.code === "RELEASE_BLOCKER" && item.level === "error"),
    ).toBe(false);

    const real = calculate(lockSubSpotJob("3187"));
    within(real.depths.shoe.esd_ppg, 11.4, 0.001);
    for (const stage of real.displacement.stages) within(stage.shoeEsd_ppg, 11.4, 0.001);
  });

  it("case B trips a dry closed pipe into the pipe-out pill", () => {
    const moved = calculate(lockSubDryJob("noDP", "8033"));
    const stages = moved.displacement.stages;
    expect(stages.map((stage) => stage.n)).toEqual([0, 1, 2]);
    expect(stages.map((stage) => stage.bitMd_ft)).toEqual([0, 8060, 10480]);
    within(stages[0].shoeEsd_ppg, 11.4, 0.001);
    within(stages[1].shoeEsd_ppg, 11.4, 0.001);
    within(stages[2].shoeEsd_ppg, 11.5829, 0.001);
    const pipeCap = 4.778 ** 2 / 1029.4;
    expect(stages[0].pumped_bbl).toBe(0);
    expect(stages[1].pumped_bbl).toBe(0);
    expect(stages[2].pumped_bbl).toBeCloseTo(2420 * pipeCap, 4);

    const real = calculate(lockSubDryJob("noDP", "3187"));
    expect(real.displacement.stages.map((stage) => stage.bitMd_ft)).toEqual([0, 8060, 10480]);
    for (const stage of real.displacement.stages) within(stage.shoeEsd_ppg, 11.4, 0.001);
    within(real.depths.shoe.esd_ppg, 11.4, 0.001);
  });
});

describe("SHOE_ESD_AT_FIT", () => {
  it("errors when static shoe ESD plus SBP is at or above FIT and stays quiet when it is not", () => {
    const hot = exampleJob();
    hot.well.fit_ppg = 12;
    hot.trip.speeds_ftmin = [];
    hot.trip.flow_gpm = 0;
    const hotIssues = calculate(hot).issues.filter((item) => item.code === "SHOE_ESD_AT_FIT");
    expect(hotIssues.length).toBeGreaterThan(0);
    expect(hotIssues.every((item) => item.level === "error")).toBe(true);
    const shoe = hotIssues.find((item) => item.field === "depths.shoe.esd_ppg");
    expect(shoe?.jobFields).toEqual(
      expect.arrayContaining([
        "well.shoeMd_ft",
        "well.shoeTvd_ft",
        "well.fit_ppg",
        "column",
        "fluids",
        "trip.sbpConn_psi",
      ]),
    );

    const cold = exampleJob();
    cold.well.fit_ppg = 100;
    expect(calculate(cold).issues.some((item) => item.code === "SHOE_ESD_AT_FIT")).toBe(false);
  });

  it("drops a surge speed from the band and warns instead of locking the sheet", () => {
    const result = calculate(auburniaJob("noDP"));
    const warnings = result.issues.filter((item) => item.code === "SHOE_SURGE_AT_FIT");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ level: "warn", field: "depths.shoe.surge" });
    expect(result.issues.some((item) => item.code === "SHOE_ESD_AT_FIT")).toBe(false);
    const rih = result.tripSchedule.filter((row) => row.direction === "RIH");
    expect(rih.some((row) => row.maxSpeed_ftmin === 40)).toBe(true);
    expect(rih.every((row) => row.maxSpeed_ftmin !== 0)).toBe(true);
    expect(rih.find((row) => row.toBitMd_ft > 18000)?.maxSpeed_ftmin).toBe(40);
  });
});

describe("pore at TD only", () => {
  it("copies the entered pore to TD and leaves the shoe and anchor null", () => {
    const job = exampleJob();
    job.well.porePressure_ppg = 9.5;
    const depths = calculate(job).depths;
    expect(depths.shoe.pore_ppg).toBeNull();
    expect(depths.anchor.pore_ppg).toBeNull();
    expect(depths.td.pore_ppg).toBe(9.5);
  });
});
