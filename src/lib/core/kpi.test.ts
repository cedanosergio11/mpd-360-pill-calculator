import { describe, expect, it } from "vitest";
import { exampleB } from "@/lib/example-b";
import { exampleJob } from "./example-job";
import type { Job } from "./job.schema";
import {
  chaseVolume,
  kmw,
  kmwBackfill,
  kmwInString,
  kpiVolumes,
  masp,
  poohFill,
  type KpiVolumesResult,
} from "./kpi";

/**
 * EXAMPLE B numbers below are unchecked. They follow the specified formulas
 * until MPGenie supplies an expected file. Stand length 93 ft is assumed.
 * Planned SBP is the entered connection SBP, 325 psi, not a target-derived pressure.
 * Pill-bottom target is the annulus pill bottom, which is the bit, so the annular
 * chase leg is 0. The string holds no pill.
 */

const STAND_FT = 93;

function finiteTree(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteTree);
  if (value && typeof value === "object") {
    return Object.values(value).every((item) => item == null || finiteTree(item));
  }
  return true;
}

describe("masp", () => {
  it("uses FIT, active MW, and shoe TVD on EXAMPLE B", () => {
    // (12.6 − 11.4) × 0.052 × 8033 = 501.2592 psi. Planned SBP is the entered 325 psi.
    const result = masp({
      fitEmw_ppg: 12.6,
      activeMw_ppg: 11.4,
      activeMwFluidId: "mud",
      shoeTvd_ft: 8033,
      plannedSbp_psi: 325,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deltaEmw_ppg).toBeCloseTo(1.2, 9);
    expect(result.psiPerPpg).toBeCloseTo(0.052 * 8033, 9);
    expect(result.masp_psi).toBeCloseTo(1.2 * 0.052 * 8033, 6);
    expect(result.plannedSbp_psi).toBe(325);
    expect(result.sbpExceedsMasp).toBe(false);
  });

  it("flags planned SBP above MASP", () => {
    const result = masp({
      fitEmw_ppg: 12.6,
      activeMw_ppg: 11.4,
      shoeTvd_ft: 8033,
      plannedSbp_psi: 600,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sbpExceedsMasp).toBe(true);
  });

  it("returns MISSING_FIT and does not default it", () => {
    expect(
      masp({ fitEmw_ppg: null, activeMw_ppg: 11.4, shoeTvd_ft: 8033, plannedSbp_psi: 325 }),
    ).toEqual({
      ok: false,
      error: { code: "MISSING_FIT", field: "well.fit_ppg", message: "FIT is missing." },
    });
  });

  it("returns MISSING_SHOE_TVD for a blank or zero shoe", () => {
    expect(
      masp({ fitEmw_ppg: 12.6, activeMw_ppg: 11.4, shoeTvd_ft: null, plannedSbp_psi: 325 }),
    ).toEqual({
      ok: false,
      error: {
        code: "MISSING_SHOE_TVD",
        field: "well.shoeTvd_ft",
        message: "Shoe TVD is missing.",
      },
    });
    expect(
      masp({ fitEmw_ppg: 12.6, activeMw_ppg: 11.4, shoeTvd_ft: 0, plannedSbp_psi: 325 }).ok,
    ).toBe(false);
  });
});

describe("kmw", () => {
  it("adds SBP over anchor TVD and rounds up to 0.1 ppg", () => {
    // 11.4 + 325 / (0.052 × 10466) = 11.99717, which ceilings to 12.0.
    const result = kmw({ activeMw_ppg: 11.4, sbp_psi: 325, anchorTvd_ft: 10466 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.psiPerPpg).toBeCloseTo(0.052 * 10466, 9);
    expect(result.sbp_ppg).toBeCloseTo(325 / (0.052 * 10466), 9);
    expect(result.raw_ppg).toBeCloseTo(11.4 + 325 / (0.052 * 10466), 9);
    expect(result.rounded_ppg).toBe(12);
  });

  it("leaves an exact tenth unchanged and ceilings the next step", () => {
    const exact = kmw({ activeMw_ppg: 12, sbp_psi: 0, anchorTvd_ft: 10466 });
    expect(exact.ok).toBe(true);
    if (exact.ok) expect(exact.rounded_ppg).toBe(12);
    const up = kmw({ activeMw_ppg: 11.4, sbp_psi: 0.61 * 0.052 * 10000, anchorTvd_ft: 10000 });
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.raw_ppg).toBeCloseTo(12.01, 9);
    expect(up.rounded_ppg).toBeCloseTo(12.1, 9);
  });

  it("errors when anchor TVD is missing or zero and does not read a survey", () => {
    expect(kmw({ activeMw_ppg: 11.4, sbp_psi: 325, anchorTvd_ft: null })).toEqual({
      ok: false,
      error: {
        code: "MISSING_ANCHOR_TVD",
        field: "well.anchorTvd_ft",
        message: "Anchor TVD is missing.",
      },
    });
    expect(kmw({ activeMw_ppg: 11.4, sbp_psi: 325, anchorTvd_ft: 0 })).toEqual({
      ok: false,
      error: {
        code: "MISSING_ANCHOR_TVD",
        field: "well.anchorTvd_ft",
        message: "Anchor TVD must be a finite number greater than 0.",
      },
    });
  });
});

describe("volumes", () => {
  it("builds EXAMPLE B chase without adding the surface line", () => {
    const withLine = chaseVolume(exampleB, { surfaceLine_bbl: 25 });
    const plain = chaseVolume(exampleB);
    expect(withLine.ok && plain.ok).toBe(true);
    if (!withLine.ok || !plain.ok) return;
    const cap = 4.778 ** 2 / 1029.4;
    expect(plain.stringCap_bblFt).toBeCloseTo(cap, 12);
    expect(plain.stringLength_ft).toBe(10480);
    expect(plain.stringCapacity_bbl).toBeCloseTo(cap * 10480, 6);
    expect(plain.pillBottomTargetMd_ft).toBe(10480);
    expect(plain.annularLength_ft).toBe(0);
    expect(plain.annularVolume_bbl).toBe(0);
    expect(plain.pillInString_bbl).toBe(0);
    expect(plain.chase_bbl).toBeCloseTo(cap * 10480, 6);
    expect(plain.surfaceLine_bbl).toBe(0);
    expect(withLine.surfaceLine_bbl).toBe(25);
    expect(withLine.chase_bbl).toBeCloseTo(plain.chase_bbl, 9);
  });

  it("subtracts pill already in the string", () => {
    const job: Job = {
      ...exampleB,
      pipeColumn: [
        { fluidId: "mud", topMd_ft: 0, bottomMd_ft: 10000 },
        { fluidId: "pill", topMd_ft: 10000, bottomMd_ft: 10480 },
      ],
    };
    const result = chaseVolume(job);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cap = 4.778 ** 2 / 1029.4;
    expect(result.pillInString_bbl).toBeCloseTo(480 * cap, 6);
    expect(result.chase_bbl).toBeCloseTo(cap * 10480 - 480 * cap, 6);
  });

  it("reports string capacity above the EXAMPLE B pill top", () => {
    const result = kmwInString(exampleB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cap = 4.778 ** 2 / 1029.4;
    expect(result.pillTopSource).toBe("annulus");
    expect(result.pillTopMd_ft).toBe(8060);
    expect(result.height_ft).toBe(8060);
    expect(result.bbl).toBeCloseTo(cap * 8060, 6);
    expect(result.belowPillTop_ft).toBe(2420);
    expect(result.belowPillTop_bbl).toBeCloseTo(cap * 2420, 6);
  });

  it("backfills the annulus from the pill top to surface with interval geometry", () => {
    const result = kmwBackfill(exampleB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const casing = ((12.515 ** 2 - 5.5 ** 2) / 1029.4) * 8045;
    const openHole = ((12.25 ** 2 - 5.5 ** 2) / 1029.4) * 15;
    expect(result.length_ft).toBe(8060);
    expect(result.sections.map((section) => section.holeId_in)).toEqual([12.515, 12.25]);
    expect(result.sections[0].length_ft).toBeCloseTo(8045, 6);
    expect(result.sections[1].length_ft).toBeCloseTo(15, 6);
    expect(result.sections[0].volume_bbl).toBeCloseTo(casing, 6);
    expect(result.sections[1].volume_bbl).toBeCloseTo(openHole, 6);
    expect(result.volume_bbl).toBeCloseTo(casing + openHole, 6);
    expect(result.volume_bbl).toBeCloseTo(
      result.sections.reduce((sum, section) => sum + section.volume_bbl, 0),
      6,
    );
  });
});

describe("poohFill", () => {
  it("uses closed-pipe displacement per stand with a 64 ft remainder", () => {
    // Assumed stand length 93 ft. 112 × 93 = 10416, remainder 64 ft to the 10480 ft bit.
    // Closed: OD² / 1029.4. Open is reported and not used. No swab term.
    const result = poohFill(exampleB, STAND_FT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const closed = 5.5 ** 2 / 1029.4;
    const open = (5.5 ** 2 - 4.778 ** 2) / 1029.4;
    expect(result.pipeEnd).toBe("closed");
    expect(result.closedDisplacement_bblFt).toBeCloseTo(closed, 12);
    expect(result.openDisplacement_bblFt).toBeCloseTo(open, 12);
    expect(result.displacement_bblFt).toBeCloseTo(closed, 12);
    expect(result.fullStandCount).toBe(112);
    expect(result.partialStand_ft).toBeCloseTo(64, 6);
    expect(result.perStand_bbl).toBeCloseTo(closed * 93, 8);
    expect(result.stands).toHaveLength(113);
    expect(result.stands[0]).toMatchObject({ n: 1, length_ft: 93 });
    expect(result.stands[0].bbl).toBeCloseTo(closed * 93, 8);
    expect(result.stands[0].runningTotal_bbl).toBeCloseTo(result.stands[0].bbl, 8);
    expect(result.stands[111].n).toBe(112);
    expect(result.stands[111].length_ft).toBeCloseTo(93, 6);
    expect(result.stands[112].length_ft).toBeCloseTo(64, 6);
    expect(result.stands[112].bbl).toBeCloseTo(closed * 64, 8);
    expect(result.stands[112].runningTotal_bbl).toBeCloseTo(closed * 10480, 6);
    expect(result.total_bbl).toBeCloseTo(closed * 10480, 6);
    expect(JSON.stringify(result)).not.toContain("swab");
  });

  it("uses open-pipe metal displacement when the pipe end is open", () => {
    const job: Job = { ...exampleB, trip: { ...exampleB.trip, pipeEnd: "open" } };
    const result = poohFill(job, STAND_FT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const open = (5.5 ** 2 - 4.778 ** 2) / 1029.4;
    expect(result.displacement_bblFt).toBeCloseTo(open, 12);
    expect(result.total_bbl).toBeCloseTo(open * 10480, 6);
    expect(result.perStand_bbl).toBeCloseTo(open * 93, 8);
  });

  it.each([undefined, null, 0, -5] as const)("rejects stand length %s", (stand) => {
    const result = poohFill(exampleB, stand);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_STAND");
    expect(result.error.field).toBe("standLength_ft");
  });
});

describe("kpiVolumes", () => {
  it("returns every EXAMPLE B intermediate as a finite number", () => {
    const result = kpiVolumes(exampleB, { standLength_ft: STAND_FT, surfaceLine_bbl: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(finiteTree(result)).toBe(true);
    expect(result.masp.activeMwFluidId).toBe("mud");
    expect(result.masp.activeMw_ppg).toBe(11.4);
    expect(result.kmwInString.pillTopSource).toBe("annulus");
    expect(result.chase.surfaceLine_bbl).toBe(0);
  });

  it("keeps active mud weight on the surface fluid when the pill is heavier", () => {
    const heavier: Job = {
      ...exampleB,
      fluids: exampleB.fluids.map((fluid) =>
        fluid.id === "pill" ? { ...fluid, density_ppg: 18 } : fluid,
      ),
    };
    const result = kpiVolumes(heavier, { standLength_ft: STAND_FT });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.masp.activeMw_ppg).toBe(11.4);
    expect(result.masp.masp_psi).toBeCloseTo(1.2 * 0.052 * 8033, 6);
  });

  it("does not substitute the survey when anchor TVD is omitted", () => {
    const job: Job = { ...exampleB, well: { ...exampleB.well, anchorTvd_ft: undefined } };
    const result = kpiVolumes(job, { standLength_ft: STAND_FT });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "MISSING_ANCHOR_TVD",
        field: "well.anchorTvd_ft",
        message: "Anchor TVD is missing.",
      },
    });
  });

  it("rejects a job with no pill", () => {
    const job = exampleJob();
    job.column = [{ fluidId: "mud", topMd_ft: 0, bottomMd_ft: 10000 }];
    const result: KpiVolumesResult = kpiVolumes(job, { standLength_ft: STAND_FT });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MISSING_PILL");
  });
});
