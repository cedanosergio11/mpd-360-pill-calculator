import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exampleB } from "@/lib/example-b";
import { calculate as calculateAny } from "./calculate";
import { isTaperedRefusal } from "./job-support";
import { pillPlacement } from "./column";
import { pumpedPillBbl } from "./displacement";
import { exampleJob } from "./example-job";
import type { Job } from "./job.schema";
import type { DisplacementStage, Result } from "./result";
import { pumpOutput_bblPerStk, strokesSchedule, type StrokesScheduleRow } from "./strokes";

function calculate(job: Job): Result {
  const result = calculateAny(job);
  if (isTaperedRefusal(result)) throw new Error(result.code);
  return result;
}

interface ExpectedFile {
  pump: { bblPerStk: number; spm: number };
  rows: Array<{
    n: number;
    stage_bbl: number;
    cum_bbl: number;
    strokes: number;
    cumStrokes: number;
    min: number;
  }>;
}

const exampleBExpected: ExpectedFile = JSON.parse(
  readFileSync(new URL("./fixtures/strokes-example-b.expected.json", import.meta.url), "utf8"),
);

const PUMP = { linerIn: 6, strokeIn: 12, efficiency: 0.97, spm: 40 };

function withPump(job: Job, pump: Job["pump"]): Job {
  return { ...job, pump };
}

function assertFiniteRow(row: StrokesScheduleRow, minutesNull: boolean) {
  expect(Number.isFinite(row.stage_bbl)).toBe(true);
  expect(Number.isFinite(row.cum_bbl)).toBe(true);
  expect(Number.isFinite(row.strokes)).toBe(true);
  expect(Number.isFinite(row.cumStrokes)).toBe(true);
  expect(Number.isFinite(row.n)).toBe(true);
  if (minutesNull) {
    expect(row.minutes).toBeNull();
    expect(row.cumMinutes).toBeNull();
  } else {
    expect(Number.isFinite(row.minutes)).toBe(true);
    expect(Number.isFinite(row.cumMinutes)).toBe(true);
  }
}

describe("pumpOutput_bblPerStk", () => {
  it("matches the triplex formula for a 6 in liner, 12 in stroke, 0.97 efficiency", () => {
    // 0.000243 * 6^2 * 12 * 0.97 = 0.10182672, which rounds to 0.101827.
    const output = pumpOutput_bblPerStk({ linerIn: 6, strokeIn: 12, efficiency: 0.97 });
    expect(output.ok).toBe(true);
    if (!output.ok) return;
    expect(output.bblPerStk).toBeCloseTo(0.000243 * 36 * 12 * 0.97, 12);
    expect(output.bblPerStk).toBeCloseTo(exampleBExpected.pump.bblPerStk, 6);
  });

  it("accepts an efficiency of exactly 1", () => {
    const output = pumpOutput_bblPerStk({ linerIn: 6, strokeIn: 12, efficiency: 1 });
    expect(output).toEqual({ ok: true, bblPerStk: 0.000243 * 36 * 12 });
  });

  it("rejects efficiency entered as 97 and does not divide by 100", () => {
    const error = {
      code: "INVALID_PUMP" as const,
      field: "pump.efficiency",
      message: "Efficiency must be a fraction (enter as fraction, e.g. 0.97).",
    };
    expect(pumpOutput_bblPerStk({ linerIn: 6, strokeIn: 12, efficiency: 97 })).toEqual({
      ok: false,
      error,
    });
    const schedule = strokesSchedule(withPump(exampleJob(), { ...PUMP, efficiency: 97 }), {
      displacement: calculate(exampleJob()).displacement,
    });
    expect(schedule).toEqual({ ok: false, error });
  });

  it.each([
    ["liner", { strokeIn: 12, efficiency: 0.97 }, "pump.linerIn", "Liner size is blank."],
    ["stroke", { linerIn: 6, efficiency: 0.97 }, "pump.strokeIn", "Stroke length is blank."],
    ["efficiency", { linerIn: 6, strokeIn: 12 }, "pump.efficiency", "Efficiency is blank."],
  ] as const)("rejects a blank %s", (_name, input, field, message) => {
    const output = pumpOutput_bblPerStk(input);
    expect(output).toEqual({ ok: false, error: { code: "INVALID_PUMP", field, message } });
  });

  it.each([
    ["liner 0", { linerIn: 0, strokeIn: 12, efficiency: 0.97 }, "pump.linerIn"],
    ["stroke 0", { linerIn: 6, strokeIn: 0, efficiency: 0.97 }, "pump.strokeIn"],
    ["liner null", { linerIn: null, strokeIn: 12, efficiency: 0.97 }, "pump.linerIn"],
    ["stroke null", { linerIn: 6, strokeIn: null, efficiency: 0.97 }, "pump.strokeIn"],
    ["efficiency null", { linerIn: 6, strokeIn: 12, efficiency: null }, "pump.efficiency"],
    ["efficiency 0", { linerIn: 6, strokeIn: 12, efficiency: 0 }, "pump.efficiency"],
    ["liner NaN", { linerIn: Number.NaN, strokeIn: 12, efficiency: 0.97 }, "pump.linerIn"],
    [
      "stroke Infinity",
      { linerIn: 6, strokeIn: Number.POSITIVE_INFINITY, efficiency: 0.97 },
      "pump.strokeIn",
    ],
  ] as const)("rejects %s without returning NaN or Infinity", (_name, input, field) => {
    const output = pumpOutput_bblPerStk(input);
    expect(output.ok).toBe(false);
    if (output.ok) return;
    expect(output.error.code).toBe("INVALID_PUMP");
    expect(output.error.field).toBe(field);
    expect(JSON.stringify(output)).not.toContain("null");
    expect(Number.isFinite((output as { bblPerStk?: number }).bblPerStk ?? 1)).toBe(true);
  });
});

describe("strokesSchedule", () => {
  it("schedules EXAMPLE B from core pumped_bbl against the fixture", () => {
    // Stage 2 covers 10480 - 8060 = 2420 ft of pill.
    // pumped_bbl = 2420 * 4.778^2 / 1029.4. Stages 0 and 1 have not entered the pill.
    const job = withPump(exampleB, PUMP);
    const schedule = strokesSchedule(job, calculate(job));
    expect(schedule.ok).toBe(true);
    if (!schedule.ok) return;
    expect(schedule.bblPerStk).toBeCloseTo(exampleBExpected.pump.bblPerStk, 6);
    expect(schedule.rows).toHaveLength(exampleBExpected.rows.length);
    for (const expected of exampleBExpected.rows) {
      const row = schedule.rows[expected.n];
      expect(row.n).toBe(expected.n);
      expect(row.label).toBe(`Stage ${expected.n}`);
      if (expected.n < 2) {
        expect(row.stage_bbl).toBe(0);
        expect(row.cum_bbl).toBe(0);
        expect(row.strokes).toBe(0);
        expect(row.cumStrokes).toBe(0);
        expect(row.minutes).toBe(0);
        expect(row.cumMinutes).toBe(0);
      } else {
        expect(row.stage_bbl).toBeCloseTo(expected.stage_bbl, 2);
        expect(row.cum_bbl).toBeCloseTo(expected.cum_bbl, 2);
        expect(Math.abs(row.strokes - expected.strokes)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(row.cumStrokes - expected.cumStrokes)).toBeLessThanOrEqual(0.1);
        expect(row.minutes).toBeCloseTo(13.1766, 4);
        expect(row.cumMinutes).toBeCloseTo(13.1766, 4);
      }
      assertFiniteRow(row, false);
    }
  });

  it("sums two nonzero pumping stages from pumpedPillBbl", () => {
    // exampleJob pill 7000–9000 ft, string ID 4.276 in.
    // Capacity 4.276^2 / 1029.4 bbl/ft. Bit 8000 covers 1000 ft; bit 9000 covers 2000 ft.
    // Each increment is that capacity × 1000 ft. Strokes = stage bbl / 0.000243 / 36 / 12 / 0.97.
    const job = withPump(exampleJob(), PUMP);
    const placed = pillPlacement(job);
    expect(placed?.pill).not.toBeNull();
    const pill = placed!.pill!;
    const at8000 = pumpedPillBbl(job, pill, 8000);
    const at9000 = pumpedPillBbl(job, pill, 9000);
    expect(at8000).not.toBeNull();
    expect(at9000).not.toBeNull();
    const cap = job.well.stringId_in ** 2 / 1029.4;
    expect(at8000).toBeCloseTo(1000 * cap, 9);
    expect(at9000).toBeCloseTo(2000 * cap, 9);

    const template = calculate(job).displacement.stages[0];
    const stage = (n: number, bitMd_ft: number, pumped_bbl: number): DisplacementStage => ({
      ...template,
      n,
      bitMd_ft,
      pumped_bbl,
    });
    const schedule = strokesSchedule(job, {
      displacement: {
        ...calculate(job).displacement,
        stages: [stage(0, 8000, at8000!), stage(1, 9000, at9000!)],
      },
    });
    expect(schedule.ok).toBe(true);
    if (!schedule.ok) return;

    const bblPerStk = 0.000243 * 6 ** 2 * 12 * 0.97;
    const stageBbl = 1000 * cap;
    const stageStrokes = stageBbl / bblPerStk;
    expect(schedule.rows[0].stage_bbl).toBeCloseTo(stageBbl, 9);
    expect(schedule.rows[0].strokes).toBeCloseTo(stageStrokes, 9);
    expect(schedule.rows[0].cumStrokes).toBeCloseTo(stageStrokes, 9);
    expect(schedule.rows[0].cum_bbl).toBeCloseTo(stageBbl, 9);
    expect(schedule.rows[0].minutes).toBeCloseTo(4.3608, 4);
    expect(schedule.rows[0].cumMinutes).toBeCloseTo(4.3608, 4);
    expect(schedule.rows[0].minutes).toBeCloseTo(stageStrokes / 40, 9);
    expect(schedule.rows[0].cumMinutes).toBeCloseTo(stageStrokes / 40, 9);
    expect(schedule.rows[1].stage_bbl).toBeCloseTo(stageBbl, 9);
    expect(schedule.rows[1].cum_bbl).toBeCloseTo(2 * stageBbl, 9);
    expect(schedule.rows[1].strokes).toBeCloseTo(stageStrokes, 9);
    expect(schedule.rows[1].cumStrokes).toBeCloseTo(
      schedule.rows[0].strokes + schedule.rows[1].strokes,
      9,
    );
    expect(schedule.rows[1].minutes).toBeCloseTo(4.3608, 4);
    expect(schedule.rows[1].cumMinutes).toBeCloseTo(8.7217, 4);
    expect(schedule.rows[1].minutes).toBeCloseTo(stageStrokes / 40, 9);
    expect(schedule.rows[1].cumMinutes).toBeCloseTo((2 * stageStrokes) / 40, 9);
    expect(schedule.rows[0].stage_bbl).toBeGreaterThan(0);
    expect(schedule.rows[1].stage_bbl).toBeGreaterThan(0);
    for (const row of schedule.rows) assertFiniteRow(row, false);
  });

  it("returns MISSING_PUMP when the job has no pump", () => {
    const schedule = strokesSchedule(exampleJob(), calculate(exampleJob()));
    expect(schedule).toEqual({
      ok: false,
      error: { code: "MISSING_PUMP", field: "pump", message: "Pump inputs are missing." },
    });
  });

  it("uses a direct bbl/stk override and ignores omitted liner fields", () => {
    const job = withPump(exampleJob(), { bblPerStk: 0.25, spm: 40 });
    const schedule = strokesSchedule(job, calculate(job));
    expect(schedule.ok).toBe(true);
    if (!schedule.ok) return;
    expect(schedule.bblPerStk).toBe(0.25);
  });

  it("rejects an explicit 0 bbl/stk override instead of falling through", () => {
    const job = withPump(exampleJob(), { ...PUMP, bblPerStk: 0 });
    const schedule = strokesSchedule(job, calculate(job));
    expect(schedule).toEqual({
      ok: false,
      error: {
        code: "INVALID_PUMP",
        field: "pump.bblPerStk",
        message: "bbl/stk must be a finite number greater than 0.",
      },
    });
  });

  it("rejects a present invalid liner even when the override is valid", () => {
    const job = withPump(exampleJob(), { linerIn: 0, bblPerStk: 0.2, spm: 40 });
    const schedule = strokesSchedule(job, calculate(job));
    expect(schedule.ok).toBe(false);
    if (schedule.ok || !("error" in schedule)) return;
    expect(schedule.error).toEqual({
      code: "INVALID_PUMP",
      field: "pump.linerIn",
      message: "Liner size must be a finite number greater than 0.",
    });
  });

  it.each([0, null, undefined] as const)("leaves minutes null when SPM is %s", (spm) => {
    const job = withPump(exampleB, { ...PUMP, spm });
    const schedule = strokesSchedule(job, calculate(job));
    expect(schedule.ok).toBe(true);
    if (!schedule.ok) return;
    expect(schedule.rows.every((row) => row.minutes === null && row.cumMinutes === null)).toBe(
      true,
    );
    for (const row of schedule.rows) assertFiniteRow(row, true);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1] as const)(
    "rejects non-finite or negative SPM %s",
    (spm) => {
      const job = withPump(exampleJob(), { ...PUMP, spm });
      const schedule = strokesSchedule(job, calculate(job));
      expect(schedule.ok).toBe(false);
      if (schedule.ok || !("error" in schedule)) return;
      expect(schedule.error.code).toBe("INVALID_PUMP");
      expect(schedule.error.field).toBe("pump.spm");
    },
  );

  it("rejects a null pumped volume", () => {
    const job = withPump(exampleJob(), PUMP);
    const result = calculate(job);
    result.displacement.stages[1].pumped_bbl = null;
    const schedule = strokesSchedule(job, result);
    expect(schedule).toEqual({
      ok: false,
      error: {
        code: "INVALID_STAGE",
        field: "displacement.stages[1].pumped_bbl",
        message: "Stage 1 pumped volume is missing.",
      },
    });
  });
});
