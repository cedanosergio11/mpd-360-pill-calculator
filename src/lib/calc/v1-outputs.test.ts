import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { EXAMPLE_8_5, EXAMPLE_SHALLOW, EMPTY_INPUTS } from "./examples";
import { buildSchedule } from "./schedule";
import { buildSteelSchedule } from "./steel";
import type { CalcResults, WellInputs } from "./types";

/** EXAMPLE sheet numbers, with no client or well name. */
const EXAMPLE_5: WellInputs = {
  ...EMPTY_INPUTS,
  wellName: "EXAMPLE",
  client: "",
  date: "2026-10-05",
  sectionType: "Intermediate",
  pillMode: "noSlug",
  currentDepthMd: 10530,
  anchorMd: 10480,
  anchorTvd: 10466,
  casingMd: 3199,
  casingTvd: 3187,
  spotMd: 10480,
  spotTvd: 10466,
  openHoleDia: 12.25,
  odDp: 5.5,
  idDp: 4.778,
  idCasing: 12.515,
  currentMw: 11.4,
  kmw: 14,
  desiredEmw: 12,
  sbpConnection: 325,
  fit: 12.6,
  maxFlowRate: 300,
  initialFlowRate: 300,
  safevisionNoSlug: 11.5,
  pumpDisp: 0.0914,
  desiredResolution: 30,
  overbalanceSlug: 300,
  taperedOn: false,
  odDp1: 5.5,
  idDp1: 4.778,
};

function finiteTree(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(finiteTree);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = finiteTree(item);
    return out;
  }
  return value;
}

function sheet(inputs: WellInputs) {
  const results = calculate(inputs);
  const { depthBlock, ...rest } = results;
  const schedule = buildSchedule(inputs, results);
  const steel = buildSteelSchedule(inputs, results);
  return finiteTree({
    results: rest,
    schedule: {
      mode: schedule.mode,
      heavyVolume: schedule.heavyVolume,
      finalVolume: schedule.finalVolume,
      finalStrokes: schedule.finalStrokes,
      rows: schedule.rows.map((row) => ({
        step: row.step,
        sbp: row.sbp,
        flow: row.flow,
        volume: row.volume,
        strokes: row.strokes,
        density: row.density,
        staticSbp: row.staticSbp,
      })),
    },
    steel: steel.rows.map((row) => ({
      bitDepth: row.bitDepth,
      emwShoeStatic: row.emwShoeStatic,
      emwStatic: row.emwStatic,
    })),
    depthBlock,
  });
}

function golden(name: string) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
}

describe("1.0.7.1 outputs stay put", () => {
  it("pins EXAMPLE 8.5 in, the shallow check, and EXAMPLE 5", () => {
    for (const [name, inputs] of [
      ["EXAMPLE_8_5", EXAMPLE_8_5],
      ["EXAMPLE_SHALLOW", EXAMPLE_SHALLOW],
      ["EXAMPLE_5", EXAMPLE_5],
    ] as const) {
      const got = sheet(inputs) as { depthBlock: CalcResults["depthBlock"] };
      expect(got.depthBlock).toBeNull();
      const { depthBlock: _block, ...rest } = got;
      expect(rest).toEqual(golden(name));
    }
  });
});
