import { afterEach, describe, expect, it } from "vitest";
import { exampleB, exampleC } from "@/lib/example-b";
import { exampleJob } from "@/lib/example-job";
import { useStore } from "@/lib/store";
import { calculate } from "./calculate";
import { buildDisplacement, rihStageCount } from "./displacement";
import { emwProfile } from "./emw-profile";
import type { Issue } from "./issues";
import type { Job } from "./job.schema";
import {
  DEPTH_BEYOND_TD,
  isCalcRefusal,
  jobSupport,
  TAPERED_STRING_UNSUPPORTED,
  type TaperedStringRefusal,
} from "./job-support";
import { chaseVolume, kmwBackfill, kmwInString, kpiVolumes, poohFill } from "./kpi";
import { applyPaste, type PastePreview } from "./paste";
import { jobLabel, loadPreset, markEdited, resetToPreset, restoreSaved } from "./preset";
import type { Result } from "./result";
import { canSimulate } from "./simulate";
import { strokesSchedule } from "./strokes";
import { buildTripSchedule } from "./trip-schedule";

const REFUSAL: TaperedStringRefusal = { ok: false, code: TAPERED_STRING_UNSUPPORTED };

function restoredD(): Job {
  const input = structuredClone(exampleC);
  input.name = "EXAMPLE D (tapered)";
  input.meta = { presetId: "D", isExample: true, modified: false };
  Object.assign(input.well, {
    stringSections: [
      { length_ft: 8480, od_in: 5.5, id_in: 4.778 },
      { length_ft: 2000, od_in: 4, id_in: 3.34 },
    ],
  });
  const restored = restoreSaved(input);
  if (!restored || restored.ok) throw new Error("expected a tapered save");
  expect(restored).toEqual({ ok: false, code: TAPERED_STRING_UNSUPPORTED, saved: input });
  return input;
}

function expectNoNumbers(result: unknown) {
  expect(result).toEqual(REFUSAL);
  expect(JSON.stringify(result)).not.toMatch(/\d/);
}

const blankPaste: PastePreview = { rows: [], errors: [], canApply: true };

describe("jobSupport on a restored D save", () => {
  afterEach(() => {
    useStore.getState().replace(structuredClone(exampleJob));
  });

  it("uses the same geometry check as canSimulate and still labels EXAMPLE D", () => {
    const job = restoredD();
    const support = jobSupport(job);
    const gate = canSimulate(job);
    expect(gate.ok).toBe(false);
    if (support.ok || gate.ok) return;
    expect(support).toEqual({ ok: false, code: TAPERED_STRING_UNSUPPORTED, reason: gate.reason });
    expect(jobLabel(job)).toBe("EXAMPLE D");
  });

  it.each([
    ["calculate", (job: Job) => calculate(job)],
    ["kpiVolumes", (job: Job) => kpiVolumes(job)],
    ["chaseVolume", (job: Job) => chaseVolume(job)],
    ["kmwInString", (job: Job) => kmwInString(job)],
    ["kmwBackfill", (job: Job) => kmwBackfill(job)],
    ["poohFill", (job: Job) => poohFill(job)],
    ["emwProfile", (job: Job) => emwProfile(job)],
    [
      "strokesSchedule",
      (job: Job) =>
        strokesSchedule(job, { displacement: { stages: [] } } as unknown as Pick<Result, "displacement">),
    ],
    [
      "buildDisplacement",
      (job: Job) => {
        const issues: Issue[] = [];
        const result = buildDisplacement(job, issues);
        expect(issues).toEqual([]);
        return result;
      },
    ],
    [
      "buildTripSchedule",
      (job: Job) => {
        const issues: Issue[] = [];
        const result = buildTripSchedule(job, null, null, [], issues);
        expect(issues).toEqual([]);
        return result;
      },
    ],
  ] as const)("%s returns TAPERED_STRING_UNSUPPORTED and no numbers", (_name, run) => {
    expectNoNumbers(run(restoredD()));
  });

  it.each([
    ["applyPaste", (job: Job) => applyPaste(job, blankPaste)],
    ["markEdited", (job: Job) => markEdited(job)],
    ["resetToPreset", (job: Job) => resetToPreset(job)],
  ] as const)("%s throws TAPERED_STRING_UNSUPPORTED and leaves the job", (_name, run) => {
    const job = restoredD();
    const snapshot = structuredClone(job);
    let thrown: unknown;
    try {
      run(job);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: TAPERED_STRING_UNSUPPORTED });
    expect(job).toEqual(snapshot);
  });

  it("a setPath input edit does not change the tapered job", () => {
    const job = restoredD();
    useStore.getState().replace(job);
    const before = structuredClone(useStore.getState().job);
    useStore.getState().set("name", "should not land");
    useStore.getState().set("well.stringOd_in", 9);
    expect(useStore.getState().job).toEqual(before);
    expect(useStore.getState().result).toBeNull();
  });

  it.each(["B", "C"] as const)("EXAMPLE %s stays supported", (id) => {
    const job = loadPreset(id);
    expect(jobSupport(job)).toEqual({ ok: true });
    const result = calculate(job);
    expect(isCalcRefusal(result)).toBe(false);
    if (isCalcRefusal(result)) return;
    expect(result.depths.shoe.esd_ppg).toEqual(expect.any(Number));
    expect(kpiVolumes(job).ok).toBe(true);
    expect(emwProfile(job).ok).toBe(true);
    expect(strokesSchedule(job, result).ok).toBe(true);
    const edited = markEdited(job);
    expect(edited.meta).toEqual({ presetId: id, isExample: false, modified: true });
    expect(job.meta).toEqual({ presetId: id, isExample: true, modified: false });
  });
});

describe("depth beyond TD", () => {
  function restoredShallowBit(): Job {
    const input = structuredClone(exampleB);
    input.well.bitMd_ft = 9000;
    const restored = restoreSaved(input);
    if (!restored?.ok) throw new Error("expected a single-string restore");
    return restored.job;
  }

  it("jobSupport lists the fields on a restored save and calcs return no numbers", () => {
    const job = restoredShallowBit();
    expect(jobSupport(job)).toEqual({
      ok: false,
      code: DEPTH_BEYOND_TD,
      fields: [
        { field: "well.anchorMd_ft", value: 10480, limit: 9000, limitField: "well.bitMd_ft" },
        { field: "well.anchorTvd_ft", value: 10466, limit: 9000, limitField: "well.bitMd_ft" },
        { field: "column[1].bottomMd_ft", value: 10480, limit: 9000, limitField: "well.bitMd_ft" },
      ],
    });
    for (const result of [calculate(job), kpiVolumes(job), emwProfile(job), chaseVolume(job), kmwInString(job), kmwBackfill(job), poohFill(job)]) {
      expect(result).toEqual({ ok: false, code: DEPTH_BEYOND_TD });
      expect(JSON.stringify(result)).not.toMatch(/\d/);
    }
  });

  it("lists the bit when bit MD is deeper than TD", () => {
    const job = structuredClone(exampleB);
    job.well.bitMd_ft = 10600;
    expect(jobSupport(job)).toEqual({
      ok: false,
      code: DEPTH_BEYOND_TD,
      fields: [{ field: "well.bitMd_ft", value: 10600, limit: 10530, limitField: "well.mdTd_ft" }],
    });
    expect(calculate(job)).toEqual({ ok: false, code: DEPTH_BEYOND_TD });
  });

  it("returns NO_PIPE_BELOW_BIT instead of a bare null when the pill is below the bit", () => {
    const job = structuredClone(exampleB);
    job.well.bitMd_ft = 9000;
    expect(rihStageCount(job)).toEqual({ stages: null, reason: "NO_PIPE_BELOW_BIT" });
    const counted = rihStageCount(exampleB);
    expect(counted.stages).toEqual(expect.any(Number));
    expect(counted).not.toHaveProperty("reason");
  });
});
