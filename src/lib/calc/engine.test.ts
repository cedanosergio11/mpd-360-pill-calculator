import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { buildSchedule } from "./schedule";
import { AUBURNIA, EXAMPLE_SHALLOW, MOMENTUM } from "./examples";
import { round } from "../utils";

describe("calculate — Auburnia", () => {
  const r = calculate(AUBURNIA);

  it("locks workbook MASP / static / volumes", () => {
    expect(round(r.masp, 1)).toBe(1362.7);
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
    const sched = buildSchedule(AUBURNIA, r, "noSlug");
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

describe("calculate — Momentum 17.4 EMW", () => {
  const momentum = calculate(MOMENTUM);

  it("locks procedure volumes", () => {
    expect(round(momentum.masp, 1)).toBe(1112.7);
    expect(momentum.heightPillNoDp).toBe(7810);
    expect(momentum.totalPillVol).toBe(358);
    expect(momentum.correctedChase).toBe(0);
    expect(momentum.drillStringVolAtSpot).toBe(153);
    expect(momentum.topOfPillNoDp).toBe(3717);
    expect(round(momentum.finalKwm, 0)).toBe(153);
    expect(momentum.correctedPillVol).toBe(204);
    expect(momentum.spottedKmwVol).toBe(momentum.correctedPillVol + momentum.finalKwm);
    expect(momentum.bblBackfill).toBe(0);
    expect(momentum.kmwRoomWithPipe).toBe(455);
  });

  it("locks oilfield capacities", () => {
    expect(round(momentum.annularCap, 6)).toBe(0.026311);
    expect(round(momentum.drillStringCap, 6)).toBe(0.013299);
  });

  it("locks equalize dump / extra EMW to 2 decimals", () => {
    expect(round(momentum.equalizeDumpBbl, 2)).toBe(7.39);
    expect(round(momentum.addPpgTarget, 2)).toBe(0.08);
    expect(round(momentum.anchorPointEsd, 2)).toBe(17.48);
    expect(round(momentum.remainingKmwInDp, 2)).toBe(145.61);
  });
});

describe("calculate — Momentum 18.0 ppge", () => {
  it("needs 460, fits 455, backfill 5", () => {
    const tight = calculate({ ...MOMENTUM, wellName: "Backfill check", desiredEmw: 18 });
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
