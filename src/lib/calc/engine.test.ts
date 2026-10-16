import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { buildSchedule } from "./schedule";
import { EXAMPLE_1, EXAMPLE_2, EXAMPLE_3, EXAMPLE_SHALLOW } from "./examples";
import { round } from "../utils";

describe("calculate — EXAMPLE 1", () => {
  const r = calculate(EXAMPLE_1);

  it("locks workbook MASP / static / volumes", () => {
    expect(round(r.masp, 1)).toBe(1192.7);
    expect(round(r.staticStrippingPressure, 3)).toBe(619.424);
    expect(round(r.drillStringVolAtSpot, 0)).toBe(166);
    expect(r.heightPillNoDp).toBe(3730);
    expect(r.totalPillVol).toBe(170);
    expect(r.correctedPillVol).toBe(96);
    expect(r.kwmPlusChase).toBe(263);
    expect(r.topOfPillNoDp).toBe(7951);
    expect(round(r.pressureDifferential, 1)).toBe(241.6);
    expect(r.procedurePossible).toBe(true);
    expect(round(r.slugPillVol, 1)).toBe(111);
  });

  it("builds a spotting schedule", () => {
    const sched = buildSchedule(EXAMPLE_1, r, "noSlug");
    expect(sched.rows.length).toBeGreaterThanOrEqual(6);
    expect(sched.rows[0].volume).toBe(166);
    expect(Math.round(sched.rows[0].flow)).toBe(242);
    expect(sched.finalVolume).toBe(263);
    const last = sched.rows.at(-1);
    expect(last?.volume).toBe(263);
    expect(sched.rows.find((row) => row.density === 15.3)).toBeTruthy();
  });
});

describe("calculate — shallow snapshot", () => {
  it("matches the workbook shallow check", () => {
    const shallow = calculate(EXAMPLE_SHALLOW);
    expect(shallow.heightPillNoDp).toBe(2300);
    expect(round(shallow.correctedPillVol, 0)).toBe(70);
    expect(round(shallow.totalPillVol, 0)).toBe(106);
  });
});

describe("calculate — EXAMPLE 2 at 17.4 EMW", () => {
  const example2 = calculate(EXAMPLE_2);

  it("locks procedure volumes", () => {
    expect(round(example2.masp, 1)).toBe(965.0);
    expect(example2.heightPillNoDp).toBe(7810);
    expect(example2.totalPillVol).toBe(358);
    expect(example2.correctedChase).toBe(0);
    expect(example2.drillStringVolAtSpot).toBe(153);
    expect(example2.topOfPillNoDp).toBe(3717);
    expect(round(example2.finalKwm, 0)).toBe(153);
    expect(example2.correctedPillVol).toBe(204);
    expect(example2.spottedKmwVol).toBe(example2.correctedPillVol + example2.finalKwm);
    expect(example2.bblBackfill).toBe(0);
    expect(example2.kmwRoomWithPipe).toBe(455);
  });

  it("locks oilfield capacities", () => {
    expect(round(example2.annularCap, 6)).toBe(0.026311);
    expect(round(example2.drillStringCap, 6)).toBe(0.013299);
  });

  it("locks equalize dump / extra EMW to 2 decimals", () => {
    expect(round(example2.equalizeDumpBbl, 2)).toBe(7.39);
    expect(round(example2.addPpgTarget, 2)).toBe(0.08);
    expect(round(example2.anchorPointEsd, 2)).toBe(17.48);
    expect(round(example2.remainingKmwInDp, 2)).toBe(145.61);
  });
});

describe("calculate — EXAMPLE 2 at 18.0 ppge", () => {
  it("needs 460, fits 455, backfill 5", () => {
    const tight = calculate({ ...EXAMPLE_2, wellName: "Backfill check", desiredEmw: 18 });
    expect(tight.totalPillVol).toBe(460);
    expect(tight.kmwRoomWithPipe).toBe(455);
    expect(tight.bblBackfill).toBe(5);
    expect(tight.spottedKmwVol).toBe(455);
    expect(round(tight.equalizeDumpBbl, 2)).toBe(2.62);
    expect(round(tight.addPpgTarget, 2)).toBe(0.03);
    expect(round(tight.anchorPointEsd, 2)).toBe(18.03);
    expect(round(tight.remainingKmwInDp, 2)).toBe(150.38);
  });
});

describe("calculate — EXAMPLE 3 MASP at shoe", () => {
  it("uses casing TVD, not anchor TVD", () => {
    const r = calculate(EXAMPLE_3);
    expect(round(r.masp, 1)).toBe(1244.1);
  });
});
