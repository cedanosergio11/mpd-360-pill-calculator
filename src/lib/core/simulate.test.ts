import { describe, expect, it } from "vitest";
import { exampleB, exampleC } from "@/lib/example-b";
import { columnDisplacedByPipe, pillPlacement } from "./column";
import { emwProfile, type EmwLines, type EmwProfileResult } from "./emw-profile";
import type { Job } from "./job.schema";
import { kpiVolumes } from "./kpi";
import { markEdited } from "./preset";
import {
  canSimulate,
  DEFAULT_STEP_FT,
  MAX_STEPS,
  MIN_STEP_FT,
  simulate,
  type SimulateFluidResult,
  type SimulateResult,
  type SimulateStep,
} from "./simulate";
import { tvdAt } from "./tvd";

const JOBS = [exampleB, exampleC] as const;

/** EXAMPLE D geometry from tapered strings. Not a Well field until #6. */
function exampleDJob(): Job {
  const job = structuredClone(exampleC);
  job.name = "EXAMPLE D (tapered)";
  Object.assign(job.well, {
    stringSections: [
      { length_ft: 8480, od_in: 5.5, id_in: 4.778 },
      { length_ft: 2000, od_in: 4, id_in: 3.34 },
    ],
  });
  return job;
}

type StringGeometry = { sections: unknown[]; crossovers: unknown[] };

function withString<T>(value: T): T & StringGeometry {
  return value as T & StringGeometry;
}
const LINES = ["static", "staticSbp", "ecd"] as const;

function okSim(result: SimulateResult): Extract<SimulateResult, { ok: true }> {
  if (!result.ok) {
    const detail = "message" in result.error ? result.error.message : result.error.code;
    throw new Error(detail);
  }
  return result;
}

function near(actual: number | null, expected: number | null, tol: number, label: string) {
  if (actual == null || expected == null) {
    expect(actual, label).toBe(expected);
    return;
  }
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(tol);
}

function pointAt(points: { md_ft: number; emw_ppg: number }[], md: number) {
  return points.find((point) => Math.abs(point.md_ft - md) <= 0.5);
}

function expectLinesAt(actual: EmwLines, expected: EmwLines, mds: number[], label: string) {
  for (const name of LINES) {
    for (const md of mds) {
      const left = pointAt(actual[name], md);
      const right = pointAt(expected[name], md);
      expect(left, `${label} ${name} ${md}`).toBeTruthy();
      expect(right, `${label} ${name} ${md}`).toBeTruthy();
      near(left?.emw_ppg ?? null, right?.emw_ppg ?? null, 1e-6, `${label} ${name} ${md}`);
    }
  }
}

function expectFullLines(actual: EmwLines, expected: EmwLines, label: string) {
  for (const name of LINES) {
    expect(actual[name].length, label).toBe(expected[name].length);
    for (let i = 0; i < actual[name].length; i++) {
      near(actual[name][i].md_ft, expected[name][i].md_ft, 1e-6, `${label} ${name} md`);
      near(actual[name][i].emw_ppg, expected[name][i].emw_ppg, 1e-6, `${label} ${name} emw`);
    }
  }
}

function okFluid(fluid: SimulateFluidResult, where: string): Extract<SimulateFluidResult, { ok: true }> {
  if (!fluid.ok) throw new Error(`${where}: ${fluid.error.message}`);
  return fluid;
}

function expectFluid(left: SimulateFluidResult, right: SimulateFluidResult, label: string) {
  const a = okFluid(left, label);
  const b = okFluid(right, label);
  expect(a.label, label).toBe(b.label);
  expectFullLines(a.lines, b.lines, label);
  expect(a.stations.length, label).toBe(b.stations.length);
  for (let i = 0; i < a.stations.length; i++) {
    expect(a.stations[i].label, label).toBe(b.stations[i].label);
    for (const name of LINES) {
      near(a.stations[i].emw[name], b.stations[i].emw[name], 1e-6, `${label} station ${name}`);
    }
  }
  expect(a.shoeCheck.length, label).toBe(b.shoeCheck.length);
  for (let i = 0; i < a.shoeCheck.length; i++) {
    expect(a.shoeCheck[i].line, label).toBe(b.shoeCheck[i].line);
    expect(a.shoeCheck[i].pillState, label).toBe(b.shoeCheck[i].pillState);
    near(a.shoeCheck[i].emw_ppg, b.shoeCheck[i].emw_ppg, 1e-6, `${label} shoe emw`);
    near(a.shoeCheck[i].margin_ppg, b.shoeCheck[i].margin_ppg, 1e-6, `${label} shoe margin ppg`);
    near(a.shoeCheck[i].margin_psi, b.shoeCheck[i].margin_psi, 1e-4, `${label} shoe margin psi`);
  }
}

function okEmw(emw: EmwProfileResult, where: string): Extract<EmwProfileResult, { ok: true }> {
  if (!emw.ok) throw new Error(`${where}: ${emw.error.message}`);
  return emw;
}

function expectProfile(left: EmwProfileResult, right: EmwProfileResult, label: string) {
  const a = okEmw(left, label);
  const b = okEmw(right, label);
  expect(a.inPlace.label, label).toBe(b.inPlace.label);
  expect(a.spotted.label, label).toBe(b.spotted.label);
  expectFullLines(a.inPlace.lines, b.inPlace.lines, `${label} inPlace`);
  expectFullLines(a.spotted.lines, b.spotted.lines, `${label} spotted`);
  expect(a.limits, label).toEqual(b.limits);
  expect(a.stations.length, label).toBe(b.stations.length);
  for (let i = 0; i < a.stations.length; i++) {
    expect(a.stations[i].label, label).toBe(b.stations[i].label);
    for (const name of LINES) {
      near(a.stations[i].emw.inPlace[name], b.stations[i].emw.inPlace[name], 1e-6, `${label} station inPlace ${name}`);
      near(a.stations[i].emw.spotted[name], b.stations[i].emw.spotted[name], 1e-6, `${label} station spotted ${name}`);
    }
  }
  expect(a.shoeCheck.length, label).toBe(b.shoeCheck.length);
  for (let i = 0; i < a.shoeCheck.length; i++) {
    expect(a.shoeCheck[i].line, label).toBe(b.shoeCheck[i].line);
    expect(a.shoeCheck[i].pillState, label).toBe(b.shoeCheck[i].pillState);
    near(a.shoeCheck[i].emw_ppg, b.shoeCheck[i].emw_ppg, 1e-6, `${label} shoe emw`);
    near(a.shoeCheck[i].margin_ppg, b.shoeCheck[i].margin_ppg, 1e-6, `${label} shoe margin ppg`);
    near(a.shoeCheck[i].margin_psi, b.shoeCheck[i].margin_psi, 1e-4, `${label} shoe margin psi`);
  }
}

function expectPipeFields(left: SimulateStep, right: SimulateStep, label: string) {
  near(left.chase_bbl, right.chase_bbl, 1e-6, `${label} chase`);
  near(left.stringCapacity_bbl, right.stringCapacity_bbl, 1e-6, `${label} string`);
  near(left.kmwInString_bbl, right.kmwInString_bbl, 1e-6, `${label} kmw`);
  near(left.pillTop.md_ft, right.pillTop.md_ft, 1e-4, `${label} pill top md`);
  near(left.pillTop.tvd_ft, right.pillTop.tvd_ft, 1e-4, `${label} pill top tvd`);
  near(left.pillBottom.md_ft, right.pillBottom.md_ft, 1e-4, `${label} pill bottom md`);
  near(left.pillBottom.tvd_ft, right.pillBottom.tvd_ft, 1e-4, `${label} pill bottom tvd`);
  expectProfile(left.spotted, right.spotted, `${label} spotted`);
}

function mdGrid(bit: number, step = 80): number[] {
  const grid: number[] = [];
  for (let md = 0; md <= bit + 1e-9; md += step) grid.push(md);
  if (!grid.some((md) => Math.abs(md - bit) <= 1e-6)) grid.push(bit);
  return grid;
}

const fullWalk = new Map<Job, Extract<SimulateResult, { ok: true }>>();
function defaultSim(job: Job) {
  const hit = fullWalk.get(job);
  if (hit) return hit;
  const sim = okSim(simulate(job));
  fullWalk.set(job, sim);
  return sim;
}

function expectTaperRefusal(job: Job) {
  const gate = canSimulate(job);
  expect(gate.ok).toBe(false);
  if (!gate.ok) expect(gate.reason?.length).toBeGreaterThan(0);
  const result = simulate(job);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error).toEqual({ code: "SIM_REQUIRES_TAPERED", presetId: "D" });
  expect(result).not.toHaveProperty("steps");
}

describe("canSimulate", () => {
  it("refuses EXAMPLE D geometry", () => {
    const job = exampleDJob();
    job.meta = { presetId: "D", isExample: true, modified: false };
    expect((job.well as { stringSections?: unknown[] }).stringSections).toHaveLength(2);
    expectTaperRefusal(job);
  });

  it("refuses EXAMPLE D after markEdited", () => {
    const job = exampleDJob();
    job.meta = { presetId: "D", isExample: true, modified: false };
    const edited = markEdited(job);
    expect(edited.meta).toEqual({ presetId: "D", isExample: false, modified: true });
    expect((edited.well as { stringSections?: unknown[] }).stringSections).toHaveLength(2);
    expectTaperRefusal(edited);
  });

  it("refuses D geometry with meta stripped", () => {
    const stripped = exampleDJob();
    delete stripped.meta;
    expect(stripped.meta).toBeUndefined();
    expectTaperRefusal(stripped);

    const legacy = exampleDJob();
    legacy.meta = { presetId: null, isExample: false, modified: true };
    expectTaperRefusal(legacy);
  });

  it("refuses a crossover depth on a single OD", () => {
    const job = structuredClone(exampleB);
    Object.assign(job.well, { crossovers: [{ md_ft: 8480, tvd_ft: 8466 }] });
    expect(canSimulate(job)).toEqual({
      ok: false,
      reason: "The drill string has a crossover depth.",
    });
    expectTaperRefusal(job);
  });

  it("refuses two sections that share one OD and ID", () => {
    const job = structuredClone(exampleB);
    Object.assign(job.well, {
      stringSections: [
        { length_ft: 8480, od_in: job.well.stringOd_in, id_in: job.well.stringId_in },
        { length_ft: 2000, od_in: job.well.stringOd_in, id_in: job.well.stringId_in },
      ],
    });
    expect(canSimulate(job)).toEqual({
      ok: false,
      reason: "The drill string has more than one section.",
    });
    expectTaperRefusal(job);
  });

  it("refuses an OD or ID change along one section", () => {
    const job = structuredClone(exampleB);
    Object.assign(job.well, {
      stringSections: [{ length_ft: job.well.bitMd_ft, od_in: 4, id_in: 3.34 }],
    });
    expect(canSimulate(job)).toEqual({
      ok: false,
      reason: "The drill string changes OD or ID along its length.",
    });
    expectTaperRefusal(job);
  });

  it("does not refuse a single string when presetId is D", () => {
    const job = structuredClone(exampleB);
    job.meta = { presetId: "D", isExample: true, modified: false };
    expect(canSimulate(job)).toEqual({ ok: true });
    const result = simulate(job, { mds: [job.well.bitMd_ft], fromMd_ft: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toHaveLength(1);
  });

  it.each(JOBS)("still simulates $name", (job) => {
    expect(canSimulate(job)).toEqual({ ok: true });
    const result = simulate(job, { mds: [job.well.bitMd_ft], fromMd_ft: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toHaveLength(1);
  });

  it("still simulates one constant section", () => {
    const job = structuredClone(exampleB);
    Object.assign(job.well, { stringSections: [] });
    expect(canSimulate(job)).toEqual({ ok: true });
    Object.assign(job.well, {
      stringSections: [{ length_ft: job.well.bitMd_ft, od_in: job.well.stringOd_in, id_in: job.well.stringId_in }],
    });
    expect(canSimulate(job)).toEqual({ ok: true });
  });
});

describe("simulate steps[0]", () => {
  it.each(JOBS)("matches KPI and EMW on $name", (job) => {
    const sim = defaultSim(job);
    const kpi = kpiVolumes(job);
    const emw = emwProfile(job);
    expect(kpi.ok).toBe(true);
    expect(emw.ok).toBe(true);
    if (!kpi.ok || !emw.ok) return;
    const step = sim.steps[0];
    expect(step.index).toBe(0);
    expect(step.pipeMd_ft).toBe(job.well.bitMd_ft);
    expect(step.tripTank_bbl).toBe(0);
    near(step.chase_bbl, kpi.chase.chase_bbl, 1e-6, "chase");
    near(step.stringCapacity_bbl, kpi.chase.stringCapacity_bbl, 1e-6, "string capacity");
    near(step.kmwInString_bbl, kpi.kmwInString.bbl, 1e-6, "kmw in string");
    near(sim.kpi.ok ? sim.kpi.pillVolume_bbl : null, kpi.pillVolume_bbl, 1e-6, "pill volume");
    near(
      sim.kpi.ok ? sim.kpi.pillVolumeBreakdown.stringCapOverPillInterval_bbl : null,
      kpi.pillVolumeBreakdown.stringCapOverPillInterval_bbl,
      1e-6,
      "interval",
    );
    near(
      sim.kpi.ok ? sim.kpi.pillVolumeBreakdown.chase_bbl : null,
      kpi.pillVolumeBreakdown.chase_bbl,
      1e-6,
      "breakdown chase",
    );
    near(step.chase_bbl, kpi.pillVolumeBreakdown.chase_bbl, 1e-6, "step chase");

    const profile = okEmw(step.spotted, "step spotted");
    const inPlace = okFluid(sim.inPlace, "result inPlace");
    expect(profile.limits).toEqual(emw.limits);
    expect(inPlace.label).toBe(emw.inPlace.label);
    expect(profile.inPlace.label).toBe(emw.inPlace.label);
    expect(profile.spotted.label).toBe(emw.spotted.label);
    expect(inPlace.label).toBe("Pill in place (pipe out)");
    expect(profile.spotted.label).toBe("After RIH to bit (closed pipe)");
    expectLinesAt(inPlace.lines, emw.inPlace.lines, [job.well.shoeMd_ft, job.well.bitMd_ft], "inPlace");
    expectLinesAt(profile.inPlace.lines, emw.inPlace.lines, [job.well.shoeMd_ft, job.well.bitMd_ft], "profile inPlace");
    expectLinesAt(profile.spotted.lines, emw.spotted.lines, [job.well.shoeMd_ft, job.well.bitMd_ft], "spotted");
    expect(profile.stations.length).toBe(emw.stations.length);
    expect(inPlace.stations.length).toBe(emw.stations.length);
    for (let i = 0; i < emw.stations.length; i++) {
      for (const name of LINES) {
        near(inPlace.stations[i].emw[name], emw.stations[i].emw.inPlace[name], 1e-6, `station inPlace ${name}`);
        near(profile.stations[i].emw.inPlace[name], emw.stations[i].emw.inPlace[name], 1e-6, `profile station inPlace ${name}`);
        near(profile.stations[i].emw.spotted[name], emw.stations[i].emw.spotted[name], 1e-6, `station spotted ${name}`);
      }
    }
    const inPlaceShoe = emw.shoeCheck.filter((row) => row.pillState === "inPlace");
    const spottedShoe = emw.shoeCheck.filter((row) => row.pillState === "spotted");
    expect(inPlace.shoeCheck.length).toBe(inPlaceShoe.length);
    expect(profile.shoeCheck.length).toBe(emw.shoeCheck.length);
    for (let i = 0; i < inPlaceShoe.length; i++) {
      expect(inPlace.shoeCheck[i].pillState).toBe("inPlace");
      near(inPlace.shoeCheck[i].emw_ppg, inPlaceShoe[i].emw_ppg, 1e-6, "inPlace shoe emw");
      near(inPlace.shoeCheck[i].margin_psi, inPlaceShoe[i].margin_psi, 1e-4, "inPlace shoe psi");
    }
    for (let i = 0; i < spottedShoe.length; i++) {
      const row = profile.shoeCheck.find((item) => item.pillState === "spotted" && item.line === spottedShoe[i].line);
      expect(row?.pillState).toBe("spotted");
      near(row?.emw_ppg ?? null, spottedShoe[i].emw_ppg, 1e-6, "spotted shoe emw");
      near(row?.margin_ppg ?? null, spottedShoe[i].margin_ppg, 1e-6, "spotted shoe margin");
      near(row?.margin_psi ?? null, spottedShoe[i].margin_psi, 1e-4, "spotted shoe psi");
    }

    const placed = columnDisplacedByPipe(job, job.well.bitMd_ft);
    const place = placed ? pillPlacement(placed) : null;
    near(step.pillTop.md_ft, place?.pill?.topMd ?? null, 1e-4, "pill top md");
    near(step.pillBottom.md_ft, place?.pill?.bottomMd ?? null, 1e-4, "pill bottom md");
    near(step.pillTop.tvd_ft, place?.pill ? tvdAt(job.well, place.pill.topMd) : null, 1e-4, "pill top tvd");
    near(
      step.pillBottom.tvd_ft,
      place?.pill ? tvdAt(job.well, place.pill.bottomMd) : null,
      1e-4,
      "pill bottom tvd",
    );
  });
});

describe("simulate pipe-out", () => {
  it.each(JOBS)("spotted equals inPlace at pipe MD 0 on $name", (job) => {
    const sim = defaultSim(job);
    const last = sim.steps[sim.steps.length - 1];
    expect(last.pipeMd_ft).toBe(0);
    const rih = okSim(simulate(job, { mds: [0], fromMd_ft: 0 }));
    expect(rih.steps[0].pipeMd_ft).toBe(0);
    for (const [step, reference] of [
      [last, sim.inPlace],
      [rih.steps[0], rih.inPlace],
    ] as const) {
      const profile = okEmw(step.spotted, job.name);
      const inPlace = okFluid(reference, job.name);
      expect(inPlace.label).toBe("Pill in place (pipe out)");
      expect(profile.inPlace.label).toBe("Pill in place (pipe out)");
      expect(profile.spotted.label).toBe("After RIH to bit (closed pipe)");
      expect(profile.limits.fit_ppg).toBe(job.well.fit_ppg);
      expectFullLines(profile.spotted.lines, profile.inPlace.lines, job.name);
      expectFullLines(profile.spotted.lines, inPlace.lines, job.name);
      expect(profile.stations.length).toBe(inPlace.stations.length);
      for (let i = 0; i < profile.stations.length; i++) {
        for (const name of LINES) {
          near(
            profile.stations[i].emw.spotted[name],
            profile.stations[i].emw.inPlace[name],
            1e-6,
            `${job.name} ${profile.stations[i].label} ${name}`,
          );
          near(
            profile.stations[i].emw.spotted[name],
            inPlace.stations[i].emw[name],
            1e-6,
            `${job.name} ref ${profile.stations[i].label} ${name}`,
          );
        }
      }
      const spottedShoe = profile.shoeCheck.filter((row) => row.pillState === "spotted");
      expect(spottedShoe.length).toBe(inPlace.shoeCheck.length);
      for (const row of spottedShoe) {
        const other = inPlace.shoeCheck.find((item) => item.line === row.line);
        near(row.emw_ppg, other?.emw_ppg ?? null, 1e-6, `${job.name} shoe ${row.line}`);
        near(row.margin_ppg, other?.margin_ppg ?? null, 1e-6, `${job.name} margin ${row.line}`);
      }
    }
  });
});

describe("simulate direction", () => {
  it.each(JOBS)("RIH and POOH match on one shared grid for $name", (job) => {
    const grid = mdGrid(job.well.bitMd_ft, 80);
    expect(grid.length).toBeGreaterThanOrEqual(10);
    const closed = (job.well.stringOd_in ** 2 / 1029.4) * job.well.bitMd_ft;
    for (const md of grid) {
      const rih = okSim(simulate(job, { mds: [md], fromMd_ft: 0 }));
      const pooh = okSim(simulate(job, { mds: [md], fromMd_ft: job.well.bitMd_ft }));
      expect(rih.steps).toHaveLength(1);
      expect(pooh.steps).toHaveLength(1);
      expect(rih.steps[0].pipeMd_ft).toBe(md);
      expect(pooh.steps[0].pipeMd_ft).toBe(md);
      expectPipeFields(rih.steps[0], pooh.steps[0], `${job.name} ${md}`);
      expectFluid(rih.inPlace, pooh.inPlace, `${job.name} ${md} inPlace`);
    }
    const atBit = okSim(simulate(job, { mds: [job.well.bitMd_ft], fromMd_ft: 0 }));
    const atSurface = okSim(simulate(job, { mds: [0], fromMd_ft: job.well.bitMd_ft }));
    near(Math.abs(atBit.steps[0].tripTank_bbl), closed, 1e-6, "rih trip tank");
    near(Math.abs(atSurface.steps[0].tripTank_bbl), closed, 1e-6, "pooh trip tank");
  }, 180_000);
});

function expectTripTankRoundTrip(job: Job) {
  const bit = job.well.bitMd_ft;
  const rih = okSim(simulate(job, { fromMd_ft: 0, toMd_ft: bit }));
  const pooh = okSim(simulate(job, { fromMd_ft: bit, toMd_ft: 0 }));
  const gain = rih.steps[rih.steps.length - 1].tripTank_bbl;
  const fill = pooh.steps[pooh.steps.length - 1].tripTank_bbl;
  expect(rih.steps[0].pipeMd_ft).toBe(0);
  expect(rih.steps[rih.steps.length - 1].pipeMd_ft).toBe(bit);
  expect(pooh.steps[0].pipeMd_ft).toBe(bit);
  expect(pooh.steps[pooh.steps.length - 1].pipeMd_ft).toBe(0);
  expect(gain).toBeGreaterThan(0);
  expect(fill).toBeLessThan(0);
  near(fill, -gain, 1e-6, `${job.name} equal fill`);
  near(gain + fill, 0, 1e-6, `${job.name} net`);
}

describe("simulate trip tank", () => {
  it.each(JOBS)("uses a constant pipe OD on $name", (job) => {
    const inward = okSim(simulate(job, { fromMd_ft: 8400, toMd_ft: 8600, stepMd_ft: 200 }));
    const outward = okSim(simulate(job, { fromMd_ft: 8600, toMd_ft: 8400, stepMd_ft: 200 }));
    expect(inward.steps.map((step) => step.pipeMd_ft)).toEqual([8400, 8600]);
    expect(outward.steps.map((step) => step.pipeMd_ft)).toEqual([8600, 8400]);
    expect(inward.steps[0].tripTank_bbl).toBe(0);
    expect(outward.steps[0].tripTank_bbl).toBe(0);
    const expected = (job.well.stringOd_in ** 2 / 1029.4) * 200;
    const inDelta = inward.steps[1].tripTank_bbl - inward.steps[0].tripTank_bbl;
    const outDelta = outward.steps[1].tripTank_bbl - outward.steps[0].tripTank_bbl;
    near(inDelta, expected, 1e-6, "inward constant OD");
    near(outDelta, -expected, 1e-6, "outward constant OD");
    const atBit = okSim(simulate(job, { mds: [job.well.bitMd_ft], fromMd_ft: 0 }));
    near(atBit.steps[0].tripTank_bbl, (job.well.stringOd_in ** 2 / 1029.4) * job.well.bitMd_ft, 1e-6, "0 to bit");
  });

  it.each(JOBS)("RIH gain and POOH fill net to 0 on $name", (job) => {
    expectTripTankRoundTrip(job);
  }, 60_000);
});

// re-enable when #6 (tapered strings) lands
describe.skip("simulate EXAMPLE D", () => {
  it("matches KPI and EMW on EXAMPLE D", () => {
    const job = exampleDJob();
    const sim = defaultSim(job);
    const emw = emwProfile(job);
    expect(emw.ok).toBe(true);
    if (!emw.ok) return;
    const profile = withString(okEmw(sim.steps[0].spotted, "step spotted"));
    const inPlace = withString(okFluid(sim.inPlace, "result inPlace"));
    const full = withString(emw);
    expect(profile.sections).toEqual(full.sections);
    expect(profile.crossovers).toEqual(full.crossovers);
    expect(inPlace.sections).toEqual(full.sections);
    expect(inPlace.crossovers).toEqual(full.crossovers);
  });

  it("spotted equals inPlace at pipe MD 0 on EXAMPLE D", () => {
    const job = exampleDJob();
    const sim = defaultSim(job);
    const last = sim.steps[sim.steps.length - 1];
    const profile = withString(okEmw(last.spotted, job.name));
    expect(profile.sections.length).toBeGreaterThan(0);
    expect(Array.isArray(profile.crossovers)).toBe(true);
  });

  it("RIH and POOH match on one shared grid for EXAMPLE D", () => {
    const job = exampleDJob();
    const grid = mdGrid(job.well.bitMd_ft, 80);
    expect(grid.length).toBeGreaterThanOrEqual(10);
    expect(grid.some((md) => Math.abs(md - 8480) <= 1e-6)).toBe(true);
    const closed = (5.5 ** 2 / 1029.4) * 8480 + (4 ** 2 / 1029.4) * (job.well.bitMd_ft - 8480);
    for (const md of grid) {
      const rih = okSim(simulate(job, { mds: [md], fromMd_ft: 0 }));
      const pooh = okSim(simulate(job, { mds: [md], fromMd_ft: job.well.bitMd_ft }));
      expect(rih.steps).toHaveLength(1);
      expect(pooh.steps).toHaveLength(1);
      expect(rih.steps[0].pipeMd_ft).toBe(md);
      expect(pooh.steps[0].pipeMd_ft).toBe(md);
      expectPipeFields(rih.steps[0], pooh.steps[0], `${job.name} ${md}`);
      expectFluid(rih.inPlace, pooh.inPlace, `${job.name} ${md} inPlace`);
      expect(withString(rih.steps[0].spotted).sections).toEqual(withString(pooh.steps[0].spotted).sections);
      expect(withString(rih.steps[0].spotted).crossovers).toEqual(withString(pooh.steps[0].spotted).crossovers);
      expect(withString(rih.inPlace).sections).toEqual(withString(pooh.inPlace).sections);
      expect(withString(rih.inPlace).crossovers).toEqual(withString(pooh.inPlace).crossovers);
    }
    const atBit = okSim(simulate(job, { mds: [job.well.bitMd_ft], fromMd_ft: 0 }));
    const atSurface = okSim(simulate(job, { mds: [0], fromMd_ft: job.well.bitMd_ft }));
    near(Math.abs(atBit.steps[0].tripTank_bbl), closed, 1e-6, "rih trip tank");
    near(Math.abs(atSurface.steps[0].tripTank_bbl), closed, 1e-6, "pooh trip tank");
  }, 180_000);
});

// re-enable when #6 (tapered strings) lands
describe.skip("simulate EXAMPLE D trip tank", () => {
  it("splits the 8400 to 8600 increment at the 8480 ft crossover", () => {
    const exampleD = exampleDJob();
    const inward = okSim(simulate(exampleD, { fromMd_ft: 8400, toMd_ft: 8600, stepMd_ft: 200 }));
    const outward = okSim(simulate(exampleD, { fromMd_ft: 8600, toMd_ft: 8400, stepMd_ft: 200 }));
    expect(inward.steps.map((step) => step.pipeMd_ft)).toEqual([8400, 8600]);
    expect(outward.steps.map((step) => step.pipeMd_ft)).toEqual([8600, 8400]);
    expectPipeFields(inward.steps[0], outward.steps[1], "8400");
    expectPipeFields(inward.steps[1], outward.steps[0], "8600");
    const expected = (5.5 ** 2 / 1029.4) * 80 + (4 ** 2 / 1029.4) * 120;
    const inDelta = inward.steps[1].tripTank_bbl - inward.steps[0].tripTank_bbl;
    const outDelta = outward.steps[1].tripTank_bbl - outward.steps[0].tripTank_bbl;
    near(inDelta, expected, 1e-6, "inward split");
    near(outDelta, -expected, 1e-6, "outward split");
  });

  // re-enable when #6 (tapered strings) lands
  it("RIH gain and POOH fill net to 0 on EXAMPLE D", () => {
    expectTripTankRoundTrip(exampleDJob());
  });
});

// re-enable when #6 (tapered strings) lands
describe.skip("simulate spotted profile", () => {
  it("is a full EMW profile, including limits, on EXAMPLE D", () => {
    const exampleD = exampleDJob();
    const sim = okSim(simulate(exampleD, { mds: [exampleD.well.bitMd_ft], fromMd_ft: 0 }));
    const spotted = withString(sim.steps[0].spotted);
    const full = withString(emwProfile(exampleD));
    expect(spotted.ok).toBe(true);
    expect(full.ok).toBe(true);
    if (!spotted.ok || !full.ok) return;
    expect(spotted.inPlace.lines.static.length).toBeGreaterThan(0);
    expect(spotted.spotted.lines.static.length).toBeGreaterThan(0);
    expect(spotted.spotted.lines.staticSbp.length).toBeGreaterThan(0);
    expect(spotted.spotted.lines.ecd.length).toBeGreaterThan(0);
    expect(spotted.stations.length).toBeGreaterThan(0);
    expect(spotted.stations).toEqual(full.stations);
    expect(spotted.limits).toEqual(full.limits);
    expect(spotted.shoeCheck.length).toBeGreaterThan(0);
    expect(spotted.shoeCheck).toEqual(full.shoeCheck);
    expect(spotted.sections.length).toBeGreaterThan(0);
    expect(spotted.sections).toEqual(full.sections);
    expect(spotted.crossovers.length).toBeGreaterThan(0);
    expect(spotted.crossovers).toEqual(full.crossovers);
  });
});

describe("simulate step size", () => {
  it("defaults to 100 ft and records the step count", () => {
    const sim = defaultSim(exampleB);
    expect(sim.meta.stepFt).toBe(DEFAULT_STEP_FT);
    expect(sim.stepMd_ft).toBe(sim.meta.stepFt);
    expect(sim.meta.stepCount).toBe(sim.steps.length);
    expect(sim.meta.stepsLength).toBe(sim.meta.stepCount);
    expect(sim.steps.length).toBe(106);
    expect(sim.steps.length).toBeLessThanOrEqual(MAX_STEPS);
  });

  it("rejects a step below 10 ft and does not raise it", () => {
    const result = simulate(exampleB, { stepMd_ft: 5 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_STEP");
    if (result.error.code === "INVALID_STEP") expect(result.error.field).toBe("stepMd_ft");
  });

  it("allows a 10 ft step on a short span", () => {
    const sim = okSim(simulate(exampleB, { fromMd_ft: 0, toMd_ft: 100, stepMd_ft: 10 }));
    expect(sim.meta.stepFt).toBe(MIN_STEP_FT);
    expect(sim.stepMd_ft).toBe(MIN_STEP_FT);
    expect(sim.meta.stepCount).toBe(sim.steps.length);
    expect(sim.meta.stepsLength).toBe(sim.meta.stepCount);
    expect(sim.steps.map((step) => step.pipeMd_ft)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it("returns STEP_LIMIT for a 10 ft walk to the bit and does not coarsen", () => {
    const result = simulate(exampleB, { fromMd_ft: 0, toMd_ft: exampleB.well.bitMd_ft, stepMd_ft: 10 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: "STEP_LIMIT",
      field: "stepMd_ft",
      message: `This range is more than ${MAX_STEPS} steps. The step is not coarsened.`,
      minStepFt: MIN_STEP_FT,
      maxSteps: MAX_STEPS,
      requestedSteps: 1049,
    });
  });

  it("returns STEP_LIMIT for an explicit list longer than 1000", () => {
    const mds = Array.from({ length: MAX_STEPS + 1 }, (_, index) => index);
    const result = simulate(exampleB, { mds });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: "STEP_LIMIT",
      field: "stepMd_ft",
      message: `This range is more than ${MAX_STEPS} steps. The step is not coarsened.`,
      minStepFt: MIN_STEP_FT,
      maxSteps: MAX_STEPS,
      requestedSteps: MAX_STEPS + 1,
    });
  });

  it("keeps stepFt at 100 when mds is set and the step is omitted", () => {
    const sim = okSim(simulate(exampleB, { mds: [0, 100], fromMd_ft: 0 }));
    expect(sim.meta.stepFt).toBe(DEFAULT_STEP_FT);
    expect(sim.meta.stepCount).toBe(2);
    expect(sim.meta.stepsLength).toBe(sim.meta.stepCount);
    expect(sim.steps).toHaveLength(2);
  });

  it("rejects a step below 10 ft when mds is set", () => {
    const result = simulate(exampleB, { mds: [0], stepMd_ft: 9 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_STEP");
  });
});
