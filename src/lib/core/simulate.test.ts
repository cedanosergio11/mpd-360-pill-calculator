import { describe, expect, it } from "vitest";
import { exampleB, exampleC, exampleD } from "@/lib/example-b";
import { columnDisplacedByPipe, pillPlacement } from "./column";
import { emwProfile, type EmwLines, type EmwProfileResult } from "./emw-profile";
import type { Job } from "./job.schema";
import { kpiVolumes } from "./kpi";
import { simulate, type SimulateResult, type SimulateStep } from "./simulate";
import { stringVolumeBbl } from "./string";

const JOBS = [exampleB, exampleC, exampleD] as const;
const LINES = ["static", "staticSbp", "ecd"] as const;

function okSim(result: SimulateResult): Extract<SimulateResult, { ok: true }> {
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

function okEmw(emw: EmwProfileResult, where: string): Extract<EmwProfileResult, { ok: true }> {
  if (!emw.ok) throw new Error(`${where}: ${emw.error.message}`);
  return emw;
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

function expectProfilesMatch(left: Extract<EmwProfileResult, { ok: true }>, right: Extract<EmwProfileResult, { ok: true }>, label: string) {
  expectFullLines(left.inPlace.lines, right.inPlace.lines, `${label} inPlace`);
  expectFullLines(left.spotted.lines, right.spotted.lines, `${label} spotted`);
  expect(left.stations.length, label).toBe(right.stations.length);
  for (let i = 0; i < left.stations.length; i++) {
    for (const name of LINES) {
      near(left.stations[i].emw.inPlace[name], right.stations[i].emw.inPlace[name], 1e-6, `${label} station inPlace ${name}`);
      near(left.stations[i].emw.spotted[name], right.stations[i].emw.spotted[name], 1e-6, `${label} station spotted ${name}`);
    }
  }
  expect(left.shoeCheck.length, label).toBe(right.shoeCheck.length);
  for (let i = 0; i < left.shoeCheck.length; i++) {
    expect(left.shoeCheck[i].line).toBe(right.shoeCheck[i].line);
    expect(left.shoeCheck[i].pillState).toBe(right.shoeCheck[i].pillState);
    near(left.shoeCheck[i].emw_ppg, right.shoeCheck[i].emw_ppg, 1e-6, `${label} shoe emw`);
    near(left.shoeCheck[i].margin_ppg, right.shoeCheck[i].margin_ppg, 1e-6, `${label} shoe margin ppg`);
    near(left.shoeCheck[i].margin_psi, right.shoeCheck[i].margin_psi, 1e-4, `${label} shoe margin psi`);
  }
  expect(left.sections).toEqual(right.sections);
  expect(left.crossovers).toEqual(right.crossovers);
}

function expectPipeFields(left: SimulateStep, right: SimulateStep, label: string) {
  near(left.chase_bbl, right.chase_bbl, 1e-6, `${label} chase`);
  near(left.stringCapacity_bbl, right.stringCapacity_bbl, 1e-6, `${label} string`);
  near(left.kmwInString_bbl, right.kmwInString_bbl, 1e-6, `${label} kmw`);
  near(left.pillTopMd_ft, right.pillTopMd_ft, 1e-4, `${label} pill top`);
  near(left.pillBottomMd_ft, right.pillBottomMd_ft, 1e-4, `${label} pill bottom`);
  const leftEmw = okEmw(left.emw, `${label} rih`);
  const rightEmw = okEmw(right.emw, `${label} pooh`);
  expectProfilesMatch(leftEmw, rightEmw, label);
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

    const stepEmw = okEmw(step.emw, "step");
    expect(stepEmw.inPlace.label).toBe(emw.inPlace.label);
    expect(stepEmw.spotted.label).toBe(emw.spotted.label);
    expect(stepEmw.inPlace.label).toBe("Pill in place (pipe out)");
    expect(stepEmw.spotted.label).toBe("After RIH to bit (closed pipe)");
    expectLinesAt(stepEmw.inPlace.lines, emw.inPlace.lines, [job.well.shoeMd_ft, job.well.bitMd_ft], "inPlace");
    expectLinesAt(stepEmw.spotted.lines, emw.spotted.lines, [job.well.shoeMd_ft, job.well.bitMd_ft], "spotted");
    expect(stepEmw.stations.length).toBe(emw.stations.length);
    for (let i = 0; i < emw.stations.length; i++) {
      for (const name of LINES) {
        near(stepEmw.stations[i].emw.inPlace[name], emw.stations[i].emw.inPlace[name], 1e-6, `station inPlace ${name}`);
        near(stepEmw.stations[i].emw.spotted[name], emw.stations[i].emw.spotted[name], 1e-6, `station spotted ${name}`);
      }
    }
    expect(stepEmw.shoeCheck.length).toBe(emw.shoeCheck.length);
    for (let i = 0; i < emw.shoeCheck.length; i++) {
      near(stepEmw.shoeCheck[i].emw_ppg, emw.shoeCheck[i].emw_ppg, 1e-6, "shoe emw");
      near(stepEmw.shoeCheck[i].margin_ppg, emw.shoeCheck[i].margin_ppg, 1e-6, "shoe margin");
      near(stepEmw.shoeCheck[i].margin_psi, emw.shoeCheck[i].margin_psi, 1e-4, "shoe psi");
    }
    expect(stepEmw.sections).toEqual(emw.sections);
    expect(stepEmw.crossovers).toEqual(emw.crossovers);

    const placed = columnDisplacedByPipe(job, job.well.bitMd_ft);
    const place = placed ? pillPlacement(placed) : null;
    near(step.pillTopMd_ft, place?.pill?.topMd ?? null, 1e-4, "pill top");
    near(step.pillBottomMd_ft, place?.pill?.bottomMd ?? null, 1e-4, "pill bottom");
  });
});

describe("simulate pipe-out", () => {
  it.each(JOBS)("spotted equals inPlace at pipe MD 0 on $name", (job) => {
    const sim = defaultSim(job);
    const last = sim.steps[sim.steps.length - 1];
    expect(last.pipeMd_ft).toBe(0);
    const rih = okSim(simulate(job, { mds: [0], fromMd_ft: 0 }));
    expect(rih.steps[0].pipeMd_ft).toBe(0);
    for (const step of [last, rih.steps[0]]) {
      const emw = okEmw(step.emw, job.name);
      expect(emw.inPlace.label).toBe("Pill in place (pipe out)");
      expect(emw.spotted.label).toBe("After RIH to bit (closed pipe)");
      expectFullLines(emw.spotted.lines, emw.inPlace.lines, job.name);
      for (const station of emw.stations) {
        for (const name of LINES) {
          near(station.emw.spotted[name], station.emw.inPlace[name], 1e-6, `${job.name} ${station.label} ${name}`);
        }
      }
      const spotted = emw.shoeCheck.filter((row) => row.pillState === "spotted");
      const inPlace = emw.shoeCheck.filter((row) => row.pillState === "inPlace");
      expect(spotted.length).toBe(inPlace.length);
      for (const row of spotted) {
        const other = inPlace.find((item) => item.line === row.line);
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
