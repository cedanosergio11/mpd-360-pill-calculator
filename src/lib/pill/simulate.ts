import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { DEPTH_BEYOND_TD, depthBeyondFields } from "@/lib/calc/depth";
import type { DepthField } from "@/lib/calc/types";
import { asNum, isNum } from "@/lib/utils";
import { composeWellState, geometryFromWell, pillFromProcedure } from "./from-calc";
import { computeModel } from "./physics";
import { DEFAULT_STATE } from "./types";

export interface SimStep {
  pipeMd: number;
  pillTop: number;
  pillBottom: number;
  tripTankGain: number;
  phase: string;
}

export type SimulateResult =
  | { ok: true; steps: SimStep[] }
  | { ok: false; code: typeof DEPTH_BEYOND_TD; fields: DepthField[] };

/**
 * Step the existing 1.0 pill model at each pipe MD.
 * A depth block returns the field list and no step numbers.
 */
export function simulate(inputs: WellInputs, results: CalcResults, pipeMds: number[]): SimulateResult {
  const fields = depthBeyondFields(inputs);
  const td = asNum(inputs.tdDepth);
  if (isNum(td)) {
    for (const pipeMd of pipeMds) {
      if (isNum(pipeMd) && pipeMd > td + 1e-4) {
        fields.push({ label: "Pipe MD", value: pipeMd, limit: td, limitLabel: "TD" });
      }
    }
  }
  if (fields.length || results.depthBlock) {
    return { ok: false, code: DEPTH_BEYOND_TD, fields: fields.length ? fields : results.depthBlock!.fields };
  }

  const geometry = geometryFromWell(inputs);
  const placed = pillFromProcedure(inputs, results, geometry, "closed");
  const base = composeWellState(inputs, {
    ...DEFAULT_STATE,
    ...placed,
    pipeEnd: "closed",
    autoBackfill: true,
  });
  const steps = pipeMds.map((pipeMd) => {
    const state = { ...base, pipeDepth: pipeMd };
    const model = computeModel(state);
    return {
      pipeMd,
      pillTop: model.pillTop,
      pillBottom: model.pillBottom,
      tripTankGain: model.tripTankGain,
      phase: model.phase,
    };
  });
  return { ok: true, steps };
}
