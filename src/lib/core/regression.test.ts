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
import { calculate as calculateLegacy } from "@/lib/calc/engine";
import { AUBURNIA } from "@/lib/calc/examples";
import { calculate } from "./calculate";
import { EXAMPLE_FANN, exampleJob } from "./example-job";
import type { FannReading, Job, PillMode } from "./job.schema";

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

/**
 * Lock Sub 1H geometry already in shoe-esd.test.ts.
 * Pill top 8060 MD is below the 3199 MD shoe, so both modes stay at mud weight.
 * Fann on the fluids is synthetic EXAMPLE rheology, not a field reading.
 * TD TVD is scaled from the repo anchor tie — the sheet has no TD TVD.
 */
function lockSubJob(mode: PillMode): Job {
  return {
    schemaVersion: 1,
    name: "Lock Sub 1H",
    savedAt: "2026-10-05T00:00:00.000Z",
    mode,
    well: {
      mdTd_ft: 10530,
      tvdTd_ft: 10516,
      bitMd_ft: 10480,
      shoeMd_ft: 3199,
      shoeTvd_ft: 3187,
      anchorMd_ft: 10480,
      anchorTvd_ft: 10466,
      fit_ppg: 12.6,
      targetEmw_ppg: 12,
      casing: [{ topMd_ft: 0, bottomMd_ft: 3199, id_in: 12.515 }],
      openHoleId_in: 12.25,
      stringOd_in: 5.5,
      stringId_in: 4.778,
      survey: [
        { md_ft: 3199, tvd_ft: 3187 },
        { md_ft: 8060, tvd_ft: 8046 },
        { md_ft: 10480, tvd_ft: 10466 },
        { md_ft: 10530, tvd_ft: 10516 },
      ],
    },
    fluids: [
      { id: "mud", label: "mud", density_ppg: 11.4, fann: { ...EXAMPLE_FANN } },
      { id: "pill", label: "pill", density_ppg: 14, fann: { ...EXAMPLE_FANN } },
    ],
    column: [
      { fluidId: "mud", topMd_ft: 0, bottomMd_ft: 8060 },
      { fluidId: "pill", topMd_ft: 8060, bottomMd_ft: 10480 },
      { fluidId: "mud", topMd_ft: 10480, bottomMd_ft: 10530 },
    ],
    trip: {
      speeds_ftmin: [40, 80, 100, 150, 200, 250, 300],
      pipeEnd: "closed",
      clinging: 0.45,
      eccentricity: 0,
      sbpConn_psi: 325,
      sbpCirc_psi: 0,
      flow_gpm: 300,
    },
  };
}

describe("Lock Sub 1H shoe ESD — pill top below the shoe, both modes", () => {
  const noDp = calculate(lockSubJob("noDP"));
  const withDp = calculate(lockSubJob("withDP"));

  it("shoe ESD equals mud weight and never drops below it", () => {
    for (const result of [noDp, withDp]) {
      expect(result.depths.shoe.esd_ppg).toBeCloseTo(11.4, 4);
      expect(result.depths.shoe.esd_ppg!).toBeGreaterThanOrEqual(11.4 - 1e-6);
      expect(result.depths.shoe.fit_ppg).toBe(12.6);
      expect(result.depths.anchor.fit_ppg).toBeNull();
      expect(result.depths.shoe.pore_ppg).toBeNull();
      for (const stage of result.displacement.stages) {
        expect(stage.shoeEsd_ppg).toBeCloseTo(11.4, 4);
        expect(stage.shoeEsd_ppg!).toBeGreaterThanOrEqual(11.4 - 1e-6);
        expect(stage.pumped_bbl).toBeNull();
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

  it("withDP flags the missing pipe-side equalize term once the pill reaches the shoe", () => {
    const withDp = calculate(crossing("withDP"));
    const noDp = calculate(crossing("noDP"));
    expect(withDp.issues.some((item) => item.code === "EQUALIZE_PENDING")).toBe(true);
    expect(noDp.issues.some((item) => item.code === "EQUALIZE_PENDING")).toBe(false);
    expect(withDp.depths.shoe.esd_ppg!).toBeGreaterThanOrEqual(noDp.depths.shoe.esd_ppg! - 1e-6);
    for (const stage of withDp.displacement.stages) {
      expect(stage.shoeEsd_ppg!).toBeGreaterThanOrEqual(11.4 - 1e-6);
      expect(stage.shoeEsd_ppg!).toBeLessThanOrEqual(14 + 1e-6);
      expect(stage.pumped_bbl).toBeNull();
    }
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

  it("names pore or target EMW when that floor, not FIT at zero SBP, rejects every speed", () => {
    const pore = exampleJob();
    pore.trip.speeds_ftmin = [10];
    pore.well.fit_ppg = 14;
    pore.well.targetEmw_ppg = 12;
    pore.well.porePressure_ppg = 30;
    const poreResult = calculate(pore);
    expect(poreResult.tripSchedule.every((row) => row.maxSpeed_ftmin === null)).toBe(true);
    expect(poreResult.tripSchedule.every((row) => row.limitedBy === "pore")).toBe(true);

    const target = exampleJob();
    target.trip.speeds_ftmin = [10];
    target.well.fit_ppg = 14;
    target.well.targetEmw_ppg = 20;
    const targetResult = calculate(target);
    expect(targetResult.tripSchedule.every((row) => row.maxSpeed_ftmin === null)).toBe(true);
    expect(targetResult.tripSchedule.every((row) => row.limitedBy === "targetEmw")).toBe(true);
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

describe("Auburnia — existing workbook geometry", () => {
  function auburniaJob(mode: PillMode): Job {
    const legacy = calculateLegacy(AUBURNIA);
    if (typeof legacy.topOfPillNoDp !== "number") {
      throw new Error("Auburnia pill top was not numeric");
    }
    const top = legacy.topOfPillNoDp;
    const spot = Number(AUBURNIA.spotMd);
    const td = Number(AUBURNIA.currentDepthMd);
    const anchorMd = Number(AUBURNIA.anchorMd);
    const anchorTvd = Number(AUBURNIA.anchorTvd);
    const spotTvd = Number(AUBURNIA.spotTvd);
    const shoeMd = Number(AUBURNIA.casingMd);
    const shoeTvd = Number(AUBURNIA.casingTvd);
    // The workbook has no TD TVD. Extend the spot→anchor slope already in the repo.
    const tvdTd = anchorTvd + ((td - anchorMd) * (anchorTvd - spotTvd)) / (anchorMd - spot);
    return {
      schemaVersion: 1,
      name: String(AUBURNIA.wellName),
      savedAt: "2026-08-10T00:00:00.000Z",
      mode,
      well: {
        mdTd_ft: td,
        tvdTd_ft: tvdTd,
        bitMd_ft: td,
        shoeMd_ft: shoeMd,
        shoeTvd_ft: shoeTvd,
        anchorMd_ft: anchorMd,
        anchorTvd_ft: anchorTvd,
        fit_ppg: Number(AUBURNIA.fit),
        targetEmw_ppg: Number(AUBURNIA.desiredEmw),
        casing: [{ topMd_ft: 0, bottomMd_ft: shoeMd, id_in: Number(AUBURNIA.idCasing) }],
        openHoleId_in: Number(AUBURNIA.openHoleDia),
        stringOd_in: Number(AUBURNIA.odDp),
        stringId_in: Number(AUBURNIA.idDp),
        survey: [
          { md_ft: shoeMd, tvd_ft: shoeTvd },
          { md_ft: spot, tvd_ft: spotTvd },
          { md_ft: anchorMd, tvd_ft: anchorTvd },
          { md_ft: td, tvd_ft: tvdTd },
        ],
      },
      fluids: [
        {
          id: "mud",
          label: "mud",
          density_ppg: Number(AUBURNIA.currentMw),
          fann: { ...EXAMPLE_FANN },
        },
        { id: "pill", label: "pill", density_ppg: Number(AUBURNIA.kmw), fann: { ...EXAMPLE_FANN } },
      ],
      column: [
        { fluidId: "mud", topMd_ft: 0, bottomMd_ft: top },
        { fluidId: "pill", topMd_ft: top, bottomMd_ft: spot },
        { fluidId: "mud", topMd_ft: spot, bottomMd_ft: td },
      ],
      trip: {
        speeds_ftmin: [40, 80, 200],
        pipeEnd: "closed",
        clinging: 0.45,
        eccentricity: 0,
        sbpConn_psi: Number(AUBURNIA.sbpConnection),
        sbpCirc_psi: 0,
        flow_gpm: Number(AUBURNIA.maxFlowRate),
      },
    };
  }

  const mud = Number(AUBURNIA.currentMw);
  const kmw = Number(AUBURNIA.kmw);

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
    ).toBe(true);
    expect(
      calculate(auburniaJob("noDP")).issues.some((item) => item.code === "EQUALIZE_PENDING"),
    ).toBe(false);
  });

  it.todo("Auburnia tripSchedule rows — MPGenie has not supplied expected values yet");
});

describe("pending MPGenie cases", () => {
  it.todo(
    "Lock Sub shoe at 8033 ft TVD — withDP counts only the equalized slice above the shoe (needs pipe-side inventory)",
  );
});
