import { describe, expect, it } from "vitest";
import { exampleB, exampleC, exampleD } from "@/lib/example-b";
import { columnDisplacedByPipe, pillPlacement } from "./column";
import { emwProfile, type EmwLines } from "./emw-profile";
import type { Job } from "./job.schema";
import { kpiVolumes } from "./kpi";
import {
  simulate,
  type SimulateFluidResult,
  type SimulateResult,
  type SimulateStep,
} from "./simulate";
import { stringVolumeBbl } from "./string";
import { tvdAt } from "./tvd";

const JOBS = [exampleB, exampleC, exampleD] as const;
const LINES = ["static", "staticSbp", "ecd"] as const;

function okSim(result: SimulateResult): Extract<SimulateResult, { ok: true }> {
  if (!result.ok) throw new Error(result.error.message);
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
  expect(a.sections, label).toEqual(b.sections);
  expect(a.crossovers, label).toEqual(b.crossovers);
}

function expectPipeFields(left: SimulateStep, right: SimulateStep, label: string) {
  near(left.chase_bbl, right.chase_bbl, 1e-6, `${label} chase`);
  near(left.stringCapacity_bbl, right.stringCapacity_bbl, 1e-6, `${label} string`);
  near(left.kmwInString_bbl, right.kmwInString_bbl, 1e-6, `${label} kmw`);
  near(left.pillTop.md_ft, right.pillTop.md_ft, 1e-4, `${label} pill top md`);
  near(left.pillTop.tvd_ft, right.pillTop.tvd_ft, 1e-4, `${label} pill top tvd`);
  near(left.pillBottom.md_ft, right.pillBottom.md_ft, 1e-4, `${label} pill bottom md`);
  near(left.pillBottom.tvd_ft, right.pillBottom.tvd_ft, 1e-4, `${label} pill bottom tvd`);
  expectFluid(left.spotted, right.spotted, `${label} spotted`);
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

    const spotted = okFluid(step.spotted, "step spotted");
    const inPlace = okFluid(sim.inPlace, "result inPlace");
    expect(inPlace.label).toBe(emw.inPlace.label);
    expect(spotted.label).toBe(emw.spotted.label);
    expect(inPlace.label).toBe("Pill in place (pipe out)");
    expect(spotted.label).toBe("After RIH to bit (closed pipe)");
    expectLinesAt(inPlace.lines, emw.inPlace.lines, [job.well.shoeMd_ft, job.well.bitMd_ft], "inPlace");
    expectLinesAt(spotted.lines, emw.spotted.lines, [job.well.shoeMd_ft, job.well.bitMd_ft], "spotted");
    expect(spotted.stations.length).toBe(emw.stations.length);
    expect(inPlace.stations.length).toBe(emw.stations.length);
    for (let i = 0; i < emw.stations.length; i++) {
      for (const name of LINES) {
        near(inPlace.stations[i].emw[name], emw.stations[i].emw.inPlace[name], 1e-6, `station inPlace ${name}`);
        near(spotted.stations[i].emw[name], emw.stations[i].emw.spotted[name], 1e-6, `station spotted ${name}`);
      }
    }
    const inPlaceShoe = emw.shoeCheck.filter((row) => row.pillState === "inPlace");
    const spottedShoe = emw.shoeCheck.filter((row) => row.pillState === "spotted");
    expect(inPlace.shoeCheck.length).toBe(inPlaceShoe.length);
    expect(spotted.shoeCheck.length).toBe(spottedShoe.length);
    for (let i = 0; i < inPlaceShoe.length; i++) {
      expect(inPlace.shoeCheck[i].pillState).toBe("inPlace");
      near(inPlace.shoeCheck[i].emw_ppg, inPlaceShoe[i].emw_ppg, 1e-6, "inPlace shoe emw");
      near(inPlace.shoeCheck[i].margin_psi, inPlaceShoe[i].margin_psi, 1e-4, "inPlace shoe psi");
    }
    for (let i = 0; i < spottedShoe.length; i++) {
      expect(spotted.shoeCheck[i].pillState).toBe("spotted");
      near(spotted.shoeCheck[i].emw_ppg, spottedShoe[i].emw_ppg, 1e-6, "spotted shoe emw");
      near(spotted.shoeCheck[i].margin_ppg, spottedShoe[i].margin_ppg, 1e-6, "spotted shoe margin");
      near(spotted.shoeCheck[i].margin_psi, spottedShoe[i].margin_psi, 1e-4, "spotted shoe psi");
    }
    expect(spotted.sections).toEqual(emw.sections);
    expect(spotted.crossovers).toEqual(emw.crossovers);
    expect(inPlace.sections).toEqual(emw.sections);
    expect(inPlace.crossovers).toEqual(emw.crossovers);

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
      const spotted = okFluid(step.spotted, job.name);
      const inPlace = okFluid(reference, job.name);
      expect(inPlace.label).toBe("Pill in place (pipe out)");
      expect(spotted.label).toBe("After RIH to bit (closed pipe)");
      expectFullLines(spotted.lines, inPlace.lines, job.name);
      expect(spotted.stations.length).toBe(inPlace.stations.length);
      for (let i = 0; i < spotted.stations.length; i++) {
        for (const name of LINES) {
          near(
            spotted.stations[i].emw[name],
            inPlace.stations[i].emw[name],
            1e-6,
            `${job.name} ${spotted.stations[i].label} ${name}`,
          );
        }
      }
      expect(spotted.shoeCheck.length).toBe(inPlace.shoeCheck.length);
      for (const row of spotted.shoeCheck) {
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
    if (job === exampleD) expect(grid.some((md) => Math.abs(md - 8480) <= 1e-6)).toBe(true);
    const closed = stringVolumeBbl(job.well, 0, job.well.bitMd_ft, "closed");
    expect(closed).not.toBeNull();
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

describe("simulate EXAMPLE D trip tank", () => {
  it("splits the 8400 to 8600 increment at the 8480 ft crossover", () => {
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
});

describe("simulate step size", () => {
  it("defaults to 100 ft and records the step count", () => {
    const sim = defaultSim(exampleB);
    expect(sim.meta.stepFt).toBe(100);
    expect(sim.stepMd_ft).toBe(sim.meta.stepFt);
    expect(sim.meta.stepsLength).toBe(sim.steps.length);
    expect(sim.steps.length).toBe(106);
    expect(sim.steps.length).toBeLessThanOrEqual(1000);
  });

  it("rejects a step below 10 ft and does not raise it", () => {
    const result = simulate(exampleB, { stepMd_ft: 5 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_STEP");
    expect(result.error.field).toBe("stepMd_ft");
  });

  it("allows a 10 ft step on a short span", () => {
    const sim = okSim(simulate(exampleB, { fromMd_ft: 0, toMd_ft: 100, stepMd_ft: 10 }));
    expect(sim.meta.stepFt).toBe(10);
    expect(sim.stepMd_ft).toBe(10);
    expect(sim.meta.stepsLength).toBe(sim.steps.length);
    expect(sim.steps.map((step) => step.pipeMd_ft)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it("returns STEP_LIMIT for a 10 ft walk to the bit and does not coarsen", () => {
    const result = simulate(exampleB, { fromMd_ft: 0, toMd_ft: exampleB.well.bitMd_ft, stepMd_ft: 10 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: "STEP_LIMIT",
      field: "stepMd_ft",
      message: "This range is more than 1000 steps. The step is not coarsened.",
    });
  });

  it("returns STEP_LIMIT for an explicit list longer than 1000", () => {
    const mds = Array.from({ length: 1001 }, (_, index) => index);
    const result = simulate(exampleB, { mds });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("STEP_LIMIT");
    expect(result.error.field).toBe("stepMd_ft");
  });

  it("keeps stepFt at 100 when mds is set and the step is omitted", () => {
    const sim = okSim(simulate(exampleB, { mds: [0, 100], fromMd_ft: 0 }));
    expect(sim.meta.stepFt).toBe(100);
    expect(sim.meta.stepsLength).toBe(2);
    expect(sim.steps).toHaveLength(2);
  });

  it("rejects a step below 10 ft when mds is set", () => {
    const result = simulate(exampleB, { mds: [0], stepMd_ft: 9 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_STEP");
  });
});
