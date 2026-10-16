import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { DEPTH_BEYOND_TD, MD_BEYOND_SURVEY, depthBeyondFields } from "@/lib/calc/depth";
import type { DepthField } from "@/lib/calc/types";
import { useAppStore } from "@/lib/store";
import { asNum, isNum } from "@/lib/utils";
import { composeWellState, geometryFromWell, pillFromProcedure } from "./from-calc";
import { computeModel } from "./physics";
import { DEFAULT_STATE, type PillModel, type WellState } from "./types";

export interface SimStep {
  pipeMd: number;
  pillTop: number;
  pillBottom: number;
  tripTankGain: number;
  phase: string;
}

export type SimulateResult =
  | { ok: true; steps: SimStep[]; models: PillModel[] }
  | { ok: false; code: typeof DEPTH_BEYOND_TD | typeof MD_BEYOND_SURVEY; fields: DepthField[] };

/**
 * Step the existing 1.0 pill model at each pipe MD.
 * A depth block returns the field list and no step numbers.
 */
export function simulate(
  inputs: WellInputs,
  results: CalcResults,
  pipeMds: number[],
  live?: WellState,
): SimulateResult {
  const editBlock = useAppStore.getState().editBlock;
  if (editBlock) {
    return { ok: false, code: editBlock.code, fields: editBlock.fields };
  }

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

  const base = live ?? placedState(inputs, results);
  const models: PillModel[] = [];
  const steps = pipeMds.map((pipeMd) => {
    const state = { ...base, pipeDepth: pipeMd };
    const model = computeModel(state);
    models.push(model);
    return {
      pipeMd,
      pillTop: model.pillTop,
      pillBottom: model.pillBottom,
      tripTankGain: model.tripTankGain,
      phase: model.phase,
    };
  });
  return { ok: true, steps, models };
}

function placedState(inputs: WellInputs, results: CalcResults): WellState {
  const geometry = geometryFromWell(inputs);
  const placed = pillFromProcedure(inputs, results, geometry, "closed");
  return composeWellState(inputs, {
    ...DEFAULT_STATE,
    ...placed,
    pipeEnd: "closed",
    autoBackfill: true,
  });
}
